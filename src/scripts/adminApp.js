import { parseSystemInfo } from '../lib/systeminfo.js';
import { withTableState } from './pcTable.js';

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
    used_by: text(pc.used_by) || null,
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

// Columns an admin can edit straight from the Data tab. name, brand, cpu, ram,
// storage, OS, IP, TeamViewer ID, softwares and assigned_users are left out on
// purpose: the agent app overwrites those on its next report, so editing them
// here would not stick. used_by is the admin's own answer to "whose desk is this",
// which is why it exists alongside the agent-reported login accounts.
const EDITABLE_FIELDS = {
  asset_tag: { type: 'text', required: true },
  used_by: { type: 'text' },
  location: { type: 'text', required: true },
  extension_number: { type: 'text' },
  condition_status: { type: 'select', options: ['New', 'Refurbished'] },
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
  used_by: '',
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
  return withTableState({
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
      this.initTable();
    },

    // ---- add / edit modal ------------------------------------------------

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
      const labels = {
        name: 'Name',
        brand: 'Brand',
        cpu: 'CPU',
        ram_gb: 'RAM',
        os: 'OS',
        os_edition: 'Edition',
        ip_address: 'IP Address',
        ip_config: 'IP Config',
      };

      const filled = [];
      for (const [key, label] of Object.entries(labels)) {
        if (!parsed[key]) continue;
        this.form[key] = parsed[key];
        filled.push(label);
      }

      this.systemInfoApplied = filled.length
        ? `Filled: ${filled.join(', ')}.`
        : 'No recognizable fields found in the pasted text.';
    },

    async save() {
      this.saving = true;
      this.formError = '';

      const payload = payloadFrom(this.form);
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
          this.selectedId = data.id;
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
        if (this.selectedId === pc.id) this.selectedId = this.pcs[0]?.id ?? null;
        if (this.drawerPc?.id === pc.id) this.closeRecord();
      } else {
        this.showToast('Failed to delete this PC.');
      }
    },

    async toggleStatus(pc) {
      const nextStatus = pc.status === 'Active' ? 'Retired' : 'Active';

      const res = await fetch(`/api/pcs/${pc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFrom(pc, { status: nextStatus })),
      }).catch(() => null);

      if (res?.ok) {
        pc.status = nextStatus;
      } else {
        this.showToast('Failed to update status.');
      }
    },

    // ---- click-to-edit in the Data tab ----------------------------------

    editableField(key) {
      return EDITABLE_FIELDS[key] ?? null;
    },

    isEditing(pc, key) {
      return Boolean(this.editing) && this.editing.id === pc.id && this.editing.key === key;
    },

    startEdit(pc, key) {
      if (!this.editableField(key) || this.isEditing(pc, key)) return;
      this.editing = { id: pc.id, key };
      this.editValue = pc[key] ?? '';
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
    async commitEdit(pc, key, viaBlur = false) {
      if (!this.isEditing(pc, key)) return; // blur after Enter would otherwise fire twice
      const field = this.editableField(key);
      const value = text(this.editValue);

      if (field.required && !value) {
        if (viaBlur) this.cancelEdit();
        else this.editInvalid = true;
        return;
      }

      const previous = pc[key] ?? '';
      if (value === String(previous)) {
        this.cancelEdit();
        return;
      }

      const next = field.required || field.type === 'select' ? value : value || null;
      this.cancelEdit();

      const res = await fetch(`/api/pcs/${pc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFrom(pc, { [key]: next })),
      }).catch(() => null);

      if (!res || !res.ok) {
        const data = res ? await res.json().catch(() => ({})) : {};
        // The row keeps the value it already had.
        this.showToast(data.error || 'Could not save that change.');
        return;
      }

      pc[key] = next;
    },

    showToast(message) {
      this.toast = message;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toast = null;
      }, 5000);
    },

    // ---- CSV import ------------------------------------------------------

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
        if (listRes.ok) this.pcs = await listRes.json();
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
  });
}
