import { createStore } from './createStore';

/** Persisted, non-sensitive UI preferences. */
const UI_KEY = 'beacon.ui.v1';

function legacyTheme() {
  try {
    const t = window.localStorage.getItem('app_theme');
    if (t === 'light' || t === 'dark') return t;
  } catch { /* storage unavailable */ }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch { /* ignore */ }
  return 'dark';
}

export const uiStore = createStore(
  () => ({ scope: 'IN', theme: legacyTheme(), sidebarCollapsed: false, groupsCollapsed: {} }),
  { storageKey: UI_KEY, validate: (p) => p && typeof p.scope === 'string' },
);

export const useUi = (selector) => uiStore.use(selector);
export const setScope = (scope) => uiStore.set((s) => ({ ...s, scope }));
export const setTheme = (theme) => uiStore.set((s) => ({ ...s, theme }));
export const toggleSidebar = () => uiStore.set((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
export const toggleGroup = (key) => uiStore.set((s) => ({ ...s, groupsCollapsed: { ...s.groupsCollapsed, [key]: !s.groupsCollapsed[key] } }));

/** Transient toast queue (not persisted). Auto-dismiss is handled per toast by <Toasts/> so hover can pause it. */
let toastSeq = 0;
export const toastStore = createStore(() => []);
toastStore.push = ({ kind = 'info', title, text }) => {
  toastSeq += 1;
  const id = toastSeq;
  toastStore.set((list) => [...list, { id, kind, title, text }].slice(-3));
};
toastStore.dismiss = (id) => toastStore.set((list) => list.filter((t) => t.id !== id));

/** Keep <body data-theme> in sync synchronously so charts read the right CSS tokens on first paint. */
if (typeof document !== 'undefined') {
  document.body.dataset.theme = uiStore.get().theme;
  uiStore.subscribe(() => { document.body.dataset.theme = uiStore.get().theme; });
}
