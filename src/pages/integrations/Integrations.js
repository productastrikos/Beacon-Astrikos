import React, { useMemo, useState } from 'react';
import { useScoped } from '../../state/hooks';
import { PageHeader, Card, KpiCard, KeyValue } from '../../components/ui/Layout';
import DataSourcePill from '../../components/ui/DataSourcePill';
import { baselineFor } from '../../state/baseline';
import { stats, breakdownOf, oldestAge } from '../../utils/kpiHelpers';
import DataTable from '../../components/tables/DataTable';
import { FreshnessBadge, Badge } from '../../components/ui/Badges';
import { Drawer } from '../../components/ui/Overlay';
import { Select } from '../../components/ui/Controls';
import { HAZARD_LABEL, SOURCE_STATUSES } from '../../types';
import { fmtDateTime, fmtRelative, freshness } from '../../utils/format';

export default function Integrations() {
  const { data, now } = useScoped();
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const sources = data.sources;
  const rows = useMemo(() => sources.filter((s) => !status || s.status === status), [sources, status]);
  const count = (st) => sources.filter((s) => s.status === st).length;
  const sel = sources.find((s) => s.id === selected);
  const prevCount = (st) => baselineFor(data.baseAt).sources.filter((x) => x.status === st).length;
  const lastSync = sources.map((x) => x.lastSuccess).filter(Boolean).sort().pop();
  const srcRows = (sts) => ({ columns: [{ header: 'Source', get: (x) => x.short }, { header: 'Status', get: (x) => x.status }, { header: 'Last success', get: (x) => (x.lastSuccess ? fmtDateTime(x.lastSuccess) : 'None') }], items: sources.filter((x) => sts.includes(x.status)) });

  const cols = [
    { id: 'name', header: 'Source', accessor: (r) => r.name, wrap: true },
    { id: 'hazards', header: 'Hazard categories', accessor: (r) => r.hazards.map((h) => HAZARD_LABEL[h]).join(', ') || '—', wrap: true },
    { id: 'method', header: 'Integration method', accessor: (r) => r.method, wrap: true },
    { id: 'status', header: 'Connection status', accessor: (r) => r.status, cell: (r) => <DataSourcePill status={r.status} lastSync={r.lastSuccess} now={now} showTime={false} /> },
    { id: 'ok', header: 'Last successful update', accessor: (r) => r.lastSuccess || '', cell: (r) => (r.lastSuccess ? fmtDateTime(r.lastSuccess) : <span className="bx-faint">None</span>) },
    { id: 'try', header: 'Latest ingestion attempt', accessor: (r) => r.lastAttempt || '', cell: (r) => (r.lastAttempt ? fmtRelative(r.lastAttempt, now) : <span className="bx-faint">None</span>) },
    { id: 'fresh', header: 'Data freshness', accessor: (r) => (r.lastSuccess ? freshness(r.lastSuccess, now).label : 'No data'),
      cell: (r) => (r.lastSuccess ? <FreshnessBadge {...(() => { const f = freshness(r.lastSuccess, now); return { level: f.level, label: f.label }; })()} /> : <Badge color="grey">No data</Badge>) },
    { id: 'records', header: 'Records ingested', num: true, accessor: (r) => r.records },
    { id: 'config', header: 'Configuration', accessor: (r) => r.configStatus, wrap: true },
  ];

  return (
    <>
      <PageHeader title="Data Sources & Integrations"
        description="Status of external data sources and ingestion health." />
      <div className="bx-kpi-grid">
        <KpiCard id="int.connected" label="Connected" value={count('Connected')} previous={prevCount('Connected')}
          stats={stats([['Of', sources.length], ['Latest sync', lastSync ? fmtRelative(lastSync, now) : null]])}
          breakdown={breakdownOf(sources, (x) => x.status, { title: 'By status', xTitle: 'Sources', yTitle: 'Status', order: SOURCE_STATUSES })} rows={srcRows(['Connected'])} />
        <KpiCard id="int.delayed" label="Delayed" value={count('Delayed')} previous={prevCount('Delayed')}
          stats={stats([['Oldest sync', oldestAge(sources.filter((x) => x.status === 'Delayed').map((x) => x.lastSuccess), now)]])}
          breakdown={breakdownOf(sources.filter((x) => x.status === 'Delayed'), (x) => x.short, { title: 'By source', xTitle: 'Sources', yTitle: 'Source' })} rows={srcRows(['Delayed'])} />
        <KpiCard id="int.offline" label="Offline" value={count('Offline')} previous={prevCount('Offline')}
          stats={stats([['Oldest sync', oldestAge(sources.filter((x) => x.status === 'Offline').map((x) => x.lastSuccess), now)]])}
          breakdown={breakdownOf(sources.filter((x) => x.status === 'Offline'), (x) => x.short, { title: 'By source', xTitle: 'Sources', yTitle: 'Source' })} rows={srcRows(['Offline'])} />
        <KpiCard id="int.records" label="Records ingested" value={sources.reduce((n, x) => n + x.records, 0)} previous={baselineFor(data.baseAt).sources.reduce((n, x) => n + x.records, 0)}
          stats={stats([['Sources reporting', sources.filter((x) => x.records > 0).length], ['Top source', (sources.slice().sort((x, y) => y.records - x.records)[0] || {}).short]])}
          breakdown={{ title: 'By source', xTitle: 'Records', yTitle: 'Source', labels: sources.filter((x) => x.records).map((x) => x.short), data: sources.filter((x) => x.records).map((x) => x.records) }}
          rows={srcRows(SOURCE_STATUSES)} />
      </div>
      <Card flush>
        <DataTable columns={cols} rows={rows} pageSize={12} caption="Data sources" onRowClick={(r) => setSelected(r.id)} selectedKey={selected}
          exportName="data-sources" searchPlaceholder="Source, hazard, method…"
          filters={<Select label="Status" compact value={status} onChange={setStatus} placeholder="All" options={SOURCE_STATUSES} />} />
      </Card>
      {sel && (
        <Drawer open onClose={() => setSelected(null)} title={sel.name} subtitle={sel.id}>
          <div className="bx-row"><DataSourcePill status={sel.status} lastSync={sel.lastSuccess} now={now} /></div>
          <KeyValue items={[
            ['Integration method', sel.method],
            ['Hazard categories', sel.hazards.map((h) => HAZARD_LABEL[h]).join(', ') || 'Ocean-state advisories'],
            ['Official URL', sel.url ? <a href={sel.url} target="_blank" rel="noreferrer noopener">{sel.url}</a> : '—'],
            ['Configuration status', sel.configStatus],
            ['Last successful update', sel.lastSuccess ? fmtDateTime(sel.lastSuccess) : 'None'],
            ['Latest ingestion attempt', sel.lastAttempt ? fmtDateTime(sel.lastAttempt) : 'None'],
            ['Records ingested', sel.records],
            ['Access notes', sel.access],
            ['Error / status detail', sel.error],
          ]} />
        </Drawer>
      )}
    </>
  );
}
