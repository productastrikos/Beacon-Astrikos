import { dataStore, actor, addAudit, nextSeq, nowIso, resetData } from './dataStore';
import { can, PERMISSION_LABEL } from './permissions';
import { toastStore } from './uiStore';
import { stopAllTimers } from './simulation';
import {
  INCIDENT_TRANSITIONS, INCIDENT_REASON_REQUIRED, INCIDENT_ACTIVE_STATUSES, TASK_TRANSITIONS, SEVERITIES, ROLES,
} from '../types';
import { TIME } from '../utils/format';
import { TEAMS } from '../data/demo/people';
import { stageOf, nextStageOf, applyStage } from '../config/taskLifecycle';

/* ── helpers ─────────────────────────────────────────────────────────── */
const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (error) => ({ ok: false, error });

function guard(permission, entityType, entityId) {
  const a = actor();
  if (can(a.role, permission)) return null;
  dataStore.set((s) => addAudit(s, {
    action: `Attempted: ${PERMISSION_LABEL[permission] || permission}`, entityType, entityId, outcome: 'Denied',
    detail: `Role ${ROLES[a.role] || 'none'} lacks permission ${permission}`,
  }));
  const msg = `Not permitted for your role: ${PERMISSION_LABEL[permission] || permission}.`;
  toastStore.push({ kind: 'error', text: msg });
  return fail(msg);
}

const mapById = (list, id, fn) => list.map((x) => (x.id === id ? fn(x) : x));
const tlEntry = (s, id, type, text) => {
  const a = actor();
  const [n, s2] = nextSeq(s, 'NOTE');
  return [s2, { id: `${id}-t${n}`, at: nowIso(), by: a.name, type, text }];
};
const SEV_UP = (sev) => SEVERITIES[Math.min(SEVERITIES.indexOf(sev) + 1, SEVERITIES.length - 1)];

function find(list, id) { return list.find((x) => x.id === id); }

/* ── alerts ──────────────────────────────────────────────────────────── */
export function acknowledgeAlert(id, note = '') {
  const g = guard('alert.ack', 'Alert', id); if (g) return g;
  const s0 = dataStore.get();
  const al = find(s0.alerts, id);
  if (!al) return fail('Alert not found.');
  if (al.ackAt) return fail('Alert already acknowledged.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    alerts: mapById(s.alerts, id, (x) => ({
      ...x, ackBy: a.name, ackAt: nowIso(),
      notes: note ? [...x.notes, { id: `${id}-n${s.seq.NOTE}`, at: nowIso(), by: a.name, text: `Acknowledged: ${note}` }] : x.notes,
    })),
  }, { action: 'Alert acknowledged', entityType: 'Alert', entityId: id, previous: 'Unacknowledged', next: 'Acknowledged', detail: note }));
  toastStore.push({ kind: 'success', text: `Alert ${id} acknowledged.` });
  return ok();
}

export function addAlertNote(id, text) {
  const g = guard('alert.note', 'Alert', id); if (g) return g;
  if (!text.trim()) return fail('Note is empty.');
  const a = actor();
  dataStore.set((s) => {
    const [n, s2] = nextSeq(s, 'NOTE');
    return addAudit({
      ...s2,
      alerts: mapById(s2.alerts, id, (x) => ({ ...x, notes: [...x.notes, { id: `${id}-n${n}`, at: nowIso(), by: a.name, text: text.trim() }] })),
    }, { action: 'Alert note added', entityType: 'Alert', entityId: id, detail: text.trim() });
  });
  return ok();
}

