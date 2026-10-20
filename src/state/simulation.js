import { dataStore, actor, addAudit, nowIso, getData } from './dataStore';
import { can } from './permissions';
import { toastStore } from './uiStore';
import { SCENARIO_BY_ID } from '../data/demo/scenarios';
import { TIME } from '../utils/format';

/**
 * Scenario engine. Steps are declarative ops applied to the shared data store,
 * so KPIs, registers, tasks and the audit trail all stay in sync. Every
 * created entity is tracked per run so reset can remove exactly those, and
 * restore only the fields the scenario modified on baseline records.
 */

const emptyRun = () => ({
  status: 'idle', stepIndex: 0, startedAt: null, completedAt: null,
  created: { incidents: [], alerts: [], tasks: [], records: [], flags: [] },
  modified: { incidents: {}, alerts: {}, tasks: {}, resources: {} },
  log: [],
});

const SIM_ACTOR = { userId: 'sim-engine', userName: 'System', roleLabel: '—', source: 'simulation' };
const byId = (list, id) => list.find((x) => x.id === id);

/** Records previous values of fields about to be patched (first capture wins). */
function captureModified(run, kind, entity, patch) {
  const bucket = run.modified[kind];
  if (run.created[kind]?.includes(entity.id)) return; // created by this run → removed on reset
  const prev = bucket[entity.id] || {};
  // Bookkeeping fields the engine also touches (timeline / history / updatedAt).
  const bookkeeping = { incidents: ['updatedAt', 'timeline'], resources: ['updatedAt', 'history'], tasks: ['history'] }[kind] || [];
  [...Object.keys(patch), ...bookkeeping].forEach((k) => { if (!(k in prev)) prev[k] = entity[k]; });
  bucket[entity.id] = prev;
}

