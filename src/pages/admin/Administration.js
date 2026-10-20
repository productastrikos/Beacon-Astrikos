import React, { useState } from 'react';
import { useData } from '../../state/dataStore';
import { useAuth } from '../../state/hooks';
import { PageHeader, Card, Tabs, Banner } from '../../components/ui/Layout';
import DataTable from '../../components/tables/DataTable';
import { Badge, SourceStatusBadge } from '../../components/ui/Badges';
import { Button, TextInput } from '../../components/ui/Controls';
import { PromptModal } from '../../components/ui/Overlay';
import { DEMO_USERS } from '../../data/demo/people';
import { ROLES, HAZARDS, INCIDENT_STATUSES, INCIDENT_TRANSITIONS, TASK_STATUSES, TASK_TRANSITIONS } from '../../types';
import { ROLE_PERMISSIONS, ROLE_MODULES, MODULES, PERMISSION_LABEL } from '../../state/permissions';
import { setHazardEnabled, setSimInterval, resetDemoData } from '../../state/actions';
import { SCOPES } from '../../types';
import { DATA_STORAGE_KEY } from '../../state/dataStore';

export default function Administration() {
  const data = useData();
  const { can } = useAuth();
  const [tab, setTab] = useState('users');
  const [interval, setIntervalValue] = useState(String(data.settings.simStepSeconds));
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState('');
  const admin = can('admin.manage');

  const userCols = [
    { id: 'name', header: 'Name', accessor: (r) => r.name },
    { id: 'user', header: 'Username', accessor: (r) => r.username, cell: (r) => <span className="bx-mono">{r.username}</span> },
    { id: 'email', header: 'Email', accessor: (r) => r.email },
    { id: 'role', header: 'Role', accessor: (r) => ROLES[r.role] },
    { id: 'scope', header: 'Home scope', accessor: (r) => SCOPES.find((s) => s.key === r.homeScope)?.label },
    { id: 'mods', header: 'Modules', num: true, accessor: (r) => ROLE_MODULES[r.role].length },
    { id: 'perms', header: 'Permissions', num: true, accessor: (r) => ROLE_PERMISSIONS[r.role].length },
  ];

  const permKeys = Object.keys(PERMISSION_LABEL);
  const matrixCols = [
    { id: 'p', header: 'Permission', accessor: (r) => PERMISSION_LABEL[r] },
    ...Object.entries(ROLES).map(([k, label]) => ({
      id: k, header: label, accessor: (r) => (ROLE_PERMISSIONS[k].includes(r) ? 'Yes' : 'No'), sortable: false,
      cell: (r) => (ROLE_PERMISSIONS[k].includes(r) ? <Badge color="green">Yes</Badge> : <span className="bx-faint">—</span>),
    })),
  ];
  const moduleCols = [
    { id: 'm', header: 'Module', accessor: (r) => MODULES[r] },
    ...Object.entries(ROLES).map(([k, label]) => ({
      id: k, header: label, sortable: false, accessor: (r) => (ROLE_MODULES[k].includes(r) ? 'Yes' : 'No'),
      cell: (r) => (ROLE_MODULES[k].includes(r) ? <Badge color="green">Yes</Badge> : <span className="bx-faint">—</span>),
    })),
  ];

  return (
    <>
      <PageHeader title="Administration" description="User roster, role matrix, hazard configuration, workflow statuses, sources and simulation settings." />
      {msg && <div style={{ marginBottom: 12 }}><Banner kind="danger">{msg}</Banner></div>}
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'users', label: 'Users' }, { key: 'roles', label: 'Role permissions' }, { key: 'modules', label: 'Module access' },
        { key: 'hazards', label: 'Hazard configuration' }, { key: 'status', label: 'Status configuration' },
        { key: 'sources', label: 'Source configuration' }, { key: 'sim', label: 'Simulation & data' },
      ]} />

      {tab === 'users' && <Card title="User roster" subtitle="Configured user accounts" flush><DataTable columns={userCols} rows={DEMO_USERS} searchable={false} caption="Users" pageSize={10} /></Card>}
      {tab === 'roles' && <Card title="Permissions by role" flush><DataTable columns={matrixCols} rows={permKeys} rowKey={(r) => r} searchable={false} pageSize={30} caption="Role permissions" /></Card>}
      {tab === 'modules' && <Card title="Module access by role" flush><DataTable columns={moduleCols} rows={Object.keys(MODULES)} rowKey={(r) => r} searchable={false} pageSize={20} caption="Module access" /></Card>}

      {tab === 'hazards' && (
        <Card title="Hazard module configuration" subtitle="Disabling marks a module as disabled in navigation and on its page">
          {HAZARDS.map((h) => {
            const on = data.settings.hazardsEnabled[h.key] !== false;
            return (
              <div key={h.key} className="bx-row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--app-border-soft)' }}>
                <span>{h.label}</span>
                <span className="bx-row">
                  <Badge color={on ? 'green' : 'grey'}>{on ? 'Enabled' : 'Disabled'}</Badge>
                  <Button size="sm" disabled={!admin} onClick={() => { const r = setHazardEnabled(h.key, !on); setMsg(r.ok ? '' : r.error); }}>{on ? 'Disable' : 'Enable'}</Button>
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {tab === 'status' && (
        <div className="bx-grid bx-grid-2">
          <Card title="Incident statuses and transitions">
            {INCIDENT_STATUSES.map((s) => (
              <div key={s} style={{ marginBottom: 6 }}><strong>{s}</strong> <span className="bx-muted">→ {INCIDENT_TRANSITIONS[s].join(', ') || 'terminal'}</span></div>
            ))}
            <p className="bx-help">Status definitions are fixed in this build.</p>
          </Card>
          <Card title="Task statuses and transitions">
            {TASK_STATUSES.map((s) => (
              <div key={s} style={{ marginBottom: 6 }}><strong>{s}</strong> <span className="bx-muted">→ {TASK_TRANSITIONS[s].join(', ') || 'terminal'}</span></div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'sources' && (
        <Card title="Source configuration status" flush>
          <table className="bx-table">
            <thead><tr><th>Source</th><th>Status</th><th>Configuration</th><th>Access</th></tr></thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.id}><td>{s.name}</td><td><SourceStatusBadge value={s.status} /></td><td>{s.configStatus}</td><td className="bx-cell-wrap">{s.access}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'sim' && (
        <div className="bx-grid bx-grid-2">
          <Card title="Simulation settings">
            <div className="bx-row" style={{ alignItems: 'flex-end' }}>
              <TextInput label="Seconds between automatic steps" type="number" min="1" max="30" value={interval} onChange={(e) => setIntervalValue(e.target.value)} />
              <Button disabled={!admin} onClick={() => { const r = setSimInterval(interval); setMsg(r.ok ? '' : r.error); }}>Save</Button>
            </div>
            <p className="bx-help">Applies the next time a scenario is started or resumed.</p>
          </Card>
          <Card title="Data reset">
            <p className="bx-muted" style={{ marginBottom: 10 }}>Restores the full baseline dataset, clears operator changes, simulation runs and the local audit log.</p>
            <p className="bx-help" style={{ marginBottom: 10 }}>Stored under browser key <span className="bx-mono">{DATA_STORAGE_KEY}</span>; contains no credentials.</p>
            <Button variant="danger" disabled={!can('demo.reset')} onClick={() => setConfirmReset(true)}>Reset data</Button>
          </Card>
        </div>
      )}

      <PromptModal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset data" label="Type RESET to confirm" required danger confirmLabel="Reset"
        description="All incidents, alerts, tasks, resources, audit entries and scenario runs return to the baseline."
        onConfirm={(t) => {
          if (t !== 'RESET') return { ok: false, error: 'Type RESET exactly to confirm.' };
          return resetDemoData();
        }} />
    </>
  );
}
