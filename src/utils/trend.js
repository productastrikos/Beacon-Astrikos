import { TIME, dayKey, fmtDayShort } from './format';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Buckets timestamped items. range: '24h' (hourly) | '7d' | '30d' | '90d' (daily).
 * series: [{ label, items, at: (item) => iso }]
 */
export function bucketSeries(range, series, now = Date.now()) {
  const hourly = range === '24h';
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
  const keys = [];
  const labels = [];
  if (hourly) {
    for (let i = 23; i >= 0; i -= 1) {
      const d = new Date(now - i * TIME.HOUR);
      keys.push(`${dayKey(d.toISOString())}T${pad(d.getHours())}`);
      labels.push(`${pad(d.getHours())}:00`);
    }
  } else {
    for (let i = days - 1; i >= 0; i -= 1) {
      const k = dayKey(new Date(now - i * TIME.DAY).toISOString());
      keys.push(k);
      labels.push(fmtDayShort(k));
    }
  }
  const index = Object.fromEntries(keys.map((k, i) => [k, i]));
  const datasets = series.map((s) => {
    const data = keys.map(() => 0);
    s.items.forEach((it) => {
      const d = new Date(s.at(it));
      const k = hourly ? `${dayKey(d.toISOString())}T${pad(d.getHours())}` : dayKey(d.toISOString());
      if (k in index) data[index[k]] += 1;
    });
    return { label: s.label, data, color: s.color, dashed: s.dashed };
  });
  return { labels, datasets };
}
