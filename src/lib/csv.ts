const EXPORT_COLUMNS = [
  'asset_tag',
  'name',
  'brand',
  'machine_type',
  'cpu',
  'ram_gb',
  'storage_type',
  'storage_capacity',
  'os',
  'condition_status',
  'location',
  'extension_number',
  'teamviewer_id',
  'status',
  'performance',
  'softwares',
  'assigned_users',
  'comments',
] as const;

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function pcsToCsv(pcs: Record<string, any>[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const lines = pcs.map((pc) => EXPORT_COLUMNS.map((col) => escapeCsvField(pc[col])).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}

// Minimal RFC4180-style CSV parser: handles quoted fields containing commas,
// quotes (doubled), and embedded newlines.
export function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (char === '\r') {
      i++;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmptyRows.length === 0) return [];

  const header = nonEmptyRows[0].map((h) => h.trim());
  return nonEmptyRows.slice(1).map((cols) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = (cols[idx] ?? '').trim();
    });
    return record;
  });
}
