function compareVal(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

const WRAP_COLUMN_KEYS = ['softwares', 'comments', 'assigned_users'];

const COLUMNS = [
  { key: 'asset_tag', label: 'Asset Tag', type: 'text' },
  { key: 'name', label: 'PC Name', type: 'text' },
  { key: 'brand', label: 'Brand', type: 'text' },
  { key: 'machine_type', label: 'Type', type: 'select', options: ['Desktop', 'Laptop', 'AIO'] },
  { key: 'cpu', label: 'CPU', type: 'text' },
  {
    key: 'ram_gb',
    label: 'RAM',
    type: 'text',
    render: (pc) => (pc.ram_gb ? `${pc.ram_gb} GB` : '—'),
  },
  {
    key: 'storage',
    label: 'Storage',
    type: 'select',
    filterKey: 'storage_type',
    options: ['SSD', 'HDD'],
    render: (pc) => [pc.storage_capacity, pc.storage_type].filter(Boolean).join(' ') || '—',
    sortValue: (pc) => pc.storage_capacity || '',
  },
  { key: 'os', label: 'OS', type: 'select', options: ['Windows 10', 'Windows 11'] },
  {
    key: 'os_edition',
    label: 'Edition',
    type: 'select',
    options: ['Home', 'Pro', 'Enterprise', 'Education'],
    render: (pc) => pc.os_edition || '—',
  },
  { key: 'condition_status', label: 'Condition', type: 'select', options: ['New', 'Refurbished'] },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'extension_number', label: 'Ext.', type: 'text', render: (pc) => pc.extension_number || '—' },
  { key: 'teamviewer_id', label: 'TeamViewer ID', type: 'text', render: (pc) => pc.teamviewer_id || '—' },
  { key: 'ip_address', label: 'IP Address', type: 'text', render: (pc) => pc.ip_address || '—' },
  {
    key: 'ip_config',
    label: 'IP Config',
    type: 'select',
    options: ['Static', 'Dynamic'],
    render: (pc) => pc.ip_config || '—',
  },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Retired'], badge: 'status' },
  {
    key: 'performance',
    label: 'Performance',
    type: 'select',
    options: ['Slow', 'Average', 'Good', 'Excellent'],
    badge: 'performance',
  },
  { key: 'softwares', label: 'Softwares', type: 'text', render: (pc) => pc.softwares || '—' },
  { key: 'assigned_users', label: 'Users', type: 'text', render: (pc) => pc.assigned_users || '—' },
  { key: 'comments', label: 'Comments', type: 'text', render: (pc) => pc.comments || '—' },
];

export default function pcApp() {
  return {
    pcs: [],
    columns: COLUMNS,
    search: '',
    colFilters: {},
    sortKey: null,
    sortDir: 'asc',
    selectedId: null,

    init() {
      const raw = document.getElementById('pcs-data')?.textContent ?? '[]';
      this.pcs = JSON.parse(raw);
      if (this.pcs.length) this.selectedId = this.pcs[0].id;
      for (const col of this.columns) {
        this.colFilters[col.filterKey || col.key] = col.type === 'select' ? 'All' : '';
      }
    },

    isWrapCol(key) {
      return WRAP_COLUMN_KEYS.includes(key);
    },

    cellText(col, pc) {
      if (col.render) return col.render(pc);
      const value = pc[col.key];
      return value === null || value === undefined || value === '' ? '—' : value;
    },

    toggleSort(col) {
      if (this.sortKey !== col.key) {
        this.sortKey = col.key;
        this.sortDir = 'asc';
      } else if (this.sortDir === 'asc') {
        this.sortDir = 'desc';
      } else {
        this.sortKey = null;
      }
    },

    matchesSearch(pc) {
      const q = this.search.trim().toLowerCase();
      if (!q) return true;
      return [pc.name, pc.asset_tag, pc.brand, pc.cpu, pc.location, pc.extension_number, pc.teamviewer_id, pc.ip_address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    },

    matchesColumnFilters(pc) {
      for (const col of this.columns) {
        const fieldKey = col.filterKey || col.key;
        const filterVal = this.colFilters[fieldKey];
        if (!filterVal || filterVal === 'All') continue;

        if (col.type === 'select') {
          if (pc[fieldKey] !== filterVal) return false;
        } else {
          const text = String(this.cellText(col, pc)).toLowerCase();
          if (!text.includes(filterVal.toLowerCase())) return false;
        }
      }
      return true;
    },

    get filtered() {
      const rows = this.pcs.filter((pc) => this.matchesSearch(pc) && this.matchesColumnFilters(pc));
      if (!this.sortKey) return rows;

      const col = this.columns.find((c) => c.key === this.sortKey);
      const dir = this.sortDir === 'desc' ? -1 : 1;
      return [...rows].sort((a, b) => {
        const va = col.sortValue ? col.sortValue(a) : a[col.key];
        const vb = col.sortValue ? col.sortValue(b) : b[col.key];
        return dir * compareVal(va, vb);
      });
    },

    get totalCount() {
      return this.pcs.length;
    },

    get activeCount() {
      return this.pcs.filter((p) => p.status === 'Active').length;
    },

    get retiredCount() {
      return this.pcs.filter((p) => p.status === 'Retired').length;
    },

    get selected() {
      return this.pcs.find((p) => p.id === this.selectedId) ?? null;
    },

    select(id) {
      this.selectedId = id;
    },

    statusBadgeClass(status) {
      return status === 'Retired' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700';
    },

    performanceBadgeClass(performance) {
      if (performance === 'Slow') return 'bg-rose-100 text-rose-700';
      if (performance === 'Average') return 'bg-amber-100 text-amber-700';
      if (performance === 'Excellent') return 'bg-teal-100 text-teal-700';
      return 'bg-emerald-100 text-emerald-700';
    },

    resetFilters() {
      this.search = '';
      this.sortKey = null;
      this.sortDir = 'asc';
      for (const col of this.columns) {
        this.colFilters[col.filterKey || col.key] = col.type === 'select' ? 'All' : '';
      }
    },
  };
}
