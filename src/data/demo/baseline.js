import { isoAgo } from '../../utils/format';
import { buildAlerts } from './alerts';
import { buildGenerated } from './generated';
import { ensureCoverage, refreshStale } from './coverage';
import { createRng } from '../../utils/prng';
import { buildIncidents, buildTasks, buildResources } from './operations';
import { buildHistory } from './historical';
import { SOURCE_DEFS } from './sources';
import { TEAMS } from './people';
import { normalizeTask } from '../../config/taskLifecycle';

/** Version bump invalidates persisted demo state in localStorage. */
export const BASELINE_VERSION = 5;

/**
 * Builds the full operational data slice. Deterministic for a given `base` time:
 * every timestamp is an offset from `base`, and all pseudo-random generation
 * is seeded.
 */
export function buildBaseline(base = Date.now()) {
  base = Math.floor(base / 60000) * 60000;
  const seq = { INC: 1100, TSK: 3100, AUD: 1000, NOTE: 1, ALT: 1200, RES: 100 };
  const history = buildHistory(base);
  const gen = buildGenerated(base, seq);
  let alerts = [...buildAlerts(base), ...history.alerts, ...gen.alerts];
  const alertsById = Object.fromEntries(alerts.map((a) => [a.id, a]));
  let incidents = [...buildIncidents(base, alertsById), ...history.incidents, ...gen.incidents];
  incidents.forEach((inc) => {
    inc.linkedAlertIds.forEach((aid) => {
      if (alertsById[aid] && !alertsById[aid].linkedIncidentIds.includes(inc.id)) alertsById[aid].linkedIncidentIds.push(inc.id);
    });
  });
  // A couple of baseline alerts are already acknowledged, so the register is not uniform.
  ['A-1001', 'A-1102', 'A-1104'].forEach((id, i) => {
    if (alertsById[id]) {
      alertsById[id].ackBy = i === 1 ? 'op-04' : 'u-state';
      alertsById[id].ackAt = isoAgo(base, 30 + i * 10);
    }
  });

  let tasks = [...buildTasks(base, incidents), ...history.tasks, ...gen.tasks];
  {
    const nrng = createRng(91);
    tasks = tasks.map((t) => normalizeTask(t, { rng: nrng, now: base, teams: TEAMS.filter((m) => m.stateCode === t.stateCode) }));
  }
  const resources = buildResources(base, incidents);
  let records = gen.records;
  const cov = (() => {
    const rng = createRng(77);
    const alloc = (k) => { seq[k] += 1; return `${{ INC: 'INC-', ALT: 'A-', TSK: 'TSK-' }[k]}${seq[k]}`; };
    const out = ensureCoverage({ records, incidents, alerts, tasks }, { rng, alloc, now: base });
    return { ...out, records: refreshStale(out.records, rng, base) };
  })();
  records = cov.records; incidents = cov.incidents; alerts = cov.alerts; tasks = cov.tasks;

  const sources = SOURCE_DEFS.map((s) => ({
    id: s.id, name: s.name, short: s.short, hazards: s.hazards, method: s.method, url: s.url, access: s.access,
    status: s.status, configStatus: s.configStatus,
    lastSuccess: s.lastSuccessMin == null ? null : isoAgo(base, s.lastSuccessMin),
    lastAttempt: s.lastAttemptMin == null ? null : isoAgo(base, s.lastAttemptMin),
    records: s.records, error: s.error,
  }));

  const audit = [
    ...incidents.filter((i) => !i.historical).map((i, n) => ({
      id: `AUD-B${String(n + 1).padStart(3, '0')}`, at: i.createdAt,
      userId: 'system', userName: 'System', role: '—',
      action: 'Incident created', entityType: 'Incident', entityId: i.id,
      previous: null, next: i.status, outcome: 'Success', source: 'integration',
      detail: `Baseline record — ${i.provenance}`,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return {
    version: BASELINE_VERSION,
    baseAt: new Date(base).toISOString(),
    incidents, alerts, tasks, resources, records, sources,
    flags: [],
    audit,
    simRuns: {},
    settings: { simStepSeconds: 3, hazardsEnabled: Object.fromEntries(['flood', 'landslide', 'earthquake', 'avalanche', 'wildfire', 'heatwave', 'coldwave'].map((k) => [k, true])) },
    seq,
  };
}
