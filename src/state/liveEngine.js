import { dataStore, addAudit, nowIso } from './dataStore';
import { logEvents, touchTick } from './liveStore';
import { toastStore } from './uiStore';
import { SIM } from '../config/simulationConfig';
import { STATE_NAME, STATE_HAZARDS } from '../data/demo/geography';
import { SEVERITIES, INCIDENT_ACTIVE_STATUSES, TASK_OPEN_STATUSES, HAZARD_LABEL, HAZARD_KEYS } from '../types';
import { isEligible } from '../config/hazardRegions';
import { stageOf, nextStageOf, applyStage, waitMs, teamFor, STAGE_MINUTES, TIME_SCALE } from '../config/taskLifecycle';
import { TEAMS } from '../data/demo/people';
import { makeIncident, makeWarning, makeIncidentTasks } from '../data/demo/factories';
import { stepRecord, classify } from '../data/demo/stationModel';
import { ensureCoverage, refreshStale } from '../data/demo/coverage';
import { TIME } from '../utils/format';

/**
 * Applies a live tick to the shared dataStore: every station gets a fresh reading at least once a minute (random walk with
 * mean reversion), readings that cross a threshold raise a flag -> warning -> incident -> task, 1-3 weighted lifecycle
 * events progress incidents / warnings / tasks / sources, and the coverage guard keeps every hazard x state populated.
 * Every KPI, chart and table is derived from that store. Records created by scenario replays (origin 'simulation') are never modified.
 */
const rng = {
  next: Math.random,
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  weighted: (items) => {
    let r = Math.random() * items.reduce((s, i) => s + i.w, 0);
    for (const i of items) { r -= i.w; if (r <= 0) return i.v; }
    return items[items.length - 1].v;
  },
};
const weightedKey = (map) => rng.weighted(Object.entries(map).map(([v, w]) => ({ v, w })));
const PFX = { INC: 'INC-', ALT: 'A-', TSK: 'TSK-' };

const SYS = { userId: 'live-engine', userName: 'Live feed', roleLabel: '—', source: 'integration' };
const audit = (s, e) => addAudit(s, { ...SYS, ...e });
const sevIdx = (v) => SEVERITIES.indexOf(v);
const mine = (x) => x.origin !== 'simulation' && !x.historical;
const patchIncident = (s, id, fn) => ({ ...s, incidents: s.incidents.map((x) => (x.id === id ? fn(x) : x)) });
const tl = (inc, text) => ({ id: `${inc.id}-t${inc.timeline.length}`, at: nowIso(), by: 'Live feed', type: 'status', text });
const pickOf = (list) => (list.length ? rng.pick(list) : null);

