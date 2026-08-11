import type { PcInput } from './types';

const MACHINE_TYPE_VALUES = ['Desktop', 'Laptop', 'AIO'];
const STORAGE_TYPE_VALUES = ['SSD', 'HDD'];
const OS_VALUES = ['Windows 10', 'Windows 11'];
const CONDITION_VALUES = ['New', 'Refurbished'];
const PERFORMANCE_VALUES = ['Slow', 'Average', 'Good', 'Excellent'];
const STATUS_VALUES = ['Active', 'Retired'];

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
      condition_status: body.condition_status,
      location,
      extension_number: body.extension_number ? String(body.extension_number).trim() : null,
      teamviewer_id: body.teamviewer_id ? String(body.teamviewer_id).trim() : null,
      status: body.status,
      performance: body.performance,
      softwares: body.softwares ? String(body.softwares).trim() : null,
      assigned_users: body.assigned_users ? String(body.assigned_users).trim() : null,
      comments: body.comments ? String(body.comments).trim() : null,
    },
  };
}