function applyOp(s, run, scenario, op, now) {
  const runId = scenario.id;
  const audit = (st, e) => addAudit(st, { ...SIM_ACTOR, simRunId: runId, ...e });
  const nowMs = new Date(now).getTime();

  switch (op.op) {
    case 'record': {
      const r = { ...op.record, notes: [], series: op.record.series || [], extra: op.record.extra || {},
        sourceTimestamp: now, origin: 'simulation', simRunId: runId };
      run.created.records.push(r.id);
      return audit({ ...s, records: [r, ...s.records] }, { action: 'Record ingested', entityType: 'Record', entityId: r.id, next: r.classification, detail: r.location });
    }
    case 'flag': {
      const f = { ...op.flag, createdAt: now, state: 'Open', origin: 'simulation', simRunId: runId };
      run.created.flags.push(f.id);
      return audit({ ...s, flags: [f, ...s.flags] }, { action: 'Monitoring flag raised', entityType: 'MonitoringFlag', entityId: f.id, next: f.ruleId, detail: f.text });
    }
    case 'alert': {
      const d = op.alert;
      const a = {
        ...d, identifier: `BEACON.SIM.${d.id}`, sent: now, effective: now,
        expires: new Date(nowMs + (d.expiresInMin || 720) * TIME.MIN).toISOString(),
        description: `${d.headline}.`,
        classification: 'Official', cancelled: false, ackBy: null, ackAt: null, linkedIncidentIds: [], notes: [],
        history: [{ at: now, msgType: 'Alert', note: `Issued by scenario ${runId}` }],
        origin: 'simulation', simRunId: runId,
      };
      delete a.expiresInMin;
      run.created.alerts.push(a.id);
      return audit({ ...s, alerts: [a, ...s.alerts] }, { action: 'Warning issued', entityType: 'Alert', entityId: a.id, next: a.severity, detail: a.headline });
    }
    case 'incident': {
      const d = op.incident;
      const inc = {
        id: d.id, title: d.title, hazard: d.hazard, description: d.description, stateCode: d.stateCode, district: d.district, location: d.location,
        linkedAlertIds: d.linkedAlertIds || [], provenance: d.provenance, severity: d.severity, verification: d.verification, status: d.status,
        assignedOperator: null, assignedTeam: null, createdAt: now, updatedAt: now,
        dueAt: d.dueInMin ? new Date(nowMs + d.dueInMin * TIME.MIN).toISOString() : null,
        taskIds: [], resourceIds: [], notes: [],
        timeline: [{ id: `${d.id}-t0`, at: now, by: 'System', type: 'created', text: `Incident created — ${d.provenance}` }],
        closureReason: null, origin: 'simulation', simRunId: runId,
      };
      run.created.incidents.push(inc.id);
      return audit({ ...s, incidents: [inc, ...s.incidents] }, { action: 'Incident created', entityType: 'Incident', entityId: inc.id, next: inc.status, detail: inc.provenance });
    }
    case 'incidentPatch': {
      const inc = byId(s.incidents, op.id);
      if (!inc) return s;
      captureModified(run, 'incidents', inc, op.patch);
      const prevStatus = inc.status;
      const next = {
        ...inc, ...op.patch, updatedAt: now,
        timeline: [...inc.timeline, { id: `${inc.id}-t${inc.timeline.length}`, at: now, by: 'System', type: 'status', text: op.text || `Updated: ${Object.keys(op.patch).join(', ')}` }],
      };
      return audit({ ...s, incidents: s.incidents.map((x) => (x.id === inc.id ? next : x)) },
        { action: op.patch.status ? 'Incident status changed' : 'Incident updated', entityType: 'Incident', entityId: inc.id,
          previous: op.patch.status ? prevStatus : null, next: op.patch.status || Object.keys(op.patch).join(', '), detail: op.text });
    }
    case 'task': {
      const d = op.task;
      const t = {
        id: d.id, incidentId: d.incidentId, category: d.category, location: d.location, stateCode: d.stateCode, priority: d.priority,
        assignee: null, status: 'Unassigned', createdAt: now, dueAt: d.dueInMin ? new Date(nowMs + d.dueInMin * TIME.MIN).toISOString() : null,
        instructions: d.instructions, completionNotes: '', evidenceRefs: [],
        history: [{ id: `${d.id}-h0`, at: now, by: 'System', text: 'Task created' }],
        origin: 'simulation', simRunId: runId,
      };
      run.created.tasks.push(t.id);
      const incidents = s.incidents.map((x) => (x.id === d.incidentId ? { ...x, taskIds: [...x.taskIds, t.id], updatedAt: now } : x));
      return audit({ ...s, tasks: [t, ...s.tasks], incidents }, { action: 'Task created', entityType: 'Task', entityId: t.id, next: 'Unassigned', detail: `${t.category} — ${t.location}` });
    }
    case 'assign': {
      const t = byId(s.tasks, op.taskId);
      if (!t) return s;
      captureModified(run, 'tasks', t, { assignee: 0, status: 0 });
      const next = { ...t, assignee: op.teamId, status: 'Assigned', history: [...t.history, { id: `${t.id}-h${t.history.length}`, at: now, by: 'System', text: `Assigned to ${op.teamId}` }] };
      return audit({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? next : x)) }, { action: 'Task assigned', entityType: 'Task', entityId: t.id, previous: 'Unassigned', next: op.teamId });
    }
    case 'taskPatch': {
      const t = byId(s.tasks, op.id);
      if (!t) return s;
      captureModified(run, 'tasks', t, op.patch);
      const next = { ...t, ...op.patch, history: [...t.history, { id: `${t.id}-h${t.history.length}`, at: now, by: 'System', text: op.text || 'Updated' }] };
      return audit({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? next : x)) },
        { action: 'Task status changed', entityType: 'Task', entityId: t.id, previous: t.status, next: op.patch.status || 'updated', detail: op.text });
    }
    case 'link': {
      const alerts = s.alerts.map((x) => (x.id === op.alertId ? { ...x, linkedIncidentIds: [...new Set([...x.linkedIncidentIds, op.incidentId])] } : x));
      const incidents = s.incidents.map((x) => (x.id === op.incidentId ? { ...x, linkedAlertIds: [...new Set([...x.linkedAlertIds, op.alertId])] } : x));
      return audit({ ...s, alerts, incidents }, { action: 'Alert linked to incident', entityType: 'Alert', entityId: op.alertId, next: op.incidentId });
    }
    case 'resourcePatch': {
      const r = byId(s.resources, op.id);
      if (!r) return s;
      captureModified(run, 'resources', r, { ...op.patch, ...(op.patch.roadStatus ? {} : {}) });
      const next = { ...r, ...op.patch, updatedAt: now, history: [...r.history, { id: `${r.id}-h${r.history.length}`, at: now, by: 'System', text: op.text || 'Updated' }] };
      let incidents = s.incidents;
      if (op.linkIncident) incidents = incidents.map((x) => (x.id === op.linkIncident ? { ...x, resourceIds: [...new Set([...x.resourceIds, r.id])] } : x));
      return audit({ ...s, resources: s.resources.map((x) => (x.id === r.id ? next : x)), incidents },
        { action: 'Resource record updated', entityType: 'Resource', entityId: r.id, previous: r.roadStatus || r.availability, next: op.patch.roadStatus || op.patch.availability, detail: op.text });
    }
    default:
      return s;
  }
}