const HANDLERS = {
  newIncident(s, c) {
    if (s.incidents.filter((i) => i.origin === 'live').length >= SIM.maxLiveIncidents) return null;
    const stateCode = rng.pick(Object.keys(STATE_HAZARDS));
    const hazard = rng.pick(HAZARD_KEYS.filter((h) => isEligible(h, stateCode)));
    const inc = makeIncident(rng, c.alloc, { stateCode, hazard, now: c.now, severity: rng.weighted(Object.entries(SIM.severityWeights).map(([v, w]) => ({ v, w }))) });
    const made = makeIncidentTasks(rng, c.alloc, inc, { now: c.now, teams: TEAMS.filter((m) => m.stateCode === stateCode), ageMin: 1, fresh: true });
    return {
      s: audit({ ...s, incidents: [inc, ...s.incidents], tasks: [...made, ...s.tasks] }, { action: 'Incident created', entityType: 'Incident', entityId: inc.id, next: 'Reported', detail: inc.title }),
      ev: { kind: 'incident', title: inc.severity === 'Critical' ? 'New Critical incident' : `New ${inc.severity} incident`, detail: `${inc.title}, ${STATE_NAME[stateCode]}`, tone: inc.severity === 'Critical' ? 'critical' : 'info', notable: inc.severity === 'Critical', to: `/incidents/${inc.id}` },
    };
  },
  escalate(s) {
    const inc = pickOf(s.incidents.filter((i) => mine(i) && INCIDENT_ACTIVE_STATUSES.includes(i.status)));
    if (!inc) return null;
    const up = Math.random() < 0.6;
    const next = SEVERITIES[Math.max(0, Math.min(3, sevIdx(inc.severity) + (up ? 1 : -1)))];
    if (next === inc.severity) return null;
    return {
      s: audit(patchIncident(s, inc.id, (x) => ({ ...x, severity: next, updatedAt: nowIso(), timeline: [...x.timeline, tl(x, `Severity ${x.severity} → ${next}`)] })),
        { action: up ? 'Incident escalated' : 'Incident de-escalated', entityType: 'Incident', entityId: inc.id, previous: inc.severity, next }),
      ev: { kind: 'incident', title: `${up ? 'Escalated' : 'De-escalated'} to ${next}`, detail: inc.title, tone: next === 'Critical' ? 'critical' : 'info', notable: next === 'Critical' && up, to: `/incidents/${inc.id}` },
    };
  },
  verify(s) {
    const inc = pickOf(s.incidents.filter((i) => mine(i) && i.verification === 'Pending'));
    if (!inc) return null;
    return {
      s: audit(patchIncident(s, inc.id, (x) => ({ ...x, verification: 'Verified', updatedAt: nowIso(), timeline: [...x.timeline, tl(x, 'Verification: Verified')] })),
        { action: 'Verification changed', entityType: 'Incident', entityId: inc.id, previous: 'Pending', next: 'Verified' }),
      ev: { kind: 'incident', title: 'Incident verified', detail: inc.title, tone: 'success', to: `/incidents/${inc.id}` },
    };
  },
  advance(s) {
    const NEXT = { Reported: 'Under Verification', 'Under Verification': 'Response in Progress', Confirmed: 'Response in Progress', 'Response in Progress': 'Resolved' };
    const inc = pickOf(s.incidents.filter((i) => mine(i) && NEXT[i.status]));
    if (!inc) return null;
    const to = NEXT[inc.status];
    return {
      s: audit(patchIncident(s, inc.id, (x) => ({
        ...x, status: to, updatedAt: nowIso(),
        verification: to === 'Under Verification' ? 'Pending' : to === 'Response in Progress' ? 'Verified' : x.verification,
        assignedOperator: x.assignedOperator || 'op-01', timeline: [...x.timeline, tl(x, `Status: ${x.status} → ${to}`)],
      })), { action: 'Incident status changed', entityType: 'Incident', entityId: inc.id, previous: inc.status, next: to }),
      ev: { kind: 'incident', title: to === 'Resolved' ? 'Incident resolved' : `Now ${to}`, detail: inc.title, tone: to === 'Resolved' ? 'success' : 'info', notable: to === 'Resolved', to: `/incidents/${inc.id}` },
    };
  },
  warningIssue(s, c) {
    const stateCode = rng.pick(Object.keys(STATE_HAZARDS));
    const hazard = rng.pick(HAZARD_KEYS.filter((h) => isEligible(h, stateCode)));
    const a = makeWarning(rng, c.alloc, { stateCode, hazard, now: c.now, ageMin: 0, acked: false, expiresMin: rng.int(360, 1440) });
    return {
      s: audit({ ...s, alerts: [a, ...s.alerts] }, { action: 'Warning issued', entityType: 'Alert', entityId: a.id, next: a.severity, detail: a.headline }),
      ev: { kind: 'alert', title: 'Warning issued', detail: `${a.headline}, ${STATE_NAME[stateCode]}`, tone: ['Extreme', 'Severe'].includes(a.severity) ? 'warning' : 'info', notable: true, to: `/alerts?open=${a.id}` },
    };
  },
  warningExpire(s) {
    const a = pickOf(s.alerts.filter((x) => mine(x) && x.classification === 'Official' && !x.cancelled && new Date(x.expires).getTime() > Date.now()));
    if (!a) return null;
    return {
      s: audit({ ...s, alerts: s.alerts.map((x) => (x.id === a.id ? { ...x, expires: nowIso() } : x)) }, { action: 'Warning expired', entityType: 'Alert', entityId: a.id }),
      ev: { kind: 'alert', title: 'Warning expired', detail: a.headline, tone: 'info', to: `/alerts?open=${a.id}` },
    };
  },
  sourceToggle(s, c) {
    if (s.sources.filter((x) => x.liveOffline).length >= SIM.maxSourcesOffline) return null;
    const src = pickOf(s.sources.filter((x) => !x.liveOffline && x.status === 'Connected' && x.hazards.length));
    if (!src) return null;
    const delayed = Math.random() < 0.7;
    const recoverAt = c.now + rng.int(15, 30) * 1000;
    return {
      s: audit({ ...s, sources: s.sources.map((x) => (x.id === src.id ? {
        ...x, status: delayed ? 'Delayed' : 'Offline', liveOffline: true, recoverAt, lastAttempt: nowIso(),
        lastSuccess: delayed ? new Date(c.now - rng.int(8, 20) * TIME.MIN).toISOString() : x.lastSuccess,
        error: delayed ? 'Latest update later than expected.' : 'Feed not responding (timeout).',
      } : x)) }, { action: 'Ingestion attempt', entityType: 'Source', entityId: src.id, next: delayed ? 'Delayed' : 'Offline', outcome: 'Failed', detail: delayed ? 'Update delayed' : 'Feed not responding (timeout)' }),
      ev: { kind: 'source', title: delayed ? 'Data source delayed' : 'Data source offline', detail: src.name, tone: 'warning', notable: true, to: '/integrations' },
    };
  },
};

