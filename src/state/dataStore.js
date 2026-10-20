import { createStore } from './createStore';
import { buildBaseline, BASELINE_VERSION } from '../data/demo/baseline';
import { getSession } from './session';
import { ROLES } from '../types';

/**
 * Shared operational data store (incidents, alerts, tasks, resources, records,
 * audit, simulation runs). Persisted to localStorage under a dedicated key,
 * isolated from the auth session. Contains no secrets and no real data.
 */
export const DATA_STORAGE_KEY = 'beacon.demo.data.v1';

function normalise(s) {
  // A reload mid-simulation cannot resume the timer, so show those runs as paused.
  const runs = Object.fromEntries(Object.entries(s.simRuns || {}).map(([k, r]) => [k, r.status === 'running' ? { ...r, status: 'paused' } : r]));
  return { ...s, simRuns: runs };
}

export const dataStore = createStore(() => buildBaseline(), {
  storageKey: DATA_STORAGE_KEY,
  validate: (p) => p && p.version === BASELINE_VERSION && Array.isArray(p.incidents),
});
dataStore.reset(normalise(dataStore.get()));

export const getData = () => dataStore.get();
export const useData = (selector) => dataStore.use(selector);

export const nowIso = () => new Date().toISOString();

/** Current acting user, from the session. */
export function actor() {
  const s = getSession();
  if (!s) return { id: 'anonymous', name: 'Anonymous', role: null, roleLabel: '—' };
  return { id: s.user.id, name: s.user.name, role: s.user.role, roleLabel: ROLES[s.user.role] || s.user.role };
}

/** Returns a new state with an audit entry prepended and the sequence advanced. */
export function addAudit(s, e) {
  const a = actor();
  const n = s.seq.AUD + 1;
  const entry = {
    id: `AUD-${n}`,
    at: e.at || nowIso(),
    userId: e.userId || a.id,
    userName: e.userName || a.name,
    role: e.roleLabel || a.roleLabel,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    previous: e.previous ?? null,
    next: e.next ?? null,
    outcome: e.outcome || 'Success',
    source: e.source || 'operator',
    detail: e.detail || '',
    simRunId: e.simRunId || null,
  };
  return { ...s, seq: { ...s.seq, AUD: n }, audit: [entry, ...s.audit].slice(0, 400) };
}

export function nextSeq(s, key) {
  const n = (s.seq[key] || 0) + 1;
  return [n, { ...s, seq: { ...s.seq, [key]: n } }];
}

/** Display name for any assignee id: user, operator roster entry or team. */
export function resetData() {
  dataStore.reset(buildBaseline());
}
