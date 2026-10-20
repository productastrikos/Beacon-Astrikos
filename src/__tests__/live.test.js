import { buildBaseline } from '../data/demo/baseline';
import { dataStore, getData } from '../state/dataStore';
import { liveStore } from '../state/liveStore';
import { runTick } from '../state/liveEngine';
import { computeKpis, isActiveIncident } from '../state/selectors';
import { startSession } from '../state/session';
import { DEMO_USERS } from '../data/demo/people';
import { startScenario, pauseScenario, stepScenario, stopAllTimers } from '../state/simulation';
import { SCENARIOS } from '../data/demo/scenarios';
import { thresholdStatus } from '../config/kpiThresholds';
import { SIM } from '../config/simulationConfig';

const BASE = Date.UTC(2026, 9, 13, 6, 30);

beforeEach(() => {
  stopAllTimers();
  dataStore.reset(buildBaseline(BASE));
  liveStore.reset();
  const { password, ...u } = DEMO_USERS.find((x) => x.username === 'admin');
  startSession(u, false);
});

test('engine is disabled under Jest so tests stay deterministic', () => {
  expect(SIM.enabled).toBe(false);
});

test('ticks keep the store consistent and log a capped rolling event list', () => {
  for (let i = 0; i < 120; i += 1) runTick();
  const d = getData();
  const ids = d.incidents.map((x) => x.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(d.tasks.map((t) => t.id)).size).toBe(d.tasks.length);
  const { events } = liveStore.get();
  expect(events.length).toBeGreaterThan(0);
  expect(events.length).toBeLessThanOrEqual(SIM.eventLogSize);
  // KPIs are derived from the same store.
  const k = computeKpis(d, 'IN', Date.now());
  expect(k.activeIncidents).toBe(d.incidents.filter(isActiveIncident).length);
  // every task points at an existing incident, and incidents list their tasks
  d.tasks.filter((t) => t.incidentId).forEach((t) => expect(ids).toContain(t.incidentId));
  d.incidents.forEach((i) => i.taskIds.forEach((tid) => expect(d.tasks.some((t) => t.id === tid)).toBe(true)));
});

test('live events never modify scenario records, so scenario reset still restores the baseline', () => {
  startScenario('S1'); pauseScenario('S1');
  for (let i = 1; i < SCENARIOS[0].steps.length; i += 1) stepScenario('S1');
  const sim = JSON.stringify(getData().incidents.filter((i) => i.origin === 'simulation'));
  for (let i = 0; i < 60; i += 1) runTick();
  expect(JSON.stringify(getData().incidents.filter((i) => i.origin === 'simulation'))).toBe(sim);
});

test('KPI thresholds map values to NORMAL / WARNING / CRITICAL', () => {
  expect(thresholdStatus('cc.activeIncidents', 15)).toBe('green');
  expect(thresholdStatus('cc.activeIncidents', 16)).toBe('amber');
  expect(thresholdStatus('cc.activeIncidents', 26)).toBe('red');
  expect(thresholdStatus('cc.sources', 0)).toBe('green');
  expect(thresholdStatus('cc.sources', 3)).toBe('red');
});

test('source going offline marks the system degraded and recovers', () => {
  let seen = false;
  for (let i = 0; i < 400 && !seen; i += 1) { runTick(); seen = getData().sources.some((s) => s.liveOffline); }
  expect(seen).toBe(true);
});
