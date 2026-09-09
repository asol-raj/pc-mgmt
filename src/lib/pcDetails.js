// The full record of one PC, as label/value pairs. Shared by the details modal on
// both the public register and the admin dashboard.
export function formatDateTime(value, emptyLabel) {
  if (!value) return emptyLabel;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? emptyLabel : date.toLocaleString();
}

const plural = (count, noun) => `${count} ${noun}${Number(count) === 1 ? '' : 's'}`;

/** A YYYY-MM-DD value as a plain local date, or '' when there is none. */
export function formatDate(value) {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

// Every column of the row, shown as label/value pairs in the details modal.
export const DETAIL_FIELDS = [
  { key: 'asset_tag', label: 'Asset Tag' },
  { key: 'name', label: 'PC Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'machine_type', label: 'Machine Type' },
  { key: 'cpu', label: 'CPU' },
  { key: 'ram_gb', label: 'RAM', value: (pc) => (pc.ram_gb ? pc.ram_gb + ' GB' : null) },
  { key: 'storage_type', label: 'Storage Type' },
  { key: 'storage_capacity', label: 'Storage Capacity' },
  { key: 'os', label: 'Operating System' },
  { key: 'os_edition', label: 'Windows Edition' },
  { key: 'condition_status', label: 'Condition' },
  { key: 'location', label: 'Location' },
  { key: 'used_by', label: 'Used By' },
  { key: 'extension_number', label: 'Extension Number' },
  { key: 'teamviewer_id', label: 'TeamViewer ID' },
  { key: 'ip_address', label: 'IP Address' },
  { key: 'ip_config', label: 'IP Configuration' },
  { key: 'status', label: 'Status', badge: 'status' },
  { key: 'performance', label: 'Performance', badge: 'performance' },
  // Both lists live in child tables and open in a grid (see ListModal). The drawer
  // line shows the count; `list` names which list the View button opens. A PC last
  // seen by an older agent has no rows but may still carry the comma-separated
  // `softwares` string, which is shown as before rather than pretending it is empty.
  {
    key: 'softwares',
    label: 'Softwares Installed',
    list: 'software',
    value: (pc) => (Number(pc.software_count) > 0 ? plural(pc.software_count, 'program') : pc.softwares),
  },
  {
    key: 'printers',
    label: 'Printers',
    list: 'printers',
    value: (pc) => (Number(pc.printer_count) > 0 ? plural(pc.printer_count, 'printer') : null),
  },
  { key: 'assigned_users', label: 'Login Accounts' },
  { key: 'audio_output', label: 'Audio / Speaker' },
  { key: 'microphone', label: 'Microphone' },
  { key: 'camera', label: 'Camera' },
  { key: 'comments', label: 'Comments' },
  { key: 'machine_id', label: 'Machine ID' },
  {
    key: 'last_reported_at',
    label: 'Last Agent Report',
    value: (pc) => formatDateTime(pc.last_reported_at, 'Never'),
  },
  { key: 'created_at', label: 'Added On', value: (pc) => formatDateTime(pc.created_at, null) },
  { key: 'updated_at', label: 'Last Updated', value: (pc) => formatDateTime(pc.updated_at, null) },
];

export function detailValue(field, pc) {
  const value = field.value ? field.value(pc) : pc[field.key];
  return value === null || value === undefined || value === '' ? '—' : value;
}
