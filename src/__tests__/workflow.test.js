import { buildBaseline } from '../data/demo/baseline';
import { dataStore, getData } from '../state/dataStore';
import { startSession, endSession } from '../state/session';
import { DEMO_USERS } from '../data/demo/people';
import { authenticate } from '../services/authService';
import {
  acknowledgeAlert, linkAlertToIncident, createIncident, transitionIncident, createTask, assignTask, transitionTask,
  escalateIncident, resetDemoData, assignResource,
} from '../state/actions';
import {
  startScenario, stepScenario, resetScenario, pauseScenario, stopAllTimers,
} from '../state/simulation';
import { SCENARIOS } from '../data/demo/scenarios';
import { computeKpis, scopeFilter } from '../state/selectors';
import { can } from '../state/permissions';

const BASE = Date.UTC(2026, 9, 13, 6, 30);
const loginAs = (username) => {
  const { password, ...u } = DEMO_USERS.find((x) => x.username === username);
  startSession(u, false);
};
const fresh = () => dataStore.reset(buildBaseline(BASE));
const kpis = (scope = 'IN') => computeKpis(getData(), scope, Date.now());

beforeEach(() => { stopAllTimers(); fresh(); loginAs('admin'); });
afterAll(() => { stopAllTimers(); endSession(); });

