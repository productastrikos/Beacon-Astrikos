import React, { useMemo, useState } from 'react';
import { useScoped, useAuth } from '../../state/hooks';
import { PageHeader, Card, Tabs } from '../../components/ui/Layout';
import DataTable from '../../components/tables/DataTable';
import { Select, TextInput } from '../../components/ui/Controls';
import { OutcomeBadge, Badge } from '../../components/ui/Badges';
import { fmtDateTime, median, fmtDuration, TIME } from '../../utils/format';
import { SOURCE_SHORT } from '../../data/demo/sources';
import { HAZARD_LABEL } from '../../types';
import { alertStatus, isOverdueTask, isActiveIncident } from '../../state/selectors';
import { stateName } from '../../components/domain/common';
import { SCENARIOS } from '../../data/demo/scenarios';

function AuditRegister() {
  const { data } = useScoped();
  const { can } = useAuth();
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [source, setSource] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recordId, setRecordId] = useState('');

  const users = useMemo(() => [...new Set(data.audit.map((a) => a.userName))].sort(), [data.audit]);
  const actions = useMemo(() => [...new Set(data.audit.map((a) => a.action))].sort(), [data.audit]);
  const rows = useMemo(() => data.audit.filter((a) => {
    const t = new Date(a.at).getTime();
    return (!user || a.userName === user) && (!action || a.action === action) && (!source || a.source === source) && (!outcome || a.outcome === outcome)
      && (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime() + TIME.DAY)
      && (!recordId || a.entityId.toLowerCase().includes(recordId.toLowerCase()));
  }), [data.audit, user, action, source, outcome, from, to, recordId]);

  const cols = [
    { id: 'at', header: 'Timestamp', accessor: (r) => r.at, cell: (r) => fmtDateTime(r.at) },
    { id: 'user', header: 'User', accessor: (r) => r.userName },
    { id: 'role', header: 'Role', accessor: (r) => r.role },
    { id: 'action', header: 'Action', accessor: (r) => r.action, wrap: true },
    { id: 'type', header: 'Entity type', accessor: (r) => r.entityType },
    { id: 'id', header: 'Entity ID', accessor: (r) => r.entityId, cell: (r) => <span className="bx-mono">{r.entityId}</span> },
    { id: 'prev', header: 'Previous', accessor: (r) => r.previous || '—', wrap: true },
    { id: 'next', header: 'New', accessor: (r) => r.next || '—', wrap: true },
    { id: 'outcome', header: 'Outcome', accessor: (r) => r.outcome, cell: (r) => <OutcomeBadge value={r.outcome} /> },
    { id: 'source', header: 'Source', accessor: (r) => r.source, cell: (r) => <Badge color={r.source === 'simulation' ? 'amber' : r.source === 'integration' ? 'violet' : 'blue'}>{r.source}</Badge> },
  ];

  return (
    <Card flush>
      <DataTable columns={cols} rows={rows} pageSize={15} caption="Audit register" defaultSort={{ id: 'at', dir: 'desc' }}
        exportName={can('report.export') ? 'audit-register' : undefined} searchPlaceholder="Any field…"
        filters={<>
          <Select label="User" compact value={user} onChange={setUser} placeholder="All" options={users} />
          <Select label="Action" compact value={action} onChange={setAction} placeholder="All" options={actions} />
          <Select label="Source" compact value={source} onChange={setSource} placeholder="All" options={['operator', 'integration', 'simulation']} />
          <Select label="Outcome" compact value={outcome} onChange={setOutcome} placeholder="All" options={['Success', 'Denied', 'Failed']} />
          <TextInput label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextInput label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <TextInput label="Record ID" value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="INC-1001" />
        </>} />
    </Card>
  );
}

