import { scopeFilter, isActiveIncident, isActiveAlert, isOpenTask, isOverdueTask, scopeLabel } from './selectors';
import { classify } from '../data/demo/stationModel';
import { STATE_NAME } from '../data/demo/geography';
import { TEAMS } from '../data/demo/people';
import { HAZARD_LABEL, HAZARD_KEYS } from '../types';
import { TIME } from '../utils/format';

/**
 * Rule-based insight engine for the AI Advisory panel. Everything is derived from the live store on every tick:
 * clusters, capacity pressure, warnings without a response, data-source degradation and expiries.
 * Score = severity x concentration x trend; the highest score becomes ACT NOW, the rest REVIEW or MONITOR by rule.
 */
const PFX = { flood: 'FLD', landslide: 'LSL', earthquake: 'EQK', avalanche: 'AVL', wildfire: 'WLF', heatwave: 'HTW', coldwave: 'CLD' };
const SEV_W = { Critical: 4, Extreme: 4, High: 3, Severe: 3, Moderate: 2, Low: 1, Minor: 1 };
const CATEGORY = { flood: 'Flood Cluster', landslide: 'Landslide Cluster', earthquake: 'Seismic Cluster', avalanche: 'Avalanche Cluster', wildfire: 'Fire Cluster', heatwave: 'Heat Stress', coldwave: 'Cold Stress' };
const slug = (t) => String(t).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
const countBy = (items, fn) => items.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
const r1 = (n) => Math.round(n * 10) / 10;

function teamLoad(tasks) {
  const load = {};
  tasks.filter(isOpenTask).forEach((t) => { if (t.assignee) load[t.assignee] = (load[t.assignee] || 0) + 1; });
  return load;
}
const idleTeams = (state, load) => TEAMS.filter((t) => (!state || t.stateCode === state) && !t.offShift && (load[t.id] || 0) < 2);

