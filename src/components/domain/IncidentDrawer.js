import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Drawer } from '../ui/Overlay';
import { SeverityBadge, IncidentStatusBadge, VerificationBadge } from '../ui/Badges';
import { KeyValue } from '../ui/Layout';
import { hazardLabel, stateName } from './common';
import { assigneeName } from '../../state/selectors';
import { useData } from '../../state/dataStore';
import { fmtDateTime } from '../../utils/format';

function IncidentSummary({ incident }) {
  return (
    <KeyValue items={[
      ['Incident ID', incident.id],
      ['Hazard', hazardLabel(incident.hazard)],
      ['Location', `${incident.location} — ${incident.district}, ${stateName(incident.stateCode)}`],
      ['Severity', <SeverityBadge value={incident.severity} />],
      ['Verification', <VerificationBadge value={incident.verification} />],
      ['Status', <IncidentStatusBadge value={incident.status} />],
      ['Operator', assigneeName(incident.assignedOperator)],
      ['Team', assigneeName(incident.assignedTeam)],
      ['Created', fmtDateTime(incident.createdAt)],
      ['Last updated', fmtDateTime(incident.updatedAt)],
      ['Due', incident.dueAt ? fmtDateTime(incident.dueAt) : '—'],
      ['Provenance', incident.provenance],
      ['Linked alerts', incident.linkedAlertIds.join(', ') || '—'],
      ['Tasks', incident.taskIds.join(', ') || '—'],
    ]} />
  );
}

/** Shared incident drawer: opens in place on any page; the only navigation is the explicit link under the ID. */
export default function IncidentDrawer({ incidentId, onClose }) {
  const incident = useData((s) => s.incidents.find((i) => i.id === incidentId));
  const { pathname } = useLocation();
  if (!incident) return null;
  const link = pathname.startsWith('/incidents/') ? null : (
    <Link className="bx-drawer-link" to={`/incidents/${incident.id}`}>Open in Incident Management ↗</Link>
  );
  return (
    <Drawer open onClose={onClose} title={incident.title} subtitle={<>{incident.id}{link && <><br />{link}</>}</>}>
      <p className="bx-muted">{incident.description}</p>
      <IncidentSummary incident={incident} />
    </Drawer>
  );
}