export function linkAlertToIncident(alertId, incidentId) {
  const g = guard('alert.link', 'Alert', alertId); if (g) return g;
  const s0 = dataStore.get();
  const al0 = find(s0.alerts, alertId);
  const inc0 = find(s0.incidents, incidentId);
  if (!al0 || !inc0) return fail('Alert or incident not found.');
  if (al0.hazard !== inc0.hazard || al0.stateCode !== inc0.stateCode) return fail('An alert can only be linked to an incident for the same hazard in the same state.');
  dataStore.set((s) => {
    let s2 = {
      ...s,
      alerts: mapById(s.alerts, alertId, (x) => ({ ...x, linkedIncidentIds: [...new Set([...x.linkedIncidentIds, incidentId])] })),
      incidents: mapById(s.incidents, incidentId, (x) => ({ ...x, linkedAlertIds: [...new Set([...x.linkedAlertIds, alertId])], updatedAt: nowIso() })),
    };
    const [s3, entry] = tlEntry(s2, incidentId, 'link', `Alert ${alertId} linked`);
    s2 = { ...s3, incidents: mapById(s3.incidents, incidentId, (x) => ({ ...x, timeline: [...x.timeline, entry] })) };
    return addAudit(s2, { action: 'Alert linked to incident', entityType: 'Alert', entityId: alertId, next: incidentId });
  });
  toastStore.push({ kind: 'success', text: `${alertId} linked to ${incidentId}.` });
  return ok();
}

/* ── incidents ───────────────────────────────────────────────────────── */
export function createIncident(input, { fromAlertId = null, fromRecordId = null } = {}) {
  const g = guard('incident.create', 'Incident', 'new'); if (g) return g;
  if (!input.title?.trim()) return fail('Title is required.');
  if (!input.hazard) return fail('Hazard type is required.');
  if (!input.stateCode || !input.district) return fail('State and district are required.');
  let createdId = null;
  dataStore.set((s) => {
    const [n, s1] = nextSeq(s, 'INC');
    const id = `INC-${n}`;
    createdId = id;
    const now = nowIso();
    const a = actor();
    const inc = {
      id, title: input.title.trim(), hazard: input.hazard, description: input.description || '',
      stateCode: input.stateCode, district: input.district, location: input.location || input.district,
      linkedAlertIds: fromAlertId ? [fromAlertId] : [],
      provenance: fromAlertId ? `Created from alert ${fromAlertId}` : fromRecordId ? `Created from monitoring record ${fromRecordId}` : 'Operator-entered report',
      severity: input.severity || 'Moderate', verification: 'Unverified', status: 'Reported',
      assignedOperator: null, assignedTeam: null,
      createdAt: now, updatedAt: now,
      dueAt: input.dueHours ? new Date(Date.now() + Number(input.dueHours) * TIME.HOUR).toISOString() : null,
      taskIds: [], resourceIds: [], notes: [],
      timeline: [{ id: `${id}-t0`, at: now, by: a.name, type: 'created', text: 'Incident created' }],
      closureReason: null, origin: 'operator',
    };
    let s2 = { ...s1, incidents: [inc, ...s1.incidents] };
    if (fromAlertId) {
      s2 = { ...s2, alerts: mapById(s2.alerts, fromAlertId, (x) => ({ ...x, linkedIncidentIds: [...new Set([...x.linkedIncidentIds, id])] })) };
    }
    return addAudit(s2, { action: 'Incident created', entityType: 'Incident', entityId: id, next: 'Reported', detail: inc.provenance });
  });
  toastStore.push({ kind: 'success', text: `Incident ${createdId} created.` });
  return ok({ id: createdId });
}

export function transitionIncident(id, toStatus, reason = '') {
  const g = guard('incident.transition', 'Incident', id); if (g) return g;
  const inc = find(dataStore.get().incidents, id);
  if (!inc) return fail('Incident not found.');
  if (!(INCIDENT_TRANSITIONS[inc.status] || []).includes(toStatus)) return fail(`Invalid transition: ${inc.status} → ${toStatus}.`);
  if (INCIDENT_REASON_REQUIRED.includes(toStatus) && !reason.trim()) return fail(`A reason is required to move to ${toStatus}.`);
  const verification = {
    'Under Verification': 'Pending', Confirmed: 'Verified', Unconfirmed: 'Not Verified',
  }[toStatus];
  dataStore.set((s) => {
    const [s2, entry] = tlEntry(s, id, 'status', `Status: ${inc.status} → ${toStatus}${reason ? ` — ${reason.trim()}` : ''}`);
    return addAudit({
      ...s2,
      incidents: mapById(s2.incidents, id, (x) => ({
        ...x, status: toStatus, updatedAt: nowIso(),
        verification: verification || x.verification,
        closureReason: toStatus === 'Closed' ? reason.trim() : x.closureReason,
        timeline: [...x.timeline, entry],
      })),
    }, { action: 'Incident status changed', entityType: 'Incident', entityId: id, previous: inc.status, next: toStatus, detail: reason });
  });
  toastStore.push({ kind: 'success', text: `${id}: ${toStatus}.` });
  return ok();
}