const REPORTS = {
  incidents: {
    label: 'Incident summary',
    columns: (c) => [
      { id: 'id', header: 'Incident', accessor: (r) => r.id }, { id: 'title', header: 'Title', accessor: (r) => r.title, wrap: true },
      { id: 'hazard', header: 'Hazard', accessor: (r) => HAZARD_LABEL[r.hazard] }, { id: 'state', header: 'State', accessor: (r) => stateName(r.stateCode) },
      { id: 'sev', header: 'Severity', accessor: (r) => r.severity }, { id: 'ver', header: 'Verification', accessor: (r) => r.verification },
      { id: 'status', header: 'Status', accessor: (r) => r.status }, { id: 'tasks', header: 'Tasks', num: true, accessor: (r) => r.taskIds.length },
      { id: 'created', header: 'Created', accessor: (r) => r.createdAt, cell: (r) => fmtDateTime(r.createdAt) },
    ],
    rows: ({ incidents }) => incidents.filter((i) => !i.historical),
  },
  hazards: {
    label: 'Hazard summary',
    columns: () => [
      { id: 'hazard', header: 'Hazard', accessor: (r) => r.label }, { id: 'inc', header: 'Active incidents', num: true, accessor: (r) => r.incidents },
      { id: 'al', header: 'Active warnings', num: true, accessor: (r) => r.alerts }, { id: 'rec', header: 'Records', num: true, accessor: (r) => r.records },
      { id: 'unver', header: 'Unverified records', num: true, accessor: (r) => r.unverified },
    ],
    rows: ({ incidents, alerts, records, now }) => Object.entries(HAZARD_LABEL).map(([k, label]) => ({
      id: k, label,
      incidents: incidents.filter((i) => i.hazard === k && isActiveIncident(i)).length,
      alerts: alerts.filter((a) => a.hazard === k && ['Active', 'Updated'].includes(alertStatus(a, now)) && a.classification !== 'Historical').length,
      records: records.filter((r) => r.hazard === k).length,
      unverified: records.filter((r) => r.hazard === k && ['Unverified', 'Pending', 'Automated'].includes(r.verification)).length,
    })),
  },
  tasks: {
    label: 'Response task status',
    columns: () => [
      { id: 'id', header: 'Task', accessor: (r) => r.id }, { id: 'cat', header: 'Category', accessor: (r) => r.category },
      { id: 'loc', header: 'Location', accessor: (r) => r.location, wrap: true }, { id: 'pri', header: 'Priority', accessor: (r) => r.priority },
      { id: 'status', header: 'Status', accessor: (r) => r.status }, { id: 'due', header: 'Due', accessor: (r) => r.dueAt || '', cell: (r) => (r.dueAt ? fmtDateTime(r.dueAt) : '—') },
      { id: 'od', header: 'Overdue', accessor: (r) => (r.overdue ? 'Yes' : 'No') },
    ],
    rows: ({ tasks, now }) => tasks.filter((t) => !t.historical).map((t) => ({ ...t, overdue: isOverdueTask(t, now) })),
  },
  alerts: {
    label: 'Alert handling performance',
    columns: () => [
      { id: 'sender', header: 'Source agency', accessor: (r) => SOURCE_SHORT[r.sender] || r.sender },
      { id: 'total', header: 'Alerts', num: true, accessor: (r) => r.total }, { id: 'acked', header: 'Acknowledged', num: true, accessor: (r) => r.acked },
      { id: 'median', header: 'Median time to acknowledge', accessor: (r) => (r.median == null ? '—' : fmtDuration(r.median * TIME.MIN)) },
    ],
    rows: ({ alerts }) => {
      const m = {};
      alerts.forEach((a) => {
        const r = (m[a.sender] ||= { id: a.sender, sender: a.sender, total: 0, acked: 0, mins: [] });
        r.total += 1;
        if (a.ackAt) { r.acked += 1; r.mins.push((new Date(a.ackAt) - new Date(a.sent)) / TIME.MIN); }
      });
      return Object.values(m).map((r) => ({ ...r, median: median(r.mins) }));
    },
  },
  sources: {
    label: 'Source availability',
    columns: () => [
      { id: 'name', header: 'Source', accessor: (r) => r.name, wrap: true }, { id: 'status', header: 'Status', accessor: (r) => r.status },
      { id: 'config', header: 'Configuration', accessor: (r) => r.configStatus }, { id: 'ok', header: 'Last successful update', accessor: (r) => r.lastSuccess || '—', cell: (r) => (r.lastSuccess ? fmtDateTime(r.lastSuccess) : '—') },
      { id: 'n', header: 'Records', num: true, accessor: (r) => r.records },
    ],
    rows: ({ data }) => data.sources,
  },
  simulation: {
    label: 'Simulation outcomes',
    columns: () => [
      { id: 'id', header: 'Scenario', accessor: (r) => r.id }, { id: 'name', header: 'Name', accessor: (r) => r.name, wrap: true },
      { id: 'status', header: 'Status', accessor: (r) => r.status }, { id: 'steps', header: 'Steps run', accessor: (r) => `${r.done}/${r.total}` },
      { id: 'inc', header: 'Incidents created', num: true, accessor: (r) => r.incidents }, { id: 'tasks', header: 'Tasks created', num: true, accessor: (r) => r.tasks },
      { id: 'outcome', header: 'Final outcome', accessor: (r) => r.outcome, wrap: true },
    ],
    rows: ({ data }) => SCENARIOS.map((s) => {
      const r = data.simRuns[s.id];
      return { id: s.id, name: s.name, status: r ? r.status : 'idle', done: r ? r.stepIndex : 0, total: s.steps.length,
        incidents: r ? r.created.incidents.length : 0, tasks: r ? r.created.tasks.length : 0, outcome: r && r.status === 'completed' ? s.outcome : '—' };
    }),
  },
};

function Reports() {
  const ctx = useScoped();
  const { can } = useAuth();
  const [kind, setKind] = useState('incidents');
  const rep = REPORTS[kind];
  const rows = useMemo(() => rep.rows({ ...ctx, incidents: ctx.incidents, alerts: ctx.alerts, tasks: ctx.tasks, records: ctx.records }), [rep, ctx]);
  return (
    <>
      <div style={{ marginBottom: 12, maxWidth: 320 }}>
        <Select label="Report" value={kind} onChange={setKind} options={Object.entries(REPORTS).map(([k, v]) => ({ value: k, label: v.label }))} />
      </div>
      <Card title={rep.label} subtitle="Computed from the current dataset and scope." flush>
        <DataTable columns={rep.columns()} rows={rows} pageSize={12} caption={rep.label} exportName={can('report.export') ? `report-${kind}` : undefined} />
      </Card>
    </>
  );
}

export default function ReportsAudit() {
  const [tab, setTab] = useState('audit');
  return (
    <>
      <PageHeader title="Reports & Audit" description="Audit register of operator, integration and simulation actions, plus summary reports with CSV export." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'audit', label: 'Audit register' }, { key: 'reports', label: 'Reports' }]} />
      {tab === 'audit' ? <AuditRegister /> : <Reports />}
    </>
  );
}

