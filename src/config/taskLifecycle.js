/**
 * Single source of truth for the task lifecycle.
 *   Created -> Assigned -> En route -> On site -> Findings submitted -> Verified -> Completed
 * Side states: Escalated (a flag that can co-exist with any stage) and Cancelled (terminal).
 * The legacy `status` field is always derived from the stage so every existing KPI keeps working:
 *   Created = Unassigned, Assigned = Assigned, En route / On site = In Progress,
 *   Findings submitted / Verified = Awaiting Verification, Completed = Completed.
 */
export const STAGES = ['Created', 'Assigned', 'En route', 'On site', 'Findings submitted', 'Verified', 'Completed'];

export const STAGE_STATUS = {
  Created: 'Unassigned', Assigned: 'Assigned', 'En route': 'In Progress', 'On site': 'In Progress',
  'Findings submitted': 'Awaiting Verification', Verified: 'Awaiting Verification', Completed: 'Completed',
};

const STATUS_STAGE = { Unassigned: 'Created', Assigned: 'Assigned', 'In Progress': 'En route', 'Awaiting Verification': 'Findings submitted', Completed: 'Completed' };

/** Current stage of a task (null when cancelled). Works for older records that only carry a status. */
export const stageOf = (t) => (t.status === 'Cancelled' ? null : (t.stage || STATUS_STAGE[t.status] || 'Created'));
export const stageIndex = (stage) => STAGES.indexOf(stage);
export const nextStageOf = (stage) => (stage && stageIndex(stage) < STAGES.length - 1 ? STAGES[stageIndex(stage) + 1] : null);

/** Minutes a task normally waits in a stage before the engine moves it on: [min, max]. Divided by TIME_SCALE (see below). */
export const STAGE_MINUTES = {
  Created: [1, 15], Assigned: [2, 10], 'En route': [10, 60], 'On site': [15, 90], 'Findings submitted': [10, 40], Verified: [0, 0],
};
/** The live view compresses real-world durations so progress is visible while watching (an operator shift is not waited out). */
export const TIME_SCALE = 6;

/** Response playbook per hazard: the tasks created with every new incident (first 1-3 are used). */
export const PLAYBOOK = {
  flood: ['Field verification', 'River gauge monitoring', 'Relief distribution'],
  landslide: ['Road assessment', 'Field verification', 'Relief distribution'],
  avalanche: ['Route closure check', 'Field verification'],
  earthquake: ['Structural inspection', 'Field verification', 'Relief distribution'],
  wildfire: ['Fire verification', 'Evacuation readiness check'],
  heatwave: ['Heat-action check', 'Cooling-centre readiness'],
  coldwave: ['Shelter readiness check', 'Field verification'],
};

/** Which team specialty fits a task category. */
const SPECIALTY = {
  'Field verification': ['Field verification'],
  'Fire verification': ['Field verification', 'Fire response'],
  'Monitoring review': ['Field verification'],
  'River gauge monitoring': ['Field verification'],
  'Community liaison': ['Field verification', 'Relief logistics'],
  'Road assessment': ['Infrastructure inspection', 'Landslide response'],
  'Infrastructure inspection': ['Infrastructure inspection'],
  'Structural inspection': ['Infrastructure inspection'],
  'Route closure check': ['Mountain rescue', 'Landslide response'],
  'Relief distribution': ['Relief logistics'],
  'Shelter readiness check': ['Relief logistics', 'Medical response'],
  'Evacuation readiness check': ['Fire response', 'Relief logistics'],
  'Medical response': ['Medical response'],
  'Heat-action': ['Heat-action'],
  'Heat-action check': ['Heat-action'],
  'Cooling-centre readiness': ['Heat-action', 'Medical response'],
};

export const specialtiesFor = (category) => SPECIALTY[category] || ['Field verification'];
export const teamFits = (team, category) => specialtiesFor(category).includes(team.specialty) || (team.specialty === 'Flood rescue' && /flood|gauge/i.test(category));

/** Best-fitting team of a state for a task category: matching specialty first, on-shift first. Falls back to field verification, then any team. */
export function teamFor(rng, teams, category) {
  const fits = teams.filter((t) => teamFits(t, category));
  const onShift = fits.filter((t) => !t.offShift);
  if (onShift.length) return rng.pick(onShift);
  if (fits.length) return rng.pick(fits);
  const fv = teams.filter((t) => t.specialty === 'Field verification');
  return fv.length ? rng.pick(fv) : (teams.length ? rng.pick(teams) : null);
}