export function updateIncident(id, patch) {
  const g = guard('incident.update', 'Incident', id); if (g) return g;
  const inc = find(dataStore.get().incidents, id);
  if (!inc) return fail('Incident not found.');
  const allowed = ['title', 'description', 'location', 'severity', 'dueAt'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  const changed = Object.keys(clean).filter((k) => clean[k] !== inc[k]);
  if (!changed.length) return ok();
  dataStore.set((s) => {
    const [s2, entry] = tlEntry(s, id, 'edit', `Edited: ${changed.join(', ')}`);
    return addAudit({
      ...s2,
      incidents: mapById(s2.incidents, id, (x) => ({ ...x, ...clean, updatedAt: nowIso(), timeline: [...x.timeline, entry] })),
    }, { action: 'Incident updated', entityType: 'Incident', entityId: id, previous: changed.map((k) => `${k}=${inc[k]}`).join('; '), next: changed.map((k) => `${k}=${clean[k]}`).join('; ') });
  });
  return ok();
}

export function assignIncident(id, { operator, team }) {
  const g = guard('incident.assign', 'Incident', id); if (g) return g;
  const inc = find(dataStore.get().incidents, id);
  if (!inc) return fail('Incident not found.');
  dataStore.set((s) => {
    const [s2, entry] = tlEntry(s, id, 'assign', `Assigned — operator: ${operator || 'none'}, team: ${team || 'none'}`);
    return addAudit({
      ...s2,
      incidents: mapById(s2.incidents, id, (x) => ({ ...x, assignedOperator: operator || null, assignedTeam: team || null, updatedAt: nowIso(), timeline: [...x.timeline, entry] })),
    }, { action: 'Incident assigned', entityType: 'Incident', entityId: id, previous: `${inc.assignedOperator || '—'} / ${inc.assignedTeam || '—'}`, next: `${operator || '—'} / ${team || '—'}` });
  });
  return ok();
}

export function escalateIncident(id, reason) {
  const g = guard('incident.escalate', 'Incident', id); if (g) return g;
  const inc = find(dataStore.get().incidents, id);
  if (!inc) return fail('Incident not found.');
  if (!reason?.trim()) return fail('A reason is required to escalate.');
  if (inc.severity === 'Critical') return fail('Incident is already at the highest severity.');
  const next = SEV_UP(inc.severity);
  dataStore.set((s) => {
    const [s2, entry] = tlEntry(s, id, 'escalate', `Escalated ${inc.severity} → ${next} — ${reason.trim()}`);
    return addAudit({
      ...s2,
      incidents: mapById(s2.incidents, id, (x) => ({ ...x, severity: next, updatedAt: nowIso(), timeline: [...x.timeline, entry] })),
    }, { action: 'Incident escalated', entityType: 'Incident', entityId: id, previous: inc.severity, next, detail: reason });
  });
  toastStore.push({ kind: 'warning', text: `${id} escalated to ${next}.` });
  return ok();
}

export function addIncidentNote(id, text, evidenceRef = '') {
  const g = guard('note.add', 'Incident', id); if (g) return g;
  if (!text.trim()) return fail('Note is empty.');
  const a = actor();
  dataStore.set((s) => {
    const [n, s1] = nextSeq(s, 'NOTE');
    const note = { id: `${id}-n${n}`, at: nowIso(), by: a.name, role: a.roleLabel, text: text.trim(), evidenceRef: evidenceRef.trim() || undefined };
    const [s2, entry] = tlEntry(s1, id, 'note', `Note added${evidenceRef ? ` (evidence: ${evidenceRef.trim()})` : ''}`);
    return addAudit({
      ...s2,
      incidents: mapById(s2.incidents, id, (x) => ({ ...x, notes: [...x.notes, note], updatedAt: nowIso(), timeline: [...x.timeline, entry] })),
    }, { action: 'Incident note added', entityType: 'Incident', entityId: id, detail: text.trim() });
  });
  return ok();
}

export function acknowledgeAttention(incidentId) {
  const g = guard('alert.ack', 'Incident', incidentId); if (g) return g;
  const inc = find(dataStore.get().incidents, incidentId);
  if (!inc) return fail('Incident not found.');
  if (inc.attentionAck) return fail('Already acknowledged.');
  const a = actor();
  dataStore.set((s) => {
    const [s2, entry] = tlEntry(s, incidentId, 'ack', 'Acknowledged from the attention list');
    return addAudit({
      ...s2,
      incidents: mapById(s2.incidents, incidentId, (x) => ({ ...x, attentionAck: { by: a.name, at: nowIso() }, timeline: [...x.timeline, entry] })),
    }, { action: 'Attention item acknowledged', entityType: 'Incident', entityId: incidentId });
  });
  return ok();
}

/* ── tasks ───────────────────────────────────────────────────────────── */
export function createTask(input) {
  const g = guard('task.create', 'Task', 'new'); if (g) return g;
  if (!input.category) return fail('Task category is required.');
  if (!input.location?.trim()) return fail('Location description is required.');
  let createdId = null;
  dataStore.set((s) => {
    const [n, s1] = nextSeq(s, 'TSK');
    const id = `TSK-${n}`;
    createdId = id;
    const a = actor();
    const now = nowIso();
    const inc = input.incidentId ? find(s1.incidents, input.incidentId) : null;
    const task = {
      id, incidentId: input.incidentId || null, category: input.category, location: input.location.trim(),
      stateCode: inc ? inc.stateCode : input.stateCode || 'AR',
      priority: input.priority || 'Medium',
      assignee: input.assignee || null,
      status: input.assignee ? 'Assigned' : 'Unassigned', stage: input.assignee ? 'Assigned' : 'Created', nextAt: null,
      stageLog: [{ stage: 'Created', at: now, by: a.name }, ...(input.assignee ? [{ stage: 'Assigned', at: now, by: a.name }] : [])],
      createdAt: now,
      dueAt: input.dueHours ? new Date(Date.now() + Number(input.dueHours) * TIME.HOUR).toISOString() : null,
      instructions: input.instructions || '', completionNotes: '', evidenceRefs: [],
      history: [{ id: `${id}-h0`, at: now, by: a.name, text: input.assignee ? `Task created and assigned to ${input.assignee}` : 'Task created' }],
      origin: 'operator',
    };
    let s2 = { ...s1, tasks: [task, ...s1.tasks] };
    if (inc) s2 = { ...s2, incidents: mapById(s2.incidents, inc.id, (x) => ({ ...x, taskIds: [...x.taskIds, id], updatedAt: now })) };
    return addAudit(s2, { action: 'Task created', entityType: 'Task', entityId: id, next: task.status, detail: `${task.category} — ${task.location}` });
  });
  toastStore.push({ kind: 'success', text: `Task ${createdId} created.` });
  return ok({ id: createdId });
}

/** Resolves an incident automatically once every one of its response tasks is completed. */
function autoResolve(s, incidentId, by) {
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc || !INCIDENT_ACTIVE_STATUSES.includes(inc.status)) return s;
  const its = s.tasks.filter((t) => t.incidentId === incidentId && !t.historical);
  if (!its.length || !its.every((t) => ['Completed', 'Cancelled'].includes(t.status)) || !its.some((t) => t.status === 'Completed')) return s;
  const at = nowIso();
  return addAudit({
    ...s,
    incidents: mapById(s.incidents, incidentId, (x) => ({
      ...x, status: 'Resolved', updatedAt: at,
      timeline: [...x.timeline, { id: `${x.id}-t${x.timeline.length}`, at, by, type: 'status', text: `Status: ${x.status} → Resolved (all response tasks completed)` }],
    })),
  }, { action: 'Incident status changed', entityType: 'Incident', entityId: incidentId, previous: inc.status, next: 'Resolved', detail: 'All response tasks completed' });
}

