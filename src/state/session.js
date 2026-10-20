import { createStore } from './createStore';

/**
 * User session. Only the (non-secret) user profile is stored, never a password.
 * Session storage by default; "remember me" opts into localStorage.
 */
const KEY = 'beacon.demo.session.v1';

function read() {
  for (const area of ['sessionStorage', 'localStorage']) {
    try {
      const raw = window[area].getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.user && s.user.id) return s;
      }
    } catch { /* storage unavailable */ }
  }
  return null;
}

const store = createStore(() => read());

export const sessionStore = store;
export const getSession = () => store.get();
export const getUser = () => (store.get() ? store.get().user : null);

export function startSession(user, remember) {
  const session = { user, remember: !!remember, startedAt: new Date().toISOString() };
  try {
    window.sessionStorage.removeItem(KEY);
    window.localStorage.removeItem(KEY);
    (remember ? window.localStorage : window.sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch { /* ignore */ }
  store.reset(session);
}

export function endSession() {
  try {
    window.sessionStorage.removeItem(KEY);
    window.localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  store.reset(null);
}

export function useSession() {
  return store.use();
}
