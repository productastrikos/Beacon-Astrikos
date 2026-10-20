import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpCircle, Pencil, ListPlus, Link2, NotebookPen, UserCheck } from 'lucide-react';
import { useData } from '../../state/dataStore';
import { useAuth, useNow } from '../../state/hooks';
import { assigneeName, isOverdueIncident, isOverdueTask } from '../../state/selectors';
import { PageHeader, Card, KeyValue, Timeline, Banner, EmptyState } from '../../components/ui/Layout';
import { SeverityBadge, IncidentStatusBadge, VerificationBadge, CapSeverityBadge, Badge, AvailabilityBadge } from '../../components/ui/Badges';
import { Button, Select, TextInput, TextArea } from '../../components/ui/Controls';
import { Modal, PromptModal } from '../../components/ui/Overlay';
import { MiniStepper } from '../../components/ui/TaskStepper';
import { INCIDENT_TRANSITIONS, INCIDENT_REASON_REQUIRED, INCIDENT_STATUSES, SEVERITIES } from '../../types';
import {
  transitionIncident, assignIncident, escalateIncident, addIncidentNote, updateIncident, linkAlertToIncident,
} from '../../state/actions';
import { DEMO_USERS, OPERATOR_ROSTER, TEAMS } from '../../data/demo/people';
import { fmtDateTime, fmtRelative } from '../../utils/format';
import { hazardLabel, stateName, ActivityLog } from '../../components/domain/common';
import AlertDrawer from '../../components/domain/AlertDrawer';
import TaskForm from '../../components/domain/TaskForm';
import { useDrawerParam } from '../../state/useDrawerParam';

const LIFECYCLE = ['Reported', 'Under Verification', 'Confirmed', 'Response in Progress', 'Resolved', 'Closed'];