export function assignTask(id, teamId) {
  const g = guard('task.assign', 'Task', id); if (g) return g;
  const t = find(dataStore.get().tasks, id);
  if (!t) return fail('Task not found.');
  if (['Completed', 'Cancelled'].includes(t.status)) return fail('Closed tasks cannot be reassigned.');
  const a = actor();
  const team = TEAMS.find((m) => m.id === teamId);
  const teamName = team ? team.name : teamId;
  dataStore.set((s) => addAudit({
    ...s,
    tasks: mapById(s.tasks, id, (x) => {
      const at = nowIso();
      if (!teamId) {
        return {
          ...x, assignee: null, stage: 'Created', status: 'Unassigned', nextAt: null,
          stageLog: [...(x.stageLog || []), { stage: 'Created', at, by: a.name }],
          history: [...x.history, { id: `${id}-h${x.history.length}`, at, by: a.name, text: 'Unassigned' }],
        };
      }
      if (stageOf(x) === 'Created') return { ...applyStage(x, 'Assigned', { at, by: a.name, teamName }), assignee: teamId };
      return { ...x, assignee: teamId, nextAt: null, history: [...x.history, { id: `${id}-h${x.history.length}`, at, by: a.name, text: `Reassigned — ${teamName}` }] };
    }),
  }, { action: t.assignee ? 'Task reassigned' : 'Task assigned', entityType: 'Task', entityId: id, previous: t.assignee || 'Unassigned', next: teamId || 'Unassigned' }));
  return ok();
}