export function computeAdvisories(data, scope, now) {
  const incidents = scopeFilter(data.incidents, scope).filter((i) => isActiveIncident(i) && !i.historical);
  const alerts = scopeFilter(data.alerts, scope).filter((a) => isActiveAlert(a, now) && a.classification !== 'Historical');
  const tasks = scopeFilter(data.tasks, scope).filter((t) => !t.historical);
  const records = scopeFilter(data.records, scope);
  const load = teamLoad(data.tasks);
  const out = [];
  const where = scopeLabel(scope);

  // 1) Clusters: districts where incidents, warnings and over-threshold stations concentrate well above the norm.
  HAZARD_KEYS.forEach((hz) => {
    const exceeding = records.filter((r) => r.hazard === hz && classify(r).exceeding);
    const incs = incidents.filter((i) => i.hazard === hz);
    const alts = alerts.filter((a) => a.hazard === hz);
    const per = {};
    const bump = (st, d, f) => { const k = `${st}|${d}`; (per[k] ||= { st, d, stations: 0, incidents: 0, warnings: 0, sev: 0 }); f(per[k]); };
    exceeding.forEach((r) => bump(r.stateCode, r.district, (x) => { x.stations += 1; x.sev = Math.max(x.sev, SEV_W[classify(r).danger ? 'High' : 'Moderate']); }));
    incs.forEach((i) => bump(i.stateCode, i.district, (x) => { x.incidents += 1; x.sev = Math.max(x.sev, SEV_W[i.severity]); }));
    alts.forEach((a) => a.districts.forEach((d) => bump(a.stateCode, d, (x) => { x.warnings += 1; x.sev = Math.max(x.sev, SEV_W[a.severity]); })));
    const rows = Object.values(per).map((x) => ({ ...x, c: x.stations + x.incidents + x.warnings }));
    if (!rows.length) return;
    rows.sort((a, b) => b.c - a.c);
    const top = rows[0];
    const stateRows = rows.filter((x) => x.st === top.st);
    const mean = avg(stateRows.map((x) => x.c));
    if (top.c < 2) return;
    const created = (from, to) => incs.filter((i) => i.stateCode === top.st && now - new Date(i.createdAt).getTime() >= from && now - new Date(i.createdAt).getTime() < to).length;
    const last = created(0, TIME.DAY);
    const prev = created(TIME.DAY, 2 * TIME.DAY);
    const dod = prev ? Math.round(((last - prev) / prev) * 100) : last * 100;
    const trend = 1 + Math.max(0, dod) / 200;
    const stRecs = exceeding.filter((r) => r.stateCode === top.st && r.district === top.d);
    const worst = stRecs.sort((a, b) => Math.abs(b.value - b.extra.warning) - Math.abs(a.value - a.extra.warning))[0];
    const topAlert = alts.filter((a) => a.stateCode === top.st && a.districts.includes(top.d)).sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])[0];
    const idle = idleTeams(top.st, load);
    const unassigned = tasks.filter((t) => t.stateCode === top.st && t.status === 'Unassigned').length;
    const openIn = tasks.filter((t) => t.stateCode === top.st && isOpenTask(t)).length || 1;
    out.push({
      id: `ADV-${PFX[hz]}-${top.st}-${slug(top.d)}`, rule: 'cluster', defaultLevel: 'REVIEW', category: CATEGORY[hz], hazard: hz, stateCode: top.st, district: top.d,
      score: top.sev * top.c * trend * (1 + top.c / Math.max(mean, 1) / 4),
      title: `${HAZARD_LABEL[hz]} risk cluster in ${top.d} — ${top.st === 'AR' ? 'pre-emptive deployment recommended' : 'deployment review recommended'}`,
      summary: `${top.c} signals concentrated in ${top.d}, ${STATE_NAME[top.st]} (state average ${r1(mean)}).`,
      rootCause: {
        primary: `${top.stations} station${top.stations === 1 ? '' : 's'} in ${top.d} ${top.stations === 1 ? 'is' : 'are'} beyond the warning threshold${worst ? `, led by ${worst.location} at ${worst.value} ${worst.unit}` : ''}.`,
        contributing: `${top.warnings} active ${HAZARD_LABEL[hz].toLowerCase()} warning${top.warnings === 1 ? '' : 's'}${topAlert ? ` (${topAlert.severity})` : ''} and ${top.incidents} open incident${top.incidents === 1 ? '' : 's'} in the district, with ${idle.length} team${idle.length === 1 ? '' : 's'} available in ${STATE_NAME[top.st]}.`,
        systemic: 'Pre-deployment is normally triggered only after the danger level is crossed; a warning-level trigger would add lead time.',
      },
      evidence: [
        `${top.d} — ${top.stations} station${top.stations === 1 ? '' : 's'} beyond warning level vs a state average of ${r1(mean)} signals per district`,
        worst ? `${worst.location}: ${worst.value} ${worst.unit} against a warning level of ${worst.extra.warning}` : `${top.warnings} warning(s) active for the district`,
        prev || last ? `Incident reports in ${STATE_NAME[top.st]}: ${last} in the last 24 h vs ${prev} the day before (${dod >= 0 ? '+' : ''}${dod}%)` : `No new incident reports in the last 24 h`,
      ],
      recommendations: [
        `Pre-position ${Math.max(1, Math.min(3, idle.length))} team${Math.min(3, idle.length) === 1 ? '' : 's'} at ${top.d} within the next 6 hours`,
        `Issue a district advisory to exposed settlements in ${top.d}`,
        'Enable the warning-level auto-deployment rule for stations in this district',
      ],
      impact: [{ value: `−${10 + Math.round((unassigned / openIn) * 30)}%`, label: 'Est. response time change' }, { value: top.sev >= 3 ? 'High' : 'Elevated', label: 'District risk' }],
      actions: [
        { kind: 'task', label: 'Assign field deployment', initial: { category: 'Field verification', location: `${top.d} — ${HAZARD_LABEL[hz]} deployment`, stateCode: top.st, priority: 'High', instructions: `Pre-position response teams at ${top.d}. ${top.stations} station(s) beyond threshold.` } },
        { kind: 'incident', label: 'Create incident task', initial: { title: `${HAZARD_LABEL[hz]} risk cluster — ${top.d}`, hazard: hz, stateCode: top.st, district: top.d, severity: top.sev >= 3 ? 'High' : 'Moderate', description: `Advisory: ${top.c} signals concentrated in ${top.d} (state average ${r1(mean)}).` } },
      ],
    });
  });

  // 2) Capacity pressure: overdue and unassigned work against the teams that are free.
  const byState = {};
  tasks.filter(isOpenTask).forEach((t) => { (byState[t.stateCode] ||= { st: t.stateCode, overdue: 0, unassigned: 0, open: 0 }); const x = byState[t.stateCode]; x.open += 1; if (isOverdueTask(t, now)) x.overdue += 1; if (t.status === 'Unassigned') x.unassigned += 1; });
  const pressure = Object.values(byState).sort((a, b) => (b.overdue * 2 + b.unassigned) - (a.overdue * 2 + a.unassigned))[0];
  if (pressure && pressure.overdue + pressure.unassigned >= 2) {
    const spare = Object.keys(STATE_NAME).filter((s) => s !== pressure.st).map((s) => ({ s, n: idleTeams(s, load).length })).sort((a, b) => b.n - a.n)[0];
    const own = idleTeams(pressure.st, load).length;
    out.push({
      id: `ADV-OPS-${pressure.st}`, rule: 'capacity', defaultLevel: 'REVIEW', category: 'Capacity Pressure', hazard: null, stateCode: pressure.st, district: null,
      score: (pressure.overdue * 2 + pressure.unassigned) * 1.2,
      title: `Field task backlog is building in ${STATE_NAME[pressure.st]} — team reallocation suggested`,
      summary: `${pressure.overdue} overdue and ${pressure.unassigned} unassigned tasks against ${own} free team${own === 1 ? '' : 's'}${spare && scope === 'IN' ? `; ${STATE_NAME[spare.s]} has ${spare.n} free.` : '.'}`,
      rootCause: {
        primary: `${pressure.overdue} of ${pressure.open} open tasks in ${STATE_NAME[pressure.st]} are past their due time and ${pressure.unassigned} are waiting for a team.`,
        contributing: `Only ${own} team${own === 1 ? '' : 's'} in the state ${own === 1 ? 'is' : 'are'} below the two-task load limit${spare && spare.s !== pressure.st ? `, while ${STATE_NAME[spare.s]} has ${spare.n} available` : ''}.`,
        systemic: 'Assignment is manual and state-scoped; there is no automatic cross-state reallocation when queues grow.',
      },
      evidence: [
        `${STATE_NAME[pressure.st]} — ${pressure.overdue} overdue and ${pressure.unassigned} unassigned of ${pressure.open} open tasks`,
        `${own} team${own === 1 ? '' : 's'} free in state`,
        spare ? `${STATE_NAME[spare.s]} has ${spare.n} free teams` : 'No spare capacity elsewhere',
      ],
      recommendations: ['Assign the oldest unassigned tasks first', `Request support teams${spare ? ` from ${STATE_NAME[spare.s]}` : ''}`, 'Escalate tasks that are more than 2 hours overdue'],
      impact: [{ value: `−${Math.min(35, 8 + pressure.overdue * 3)}%`, label: 'Est. backlog change' }, { value: pressure.overdue >= 3 ? 'High' : 'Elevated', label: 'Delay risk' }],
      actions: [{ kind: 'task', label: 'Assign field deployment', initial: { category: 'Monitoring review', location: `${STATE_NAME[pressure.st]} backlog review`, stateCode: pressure.st, priority: 'High', instructions: 'Review and reassign overdue and unassigned tasks.' } }],
    });
  }

  // 3) Severe / extreme warnings with no incident linked.
  const bare = alerts.filter((a) => CAP_HIGH(a) && !a.linkedIncidentIds.some((id) => incidents.some((i) => i.id === id))).sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])[0];
  if (bare) {
    out.push({
      id: `ADV-WRN-${bare.id}`, rule: 'unresponded', defaultLevel: 'REVIEW', category: 'Warning Response', hazard: bare.hazard, stateCode: bare.stateCode, district: bare.districts[0],
      score: SEV_W[bare.severity] * 2.2, title: `${bare.severity} ${HAZARD_LABEL[bare.hazard].toLowerCase()} warning has no linked response — ${bare.districts[0]}`,
      summary: 'An agency warning is in force with no incident or task linked to it.',
      rootCause: { primary: `${bare.headline} was issued ${Math.round((now - new Date(bare.sent).getTime()) / TIME.MIN)} min ago and has no linked incident.`, contributing: `Acknowledgement: ${bare.ackAt ? 'acknowledged' : 'not yet acknowledged'}.`, systemic: 'Warnings do not create incidents automatically; an operator must link or raise one.' },
      evidence: [`${bare.id} — ${bare.severity}, expires in ${Math.max(0, Math.round((new Date(bare.expires).getTime() - now) / TIME.HOUR))} h`, `Area: ${bare.areaDesc}`, 'No active incident linked'],
      recommendations: ['Review the warning against local observations', 'Raise an incident if conditions are confirmed', 'Acknowledge the warning once reviewed'],
      impact: [{ value: '−15%', label: 'Est. response time change' }, { value: SEV_W[bare.severity] >= 4 ? 'High' : 'Elevated', label: 'District risk' }],
      actions: [{ kind: 'incident', label: 'Create incident task', initial: { title: bare.headline, hazard: bare.hazard, stateCode: bare.stateCode, district: bare.districts[0], severity: SEV_W[bare.severity] >= 4 ? 'High' : 'Moderate', description: bare.description } }],
    });
  }

  // 4) Temperature stations approaching their warning level.
  ['heatwave', 'coldwave'].forEach((hz) => {
    const near = records.filter((r) => r.hazard === hz).filter((r) => { const c = classify(r); return !c.exceeding && c.severity === 'Low'; });
    const g = Object.entries(countBy(near, (r) => r.stateCode)).sort((a, b) => b[1] - a[1])[0];
    if (!g || g[1] < 2) return;
    out.push({
      id: `ADV-${PFX[hz]}-${g[0]}`, rule: 'approaching', defaultLevel: 'MONITOR', category: CATEGORY[hz], hazard: hz, stateCode: g[0], district: null,
      score: g[1] * 1.1, title: `${hz === 'heatwave' ? 'Heat index' : 'Minimum temperature'} approaching the warning threshold across ${STATE_NAME[g[0]]} — ${hz === 'heatwave' ? 'cooling-centre' : 'shelter'} readiness check recommended`,
      summary: `${g[1]} stations are within reach of their warning level.`,
      rootCause: { primary: `${g[1]} ${HAZARD_LABEL[hz].toLowerCase()} stations in ${STATE_NAME[g[0]]} are close to their regional warning thresholds.`, contributing: 'Thresholds are set per region from station normals.', systemic: 'Readiness checks are manual and not tied to the approach of a threshold.' },
      evidence: [`${g[1]} stations approaching threshold in ${STATE_NAME[g[0]]}`, ...near.filter((r) => r.stateCode === g[0]).slice(0, 2).map((r) => `${r.location}: ${r.value} ${r.unit} (warning ${r.extra.warning})`)],
      recommendations: [hz === 'heatwave' ? 'Confirm cooling-centre and water-point readiness' : 'Confirm shelter and supply readiness', 'Brief district health officers', 'Re-check readings at the next update'],
      impact: [{ value: '−8%', label: 'Est. response time change' }, { value: 'Elevated', label: 'District risk' }],
      actions: [{ kind: 'task', label: 'Assign field deployment', initial: { category: hz === 'heatwave' ? 'Heat-action' : 'Community liaison', location: `${STATE_NAME[g[0]]} readiness check`, stateCode: g[0], priority: 'Medium', instructions: 'Confirm readiness before the warning threshold is reached.' } }],
    });
  });

  // 5) Data-source degradation.
  const degraded = data.sources.filter((s) => ['Delayed', 'Offline'].includes(s.status));
  degraded.forEach((s) => {
    const affected = records.filter((r) => r.sourceId === s.id).length;
    out.push({
      id: `ADV-SRC-${s.id.toUpperCase()}`, rule: 'source', defaultLevel: 'MONITOR', category: 'Data Quality', hazard: null, stateCode: null, district: null,
      score: 1.5 + affected * 0.05, title: `${s.short} feed ${s.status === 'Offline' ? 'offline' : 'latency rising'} — ${affected} station${affected === 1 ? '' : 's'} in ${where} affected`,
      summary: s.error,
      rootCause: { primary: `${s.name} is ${s.status.toLowerCase()}: ${s.error}`, contributing: `${affected} station${affected === 1 ? '' : 's'} in scope rely on this feed.`, systemic: 'Feeds recover automatically; stale values are flagged once a reading is older than 30 minutes.' },
      evidence: [`${s.short} status: ${s.status}`, `${affected} stations affected in ${where}`],
      recommendations: ['Cross-check affected stations against a second source', 'Confirm the last successful sync with the source owner'],
      impact: [{ value: 'Low', label: 'Coverage loss' }, { value: 'Elevated', label: 'Data risk' }], actions: [],
    });
  });

  // 6) Upcoming expiries and old unassigned tasks (always available as lower-priority prompts).
  const soon = alerts.filter((a) => !a.ackAt && new Date(a.expires).getTime() - now <= 2 * TIME.HOUR);
  if (soon.length) {
    out.push({
      id: `ADV-EXP-${scope}`, rule: 'expiry', defaultLevel: 'MONITOR', category: 'Warning Lifecycle', hazard: null, stateCode: null, district: null, score: 1 + soon.length * 0.4,
      title: `${soon.length} unacknowledged warning${soon.length === 1 ? '' : 's'} expire within 2 hours in ${where}`, summary: 'Review before they lapse so the response record is complete.',
      rootCause: { primary: `${soon.length} warning(s) will expire without an acknowledgement.`, contributing: `Oldest issued ${Math.round(Math.max(...soon.map((a) => now - new Date(a.sent).getTime())) / TIME.MIN)} min ago.`, systemic: 'Expiry does not notify the duty officer.' },
      evidence: soon.slice(0, 3).map((a) => `${a.id} — ${a.headline}`), recommendations: ['Acknowledge or cancel the listed warnings', 'Confirm whether conditions have eased'],
      impact: [{ value: 'Low', label: 'Response impact' }, { value: 'Elevated', label: 'Record risk' }], actions: [],
    });
  }
  const old = tasks.filter((t) => t.status === 'Unassigned' && now - new Date(t.createdAt).getTime() > 45 * TIME.MIN);
  if (old.length) {
    out.push({
      id: `ADV-TSK-${scope}`, rule: 'unassigned', defaultLevel: 'REVIEW', category: 'Capacity Pressure', hazard: null, stateCode: null, district: null, score: 1.5 + old.length * 0.6,
      title: `${old.length} task${old.length === 1 ? '' : 's'} unassigned for more than 45 minutes in ${where}`, summary: 'Assign these to a free team or escalate.',
      rootCause: { primary: `${old.length} task(s) have waited more than 45 minutes without a team.`, contributing: `Oldest waiting ${Math.round(Math.max(...old.map((t) => now - new Date(t.createdAt).getTime())) / TIME.MIN)} min.`, systemic: 'New tasks start unassigned and rely on manual pickup.' },
      evidence: old.slice(0, 3).map((t) => `${t.id} — ${t.category}, ${t.location}`), recommendations: ['Assign the oldest tasks first', 'Escalate priority where the incident is High or Critical'],
      impact: [{ value: '−12%', label: 'Est. response time change' }, { value: 'Elevated', label: 'Delay risk' }], actions: [],
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.map((x, i) => ({ ...x, level: i === 0 ? 'ACT NOW' : x.defaultLevel }));
}

function CAP_HIGH(a) { return a.severity === 'Extreme' || a.severity === 'Severe'; }