describe('baseline data', () => {
  test('is deterministic for a given base time', () => {
    const a = buildBaseline(BASE);
    const b = buildBaseline(BASE);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  test('scope filter narrows records to Arunachal Pradesh', () => {
    const d = getData();
    const ar = scopeFilter(d.incidents, 'AR');
    expect(ar.length).toBeGreaterThan(0);
    expect(ar.length).toBeLessThan(d.incidents.length);
    expect(ar.every((i) => i.stateCode === 'AR')).toBe(true);
    expect(kpis('AR').activeIncidents).toBeLessThan(kpis('IN').activeIncidents);
  });

  test('every source has a valid status and a last-sync time', () => {
    getData().sources.forEach((src) => { expect(['Connected', 'Delayed', 'Offline']).toContain(src.status); expect(src.lastSuccess).toBeTruthy(); });
  });
});

describe('demo authentication', () => {
  test('accepts valid credentials and rejects invalid ones', async () => {
    const ok = await authenticate('admin', 'Astrikos2026');
    expect(ok.ok).toBe(true);
    expect(ok.user.password).toBeUndefined();
    const byEmail = await authenticate('STATE.AR@beacon.local', 'Beacon#State1');
    expect(byEmail.ok).toBe(true);
    const bad = await authenticate('admin', 'wrong');
    expect(bad.ok).toBe(false);
  });
});

describe('alerts and incidents', () => {
  test('acknowledge an alert updates state and audit', () => {
    const id = 'A-1002';
    expect(getData().alerts.find((a) => a.id === id).ackAt).toBeNull();
    const before = getData().audit.length;
    expect(acknowledgeAlert(id, 'seen').ok).toBe(true);
    const a = getData().alerts.find((x) => x.id === id);
    expect(a.ackAt).toBeTruthy();
    expect(getData().audit.length).toBe(before + 1);
    expect(acknowledgeAlert(id).ok).toBe(false);
  });

  test('link an alert to an incident (both directions); mismatched hazard or state is refused', () => {
    const d0 = getData();
    const inc = d0.incidents.find((i) => !i.historical && i.status === 'Reported');
    const al = d0.alerts.find((a) => a.classification !== 'Historical' && a.hazard === inc.hazard && a.stateCode === inc.stateCode && !inc.linkedAlertIds.includes(a.id));
    const bad = d0.alerts.find((a) => a.classification !== 'Historical' && a.hazard !== inc.hazard);
    expect(linkAlertToIncident(bad.id, inc.id).ok).toBe(false);
    expect(linkAlertToIncident(al.id, inc.id).ok).toBe(true);
    const d = getData();
    expect(d.alerts.find((a) => a.id === al.id).linkedIncidentIds).toContain(inc.id);
    expect(d.incidents.find((i) => i.id === inc.id).linkedAlertIds).toContain(al.id);
  });

  test('lifecycle enforces valid transitions and required reasons', () => {
    const r = createIncident({ title: 'Test slope', hazard: 'landslide', stateCode: 'AR', district: 'Tawang', severity: 'Moderate' });
    expect(r.ok).toBe(true);
    const id = r.id;
    expect(getData().incidents.find((i) => i.id === id).status).toBe('Reported');
    expect(transitionIncident(id, 'Confirmed').ok).toBe(false); // cannot skip verification
    expect(transitionIncident(id, 'Under Verification').ok).toBe(true);
    expect(transitionIncident(id, 'Unconfirmed').ok).toBe(false); // reason required
    expect(transitionIncident(id, 'Confirmed').ok).toBe(true);
    expect(getData().incidents.find((i) => i.id === id).verification).toBe('Verified');
    expect(transitionIncident(id, 'Response in Progress').ok).toBe(true);
    expect(transitionIncident(id, 'Resolved', 'done').ok).toBe(true);
    expect(transitionIncident(id, 'Closed', 'complete').ok).toBe(true);
    const inc = getData().incidents.find((i) => i.id === id);
    expect(inc.closureReason).toBe('complete');
    expect(inc.timeline.length).toBeGreaterThanOrEqual(6);
    expect(transitionIncident(id, 'Reported').ok).toBe(false);
  });

  test('a linked warning does not auto-confirm an incident', () => {
    const r = createIncident({ title: 'From alert', hazard: 'flood', stateCode: 'AR', district: 'Lohit' }, { fromAlertId: 'A-1009' });
    const inc = getData().incidents.find((i) => i.id === r.id);
    expect(inc.verification).toBe('Unverified');
    expect(inc.status).toBe('Reported');
  });

  test('escalation raises severity and needs a reason', () => {
    expect(escalateIncident('INC-1003', '').ok).toBe(false);
    expect(escalateIncident('INC-1003', 'worsening').ok).toBe(true);
    expect(getData().incidents.find((i) => i.id === 'INC-1003').severity).toBe('High');
  });
});

describe('tasks and resources', () => {
  test('create, assign, progress and complete a task', () => {
    const c = createTask({ incidentId: 'INC-1003', category: 'Road assessment', location: 'Anini–Roing road', priority: 'High', dueHours: 4 });
    expect(c.ok).toBe(true);
    expect(getData().incidents.find((i) => i.id === 'INC-1003').taskIds).toContain(c.id);
    expect(getData().tasks.find((t) => t.id === c.id).status).toBe('Unassigned');
    expect(assignTask(c.id, 'tm-ar-02').ok).toBe(true);
    expect(getData().tasks.find((t) => t.id === c.id).status).toBe('Assigned');
    expect(transitionTask(c.id, 'In Progress').ok).toBe(true);
    expect(transitionTask(c.id, 'Awaiting Verification').ok).toBe(false); // notes required
    expect(transitionTask(c.id, 'Awaiting Verification', 'Road passable with care').ok).toBe(true);
    expect(transitionTask(c.id, 'Completed', 'Verified').ok).toBe(true);
    expect(transitionTask(c.id, 'In Progress').ok).toBe(false);
    expect(getData().tasks.find((t) => t.id === c.id).completedAt).toBeTruthy();
  });

  test('assigning a resource links it to the incident', () => {
    expect(assignResource('SH-002', 'INC-1004').ok).toBe(true);
    const d = getData();
    expect(d.resources.find((r) => r.id === 'SH-002').assignedIncident).toBe('INC-1004');
    expect(d.incidents.find((i) => i.id === 'INC-1004').resourceIds).toContain('SH-002');
  });
});

describe('role restrictions', () => {
  test('auditor and field responder are denied and the denial is audited', () => {
    loginAs('auditor');
    const before = getData().audit.length;
    const res = acknowledgeAlert('A-1002');
    expect(res.ok).toBe(false);
    expect(getData().alerts.find((a) => a.id === 'A-1002').ackAt).toBeNull();
    expect(getData().audit[0].outcome).toBe('Denied');
    expect(getData().audit.length).toBe(before + 1);

    loginAs('field');
    expect(transitionIncident('INC-1003', 'Under Verification').ok).toBe(false);
    expect(createIncident({ title: 'x', hazard: 'flood', stateCode: 'AR', district: 'Lohit' }).ok).toBe(false);
  });

  test('only national administrator can reset demo data', () => {
    expect(can('STATE_OPERATOR', 'demo.reset')).toBe(false);
    loginAs('state');
    expect(resetDemoData().ok).toBe(false);
    loginAs('admin');
    expect(resetDemoData().ok).toBe(true);
  });
});

describe('simulation engine', () => {
  const firstDiff = (a, b, path = '') => {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        const d = firstDiff(a[k], b[k], path + '/' + (a[k] && a[k].id ? a[k].id : k));
        if (d) return d;
      }
    }
    return path + ' :: ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b);
  };
  const snapshot = () => {
    const d = getData();
    // Audit is excluded: reset intentionally appends its own audit entries.
    return { incidents: d.incidents, alerts: d.alerts, tasks: d.tasks, resources: d.resources, records: d.records, flags: d.flags };
  };

  test.each(SCENARIOS.map((s) => [s.id, s]))('scenario %s runs end to end and updates shared state', (_id, s) => {
    const baseKpi = kpis();
    const baseAudit = getData().audit.length;
    expect(startScenario(s.id).ok).toBe(true);
    pauseScenario(s.id);
    for (let i = 1; i < s.steps.length; i += 1) expect(stepScenario(s.id).ok).toBe(true);
    const run = getData().simRuns[s.id];
    expect(run.status).toBe('completed');
    expect(run.stepIndex).toBe(s.steps.length);
    expect(run.created.incidents.length).toBeGreaterThan(0);
    expect(run.created.tasks.length).toBeGreaterThan(0);
    expect(getData().audit.length).toBeGreaterThan(baseAudit);
    const after = kpis();
    expect(after.activeIncidents).toBeGreaterThan(baseKpi.activeIncidents);
    expect(after.openTasks).toBeGreaterThan(baseKpi.openTasks);
    // everything created is flagged synthetic / simulation-origin
    const inc = getData().incidents.find((i) => i.id === run.created.incidents[0]);
    expect(inc.origin).toBe('simulation');
  });

  test.each(SCENARIOS.map((s) => [s.id, s]))('reset of %s restores the baseline exactly', (_id, s) => {
    const before = snapshot();
    startScenario(s.id);
    pauseScenario(s.id);
    for (let i = 1; i < s.steps.length; i += 1) stepScenario(s.id);
    expect(firstDiff(snapshot(), before)).not.toBeNull();
    expect(resetScenario(s.id).ok).toBe(true);
    expect(firstDiff(snapshot(), before)).toBeNull();
    expect(getData().simRuns[s.id].status).toBe('idle');
  });

  test('reset leaves unrelated operator-created records intact', () => {
    const mine = createIncident({ title: 'Operator incident', hazard: 'flood', stateCode: 'AR', district: 'Lohit' });
    startScenario('S1'); pauseScenario('S1');
    stepScenario('S1');
    resetScenario('S1');
    expect(getData().incidents.some((i) => i.id === mine.id)).toBe(true);
  });

  test('S2 flags the road record and S4 does not auto-confirm', () => {
    startScenario('S2'); pauseScenario('S2');
    for (let i = 1; i < SCENARIOS.find((s) => s.id === 'S2').steps.length; i += 1) stepScenario('S2');
    expect(getData().resources.find((r) => r.id === 'RD-009').availability).toBe('Needs verification');
    startScenario('S4'); pauseScenario('S4');
    for (let i = 1; i < SCENARIOS.find((s) => s.id === 'S4').steps.length; i += 1) stepScenario('S4');
    const inc = getData().incidents.find((i) => i.id === 'INC-9401');
    expect(inc.status).toBe('Under Verification');
    expect(inc.verification).toBe('Pending');
    expect(getData().tasks.find((t) => t.id === 'TSK-9401').status).toBe('Awaiting Verification');
  });

  test('a scenario warning is counted as an active warning and removed on reset', () => {
    const base = kpis();
    startScenario('S1'); pauseScenario('S1');
    expect(kpis().activeWarnings).toBe(base.activeWarnings + 1);
    resetScenario('S1');
    expect(kpis().activeWarnings).toBe(base.activeWarnings);
  });
});

