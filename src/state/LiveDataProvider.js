import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { SIM } from '../config/simulationConfig';
import { liveStore, setLive, markEventsRead } from './liveStore';
import { runTick } from './liveEngine';
import { useData } from './dataStore';

const LiveContext = createContext(null);

/**
 * Owns the real-time loop. Ticks every SIM.tickMs (randomised) with setTimeout, pauses while the tab is hidden
 * or the user pauses the feed, and cleans up on unmount. Data lives in dataStore; this provider only drives it.
 */
export default function LiveDataProvider({ children }) {
  const live = liveStore.use((s) => s.live);
  const lastTick = liveStore.use((s) => s.lastTick);
  const events = liveStore.use((s) => s.events);
  const unread = liveStore.use((s) => s.unread);
  const sources = useData((s) => s.sources);

  useEffect(() => {
    if (!SIM.enabled || !live) return undefined;
    let timer = null;
    const schedule = () => {
      const delay = SIM.tickMs.min + Math.random() * (SIM.tickMs.max - SIM.tickMs.min);
      timer = setTimeout(() => { runTick(); schedule(); }, delay);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') schedule();
    };
    if (document.visibilityState === 'visible') schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [live]);

  const value = useMemo(() => ({
    enabled: SIM.enabled, live, setLive, lastTick, events, unread, markRead: markEventsRead,
    degraded: sources.some((x) => x.liveOffline),
  }), [live, lastTick, events, unread, sources]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLiveData() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLiveData must be used inside <LiveDataProvider>');
  return ctx;
}
