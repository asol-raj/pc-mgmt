// Column models shared by the public register and the admin dashboard.
//
// Two views over the same rows:
//   REGISTER_COLUMNS — the reading view. Related fields are clubbed into one
//     two-line cell (PC + asset tag, CPU + RAM/storage/OS, location + extension),
//     so a row introduces itself on screen without scrolling sideways.
//   DATA_COLUMNS — the spreadsheet view. One field per column, nothing merged,
//     for scanning and copying like a sheet.
import { formatDateTime } from './pcDetails.js';

const clean = (value) =>
  value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();

const joinDot = (parts) => parts.filter(Boolean).join(' · ');

export function compareVal(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

export function statusBadgeClass(status) {
  return status === 'Retired'
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}

export function performanceBadgeClass(performance) {
  if (performance === 'Slow') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (performance === 'Average') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (performance === 'Excellent') return 'bg-teal-50 text-teal-700 ring-teal-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

const storageOf = (pc) => [clean(pc.storage_capacity), clean(pc.storage_type)].filter(Boolean).join(' ');
const osOf = (pc) => [pc.os, clean(pc.os_edition)].filter(Boolean).join(' ');

/**
 * The reading view.
 *
 * `primary` is the strong first line, `secondary` the muted second line, `tag` a
 * small pill beside the primary. `search` is the text a column filter and the
 * global search box match against — for a clubbed column that is every field it
 * shows, so filtering "SSD" under Specs works even though SSD sits on line two.
 */
export const REGISTER_COLUMNS = [
  {
    key: 'name',
    label: 'PC',
    type: 'text',
    width: 'w-[15%] min-w-[150px]',
    opensRecord: true,
    primary: (pc) => pc.name,
    secondary: (pc) => pc.asset_tag,
    monoSecondary: true,
    sortValue: (pc) => pc.name,
    search: (pc) => joinDot([pc.name, pc.asset_tag]),
  },
  {
    key: 'used_by',
    label: 'Used By',
    type: 'text',
    width: 'w-[13%] min-w-[130px]',
    // The first line is one plain field, so the admin can edit it in place here.
    // Clubbed columns like Specs deliberately have no editKey: a click could not
    // tell which of CPU / RAM / storage / OS you meant.
    editKey: 'used_by',
    primary: (pc) => clean(pc.used_by) ?? '—',
    secondary: (pc) => clean(pc.assigned_users),
    sortValue: (pc) => pc.used_by,
    search: (pc) => joinDot([pc.used_by, pc.assigned_users]),
  },
  {
    key: 'location',
    label: 'Location',
    type: 'text',
    width: 'w-[13%] min-w-[130px]',
    editKey: 'location',
    primary: (pc) => pc.location,
    secondary: (pc) => (clean(pc.extension_number) ? `Ext ${clean(pc.extension_number)}` : null),
    sortValue: (pc) => pc.location,
    search: (pc) => joinDot([pc.location, pc.extension_number]),
  },
  {
    key: 'specs',
    label: 'Specs',
    type: 'text',
    width: 'w-[21%] min-w-[210px]',
    primary: (pc) => clean(pc.cpu) ?? '—',
    secondary: (pc) =>
      joinDot([pc.ram_gb ? `${pc.ram_gb} GB` : null, storageOf(pc) || null, osOf(pc) || null]) || null,
    sortValue: (pc) => pc.cpu,
    search: (pc) => joinDot([pc.cpu, pc.ram_gb ? `${pc.ram_gb} GB` : null, storageOf(pc), osOf(pc)]),
  },
  {
    key: 'network',
    label: 'Network',
    type: 'text',
    width: 'w-[14%] min-w-[145px]',
    primary: (pc) => clean(pc.ip_address) ?? '—',
    monoPrimary: true,
    tag: (pc) => (pc.ip_config === 'Static' ? 'Static' : null),
    secondary: (pc) => (clean(pc.teamviewer_id) ? `TV ${clean(pc.teamviewer_id)}` : null),
    monoSecondary: true,
    sortValue: (pc) => pc.ip_address,
    search: (pc) => joinDot([pc.ip_address, pc.ip_config, pc.teamviewer_id]),
  },
  {
    key: 'machine_type',
    label: 'Type',
    type: 'select',
    options: ['Desktop', 'Laptop', 'AIO'],
    width: 'w-[11%] min-w-[110px]',
    primary: (pc) => pc.machine_type,
    secondary: (pc) =>
      joinDot([clean(pc.brand), pc.condition_status === 'Refurbished' ? 'Refurb' : null]) || null,
    sortValue: (pc) => pc.machine_type,
    search: (pc) => joinDot([pc.machine_type, pc.brand, pc.condition_status]),
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Retired'],
    width: 'w-[7%] min-w-[86px]',
    badge: 'status',
    primary: (pc) => pc.status,
    sortValue: (pc) => pc.status,
    search: (pc) => pc.status,
  },
  {
    key: 'performance',
    label: 'Perf.',
    type: 'select',
    options: ['Slow', 'Average', 'Good', 'Excellent'],
    width: 'w-[8%] min-w-[96px]',
    badge: 'performance',
    primary: (pc) => pc.performance,
    sortValue: (pc) => pc.performance,
    search: (pc) => pc.performance,
  },
];

/** The spreadsheet view: one field per column, in the order a sheet would hold them. */
export const DATA_COLUMNS = [
  // PC Name leads: it is the frozen first column, so it stays on screen while the
  // rest of the sheet scrolls sideways.
  { key: 'name', label: 'PC Name', strong: true },
  { key: 'asset_tag', label: 'Asset Tag', mono: true },
  { key: 'used_by', label: 'Used By' },
  { key: 'location', label: 'Location' },
  { key: 'extension_number', label: 'Ext.' },
  { key: 'machine_type', label: 'Type', type: 'select', options: ['Desktop', 'Laptop', 'AIO'] },
  { key: 'brand', label: 'Brand' },
  { key: 'cpu', label: 'CPU' },
  { key: 'ram_gb', label: 'RAM (GB)', align: 'right' },
  { key: 'storage_capacity', label: 'Storage', align: 'right' },
  { key: 'storage_type', label: 'Disk', type: 'select', options: ['SSD', 'HDD'] },
  { key: 'os', label: 'OS', type: 'select', options: ['Windows 10', 'Windows 11'] },
  { key: 'os_edition', label: 'Edition', type: 'select', options: ['Home', 'Pro', 'Enterprise', 'Education'] },
  { key: 'condition_status', label: 'Condition', type: 'select', options: ['New', 'Refurbished'] },
  { key: 'ip_address', label: 'IP Address', mono: true },
  { key: 'ip_config', label: 'IP Config', type: 'select', options: ['Static', 'Dynamic'] },
  { key: 'teamviewer_id', label: 'TeamViewer ID', mono: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Retired'] },
  { key: 'performance', label: 'Performance', type: 'select', options: ['Slow', 'Average', 'Good', 'Excellent'] },
  { key: 'assigned_users', label: 'Login Accounts' },
  { key: 'softwares', label: 'Softwares', wide: true },
  { key: 'comments', label: 'Comments', wide: true },
  {
    key: 'last_reported_at',
    label: 'Last Agent Report',
    value: (pc) => formatDateTime(pc.last_reported_at, 'Never'),
    // Sort on the raw timestamp, not the formatted text, which would order by month name.
    sortValue: (pc) => pc.last_reported_at,
  },
];
