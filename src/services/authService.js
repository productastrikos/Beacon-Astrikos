import { DEMO_USERS } from '../data/demo/people';

/**
 * Authentication adapter.
 * Browser-side implementation: credentials are checked in the browser against a
 * fixed roster. This is NOT production-grade security. Replace `authenticate`
 * with a call to the real identity service when a backend exists.
 */
export async function authenticate(identifier, password) {
  await new Promise((r) => setTimeout(r, 450)); // brief network round-trip
  const id = String(identifier || '').trim().toLowerCase();
  const user = DEMO_USERS.find((u) => u.username === id || u.email === id);
  if (!user || user.password !== password) {
    return { ok: false, error: 'Incorrect username or password.' };
  }
  const { password: _omit, ...safe } = user;
  return { ok: true, user: safe };
}

export function listDemoUsers() {
  return DEMO_USERS.map(({ password, ...u }) => u);
}
