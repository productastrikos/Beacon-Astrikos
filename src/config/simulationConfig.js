/**
 * Live-simulation settings.
 *
 * Change the tick speed: edit `tickMs` (min/max milliseconds between ticks, jittered).
 * Turn the simulation off:
 *   - at build/run time: set REACT_APP_LIVE=false (e.g. `REACT_APP_LIVE=false npm start`), or
 *   - at runtime: use the Live / Paused toggle in the header.
 * The engine is always off under Jest (NODE_ENV=test).
 */
export const SIM = {
  enabled: process.env.NODE_ENV !== 'test' && process.env.REACT_APP_LIVE !== 'false',
  tickMs: { min: 5000, max: 6000 },
  eventsPerTick: { min: 1, max: 3 },
  eventLogSize: 50,
  maxLiveIncidents: 600,
  /** Resolved live incidents kept in the register before the oldest are pruned (keeps stored state small). */
  keepResolved: 120,
  maxSourcesOffline: 2,
  /** Relative weights of event types per tick. */
  eventWeights: {
    newIncident: 18,
    escalate: 10,
    verify: 8,
    advance: 14,
    warningIssue: 8,
    warningExpire: 4,
    sourceToggle: 1,
  },
  /** Severity mix for newly created incidents. */
  severityWeights: { Low: 30, Moderate: 35, High: 25, Critical: 10 },
};