/** Executes the next step of a scenario against the store. Returns the step run, or null. */
function executeNext(scenarioId) {
  const scenario = SCENARIO_BY_ID[scenarioId];
  const cur = getData().simRuns[scenarioId];
  if (!scenario || !cur || cur.stepIndex >= scenario.steps.length) return null;
  const step = scenario.steps[cur.stepIndex];
  const now = nowIso();
  dataStore.set((s) => {
    const run = JSON.parse(JSON.stringify(s.simRuns[scenarioId]));
    let st = s;
    step.ops.forEach((op) => { st = applyOp(st, run, scenario, op, now); });
    run.stepIndex += 1;
    run.log.push({ stepId: step.id, at: now, title: step.title, offset: step.offset });
    const done = run.stepIndex >= scenario.steps.length;
    if (done) { run.status = 'completed'; run.completedAt = now; }
    st = addAudit(st, { ...SIM_ACTOR, simRunId: scenarioId, action: done ? 'Scenario completed' : 'Scenario step executed', entityType: 'Scenario', entityId: scenarioId, next: `${step.offset} — ${step.title}` });
    return { ...st, simRuns: { ...st.simRuns, [scenarioId]: run } };
  });
  return step;
}

/* ── timers (module-level, not persisted) ────────────────────────────── */
const timers = {};
function clearTimer(id) { if (timers[id]) { clearInterval(timers[id]); delete timers[id]; } }
export function stopAllTimers() { Object.keys(timers).forEach(clearTimer); }

function startTimer(id) {
  clearTimer(id);
  const seconds = getData().settings.simStepSeconds || 3;
  timers[id] = setInterval(() => {
    const run = getData().simRuns[id];
    if (!run || run.status !== 'running') { clearTimer(id); return; }
    executeNext(id);
    const after = getData().simRuns[id];
    if (!after || after.status !== 'running') clearTimer(id);
  }, seconds * 1000);
}

function guardSim(id) {
  const a = actor();
  if (can(a.role, 'sim.run')) return null;
  const msg = 'Not permitted for your role: Run simulations.';
  dataStore.set((s) => addAudit(s, { action: 'Attempted: Run simulations', entityType: 'Scenario', entityId: id, outcome: 'Denied' }));
  toastStore.push({ kind: 'error', text: msg });
  return { ok: false, error: msg };
}

const runOf = (id) => getData().simRuns[id];
const setRun = (id, run, auditEntry) => dataStore.set((s) => {
  const st = { ...s, simRuns: { ...s.simRuns, [id]: run } };
  return auditEntry ? addAudit(st, auditEntry) : st;
});

export function startScenario(id) {
  const g = guardSim(id); if (g) return g;
  const existing = runOf(id);
  if (existing && existing.status !== 'idle') return { ok: false, error: 'Scenario already started. Reset it first, or use Replay.' };
  setRun(id, { ...emptyRun(), status: 'running', startedAt: nowIso() },
    { action: 'Scenario started', entityType: 'Scenario', entityId: id, detail: SCENARIO_BY_ID[id].name });
  executeNext(id);
  if (runOf(id).status === 'running') startTimer(id);
  return { ok: true };
}

