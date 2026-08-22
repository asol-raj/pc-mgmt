// Everything the register and data views need, shared by the public page and the
// admin dashboard. Both Alpine components spread this in, so a change to sorting,
// filtering or the drawer lands on both at once.
import { REGISTER_COLUMNS, DATA_COLUMNS, compareVal, statusBadgeClass, performanceBadgeClass } from '../lib/columns.js';
import { DETAIL_FIELDS, detailValue } from '../lib/pcDetails.js';

// Fields the search box looks at. Kept wide on purpose — one box should find a PC
// however the person remembers it: by desk, by owner, by extension, by IP.
const SEARCH_FIELDS = [
  'name',
  'asset_tag',
  'brand',
  'cpu',
  'location',
  'used_by',
  'assigned_users',
  'extension_number',
  'teamviewer_id',
  'ip_address',
  'machine_id',
];

const asText = (value) =>
  value === null || value === undefined || String(value).trim() === '' ? '' : String(value);

/**
 * Builds a component around the shared table state.
 *
 * Note the descriptor copy rather than `{ ...tableState(), ...extra }`: object
 * spread reads getters instead of carrying them over, which would freeze
 * `filtered`, `totalCount` and friends at their empty values forever.
 */
export function withTableState(extra = {}) {
  const component = {};
  Object.defineProperties(component, Object.getOwnPropertyDescriptors(tableState()));
  Object.defineProperties(component, Object.getOwnPropertyDescriptors(extra));
  return component;
}

function tableState() {
  return {
    pcs: [],
    view: 'register', // 'register' | 'data'
    columns: REGISTER_COLUMNS,
    dataColumns: DATA_COLUMNS,
    detailFields: DETAIL_FIELDS,

    search: '',
    showFilters: false,
    colFilters: {}, // register view, keyed by column key
    dataFilters: {}, // data view, keyed by field key
    sortKey: null,
    sortDir: 'asc',

    selectedId: null,
    drawerPc: null,

    /** Reads the rows the page embedded and seeds an empty filter for every column. */
    initTable() {
      const raw = document.getElementById('pcs-data')?.textContent ?? '[]';
      this.pcs = JSON.parse(raw);
      this.clearFilters();
    },

    clearFilters() {
      const register = {};
      for (const col of this.columns) register[col.key] = col.type === 'select' ? 'All' : '';
      this.colFilters = register;

      const data = {};
      for (const col of this.dataColumns) data[col.key] = col.type === 'select' ? 'All' : '';
      this.dataFilters = data;
    },

    resetFilters() {
      this.search = '';
      this.sortKey = null;
      this.sortDir = 'asc';
      this.clearFilters();
    },

    get activeFilterCount() {
      const map = this.view === 'data' ? this.dataFilters : this.colFilters;
      return Object.values(map).filter((v) => v && v !== 'All').length;
    },

    // ---- cell rendering -------------------------------------------------

    cellPrimary(col, pc) {
      return asText(col.primary ? col.primary(pc) : pc[col.key]) || '—';
    },

    cellSecondary(col, pc) {
      return col.secondary ? asText(col.secondary(pc)) : '';
    },

    cellTag(col, pc) {
      return col.tag ? asText(col.tag(pc)) : '';
    },

    /** Plain text for one field in the spreadsheet view. Blanks stay blank, like a sheet. */
    dataText(col, pc) {
      return asText(col.value ? col.value(pc) : pc[col.key]);
    },

    // ---- sorting --------------------------------------------------------

    toggleSort(key) {
      if (this.sortKey !== key) {
        this.sortKey = key;
        this.sortDir = 'asc';
      } else if (this.sortDir === 'asc') {
        this.sortDir = 'desc';
      } else {
        this.sortKey = null;
      }
    },

    sortValueFor(pc, key) {
      const col =
        this.columns.find((c) => c.key === key) ?? this.dataColumns.find((c) => c.key === key) ?? null;
      if (col?.sortValue) return col.sortValue(pc);
      if (col?.value) return col.value(pc);
      return pc[key];
    },

    // ---- filtering ------------------------------------------------------

    matchesSearch(pc) {
      const q = this.search.trim().toLowerCase();
      if (!q) return true;
      return SEARCH_FIELDS.some((key) => asText(pc[key]).toLowerCase().includes(q));
    },

    matchesFilters(pc) {
      if (this.view === 'data') {
        for (const col of this.dataColumns) {
          const value = this.dataFilters[col.key];
          if (!value || value === 'All') continue;
          if (col.type === 'select') {
            if (asText(pc[col.key]) !== value) return false;
          } else if (!this.dataText(col, pc).toLowerCase().includes(value.toLowerCase())) {
            return false;
          }
        }
        return true;
      }

      for (const col of this.columns) {
        const value = this.colFilters[col.key];
        if (!value || value === 'All') continue;
        if (col.type === 'select') {
          if (asText(pc[col.key]) !== value) return false;
        } else {
          // Clubbed columns match on everything they display, not just line one.
          const haystack = (col.search ? col.search(pc) : this.cellPrimary(col, pc)).toLowerCase();
          if (!haystack.includes(value.toLowerCase())) return false;
        }
      }
      return true;
    },

    get filtered() {
      const rows = this.pcs.filter((pc) => this.matchesSearch(pc) && this.matchesFilters(pc));
      if (!this.sortKey) return rows;

      const dir = this.sortDir === 'desc' ? -1 : 1;
      return [...rows].sort(
        (a, b) => dir * compareVal(this.sortValueFor(a, this.sortKey), this.sortValueFor(b, this.sortKey))
      );
    },

    // ---- counts ---------------------------------------------------------

    get totalCount() {
      return this.pcs.length;
    },

    get activeCount() {
      return this.pcs.filter((p) => p.status === 'Active').length;
    },

    get retiredCount() {
      return this.pcs.filter((p) => p.status === 'Retired').length;
    },

    // ---- selection & the record drawer ----------------------------------

    get selected() {
      return this.pcs.find((p) => p.id === this.selectedId) ?? null;
    },

    select(id) {
      this.selectedId = id;
    },

    /** The full record slides in from the right; the table keeps the whole window. */
    openRecord(pc) {
      this.selectedId = pc.id;
      this.drawerPc = pc;
    },

    closeRecord() {
      this.drawerPc = null;
    },

    detailValue(field, pc) {
      return detailValue(field, pc);
    },

    /**
     * Click-to-edit, as seen by the shared table markup. The public register edits
     * nothing, so these are the "no" answers; the admin component replaces all three
     * with the real thing. Keeping the stubs here means one set of cell markup runs
     * on both pages instead of two that drift apart.
     */
    editableField() {
      return null;
    },

    isEditing() {
      return false;
    },

    startEdit() {},

    // ---- taking the sheet elsewhere -------------------------------------

    copied: false,

    /**
     * Copies what the Data tab is currently showing as tab-separated text, which
     * is what Excel and Google Sheets paste as a proper grid. Respects the active
     * search, filters and sort, so "copy what I'm looking at" does that.
     */
    async copyTsv() {
      const header = this.dataColumns.map((col) => col.label);
      const lines = this.filtered.map((pc) =>
        this.dataColumns.map((col) => this.dataText(col, pc).replace(/[\t\r\n]+/g, ' ')).join('\t')
      );
      const tsv = [header.join('\t'), ...lines].join('\r\n');

      try {
        await navigator.clipboard.writeText(tsv);
        this.copied = true;
        clearTimeout(this._copiedTimer);
        this._copiedTimer = setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch {
        window.prompt('Copy the rows below:', tsv);
      }
    },

    statusBadgeClass,
    performanceBadgeClass,
  };
}
