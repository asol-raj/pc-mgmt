import { parseSystemInfo } from './systeminfo.js';
import {
  DEVICE_HEALTH_VALUES,
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
  // Multimedia hardware the machine checks on every run — a mic that gets disabled
  // should show up in the register the same way a changed IP does.
  audio_output: DEVICE_HEALTH_VALUES,
  microphone: DEVICE_HEALTH_VALUES,
  camera: DEVICE_HEALTH_VALUES,
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

/** Column lengths from db/migrations/0006, so an oversize name is a 400 and not a MySQL error. */
const SOFTWARE_LIMITS = { name: 200, version: 100, publisher: 200 } as const;
const PRINTER_LIMITS = { name: 200, driver: 200, port: 200, status: 50 } as const;
export const PRINTER_KIND_VALUES = ['Local', 'Network', 'Virtual'];

// Sanity caps on the list lengths. A real PC has a few dozen to a few hundred
// programs and a handful of printers; anything past these is a runaway agent.
const MAX_SOFTWARE_ITEMS = 2000;
const MAX_PRINTER_ITEMS = 200;

/** One installed program as the agent reports it. */
export interface SoftwareItem {
  name: string;
  version: string | null;
  publisher: string | null;
  /** YYYY-MM-DD, or null. */
  install_date: string | null;
}

/** One installed printer as the agent reports it. */
export interface PrinterItem {
  name: string;
  driver: string | null;
  port: string | null;
  kind: string;
  is_default: number;
  status: string | null;
}

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
  /**
   * Installed programs, one entry each. `undefined` when the report carried no
   * `software` key at all (an older agent), which leaves the stored list alone; an
   * empty array is a positive "nothing installed" and clears it.
   */
  software?: SoftwareItem[];
  /** Installed printers, on the same undefined-vs-empty terms as `software`. */
  printers?: PrinterItem[];
}

/** A trimmed string of at most `max` characters, or null when blank. Longer values are cut, not refused: a program's name is not worth failing the whole report over. */
function clipped(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

/** YYYY-MM-DD if the value is a plausible calendar date, otherwise null. */
function isoDate(value: unknown): string | null {
  const text = clipped(value, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function parseSoftware(raw: unknown): { items?: SoftwareItem[]; error?: string } {
  if (raw === undefined || raw === null) return {};
  if (!Array.isArray(raw)) return { error: 'software must be an array of { name, version, publisher, install_date }' };
  if (raw.length > MAX_SOFTWARE_ITEMS) return { error: `software may list at most ${MAX_SOFTWARE_ITEMS} entries` };

  const items: SoftwareItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return { error: 'each software entry must be an object' };
    const name = clipped(entry.name, SOFTWARE_LIMITS.name);
    if (!name) continue; // a nameless entry says nothing worth storing
    items.push({
      name,
      version: clipped(entry.version, SOFTWARE_LIMITS.version),
      publisher: clipped(entry.publisher, SOFTWARE_LIMITS.publisher),
      install_date: isoDate(entry.install_date),
    });
  }
  return { items };
}

function parsePrinters(raw: unknown): { items?: PrinterItem[]; error?: string } {
  if (raw === undefined || raw === null) return {};
  if (!Array.isArray(raw)) return { error: 'printers must be an array of { name, driver, port, kind, is_default, status }' };
  if (raw.length > MAX_PRINTER_ITEMS) return { error: `printers may list at most ${MAX_PRINTER_ITEMS} entries` };

  const items: PrinterItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return { error: 'each printer entry must be an object' };
    const name = clipped(entry.name, PRINTER_LIMITS.name);
    if (!name) continue;
    const kind = clipped(entry.kind, 20) ?? 'Local';
    if (!PRINTER_KIND_VALUES.includes(kind)) {
      return { error: `printer kind must be one of ${PRINTER_KIND_VALUES.join(', ')}` };
    }
    items.push({
      name,
      driver: clipped(entry.driver, PRINTER_LIMITS.driver),
      port: clipped(entry.port, PRINTER_LIMITS.port),
      kind,
      is_default: entry.is_default === true || entry.is_default === 1 || entry.is_default === '1' ? 1 : 0,
      status: clipped(entry.status, PRINTER_LIMITS.status),
    });
  }
  return { items };
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

  const software = parseSoftware(source.software);
  if (software.error) return { error: software.error };

  const printers = parsePrinters(source.printers);
  if (printers.error) return { error: printers.error };

  return {
    report: {
      machine_id,
      asset_tag,
      name,
      detected,
      location,
      software: software.items,
      printers: printers.items,
    },
  };
}