/** Operator moves a task to its next lifecycle stage. Findings can carry notes; verifying completes the task. */
export function advanceTask(id, notes = '') {
  const t = find(dataStore.get().tasks, id);
  if (!t) return fail('Task not found.');
  const stage = stageOf(t);
  const to = nextStageOf(stage);
  if (!to) return fail('This task is already complete.');
  const g = guard(to === 'Verified' ? 'task.complete' : 'task.update', 'Task', id); if (g) return g;
  if (stage === 'Created' && !t.assignee) return fail('Assign a team before advancing the task.');
  const a = actor();
  const team = TEAMS.find((m) => m.id === t.assignee);
  const teamName = team ? team.name : undefined;
  dataStore.set((s) => {
    const at = nowIso();
    let s2 = {
      ...s,
      tasks: mapById(s.tasks, id, (x) => {
        let n = applyStage(x, to, { at, by: a.name, teamName, note: to === 'Findings submitted' && notes.trim() ? notes.trim() : undefined });
        if (to === 'Findings submitted' && notes.trim()) n = { ...n, completionNotes: notes.trim() };
        if (to === 'Verified') n = applyStage(n, 'Completed', { at, by: a.name });
        return n;
      }),
    };
    s2 = addAudit(s2, { action: 'Task stage changed', entityType: 'Task', entityId: id, previous: stage, next: to === 'Verified' ? 'Completed' : to, detail: notes });
    return autoResolve(s2, t.incidentId, a.name);
  });
  toastStore.push({ kind: 'success', text: `${id}: ${to === 'Verified' ? 'Verified and completed' : to}.` });
  return ok();
}

export function transitionTask(id, toStatus, notes = '') {
  const t = find(dataStore.get().tasks, id);
  if (!t) return fail('Task not found.');
  const perm = toStatus === 'Completed' ? 'task.complete' : 'task.update';
  const g = guard(perm, 'Task', id); if (g) return g;
  if (!(TASK_TRANSITIONS[t.status] || []).includes(toStatus)) return fail(`Invalid transition: ${t.status} → ${toStatus}.`);
  if (['Awaiting Verification', 'Completed'].includes(toStatus) && !notes.trim() && !t.completionNotes) return fail('Completion notes are required.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    tasks: mapById(s.tasks, id, (x) => ({
      ...x, status: toStatus, nextAt: null,
      stage: ({ Unassigned: 'Created', Assigned: 'Assigned', 'In Progress': 'En route', 'Awaiting Verification': 'Findings submitted', Completed: 'Completed' })[toStatus] || x.stage,
      stageLog: [...(x.stageLog || []), { stage: toStatus === 'Cancelled' ? 'Cancelled' : toStatus, at: nowIso(), by: a.name }],
      completionNotes: notes.trim() ? notes.trim() : x.completionNotes,
      completedAt: toStatus === 'Completed' ? nowIso() : x.completedAt,
      history: [...x.history, { id: `${id}-h${x.history.length}`, at: nowIso(), by: a.name, text: `Status: ${t.status} → ${toStatus}${notes.trim() ? ` — ${notes.trim()}` : ''}` }],
    })),
  }, { action: 'Task status changed', entityType: 'Task', entityId: id, previous: t.status, next: toStatus, detail: notes }));
  if (toStatus === 'Completed') dataStore.set((s) => autoResolve(s, t.incidentId, a.name));
  toastStore.push({ kind: 'success', text: `${id}: ${toStatus}.` });
  return ok();
}

