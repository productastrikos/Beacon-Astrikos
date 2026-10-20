import { STATE_HAZARDS } from './geography';
import { HAZARD_KEYS, INCIDENT_ACTIVE_STATUSES, TASK_OPEN_STATUSES } from '../../types';
import { makeIncident, makeWarning, makeTask, makeIncidentTasks } from './factories';
import { isEligible } from '../../config/hazardRegions';
import { classify, pushBeyondWarning, stepRecord } from './stationModel';
import { TEAMS } from './people';
import { TIME } from '../../utils/format';

const STATES = Object.keys(STATE_HAZARDS);

/**
 * Coverage guard: makes sure every hazard x state (and every state) always has something to show, so no default view
 * is empty or stale. Used after seeding and on every live tick. Returns new arrays only for what it had to change.
 * d = { records, incidents, alerts, tasks }
 */
export function ensureCoverage(d, { rng, alloc, now }) {
  const records = d.records.slice();
  const incidents = d.incidents.slice();
  const alerts = d.alerts.slice();
  const tasks = d.tasks.slice();
  const incIdx = new Map(incidents.map((x, i) => [x.id, i]));
  const key = (h, s) => `${h}|${s}`;
  const active = (i) => INCIDENT_ACTIVE_STATUSES.includes(i.status);
  const liveAlert = (a) => !a.cancelled && a.classification !== 'Historical' && new Date(a.expires).getTime() > now;
  const teamsOf = (s) => TEAMS.filter((t) => t.stateCode === s);

  const recBy = {}; const incBy = {}; const altBy = {}; const taskBy = {};
  records.forEach((r, i) => { (recBy[key(r.hazard, r.stateCode)] ||= []).push(i); });
  incidents.forEach((x) => { if (active(x)) (incBy[key(x.hazard, x.stateCode)] ||= []).push(x); });
  alerts.forEach((a) => { if (liveAlert(a)) (altBy[key(a.hazard, a.stateCode)] ||= []).push(a); });
  tasks.forEach((t) => {
    if (!TASK_OPEN_STATUSES.includes(t.status)) return;
    const inc = incIdx.has(t.incidentId) ? incidents[incIdx.get(t.incidentId)] : null;
    if (inc) (taskBy[key(inc.hazard, inc.stateCode)] ||= []).push(t);
  });

  const addTask = (inc, o) => {
    const t = makeTask(rng, alloc, { incident: inc, now, teams: teamsOf(inc.stateCode), ...o });
    tasks.push(t);
    const i = incIdx.get(inc.id);
    incidents[i] = { ...incidents[i], taskIds: [...incidents[i].taskIds, t.id] };
    return t;
  };

  // Every active incident has response tasks (new incidents are exempt for their first two minutes).
  incidents.forEach((inc, i) => {
    if (!active(inc) || inc.historical || now - new Date(inc.createdAt).getTime() < 2 * TIME.MIN) return;
    if (tasks.some((t) => t.incidentId === inc.id)) return;
    const copy = { ...inc, taskIds: [...inc.taskIds] };
    const made = makeIncidentTasks(rng, alloc, copy, { now, teams: teamsOf(inc.stateCode) });
    tasks.push(...made);
    incidents[i] = copy;
  });

  STATES.forEach((st) => {
    HAZARD_KEYS.forEach((hz) => {
      const k = key(hz, st);
      const rs = recBy[k] || [];
      if (!isEligible(hz, st)) return;
      if (rs.length && !rs.some((i) => classify(records[i]).exceeding)) {
        const i = rng.pick(rs);
        records[i] = pushBeyondWarning(records[i], rng, now);
      }
      if (!(incBy[k] || []).length) {
        const inc = makeIncident(rng, alloc, { stateCode: st, hazard: hz, now, ageMin: rng.int(8, 300), status: rng.pick(['Reported', 'Under Verification', 'Response in Progress']) });
        incidents.push(inc); incIdx.set(inc.id, incidents.length - 1); incBy[k] = [inc];
        tasks.push(...makeIncidentTasks(rng, alloc, inc, { now, teams: teamsOf(st) }));
        taskBy[k] = tasks.filter((t) => t.incidentId === inc.id && TASK_OPEN_STATUSES.includes(t.status));
      }
      if (!(altBy[k] || []).length) {
        const a = makeWarning(rng, alloc, { stateCode: st, hazard: hz, now, ageMin: rng.int(10, 300) });
        alerts.push(a); altBy[k] = [a];
      }
      if (!(taskBy[k] || []).length) {
        // Scenario (simulation) incidents are never modified by the guard.
        let inc = incBy[k].find((x) => x.origin !== 'simulation');
        if (!inc) {
          inc = makeIncident(rng, alloc, { stateCode: st, hazard: hz, now, ageMin: rng.int(8, 300), status: rng.pick(['Reported', 'Under Verification', 'Response in Progress']) });
          incidents.push(inc); incIdx.set(inc.id, incidents.length - 1);
        }
        const t = addTask(inc, { status: rng.pick(['Assigned', 'In Progress']), ageMin: rng.int(20, 240), dueInMin: rng.int(40, 400) });
        taskBy[k] = [t];
      }
    });

    // Every state keeps at least seven active incidents, drawn from the hazards that apply there.
    const fit = HAZARD_KEYS.filter((h) => isEligible(h, st));
    for (let n = incidents.filter((x) => x.stateCode === st && active(x)).length; n < 7; n += 1) {
      const inc = makeIncident(rng, alloc, { stateCode: st, hazard: rng.pick(fit), now, ageMin: rng.int(8, 400), status: rng.pick(['Reported', 'Under Verification', 'Response in Progress']) });
      incidents.push(inc); incIdx.set(inc.id, incidents.length - 1);
      tasks.push(...makeIncidentTasks(rng, alloc, inc, { now, teams: teamsOf(st) }));
    }

    // State-level mix for Field Operations and Alerts.
    const st_tasks = () => tasks.filter((t) => t.stateCode === st && !t.historical);
    const stActiveInc = incidents.filter((x) => x.stateCode === st && active(x) && x.origin !== 'simulation');
    const pickInc = () => rng.pick(stActiveInc);
    let open = st_tasks().filter((t) => TASK_OPEN_STATUSES.includes(t.status));
    for (let n = open.filter((t) => t.status === 'Unassigned').length; n < 2; n += 1) addTask(pickInc(), { status: 'Unassigned', ageMin: rng.int(5, 70), dueInMin: rng.int(60, 400) });
    open = st_tasks().filter((t) => TASK_OPEN_STATUSES.includes(t.status));
    if (!open.some((t) => t.status === 'Awaiting Verification')) addTask(pickInc(), { status: 'Awaiting Verification', ageMin: rng.int(60, 300), dueInMin: rng.int(30, 300) });
    if (!open.some((t) => t.dueAt && new Date(t.dueAt).getTime() < now)) {
      const t = addTask(pickInc(), { status: 'In Progress', ageMin: rng.int(240, 600), dueInMin: -rng.int(20, 200) });
      void t;
    }
    const done = st_tasks().filter((t) => t.status === 'Completed' && t.completedAt && now - new Date(t.completedAt).getTime() <= TIME.DAY);
    for (let n = done.length; n < 2; n += 1) addTask(pickInc(), { status: 'Completed', ageMin: rng.int(120, 500), completedMinAgo: rng.int(20, 600) });

    const stAlerts = alerts.filter((a) => a.stateCode === st && liveAlert(a));
    if (!stAlerts.some((a) => !a.ackAt)) alerts.push(makeWarning(rng, alloc, { stateCode: st, hazard: rng.pick(HAZARD_KEYS.filter((h) => isEligible(h, st))), now, ageMin: rng.int(10, 90), acked: false }));
    if (!stAlerts.some((a) => new Date(a.expires).getTime() - now <= TIME.DAY)) alerts.push(makeWarning(rng, alloc, { stateCode: st, hazard: rng.pick(HAZARD_KEYS.filter((h) => isEligible(h, st))), now, ageMin: rng.int(60, 300), expiresMin: rng.int(30, 600) }));
    const cancelled = alerts.filter((a) => a.stateCode === st && a.cancelled && a.history.length && now - new Date(a.history[a.history.length - 1].at).getTime() <= 7 * TIME.DAY);
    for (let n = cancelled.length; n < 2; n += 1) alerts.push(makeWarning(rng, alloc, { stateCode: st, hazard: rng.pick(HAZARD_KEYS.filter((h) => isEligible(h, st))), now, ageMin: rng.int(300, 2400), cancelledMinAgo: rng.int(30, 6000) }));
  });

  return { records, incidents, alerts, tasks };
}

/** Records not refreshed for `maxAgeMs` get a fresh reading (seeding and live ticks both rely on this). */
export function refreshStale(records, rng, now, maxAgeMs = 25 * TIME.MIN) {
  return records.map((r) => (now - new Date(r.sourceTimestamp).getTime() > maxAgeMs ? stepRecord(r, rng, now) : r));
}

