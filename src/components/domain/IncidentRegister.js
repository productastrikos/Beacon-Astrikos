import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import DataTable from '../tables/DataTable';
import { Select, Button, IconSelect } from '../ui/Controls';
import { SEVERITY_ICON, INCIDENT_STATUS_ICON } from '../../config/icons';
import { useDrawerParam } from '../../state/useDrawerParam';
import { SeverityBadge, IncidentStatusBadge, VerificationBadge } from '../ui/Badges';
import { HAZARDS, INCIDENT_STATUSES, INCIDENT_ACTIVE_STATUSES, SEVERITIES, SEVERITY_RANK } from '../../types';
import { hazardLabel, stateName } from './common';
import { assigneeName, isOverdueIncident } from '../../state/selectors';
import { fmtDateTime, fmtRelative } from '../../utils/format';
import { useAuth } from '../../state/hooks';
import IncidentForm from './IncidentForm';

const assignedWord = (r) => (!(r.assignedTeam || r.assignedOperator) ? 'Unassigned' : isOverdueIncident(r, Date.now()) ? 'Overdue' : 'Assigned');

/**
 * Searchable incident register with hazard / severity / status / state filters,
 * row-click drawer and link to the full record.
 */
export default function IncidentRegister({
  incidents, pageSize = 8, defaultStatus = 'Active', severityFilter, onSeverityFilterChange, allowCreate, exportName, caption = 'Incident register',
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can } = useAuth();
  const [hazard, setHazard] = useState('');
  const [severityLocal, setSeverityLocal] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [state, setState] = useState('');
  const { value: selected, open: openIncident } = useDrawerParam('incident');
  const [creating, setCreating] = useState(false);
  const severity = severityFilter !== undefined ? severityFilter : severityLocal;
  const setSeverity = onSeverityFilterChange || setSeverityLocal;

  const states = useMemo(() => [...new Set(incidents.map((i) => i.stateCode))].sort(), [incidents]);
  const rows = useMemo(() => incidents.filter((i) => (
    (!hazard || i.hazard === hazard)
    && (!severity || i.severity === severity)
    && (!state || i.stateCode === state)
    && (status === 'All' ? true : status === 'Active' ? INCIDENT_ACTIVE_STATUSES.includes(i.status) : i.status === status)
  )), [incidents, hazard, severity, status, state]);

  const columns = [
    { id: 'id', header: 'Incident ID', accessor: (r) => r.id, cell: (r) => <span className="bx-mono bx-id">{r.id}</span> },
    { id: 'title', header: 'Title', accessor: (r) => r.title },
    { id: 'hazard', header: 'Hazard', accessor: (r) => hazardLabel(r.hazard) },
    { id: 'state', header: 'State', accessor: (r) => stateName(r.stateCode) },
    { id: 'district', header: 'District / Location', accessor: (r) => `${r.district} · ${r.location}` },
    { id: 'severity', header: 'Severity', accessor: (r) => r.severity, sortValue: (r) => SEVERITY_RANK[r.severity], cell: (r) => <SeverityBadge value={r.severity} /> },
    { id: 'verification', header: 'Verification', accessor: (r) => r.verification, cell: (r) => <VerificationBadge value={r.verification} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <IncidentStatusBadge value={r.status} /> },
    { id: 'assigned', header: 'Assigned', accessor: (r) => assignedWord(r), cell: (r) => {
      const w = assignedWord(r);
      const who = r.assignedTeam || r.assignedOperator;
      return <span className={`bx-text-state tone-${w === 'Overdue' ? 'red' : w === 'Assigned' ? 'green' : 'slate'}`} title={who ? assigneeName(who) : undefined}>{w}</span>;
    } },
    { id: 'updated', header: 'Last updated', accessor: (r) => r.updatedAt, cell: (r) => <span title={fmtDateTime(r.updatedAt)}>{fmtRelative(r.updatedAt)}</span> },
  ];

  const filters = (
    <>
      <Select label="Hazard" compact value={hazard} onChange={setHazard} placeholder="All hazards" options={HAZARDS.map((h) => ({ value: h.key, label: h.label }))} />
      <IconSelect label="Severity" value={severity} onChange={setSeverity} placeholder="All severities" options={SEVERITIES.map((x) => ({ value: x, label: x, icon: SEVERITY_ICON[x] }))} />
      <IconSelect label="Status" value={status === 'Active' ? '' : status} onChange={(v) => setStatus(v || 'Active')} placeholder="Active"
        options={[{ value: 'All', label: 'All' }, ...INCIDENT_STATUSES.map((x) => ({ value: x, label: x, icon: INCIDENT_STATUS_ICON[x] }))]} />
      <Select label="State" compact value={state} onChange={setState} placeholder="All in scope" options={states.map((c) => ({ value: c, label: stateName(c) }))} />
    </>
  );

  return (
    <>
      <DataTable initialQuery={params.get('q') || ''} columns={columns} rows={rows} pageSize={pageSize} caption={caption} filters={filters}
        searchPlaceholder="ID, title, district…" onRowClick={(r) => openIncident(r.id)} selectedKey={selected}
        defaultSort={{ id: 'updated', dir: 'desc' }} exportName={exportName}
        emptyHint="No incidents match. Clear a filter or change the scope."
        toolbarExtra={allowCreate && can('incident.create') ? <Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>New incident</Button> : null} />
      <IncidentForm open={creating} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/incidents/${id}`)} />
    </>
  );
}
