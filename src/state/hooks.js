import { useMemo, useEffect, useState } from 'react';
import { useData } from './dataStore';
import { useUi } from './uiStore';
import { useSession } from './session';
import { can, canAccess } from './permissions';
import { scopeFilter } from './selectors';

/** Clock that re-renders consumers every `ms` (default 30 s) for countdowns/expiry. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Current user + permission helpers. */
export function useAuth() {
  const session = useSession();
  const user = session ? session.user : null;
  return useMemo(() => ({
    user,
    role: user ? user.role : null,
    can: (p) => can(user && user.role, p),
    canAccess: (m) => canAccess(user && user.role, m),
  }), [user]);
}

/** Whole data slice, scope, and scope-filtered collections. */
export function useScoped() {
  const data = useData();
  const scope = useUi((s) => s.scope);
  const now = useNow();
  return useMemo(() => ({
    data, scope, now,
    incidents: scopeFilter(data.incidents, scope),
    alerts: scopeFilter(data.alerts, scope),
    tasks: scopeFilter(data.tasks, scope),
    resources: scopeFilter(data.resources, scope),
    records: scopeFilter(data.records, scope),
    flags: scopeFilter(data.flags, scope),
  }), [data, scope, now]);
}
