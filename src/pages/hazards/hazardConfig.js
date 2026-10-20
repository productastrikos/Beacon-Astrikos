import { fmtRelative, fmtDateTime } from '../../utils/format';
import { stats, breakdownOf, severityStats } from '../../utils/kpiHelpers';
import { CAP_SEVERITIES } from '../../types';
import { classify } from '../../data/demo/stationModel';

/**
 * Hazard-specific wording and the "records beyond threshold" rule. All four KPI cards on a hazard page are built by
 * hazardKpis() from the live store, so every card is filled from real counts (no placeholders).
 */
const top = (items, fn) => items.slice().sort((a, b) => fn(b) - fn(a))[0];

export const HAZARD_CONFIG = {
  flood: {
    blurb: 'River-level observations and flood-related warnings.', valueHeader: 'Observed level', recordsLabel: 'River observations',
    exceedLabel: 'Stations above threshold', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex) => {
      const danger = ex.filter((r) => r.extra.danger != null && Number(r.value) >= r.extra.danger);
      const hi = top(ex, (r) => Number(r.value));
      return stats([['Above warning', ex.length - danger.length], ['Above danger', danger.length], ['Highest', hi ? `${hi.location.split(' at ')[1] || hi.location} ${hi.value} m` : null]]);
    },
  },
  landslide: {
    blurb: 'Rainfall observations, landslide reports and bulletins.', valueHeader: 'Observation / status', recordsLabel: 'Rainfall observations & reports',
    exceedLabel: 'Rainfall above threshold', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex, all) => stats([['Gauges', ex.length], ['Reports on file', all.filter((r) => r.kind === 'report').length], ['Highest', (top(ex, (r) => Number(r.value)) || {}).value ? `${top(ex, (r) => Number(r.value)).value} mm` : null]]),
  },
  earthquake: {
    blurb: 'Catalogued seismic events and follow-up inspection work.', valueHeader: 'Magnitude', recordsLabel: 'Seismic events',
    exceedLabel: 'Events at M4.5 and above', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex, all) => stats([['Largest', all.length ? `M${Math.max(...all.filter((r) => r.kind === 'event').map((r) => Number(r.value))).toFixed(1)}` : null], ['Shallow (≤ 15 km)', ex.filter((r) => r.extra && r.extra.depthKm <= 15).length]]),
  },
  avalanche: {
    blurb: 'Avalanche danger bulletins and corridor verification.', valueHeader: 'Danger level', recordsLabel: 'Avalanche bulletins',
    exceedLabel: 'Corridors at danger level 3+', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex) => stats([['Highest level', ex.length ? Math.max(...ex.map((r) => Number(r.value))) : null], ['Unverified', ex.filter((r) => r.verification !== 'Verified').length]]),
  },
  wildfire: {
    blurb: 'Satellite fire detections and field verification status.', valueHeader: 'Detection confidence', recordsLabel: 'Satellite detections',
    exceedLabel: 'High-confidence detections', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex) => stats([['Unverified', ex.filter((r) => ['Unverified', 'Pending'].includes(r.verification)).length], ['Peak power', ex.length ? `${Math.max(...ex.map((r) => (r.extra && r.extra.frp) || 0))} MW` : null]]),
  },
  heatwave: {
    blurb: 'Temperature observations, forecasts and heat-action tasks.', valueHeader: 'Temperature', recordsLabel: 'Temperature observations',
    exceedLabel: 'Stations above heat threshold', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex) => stats([['Highest', ex.length ? `${Math.max(...ex.map((r) => Number(r.value))).toFixed(1)} °C` : null], ['Stations', ex.length]]),
  },
  coldwave: {
    blurb: 'Temperature observations and cold-related warnings.', valueHeader: 'Temperature', recordsLabel: 'Temperature observations',
    exceedLabel: 'Stations below cold threshold', exceedWhere: (r) => classify(r).exceeding,
    exceedStats: (ex) => stats([['Lowest', ex.length ? `${Math.min(...ex.map((r) => Number(r.value))).toFixed(1)} °C` : null], ['Stations', ex.length]]),
  },
};

