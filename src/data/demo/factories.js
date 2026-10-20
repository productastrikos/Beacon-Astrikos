import { STATE_NAME } from './geography';
import { TIME } from '../../utils/format';
import { eligibleDistricts } from '../../config/hazardRegions';
import { PLAYBOOK, STAGE_STATUS, normalizeTask } from '../../config/taskLifecycle';

/**
 * Record factories shared by the seed generator and the live engine, so seeded and live records are shaped identically.
 * `rng` is a createRng()-style object (next/int/pick/weighted); `alloc(kind)` returns the next id for 'INC' | 'ALT' | 'TSK'.
 */
export const INCIDENT_TITLE = {
  flood: 'River level rising', landslide: 'Slope failure reported', earthquake: 'Seismic event reported', avalanche: 'Avalanche danger reported',
  wildfire: 'Fire detection reported', heatwave: 'Extreme heat reported', coldwave: 'Severe cold reported',
};
export const TASK_CATEGORY = Object.fromEntries(Object.entries(PLAYBOOK).map(([h, list]) => [h, list[0]]));
const SENDERS = {
  flood: ['cwc', 'imd', 'sachet', 'stateeoc'], landslide: ['imd', 'gsi', 'sachet', 'stateeoc'], earthquake: ['ncs', 'ncs', 'sachet'],
  avalanche: ['sase', 'imd', 'sachet'], wildfire: ['fsi', 'firms', 'stateeoc'], heatwave: ['imd', 'sachet', 'stateeoc'], coldwave: ['imd', 'sachet', 'stateeoc'],
};
const EVENT = {
  flood: 'Flood warning', landslide: 'Landslide warning', earthquake: 'Earthquake advisory', avalanche: 'Avalanche warning',
  wildfire: 'Forest fire alert', heatwave: 'Heatwave warning', coldwave: 'Cold wave warning',
};
const CAP_CATEGORY = { wildfire: 'Fire', earthquake: 'Geo', landslide: 'Geo', avalanche: 'Geo' };
const iso = (ms) => new Date(ms).toISOString();

export function makeIncident(rng, alloc, o) {
  const { stateCode, hazard, now } = o;
  const district = o.district || rng.pick(eligibleDistricts(hazard, stateCode));
  const severity = o.severity || rng.weighted([{ v: 'Low', w: 30 }, { v: 'Moderate', w: 35 }, { v: 'High', w: 25 }, { v: 'Critical', w: 10 }]);
  const status = o.status || 'Reported';
  const id = alloc('INC');
  const createdMs = now - (o.ageMin ?? 0) * TIME.MIN;
  const advanced = status !== 'Reported';
  const verified = ['Confirmed', 'Response in Progress'].includes(status);
  return {
    id, title: `${INCIDENT_TITLE[hazard]} — ${district}`, hazard, description: `${INCIDENT_TITLE[hazard]} in ${district}, ${STATE_NAME[stateCode]}.`,
    stateCode, district, location: `${district} district`, linkedAlertIds: [], provenance: o.provenance || 'Station telemetry', severity,
    verification: verified ? 'Verified' : advanced ? 'Pending' : 'Unverified', status,
    assignedOperator: advanced ? 'op-01' : null, assignedTeam: null,
    createdAt: iso(createdMs), updatedAt: iso(createdMs + Math.min(o.ageMin ?? 0, 30) * TIME.MIN * 0.5),
    dueAt: iso(createdMs + rng.int(3, 8) * TIME.HOUR), taskIds: [], resourceIds: [], notes: [],
    timeline: [{ id: `${id}-t0`, at: iso(createdMs), by: 'System', type: 'created', text: 'Incident created from live feed' }, ...(advanced ? [{ id: `${id}-t1`, at: iso(createdMs + 5 * TIME.MIN), by: 'op-01', type: 'status', text: `Status: ${status}` }] : [])],
    closureReason: null, origin: 'live',
  };
}

export function makeWarning(rng, alloc, o) {
  const { stateCode, hazard, now } = o;
  const district = o.district || rng.pick(eligibleDistricts(hazard, stateCode));
  const severity = o.severity || rng.weighted([{ v: 'Minor', w: 18 }, { v: 'Moderate', w: 40 }, { v: 'Severe', w: 32 }, { v: 'Extreme', w: 10 }]);
  const sender = rng.pick(SENDERS[hazard]);
  const id = alloc('ALT');
  const sentMs = now - (o.ageMin ?? rng.int(10, 600)) * TIME.MIN;
  const expiresMs = o.expired ? sentMs + rng.int(3, 20) * TIME.HOUR : now + (o.expiresMin ?? rng.int(40, 1700)) * TIME.MIN;
  const acked = o.acked ?? rng.next() < 0.88;
  const ackMs = acked ? Math.min(now - TIME.MIN, sentMs + rng.int(8, 40) * TIME.MIN) : null;
  const a = {
    id, identifier: `BEACON.${sender.toUpperCase()}.${id}`, sender, sent: iso(sentMs), status: 'Actual', msgType: 'Alert', category: CAP_CATEGORY[hazard] || 'Met',
    event: EVENT[hazard], urgency: severity === 'Extreme' ? 'Immediate' : 'Expected', severity, certainty: rng.pick(['Likely', 'Possible', 'Observed']), effective: iso(sentMs),
    expires: iso(expiresMs), headline: `${EVENT[hazard]} for ${district}`, description: `${EVENT[hazard]} for ${district}, ${STATE_NAME[stateCode]}.`,
    instruction: 'Review against local observations and follow SOP.', areaDesc: `${district} — ${STATE_NAME[stateCode]}`, hazard, stateCode, districts: [district],
    classification: o.historical ? 'Historical' : 'Official', cancelled: false, ackBy: acked ? 'op-01' : null, ackAt: acked ? iso(ackMs) : null,
    linkedIncidentIds: [], notes: [], history: [{ at: iso(sentMs), msgType: 'Alert', note: 'Initial issue' }], origin: o.historical ? 'baseline' : 'live',
  };
  if (o.cancelledMinAgo != null) {
    const at = iso(now - o.cancelledMinAgo * TIME.MIN);
    a.cancelled = true; a.msgType = 'Cancel'; a.history.push({ at, msgType: 'Cancel', note: 'Cancelled by issuing agency' });
  }
  if (o.historical) a.expires = iso(Math.min(expiresMs, now - TIME.HOUR));
  return a;
}

