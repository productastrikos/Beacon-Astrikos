import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScoped } from '../../state/hooks';
import { isActiveIncident, isActiveAlert, isOpenTask, isOverdueTask, scopeLabel, hazardMatrix, scopeFilter } from '../../state/selectors';
import { setScope } from '../../state/uiStore';
import { useDrawerParam } from '../../state/useDrawerParam';
import { PageHeader, Card } from '../../components/ui/Layout';
import DataTable from '../../components/tables/DataTable';
import { SeverityBadge, StatusBadge } from '../../components/ui/Badges';
import DeltaChip from '../../components/ui/DeltaChip';
import { Drawer } from '../../components/ui/Overlay';
import { SEVERITY_RANK, HAZARD_LABEL } from '../../types';
import { STATE_NAME, DISTRICTS, STATE_HAZARDS } from '../../data/demo/geography';
import { classify } from '../../data/demo/stationModel';
import { fmtRelative, TIME } from '../../utils/format';

const STATE_CODES = Object.keys(STATE_HAZARDS);
const latest = (list) => list.reduce((m, t) => (t && t > m ? t : m), '');

/** Overall hazard status from what is happening in scope. */
function hazardStatus(r) {
  if (r.critical > 0) return 'Critical';
  if (r.high >= 2 || r.exceeding >= 3) return 'Warning';
  if (r.high >= 1 || r.exceeding >= 1 || r.alerts >= 1) return 'Watch';
  return 'Normal';
}
const STATUS_TONE = { Normal: 'green', Watch: 'blue', Warning: 'amber', Critical: 'red' };
const STATUS_RANK = { Normal: 0, Watch: 1, Warning: 2, Critical: 3 };

