import type { PcInput } from './types';

export const MACHINE_TYPE_VALUES = ['Desktop', 'Laptop', 'AIO'];
export const STORAGE_TYPE_VALUES = ['SSD', 'HDD'];
export const OS_VALUES = ['Windows 10', 'Windows 11'];
export const OS_EDITION_VALUES = ['Home', 'Pro', 'Enterprise', 'Education'];
export const IP_CONFIG_VALUES = ['Static', 'Dynamic'];

// IPv4 dotted quad, or anything that looks like an IPv6 address.
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

export const CONDITION_VALUES = ['New', 'Refurbished'];
export const PERFORMANCE_VALUES = ['Slow', 'Average', 'Good', 'Excellent'];
export const STATUS_VALUES = ['Active', 'Retired'];

export function isValidIpAddress(value: string): boolean {
  return IPV4_RE.test(value) || (value.includes(':') && IPV6_RE.test(value));
}

export function validatePcInput(body: any): { data?: PcInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' };

  const asset_tag = String(body.asset_tag ?? '').trim();
  const name = String(body.name ?? '').trim();
  const location = String(body.location ?? '').trim();

  if (!asset_tag) return { error: 'asset_tag is required' };
  if (!name) return { error: 'name is required' };
  if (!location) return { error: 'location is required' };
  if (!MACHINE_TYPE_VALUES.includes(body.machine_type))
    return { error: `machine_type must be one of ${MACHINE_TYPE_VALUES.join(', ')}` };
  if (!OS_VALUES.includes(body.os)) return { error: `os must be one of ${OS_VALUES.join(', ')}` };
  if (!CONDITION_VALUES.includes(body.condition_status))
    return { error: `condition_status must be one of ${CONDITION_VALUES.join(', ')}` };
  if (!PERFORMANCE_VALUES.includes(body.performance))
    return { error: `performance must be one of ${PERFORMANCE_VALUES.join(', ')}` };
  if (!STATUS_VALUES.includes(body.status))
    return { error: `status must be one of ${STATUS_VALUES.join(', ')}` };

  let os_edition = null;
  if (body.os_edition) {
    if (!OS_EDITION_VALUES.includes(body.os_edition))
      return { error: `os_edition must be one of ${OS_EDITION_VALUES.join(', ')}` };
    os_edition = body.os_edition;
  }

  let ip_config = null;
  if (body.ip_config) {
    if (!IP_CONFIG_VALUES.includes(body.ip_config))
      return { error: `ip_config must be one of ${IP_CONFIG_VALUES.join(', ')}` };
    ip_config = body.ip_config;
  }

  let ip_address = null;
  if (body.ip_address != null && String(body.ip_address).trim() !== '') {
    ip_address = String(body.ip_address).trim();
    if (!isValidIpAddress(ip_address)) {
      return { error: 'ip_address must be a valid IPv4 or IPv6 address' };
    }
  }

  let storage_type = null;
  if (body.storage_type) {
    if (!STORAGE_TYPE_VALUES.includes(body.storage_type))
      return { error: `storage_type must be one of ${STORAGE_TYPE_VALUES.join(', ')}` };
    storage_type = body.storage_type;
  }

  const ram_gb = body.ram_gb === '' || body.ram_gb == null ? null : Number(body.ram_gb);
  if (ram_gb !== null && (!Number.isFinite(ram_gb) || ram_gb < 0)) {
    return { error: 'ram_gb must be a positive number' };
  }

  return {
    data: {
      asset_tag,
      name,
      brand: body.brand ? String(body.brand).trim() : null,
      machine_type: body.machine_type,
      cpu: body.cpu ? String(body.cpu).trim() : null,
      ram_gb,
      storage_type,
      storage_capacity: body.storage_capacity ? String(body.storage_capacity).trim() : null,
      os: body.os,
      os_edition,
      condition_status: body.condition_status,
      location,
      extension_number: body.extension_number ? String(body.extension_number).trim() : null,
      teamviewer_id: body.teamviewer_id ? String(body.teamviewer_id).trim() : null,
      ip_address,
      ip_config,
      status: body.status,
      performance: body.performance,
      softwares: body.softwares ? String(body.softwares).trim() : null,
      assigned_users: body.assigned_users ? String(body.assigned_users).trim() : null,
      comments: body.comments ? String(body.comments).trim() : null,
    },
  };
}