export function escalateTask(id, reason) {
  const g = guard('task.escalate', 'Task', id); if (g) return g;
  const t = find(dataStore.get().tasks, id);
  if (!t) return fail('Task not found.');
  if (!reason?.trim()) return fail('A reason is required to escalate.');
  const order = ['Low', 'Medium', 'High', 'Urgent'];
  const next = order[Math.min(order.indexOf(t.priority) + 1, order.length - 1)];
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    tasks: mapById(s.tasks, id, (x) => ({
      ...x, priority: next, escalated: true,
      history: [...x.history, { id: `${id}-h${x.history.length}`, at: nowIso(), by: a.name, text: `Escalated ${t.priority} → ${next} — ${reason.trim()}` }],
    })),
  }, { action: 'Task escalated', entityType: 'Task', entityId: id, previous: t.priority, next, detail: reason }));
  toastStore.push({ kind: 'warning', text: `${id} escalated to ${next} priority.` });
  return ok();
}

export function addTaskEvidence(id, ref) {
  const g = guard('task.update', 'Task', id); if (g) return g;
  if (!ref.trim()) return fail('Evidence reference is empty.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    tasks: mapById(s.tasks, id, (x) => ({
      ...x, evidenceRefs: [...x.evidenceRefs, ref.trim()],
      history: [...x.history, { id: `${id}-h${x.history.length}`, at: nowIso(), by: a.name, text: `Evidence reference added: ${ref.trim()}` }],
    })),
  }, { action: 'Task evidence added', entityType: 'Task', entityId: id, detail: ref.trim() }));
  return ok();
}

export function bulkAssignTasks(ids, teamId) {
  let n = 0;
  ids.forEach((id) => { if (assignTask(id, teamId).ok) n += 1; });
  return n;
}

/* ── resources ───────────────────────────────────────────────────────── */
export function assignResource(resourceId, incidentId) {
  const g = guard('resource.assign', 'Resource', resourceId); if (g) return g;
  const s0 = dataStore.get();
  const r = find(s0.resources, resourceId);
  if (!r) return fail('Resource not found.');
  if (!find(s0.incidents, incidentId)) return fail('Select an incident.');
  const a = actor();
  dataStore.set((s) => {
    let s2 = {
      ...s,
      resources: mapById(s.resources, resourceId, (x) => ({
        ...x, assignedIncident: incidentId, availability: 'Allocated', updatedAt: nowIso(),
        history: [...x.history, { id: `${resourceId}-h${x.history.length}`, at: nowIso(), by: a.name, text: `Assigned to ${incidentId}` }],
      })),
      incidents: mapById(s.incidents, incidentId, (x) => ({ ...x, resourceIds: [...new Set([...x.resourceIds, resourceId])], updatedAt: nowIso() })),
    };
    if (r.assignedIncident && r.assignedIncident !== incidentId) {
      s2 = { ...s2, incidents: mapById(s2.incidents, r.assignedIncident, (x) => ({ ...x, resourceIds: x.resourceIds.filter((i) => i !== resourceId) })) };
    }
    return addAudit(s2, { action: 'Resource assigned', entityType: 'Resource', entityId: resourceId, previous: r.assignedIncident || 'Unassigned', next: incidentId });
  });
  toastStore.push({ kind: 'success', text: `${resourceId} assigned to ${incidentId}.` });
  return ok();
}

