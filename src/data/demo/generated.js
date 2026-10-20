import { createRng } from '../../utils/prng';
import { STATE_HAZARDS } from './geography';
import { HAZARD_KEYS } from '../../types';
import { buildStations } from './stationModel';
import { makeIncident, makeWarning, makeIncidentTasks } from './factories';
import { isEligible } from '../../config/hazardRegions';
import { TEAMS } from './people';

/**
 * Deterministic generator for the operational dataset: monitoring stations, active incidents, warnings and tasks for every
 * hazard x state, plus 30 days of expired warnings. Same seed => same data on every load.
 */
const STATES = Object.keys(STATE_HAZARDS);
const PREFIX = { INC: 'INC-', ALT: 'A-', TSK: 'TSK-' };

export function buildGenerated(base, seq) {
  const rng = createRng(20261014);
  const alloc = (k) => { seq[k] += 1; return `${PREFIX[k]}${seq[k]}`; };
  const records = []; const incidents = []; const alerts = []; const tasks = [];

  STATES.forEach((st) => {
    const teams = TEAMS.filter((t) => t.stateCode === st);
    HAZARD_KEYS.forEach((hz) => {
      records.push(...buildStations(hz, st, rng, base));
      if (!isEligible(hz, st)) return;
      const nInc = 1 + (rng.next() < 0.25 ? 1 : 0) + (rng.next() < 0.08 ? 1 : 0);
      const made = [];
      for (let i = 0; i < nInc; i += 1) {
        const inc = makeIncident(rng, alloc, {
          stateCode: st, hazard: hz, now: base, ageMin: rng.int(8, 1300),
          status: rng.weighted([{ v: 'Reported', w: 22 }, { v: 'Under Verification', w: 26 }, { v: 'Confirmed', w: 10 }, { v: 'Response in Progress', w: 32 }]),
        });
        incidents.push(inc); made.push(inc);
        const ts = makeIncidentTasks(rng, alloc, inc, { now: base, teams });
        tasks.push(...ts);
      }
      const nWarn = 1 + (rng.next() < 0.45 ? 1 : 0);
      for (let i = 0; i < nWarn; i += 1) {
        const unacked = rng.next() < 0.12;
        const a = makeWarning(rng, alloc, { stateCode: st, hazard: hz, now: base, acked: !unacked, ageMin: unacked ? rng.int(10, 90) : rng.int(45, 1200) });
        const match = made.find((x) => x.district === a.districts[0]) || (rng.next() < 0.55 ? rng.pick(made) : null);
        if (match) { a.linkedIncidentIds.push(match.id); match.linkedAlertIds.push(a.id); }
        alerts.push(a);
      }
    });
    // Expired warnings from the last 30 days (about 25 per state) for the register and analytics.
    for (let i = 0; i < 25; i += 1) {
      alerts.push(makeWarning(rng, alloc, {
        stateCode: st, hazard: rng.pick(HAZARD_KEYS.filter((h) => isEligible(h, st))), now: base, historical: true, expired: true, ageMin: rng.int(1500, 43200), acked: rng.next() < 0.9,
      }));
    }
  });

  return { records, incidents, alerts, tasks };
}
