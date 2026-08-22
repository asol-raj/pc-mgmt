import { withTableState } from './pcTable.js';

// The public register is the shared table and nothing else: read, search, sort,
// and open a record. Everything that changes a row lives on the admin side.
export default function pcApp() {
  return withTableState({
    init() {
      this.initTable();
    },
  });
}
