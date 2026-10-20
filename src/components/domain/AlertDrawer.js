import React, { useMemo, useState } from 'react';
import { CheckCheck, Link2, FilePlus2, NotebookPen } from 'lucide-react';
import { Drawer } from '../ui/Overlay';
import { Button, Select, TextInput } from '../ui/Controls';
import { KeyValue, Timeline, Banner } from '../ui/Layout';
import { CapSeverityBadge, ClassificationBadge, AlertStatusBadge } from '../ui/Badges';
import { useData } from '../../state/dataStore';
import { useAuth, useNow } from '../../state/hooks';
import { alertStatus, validityLabel } from '../../state/selectors';
import { acknowledgeAlert, addAlertNote, linkAlertToIncident } from '../../state/actions';
import { SOURCE_NAME } from '../../data/demo/sources';
import { buildOriginalMessage } from '../../data/demo/alerts';
import { fmtDateTime } from '../../utils/format';
import { hazardLabel, ActivityLog, IncidentLink } from './common';
import IncidentForm from './IncidentForm';
import { INCIDENT_ACTIVE_STATUSES } from '../../types';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const CAP_TO_INTERNAL = { Extreme: 'Critical', Severe: 'High', Moderate: 'Moderate', Minor: 'Low', Unknown: 'Low' };

export default function AlertDrawer({ alertId, onClose }) {
  const alert = useData((s) => s.alerts.find((a) => a.id === alertId));
  const incidents = useData((s) => s.incidents);
  const { can } = useAuth();
  const navigate = useNavigate();
  const onAlertsPage = useLocation().pathname.startsWith('/alerts');
  const now = useNow();
  const [ackNote, setAckNote] = useState('');
  const [note, setNote] = useState('');
  const [linkId, setLinkId] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const linkable = useMemo(() => incidents.filter((i) => INCIDENT_ACTIVE_STATUSES.includes(i.status)
    && alert && !i.linkedAlertIds.includes(alert.id) && i.hazard === alert.hazard && i.stateCode === alert.stateCode), [incidents, alert]);

  if (!alert) return null;
  const status = alertStatus(alert, now);

  const run = (res) => { setMsg(res.ok ? '' : res.error); return res; };

  return (
    <>
      <Drawer open onClose={onClose} title={alert.headline} subtitle={<>{`${alert.id} · ${alert.identifier}`}{!onAlertsPage && <><br /><Link className="bx-drawer-link" to={`/alerts?open=${alert.id}`}>Open in Alerts & Warnings ↗</Link></>}</>}>
        <div className="bx-row">
          <ClassificationBadge value={alert.classification} />
          <AlertStatusBadge value={status} />
          <CapSeverityBadge value={alert.severity} />
          
        </div>
        {msg && <Banner kind="danger">{msg}</Banner>}

        <section>
          <div className="bx-section-title">Source message fields (as issued)</div>
          <KeyValue items={[
            ['Source agency', SOURCE_NAME[alert.sender] || alert.sender],
            ['Hazard', hazardLabel(alert.hazard)],
            ['Event', alert.event],
            ['Source severity', alert.severity],
            ['Urgency', alert.urgency],
            ['Certainty', alert.certainty],
            ['Message type', alert.msgType],
            ['CAP status', alert.status],
            ['Area', alert.areaDesc],
            ['Issued', fmtDateTime(alert.sent)],
            ['Effective', fmtDateTime(alert.effective)],
            ['Expires', `${fmtDateTime(alert.expires)} (${validityLabel(alert, now)})`],
            ['Instruction', alert.instruction],
          ]} />
        </section>

        <section>
          <div className="bx-section-title">Acknowledgement</div>
          {alert.ackAt ? (
            <Banner kind="success">Acknowledged by {alert.ackBy} at {fmtDateTime(alert.ackAt)}.</Banner>
          ) : (
            <div className="bx-row" style={{ alignItems: 'flex-end' }}>
              <TextInput label="Optional note" value={ackNote} onChange={(e) => setAckNote(e.target.value)} className="" />
              <Button variant="primary" icon={CheckCheck} disabled={!can('alert.ack') || status === 'Cancelled'}
                title={!can('alert.ack') ? 'Your role cannot acknowledge alerts' : undefined}
                onClick={() => { if (run(acknowledgeAlert(alert.id, ackNote)).ok) setAckNote(''); }}>
                Acknowledge
              </Button>
            </div>
          )}
        </section>

        <section>
          <div className="bx-section-title">Linked incidents</div>
          {alert.linkedIncidentIds.length ? (
            <div className="bx-row">{alert.linkedIncidentIds.map((id) => <IncidentLink key={id} id={id} />)}</div>
          ) : <div className="bx-faint">None linked.</div>}
          <div className="bx-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
            <Select label="Link to existing incident" value={linkId} onChange={setLinkId} placeholder="Select incident…"
              options={linkable.map((i) => ({ value: i.id, label: `${i.id} — ${i.title}` }))} />
            <Button icon={Link2} disabled={!linkId || !can('alert.link')} onClick={() => { if (run(linkAlertToIncident(alert.id, linkId)).ok) setLinkId(''); }}>Link</Button>
            <Button icon={FilePlus2} disabled={!can('incident.create')} onClick={() => setCreating(true)}>Create incident</Button>
          </div>
        </section>

        <section>
          <div className="bx-section-title">Operator notes</div>
          {alert.notes.length ? (
            <Timeline items={alert.notes.map((n) => ({ id: n.id, text: n.text, meta: `${fmtDateTime(n.at)} · ${n.by}` }))} />
          ) : <div className="bx-faint">No notes.</div>}
          <div className="bx-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
            <TextInput label="Add note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button icon={NotebookPen} disabled={!note.trim() || !can('alert.note')} onClick={() => { if (run(addAlertNote(alert.id, note)).ok) setNote(''); }}>Add</Button>
          </div>
        </section>

        <section>
          <div className="bx-section-title">Source updates and cancellations</div>
          <Timeline items={alert.history.map((h, i) => ({ id: `${i}`, text: <span><strong>{h.msgType}</strong> — {h.note}</span>, meta: fmtDateTime(h.at) }))} />
        </section>

        <section>
          <div className="bx-section-title">Original source message (preserved verbatim)</div>
          <pre className="bx-pre bx-mono">{buildOriginalMessage(alert)}</pre>
        </section>

        <section>
          <div className="bx-section-title">Action history</div>
          <ActivityLog entityId={alert.id} />
        </section>
      </Drawer>
      <IncidentForm open={creating} onClose={() => setCreating(false)} fromAlertId={alert.id}
        initial={{ title: alert.headline, hazard: alert.hazard, stateCode: alert.stateCode, district: alert.districts[0], location: alert.areaDesc, severity: CAP_TO_INTERNAL[alert.severity], description: alert.description }}
        onCreated={(id) => navigate(`/incidents/${id}`)} />
    </>
  );
}
