import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight, LogOut, UserCog, ShieldAlert, Sparkles,
} from 'lucide-react';
import { NAV_GROUPS, matchNav } from './navConfig';
import { useAuth, useScoped } from '../state/hooks';
import { useUi, setScope, setTheme, toggleSidebar, toggleGroup } from '../state/uiStore';
import { attentionItems } from '../state/selectors';
import { endSession, startSession } from '../state/session';
import { listDemoUsers } from '../services/authService';
import { SCOPES, ROLES } from '../types';
import { IconButton } from '../components/ui/Controls';
import { HazardIcon } from '../components/ui/HazardIcon';
import { UI_ICON } from '../config/icons';
import { Drawer } from '../components/ui/Overlay';
import AdvisoryPanel from '../components/domain/AdvisoryPanel';
import TaskDrawer from '../components/domain/TaskDrawer';
import IncidentDrawer from '../components/domain/IncidentDrawer';
import { useDrawerParam } from '../state/useDrawerParam';
import Toasts from '../components/ui/Toasts';

import { toastStore } from '../state/uiStore';
import LiveDataProvider, { useLiveData } from '../state/LiveDataProvider';
import { EmptyState } from '../components/ui/Layout';
import { ShieldOff } from 'lucide-react';

function useOutsideClose(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [ref, open, close]);
}

function LiveControls() {
  const { degraded } = useLiveData();
  return (
    <span className={`bx-sys-pill ${degraded ? 'is-degraded' : 'is-ok'}`} role="status">
      <span className="bx-dot" aria-hidden="true" />{degraded ? 'DEGRADED' : 'SYSTEM OPERATIONAL'}
    </span>
  );
}