/**
 * A task at a given lifecycle stage (or legacy status). Stage log, history, team fit and findings/evidence are filled in
 * consistently by normalizeTask, so seeded, live and operator-created tasks all look the same.
 */
export function makeTask(rng, alloc, o) {
  const { incident, now } = o;
  const hazard = incident ? incident.hazard : 'flood';
  const status = o.status || 'Unassigned';
  const stage = o.stage || (status === 'In Progress' ? rng.pick(['En route', 'On site'])
    : ({ Unassigned: 'Created', Assigned: 'Assigned', 'Awaiting Verification': 'Findings submitted', Completed: 'Completed' }[status] || 'Created'));
  const id = alloc('TSK');
  const createdMs = now - (o.ageMin ?? 0) * TIME.MIN;
  const open = stage !== 'Completed';
  const dueMs = o.dueInMin != null ? now + o.dueInMin * TIME.MIN : createdMs + rng.int(2, 10) * TIME.HOUR;
  const base = {
    id, incidentId: incident ? incident.id : null, category: o.category || (PLAYBOOK[hazard] || PLAYBOOK.flood)[0],
    location: incident ? incident.location : o.location, stateCode: incident ? incident.stateCode : o.stateCode,
    priority: incident && ['High', 'Critical'].includes(incident.severity) ? 'High' : rng.pick(['Medium', 'Medium', 'Low']),
    assignee: null, stage, status: STAGE_STATUS[stage], createdAt: iso(createdMs), dueAt: open ? iso(dueMs) : null,
    instructions: 'Verify conditions on site and report findings.', completionNotes: '', evidenceRefs: [],
    completedAt: stage === 'Completed' ? iso(now - (o.completedMinAgo ?? rng.int(20, 600)) * TIME.MIN) : null,
    history: [], stageLog: [], origin: 'live',
  };
  return normalizeTask(base, { rng, now, teams: o.teams || [] });
}

/** 1-3 response tasks from the hazard playbook for a new incident; ids are added to incident.taskIds. */
export function makeIncidentTasks(rng, alloc, incident, { now, teams, ageMin, fresh }) {
  const list = PLAYBOOK[incident.hazard] || PLAYBOOK.flood;
  const n = Math.min(list.length, rng.weighted([{ v: 1, w: 25 }, { v: 2, w: 50 }, { v: 3, w: 25 }]));
  const advanced = ['Confirmed', 'Response in Progress'].includes(incident.status);
  const weights = fresh ? [{ v: 'Created', w: 60 }, { v: 'Assigned', w: 40 }] : advanced
    ? [{ v: 'Created', w: 6 }, { v: 'Assigned', w: 18 }, { v: 'En route', w: 20 }, { v: 'On site', w: 22 }, { v: 'Findings submitted', w: 14 }, { v: 'Completed', w: 20 }]
    : [{ v: 'Created', w: 16 }, { v: 'Assigned', w: 40 }, { v: 'En route', w: 44 }];
  const incAge = ageMin != null ? ageMin : Math.max(2, Math.round((now - new Date(incident.createdAt).getTime()) / TIME.MIN));
  const tasks = [];
  for (let k = 0; k < n; k += 1) {
    const age = Math.max(1, incAge - rng.int(2, 20));
    tasks.push(makeTask(rng, alloc, {
      incident, now, teams, category: list[k], stage: rng.weighted(weights), ageMin: age,
      completedMinAgo: rng.int(10, Math.max(12, age)),
      dueInMin: rng.next() < 0.07 ? -rng.int(20, 300) : rng.int(40, 600),
    }));
  }
  // An active incident always keeps at least one open task.
  if (tasks.every((t) => t.stage === 'Completed')) tasks[tasks.length - 1] = makeTask(rng, alloc, { incident, now, teams, category: list[n - 1], stage: 'On site', ageMin: Math.max(1, incAge - 5), dueInMin: rng.int(40, 400) });
  tasks.forEach((t) => { incident.taskIds.push(t.id); });
  return tasks;
}