export default function SituationalOverview() {
  const navigate = useNavigate();
  const incidentDrawer = useDrawerParam('incident');
  const { data, scope, now, incidents, alerts, tasks } = useScoped();
  const [district, setDistrict] = useState(null);
  const byState = scope === 'IN';

  const hazardRows = useMemo(() => {
    const recs = scopeFilter(data.records, scope);
    return hazardMatrix(data, scope, now).map((r) => {
      const mine = incidents.filter((i) => i.hazard === r.hazard && !i.historical);
      const last24 = mine.filter((i) => now - new Date(i.createdAt).getTime() <= TIME.DAY).length;
      const prev24 = mine.filter((i) => { const age = now - new Date(i.createdAt).getTime(); return age > TIME.DAY && age <= 2 * TIME.DAY; }).length;
      const row = { ...r, exceeding: recs.filter((x) => x.hazard === r.hazard && classify(x).exceeding).length, trend: last24 - prev24 };
      return { ...row, status: hazardStatus(row) };
    });
  }, [data, scope, now, incidents]);

  const placeRows = useMemo(() => {
    const names = byState ? STATE_CODES : (DISTRICTS[scope] || []);
    const incById = Object.fromEntries(incidents.map((i) => [i.id, i]));
    const keyOfIncident = (i) => (byState ? i.stateCode : i.district);
    const keyOfTask = (t) => (byState ? t.stateCode : (incById[t.incidentId] ? incById[t.incidentId].district : null));
    const rows = Object.fromEntries(names.map((n) => [n, { key: n, name: byState ? STATE_NAME[n] : n, top: 'None', incidents: 0, alerts: 0, tasks: 0, overdue: 0, times: [] }]));
    incidents.filter(isActiveIncident).forEach((i) => {
      const r = rows[keyOfIncident(i)]; if (!r) return;
      r.incidents += 1; r.times.push(i.updatedAt);
      if ((SEVERITY_RANK[i.severity] || 0) > (SEVERITY_RANK[r.top] || 0)) r.top = i.severity;
    });
    alerts.filter((a) => isActiveAlert(a, now) && a.classification === 'Official').forEach((a) => {
      (byState ? [a.stateCode] : a.districts).forEach((k) => { if (rows[k]) { rows[k].alerts += 1; rows[k].times.push(a.sent); } });
    });
    tasks.filter((t) => !t.historical && isOpenTask(t)).forEach((t) => {
      const r = rows[keyOfTask(t)]; if (!r) return;
      r.tasks += 1;
      if (isOverdueTask(t, now)) r.overdue += 1;
      const lastEntry = (t.stageLog || []).slice(-1)[0];
      if (lastEntry) r.times.push(lastEntry.at);
    });
    return Object.values(rows).map((r) => ({ ...r, last: latest(r.times) || null }))
      .sort((a, b) => ((SEVERITY_RANK[b.top] || 0) - (SEVERITY_RANK[a.top] || 0)) || (b.incidents - a.incidents) || a.name.localeCompare(b.name));
  }, [byState, scope, incidents, alerts, tasks, now]);

  const recent = useMemo(() => data.audit.filter((a) => a.outcome === 'Success').slice(0, 10).map((a) => ({
    id: a.id,
    title: `${a.action} — ${a.entityType} ${a.entityId}${a.next ? ` → ${a.next}` : ''}`,
    meta: `${fmtRelative(a.at, now)} · ${['Live feed', 'System'].includes(a.userName) || !a.role || a.role === '—' ? 'System' : `${a.userName} · ${a.role}`}`,
  })), [data.audit, now]);

  const hazardCols = [
    { id: 'hazard', header: 'Hazard', accessor: (r) => HAZARD_LABEL[r.hazard] },
    { id: 'incidents', header: 'Active incidents', num: true, accessor: (r) => r.incidents },
    { id: 'crit', header: 'Critical', num: true, accessor: (r) => r.critical },
    { id: 'high', header: 'High', num: true, accessor: (r) => r.high },
    { id: 'alerts', header: 'Active warnings', num: true, accessor: (r) => r.alerts },
    { id: 'exceeding', header: 'Stations above threshold', num: true, accessor: (r) => r.exceeding },
    { id: 'flags', header: 'Open flags', num: true, accessor: (r) => r.flags },
    { id: 'trend', header: 'Trend 24 h', num: true, accessor: (r) => r.trend, cell: (r) => <DeltaChip value={r.trend} upIsBad title={`${r.trend > 0 ? '+' : ''}${r.trend} new incidents vs the previous 24 h`} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, sortValue: (r) => STATUS_RANK[r.status], cell: (r) => <StatusBadge tone={STATUS_TONE[r.status]} label={r.status} /> },
  ];
  const placeCols = [
    { id: 'name', header: byState ? 'State' : 'District', accessor: (r) => r.name },
    { id: 'top', header: 'Highest severity', accessor: (r) => r.top, sortValue: (r) => SEVERITY_RANK[r.top] || 0, cell: (r) => <SeverityBadge value={r.top === 'None' ? null : r.top} /> },
    { id: 'incidents', header: 'Active incidents', num: true, accessor: (r) => r.incidents },
    { id: 'alerts', header: 'Active warnings', num: true, accessor: (r) => r.alerts },
    { id: 'tasks', header: 'Open tasks', num: true, accessor: (r) => r.tasks },
    { id: 'overdue', header: 'Overdue', num: true, accessor: (r) => r.overdue },
    { id: 'last', header: 'Last activity', num: true, accessor: (r) => r.last, cell: (r) => (r.last ? fmtRelative(r.last, now) : '—') },
  ];
  const districtIncidents = district ? incidents.filter((i) => isActiveIncident(i) && i.district === district).sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)) : [];

  return (
    <>
      <PageHeader title="Situational Overview"
        description={`Cross-hazard and cross-${byState ? 'state' : 'district'} picture for ${scopeLabel(scope)}. Updates live.`} />
      <div className="bx-so-grid">
        <Card title="Hazard status" subtitle="Click a hazard to open its module" flush>
          <DataTable columns={hazardCols} rows={hazardRows} rowKey="hazard" searchable={false} pageSize={10} caption="Hazard status" dense hidePagerWhenFits maxHeight={420}
            onRowClick={(r) => navigate(`/hazards/${r.hazard}`)} defaultSort={{ id: 'incidents', dir: 'desc' }} />
        </Card>
        <Card title={byState ? 'Operational load by state' : `Operational load by district — ${scopeLabel(scope)}`}
          subtitle={byState ? 'Click a state to set it as the scope' : 'Click a district to list its active incidents'}
          actions={!byState && (
            <span className="bx-crumb-chip">
              <button type="button" onClick={() => setScope('IN')}>PAN INDIA</button> › <strong>{scopeLabel(scope)}</strong>
            </span>
          )} flush>
          <DataTable columns={placeCols} rows={placeRows} rowKey="key" searchable={false} pageSize={10} caption="Operational load" dense hidePagerWhenFits maxHeight={420}
            onRowClick={(r) => (byState ? setScope(r.key) : setDistrict(r.key))} emptyTitle="No data for this scope" />
        </Card>
      </div>

      <div style={{ marginTop: 12 }}>
        <Card title="Latest recorded activity" subtitle="Most recent successful actions across operators and integrations"
          actions={<button type="button" className="bx-ra-link" onClick={() => navigate('/reports')}>View all activity ›</button>}>
          <ul className="bx-so-activity">
            {recent.map((r) => (
              <li key={r.id}><span className="bx-so-act-title" title={r.title}>{r.title}</span><span className="bx-so-act-meta">{r.meta}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      {district && (
        <Drawer open onClose={() => setDistrict(null)} title={`${district} — active incidents`} subtitle={`${districtIncidents.length} in ${scopeLabel(scope)}`}>
          {districtIncidents.length === 0 ? <div className="bx-faint">No active incidents in this district.</div> : districtIncidents.map((i) => (
            <button key={i.id} type="button" className="bx-so-incident" onClick={() => incidentDrawer.open(i.id)}>
              <span className="bx-mono">{i.id}</span>
              <span className="bx-so-act-title" title={i.title}>{i.title}</span>
              <SeverityBadge value={i.severity} />
            </button>
          ))}
        </Drawer>
      )}
    </>
  );
}
