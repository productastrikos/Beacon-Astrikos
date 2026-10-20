import { createRng } from '../../utils/prng';
import { isoAgo, TIME } from '../../utils/format';
import { DISTRICTS, STATE_HAZARDS, STATE_NAME } from './geography';

const STATE_WEIGHTS = [
  { v: 'AR', w: 6 }, { v: 'AS', w: 4 }, { v: 'SK', w: 2 }, { v: 'HP', w: 3 }, { v: 'UK', w: 3 }, { v: 'JK', w: 2 },
  { v: 'KL', w: 1 }, { v: 'OD', w: 1 }, { v: 'BR', w: 1 }, { v: 'RJ', w: 1 }, { v: 'ML', w: 1 }, { v: 'WB', w: 1 }, { v: 'MH', w: 1 },
];
const HAZ_NAME = {
  flood: 'River level / flooding', landslide: 'Landslide', earthquake: 'Earthquake inspection',
  avalanche: 'Avalanche danger', wildfire: 'Forest fire detection', heatwave: 'Heatwave', coldwave: 'Cold wave',
};
const CAP_BY_SEV = { Low: 'Minor', Moderate: 'Moderate', High: 'Severe', Critical: 'Extreme' };

/**
 * Deterministic 90-day history: closed incidents, expired alerts, completed
 * tasks, used for trends and analytics.
 */
export function buildHistory(base) {
  const rng = createRng(20261013);
  const incidents = [];
  const alerts = [];
  const tasks = [];

  for (let i = 0; i < 220; i += 1) {
    const state = rng.weighted(STATE_WEIGHTS);
    const hazard = rng.pick(STATE_HAZARDS[state]);
    const district = rng.pick(DISTRICTS[state]);
    const ageMin = rng.int(60 * 30, 60 * 24 * 88);
    const severity = rng.weighted([{ v: 'Low', w: 3 }, { v: 'Moderate', w: 4 }, { v: 'High', w: 2 }, { v: 'Critical', w: 0.6 }]);
    const verifiedOutcome = rng.weighted([{ v: 'Confirmed', w: 7 }, { v: 'Unconfirmed', w: 2 }]);
    const id = `INC-H${String(i + 1).padStart(3, '0')}`;
    const createdAt = isoAgo(base, ageMin);
    const closeAfter = rng.int(6, 96) * 60;
    const closedAt = new Date(new Date(createdAt).getTime() + closeAfter * TIME.MIN).toISOString();
    const verifyMin = rng.int(20, 360);
    incidents.push({
      id, title: `${HAZ_NAME[hazard]} — ${district}`, hazard,
      description: 'Historical demo record.',
      stateCode: state, district, location: `${district} district`,
      linkedAlertIds: [], provenance: 'Historical record',
      severity,
      verification: verifiedOutcome === 'Confirmed' ? 'Verified' : 'Not Verified',
      status: 'Closed',
      assignedOperator: 'op-01', assignedTeam: null,
      createdAt, updatedAt: closedAt, dueAt: null,
      taskIds: [], resourceIds: [], notes: [],
      timeline: [
        { id: `${id}-t0`, at: createdAt, by: 'System', type: 'created', text: 'Incident created' },
        { id: `${id}-t1`, at: closedAt, by: 'op-01', type: 'status', text: 'Status: Closed' },
      ],
      closureReason: verifiedOutcome === 'Confirmed' ? 'Event concluded' : 'Not confirmed on verification',
      verifyMinutes: verifyMin,
      origin: 'baseline', historical: true,
    });

    // matching historical alert
    const sentMinAgo = ageMin + rng.int(10, 180);
    const sent = isoAgo(base, sentMinAgo);
    const ackDelay = rng.weighted([{ v: rng.int(4, 20), w: 4 }, { v: rng.int(21, 70), w: 3 }, { v: rng.int(71, 240), w: 1.2 }, { v: null, w: 0.8 }]);
    const aid = `A-H${String(i + 1).padStart(3, '0')}`;
    const sender = hazard === 'earthquake' ? 'usgs' : hazard === 'wildfire' ? 'firms' : hazard === 'flood' && rng.next() > 0.5 ? 'cwc' : 'imd';
    const a = {
      id: aid, identifier: `BEACON.${sender.toUpperCase()}.${aid}`, sender, sent,
      status: 'Exercise', msgType: 'Alert', category: 'Met', event: HAZ_NAME[hazard],
      urgency: 'Expected', severity: CAP_BY_SEV[severity], certainty: 'Likely',
      effective: sent, expires: new Date(new Date(sent).getTime() + 24 * TIME.HOUR).toISOString(),
      headline: `${HAZ_NAME[hazard]} — ${district} (historical sample)`,
      description: 'Historical demo record.', instruction: '',
      areaDesc: `${district} — ${STATE_NAME[state]}`,
      hazard, stateCode: state, districts: [district], classification: 'Historical',
      cancelled: false,
      ackBy: ackDelay == null ? null : 'op-01',
      ackAt: ackDelay == null ? null : new Date(new Date(sent).getTime() + ackDelay * TIME.MIN).toISOString(),
      linkedIncidentIds: [id], notes: [],
      history: [{ at: sent, msgType: 'Alert', note: 'Initial issue' }],
      origin: 'baseline', historical: true,
    };
    alerts.push(a);
    incidents[incidents.length - 1].linkedAlertIds.push(aid);

    // historical tasks (1–2 per incident)
    const n = rng.int(1, 2);
    for (let k = 0; k < n; k += 1) {
      const tid = `TSK-H${String(tasks.length + 1).padStart(3, '0')}`;
      const tCreated = new Date(new Date(createdAt).getTime() + rng.int(10, 90) * TIME.MIN).toISOString();
      const dur = rng.int(40, 1200);
      const tDone = new Date(new Date(tCreated).getTime() + dur * TIME.MIN).toISOString();
      const status = rng.weighted([{ v: 'Completed', w: 9 }, { v: 'Cancelled', w: 1 }]);
      tasks.push({
        id: tid, incidentId: id,
        category: rng.pick(['Field verification', 'Road assessment', 'Infrastructure inspection', 'Monitoring review']),
        location: `${district} district`, stateCode: state,
        priority: rng.pick(['Low', 'Medium', 'High']),
        assignee: null, status, createdAt: tCreated,
        dueAt: new Date(new Date(tCreated).getTime() + 12 * TIME.HOUR).toISOString(),
        completedAt: status === 'Completed' ? tDone : null,
        instructions: 'Historical task.',
        completionNotes: status === 'Completed' ? 'Completed.' : '',
        evidenceRefs: [],
        history: [{ id: `${tid}-h0`, at: tCreated, by: 'System', text: 'Task created (historical)' }],
        origin: 'baseline', historical: true,
      });
      incidents[incidents.length - 1].taskIds.push(tid);
    }
  }
  return { incidents, alerts, tasks };
}
