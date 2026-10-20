import React, { useMemo, useState } from 'react';
import { useScoped } from '../../state/hooks';
import { scopeLabel } from '../../state/selectors';
import { PageHeader, Card, KpiCard } from '../../components/ui/Layout';
import { Select } from '../../components/ui/Controls';
import DataTable from '../../components/tables/DataTable';
import { TrendChart, BarsChart, SEVERITY_COLORS } from '../../components/charts/Charts';
import { SourceStatusBadge } from '../../components/ui/Badges';
import { bucketSeries } from '../../utils/trend';
import { HAZARDS, HAZARD_LABEL, SEVERITIES } from '../../types';
import { median, fmtDuration, fmtDateTime, fmtRelative, TIME } from '../../utils/format';
import { stats, breakdownOf, dailySeries } from '../../utils/kpiHelpers';
import { stateName } from '../../components/domain/common';
import { SOURCE_SHORT } from '../../data/demo/sources';

const RANGES = [{ value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }];
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');

export default function HistoricalAnalytics() {
  const { data, scope, now, incidents, alerts, tasks } = useScoped();
  const [range, setRange] = useState('90d');
  const [hazard, setHazard] = useState('');
  const days = range === '30d' ? 30 : 90;
  const since = now - days * TIME.DAY;
  const inRange = (iso) => new Date(iso).getTime() >= since;

  const inc = useMemo(() => incidents.filter((i) => inRange(i.createdAt) && (!hazard || i.hazard === hazard)), [incidents, range, hazard, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const al = useMemo(() => alerts.filter((a) => inRange(a.sent) && (!hazard || a.hazard === hazard)), [alerts, range, hazard, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const tk = useMemo(() => tasks.filter((t) => inRange(t.createdAt)), [tasks, range, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const trend = useMemo(() => bucketSeries(range, [
    { label: 'Incidents', items: inc, at: (i) => i.createdAt, color: '#ef4444' },
    { label: 'Alerts', items: al, at: (a) => a.sent, color: '#3b82f6', dashed: true },
  ], now), [range, inc, al, now]);

  const hazardCounts = HAZARDS.map((h) => inc.filter((i) => i.hazard === h.key).length);
  const sevCounts = SEVERITIES.map((s) => inc.filter((i) => i.severity === s).length);

  const byState = useMemo(() => {
    const m = {};
    inc.forEach((i) => { m[i.stateCode] = (m[i.stateCode] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [inc]);
  const byDistrict = useMemo(() => {
    const m = {};
    inc.forEach((i) => { const k = `${i.stateCode}|${i.district}`; (m[k] ||= { key: k, state: i.stateCode, district: i.district, count: 0, high: 0 }); m[k].count += 1; if (['High', 'Critical'].includes(i.severity)) m[k].high += 1; });
    return Object.values(m);
  }, [inc]);

  // Acknowledgement performance
  const ackStats = useMemo(() => {
    const m = {};
    al.forEach((a) => {
      const r = (m[a.hazard] ||= { hazard: a.hazard, total: 0, acked: 0, mins: [] });
      r.total += 1;
      if (a.ackAt) { r.acked += 1; r.mins.push((new Date(a.ackAt) - new Date(a.sent)) / TIME.MIN); }
    });
    return Object.values(m).map((r) => ({ ...r, median: median(r.mins) }));
  }, [al]);

  const done = tk.filter((t) => t.status === 'Completed');
  const durations = done.filter((t) => t.completedAt).map((t) => new Date(t.completedAt) - new Date(t.createdAt));
  const ackSamples = al.filter((x) => x.ackAt).map((x) => [new Date(x.sent).getTime(), (new Date(x.ackAt) - new Date(x.sent)) / TIME.MIN]);
  const ackP90 = ackSamples.length ? ackSamples.map((x) => x[1]).sort((p, q) => p - q)[Math.min(ackSamples.length - 1, Math.floor(ackSamples.length * 0.9))] : null;
  const confirmed = inc.filter((i) => i.verification === 'Verified').length;
  const tkLive = tk.filter((t) => t.status !== 'Cancelled');
  const ackMins = ackStats.flatMap((r) => r.mins);
  const ackMedian = ackMins.length ? median(ackMins) : null;
  const prior = useMemo(() => {
    const lo = since - days * TIME.DAY;
    const within = (iso) => new Date(iso).getTime() >= lo && new Date(iso).getTime() < since;
    const pi = incidents.filter((i) => within(i.createdAt) && (!hazard || i.hazard === hazard));
    const pa = alerts.filter((a) => within(a.sent) && (!hazard || a.hazard === hazard));
    const pm = pa.filter((a) => a.ackAt).map((a) => (new Date(a.ackAt) - new Date(a.sent)) / TIME.MIN);
    const pt = tasks.filter((t) => within(t.createdAt) && t.status !== 'Cancelled');
    const pc = pi.filter((i) => i.verification === 'Verified').length;
    const pn = pi.filter((i) => i.verification === 'Not Verified').length;
    return {
      incidents: pi.length,
      ack: pm.length ? Math.round(median(pm)) : null,
      completion: pt.length ? Math.round((pt.filter((t) => t.status === 'Completed').length / pt.length) * 100) : null,
      verification: pc + pn ? Math.round((pc / (pc + pn)) * 100) : null,
    };
  }, [incidents, alerts, tasks, hazard, since, days]);
  const notConfirmed = inc.filter((i) => i.verification === 'Not Verified').length;
  const completionPct = tkLive.length ? Math.round((done.length / tkLive.length) * 100) : null;
  const verifiedPct = confirmed + notConfirmed ? Math.round((confirmed / (confirmed + notConfirmed)) * 100) : null;

  const sourceAudit = data.audit.filter((a) => a.entityType === 'Source');

  const ackCols = [
    { id: 'hazard', header: 'Hazard', accessor: (r) => HAZARD_LABEL[r.hazard] },
    { id: 'total', header: 'Alerts', num: true, accessor: (r) => r.total },
    { id: 'acked', header: 'Acknowledged', num: true, accessor: (r) => r.acked, cell: (r) => `${r.acked} (${pct(r.acked, r.total)})` },
    { id: 'median', header: 'Median time to acknowledge', num: true, accessor: (r) => (r.median == null ? null : Math.round(r.median)), cell: (r) => (r.median == null ? '—' : fmtDuration(r.median * TIME.MIN)) },
  ];
  const distCols = [
    { id: 'state', header: 'State', accessor: (r) => stateName(r.state) },
    { id: 'district', header: 'District', accessor: (r) => r.district },
    { id: 'count', header: 'Incidents', num: true, accessor: (r) => r.count },
    { id: 'high', header: 'High / Critical', num: true, accessor: (r) => r.high },
  ];
  const srcCols = [
    { id: 'source', header: 'Source', accessor: (r) => SOURCE_SHORT[r.entityId] || r.entityId },
    { id: 'at', header: 'Attempt time', accessor: (r) => r.at, cell: (r) => fmtDateTime(r.at) },
    { id: 'result', header: 'Result', accessor: (r) => r.next },
    { id: 'outcome', header: 'Outcome', accessor: (r) => r.outcome },
    { id: 'detail', header: 'Detail', accessor: (r) => r.detail, wrap: true },
  ];
  const srcNow = [...data.sources];

  return (
    <>
      <PageHeader title="Historical Analytics"
        description={`Retrospective view for ${scopeLabel(scope)}.`}
        actions={<>
          <Select label="" compact value={range} onChange={setRange} options={RANGES} aria-label="Time range" />
          <Select label="" compact value={hazard} onChange={setHazard} placeholder="All hazards" aria-label="Hazard filter" options={HAZARDS.map((h) => ({ value: h.key, label: h.label }))} />
        </>} />

      <div className="bx-kpi-grid">
        <KpiCard id="an.incidents" label="Incidents in period" value={inc.length} previous={prior.incidents}
          stats={stats([['Alerts issued', al.length], ['vs previous', `${inc.length - prior.incidents >= 0 ? '+' : ''}${inc.length - prior.incidents}`]])}
          series={{ ...dailySeries((st, en) => incidents.filter((i) => (!hazard || i.hazard === hazard) && new Date(i.createdAt).getTime() >= st && new Date(i.createdAt).getTime() <= en).length, now), unit: 'incidents' }}
          breakdown={breakdownOf(inc, (i) => i.severity, { title: 'By severity', xTitle: 'Incidents', yTitle: 'Severity', order: SEVERITIES.slice().reverse() })}
          rows={{ columns: [{ header: 'ID', get: (i) => i.id }, { header: 'Title', get: (i) => i.title }, { header: 'Severity', get: (i) => i.severity }, { header: 'Created', get: (i) => fmtDateTime(i.createdAt) }], items: inc }} />
        <KpiCard id="an.ack" label="Median time to acknowledge" value={ackMedian == null ? 0 : Math.round(ackMedian)} previous={prior.ack}
          stats={stats([['P90', ackP90 == null ? null : fmtDuration(ackP90 * TIME.MIN)], ['Acknowledged', pct(ackStats.reduce((x, r) => x + r.acked, 0), ackStats.reduce((x, r) => x + r.total, 0))]])}
          progress={{ value: ackMedian == null ? 0 : Math.round(ackMedian), target: 15, unit: ' min', label: 'Median vs target' }} target={15} targetLabel="Target 15 min"
          series={{ ...dailySeries((st, en) => { const m = ackSamples.filter(([sent]) => sent >= st && sent <= en).map(([, mins]) => mins); return m.length ? Math.round(median(m)) : 0; }, now), unit: 'minutes' }}
          breakdown={{ title: 'By hazard (median)', xTitle: 'Minutes', yTitle: 'Hazard', labels: ackStats.filter((r) => r.median != null).map((r) => HAZARD_LABEL[r.hazard]), data: ackStats.filter((r) => r.median != null).map((r) => Math.round(r.median)) }}
          rows={{ columns: [{ header: 'Hazard', get: (r) => HAZARD_LABEL[r.hazard] }, { header: 'Alerts', get: (r) => r.total }, { header: 'Acknowledged', get: (r) => r.acked }], items: ackStats }} />
        <KpiCard id="an.completion" label="Task completion" value={completionPct == null ? 0 : completionPct} previous={prior.completion}
          stats={stats([['Median time', durations.length ? fmtDuration(median(durations)) : null], ['Completed', `${done.length} of ${tkLive.length}`]])}
          progress={{ value: completionPct || 0, target: 90, unit: '%', label: 'Completion vs target' }} target={90} targetLabel="Target 90%"
          series={{ ...dailySeries((st, en) => { const d = tasks.filter((t) => t.status !== 'Cancelled' && new Date(t.createdAt).getTime() >= st && new Date(t.createdAt).getTime() <= en); return d.length ? Math.round((d.filter((t) => t.status === 'Completed').length / d.length) * 100) : 0; }, now), unit: '%' }}
          breakdown={breakdownOf(tk, (t) => t.status, { title: 'By status', xTitle: 'Tasks', yTitle: 'Status' })}
          rows={{ columns: [{ header: 'ID', get: (t) => t.id }, { header: 'Category', get: (t) => t.category }, { header: 'Status', get: (t) => t.status }], items: tk }} />
        <KpiCard id="an.verification" label="Verification outcome" value={verifiedPct == null ? 0 : verifiedPct} previous={prior.verification}
          stats={stats([['Verified', confirmed], ['Not verified', notConfirmed]])}
          progress={{ value: verifiedPct || 0, target: 80, unit: '%', label: 'Confirmed vs target' }} target={80} targetLabel="Target 80%"
          series={{ ...dailySeries((st, en) => { const d = incidents.filter((i) => ['Verified', 'Not Verified'].includes(i.verification) && new Date(i.createdAt).getTime() >= st && new Date(i.createdAt).getTime() <= en); return d.length ? Math.round((d.filter((i) => i.verification === 'Verified').length / d.length) * 100) : 0; }, now), unit: '%' }}
          breakdown={breakdownOf(inc.filter((i) => ['Verified', 'Not Verified'].includes(i.verification)), (i) => i.verification, { title: 'By outcome', xTitle: 'Incidents', yTitle: 'Outcome' })}
          rows={{ columns: [{ header: 'ID', get: (i) => i.id }, { header: 'Title', get: (i) => i.title }, { header: 'Verification', get: (i) => i.verification }], items: inc.filter((i) => ['Verified', 'Not Verified'].includes(i.verification)) }} />
      </div>

      <div className="bx-grid bx-grid-main">
        <Card title="Incidents and alerts over time">
          <TrendChart labels={trend.labels} datasets={trend.datasets} yTitle="Records" unit="records" xTitle="Date" ariaLabel="Incidents and alerts over time" />
        </Card>
        <Card title="Hazard distribution">
          <BarsChart horizontal labels={HAZARDS.map((h) => h.label)} datasets={[{ label: 'Incidents', data: hazardCounts, color: '#2dd4bf' }]} legend={false} xTitle="Incidents" yTitle="Hazard" unit="incidents" ariaLabel="Incidents by hazard" />
        </Card>
      </div>

      <div className="bx-grid bx-grid-3">
        <Card title="Severity distribution">
          <BarsChart labels={SEVERITIES} datasets={[{ label: 'Incidents', data: sevCounts, colors: SEVERITIES.map((s) => SEVERITY_COLORS[s]) }]} legend={false} xTitle="Severity" yTitle="Incidents" unit="incidents" ariaLabel="Incidents by severity" />
        </Card>
        <Card title="Incidents by state">
          <BarsChart horizontal labels={byState.map(([c]) => c)} datasets={[{ label: 'Incidents', data: byState.map(([, n]) => n), color: '#22d3ee' }]} legend={false} xTitle="Incidents" yTitle="State" unit="incidents" ariaLabel="Incidents by state" />
        </Card>
        <Card title="Response task outcomes">
          <BarsChart labels={['Completed', 'Open', 'Cancelled']}
            datasets={[{ label: 'Tasks', data: [done.length, tk.filter((t) => ['Unassigned', 'Assigned', 'In Progress', 'Awaiting Verification'].includes(t.status)).length, tk.filter((t) => t.status === 'Cancelled').length], colors: ['#22c55e', '#3b82f6', '#64748b'] }]}
            legend={false} xTitle="Outcome" yTitle="Tasks" unit="tasks" ariaLabel="Task outcomes" />
        </Card>
      </div>

      <div className="bx-grid bx-grid-2">
        <Card title="Alert acknowledgement performance" flush>
          <DataTable columns={ackCols} rows={ackStats} rowKey="hazard" searchable={false} pageSize={8} caption="Acknowledgement performance" emptyTitle="No alerts in period" />
        </Card>
        <Card title="Incidents by district" flush>
          <DataTable columns={distCols} rows={byDistrict} rowKey="key" pageSize={8} caption="Incidents by district" defaultSort={{ id: 'count', dir: 'desc' }} />
        </Card>
      </div>

      <div style={{ marginTop: 12 }}>
        <Card title="Source availability and data freshness" subtitle="Limited to recorded ingestion attempts.">
          <div className="bx-row" style={{ marginBottom: 10 }}>
            {srcNow.map((s) => (
              <span key={s.id} className="bx-row" style={{ gap: 4 }}>
                <strong>{s.short}</strong> <SourceStatusBadge value={s.status} />
                <span className="bx-faint">{s.lastSuccess ? `last ok ${fmtRelative(s.lastSuccess, now)}` : 'never'}</span>
              </span>
            ))}
          </div>
          <DataTable columns={srcCols} rows={sourceAudit} pageSize={6} caption="Ingestion attempts" searchable={false} emptyTitle="No ingestion attempts recorded" />
        </Card>
      </div>
    </>
  );
}
