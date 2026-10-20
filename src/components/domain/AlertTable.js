import React, { useMemo, useState } from 'react';
import DataTable from '../tables/DataTable';
import { Select, Button } from '../ui/Controls';
import { CapSeverityBadge, ClassificationBadge, AlertStatusBadge, Badge } from '../ui/Badges';
import { HAZARDS, CAP_SEVERITIES, CAP_SEVERITY_RANK, ALERT_CLASSIFICATIONS } from '../../types';
import { SOURCE_SHORT } from '../../data/demo/sources';
import { alertStatus, validityLabel } from '../../state/selectors';
import { fmtDateTime } from '../../utils/format';
import { hazardLabel } from './common';
import AlertDrawer from './AlertDrawer';

/** Full alert register with filters and drawer. `compact` trims columns for dashboards. */
export default function AlertTable({ alerts, now, pageSize = 10, compact, defaultActiveOnly = true, openId, onOpenIdChange, exportName }) {
  const [hazard, setHazard] = useState('');
  const [agency, setAgency] = useState('');
  const [severity, setSeverity] = useState('');
  const [klass, setKlass] = useState('');
  const [scopeStatus, setScopeStatus] = useState(defaultActiveOnly ? 'Active' : 'All');
  const [localOpen, setLocalOpen] = useState(null);
  const open = openId !== undefined ? openId : localOpen;
  const setOpen = onOpenIdChange || setLocalOpen;

  const agencies = useMemo(() => [...new Set(alerts.map((a) => a.sender))].sort(), [alerts]);
  const rows = useMemo(() => alerts.filter((a) => {
    const st = alertStatus(a, now);
    return (!hazard || a.hazard === hazard) && (!agency || a.sender === agency) && (!severity || a.severity === severity)
      && (!klass || a.classification === klass)
      && (scopeStatus === 'All' || (scopeStatus === 'Active' ? ['Active', 'Updated'].includes(st) : st === scopeStatus));
  }), [alerts, hazard, agency, severity, klass, scopeStatus, now]);

  const cols = [
    { id: 'id', header: 'Alert ID', accessor: (r) => r.id, cell: (r) => <span className="bx-mono">{r.id}</span> },
    { id: 'agency', header: 'Source agency', accessor: (r) => SOURCE_SHORT[r.sender] || r.sender },
    { id: 'hazard', header: 'Hazard', accessor: (r) => hazardLabel(r.hazard) },
    { id: 'area', header: 'Affected location', accessor: (r) => r.areaDesc, wrap: true },
    { id: 'severity', header: 'Source severity', accessor: (r) => r.severity, sortValue: (r) => CAP_SEVERITY_RANK[r.severity], cell: (r) => <CapSeverityBadge value={r.severity} /> },
    ...(compact ? [] : [
      { id: 'urgency', header: 'Urgency', accessor: (r) => r.urgency },
      { id: 'certainty', header: 'Certainty', accessor: (r) => r.certainty },
    ]),
    { id: 'issued', header: 'Issued', accessor: (r) => r.sent, cell: (r) => fmtDateTime(r.sent) },
    ...(compact ? [] : [{ id: 'expires', header: 'Expires', accessor: (r) => r.expires, cell: (r) => fmtDateTime(r.expires) }]),
    { id: 'status', header: 'Validity', accessor: (r) => validityLabel(r, now), cell: (r) => <AlertStatusBadge value={alertStatus(r, now)} /> },
    { id: 'class', header: 'Classification', accessor: (r) => r.classification, cell: (r) => <ClassificationBadge value={r.classification} /> },
    ...(compact ? [] : [{ id: 'ack', header: 'Acknowledgement', accessor: (r) => (r.ackAt ? 'Acknowledged' : 'Unacknowledged'),
      cell: (r) => <Badge color={r.ackAt ? 'green' : 'amber'}>{r.ackAt ? 'Acknowledged' : 'Unacknowledged'}</Badge> }]),
    { id: 'view', header: 'Action', sortable: false, cell: (r) => <Button size="sm" onClick={(e) => { e.stopPropagation(); setOpen(r.id); }}>View details</Button> },
  ];

  const filters = (
    <>
      <Select label="Hazard" compact value={hazard} onChange={setHazard} placeholder="All" options={HAZARDS.map((h) => ({ value: h.key, label: h.label }))} />
      <Select label="Agency" compact value={agency} onChange={setAgency} placeholder="All" options={agencies.map((a) => ({ value: a, label: SOURCE_SHORT[a] || a }))} />
      <Select label="Source severity" compact value={severity} onChange={setSeverity} placeholder="All" options={CAP_SEVERITIES} />
      <Select label="Classification" compact value={klass} onChange={setKlass} placeholder="All" options={ALERT_CLASSIFICATIONS} />
      <Select label="Validity" compact value={scopeStatus} onChange={setScopeStatus} options={['Active', 'All', 'Expired', 'Cancelled']} />
    </>
  );

  return (
    <>
      <DataTable columns={cols} rows={rows} pageSize={pageSize} caption="Alerts and warnings" filters={filters}
        onRowClick={(r) => setOpen(r.id)} selectedKey={open} defaultSort={{ id: 'issued', dir: 'desc' }} exportName={exportName}
        searchPlaceholder="Alert ID, area, event…" emptyHint="No alerts match the current filters and scope." />
      {open && <AlertDrawer alertId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
