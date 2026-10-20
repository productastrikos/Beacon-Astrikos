import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useScoped } from '../../state/hooks';
import { computeKpis, isActiveIncident, isOpenTask, isOverdueTask, isActiveAlert, scopeLabel, assigneeName } from '../../state/selectors';
import { PageHeader, Card, KpiCard, EmptyState } from '../../components/ui/Layout';
import { Select, Button } from '../../components/ui/Controls';
import { TrendChart, BarsChart, SEVERITY_COLORS } from '../../components/charts/Charts';
import IncidentRegister from '../../components/domain/IncidentRegister';
import AlertTable from '../../components/domain/AlertTable';
import AttentionBanner from '../../components/domain/AttentionBanner';
import ResponseActivity from '../../components/domain/ResponseActivity';
import { bucketSeries } from '../../utils/trend';
import { HAZARDS, SEVERITIES } from '../../types';
import { fmtDateTime, fmtDuration, toCsv, downloadText } from '../../utils/format';
import { baselineFor } from '../../state/baseline';
import { SOURCE_SHORT } from '../../data/demo/sources';
import { countBy, topEntry, stats, breakdownOf } from '../../utils/kpiHelpers';
import { stateName, hazardLabel } from '../../components/domain/common';
import { UI_ICON } from '../../config/icons';

const RANGES = [{ value: '24h', label: 'Last 24 hours' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }];
const SEV_DESC = ['Critical', 'High', 'Moderate', 'Low'];