export function pauseScenario(id) {
  const g = guardSim(id); if (g) return g;
  const r = runOf(id);
  if (!r || r.status !== 'running') return { ok: false, error: 'Scenario is not running.' };
  clearTimer(id);
  setRun(id, { ...r, status: 'paused' }, { action: 'Scenario paused', entityType: 'Scenario', entityId: id });
  return { ok: true };
}

export function resumeScenario(id) {
  const g = guardSim(id); if (g) return g;
  const r = runOf(id);
  if (!r || r.status !== 'paused') return { ok: false, error: 'Scenario is not paused.' };
  setRun(id, { ...r, status: 'running' }, { action: 'Scenario resumed', entityType: 'Scenario', entityId: id });
  startTimer(id);
  return { ok: true };
}

/** Step manually. Starts the scenario in paused mode if it has not started. */
export function stepScenario(id) {
  const g = guardSim(id); if (g) return g;
  let r = runOf(id);
  if (!r || r.status === 'idle') {
    setRun(id, { ...emptyRun(), status: 'paused', startedAt: nowIso() },
      { action: 'Scenario started (manual stepping)', entityType: 'Scenario', entityId: id, detail: SCENARIO_BY_ID[id].name });
    r = runOf(id);
  }
  if (r.status === 'completed') return { ok: false, error: 'Scenario already completed.' };
  if (r.status === 'running') { clearTimer(id); setRun(id, { ...r, status: 'paused' }); }
  executeNext(id);
  return { ok: true };
}

export function resetScenario(id, { silent = false } = {}) {
  const g = guardSim(id); if (g) return g;
  clearTimer(id);
  const r = runOf(id);
  if (!r) return { ok: true };
  dataStore.set((s) => {
    const c = r.created;
    const removed = new Set([...c.incidents, ...c.alerts, ...c.tasks, ...c.records, ...c.flags]);
    const restore = (list, mod) => list.map((x) => (mod[x.id] ? { ...x, ...mod[x.id] } : x));
    const incidents = restore(s.incidents.filter((x) => !c.incidents.includes(x.id)), r.modified.incidents)
      .map((x) => ({ ...x, linkedAlertIds: x.linkedAlertIds.filter((a) => !removed.has(a)), taskIds: x.taskIds.filter((t) => !removed.has(t)) }));
    const alerts = restore(s.alerts.filter((x) => !c.alerts.includes(x.id)), r.modified.alerts)
      .map((x) => ({ ...x, linkedIncidentIds: x.linkedIncidentIds.filter((i) => !removed.has(i)) }));
    const tasks = restore(s.tasks.filter((x) => !c.tasks.includes(x.id)), r.modified.tasks);
    let resources = restore(s.resources, r.modified.resources);
    // A baseline resource may have been assigned to a removed incident by an operator.
    resources = resources.map((x) => (x.assignedIncident && removed.has(x.assignedIncident)
      ? { ...x, assignedIncident: null, availability: x.category === 'road' ? x.availability : 'Available' } : x));
    const incidentsClean = incidents.map((x) => ({ ...x, resourceIds: x.resourceIds.filter((rid) => resources.find((q) => q.id === rid && q.assignedIncident === x.id)) }));
    let st = {
      ...s,
      incidents: incidentsClean, alerts, tasks, resources,
      records: s.records.filter((x) => !c.records.includes(x.id)),
      flags: s.flags.filter((x) => !c.flags.includes(x.id)),
      audit: s.audit.filter((e) => e.simRunId !== id),
      simRuns: { ...s.simRuns, [id]: emptyRun() },
    };
    if (!silent) st = addAudit(st, { action: 'Scenario reset to baseline', entityType: 'Scenario', entityId: id, detail: `${removed.size} scenario records removed` });
    return st;
  });
  if (!silent) toastStore.push({ kind: 'success', text: `Scenario ${id} reset to baseline.` });
  return { ok: true };
}

export function replayScenario(id) {
  const g = guardSim(id); if (g) return g;
  resetScenario(id, { silent: true });
  return startScenario(id);
}