export function releaseResource(resourceId) {
  const g = guard('resource.assign', 'Resource', resourceId); if (g) return g;
  const r = find(dataStore.get().resources, resourceId);
  if (!r || !r.assignedIncident) return fail('Resource is not assigned.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    resources: mapById(s.resources, resourceId, (x) => ({
      ...x, assignedIncident: null, availability: x.category === 'road' ? x.availability : 'Available', updatedAt: nowIso(),
      history: [...x.history, { id: `${resourceId}-h${x.history.length}`, at: nowIso(), by: a.name, text: `Released from ${r.assignedIncident}` }],
    })),
    incidents: mapById(s.incidents, r.assignedIncident, (x) => ({ ...x, resourceIds: x.resourceIds.filter((i) => i !== resourceId) })),
  }, { action: 'Resource released', entityType: 'Resource', entityId: resourceId, previous: r.assignedIncident, next: 'Unassigned' }));
  return ok();
}

export function setRoadStatus(resourceId, roadStatus) {
  const g = guard('resource.assign', 'Resource', resourceId); if (g) return g;
  const r = find(dataStore.get().resources, resourceId);
  if (!r) return fail('Road record not found.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    resources: mapById(s.resources, resourceId, (x) => ({
      ...x, roadStatus, availability: roadStatus === 'Needs verification' ? 'Needs verification' : (roadStatus === 'Open' ? 'Available' : x.availability), updatedAt: nowIso(),
      history: [...x.history, { id: `${resourceId}-h${x.history.length}`, at: nowIso(), by: a.name, text: `Road status: ${r.roadStatus} → ${roadStatus}` }],
    })),
  }, { action: 'Road status changed', entityType: 'Resource', entityId: resourceId, previous: r.roadStatus, next: roadStatus }));
  return ok();
}

/* ── hazard records ──────────────────────────────────────────────────── */
export function verifyRecord(recordId, verification, note = '') {
  const g = guard('hazard.verify', 'Record', recordId); if (g) return g;
  const r = find(dataStore.get().records, recordId);
  if (!r) return fail('Record not found.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    records: mapById(s.records, recordId, (x) => ({
      ...x, verification,
      notes: [...(x.notes || []), { id: `${recordId}-n${(x.notes || []).length}`, at: nowIso(), by: a.name, text: `Verification set to ${verification}${note ? ` — ${note}` : ''}` }],
    })),
  }, { action: 'Record verification changed', entityType: 'Record', entityId: recordId, previous: r.verification, next: verification, detail: note }));
  toastStore.push({ kind: 'success', text: `${recordId}: ${verification}.` });
  return ok();
}

export function addRecordNote(recordId, text) {
  const g = guard('note.add', 'Record', recordId); if (g) return g;
  if (!text.trim()) return fail('Note is empty.');
  const a = actor();
  dataStore.set((s) => addAudit({
    ...s,
    records: mapById(s.records, recordId, (x) => ({ ...x, notes: [...(x.notes || []), { id: `${recordId}-n${(x.notes || []).length}`, at: nowIso(), by: a.name, text: text.trim() }] })),
  }, { action: 'Record note added', entityType: 'Record', entityId: recordId, detail: text.trim() }));
  return ok();
}

/* ── administration ──────────────────────────────────────────────────── */
export function setHazardEnabled(key, enabled) {
  const g = guard('admin.manage', 'Settings', `hazard:${key}`); if (g) return g;
  dataStore.set((s) => addAudit({
    ...s, settings: { ...s.settings, hazardsEnabled: { ...s.settings.hazardsEnabled, [key]: enabled } },
  }, { action: 'Hazard module configuration changed', entityType: 'Settings', entityId: `hazard:${key}`, next: enabled ? 'Enabled' : 'Disabled' }));
  return ok();
}

export function setSimInterval(seconds) {
  const g = guard('admin.manage', 'Settings', 'simStepSeconds'); if (g) return g;
  const v = Math.max(1, Math.min(30, Number(seconds) || 3));
  dataStore.set((s) => addAudit({ ...s, settings: { ...s.settings, simStepSeconds: v } },
    { action: 'Simulation setting changed', entityType: 'Settings', entityId: 'simStepSeconds', next: `${v} s` }));
  return ok();
}

export function resetDemoData() {
  const g = guard('demo.reset', 'Settings', 'demo-data'); if (g) return g;
  stopAllTimers();
  resetData();
  dataStore.set((s) => addAudit(s, { action: 'Data reset to baseline', entityType: 'Settings', entityId: 'data-reset' }));
  toastStore.push({ kind: 'success', text: 'Data reset to baseline.' });
  return ok();
}
