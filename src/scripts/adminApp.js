import { parseSystemInfo } from '../lib/systeminfo.js';

function formatReportedAt(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
}

function compareVal(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

const COLUMNS = [
  { key: 'asset_tag', label: 'Asset Tag' },
  { key: 'name', label: 'PC Name' },
  { key: 'brand', label: 'Brand', render: (pc) => pc.brand || '—' },
  { key: 'machine_type', label: 'Type' },
  { key: 'cpu', label: 'CPU', render: (pc) => pc.cpu || '—' },
  { key: 'ram_gb', label: 'RAM', render: (pc) => (pc.ram_gb ? `${pc.ram_gb} GB` : '—') },
  {
    key: 'storage',
    label: 'Storage',
    render: (pc) => [pc.storage_capacity, pc.storage_type].filter(Boolean).join(' ') || '—',
    sortValue: (pc) => pc.storage_capacity || '',
  },
  { key: 'os', label: 'OS' },
  { key: 'os_edition', label: 'Edition', render: (pc) => pc.os_edition || '—' },
  { key: 'condition_status', label: 'Condition' },
  { key: 'location', label: 'Location' },
  { key: 'extension_number', label: 'Ext.', render: (pc) => pc.extension_number || '—' },
  { key: 'teamviewer_id', label: 'TeamViewer ID', render: (pc) => pc.teamviewer_id || '—' },
  { key: 'ip_address', label: 'IP Address', render: (pc) => pc.ip_address || '—' },
  { key: 'ip_config', label: 'IP Config', render: (pc) => pc.ip_config || '—' },
  { key: 'status', label: 'Status', badge: 'status' },
  { key: 'performance', label: 'Performance', badge: 'performance' },
  { key: 'softwares', label: 'Softwares', render: (pc) => pc.softwares || '—', wrap: true },
  { key: 'assigned_users', label: 'Users', render: (pc) => pc.assigned_users || '—', wrap: true },
  { key: 'comments', label: 'Comments', render: (pc) => pc.comments || '—', wrap: true },
  { key: 'last_reported_at', label: 'Last Agent Report', render: (pc) => formatReportedAt(pc.last_reported_at) },
];

// Rows come from MySQL, so every nullable column arrives as null. Everything that
// builds a payload goes through here, otherwise .trim() on a null throws and the
// save dies before it reaches the network.
const text = (value) => String(value ?? '').trim();

/** The API takes the whole record on PUT, so an inline edit sends the row plus its one change. */
function payloadFrom(source, overrides = {}) {
  const pc = { ...source, ...overrides };
  return {
    asset_tag: text(pc.asset_tag),
    name: text(pc.name),
    brand: text(pc.brand) || null,
    machine_type: pc.machine_type,
    cpu: text(pc.cpu) || null,
    ram_gb: pc.ram_gb === '' || pc.ram_gb == null ? null : Number(pc.ram_gb),
    storage_type: pc.storage_type || null,
    storage_capacity: text(pc.storage_capacity) || null,
    os: pc.os,
    os_edition: pc.os_edition || null,
    condition_status: pc.condition_status,
    location: text(pc.location),
    extension_number: text(pc.extension_number) || null,
    teamviewer_id: text(pc.teamviewer_id) || null,
    ip_address: text(pc.ip_address) || null,
    ip_config: pc.ip_config || null,
    status: pc.status,
    performance: pc.performance,
    softwares: text(pc.softwares) || null,
    assigned_users: text(pc.assigned_users) || null,
    comments: text(pc.comments) || null,
  };
}

// Columns an admin can edit straight from the table. name, cpu, ram, storage, OS,
// IP and softwares are left out on purpose: the agent app overwrites those on its
// next report, so editing them here would not stick.
const EDITABLE_FIELDS = {
  asset_tag: { type: 'text', required: true },
  condition_status: { type: 'select', options: ['New', 'Refurbished'] },
  location: { type: 'text', required: true },
  extension_number: { type: 'text' },
  status: { type: 'select', options: ['Active', 'Retired'] },
  performance: { type: 'select', options: ['Slow', 'Average', 'Good', 'Excellent'] },
  comments: { type: 'text' },
};

const emptyForm = () => ({
  id: null,
  asset_tag: '',
  name: '',
  brand: '',
  machine_type: 'Desktop',
  cpu: '',
  ram_gb: '',
  storage_type: '',
  storage_capacity: '',
  os: 'Windows 11',
  os_edition: '',
  condition_status: 'New',
  location: '',
  extension_number: '',
  teamviewer_id: '',
  ip_address: '',
  ip_config: '',
  status: 'Active',
  performance: 'Good',
  softwares: '',
  assigned_users: '',
  comments: '',
});

export default function adminApp() {
  return {
    pcs: [],
    columns: COLUMNS,
    search: '',
    sortKey: null,
    sortDir: 'asc',
    modalOpen: false,
    saving: false,
    formError: '',
    form: emptyForm(),
    importing: false,
    importResult: null,
    systemInfoText: '',
    systemInfoApplied: null,
    editing: null,
    editValue: '',
    editInvalid: false,
    toast: null,

    init() {
      const raw = document.getElementById('pcs-data')?.textContent ?? '[]';
      this.pcs = JSON.parse(raw);
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

    get filtered() {
      const q = this.search.trim().toLowerCase();
      let rows = this.pcs;
      if (q) {
        rows = rows.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.asset_tag.toLowerCase().includes(q) ||
            p.location.toLowerCase().includes(q) ||
            (p.brand ?? '').toLowerCase().includes(q) ||
            (p.ip_address ?? '').toLowerCase().includes(q)
        );
      }
      if (!this.sortKey) return rows;

      const col = this.columns.find((c) => c.key === this.sortKey);
      const dir = this.sortDir === 'desc' ? -1 : 1;
      return [...rows].sort((a, b) => {
        const va = col.sortValue ? col.sortValue(a) : a[col.key];
        const vb = col.sortValue ? col.sortValue(b) : b[col.key];
        return dir * compareVal(va, vb);
      });
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

    openCreate() {
      this.form = emptyForm();
      this.formError = '';
      this.systemInfoText = '';
      this.systemInfoApplied = null;
      this.modalOpen = true;
    },

    openEdit(pc) {
      const blank = emptyForm();
      // Keep the blank string defaults wherever the row holds null.
      const filled = Object.fromEntries(
        Object.entries(pc).map(([key, value]) => [key, value === null || value === undefined ? blank[key] ?? '' : value])
      );
      this.form = { ...blank, ...filled };
      this.formError = '';
      this.systemInfoText = '';
      this.systemInfoApplied = null;
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
    },

    applySystemInfo() {
      if (!this.systemInfoText.trim()) return;

      const parsed = parseSystemInfo(this.systemInfoText);
      const filled = [];

      if (parsed.name) {
        this.form.name = parsed.name;
        filled.push('Name');
      }
      if (parsed.brand) {
        this.form.brand = parsed.brand;
        filled.push('Brand');
      }
      if (parsed.cpu) {
        this.form.cpu = parsed.cpu;
        filled.push('CPU');
      }
      if (parsed.ram_gb) {
        this.form.ram_gb = parsed.ram_gb;
        filled.push('RAM');
      }
      if (parsed.os) {
        this.form.os = parsed.os;
        filled.push('OS');
      }
      if (parsed.os_edition) {
        this.form.os_edition = parsed.os_edition;
        filled.push('Edition');
      }
      if (parsed.ip_address) {
        this.form.ip_address = parsed.ip_address;
        filled.push('IP Address');
      }
      if (parsed.ip_config) {
        this.form.ip_config = parsed.ip_config;
        filled.push('IP Config');
      }

      this.systemInfoApplied = filled.length
        ? `Filled: ${filled.join(', ')}.`
        : 'No recognizable fields found in the pasted text.';
    },

    buildPayload() {
      return payloadFrom(this.form);
    },

    async save() {
      this.saving = true;
      this.formError = '';

      const payload = this.buildPayload();
      const isEdit = Boolean(this.form.id);
      const url = isEdit ? `/api/pcs/${this.form.id}` : '/api/pcs';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          this.formError = data.error || 'Something went wrong. Please try again.';
          return;
        }

        if (isEdit) {
          const idx = this.pcs.findIndex((p) => p.id === this.form.id);
          if (idx !== -1) this.pcs[idx] = { ...this.pcs[idx], ...payload };
        } else {
          this.pcs.push({ ...payload, id: data.id });
        }

        this.modalOpen = false;
      } catch {
        this.formError = 'Network error. Please try again.';
      } finally {
        this.saving = false;
      }
    },

    async remove(pc) {
      if (!confirm(`Delete "${pc.name}" (${pc.asset_tag})? This cannot be undone.`)) return;

      const res = await fetch(`/api/pcs/${pc.id}`, { method: 'DELETE' });
      if (res.ok) {
        this.pcs = this.pcs.filter((p) => p.id !== pc.id);
      } else {
        alert('Failed to delete this PC.');
      }
    },

    editableField(col) {
      return EDITABLE_FIELDS[col.key] ?? null;
    },

    isEditing(pc, col) {
      return Boolean(this.editing) && this.editing.id === pc.id && this.editing.key === col.key;
    },

    startEdit(pc, col) {
      if (!this.editableField(col) || this.isEditing(pc, col)) return;
      this.editing = { id: pc.id, key: col.key };
      this.editValue = pc[col.key] ?? '';
      this.editInvalid = false;
    },

    cancelEdit() {
      this.editing = null;
      this.editInvalid = false;
    },

    /**
     * Enter (or leaving the cell) writes the value. A required field left blank is
     * refused: on Enter the input turns red and stays open, on blur the cell simply
     * reverts, so the stored value is never replaced with nothing.
     */
    async commitEdit(pc, col, viaBlur = false) {
      if (!this.isEditing(pc, col)) return; // blur after Enter would otherwise fire twice
      const field = this.editableField(col);
      const value = text(this.editValue);

      if (field.required && !value) {
        if (viaBlur) this.cancelEdit();
        else this.editInvalid = true;
        return;
      }

      const previous = pc[col.key] ?? '';
      if (value === String(previous)) {
        this.cancelEdit();
        return;
      }

      const next = field.required || field.type === 'select' ? value : value || null;
      this.cancelEdit();

      const res = await fetch(`/api/pcs/${pc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFrom(pc, { [col.key]: next })),
      }).catch(() => null);

      if (!res || !res.ok) {
        const data = res ? await res.json().catch(() => ({})) : {};
        // The row keeps the value it already had.
        this.showToast(data.error || 'Could not save that change.');
        return;
      }

      pc[col.key] = next;
    },

    showToast(message) {
      this.toast = message;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toast = null;
      }, 5000);
    },

    async toggleStatus(pc) {
      const nextStatus = pc.status === 'Active' ? 'Retired' : 'Active';
      const payload = payloadFrom(pc, { status: nextStatus });

      const res = await fetch(`/api/pcs/${pc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        pc.status = nextStatus;
      } else {
        alert('Failed to update status.');
      }
    },

    async importCsv(event) {
      const input = event.target;
      const file = input.files?.[0];
      if (!file) return;

      this.importing = true;
      this.importResult = null;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/pcs/import', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          this.importResult = { error: data.error || 'Import failed.' };
          return;
        }

        this.importResult = data;

        const listRes = await fetch('/api/pcs');
        if (listRes.ok) {
          this.pcs = await listRes.json();
        }
      } catch {
        this.importResult = { error: 'Network error during import.' };
      } finally {
        this.importing = false;
        input.value = '';
      }
    },

    async logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/admin/login';
    },
  };
}