/** Keeps connected sources fresh and recovers delayed / offline ones after a few ticks. */
function maintainSources(sources, now) {
  const stamp = new Date(now).toISOString();
  return sources.map((x) => {
    if (x.liveOffline) {
      if (now < x.recoverAt) return x;
      return { ...x, status: 'Connected', liveOffline: false, recoverAt: null, lastSuccess: stamp, lastAttempt: stamp, error: 'None' };
    }
    return x.status === 'Connected' ? { ...x, lastSuccess: stamp, lastAttempt: stamp } : x;
  });
}


const SYSTEM = 'System';
const MIN = 60000;
const stageOpen = (t) => TASK_OPEN_STATUSES.includes(t.status);
let targetOpen = 0;

/** Moves due tasks one stage on, escalates long-overdue ones and resolves incidents whose tasks are all complete. */
function progressTasks(s, ctx, events) {
  const { now } = ctx;
  const transitions = [];
  const tasks = s.tasks.map((t) => {
    if (!mine(t) || !stageOpen(t)) return t;
    const stage = stageOf(t);
    if (!t.nextAt || t.nextAt < now - 5 * MIN) return { ...t, nextAt: now + waitMs(rng, stage) };
    let cur = t;
    if (now >= t.nextAt) {
      const teams = TEAMS.filter((m) => m.stateCode === t.stateCode);
      const to = nextStageOf(stage);
      if (stage === 'Created') {
        const team = teamFor(rng, teams, t.category);
        if (!team) return { ...t, nextAt: now + 30000 };
        cur = { ...applyStage(t, 'Assigned', { at: now, by: SYSTEM, teamName: team.name }), assignee: team.id };
      } else if (stage === 'Findings submitted') {
        cur = applyStage(applyStage(t, 'Verified', { at: now, by: SYSTEM, note: 'auto-verified' }), 'Completed', { at: now, by: SYSTEM });
      } else {
        const team = teams.find((m) => m.id === t.assignee);
        cur = applyStage(t, to, { at: now, by: SYSTEM, teamName: team ? team.name : undefined });
      }
      const after = stageOf(cur);
      cur = { ...cur, nextAt: after === 'Completed' ? null : now + waitMs(rng, after) };
      transitions.push({ before: t, after: cur, from: stage, to: after });
    }
    // Long-overdue tasks escalate once, after twice the typical time for their stage.
    const hi = ((STAGE_MINUTES[stageOf(cur)] || [0, 30])[1] || 30) / TIME_SCALE;
    if (!cur.escalated && cur.dueAt && now - new Date(cur.dueAt).getTime() > 2 * hi * MIN && Math.random() < 0.05) {
      const order = ['Low', 'Medium', 'High', 'Urgent'];
      const up = order[Math.min(order.indexOf(cur.priority) + 1, order.length - 1)];
      cur = { ...cur, priority: up, escalated: true, history: [...cur.history, { id: `${cur.id}-h${cur.history.length}`, at: nowIso(), by: SYSTEM, text: `Escalated ${cur.priority} → ${up} — overdue past twice the usual stage time` }] };
      transitions.push({ before: t, after: cur, escalated: true });
    }
    return cur;
  });
  let out = { ...s, tasks };
  transitions.forEach((x) => {
    out = audit(out, x.escalated
      ? { action: 'Task escalated', entityType: 'Task', entityId: x.after.id, previous: x.before.priority, next: x.after.priority, detail: 'Overdue past twice the usual stage time' }
      : { action: 'Task stage changed', entityType: 'Task', entityId: x.after.id, previous: x.from, next: x.to, detail: x.after.category });
  });
  transitions.filter((x) => !x.escalated && (x.to === 'Completed' || x.to === 'Findings submitted')).slice(0, 2).forEach((x) => {
    events.push({ kind: 'task', title: x.to === 'Completed' ? 'Task completed' : 'Findings submitted', detail: `${x.after.category} — ${x.after.location}`, tone: x.to === 'Completed' ? 'success' : 'info', to: `/field-operations?open=${x.after.id}` });
  });

  // An incident whose tasks are all complete is resolved automatically.
  const byInc = {};
  out.tasks.forEach((t) => { if (t.incidentId && !t.historical) (byInc[t.incidentId] ||= []).push(t); });
  const resolvable = out.incidents.filter((i) => mine(i) && INCIDENT_ACTIVE_STATUSES.includes(i.status) && byInc[i.id] && byInc[i.id].every((t) => t.status === 'Completed' || t.status === 'Cancelled') && byInc[i.id].some((t) => t.status === 'Completed'));
  resolvable.forEach((inc) => {
    out = audit(patchIncident(out, inc.id, (x) => ({ ...x, status: 'Resolved', updatedAt: nowIso(), timeline: [...x.timeline, tl(x, `Status: ${x.status} → Resolved (all response tasks completed)`)] })),
      { action: 'Incident status changed', entityType: 'Incident', entityId: inc.id, previous: inc.status, next: 'Resolved', detail: 'All response tasks completed' });
    events.push({ kind: 'incident', title: 'Incident resolved', detail: inc.title, tone: 'success', to: `/incidents/${inc.id}` });
  });
  return out;
}