function Sidebar({ collapsed }) {
  const { canAccess } = useAuth();
  const groupsCollapsed = useUi((s) => s.groupsCollapsed);
  const { data } = useScoped();
  const hazardsEnabled = data.settings.hazardsEnabled;

  return (
    <aside className={`bx-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Primary">
      <div className="bx-brand">
        <img className="bx-brand-logo" src={`${process.env.PUBLIC_URL}/astrikos-logo.png`} alt="Astrikos" />
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div className="bx-brand-title">ASTRIKOS BEACON</div>
            <div className="bx-brand-sub">INTERNAL OPERATIONS</div>
          </div>
        )}
      </div>
      <nav className="bx-nav" aria-label="Modules">
        {NAV_GROUPS.map((g, gi) => {
          const items = g.items.filter((i) => !i.hidden && canAccess(i.module));
          if (!items.length) return null;
          const isCollapsed = !collapsed && groupsCollapsed[g.key];
          return (
            <div key={g.key}>
              {collapsed ? (gi > 0 && <div className="bx-nav-sep" />) : (
                <button type="button" className="bx-nav-group-btn" onClick={() => toggleGroup(g.key)} aria-expanded={!isCollapsed}>
                  {g.label}
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              {!isCollapsed && items.map((item) => {
                const disabled = item.hazard && hazardsEnabled[item.hazard] === false;
                return (
                  <NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined} aria-label={item.label}
                    className={({ isActive }) => `bx-nav-item ${isActive ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}>
                    <HazardIcon name={item.iconName} size={16} />
                    {!collapsed && <span className="bx-nav-label">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function Header({ collapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, scope, now } = useScoped();
  const theme = useUi((s) => s.theme);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [adv, setAdv] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);
  useOutsideClose(bellRef, bell, () => setBell(false));
  useOutsideClose(menuRef, menu, () => setMenu(false));

  const nav = matchNav(location.pathname);
  const detail = location.pathname.split('/').filter(Boolean)[1];
  const isDetail = nav && detail && !location.pathname.startsWith('/hazards');
  const items = useMemo(() => attentionItems(data, scope, now), [data, scope, now]);
  const { events, unread, markRead } = useLiveData();
  const demoUsers = useMemo(() => listDemoUsers(), []);

  const switchUser = (u) => {
    startSession(u, false);
    setScope(u.homeScope);
    setMenu(false);
    toastStore.push({ kind: 'info', text: `Role switched to ${ROLES[u.role]}.` });
    navigate('/command-centre');
  };

  return (
    <header className="bx-header">
      <IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleSidebar} />
      <div className="bx-crumbs">
        <div className="bx-crumb-trail">
          Beacon{nav ? ` › ${nav.group}` : ''}{nav ? ` › ${nav.label}` : ''}{isDetail ? ` › ${detail}` : ''}
        </div>
        <div className="bx-crumb-title">{isDetail ? detail : nav ? nav.label : 'Astrikos Beacon'}</div>
      </div>
      <div className="bx-header-spacer" />
      <div className="bx-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <HazardIcon name={scope === 'IN' ? UI_ICON.scopeIndia : UI_ICON.scopeState} size={18} label={scope === 'IN' ? 'PAN India scope' : 'State scope'} />
        <label className="bx-label" htmlFor="scope-select" style={{ whiteSpace: 'nowrap' }}>Scope</label>
        <select id="scope-select" className="bx-select is-compact" value={scope} onChange={(e) => setScope(e.target.value)}>
          {SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <LiveControls />
      <IconButton iconName={theme === 'dark' ? UI_ICON.themeToLight : UI_ICON.themeToDark} label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }} />
      <IconButton icon={Sparkles} label="AI Advisory" onClick={() => setAdv(true)} aria-haspopup="dialog" />
      {adv && (
        <Drawer open onClose={() => setAdv(false)} title="AI Advisory" subtitle="Insights generated from live operational data" width={580}>
          <AdvisoryPanel data={data} scope={scope} now={now} />
        </Drawer>
      )}

      <div style={{ position: 'relative' }} ref={bellRef}>
        <IconButton iconName={UI_ICON.notifications} label={`Notifications: ${unread} unread events, ${items.length} open items`} count={unread} onClick={() => { setBell((b) => !b); markRead(); }} aria-expanded={bell} />
        {bell && (
          <div className="bx-menu" style={{ width: 340 }} role="menu">
            <div className="bx-menu-label">Live events</div>
            {events.length === 0 && <div className="bx-faint" style={{ padding: 8 }}>No live events yet.</div>}
            {events.slice(0, 5).map((ev) => (
              <button key={ev.id} type="button" className="bx-menu-item" role="menuitem" onClick={() => { setBell(false); if (ev.to) navigate(ev.to); }}>
                <span className={`bx-action-dot tone-${ev.tone === 'critical' ? 'red' : ev.tone === 'warning' ? 'amber' : ev.tone === 'success' ? 'green' : 'blue'}`} aria-hidden="true" />
                <span style={{ minWidth: 0 }}><strong>{ev.title}</strong><br /><span className="bx-faint">{ev.detail}</span></span>
              </button>
            ))}
            <div className="bx-menu-label">Open items requiring attention ({items.length})</div>
            {items.length === 0 && <div className="bx-faint" style={{ padding: 8 }}>No open items in this scope.</div>}
            {items.slice(0, 8).map((it) => (
              <button key={`${it.kind}-${it.id}`} type="button" className="bx-menu-item" role="menuitem"
                onClick={() => { setBell(false); navigate(it.to); }}>
                <ShieldAlert size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>{it.text}</span>
              </button>
            ))}
            {items.length > 8 && <div className="bx-faint" style={{ padding: '4px 8px' }}>+{items.length - 8} more</div>}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }} ref={menuRef}>
        <button type="button" className="bx-row" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}
          style={{ background: 'none', border: 0, cursor: 'pointer', gap: 8, color: 'inherit' }}>
          <span className="bx-avatar" aria-hidden="true">{user.initials}</span>
          <span className="bx-hide-md" style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>{user.name}</span>
            <span style={{ display: 'block', fontSize: 10.5, color: 'var(--app-text-faint)' }}>{ROLES[user.role]}</span>
          </span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        {menu && (
          <div className="bx-menu" role="menu">
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <div className="bx-faint" style={{ fontSize: 11 }}>{ROLES[user.role]} · {user.email}</div>
            </div>
            <div className="bx-menu-label"><UserCog size={10} style={{ display: 'inline' }} /> Switch role</div>
            {demoUsers.filter((u) => u.id !== user.id).map((u) => (
              <button key={u.id} type="button" className="bx-menu-item" role="menuitem" onClick={() => switchUser(u)}>
                <span className="bx-avatar" style={{ width: 22, height: 22, fontSize: 9 }}>{u.initials}</span>
                {ROLES[u.role]}
              </button>
            ))}
            <div className="bx-nav-sep" />
            <button type="button" className="bx-menu-item" role="menuitem" onClick={() => { endSession(); navigate('/login'); }}>
              <LogOut size={14} aria-hidden="true" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function AccessDenied({ moduleLabel }) {
  const { user } = useAuth();
  return (
    <div className="bx-card" style={{ maxWidth: 560 }}>
      <EmptyState icon={ShieldOff} title="Access restricted for your role"
        hint={`${moduleLabel || 'This module'} is not available to ${ROLES[user.role]}.`} />
    </div>
  );
}

/** Drawers opened in place from any page via ?task= / ?incident= so Back closes them. */
function GlobalDrawers() {
  const task = useDrawerParam('task');
  const incident = useDrawerParam('incident');
  return (
    <>
      {task.value && <TaskDrawer taskId={task.value} act={task.act} onClose={task.close} />}
      {incident.value && <IncidentDrawer incidentId={incident.value} onClose={incident.close} />}
    </>
  );
}

function AppShellInner() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const { canAccess } = useAuth();
  const location = useLocation();
  const nav = matchNav(location.pathname);
  const allowed = !nav || canAccess(nav.module);
  return (
    <div className="bx-shell">
      <Sidebar collapsed={collapsed} />
      <div className="bx-main">
        <Header collapsed={collapsed} />
        <main className="bx-content" id="main-content">
          {allowed ? <Outlet /> : <AccessDenied moduleLabel={nav.label} />}
        </main>
      </div>
      <GlobalDrawers />
      <Toasts />
    </div>
  );
}

export default function AppShell() {
  return <LiveDataProvider><AppShellInner /></LiveDataProvider>;
}