const NOTES = {
  'Field verification': 'Conditions on site confirm the reported event; local officials informed.',
  'Fire verification': 'Burn area confirmed by the field team; spread contained along the ridge line.',
  'River gauge monitoring': 'Gauge readings logged at hourly intervals; level steady above warning mark.',
  'Road assessment': 'Debris on the carriageway assessed; single-lane passage possible with clearance.',
  'Route closure check': 'Route inspected; closure advisory recommended until snow stabilises.',
  'Structural inspection': 'Visual inspection completed; no structural damage to the main span.',
  'Infrastructure inspection': 'Inspection completed; minor cracking recorded, no immediate risk.',
  'Relief distribution': 'Relief material delivered and receipts collected from the camp in-charge.',
  'Evacuation readiness check': 'Evacuation routes and assembly points verified with the local team.',
  'Heat-action check': 'Water points and health-centre advisories confirmed in the affected blocks.',
  'Cooling-centre readiness': 'Cooling centres opened with water and ORS stock confirmed.',
  'Shelter readiness check': 'Shelters inspected; bedding and heating stock confirmed.',
};
export const findingsNote = (category) => NOTES[category] || 'Findings submitted by the field team after on-site checks.';
export const evidenceRef = (stateCode, n) => `PHOTO-${stateCode}-${2000 + (n % 900)}`;

/** Random wait (ms) before the engine advances a task out of `stage`. 20% of freshly created tasks wait much longer so an unassigned pool always exists. */
export function waitMs(rng, stage) {
  const [lo, hi] = STAGE_MINUTES[stage] || [0, 0];
  let min = lo + rng.next() * (hi - lo);
  if (stage === 'Created' && rng.next() < 0.2) min = 30 + rng.next() * 60;
  return Math.round((min * 60000) / TIME_SCALE);
}

/* ── pure helpers shared by the seed generator, the live engine and operator actions ───────────────── */

const iso = (ms) => new Date(ms).toISOString();
const MIN = 60000;

/** Moves a task to `stage` and records it in the stage log and task history. Pure: returns a new task. */
export function applyStage(task, stage, { at, by, teamName, note }) {
  const when = typeof at === 'number' ? iso(at) : at;
  const done = stage === 'Completed';
  const label = stage === 'Assigned' && teamName ? `Assigned — ${teamName}` : (teamName && ['En route', 'On site', 'Findings submitted'].includes(stage) ? `${stage} — ${teamName}` : stage);
  const next = {
    ...task, stage, status: STAGE_STATUS[stage], nextAt: null,
    stageLog: [...(task.stageLog || []), { stage, at: when, by }],
    history: [...task.history, { id: `${task.id}-h${task.history.length}`, at: when, by, text: note ? `${label} — ${note}` : label }],
  };
  if (done) next.completedAt = when;
  if (stage === 'Findings submitted' && !task.evidenceRefs.length) {
    const n = Number(String(task.id).replace(/\D/g, '')) || 0;
    next.evidenceRefs = [evidenceRef(task.stateCode, n)];
  }
  if (stage === 'Findings submitted' && !task.completionNotes) next.completionNotes = findingsNote(task.category);
  return next;
}

/**
 * Brings a task in line with the lifecycle rules: stage and status agree, an open task past Created has a team that fits its
 * category, findings/evidence exist only from "Findings submitted" onward, and the stage log + history are complete.
 */
export function normalizeTask(t, { rng, now, teams }) {
  if (t.historical || t.status === 'Cancelled') return { ...t, stage: stageOf(t), stageLog: t.stageLog || [] };
  const stage = stageOf(t);
  const idx = stageIndex(stage);
  let assignee = t.assignee;
  if (stage === 'Created') assignee = null;
  else if (!assignee || !teams.some((x) => x.id === assignee && teamFits(x, t.category))) {
    const team = teamFor(rng, teams, t.category);
    assignee = team ? team.id : assignee;
  }
  const team = teams.find((x) => x.id === assignee);
  const created = new Date(t.createdAt).getTime();
  const end = stage === 'Completed' && t.completedAt ? new Date(t.completedAt).getTime() : now;
  const span = Math.max(end - created, MIN * (idx + 1));
  const at = (i) => iso(i === idx && stage === 'Completed' && t.completedAt ? t.completedAt : created + Math.round((span * i) / (idx + 1)));
  const stageLog = [{ stage: 'Created', at: t.createdAt, by: 'System' }];
  const history = [{ id: `${t.id}-h0`, at: t.createdAt, by: 'System', text: 'Created' }];
  for (let i = 1; i <= idx; i += 1) {
    const s = STAGES[i];
    const by = 'System';
    const label = ['Assigned', 'En route', 'On site', 'Findings submitted'].includes(s) && team ? `${s} — ${team.name}` : s;
    stageLog.push({ stage: s, at: at(i), by });
    history.push({ id: `${t.id}-h${history.length}`, at: at(i), by, text: label });
  }
  const hasFindings = idx >= stageIndex('Findings submitted');
  const n = Number(String(t.id).replace(/\D/g, '')) || 0;
  return {
    ...t, stage, status: STAGE_STATUS[stage], assignee, stageLog, history,
    completionNotes: hasFindings ? (t.completionNotes && !/awaiting|field team\.$/i.test(t.completionNotes) ? t.completionNotes : findingsNote(t.category)) : '',
    evidenceRefs: hasFindings ? (t.evidenceRefs && t.evidenceRefs.length ? t.evidenceRefs : [evidenceRef(t.stateCode, n)]) : [],
    completedAt: stage === 'Completed' ? (t.completedAt || at(idx)) : null,
    nextAt: stage === 'Completed' ? null : now + waitMs(rng, stage),
  };
}
