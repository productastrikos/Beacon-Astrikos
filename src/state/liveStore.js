import { createStore } from './createStore';
import { SIM } from '../config/simulationConfig';

/**
 * Transient live-feed state (not persisted): run flag, last tick time and the rolling event log.
 * The operational data itself (incidents, alerts, tasks, sources) stays in dataStore.
 */
export const liveStore = createStore(() => ({
  live: SIM.enabled,
  lastTick: new Date().toISOString(),
  events: [], // newest first, capped at SIM.eventLogSize
  unread: 0,
}));

let evSeq = 0;
export function logEvents(list) {
  if (!list.length) return;
  liveStore.set((s) => ({
    ...s,
    lastTick: new Date().toISOString(),
    events: [...list.map((e) => ({ ...e, id: ++evSeq, at: new Date().toISOString() })).reverse(), ...s.events].slice(0, SIM.eventLogSize),
    unread: s.unread + list.filter((e) => e.notable).length,
  }));
}
export const setLive = (live) => liveStore.set((s) => ({ ...s, live }));
export const markEventsRead = () => liveStore.set((s) => (s.unread ? { ...s, unread: 0 } : s));
export const touchTick = () => liveStore.set((s) => ({ ...s, lastTick: new Date().toISOString() }));
