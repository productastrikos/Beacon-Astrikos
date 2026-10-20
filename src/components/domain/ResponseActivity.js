import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isActiveIncident, isOpenTask, isOverdueTask } from '../../state/selectors';
import { useLiveData } from '../../state/LiveDataProvider';
import { fmtDuration, fmtTime } from '../../utils/format';
import { Card } from '../ui/Layout';
import { MiniStepper } from '../ui/TaskStepper';
import { useDrawerParam } from '../../state/useDrawerParam';

const PRIORITY_TONE = { Urgent: 'red', High: 'orange', Medium: 'amber', Low: 'blue', Critical: 'red', Moderate: 'amber' };
const MAX = 4;
const ageMs = (iso, now) => Math.max(0, now - new Date(iso).getTime());

const taskItem = (t, since) => ({ task: t, kind: 'task', id: t.id, title: t.category, pill: t.priority, location: t.location, status: t.status, since, to: `/field-operations?open=${t.id}` });

/**
 * Response activity: three columns of items needing operator action. Each item appears in one column only
 * (overdue > unassigned > awaiting verification) and columns are sorted by urgency.
 */
export default function ResponseActivity({ incidents, tasks, now }) {
  const navigate = useNavigate();
  const task = useDrawerParam('task');
  const incident = useDrawerParam('incident');
  const openItem = (it, act) => (it.kind === 'incident' ? incident.open(it.id) : task.open(it.id, act));
  const { lastTick } = useLiveData();
  const [fresh, setFresh] = useState(() => new Set());
  const seen = useRef(null);

  const cols = useMemo(() => {
    const open = tasks.filter((t) => !t.historical && isOpenTask(t));
    const overdue = open.filter((t) => isOverdueTask(t, now)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).map((t) => taskItem(t, t.dueAt));
    const rest = open.filter((t) => !isOverdueTask(t, now));
    const unassigned = [
      ...incidents.filter((i) => isActiveIncident(i) && ['High', 'Critical'].includes(i.severity) && !i.assignedOperator && !i.assignedTeam)
        .map((i) => ({ kind: 'incident', id: i.id, title: i.title, pill: i.severity, location: i.district, status: i.status, since: i.createdAt, to: `/incidents/${i.id}` })),
      ...rest.filter((t) => t.status === 'Unassigned' && ['Urgent', 'High'].includes(t.priority)).map((t) => taskItem(t, t.createdAt)),
    ].sort((a, b) => new Date(a.since) - new Date(b.since));
    const awaiting = rest.filter((t) => t.status === 'Awaiting Verification')
      .sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt)).map((t) => taskItem(t, t.updatedAt || t.createdAt));
    return [
      { key: 'unassigned', title: 'Unassigned high-priority', tone: 'orange', items: unassigned, word: 'unassigned', more: '/field-operations?status=Unassigned', actions: [['Assign', 'assign']] },
      { key: 'overdue', title: 'Overdue tasks', tone: 'red', items: overdue, word: 'overdue', more: '/field-operations?status=Overdue', actions: [['Escalate', 'escalate'], ['Open']] },
      { key: 'awaiting', title: 'Awaiting verification', tone: 'amber', items: awaiting, word: 'waiting', more: '/field-operations?status=Awaiting%20Verification', actions: [['Verify', 'verify'], ['Open']] },
    ];
  }, [incidents, tasks, now]);

  useEffect(() => {
    const ids = new Set(cols.flatMap((c) => c.items.slice(0, MAX).map((i) => i.id)));
    const prev = seen.current;
    seen.current = ids;
    if (!prev) return undefined;
    const added = new Set([...ids].filter((i) => !prev.has(i)));
    if (!added.size) return undefined;
    setFresh(added);
    const t = setTimeout(() => setFresh(new Set()), 1500);
    return () => clearTimeout(t);
  }, [cols]);

  const [un, od, aw] = cols;
  return (
    <Card title="Response activity" subtitle={`Items requiring operator action · updated ${fmtTime(lastTick)}`}
      actions={(
        <div className="bx-ra-head">
          <span className="bx-ra-pills">{od.items.length} overdue · {un.items.length} unassigned · {aw.items.length} awaiting verification</span>
          <button type="button" className="bx-ra-link" onClick={() => navigate('/field-operations')}>Open Field Operations ›</button>
        </div>
      )}>
      <div className="bx-ra-cols">
        {cols.map((c) => (
          <div key={c.key}>
            <div className="bx-ra-colhead">{c.title}<span className="bx-ra-count">{c.items.length}</span></div>
            {c.items.length === 0 && (c.key === 'unassigned'
              ? <div className="bx-ra-ok">All high-priority incidents assigned</div>
              : <div className="bx-ra-empty">Nothing {c.key === 'overdue' ? 'overdue' : 'awaiting verification'}</div>)}
            {c.items.slice(0, MAX).map((it) => (
              <div key={it.id} className={`bx-ra-item ${fresh.has(it.id) ? 'is-fresh' : ''}`} role="button" tabIndex={0}
                onClick={() => openItem(it)} onKeyDown={(e) => { if (e.key === 'Enter') openItem(it); }}>
                <div className="bx-ra-l1">
                  <span className={`bx-ra-dot tone-${c.tone}`} aria-hidden="true" />
                  <span className="bx-ra-id">{it.id}</span>
                  <span className="bx-ra-title" title={it.title}>{it.title}</span>
                  <span className={`bx-risk-pill tone-${PRIORITY_TONE[it.pill] || 'amber'}`}>{it.pill}</span>
                </div>
                <div className="bx-ra-l2">
                  {it.location} · {it.task ? <MiniStepper task={it.task} /> : it.status} · <span className={`bx-ra-time ${c.key === 'overdue' ? 'tone-red' : ''}`}>{c.word} {fmtDuration(ageMs(it.since, now))}</span>
                </div>
                <div className="bx-ra-l3">
                  {c.actions.map(([label, act]) => (
                    <button key={label} type="button" onClick={(e) => { e.stopPropagation(); openItem(it, act); }}>{label} ›</button>
                  ))}
                </div>
              </div>
            ))}
            {c.items.length > MAX && <button type="button" className="bx-ra-more" onClick={() => navigate(c.more)}>+{c.items.length - MAX} more ›</button>}
          </div>
        ))}
      </div>
    </Card>
  );
}
