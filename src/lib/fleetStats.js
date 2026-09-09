// Everything the dashboard page adds up about the fleet, worked out from the same
// rows the register shows. Kept in plain JS like columns.js and pcDetails.js: the
// page computes the charts on the server, and the browser reuses shortCpu() and
// attentionReasons() on every card, so both sides must import the same file.

const clean = (value) =>
  value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();

// One palette for every chart, so the same category is the same colour wherever it
// appears: types, operating systems, disks and locations all draw from this list.
export const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#14b8a6'];

const TYPE_COLORS = { Desktop: '#4f46e5', AIO: '#8b5cf6', Laptop: '#0ea5e9' };
const OS_COLORS = { 'Windows 11': '#4f46e5', 'Windows 10': '#f59e0b' };
const STORAGE_COLORS = { SSD: '#10b981', HDD: '#f59e0b', Unknown: '#cbd5e1' };
const PERFORMANCE_ORDER = ['Excellent', 'Good', 'Average', 'Slow'];
const PERFORMANCE_COLORS = { Excellent: '#14b8a6', Good: '#4f46e5', Average: '#f59e0b', Slow: '#f43f5e' };

/**
 * "11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz" → "Intel Core i7-1185G7".
 * The full string still lives in the record; a card only has room for the model.
 */
export function shortCpu(cpu) {
  const text = clean(cpu);
  if (!text) return null;
  return (
    text
      .replace(/\((R|TM|C)\)/gi, '')
      .replace(/\b\d+(st|nd|rd|th) Gen\b/i, '')
      .replace(/\s*@.*$/, '')
      .replace(/\bwith Radeon.*$/i, '')
      .replace(/\b(CPU|Processor)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || text
  );
}

const MULTIMEDIA = [
  { key: 'audio_output', label: 'Audio' },
  { key: 'microphone', label: 'Microphone' },
  { key: 'camera', label: 'Camera' },
];

/**
 * Why a PC deserves a second look, as short phrases. Hardware and software only:
 * a PC that has simply never run the agent is not a problem PC, it just has less
 * data, so that is reported separately as agent coverage rather than listed here.
 */
export function attentionReasons(pc) {
  const reasons = [];
  if (pc.status === 'Retired') reasons.push('Retired');
  if (pc.performance === 'Slow') reasons.push('Slow performance');
  if (pc.os === 'Windows 10') reasons.push('Windows 10, out of support');
  if (pc.storage_type === 'HDD') reasons.push('Still on a hard disk');
  if (pc.ram_gb != null && pc.ram_gb > 0 && pc.ram_gb < 8) reasons.push(`Only ${pc.ram_gb} GB RAM`);
  for (const device of MULTIMEDIA) {
    const health = pc[device.key];
    if (health === 'Faulty' || health === 'Disabled') reasons.push(`${device.label} ${health.toLowerCase()}`);
  }
  return reasons;
}

/** Sorted category counts with the share of the whole, ready for a chart. */
function tally(pcs, keyOf, { colors = {}, order = null, fallback = 'Unknown' } = {}) {
  const counts = new Map();
  for (const pc of pcs) {
    const key = clean(keyOf(pc)) ?? fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let labels = [...counts.keys()];
  labels = order
    ? labels.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    : labels.sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  const total = pcs.length || 1;
  return labels.map((label, index) => ({
    label,
    count: counts.get(label),
    share: counts.get(label) / total,
    color: colors[label] ?? CHART_COLORS[index % CHART_COLORS.length],
  }));
}

/** "just now", "3 hours ago", "2 days ago" — for the last agent report line. */
export function relativeTime(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

/** The numbers and breakdowns the overview page is built from. */
export function fleetStats(pcs) {
  const total = pcs.length;
  const active = pcs.filter((pc) => pc.status === 'Active').length;
  const reporting = pcs.filter((pc) => pc.last_reported_at).length;
  const latestReport = pcs
    .map((pc) => pc.last_reported_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const ramKnown = pcs.filter((pc) => pc.ram_gb != null && pc.ram_gb > 0);
  const totalRamGb = ramKnown.reduce((sum, pc) => sum + Number(pc.ram_gb), 0);

  const attention = pcs
    .map((pc) => ({ pc, reasons: attentionReasons(pc) }))
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.pc.name.localeCompare(b.pc.name));

  const share = (count) => (total ? count / total : 0);

  return {
    total,
    active,
    retired: total - active,
    reporting,
    reportingShare: share(reporting),
    latestReport,
    windows11: pcs.filter((pc) => pc.os === 'Windows 11').length,
    windows11Share: share(pcs.filter((pc) => pc.os === 'Windows 11').length),
    ssd: pcs.filter((pc) => pc.storage_type === 'SSD').length,
    ssdShare: share(pcs.filter((pc) => pc.storage_type === 'SSD').length),
    totalRamGb,
    avgRamGb: ramKnown.length ? Math.round(totalRamGb / ramKnown.length) : 0,
    softwareTotal: pcs.reduce((sum, pc) => sum + (Number(pc.software_count) || 0), 0),
    printerTotal: pcs.reduce((sum, pc) => sum + (Number(pc.printer_count) || 0), 0),
    attention,
    byType: tally(pcs, (pc) => pc.machine_type, { colors: TYPE_COLORS, order: ['Desktop', 'AIO', 'Laptop'] }),
    byOs: tally(pcs, (pc) => pc.os, { colors: OS_COLORS, order: ['Windows 11', 'Windows 10'] }),
    byStorage: tally(pcs, (pc) => pc.storage_type, { colors: STORAGE_COLORS, order: ['SSD', 'HDD', 'Unknown'] }),
    byPerformance: tally(pcs, (pc) => pc.performance, { colors: PERFORMANCE_COLORS, order: PERFORMANCE_ORDER }),
    byRam: tally(pcs, (pc) => (pc.ram_gb ? `${pc.ram_gb} GB` : null), { fallback: 'Not recorded' }).sort(
      (a, b) => (parseInt(a.label, 10) || Infinity) - (parseInt(b.label, 10) || Infinity),
    ),
    byLocation: tally(pcs, (pc) => pc.location, { fallback: 'Unassigned' }),
    byBrand: tally(pcs, (pc) => pc.brand, { fallback: 'Unknown' }),
  };
}
