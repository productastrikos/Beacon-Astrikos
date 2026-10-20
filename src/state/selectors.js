import {
  INCIDENT_ACTIVE_STATUSES, TASK_OPEN_STATUSES, SEVERITY_RANK, CAP_SEVERITY_RANK, HAZARD_KEYS,
} from '../types';
import { DEMO_USERS, OPERATOR_ROSTER, TEAMS } from '../data/demo/people';
import { STATE_NAME } from '../data/demo/geography';
import { freshness } from '../utils/format';

/* ── scope ───────────────────────────────────────────────────────────── */
export const inScope = (scope, stateCode) => scope === 'IN' || stateCode === scope;
export const scopeFilter = (list, scope) => list.filter((x) => inScope(scope, x.stateCode));
export const scopeLabel = (scope) => (scope === 'IN' ? 'PAN India' : STATE_NAME[scope] || scope);

/* ── names ───────────────────────────────────────────────────────────── */
const NAME_INDEX = {
  ...Object.fromEntries(DEMO_USERS.map((u) => [u.id, u.name])),
  ...Object.fromEntries(OPERATOR_ROSTER.map((o) => [o.id, o.name])),
  ...Object.fromEntries(TEAMS.map((t) => [t.id, t.name])),
  system: 'System',
};
export const assigneeName = (id) => (id ? NAME_INDEX[id] || id : '—');
export const teamById = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

/* ── state predicates ────────────────────────────────────────────────── */
export const isActiveIncident = (i) => INCIDENT_ACTIVE_STATUSES.includes(i.status);
export const isOpenTask = (t) => TASK_OPEN_STATUSES.includes(t.status);
export const isOverdueTask = (t, now) => isOpenTask(t) && t.dueAt && new Date(t.dueAt).getTime() < now;
export const isOverdueIncident = (i, now) => isActiveIncident(i) && i.dueAt && new Date(i.dueAt).getTime() < now;

export function alertStatus(a, now) {
  if (a.cancelled || a.msgType === 'Cancel') return 'Cancelled';
  if (new Date(a.expires).getTime() <= now) return 'Expired';
  if (a.history.some((h) => h.msgType === 'Update')) return 'Updated';
  return 'Active';
}
export const isActiveAlert = (a, now) => ['Active', 'Updated'].includes(alertStatus(a, now));

export function validityLabel(a, now) {
  const st = alertStatus(a, now);
  if (st !== 'Active' && st !== 'Updated') return st;
  const mins = Math.round((new Date(a.expires).getTime() - now) / 60000);
  if (mins < 60) return `Valid ${mins} min`;
  if (mins < 24 * 60) return `Valid ${Math.round(mins / 60)} h`;
  return `Valid ${Math.round(mins / 1440)} d`;
}

export const alertRank = (a) => CAP_SEVERITY_RANK[a.severity] ?? 0;

/* ── KPIs ────────────────────────────────────────────────────────────── */
export function computeKpis(data, scope, now = Date.now()) {
  const incidents = scopeFilter(data.incidents, scope);
  const alerts = scopeFilter(data.alerts, scope);
  const tasks = scopeFilter(data.tasks, scope);
  const active = incidents.filter(isActiveIncident);
  const high = active.filter((i) => SEVERITY_RANK[i.severity] >= 3);
  const districts = new Set(active.map((i) => `${i.stateCode}:${i.district}`));
  const activeAlerts = alerts.filter((a) => isActiveAlert(a, now));
  const official = activeAlerts.filter((a) => a.classification === 'Official');
  const openTasks = tasks.filter(isOpenTask);
  const attention = data.sources.filter((s) => ['Delayed', 'Offline'].includes(s.status));
  return {
    activeIncidents: active.length,
    activeWarnings: official.length,
    highSeverity: high.length,
    criticalCount: active.filter((i) => i.severity === 'Critical').length,
    districtsAffected: districts.size,
    openTasks: openTasks.length,
    overdueTasks: openTasks.filter((t) => isOverdueTask(t, now)).length,
    unassignedTasks: openTasks.filter((t) => t.status === 'Unassigned').length,
    sourcesAttention: attention.length,
  };
}

/* ── attention items (notification bell) ─────────────────────────────── */
export function attentionItems(data, scope, now = Date.now()) {
  const items = [];
  scopeFilter(data.alerts, scope)
    .filter((a) => isActiveAlert(a, now) && !a.ackAt && a.classification !== 'Historical')
    .forEach((a) => items.push({ kind: 'alert', id: a.id, text: `Unacknowledged: ${a.headline}`, to: `/alerts?open=${a.id}`, rank: 2 + alertRank(a) }));
  scopeFilter(data.incidents, scope).filter(isActiveIncident)
    .filter((i) => SEVERITY_RANK[i.severity] >= 3 && !i.assignedOperator && !i.assignedTeam)
    .forEach((i) => items.push({ kind: 'incident', id: i.id, text: `Unassigned ${i.severity} incident: ${i.title}`, to: `/incidents/${i.id}`, rank: 6 }));
  scopeFilter(data.tasks, scope).filter((t) => isOverdueTask(t, now))
    .forEach((t) => items.push({ kind: 'task', id: t.id, text: `Overdue task: ${t.category} — ${t.location}`, to: `/field-operations?open=${t.id}`, rank: 4 }));
  data.sources.filter((s) => ['Delayed', 'Offline'].includes(s.status))
    .forEach((s) => items.push({ kind: 'source', id: s.id, text: `Source ${s.status.toLowerCase()}: ${s.short}`, to: '/integrations', rank: 1 }));
  return items.sort((a, b) => b.rank - a.rank);
}

/* ── hazard helpers ──────────────────────────────────────────────────── */
export function hazardSummary(data, hazard, scope, now = Date.now()) {
  const incidents = scopeFilter(data.incidents, scope).filter((i) => i.hazard === hazard && isActiveIncident(i));
  const alerts = scopeFilter(data.alerts, scope).filter((a) => a.hazard === hazard && isActiveAlert(a, now));
  const records = scopeFilter(data.records, scope).filter((r) => r.hazard === hazard);
  const latest = records.reduce((m, r) => (new Date(r.sourceTimestamp) > m ? new Date(r.sourceTimestamp) : m), new Date(0));
  const severity = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
  incidents.forEach((i) => { severity[i.severity] += 1; });
  return { incidents, alerts, records, latest: latest.getTime() > 0 ? latest.toISOString() : null, severity };
}

export function recordFreshness(r, now) { return freshness(r.sourceTimestamp, now); }

/** Per-hazard counts for overview / multi-hazard tables. */
export function hazardMatrix(data, scope, now = Date.now()) {
  return HAZARD_KEYS.map((h) => {
    const s = hazardSummary(data, h, scope, now);
    return {
      hazard: h, incidents: s.incidents.length, alerts: s.alerts.length, records: s.records.length,
      critical: s.severity.Critical, high: s.severity.High, flags: scopeFilter(data.flags, scope).filter((f) => f.hazard === h && f.state === 'Open').length,
    };
  });
}
