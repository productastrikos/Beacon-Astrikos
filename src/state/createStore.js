import { useSyncExternalStore } from 'react';

/** Minimal external store with optional guarded localStorage persistence. */
export function createStore(initialFactory, { storageKey, storage = 'local', validate } = {}) {
  const area = () => {
    try { return storage === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; }
  };

  function hydrate() {
    if (storageKey) {
      try {
        const raw = area()?.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!validate || validate(parsed)) return parsed;
        }
      } catch { /* corrupt or unavailable storage: fall back to defaults */ }
    }
    return initialFactory();
  }

  let state = hydrate();
  const listeners = new Set();

  function persist() {
    if (!storageKey) return;
    try { area()?.setItem(storageKey, JSON.stringify(state)); } catch { /* quota / private mode */ }
  }

  const store = {
    get: () => state,
    set(updater) {
      const next = typeof updater === 'function' ? updater(state) : updater;
      if (next === state) return;
      state = next;
      persist();
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    reset(next) {
      state = next !== undefined ? next : initialFactory();
      persist();
      listeners.forEach((l) => l());
    },
    clearPersisted() {
      try { area()?.removeItem(storageKey); } catch { /* ignore */ }
    },
  };

  function useStore(selector = (s) => s) {
    return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
  }
  store.use = useStore;
  return store;
}
