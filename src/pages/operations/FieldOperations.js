import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useScoped, useAuth } from '../../state/hooks';
import { assigneeName, isOpenTask, isOverdueTask, scopeLabel, scopeFilter } from '../../state/selectors';
import { baselineFor } from '../../state/baseline';
import { PageHeader, Card, KpiCard, Tabs } from '../../components/ui/Layout';
import DataTable from '../../components/tables/DataTable';
import { PriorityBadge, StatusBadge, Badge } from '../../components/ui/Badges';
import { Button, Select } from '../../components/ui/Controls';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_CATEGORIES } from '../../types';
import { TEAMS } from '../../data/demo/people';
import { fmtRelative, fmtDuration, median, TIME } from '../../utils/format';
import { stats, breakdownOf, oldestAge, countBy, topEntry } from '../../utils/kpiHelpers';
import { stateName } from '../../components/domain/common';
import TaskForm from '../../components/domain/TaskForm';
import { MiniStepper } from '../../components/ui/TaskStepper';
import TaskDrawer from '../../components/domain/TaskDrawer';

const COMPLETED_TARGET = 5;
const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

export default function FieldOperations() {
  const { data, scope, now, tasks } = useScoped();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('tasks');
  const [status, setStatus] = useState(params.get('status') || 'Open');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [assignee, setAssignee] = useState(params.get('assignee') || '');
  const [creating, setCreating] = useState(false);
  const openId = params.get('open');

  const live = useMemo(() => tasks.filter((t) => !t.historical), [tasks]);
  const open = live.filter(isOpenTask);
  const unassignedT = open.filter((t) => t.status === 'Unassigned');
  const overdueT = open.filter((t) => isOverdueTask(t, now));
  const awaitingT = open.filter((t) => t.status === 'Awaiting Verification');
  const completedT = live.filter((t) => t.status === 'Completed');
  const bLive = scopeFilter(baselineFor(data.baseAt).tasks, scope).filter((t) => !t.historical);
  const bOpen = bLive.filter(isOpenTask);
  const completedToday = completedT.filter((t) => t.completedAt && now - new Date(t.completedAt).getTime() <= TIME.DAY).length;
  const durations = completedT.filter((t) => t.completedAt).map((t) => new Date(t.completedAt) - new Date(t.createdAt));
  const worstTeam = (topEntry(countBy(overdueT.filter((t) => t.assignee), (t) => assigneeName(t.assignee))) || [null])[0];
  const taskCols = [{ header: 'ID', get: (t) => t.id }, { header: 'Category', get: (t) => t.category }, { header: 'Location', get: (t) => t.location }, { header: 'Status', get: (t) => t.status }];
  const rows = useMemo(() => tasks.filter((t) => (
    (status === 'All' ? true : status === 'Open' ? isOpenTask(t) : status === 'Overdue' ? isOverdueTask(t, now) : t.status === status)
    && (!priority || t.priority === priority) && (!category || t.category === category)
    && (!assignee || (assignee === '__none' ? !t.assignee : t.assignee === assignee))
  )), [tasks, status, priority, category, assignee, now]);
  const selected = openId ? data.tasks.find((t) => t.id === openId) : null;

  const load = useMemo(() => {
    const m = {};
    data.tasks.filter(isOpenTask).forEach((t) => { if (t.assignee) m[t.assignee] = (m[t.assignee] || 0) + 1; });
    return m;
  }, [data.tasks]);
  const teams = TEAMS.filter((t) => scope === 'IN' || t.stateCode === scope);
  const availOf = (t) => (t.offShift ? 'Off-shift' : (load[t.id] || 0) >= 2 ? 'Deployed' : 'Available');
  const availableTeams = teams.filter((t) => availOf(t) === 'Available').length;

  const cols = [
    { id: 'id', header: 'Task ID', accessor: (r) => r.id, cell: (r) => <span className="bx-mono">{r.id}</span> },
    { id: 'incident', header: 'Incident', accessor: (r) => r.incidentId || '—', cell: (r) => (r.incidentId ? <span className="bx-mono">{r.incidentId}</span> : '—') },
    { id: 'cat', header: 'Category', accessor: (r) => r.category },
    { id: 'loc', header: 'Location', accessor: (r) => r.location, wrap: true },
    { id: 'pri', header: 'Priority', accessor: (r) => r.priority, sortValue: (r) => PRIORITY_RANK[r.priority], cell: (r) => <PriorityBadge value={r.priority} /> },
    { id: 'assignee', header: 'Assigned', accessor: (r) => assigneeName(r.assignee) },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <MiniStepper task={r} /> },
    { id: 'due', header: 'Due', accessor: (r) => r.dueAt || '', cell: (r) => (r.dueAt ? (
      <span>{fmtRelative(r.dueAt, now)} {isOverdueTask(r, now) && <Badge color="red">Overdue</Badge>}</span>) : '—') },
  ];
  const teamCols = [
    { id: 'name', header: 'Team', accessor: (r) => r.name },
    { id: 'state', header: 'State', accessor: (r) => stateName(r.stateCode) },
    { id: 'base', header: 'Base', accessor: (r) => r.base },
    { id: 'spec', header: 'Specialty', accessor: (r) => r.specialty },
    { id: 'members', header: 'Members', num: true, accessor: (r) => r.members },
    { id: 'load', header: 'Open tasks', num: true, accessor: (r) => load[r.id] || 0 },
    { id: 'avail', header: 'Availability', accessor: (r) => availOf(r), cell: (r) => <StatusBadge tone={{ Available: 'green', Deployed: 'blue', 'Off-shift': 'slate' }[availOf(r)]} label={availOf(r)} /> },
  ];

  return (
    <>
      <PageHeader title="Field Operations"
        description={`Task management for field verification and response in ${scopeLabel(scope)}.`}
        actions={<Button variant="primary" icon={Plus} disabled={!can('task.create')} onClick={() => setCreating(true)}>New task</Button>} />
      <div className="bx-kpi-grid">
        <KpiCard id="fo.open" label="Open tasks" value={open.length} previous={bOpen.length}
          stats={stats([['Urgent', open.filter((t) => t.priority === 'Urgent').length], ['High', open.filter((t) => t.priority === 'High').length], ['Normal', open.filter((t) => ['Medium', 'Low'].includes(t.priority)).length]])}
          breakdown={breakdownOf(open, (t) => t.status, { title: 'By status', xTitle: 'Tasks', yTitle: 'Status' })} rows={{ columns: taskCols, items: open }} />
        <KpiCard id="fo.unassigned" label="Unassigned" value={unassignedT.length} previous={bOpen.filter((t) => t.status === 'Unassigned').length}
          stats={stats([['Oldest waiting', oldestAge(unassignedT.map((t) => t.createdAt), now)], ['Teams available', availableTeams]])}
          breakdown={breakdownOf(unassignedT, (t) => t.priority, { title: 'By priority', xTitle: 'Tasks', yTitle: 'Priority', order: ['Urgent', 'High', 'Medium', 'Low'] })} rows={{ columns: taskCols, items: unassignedT }} />
        <KpiCard id="fo.overdue" label="Overdue" value={overdueT.length} previous={bOpen.filter((t) => isOverdueTask(t, now)).length}
          stats={stats([['Avg overdue', overdueT.length ? fmtDuration(overdueT.reduce((m, t) => m + (now - new Date(t.dueAt).getTime()), 0) / overdueT.length) : '0 min'], ['Most overdue team', worstTeam]])}
          breakdown={breakdownOf(overdueT, (t) => assigneeName(t.assignee), { title: 'By team', xTitle: 'Tasks', yTitle: 'Team' })} rows={{ columns: taskCols, items: overdueT }} />
        <KpiCard id="fo.awaiting" label="Awaiting verification" value={awaitingT.length} previous={bOpen.filter((t) => t.status === 'Awaiting Verification').length}
          stats={stats([['Oldest', oldestAge(awaitingT.map((t) => t.history[t.history.length - 1].at), now)], ['Median wait', awaitingT.length ? fmtDuration(median(awaitingT.map((t) => now - new Date(t.history[t.history.length - 1].at).getTime()))) : null]])}
          breakdown={breakdownOf(awaitingT, (t) => t.category, { title: 'By category', xTitle: 'Tasks', yTitle: 'Category' })} rows={{ columns: taskCols, items: awaitingT }} />
        <KpiCard id="fo.completed" label="Completed" value={completedT.length} previous={bLive.filter((t) => t.status === 'Completed').length}
          stats={stats([['Today', completedToday], ['Avg time', durations.length ? fmtDuration(durations.reduce((x, y) => x + y, 0) / durations.length) : null]])}
          progress={{ value: completedToday, target: COMPLETED_TARGET, label: `${completedToday} completed today` }}
          breakdown={breakdownOf(completedT, (t) => t.category, { title: 'By category', xTitle: 'Tasks', yTitle: 'Category' })} rows={{ columns: taskCols, items: completedT }} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'tasks', label: 'Tasks', count: rows.length }, { key: 'teams', label: 'Teams & availability', count: teams.length }]} />
      {tab === 'tasks' ? (
        <Card flush>
          <DataTable columns={cols} rows={rows} pageSize={12} caption="Response tasks" onRowClick={(r) => setParams({ open: r.id })} selectedKey={openId}
            defaultSort={{ id: 'due', dir: 'asc' }} exportName="tasks" searchPlaceholder="Task ID, location, category…"
            filters={<>
              <Select label="Status" compact value={status} onChange={setStatus} options={['Open', 'All', 'Overdue', ...TASK_STATUSES]} />
              <Select label="Priority" compact value={priority} onChange={setPriority} placeholder="All" options={TASK_PRIORITIES} />
              <Select label="Category" compact value={category} onChange={setCategory} placeholder="All" options={TASK_CATEGORIES} />
              <Select label="Assignee" compact value={assignee} onChange={setAssignee} placeholder="All"
                options={[{ value: '__none', label: 'Unassigned' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
            </>} />
        </Card>
      ) : (
        <>
          <Card flush>
            <DataTable columns={teamCols} rows={teams} pageSize={12} caption="Teams and availability" searchable={false} defaultSort={{ id: 'load', dir: 'desc' }} />
          </Card>
        </>
      )}
      {selected && <TaskDrawer taskId={selected.id} onClose={() => setParams({})} />}
      <TaskForm open={creating} onClose={() => setCreating(false)} onCreated={(id) => setParams({ open: id })} />
    </>
  );
}