export default function CommandCentre() {
  const navigate = useNavigate();
  const { data, scope, now, incidents, alerts, tasks } = useScoped();
  const [range, setRange] = useState('7d');
  const [hazard, setHazard] = useState('');
  const [sev, setSev] = useState('');

  const kpi = useMemo(() => computeKpis(data, scope, now), [data, scope, now]);
  const prev = useMemo(() => computeKpis(baselineFor(data.baseAt), scope, now), [data.baseAt, scope, now]);
  const trend = useMemo(() => bucketSeries(range, [
    { label: 'Incidents created', items: incidents.filter((i) => !hazard || i.hazard === hazard), at: (i) => i.createdAt, color: '#ef4444' },
    { label: 'Alerts issued', items: alerts.filter((a) => !hazard || a.hazard === hazard), at: (a) => a.sent, color: '#3b82f6', dashed: true },
  ], now), [range, hazard, incidents, alerts, now]);

  const activeIncidents = useMemo(() => incidents.filter(isActiveIncident), [incidents]);
  const sevCounts = SEVERITIES.map((s) => activeIncidents.filter((i) => i.severity === s).length);
  const sevOf = (s) => activeIncidents.filter((i) => i.severity === s).length;
  const activeAlerts = useMemo(() => alerts.filter((a) => isActiveAlert(a, now) && a.classification !== 'Historical'), [alerts, now]);
  const openTasks = tasks.filter((t) => !t.historical && isOpenTask(t));
  const districtRows = useMemo(() => {
    const m = {};
    activeIncidents.forEach((i) => {
      const k = `${i.stateCode}|${i.district}`;
      const row = (m[k] ||= { state: i.stateCode, district: i.district, count: 0, worst: 0, first: Infinity });
      row.count += 1;
      row.worst = Math.max(row.worst, SEV_DESC.length - SEV_DESC.indexOf(i.severity));
      row.first = Math.min(row.first, new Date(i.createdAt).getTime());
    });
    return Object.values(m).sort((x, y) => y.count - x.count);
  }, [activeIncidents]);

  // Incidents
  const topDistrictRow = districtRows[0];
  const searchDistrict = (name) => () => navigate(`/incidents?q=${encodeURIComponent(name)}`);
  // Warnings
  const officialWarnings = useMemo(() => activeAlerts.filter((a) => a.classification === 'Official'), [activeAlerts]);
  const agencies = Object.entries(countBy(officialWarnings, (a) => SOURCE_SHORT[a.sender] || a.sender)).sort((x, y) => y[1] - x[1]);
  const agencyStats = [...agencies.slice(0, 3).map(([label, value]) => ({ label, value })), ...(agencies.length > 3 ? [{ label: `+${agencies.length - 3}`, value: '' }] : [])];
  const topHazardW = topEntry(countBy(officialWarnings, (a) => a.hazard));
  // High severity
  const highSev = activeIncidents.filter((i) => ['High', 'Critical'].includes(i.severity));
  const topHighDistrict = topEntry(countBy(highSev, (i) => i.district));
  // Districts
  const distCrit = districtRows.filter((d) => d.worst === 4).length;
  const distHigh = districtRows.filter((d) => d.worst === 3).length;
  // Tasks
  const isOver = (t) => isOverdueTask(t, now);
  const taskOverdue = openTasks.filter(isOver).length;
  const taskUnassigned = openTasks.filter((t) => !isOver(t) && t.status === 'Unassigned').length;
  const taskAwaiting = openTasks.filter((t) => !isOver(t) && t.status === 'Awaiting Verification').length;
  const taskProgress = openTasks.length - taskOverdue - taskUnassigned - taskAwaiting;
  const topTeam = topEntry(countBy(openTasks.filter((t) => t.assignee), (t) => t.assignee));
  // Sources
  const attention = data.sources.filter((x) => ['Delayed', 'Offline'].includes(x.status));
  const worstSource = attention.slice().sort((a, b) => (a.status === 'Offline' ? -1 : 1) - (b.status === 'Offline' ? -1 : 1) || new Date(a.lastSuccess) - new Date(b.lastSuccess))[0];

  const exportReport = () => {
    const cols = [
      { header: 'Incident ID', value: (r) => r.id }, { header: 'Title', value: (r) => r.title }, { header: 'Hazard', value: (r) => r.hazard },
      { header: 'State', value: (r) => r.stateCode }, { header: 'District', value: (r) => r.district }, { header: 'Severity', value: (r) => r.severity },
      { header: 'Verification', value: (r) => r.verification }, { header: 'Status', value: (r) => r.status }, { header: 'Last updated', value: (r) => r.updatedAt },
    ];
    downloadText('command-centre-report.csv', toCsv(incidents.filter((i) => !i.historical), cols));
  };

  return (
    <div className="bx-page">
      <PageHeader title="Command Centre"
        description={`Operational picture for ${scopeLabel(scope)}. Counts update live as operators act and new data arrives.`}
        actions={<Button icon={Download} onClick={exportReport}>Export Report</Button>} />

      <AttentionBanner incidents={incidents} alerts={alerts} now={now} />

      <div className="bx-kpi-grid">
        <KpiCard id="cc.activeIncidents" label="Active incidents" value={kpi.activeIncidents} previous={prev.activeIncidents}
          stats={SEV_DESC.map((s) => ({ label: s, value: sevOf(s) }))}
          hotspot={topDistrictRow && { label: 'Top', name: topDistrictRow.district, count: topDistrictRow.count, onClick: searchDistrict(topDistrictRow.district), title: 'Filter the incident register' }}
          breakdown={breakdownOf(activeIncidents, (i) => i.severity, { title: 'By severity', xTitle: 'Incidents', yTitle: 'Severity', order: SEV_DESC })}
          rows={{ columns: [{ header: 'ID', get: (i) => i.id }, { header: 'Title', get: (i) => i.title }, { header: 'Severity', get: (i) => i.severity }, { header: 'Status', get: (i) => i.status }], items: activeIncidents }} />
        <KpiCard id="cc.warnings" label="Active official warnings" value={kpi.activeWarnings} previous={prev.activeWarnings}
          stats={agencyStats}
          hotspot={topHazardW && { label: 'Mostly', name: hazardLabel(topHazardW[0]), count: topHazardW[1], onClick: () => navigate('/alerts') }}
          breakdown={breakdownOf(officialWarnings, (a) => SOURCE_SHORT[a.sender] || a.sender, { title: 'By agency', xTitle: 'Warnings', yTitle: 'Agency' })}
          rows={{ columns: [{ header: 'ID', get: (a) => a.id }, { header: 'Headline', get: (a) => a.headline }, { header: 'Severity', get: (a) => a.severity }, { header: 'Expires', get: (a) => fmtDateTime(a.expires) }], items: officialWarnings }} />
        <KpiCard id="cc.highSeverity" label="High-severity incidents" value={kpi.highSeverity} previous={prev.highSeverity}
          stats={[{ label: 'Critical', value: sevOf('Critical') }, { label: 'High', value: sevOf('High') }]}
          hotspot={topHighDistrict && { label: 'Top', name: topHighDistrict[0], count: topHighDistrict[1], onClick: searchDistrict(topHighDistrict[0]), title: 'Filter the incident register' }}
          breakdown={breakdownOf(highSev, (i) => stateName(i.stateCode), { title: 'By state', xTitle: 'Incidents', yTitle: 'State' })}
          rows={{ columns: [{ header: 'ID', get: (i) => i.id }, { header: 'Title', get: (i) => i.title }, { header: 'Severity', get: (i) => i.severity }, { header: 'District', get: (i) => i.district }], items: highSev }} />
        <KpiCard id="cc.districts" label="Districts affected" value={kpi.districtsAffected} previous={prev.districtsAffected}
          stats={[{ label: 'with Critical', value: distCrit }, { label: 'with High', value: distHigh }, { label: 'others', value: districtRows.length - distCrit - distHigh }]}
          hotspot={topDistrictRow && { label: 'Top', name: topDistrictRow.district, count: topDistrictRow.count, onClick: searchDistrict(topDistrictRow.district), title: 'Filter the incident register' }}
          breakdown={{ title: 'Top districts', xTitle: 'Active incidents', yTitle: 'District', labels: districtRows.slice(0, 8).map((d) => d.district), data: districtRows.slice(0, 8).map((d) => d.count) }}
          rows={{ columns: [{ header: 'State', get: (d) => d.state }, { header: 'District', get: (d) => d.district }, { header: 'Active incidents', get: (d) => d.count }], items: districtRows }} />
        <KpiCard id="cc.openTasks" label="Open response tasks" value={kpi.openTasks} previous={prev.openTasks}
          stats={[{ label: 'Overdue', value: taskOverdue }, { label: 'Unassigned', value: taskUnassigned }, { label: 'In progress', value: taskProgress }, { label: 'Awaiting verification', value: taskAwaiting }]}
          hotspot={topTeam && { label: 'Top', name: assigneeName(topTeam[0]), count: topTeam[1], onClick: () => navigate(`/field-operations?assignee=${topTeam[0]}`), title: 'Filter field operations' }}
          breakdown={breakdownOf(openTasks, (t) => t.priority, { title: 'By priority', xTitle: 'Tasks', yTitle: 'Priority', order: ['Urgent', 'High', 'Medium', 'Low'] })}
          rows={{ columns: [{ header: 'ID', get: (t) => t.id }, { header: 'Category', get: (t) => t.category }, { header: 'Location', get: (t) => t.location }, { header: 'Status', get: (t) => t.status }], items: openTasks }} />
        <KpiCard id="cc.sources" label="Data sources needing attention" value={kpi.sourcesAttention} previous={prev.sourcesAttention}
          stats={stats([['Offline', data.sources.filter((x) => x.status === 'Offline').length], ['Delayed', data.sources.filter((x) => x.status === 'Delayed').length]])}
          hotspot={worstSource
            ? { label: 'Worst', name: worstSource.short, suffix: fmtDuration(now - new Date(worstSource.lastSuccess).getTime()), onClick: () => navigate('/integrations') }
            : { ok: 'All sources healthy' }}
          breakdown={breakdownOf(data.sources, (x) => x.status, { title: 'By status', xTitle: 'Sources', yTitle: 'Status', order: ['Connected', 'Delayed', 'Offline'] })}
          rows={{ columns: [{ header: 'Source', get: (x) => x.short }, { header: 'Status', get: (x) => x.status }, { header: 'Detail', get: (x) => x.error }], items: attention }} />
      </div>

      <ResponseActivity incidents={incidents} tasks={tasks} now={now} />

      <div className="bx-grid bx-grid-main">
        <Card title="Incident and warning trend" subtitle="Counts by creation / issue time"
          actions={<>
            <Select label="" compact value={range} onChange={setRange} options={RANGES} aria-label="Time range" />
            <Select label="" compact value={hazard} onChange={setHazard} placeholder="All hazards" aria-label="Hazard filter"
              options={HAZARDS.map((h) => ({ value: h.key, label: h.label }))} />
          </>}>
          <TrendChart labels={trend.labels} datasets={trend.datasets} legendIcons={[UI_ICON.incidentsCreated, UI_ICON.alertsIssued]} yTitle="Records" unit="records" xTitle={range === '24h' ? 'Time (hour)' : 'Date'}
            ariaLabel={`Incidents and alerts over the ${RANGES.find((r) => r.value === range).label.toLowerCase()}`} />
        </Card>
        <Card title="Active incidents by severity" subtitle="Click a bar to filter the register">
          <BarsChart labels={SEVERITIES} datasets={[{ label: 'Active incidents', data: sevCounts, colors: SEVERITIES.map((s) => SEVERITY_COLORS[s]) }]}
            xTitle="Severity" yTitle="Incidents" unit="incidents" legend={false} labelSquares={SEVERITIES.map((x) => SEVERITY_COLORS[x])} ariaLabel="Active incidents by severity"
            onBarClick={(label) => setSev((cur) => (cur === label ? '' : label))} />
          {sev && <div className="bx-faint" style={{ marginTop: 6 }}>Register filtered to {sev}. Click the bar again to clear.</div>}
        </Card>
      </div>

      <Card title={`Priority Incidents (${activeIncidents.length})`} subtitle="Click a record to view details and open the full incident profile" flush>
        <IncidentRegister incidents={incidents} pageSize={10} severityFilter={sev} onSeverityFilterChange={setSev} exportName="incident-register" />
      </Card>

      <Card title="Latest alerts and warnings" subtitle="Agency warnings currently in force" flush>
        {activeAlerts.length === 0 ? <EmptyState title="No active alerts in this scope" /> : (
          <AlertTable alerts={activeAlerts} now={now} pageSize={5} compact />
        )}
      </Card>
    </div>
  );
}