function Lifecycle({ status }) {
  const side = status === 'Unconfirmed';
  const idx = LIFECYCLE.indexOf(status);
  return (
    <div className="bx-row" style={{ gap: 4 }} aria-label={`Lifecycle position: ${status}`}>
      {LIFECYCLE.map((s, i) => (
        <React.Fragment key={s}>
          <Badge color={s === status ? 'cyan' : i < idx ? 'green' : 'grey'} solid={false}>{s}</Badge>
          {i < LIFECYCLE.length - 1 && <span aria-hidden="true" className="bx-faint">›</span>}
        </React.Fragment>
      ))}
      {side && <Badge color="amber">Unconfirmed (verification outcome)</Badge>}
    </div>
  );
}

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const { can } = useAuth();
  const taskDrawer = useDrawerParam('task');
  const incident = useData((s) => s.incidents.find((i) => i.id === id));
  const alerts = useData((s) => s.alerts);
  const tasks = useData((s) => s.tasks);
  const resources = useData((s) => s.resources);

  const [prompt, setPrompt] = useState(null); // { kind, status? }
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const [taskOpen, setTaskOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [op, setOp] = useState('');
  const [team, setTeam] = useState('');
  const [linkAlert, setLinkAlert] = useState('');
  const [msg, setMsg] = useState('');

  const linked = useMemo(() => (incident ? alerts.filter((a) => incident.linkedAlertIds.includes(a.id)) : []), [alerts, incident]);
  // Only alerts for the same hazard in the same state can be linked; the same district and the newest come first.
  const linkable = useMemo(() => (incident ? alerts
    .filter((a) => a.classification !== 'Historical' && !a.cancelled && !incident.linkedAlertIds.includes(a.id) && a.hazard === incident.hazard && a.stateCode === incident.stateCode)
    .sort((x, y) => (Number(y.districts.includes(incident.district)) - Number(x.districts.includes(incident.district))) || (new Date(y.sent) - new Date(x.sent))) : []), [alerts, incident]);
  const itsTasks = useMemo(() => (incident ? tasks.filter((t) => t.incidentId === incident.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) : []), [tasks, incident]);
  const itsResources = useMemo(() => (incident ? resources.filter((r) => r.assignedIncident === incident.id) : []), [resources, incident]);

  // Everything that happened on the incident: its own timeline, notes, linked alerts and the history of its tasks.
  const events = useMemo(() => {
    if (!incident) return [];
    const out = incident.timeline.map((t) => ({ id: t.id, at: t.at, by: t.by, text: t.text }));
    incident.notes.forEach((n) => out.push({ id: n.id, at: n.at, by: n.by, text: `Note: ${n.text}${n.evidenceRef ? ` (evidence ${n.evidenceRef})` : ''}` }));
    linked.filter((a) => !incident.timeline.some((t) => t.text.includes(a.id))).forEach((a) => out.push({ id: `${a.id}-lk`, at: new Date(Math.max(new Date(a.sent).getTime(), new Date(incident.createdAt).getTime() + 60000)).toISOString(), by: 'System', text: `Alert ${a.id} linked — ${a.headline}` }));
    itsTasks.forEach((t) => (t.history || []).forEach((h) => out.push({ id: `${t.id}-${h.id}`, at: h.at, by: h.by, text: `${t.id} · ${h.text}` })));
    return out.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [incident, linked, itsTasks]);

  if (!incident) {
    return (
      <Card><EmptyState title="Incident not found" hint={`No incident with ID ${id} exists in the current dataset (it may have been removed by a scenario reset).`}>
        <div style={{ marginTop: 8 }}><Link to="/incidents">Back to incident register</Link></div>
      </EmptyState></Card>
    );
  }

  const next = INCIDENT_TRANSITIONS[incident.status] || [];
  const result = (r) => { setMsg(r.ok ? '' : r.error); return r; };
  const overdue = isOverdueIncident(incident, now);
  const canTransition = can('incident.transition');
  const fresh = now - new Date(incident.createdAt).getTime() < 2 * 60000;

  const openEdit = () => {
    setEdit({ title: incident.title, description: incident.description, location: incident.location, severity: incident.severity });
    setEditing(true);
  };

  return (
    <>
      <PageHeader
        title={<span><span className="bx-mono">{incident.id}</span> · {incident.title}</span>}
        description={`${hazardLabel(incident.hazard)} · ${incident.district}, ${stateName(incident.stateCode)}`}
        actions={<Button icon={ArrowLeft} onClick={() => navigate('/incidents')}>Register</Button>} />
      <div className="bx-row" style={{ marginBottom: 8 }}>
        <SeverityBadge value={incident.severity} />
        <IncidentStatusBadge value={incident.status} />
        <VerificationBadge value={incident.verification} />
        {overdue && <Badge color="red">Response overdue</Badge>}
      </div>
      {msg && <div style={{ marginBottom: 8 }}><Banner kind="danger">{msg}</Banner></div>}

      <div className="bx-inc-layout">
        <div className="bx-inc-main">
          <Card title="Summary">
            <p style={{ margin: '0 0 8px' }}>{incident.description || 'No description.'}</p>
            <KeyValue items={[
              ['Hazard', hazardLabel(incident.hazard)],
              ['State / district', `${stateName(incident.stateCode)} / ${incident.district}`],
              ['Location', incident.location],
              ['Source', incident.provenance],
              ['Last updated', fmtDateTime(incident.updatedAt)],
              ['Closure reason', incident.closureReason],
            ]} />
          </Card>

          <Card title={`Linked alerts (${linked.length})`}>
            {linked.length ? linked.map((a) => (
              <div key={a.id} className="bx-inc-line">
                <CapSeverityBadge value={a.severity} />
                <button type="button" className="bx-link-btn" onClick={() => setAlertOpen(a.id)}>{a.headline}</button>
                <span className="bx-faint">{a.id}</span>
              </div>
            )) : <div className="bx-faint">No alert linked yet. A linked warning is context, not confirmation.</div>}
            <div className="bx-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <Select label={`Link an alert (${linkable.length} for ${hazardLabel(incident.hazard)} in ${stateName(incident.stateCode)})`} value={linkAlert} onChange={setLinkAlert} placeholder="Select alert…"
                options={linkable.slice(0, 40).map((a) => ({ value: a.id, label: `${a.id} — ${a.headline}` }))} />
              <Button icon={Link2} disabled={!linkAlert || !can('alert.link')} onClick={() => { if (result(linkAlertToIncident(linkAlert, incident.id)).ok) setLinkAlert(''); }}>Link</Button>
            </div>
          </Card>

          <Card title={`Related tasks (${itsTasks.length})`} actions={<Button size="sm" icon={ListPlus} disabled={!can('task.create')} onClick={() => setTaskOpen(true)}>Create task</Button>}>
            {itsTasks.length === 0 ? (
              <div className="bx-faint">{fresh ? 'Response tasks are being prepared for this new incident.' : 'No response tasks.'}</div>
            ) : (
              <div className="bx-inc-tasks">
                {itsTasks.map((t) => (
                  <div key={t.id} className="bx-inc-task">
                    <span className="bx-mono">{t.id}</span>
                    <span className="bx-inc-task-cat" title={t.category}>{t.category}</span>
                    <span className="bx-inc-task-team" title={assigneeName(t.assignee)}>{assigneeName(t.assignee)}</span>
                    <MiniStepper task={t} />
                    <span className={isOverdueTask(t, now) ? 'bx-inc-over' : 'bx-faint'}>
                      {t.status === 'Completed' ? 'done' : t.status === 'Cancelled' ? 'cancelled' : isOverdueTask(t, now) ? `overdue ${fmtRelative(t.dueAt, now).replace(' ago', '')}` : t.dueAt ? `due ${fmtRelative(t.dueAt, now)}` : '—'}
                    </span>
                    <button type="button" className="bx-link-btn" onClick={() => taskDrawer.open(t.id)}>Open ›</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {itsResources.length > 0 && (
            <Card title={`Assigned resources (${itsResources.length})`}>
              {itsResources.map((r) => <div key={r.id} className="bx-inc-line"><span className="bx-mono">{r.id}</span> {r.name} <AvailabilityBadge value={r.availability} /></div>)}
            </Card>
          )}

          <Card title="Notes and evidence">
            {incident.notes.length ? (
              <Timeline items={incident.notes.map((n) => ({
                id: n.id, text: <span>{n.text}{n.evidenceRef ? <span className="bx-faint"> · evidence: {n.evidenceRef}</span> : null}</span>,
                meta: `${fmtDateTime(n.at)} · ${n.by}${n.role ? ` (${n.role})` : ''}`,
              }))} />
            ) : <div className="bx-faint">No notes yet — add one below.</div>}
            <div className="bx-inc-note">
              <TextArea label="Add note" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <TextInput label="Evidence reference" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Photo ID, report number…" />
              <Button icon={NotebookPen} disabled={!noteText.trim() || !can('note.add')} onClick={() => { if (result(addIncidentNote(incident.id, noteText, evidence)).ok) { setNoteText(''); setEvidence(''); } }}>Add note</Button>
            </div>
          </Card>
        </div>

        <div className="bx-inc-side">
          <Card title="Status">
            <Lifecycle status={incident.status} />
            <div className="bx-row" style={{ marginTop: 8 }}>
              {next.length === 0 && <span className="bx-faint">No further transitions from {incident.status}.</span>}
              {next.map((s) => (
                <Button key={s} size="sm" variant={s === 'Closed' ? 'danger' : 'default'} disabled={!canTransition}
                  title={!canTransition ? 'Your role cannot change incident status' : undefined}
                  onClick={() => (INCIDENT_REASON_REQUIRED.includes(s) ? setPrompt({ kind: 'transition', status: s }) : result(transitionIncident(incident.id, s)))}>
                  → {s}
                </Button>
              ))}
            </div>
            <div className="bx-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <Select label="Operator" compact value={op || incident.assignedOperator || ''} onChange={setOp} placeholder="Unassigned"
                options={[...DEMO_USERS.map((u) => ({ value: u.id, label: u.name })), ...OPERATOR_ROSTER.map((o) => ({ value: o.id, label: o.name }))]} />
              <Select label="Response team" compact value={team || incident.assignedTeam || ''} onChange={setTeam} placeholder="Unassigned"
                options={TEAMS.filter((t) => t.stateCode === incident.stateCode).map((t) => ({ value: t.id, label: t.name }))} />
              <Button size="sm" icon={UserCheck} disabled={!can('incident.assign')} onClick={() => result(assignIncident(incident.id, { operator: op || incident.assignedOperator, team: team || incident.assignedTeam }))}>Assign</Button>
            </div>
            <div className="bx-row" style={{ marginTop: 8 }}>
              <Button size="sm" icon={Pencil} disabled={!can('incident.update')} onClick={openEdit}>Edit fields</Button>
              <Button size="sm" icon={ArrowUpCircle} disabled={!can('incident.escalate') || incident.severity === 'Critical'} onClick={() => setPrompt({ kind: 'escalate' })}>Escalate</Button>
            </div>
          </Card>

          <Card title="Key facts">
            <KeyValue items={[
              ['Severity', <SeverityBadge value={incident.severity} />],
              ['Verification', <VerificationBadge value={incident.verification} />],
              ['Operator', assigneeName(incident.assignedOperator)],
              ['Team', assigneeName(incident.assignedTeam)],
              ['Created', `${fmtDateTime(incident.createdAt)} (${fmtRelative(incident.createdAt, now)})`],
              ['Response due', incident.dueAt ? `${fmtDateTime(incident.dueAt)} (${fmtRelative(incident.dueAt, now)})` : '—'],
            ]} />
          </Card>

          <Card title={`Timeline (${events.length})`}>
            <div className="bx-inc-timeline">
              <Timeline items={events.map((t) => ({ id: t.id, text: t.text, meta: `${fmtDateTime(t.at)} · ${assigneeName(t.by)}` }))} />
            </div>
          </Card>
          <Card title="Audit trail">
            <ActivityLog entityId={incident.id} />
          </Card>
        </div>
      </div>

      <PromptModal open={prompt?.kind === 'transition'} onClose={() => setPrompt(null)}
        title={`Move to ${prompt?.status}`} label="Reason" required
        description={`Status will change from ${incident.status} to ${prompt?.status}. The reason is stored in the timeline and audit register.`}
        confirmLabel={`Set ${prompt?.status}`} danger={prompt?.status === 'Closed'}
        onConfirm={(reason) => transitionIncident(incident.id, prompt.status, reason)} />
      <PromptModal open={prompt?.kind === 'escalate'} onClose={() => setPrompt(null)} title="Escalate incident" label="Escalation reason" required
        description={`Severity will be raised one level from ${incident.severity}.`} confirmLabel="Escalate"
        onConfirm={(reason) => escalateIncident(incident.id, reason)} />

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit incident fields"
        footer={<><Button variant="primary" onClick={() => { if (result(updateIncident(incident.id, edit)).ok) setEditing(false); }}>Save</Button><Button onClick={() => setEditing(false)}>Cancel</Button></>}>
        <TextInput label="Title" value={edit.title || ''} onChange={(e) => setEdit((x) => ({ ...x, title: e.target.value }))} />
        <TextInput label="Location description" value={edit.location || ''} onChange={(e) => setEdit((x) => ({ ...x, location: e.target.value }))} />
        <Select label="Severity" value={edit.severity || incident.severity} onChange={(v) => setEdit((x) => ({ ...x, severity: v }))} options={SEVERITIES} />
        <TextArea label="Description" value={edit.description || ''} onChange={(e) => setEdit((x) => ({ ...x, description: e.target.value }))} />
        <p className="bx-help">Status, verification and assignment change through their own controlled actions. Lifecycle statuses: {INCIDENT_STATUSES.join(', ')}.</p>
      </Modal>
      <TaskForm open={taskOpen} onClose={() => setTaskOpen(false)}
        initial={{ incidentId: incident.id, location: incident.location, category: 'Field verification' }} />
      {alertOpen && <AlertDrawer alertId={alertOpen} onClose={() => setAlertOpen(null)} />}
    </>
  );
}