/** Keeps stored state small: only the most recent resolved live incidents (and their tasks) are kept. */
function pruneResolved(s) {
  const resolved = s.incidents.filter((i) => i.origin === 'live' && ['Resolved', 'Closed'].includes(i.status));
  if (resolved.length <= SIM.keepResolved) return s;
  const drop = new Set(resolved.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(SIM.keepResolved).map((i) => i.id));
  return { ...s, incidents: s.incidents.filter((i) => !drop.has(i.id)), tasks: s.tasks.filter((t) => !drop.has(t.incidentId)) };
}

let cursor = 0;

/** Applies one tick of readings plus 1-3 lifecycle events to the data store, logs them and raises toasts for notable ones. */
export function runTick() {
  const now = Date.now();
  const events = [];
  dataStore.set((state) => {
    const seq = { ...state.seq };
    const ctx = { now, alloc: (k) => { seq[k] += 1; return `${PFX[k]}${seq[k]}`; } };
    let s = state;

    // 1) Fresh readings for a rotating slice of stations (every station at least once a minute).
    const total = s.records.length;
    const slice = Math.ceil(total / 10);
    const crossed = [];
    const records = s.records.slice();
    for (let i = 0; i < slice; i += 1) {
      const idx = (cursor + i) % total;
      const before = classify(records[idx]).exceeding;
      records[idx] = stepRecord(records[idx], rng, now);
      if (!before && classify(records[idx]).exceeding) crossed.push(records[idx]);
    }
    cursor = (cursor + slice) % total;
    s = { ...s, records };

    // 2) A threshold crossing raises a flag, a warning, an incident (if none is open there) and an unassigned task.
    const rec = crossed.find((r) => isEligible(r.hazard, r.stateCode));
    if (rec) {
      const cls = classify(rec);
      const hasInc = s.incidents.some((x) => x.hazard === rec.hazard && x.district === rec.district && x.stateCode === rec.stateCode && INCIDENT_ACTIVE_STATUSES.includes(x.status));
      const warn = makeWarning(rng, ctx.alloc, { stateCode: rec.stateCode, hazard: rec.hazard, district: rec.district, now, ageMin: 0, acked: false, severity: cls.danger ? 'Extreme' : 'Severe', expiresMin: rng.int(360, 1200) });
      let incidents = s.incidents; let tasks = s.tasks;
      if (!hasInc) {
        const inc = makeIncident(rng, ctx.alloc, { stateCode: rec.stateCode, hazard: rec.hazard, district: rec.district, now, severity: cls.danger ? 'High' : 'Moderate', provenance: `Station reading ${rec.id}` });
        const made = makeIncidentTasks(rng, ctx.alloc, inc, { now, teams: TEAMS.filter((m) => m.stateCode === rec.stateCode), ageMin: 1, fresh: true });
        inc.linkedAlertIds.push(warn.id); warn.linkedIncidentIds.push(inc.id);
        incidents = [inc, ...incidents]; tasks = [...made, ...tasks];
      }
      const flag = { id: `FLG-${rec.id}-${now}`, hazard: rec.hazard, ruleId: 'STN-THRESHOLD', stateCode: rec.stateCode, district: rec.district, recordId: rec.id, severity: cls.danger ? 'High' : 'Moderate', state: 'Open', createdAt: nowIso(), text: `${rec.location}: ${rec.classification.toLowerCase()} (${rec.value} ${rec.unit}).` };
      s = audit({ ...s, alerts: [warn, ...s.alerts], incidents, tasks, flags: [flag, ...s.flags] }, { action: 'Threshold crossed', entityType: 'Record', entityId: rec.id, next: rec.classification, detail: flag.text });
      events.push({ kind: 'alert', title: `${HAZARD_LABEL[rec.hazard]} threshold crossed`, detail: `${rec.location}, ${STATE_NAME[rec.stateCode]}`, tone: 'warning', notable: true, to: `/hazards/${rec.hazard}` });
    }
    // Flags clear once their station is back within range.
    const byId = new Map(s.records.map((r) => [r.id, r]));
    s = { ...s, flags: s.flags.filter((f) => !f.recordId || (byId.get(f.recordId) && classify(byId.get(f.recordId)).exceeding)).slice(0, 80) };

    // 3) Weighted lifecycle events.
    const count = rng.int(SIM.eventsPerTick.min, SIM.eventsPerTick.max);
    for (let i = 0; i < count; i += 1) {
      const out = HANDLERS[weightedKey(SIM.eventWeights)](s, ctx);
      if (out) { s = out.s; events.push(out.ev); }
    }

    // 3b) Task stage progression, automatic incident resolution and replenishment of the response queue.
    s = progressTasks(s, ctx, events);
    const open = s.tasks.filter((t) => !t.historical && stageOpen(t)).length;
    if (!targetOpen) targetOpen = Math.max(open, 120);
    for (let n = 0; n < 2 && s.tasks.filter((t) => !t.historical && stageOpen(t)).length < targetOpen * 0.9; n += 1) {
      const out = HANDLERS.newIncident(s, ctx);
      if (out) { s = out.s; events.push(out.ev); }
    }
    s = pruneResolved(s);

    // 4) Sources, freshness and coverage.
    s = { ...s, sources: maintainSources(s.sources, now) };
    const covered = ensureCoverage({ records: s.records, incidents: s.incidents, alerts: s.alerts, tasks: s.tasks }, { rng, alloc: ctx.alloc, now });
    return { ...s, ...covered, records: refreshStale(covered.records, rng, now), seq: { ...s.seq, INC: seq.INC, ALT: seq.ALT, TSK: seq.TSK } };
  });
  if (!events.length) { touchTick(); return; }
  logEvents(events);
  events.filter((e) => e.notable).slice(0, 2).forEach((e) => toastStore.push({ kind: e.tone === 'critical' ? 'error' : e.tone === 'success' ? 'success' : 'warning', title: e.title, text: e.detail }));
}
