/**
 * KPI thresholds and presentation rules for every KPI card on every page.
 *   dir: 'lower'  -> lower is better:  value <= green => NORMAL, <= amber => WARNING, else CRITICAL
 *   dir: 'higher' -> higher is better: value >= green => NORMAL, >= amber => WARNING, else CRITICAL
 *   red: false    -> never CRITICAL (the worst state is WARNING)
 *   info: true    -> informational, no status
 * The card status is always computed from here; nothing is hard-coded in JSX.
 */
const K = (o) => o;

export const KPI_THRESHOLDS = {
  // Command Centre
  'cc.activeIncidents': K({ dir: 'lower', green: 15, amber: 25, unit: 'incidents', description: 'Open incidents across the selected scope.' }),
  'cc.warnings': K({ dir: 'lower', green: 15, amber: 30, unit: 'warnings', description: 'Agency warnings currently inside their validity period.' }),
  'cc.highSeverity': K({ dir: 'lower', green: 6, amber: 12, unit: 'incidents', description: 'Active incidents rated High or Critical.' }),
  'cc.districts': K({ dir: 'lower', green: 8, amber: 16, unit: 'districts', description: 'Districts with at least one active incident.' }),
  'cc.openTasks': K({ dir: 'lower', green: 25, amber: 40, unit: 'tasks', description: 'Response tasks not yet completed or cancelled.' }),
  'cc.sources': K({ dir: 'lower', green: 0, amber: 2, unit: 'sources', description: 'Data sources reporting delayed or offline.' }),
  // Alerts & Warnings
  'al.active': K({ dir: 'lower', green: 12, amber: 24, unit: 'alerts', description: 'Alerts currently inside their validity period.' }),
  'al.unack': K({ dir: 'lower', green: 0, amber: 3, unit: 'alerts', description: 'Active alerts no operator has acknowledged yet.' }),
  'al.expiring': K({ dir: 'lower', green: 5, amber: 10, unit: 'alerts', description: 'Active alerts that expire within the next 24 hours.', upIsBad: false }),
  'al.cancelled': K({ dir: 'lower', green: 2, amber: 5, unit: 'alerts', description: 'Alerts withdrawn by the issuing agency.' }),
  // Field Operations
  'fo.open': K({ dir: 'lower', green: 15, amber: 30, unit: 'tasks', description: 'Tasks not yet completed or cancelled.' }),
  'fo.unassigned': K({ dir: 'lower', green: 0, amber: 3, unit: 'tasks', description: 'Open tasks with no team or operator assigned.' }),
  'fo.overdue': K({ dir: 'lower', green: 0, amber: 2, unit: 'tasks', description: 'Open tasks whose due time has passed.' }),
  'fo.awaiting': K({ dir: 'lower', green: 3, amber: 6, unit: 'tasks', description: 'Tasks reported by the field team and waiting for operator verification.' }),
  'fo.completed': K({ dir: 'higher', green: 2, amber: 0, red: false, unit: 'tasks', description: 'Tasks verified as completed.' }),
  // Data sources
  'int.connected': K({ dir: 'higher', green: 8, amber: 6, unit: 'sources', description: 'Sources delivering data on schedule.' }),
  'int.delayed': K({ dir: 'lower', green: 0, amber: 1, unit: 'sources', description: 'Sources whose latest update is later than expected.' }),
  'int.offline': K({ dir: 'lower', green: 0, amber: 1, unit: 'sources', description: 'Sources that are not responding.' }),
  'int.records': K({ info: true, dir: 'higher', unit: 'records', description: 'Records received from all sources.' }),
  // Historical Analytics
  'an.incidents': K({ dir: 'lower', green: 60, amber: 120, unit: 'incidents', description: 'Incidents created during the selected period.' }),
  'an.ack': K({ dir: 'lower', green: 15, amber: 60, unit: 'minutes', description: 'Median time from alert issue to first acknowledgement.' }),
  'an.completion': K({ dir: 'higher', green: 90, amber: 70, unit: '%', description: 'Completed tasks as a share of tasks created in the period.' }),
  'an.verification': K({ dir: 'higher', green: 80, amber: 60, unit: '%', description: 'Incidents confirmed on verification, as a share of those verified.' }),
  // Hazard monitoring pages
  'hz.records': K({ info: true, dir: 'higher', unit: 'readings', description: 'Station readings received in the last 24 hours.' }),
  'hz.warnings': K({ dir: 'lower', green: 2, amber: 5, unit: 'warnings', description: 'Active agency warnings for this hazard.' }),
  'hz.exceeding': K({ dir: 'lower', green: 1, amber: 3, unit: 'stations', description: 'Stations at or beyond their warning threshold.' }),
  'hz.districts': K({ dir: 'lower', green: 2, amber: 5, unit: 'districts', description: 'Districts with an active incident for this hazard.' }),
};

/** Legend labels for the three bands, derived from the thresholds. */
/** Thresholds are written for a single state. Counts are multiplied by this at PAN INDIA scope; percentages and durations are not. */
export const SCOPE_FACTOR = 12;
const scaled = (cfg, scale) => (cfg.unit === '%' || cfg.unit === 'minutes' || !scale ? 1 : scale);

/** Legend labels for the three bands, derived from the thresholds. */
export function thresholdLabels(cfg, scale = 1) {
  if (!cfg || cfg.info) return null;
  const k = scaled(cfg, scale);
  const g = cfg.green * k;
  const a = cfg.amber * k;
  const u = cfg.unit === '%' ? '%' : '';
  if (cfg.dir === 'lower') return [g === 0 ? '0' : `\u2264 ${g}${u}`, `${g + 1}\u2013${a}${u}`, `> ${a}${u}`];
  const mid = a === g - 1 ? `${a}${u}` : `${a}\u2013${g - 1}${u}`;
  return cfg.red === false ? [`\u2265 ${g}${u}`, `< ${g}${u}`] : [`\u2265 ${g}${u}`, `${mid}`, `< ${a}${u}`];
}

/** 'green' | 'amber' | 'red' | null (informational / no value). */
export function thresholdStatus(id, value, scale = 1) {
  const c = KPI_THRESHOLDS[id];
  if (!c || c.info || typeof value !== 'number' || Number.isNaN(value)) return null;
  const k = scaled(c, scale);
  const g = c.green * k;
  const a = c.amber * k;
  if (c.dir === 'lower') return value <= g ? 'green' : value <= a ? 'amber' : 'red';
  if (value >= g) return 'green';
  if (value >= a) return 'amber';
  return c.red === false ? 'amber' : 'red';
}

/** True when a rising value is bad for this KPI (drives delta-chip colour). Null when neutral. */
export function upIsBad(id) {
  const c = KPI_THRESHOLDS[id];
  if (!c || c.info) return null;
  return c.upIsBad !== undefined ? c.upIsBad : c.dir === 'lower';
}
