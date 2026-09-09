import { withTableState } from './pcTable.js';
import { attentionReasons, shortCpu } from '../lib/fleetStats.js';

// The overview page: the same rows and the same record drawer as the register,
// shown as cards you can narrow with one search box and a row of quick filters.
// Nothing here changes a row; that stays on the admin side.
export default function dashboardApp() {
  return withTableState({
    segment: 'all',

    init() {
      this.initTable();
    },

    /** The quick-filter chips over the fleet grid, with a live count on each. */
    get segments() {
      const count = (test) => this.pcs.filter(test).length;
      return [
        { key: 'all', label: 'All PCs', count: this.pcs.length },
        { key: 'active', label: 'Active', count: count((pc) => pc.status === 'Active') },
        { key: 'retired', label: 'Retired', count: count((pc) => pc.status === 'Retired') },
        { key: 'Desktop', label: 'Desktops', count: count((pc) => pc.machine_type === 'Desktop') },
        { key: 'AIO', label: 'All-in-ones', count: count((pc) => pc.machine_type === 'AIO') },
        { key: 'Laptop', label: 'Laptops', count: count((pc) => pc.machine_type === 'Laptop') },
        { key: 'attention', label: 'Needs attention', count: count((pc) => attentionReasons(pc).length > 0) },
      ];
    },

    inSegment(pc) {
      switch (this.segment) {
        case 'all':
          return true;
        case 'active':
          return pc.status === 'Active';
        case 'retired':
          return pc.status === 'Retired';
        case 'attention':
          return attentionReasons(pc).length > 0;
        default:
          return pc.machine_type === this.segment;
      }
    },

    /** The cards on screen: the chosen segment, narrowed by the search box, by name. */
    get cards() {
      return this.pcs
        .filter((pc) => this.inSegment(pc) && this.matchesSearch(pc))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    reasonsFor(pc) {
      return attentionReasons(pc);
    },

    shortCpu,

    /** RAM, disk and Windows as three short chips under the CPU line. */
    specChips(pc) {
      const chips = [];
      if (pc.ram_gb) chips.push(`${pc.ram_gb} GB RAM`);
      const disk = [pc.storage_capacity, pc.storage_type].filter(Boolean).join(' ');
      if (disk) chips.push(disk);
      if (pc.os) chips.push([pc.os, pc.os_edition].filter(Boolean).join(' '));
      return chips;
    },

    /** Opens the record for a PC the server rendered by id (the attention list). */
    openById(id) {
      const pc = this.pcs.find((row) => row.id === id);
      if (pc) this.openRecord(pc);
    },
  });
}
