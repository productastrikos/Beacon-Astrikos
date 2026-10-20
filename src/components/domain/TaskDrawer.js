import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserCheck, ArrowUpCircle } from 'lucide-react';
import { useAuth, useNow } from '../../state/hooks';
import { useData } from '../../state/dataStore';
import { assigneeName, isOverdueTask } from '../../state/selectors';
import { KeyValue, Timeline, Banner } from '../ui/Layout';
import { TaskStatusBadge, PriorityBadge } from '../ui/Badges';
import { Button, Select, TextInput } from '../ui/Controls';
import { Drawer, PromptModal } from '../ui/Overlay';
import { TaskStepper } from '../ui/TaskStepper';
import { stageOf, nextStageOf } from '../../config/taskLifecycle';
import { TEAMS } from '../../data/demo/people';
import { assignTask, advanceTask, transitionTask, escalateTask, addTaskEvidence } from '../../state/actions';
import { fmtDateTime, fmtRelative } from '../../utils/format';
import { ActivityLog, stateName } from './common';

/**
 * Shared task drawer. Reads the live task from the store, so actions taken here update every list, KPI and the audit trail at once.
 * `act` ('assign' | 'escalate' | 'verify') focuses or highlights the matching control on open.
 */
export default function TaskDrawer({ taskId, onClose, act }) {
  const task = useData((s) => s.tasks.find((t) => t.id === taskId));
  const { can } = useAuth();
  const now = useNow();
  const { pathname } = useLocation();
  const [team, setTeam] = useState('');
  const [prompt, setPrompt] = useState(null);
  const [evidence, setEvidence] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!act) return undefined;
    const t = setTimeout(() => {
      if (act === 'assign') {
        const el = document.querySelector('[data-act="assign"] select');
        if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
      } else {
        const sec = document.querySelector('[data-act="status"]');
        if (sec) sec.scrollIntoView({ block: 'center' });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [act]);

  const stageAudit = useMemo(() => (task ? (task.stageLog || []).slice(1).map((e, i) => ({
    id: `${task.id}-sa${i}`, at: e.at, userName: e.by, role: '—', action: 'Task stage changed', previous: task.stageLog[i].stage, next: e.stage, outcome: 'Success', source: e.by === 'System' ? 'integration' : 'operator',
  })) : []), [task]);
  if (!task) return null;
  const res = (r) => { setMsg(r.ok ? '' : r.error); return r; };
  const stage = stageOf(task);
  const nextStage = nextStageOf(stage);
  const closed = ['Completed', 'Cancelled'].includes(task.status);
  const blocked = stage === 'Created' && !task.assignee;
  const overdue = isOverdueTask(task, now);
  const onFieldOps = pathname.startsWith('/field-operations');
  const hl = (on) => (on ? 'bx-is-hl' : undefined);

  return (
    <>
      <Drawer open onClose={onClose} title={`${task.category} — ${task.location}`}
        subtitle={<>{task.id}{!onFieldOps && <><br /><Link className="bx-drawer-link" to={`/field-operations?open=${task.id}`}>Open in Field Operations ↗</Link></>}</>}>
        <div className="bx-row">
          <TaskStatusBadge value={task.status} /><PriorityBadge value={task.priority} />
        </div>
        <div className="bx-progress-label">Task progress</div>
        <TaskStepper task={task} extra={<>{overdue && <span className="bx-step-flag">Overdue</span>}{task.escalated && <span className="bx-step-flag">Escalated</span>}</>} />
        {msg && <Banner kind="danger">{msg}</Banner>}
        <KeyValue items={[
          ['Linked incident', task.incidentId ? (onFieldOps ? <Link to={`/incidents/${task.incidentId}`}>{task.incidentId}</Link> : task.incidentId) : 'None'],
          ['Category', task.category],
          ['Location', `${task.location} (${stateName(task.stateCode)})`],
          ['Assigned to', assigneeName(task.assignee)],
          ['Created', fmtDateTime(task.createdAt)],
          ['Due', task.dueAt ? `${fmtDateTime(task.dueAt)} (${fmtRelative(task.dueAt, now)})` : '—'],
          ['Instructions', task.instructions],
          ['Completion notes', task.completionNotes],
          ['Evidence references', task.evidenceRefs.join(', ')],
        ]} />

        <section data-act="assign">
          <div className="bx-section-title">Assignment</div>
          <div className="bx-row" style={{ alignItems: 'flex-end' }}>
            <Select label={task.assignee ? 'Reassign to' : 'Assign to'} value={team || task.assignee || ''} onChange={setTeam} placeholder="Unassigned"
              options={TEAMS.filter((t) => t.stateCode === task.stateCode).map((t) => ({ value: t.id, label: `${t.name} · ${t.base}` }))} />
            <Button icon={UserCheck} disabled={!can('task.assign') || !team || team === (task.assignee || '') || ['Completed', 'Cancelled'].includes(task.status)}
              onClick={() => res(assignTask(task.id, team || null))}>{task.assignee ? 'Reassign' : 'Assign'}</Button>
          </div>
        </section>

        <section data-act="status">
          <div className="bx-section-title">Next step</div>
          <div className="bx-row">
            {nextStage && !closed ? (
              <Button variant="primary" className={hl(act === 'verify')} disabled={blocked || !can(nextStage === 'Verified' ? 'task.complete' : 'task.update')}
                title={blocked ? 'Assign a team first' : nextStage === 'Verified' && !can('task.complete') ? 'Verification is done by an operator role' : undefined}
                onClick={() => (nextStage === 'Findings submitted' ? setPrompt({ kind: 'findings' }) : res(advanceTask(task.id)))}>
                Advance to {nextStage} →
              </Button>
            ) : <span className="bx-faint">{task.status === 'Cancelled' ? 'This task was cancelled.' : 'No further stages.'}</span>}
            <Button icon={ArrowUpCircle} className={hl(act === 'escalate')} disabled={!can('task.escalate') || closed} onClick={() => setPrompt({ kind: 'escalate' })}>Escalate</Button>
            <Button variant="danger" disabled={!can('task.update') || closed} onClick={() => setPrompt({ kind: 'cancel' })}>Cancel task</Button>
          </div>
          {blocked && !closed && <div className="bx-faint" style={{ marginTop: 4, fontSize: 11 }}>Assign a team above to start the task.</div>}
        </section>

        <section>
          <div className="bx-section-title">Evidence</div>
          <div className="bx-row" style={{ alignItems: 'flex-end' }}>
            <TextInput label="Add evidence reference" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Photo ID, report number…" />
            <Button disabled={!evidence.trim() || !can('task.update')} onClick={() => { if (res(addTaskEvidence(task.id, evidence)).ok) setEvidence(''); }}>Add</Button>
          </div>
        </section>

        <section>
          <div className="bx-section-title">Task history</div>
          <Timeline items={[...task.history].reverse().map((h) => ({ id: h.id, text: h.text, meta: `${fmtDateTime(h.at)} · ${h.by}` }))} />
        </section>
        <section>
          <div className="bx-section-title">Audit trail</div>
          <ActivityLog entityId={task.id} extra={stageAudit} />
        </section>
      </Drawer>
      <PromptModal open={prompt?.kind === 'findings'} onClose={() => setPrompt(null)} title="Submit findings" label="Findings notes (optional)" required={false}
        confirmLabel="Submit findings" onConfirm={(t) => advanceTask(task.id, t)} />
      <PromptModal open={prompt?.kind === 'cancel'} onClose={() => setPrompt(null)} title="Cancel task" label="Cancellation reason" required danger
        confirmLabel="Cancel task" onConfirm={(t) => transitionTask(task.id, 'Cancelled', t)} />
      <PromptModal open={prompt?.kind === 'escalate'} onClose={() => setPrompt(null)} title="Escalate task" label="Escalation reason" required
        description={`Priority will be raised one level from ${task.priority}.`} confirmLabel="Escalate"
        onConfirm={(t) => escalateTask(task.id, t)} />
    </>
  );
}
