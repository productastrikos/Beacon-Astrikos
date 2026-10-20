import { buildBaseline } from '../data/demo/baseline';
import { dataStore, getData } from '../state/dataStore';
import { runTick } from '../state/liveEngine';
import { scopeFilter, isActiveAlert, isActiveIncident, isOpenTask, isOverdueTask, hazardSummary, alertStatus } from '../state/selectors';
import { hazardKpis } from '../pages/hazards/hazardConfig';
import { computeAdvisories } from '../state/advisoryRules';
import { HAZARD_KEYS } from '../types';
import { STATE_NAME } from '../data/demo/geography';
import { TIME } from '../utils/format';
import { isEligible } from '../config/hazardRegions';

const SCOPES = ['IN', ...Object.keys(STATE_NAME)];

function checkScope(scope, now) {
  const d = getData();
  const problems = [];
  HAZARD_KEYS.forEach((hz) => {
    const s = hazardSummary(d, hz, scope, now);
    const k = hazardKpis(hz, { records: s.records, alerts: s.alerts, incidents: s.incidents, now });
    const [rec, warn, exc, dist] = k.map((x) => x.value);
    if (!(rec > 0)) problems.push(`${scope}/${hz}: readings ${rec}`);
    const here = scope === 'IN' || isEligible(hz, scope);
    if (here) {
      if (!(warn >= 1)) problems.push(`${scope}/${hz}: warnings ${warn}`);
      if (!(exc >= 1)) problems.push(`${scope}/${hz}: beyond threshold ${exc}`);
      if (!(dist >= 1)) problems.push(`${scope}/${hz}: districts ${dist}`);
    } else if (warn || dist) problems.push(`${scope}/${hz}: ineligible region has ${warn} warnings / ${dist} districts`);
    const latest = s.records.map((r) => new Date(r.sourceTimestamp).getTime()).sort().pop();
    if (!(now - latest < 30 * TIME.MIN)) problems.push(`${scope}/${hz}: stale ${Math.round((now - latest) / TIME.MIN)} min`);
  });
  const tasks = scopeFilter(d.tasks, scope).filter((t) => !t.historical);
  const open = tasks.filter(isOpenTask);
  const alerts = scopeFilter(d.alerts, scope).filter((a) => a.classification !== 'Historical');
  const active = alerts.filter((a) => isActiveAlert(a, now));
  if (!open.some((t) => t.status === 'Unassigned')) problems.push(`${scope}: unassigned 0`);
  if (!open.some((t) => t.status === 'Awaiting Verification')) problems.push(`${scope}: awaiting verification 0`);
  if (!open.some((t) => isOverdueTask(t, now))) problems.push(`${scope}: overdue 0`);
  if (!active.some((a) => !a.ackAt)) problems.push(`${scope}: unacknowledged 0`);
  if (!active.some((a) => new Date(a.expires).getTime() - now <= TIME.DAY)) problems.push(`${scope}: expiring 0`);
  if (!alerts.some((a) => alertStatus(a, now) === 'Cancelled')) problems.push(`${scope}: cancelled 0`);
  if (scopeFilter(d.incidents, scope).filter(isActiveIncident).length < 7) problems.push(`${scope}: incidents < 7`);
  if (!computeAdvisories(d, scope, now).length) problems.push(`${scope}: no advisories`);
  return problems;
}

beforeEach(() => { dataStore.reset(buildBaseline(Date.now())); });

test('every hazard x scope is populated on load (no zeros, nothing stale)', () => {
  const now = Date.now();
  const problems = SCOPES.flatMap((sc) => checkScope(sc, now));
  expect(problems).toEqual([]);
});

test('coverage holds across 120 live ticks', () => {
  for (let i = 0; i < 120; i += 1) runTick();
  const now = Date.now();
  const problems = ['IN', 'AR', 'RJ', 'LA', 'KL', 'AS'].flatMap((sc) => checkScope(sc, now));
  expect(problems).toEqual([]);
});

test('coverage matrix (printed for the report)', () => {
  const now = Date.now();
  const d = getData();
  const rows = HAZARD_KEYS.map((hz) => {
    const per = Object.keys(STATE_NAME).map((st) => hazardKpis(hz, { ...hazardSummary(d, hz, st, now), now })[0].value);
    const inn = hazardKpis(hz, { ...hazardSummary(d, hz, 'IN', now), now })[0].value;
    return `${hz.padEnd(10)} PAN ${String(inn).padStart(6)} readings/24h | state min ${String(Math.min(...per)).padStart(4)} max ${String(Math.max(...per)).padStart(4)}`;
  });
  const sizes = {
    alerts: d.alerts.length, activeAlerts: d.alerts.filter((a) => isActiveAlert(a, now) && a.classification !== 'Historical').length,
    incidents: d.incidents.filter(isActiveIncident).length, openTasks: d.tasks.filter(isOpenTask).length, records: d.records.length,
    bytes: JSON.stringify(d).length,
  };
  // eslint-disable-next-line no-console
  console.log(`${rows.join('\n')}\n${JSON.stringify(sizes)}`);
  expect(sizes.bytes).toBeLessThan(4500000);
});
