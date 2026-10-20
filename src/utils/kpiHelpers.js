import { TIME, dayKey, fmtDayShort, median, fmtDuration } from './format';
import { SEVERITIES } from '../types';

/** Counts items by a key function -> { key: n }. */
export function countBy(items, keyFn) {
  const m = {};
  items.forEach((it) => { const k = keyFn(it); if (k != null && k !== '') m[k] = (m[k] || 0) + 1; });
  return m;
}
export const topEntry = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null;

/** Mini-stats row: [['Critical', 3], ['High', 9]] -> [{label, value}] (zero values kept, nulls dropped). */
export const stats = (pairs) => pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => ({ label, value }));

/** "Critical 3 · High 9 · Moderate 8" for severity counts. */
export function severityStats(items, key = 'severity', order = SEVERITIES.slice().reverse()) {
  const c = countBy(items, (x) => x[key]);
  return stats(order.filter((s) => c[s]).map((s) => [s, c[s]]));
}

/** Breakdown chart payload from items. */
export function breakdownOf(items, keyFn, { title, xTitle, yTitle, order } = {}) {
  const c = countBy(items, keyFn);
  const labels = (order ? order.filter((k) => c[k]) : Object.keys(c).sort((a, b) => c[b] - c[a])).slice(0, 8);
  return { title, xTitle, yTitle, labels, data: labels.map((l) => c[l]) };
}

/** Last `days` day labels ("14 Oct") and end-of-day timestamps, oldest first. */
export function lastDays(days = 7, now = Date.now()) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now - i * TIME.DAY);
    const key = dayKey(d.toISOString());
    const end = i === 0 ? now : new Date(`${key}T23:59:59.999`).getTime();
    out.push({ key, label: fmtDayShort(key), end });
  }
  return out;
}

/** Number of contributing items that existed by the end of each of the last 7 days. */
export function cumulativeSeries(items, dateFn, now = Date.now(), days = 7) {
  const ds = lastDays(days, now);
  return { labels: ds.map((d) => d.label), values: ds.map((d) => items.filter((it) => new Date(dateFn(it)).getTime() <= d.end).length) };
}

/** Per-day values computed by `fn(dayStart, dayEnd)`. */
export function dailySeries(fn, now = Date.now(), days = 7) {
  const ds = lastDays(days, now);
  return { labels: ds.map((d) => d.label), values: ds.map((d) => fn(new Date(`${d.key}T00:00:00`).getTime(), d.end)) };
}

/** Least-squares projection of `n` further points. */
export function forecast(values, n = 3) {
  const m = values.length;
  const xs = values.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / m;
  const my = values.reduce((a, b) => a + b, 0) / m;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (values[i] - my), 0) / den;
  const icpt = my - slope * mx;
  return Array.from({ length: n }, (_, k) => Math.max(0, Math.round((icpt + slope * (m + k)) * 10) / 10));
}

export const nextDayLabels = (n = 3, now = Date.now()) => Array.from({ length: n }, (_, k) => fmtDayShort(dayKey(new Date(now + (k + 1) * TIME.DAY).toISOString())));

export { median, fmtDuration };

/** Oldest / waiting-time helper: "6 h" for the oldest timestamp. */
export function oldestAge(isoList, now = Date.now()) {
  const t = isoList.filter(Boolean).map((x) => new Date(x).getTime());
  return t.length ? fmtDuration(now - Math.min(...t)) : '—';
}
