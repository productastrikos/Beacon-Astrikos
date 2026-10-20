import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScoped } from '../../state/hooks';
import { isActiveIncident, isActiveAlert, scopeLabel } from '../../state/selectors';
import { PageHeader, Card, Banner } from '../../components/ui/Layout';
import DataTable from '../../components/tables/DataTable';
import { Badge, SeverityBadge } from '../../components/ui/Badges';
import { HAZARD_LABEL, SEVERITY_RANK, HAZARD_KEYS } from '../../types';
import { stateName } from '../../components/domain/common';

/** Districts where two or more distinct hazard types are concurrently active. */
export default function MultiHazard() {
  const navigate = useNavigate();
  const { scope, incidents, alerts, flags, now } = useScoped();

  const { districts, pairs } = useMemo(() => {
    const m = {};
    const get = (st, d) => (m[`${st}:${d}`] ||= { key: `${st}:${d}`, state: st, district: d, hazards: new Set(), incidents: 0, alerts: 0, top: 'None' });
    incidents.filter(isActiveIncident).forEach((i) => {
      const r = get(i.stateCode, i.district);
      r.hazards.add(i.hazard); r.incidents += 1;
      if (SEVERITY_RANK[i.severity] > SEVERITY_RANK[r.top]) r.top = i.severity;
    });
    alerts.filter((a) => isActiveAlert(a, now) && a.classification !== 'Historical').forEach((a) => {
      a.districts.forEach((d) => { const r = get(a.stateCode, d); r.hazards.add(a.hazard); r.alerts += 1; });
    });
    flags.filter((f) => f.state === 'Open').forEach((f) => { get(f.stateCode, f.district).hazards.add(f.hazard); });
    const list = Object.values(m).map((r) => ({ ...r, hazards: [...r.hazards] })).filter((r) => r.hazards.length >= 2);
    const pairCount = {};
    list.forEach((r) => {
      r.hazards.forEach((a) => r.hazards.forEach((b) => { if (a < b) pairCount[`${a}|${b}`] = (pairCount[`${a}|${b}`] || 0) + 1; }));
    });
    return { districts: list, pairs: Object.entries(pairCount).map(([k, n]) => { const [a, b] = k.split('|'); return { key: k, a, b, n }; }) };
  }, [incidents, alerts, flags, now]);

  const cols = [
    { id: 'state', header: 'State', accessor: (r) => stateName(r.state) },
    { id: 'district', header: 'District', accessor: (r) => r.district },
    { id: 'hazards', header: 'Concurrent hazards', accessor: (r) => r.hazards.map((h) => HAZARD_LABEL[h]).join(', '), wrap: true,
      cell: (r) => <span className="bx-row" style={{ gap: 4 }}>{r.hazards.map((h) => <Badge key={h} color="blue">{HAZARD_LABEL[h]}</Badge>)}</span> },
    { id: 'count', header: 'Hazard types', num: true, accessor: (r) => r.hazards.length },
    { id: 'incidents', header: 'Active incidents', num: true, accessor: (r) => r.incidents },
    { id: 'alerts', header: 'Active warnings', num: true, accessor: (r) => r.alerts },
    { id: 'top', header: 'Highest incident severity', accessor: (r) => r.top, sortValue: (r) => SEVERITY_RANK[r.top], cell: (r) => <SeverityBadge value={r.top === 'None' ? null : r.top} /> },
  ];
  const pairCols = [
    { id: 'pair', header: 'Hazard combination', accessor: (r) => `${HAZARD_LABEL[r.a]} + ${HAZARD_LABEL[r.b]}` },
    { id: 'n', header: 'Districts', num: true, accessor: (r) => r.n },
  ];

  return (
    <>
      <PageHeader title="Multi-Hazard Intelligence"
        description={`Districts in ${scopeLabel(scope)} where several hazard types are active at once. Combinations are counted from active incidents, warnings and monitoring flags.`} />
      <div style={{ marginBottom: 12 }}>
        <Banner kind="info">Compound-risk interpretation requires analyst review. A combination listed here is a coincidence of active records, not a model-predicted cascade.</Banner>
      </div>
      <div className="bx-grid bx-grid-main">
        <Card title="Districts with concurrent hazards" flush>
          <DataTable columns={cols} rows={districts} rowKey="key" pageSize={10} caption="Districts with concurrent hazards" defaultSort={{ id: 'count', dir: 'desc' }}
            emptyTitle="No district has two or more concurrent hazard types in this scope" />
        </Card>
        <Card title="Common combinations" flush>
          <DataTable columns={pairCols} rows={pairs} rowKey="key" searchable={false} pageSize={8} caption="Hazard combinations" defaultSort={{ id: 'n', dir: 'desc' }} />
        </Card>
      </div>
      <div className="bx-row" style={{ marginTop: 12 }}>
        {HAZARD_KEYS.map((h) => <button key={h} type="button" className="bx-btn bx-btn-sm" onClick={() => navigate(`/hazards/${h}`)}>{HAZARD_LABEL[h]}</button>)}
      </div>
    </>
  );
}