const ALERT_COLS = [{ header: 'ID', get: (a) => a.id }, { header: 'Headline', get: (a) => a.headline }, { header: 'Severity', get: (a) => a.severity }, { header: 'Expires', get: (a) => fmtDateTime(a.expires) }];
const REC_COLS = [{ header: 'ID', get: (r) => r.id }, { header: 'Location', get: (r) => r.location }, { header: 'Value', get: (r) => `${r.value} ${r.unit}`.trim() }, { header: 'Verification', get: (r) => r.verification }];
const INC_COLS = [{ header: 'ID', get: (i) => i.id }, { header: 'Title', get: (i) => i.title }, { header: 'Severity', get: (i) => i.severity }, { header: 'Status', get: (i) => i.status }];

/** Builds the four KPI card payloads for a hazard page from { records, alerts, incidents }. */
export function hazardKpis(hazard, { records, alerts, incidents, now }) {
  const cfg = HAZARD_CONFIG[hazard];
  const exceeding = records.filter(cfg.exceedWhere);
  const districts = [...new Set([...incidents.map((i) => `${i.stateCode}|${i.district}`), ...alerts.flatMap((a) => a.districts.map((d) => `${a.stateCode}|${d}`)), ...exceeding.map((r) => `${r.stateCode}|${r.district}`)])];
  const latest = records.map((r) => r.sourceTimestamp).sort().pop();
  const nearestExpiry = alerts.map((a) => a.expires).sort()[0];
  return [
    {
      id: 'hz.records', label: cfg.recordsLabel, value: records.reduce((n, r) => n + ((r.extra && r.extra.readings24h) || 1), 0),
      stats: stats([['Stations', records.length], ['Latest reading', latest ? fmtRelative(latest, now) : null], ['Reporting now', records.filter((r) => now - new Date(r.sourceTimestamp).getTime() <= 30 * 60000).length]]),
      breakdown: breakdownOf(records, (r) => r.sourceId, { title: 'By source', xTitle: 'Stations', yTitle: 'Source' }), rows: { columns: REC_COLS, items: records },
    },
    {
      id: 'hz.warnings', label: `Active ${hazard === 'avalanche' ? 'avalanche' : hazard === 'earthquake' ? 'seismic' : hazard} warnings`, value: alerts.length,
      stats: [...severityStats(alerts, 'severity', CAP_SEVERITIES.slice().reverse()).slice(0, 2), ...stats([['Nearest expiry', nearestExpiry ? fmtRelative(nearestExpiry, now) : null]])],
      breakdown: breakdownOf(alerts, (a) => a.severity, { title: 'By severity', xTitle: 'Warnings', yTitle: 'Severity', order: CAP_SEVERITIES.slice().reverse() }), rows: { columns: ALERT_COLS, items: alerts },
    },
    {
      id: 'hz.exceeding', label: cfg.exceedLabel, value: exceeding.length, stats: cfg.exceedStats(exceeding, records),
      breakdown: breakdownOf(exceeding, (r) => r.district, { title: 'By district', xTitle: 'Records', yTitle: 'District' }), rows: { columns: REC_COLS, items: exceeding },
    },
    {
      id: 'hz.districts', label: 'Districts affected', value: districts.length,
      stats: stats([['Active incidents', incidents.length], ['States', new Set([...incidents.map((i) => i.stateCode), ...alerts.map((a) => a.stateCode)]).size], ['Critical / High', incidents.filter((i) => ['Critical', 'High'].includes(i.severity)).length]]),
      breakdown: breakdownOf(incidents, (i) => i.district, { title: 'By district', xTitle: 'Active incidents', yTitle: 'District' }), rows: { columns: INC_COLS, items: incidents },
    },
  ];
}

