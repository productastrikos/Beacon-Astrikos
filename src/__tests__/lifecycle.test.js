import { buildBaseline } from '../data/demo/baseline';
import { dataStore, getData } from '../state/dataStore';
import { runTick } from '../state/liveEngine';
import { advanceTask, assignTask } from '../state/actions';
import { startSession } from '../state/session';
import { DEMO_USERS, TEAMS } from '../data/demo/people';
import { isActiveIncident, isOpenTask } from '../state/selectors';
import { stageOf, STAGES, teamFits } from '../config/taskLifecycle';
import { isEligibleDistrict } from '../config/hazardRegions';
import { TIME } from '../utils/format';

beforeEach(() => {
  dataStore.reset(buildBaseline(Date.now()));
  startSession(DEMO_USERS.find((u) => u.username === 'admin'), false);
});

test('no active incident starts without response tasks', () => {
  const d = getData();
  const bare = d.incidents.filter((i) => isActiveIncident(i) && !i.historical && !d.tasks.some((t) => t.incidentId === i.id));
  expect(bare.map((i) => i.id)).toEqual([]);
});

test('every alert linked to an incident matches its hazard and state, and incidents sit in plausible districts', () => {
  const d = getData();
  const inc = Object.fromEntries(d.incidents.map((i) => [i.id, i]));
  const bad = [];
  d.alerts.filter((a) => !a.historical).forEach((a) => a.linkedIncidentIds.forEach((id) => {
    const i = inc[id];
    if (i && (i.hazard !== a.hazard || i.stateCode !== a.stateCode)) bad.push(`${a.id}/${id}`);
  }));
  expect(bad).toEqual([]);
  const places = d.incidents.filter((i) => i.origin !== 'baseline' && !i.historical && !isEligibleDistrict(i.hazard, i.stateCode, i.district)).map((i) => `${i.id} ${i.hazard} ${i.district}`);
  expect(places).toEqual([]);
});

test('tasks are consistent: stage matches status, open tasks have a fitting team, findings only after Findings submitted', () => {
  const problems = [];
  getData().tasks.filter((t) => !t.historical).forEach((t) => {
    const st = stageOf(t);
    if (t.status === 'Cancelled') return;
    if (!STAGES.includes(st)) problems.push(`${t.id} stage ${st}`);
    if (st !== 'Created' && !t.assignee) problems.push(`${t.id} unassigned at ${st}`);
    const team = TEAMS.find((m) => m.id === t.assignee);
    if (t.assignee && team && !teamFits(team, t.category)) problems.push(`${t.id} ${t.category} -> ${team.specialty}`);
    const after = STAGES.indexOf(st) >= STAGES.indexOf('Findings submitted');
    if (!after && (t.completionNotes || t.evidenceRefs.length)) problems.push(`${t.id} findings before ${st}`);
    if (after && !t.evidenceRefs.length) problems.push(`${t.id} no evidence at ${st}`);
    if (!t.history.length || !t.stageLog.length) problems.push(`${t.id} no history`);
  });
  expect(problems).toEqual([]);
});

test('the live engine moves due tasks one stage on and records history and audit', () => {
  const d = getData();
  const t = d.tasks.find((x) => !x.historical && stageOf(x) === 'Assigned');
  dataStore.set((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, nextAt: Date.now() - 1000 } : x)) }));
  runTick();
  const after = getData().tasks.find((x) => x.id === t.id);
  expect(stageOf(after)).toBe('En route');
  expect(after.history.length).toBe(t.history.length + 1);
  expect(after.stageLog[after.stageLog.length - 1].stage).toBe('En route');
  expect(getData().audit.some((a) => a.entityId === t.id && a.action === 'Task stage changed' && a.next === 'En route')).toBe(true);
});

test('a task that reaches Findings submitted gets notes and evidence, and completing all tasks resolves the incident', () => {
  const d = getData();
  const inc = d.incidents.find((i) => isActiveIncident(i) && !i.historical && d.tasks.filter((t) => t.incidentId === i.id).length === 1);
  const t = d.tasks.find((x) => x.incidentId === inc.id);
  dataStore.set((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, stage: 'On site', status: 'In Progress', completionNotes: '', evidenceRefs: [], completedAt: null, assignee: x.assignee || TEAMS.find((m) => m.stateCode === x.stateCode).id } : x)) }));
  expect(advanceTask(t.id).ok).toBe(true);
  let cur = getData().tasks.find((x) => x.id === t.id);
  expect(stageOf(cur)).toBe('Findings submitted');
  expect(cur.evidenceRefs.length).toBe(1);
  expect(cur.completionNotes).not.toBe('');
  expect(advanceTask(t.id).ok).toBe(true);
  cur = getData().tasks.find((x) => x.id === t.id);
  expect(cur.status).toBe('Completed');
  expect(getData().incidents.find((i) => i.id === inc.id).status).toBe('Resolved');
});

test('an unassigned task cannot be advanced until a team is assigned', () => {
  const t = getData().tasks.find((x) => !x.historical && stageOf(x) === 'Created');
  expect(advanceTask(t.id).ok).toBe(false);
  const team = TEAMS.find((m) => m.stateCode === t.stateCode && teamFits(m, t.category)) || TEAMS.find((m) => m.stateCode === t.stateCode);
  expect(assignTask(t.id, team.id).ok).toBe(true);
  expect(stageOf(getData().tasks.find((x) => x.id === t.id))).toBe('Assigned');
});

test('over many ticks tasks keep moving and the response queue is replenished', () => {
  const open0 = getData().tasks.filter((t) => !t.historical && isOpenTask(t)).length;
  const start = Date.now();
  for (let i = 0; i < 60; i += 1) {
    dataStore.set((s) => ({ ...s, tasks: s.tasks.map((x) => (x.nextAt ? { ...x, nextAt: start - TIME.MIN } : x)) }));
    runTick();
  }
  const d = getData();
  const open1 = d.tasks.filter((t) => !t.historical && isOpenTask(t)).length;
  expect(open1).toBeGreaterThan(open0 * 0.7);
  expect(d.tasks.some((t) => t.status === 'Completed' && t.origin !== 'baseline' && t.stageLog.length >= 5)).toBe(true);
});
