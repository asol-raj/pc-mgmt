import { parseSystemInfo } from './systeminfo.js';
import {
  MACHINE_TYPE_VALUES,
  STORAGE_TYPE_VALUES,
  OS_VALUES,
  OS_EDITION_VALUES,
  IP_CONFIG_VALUES,
  isValidIpAddress,
} from './validate';

// Fields the agent owns: every report overwrites them with what the machine
// detected. Everything else on the row (location, status, performance,
// condition, extension, users, comments) is admin-curated and never touched.
const DETECTED_ENUMS: Record<string, string[]> = {
  machine_type: MACHINE_TYPE_VALUES,
  storage_type: STORAGE_TYPE_VALUES,
  os: OS_VALUES,
  os_edition: OS_EDITION_VALUES,
  ip_config: IP_CONFIG_VALUES,
};

// Column lengths from db/schema.sql — checked here so a too-long value comes
// back as a clear 400 instead of a MySQL error.
const DETECTED_STRINGS: Record<string, number> = {
  name: 100,
  brand: 50,
  cpu: 100,
  storage_capacity: 20,
  ip_address: 45,
  teamviewer_id: 50,
  softwares: 4000,
  assigned_users: 255,
};

export interface AgentReport {
  /**
   * Stable per-machine id (Windows MachineGuid / hardware UUID). The strongest
   * identifier: unlike asset_tag and name it survives an admin renaming the PC,
   * so a machine that already reported can never end up with a second row.
   */
  machine_id: string;
  /** Identifies which row to update when no machine_id was reported. */
  asset_tag: string;
  /**
   * Windows host name — both an identifier for matching and a detected field, since
   * PCs get renamed in Windows to match desk extensions and the register follows.
   */
  name: string;
  /** Agent-owned fields, written on every report. */
  detected: Record<string, string | number>;
  /** Only used when the PC is new to the register — the agent never sends it. */
  location: string;
}

function textValue(source: Record<string, any>, key: string): string {
  const value = source[key];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Drops empty keys so an explicit payload field never shadows a parsed one with ''. */
function withoutBlanks(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    out[key] = value;
  }
  return out;
}

export function buildAgentReport(body: any): { report?: AgentReport; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid JSON body' };

  // A raw `systeminfo` dump fills in whatever the caller did not send explicitly.
  let source: Record<string, any> = body;
  if (typeof body.systeminfo === 'string' && body.systeminfo.trim()) {
    source = { ...parseSystemInfo(body.systeminfo), ...withoutBlanks(body) };
  }

  const machine_id = textValue(source, 'machine_id') || textValue(source, 'machine_guid');
  if (machine_id.length > 100) return { error: 'machine_id must be 100 characters or fewer' };

  const asset_tag = textValue(source, 'asset_tag');
  const name = textValue(source, 'name') || textValue(source, 'host_name');

  if (!machine_id && !asset_tag && !name) {
    return { error: 'machine_id, asset_tag or name (the Windows host name) is required' };
  }
  if (asset_tag.length > 50) return { error: 'asset_tag must be 50 characters or fewer' };
  if (name.length > 100) return { error: 'name must be 100 characters or fewer' };

  const detected: Record<string, string | number> = {};
  if (name) detected.name = name;

  for (const [key, maxLength] of Object.entries(DETECTED_STRINGS)) {
    const value = textValue(source, key);
    if (!value) continue;
    if (value.length > maxLength) {
      return { error: `${key} must be ${maxLength} characters or fewer` };
    }
    detected[key] = value;
  }

  for (const [key, allowed] of Object.entries(DETECTED_ENUMS)) {
    const value = textValue(source, key);
    if (!value) continue;
    if (!allowed.includes(value)) {
      return { error: `${key} must be one of ${allowed.join(', ')}` };
    }
    detected[key] = value;
  }

  if (detected.ip_address && !isValidIpAddress(String(detected.ip_address))) {
    return { error: 'ip_address must be a valid IPv4 or IPv6 address' };
  }

  if (source.ram_gb !== null && source.ram_gb !== undefined && String(source.ram_gb).trim() !== '') {
    const ram_gb = Number(source.ram_gb);
    if (!Number.isFinite(ram_gb) || ram_gb < 0 || ram_gb > 65535) {
      return { error: 'ram_gb must be a number between 0 and 65535' };
    }
    detected.ram_gb = Math.round(ram_gb);
  }

  const location = textValue(source, 'location');
  if (location.length > 150) return { error: 'location must be 150 characters or fewer' };

  return {
    report: {
      machine_id,
      asset_tag,
      name,
      detected,
      location,
    },
  };
}
