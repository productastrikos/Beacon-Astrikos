const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const TIME = { MIN, HOUR, DAY };

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "13 Oct 2026, 14:05" (24 h, local). Used everywhere for consistency. */
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDayShort(key) {
  const [, m, d] = key.split('-');
  return `${d} ${MONTHS[Number(m) - 1]}`;
}

/** "12 min ago", "3 h ago", "2 d ago", "in 3 h". */
export function fmtRelative(iso, now = Date.now()) {
  if (!iso) return '—';
  const diff = now - new Date(iso).getTime();
  const abs = Math.abs(diff);
  if (abs < MIN) return 'just now';
  const body = abs < HOUR ? `${Math.round(abs / MIN)} min`
    : abs < DAY ? `${Math.round(abs / HOUR)} h`
    : `${Math.round(abs / DAY)} d`;
  return diff >= 0 ? `${body} ago` : `in ${body}`;
}

export function fmtDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.round(abs / MIN)} min`;
  if (abs < DAY) return `${(abs / HOUR).toFixed(1)} h`;
  return `${(abs / DAY).toFixed(1)} d`;
}

export function isoAgo(base, minutes) {
  return new Date(base - minutes * MIN).toISOString();
}

/** Freshness bucket of a timestamp, for stale-data indicators. */
export function freshness(iso, now = Date.now()) {
  if (!iso) return { label: 'Unknown', level: 'unknown' };
  const age = now - new Date(iso).getTime();
  if (age < 3 * HOUR) return { label: 'Fresh', level: 'fresh' };
  if (age < 24 * HOUR) return { label: 'Aging', level: 'aging' };
  return { label: 'Stale', level: 'stale' };
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(','));
  return [head, ...body].join('\n');
}

export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
