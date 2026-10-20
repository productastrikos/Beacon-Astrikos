import React, { useMemo, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { FilePlus2, ListPlus, ShieldCheck } from 'lucide-react';
import { useScoped, useAuth } from '../../state/hooks';
import { hazardSummary, scopeLabel } from '../../state/selectors';
import { HAZARD_CONFIG, hazardKpis } from './hazardConfig';
import { HAZARD_LABEL, SEVERITIES, SEVERITY_RANK, VERIFICATION_STATUSES } from '../../types';
import { PageHeader, Card, KpiCard, Banner, KeyValue, Timeline, EmptyState } from '../../components/ui/Layout';
import { SeverityBadge, VerificationBadge, FreshnessBadge, CapSeverityBadge, StatusBadge } from '../../components/ui/Badges';
import DataSourcePill from '../../components/ui/DataSourcePill';
import { Button, Select, TextInput } from '../../components/ui/Controls';
import { Drawer } from '../../components/ui/Overlay';
import { SEVERITY_TONE } from '../../components/ui/badgeTones';
import DataTable from '../../components/tables/DataTable';
import { BarsChart, TrendChart, SEVERITY_COLORS } from '../../components/charts/Charts';
import { SOURCE_NAME, SOURCE_SHORT } from '../../data/demo/sources';
import { fmtDateTime, fmtRelative, fmtTime, freshness, TIME } from '../../utils/format';
import { baselineFor } from '../../state/baseline';
import { HAZARD_ICON } from '../../config/icons';
import { stateName, IncidentLink } from '../../components/domain/common';
import IncidentForm from '../../components/domain/IncidentForm';
import { verifyRecord, addRecordNote, createTask } from '../../state/actions';
import { Modal } from '../../components/ui/Overlay';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../../types';
import AlertDrawer from '../../components/domain/AlertDrawer';

const TASK_CATEGORY_BY_HAZARD = {
  flood: 'Monitoring review', landslide: 'Road assessment', earthquake: 'Infrastructure inspection', avalanche: 'Field verification',
  wildfire: 'Fire verification', heatwave: 'Heat-action', coldwave: 'Community liaison',
};

function RecordDrawer({ record, onClose, hazard, data, scope, now }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [verification, setVerification] = useState(record.verification === 'Automated' ? 'Pending' : record.verification);
  const [vnote, setVnote] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(null);
  const [task, setTask] = useState({ category: TASK_CATEGORY_BY_HAZARD[hazard], priority: 'Medium', instructions: '' });

  const relatedAlerts = data.alerts.filter((a) => a.hazard === hazard && a.districts.includes(record.district) && a.classification !== 'Historical');
  const relatedIncidents = data.incidents.filter((i) => i.hazard === hazard && i.district === record.district && i.stateCode === record.stateCode && i.status !== 'Closed');
  const fresh = freshness(record.sourceTimestamp, now);
  const sourceStatus = data.sources.find((s) => s.id === record.sourceId);

  return (
    <>
      <Drawer open onClose={onClose} title={record.location} subtitle={record.id}>
        <div className="bx-row">
          <SeverityBadge value={record.severity === 'None' ? null : record.severity} />
          <VerificationBadge value={record.verification} />
          <FreshnessBadge level={fresh.level} label={fresh.label} />
          
        </div>
        {err && <Banner kind="danger">{err}</Banner>}
        <section>
          <div className="bx-section-title">Record details</div>
          <KeyValue items={[
            ['Hazard', HAZARD_LABEL[record.hazard]],
            ['Type', record.kind],
            ['Location', `${record.location} — ${record.district}, ${stateName(record.stateCode)}`],
            ['Value', `${record.value}${record.unit ? ` ${record.unit}` : ''}`],
            ['Source classification', record.classification],
            ...(record.extra?.warning != null ? [['Warning threshold', `${record.extra.warning}`]] : []),
            ...(record.extra?.danger != null ? [['Danger threshold', `${record.extra.danger}`]] : []),
            ...(record.extra?.depthKm != null ? [['Depth', `${record.extra.depthKm} km`]] : []),
            ...(record.extra?.frp != null ? [['Fire radiative power', `${record.extra.frp} MW`]] : []),
          ]} />
        </section>
        <section>
          <div className="bx-section-title">Source and provenance</div>
          <KeyValue items={[
            ['Source', SOURCE_NAME[record.sourceId] || record.sourceId],
            ['Source timestamp', `${fmtDateTime(record.sourceTimestamp)} (${fmtRelative(record.sourceTimestamp, now)})`],
            ['Integration status', sourceStatus ? <DataSourcePill status={sourceStatus.status} lastSync={sourceStatus.lastSuccess} now={now} /> : '—'],
            ['Origin', 'Station telemetry'],
          ]} />
        </section>
        {record.series?.length > 1 && (
          <section>
            <div className="bx-section-title">Recent history ({record.series.length} readings)</div>
            <TrendChart
              labels={record.series.map((_, i) => fmtTime(new Date(new Date(record.sourceTimestamp).getTime() - (record.series.length - 1 - i) * TIME.HOUR).toISOString()).slice(0, 5))}
              datasets={[
                { label: 'Reading', data: record.series, color: '#2dd4bf', fill: true },
                ...(record.extra?.warning != null ? [{ label: 'Warning level', data: record.series.map(() => record.extra.warning), color: '#fbbf24', line: true }] : []),
                ...(record.extra?.danger != null ? [{ label: 'Danger level', data: record.series.map(() => record.extra.danger), color: '#f87171', line: true }] : []),
              ]}
              xTitle="Time" yTitle={record.unit === 'm' ? 'Level (m)' : `Value (${record.unit || 'units'})`} unit={record.unit} integer={false} beginAtZero={false} height={220}
              ariaLabel={`${record.location} recent readings`} />
          </section>
        )}
        <section>
          <div className="bx-section-title">Related alerts ({relatedAlerts.length})</div>
          {relatedAlerts.length ? relatedAlerts.map((a) => (
            <div key={a.id} className="bx-row" style={{ marginBottom: 4 }}>
              <CapSeverityBadge value={a.severity} />
              <button type="button" className="bx-link-btn" onClick={() => setAlertOpen(a.id)}>{a.headline}</button>
            </div>
          )) : <div className="bx-faint">No active alert for this district.</div>}
        </section>
        <section>
          <div className="bx-section-title">Related incidents ({relatedIncidents.length})</div>
          {relatedIncidents.length ? relatedIncidents.map((i) => (
            <div key={i.id} className="bx-row" style={{ marginBottom: 4 }}><SeverityBadge value={i.severity} /><IncidentLink id={i.id} /> <span className="bx-muted">{i.title}</span></div>
          )) : <div className="bx-faint">No related incident.</div>}
        </section>
        <section>
          <div className="bx-section-title">Verification</div>
          <div className="bx-row" style={{ alignItems: 'flex-end' }}>
            <Select label="Set verification" value={verification} onChange={setVerification} options={VERIFICATION_STATUSES} />
            <TextInput label="Note" value={vnote} onChange={(e) => setVnote(e.target.value)} />
            <Button icon={ShieldCheck} disabled={!can('hazard.verify')} title={!can('hazard.verify') ? 'Your role cannot verify records' : undefined}
              onClick={() => { const r = verifyRecord(record.id, verification, vnote); setErr(r.ok ? '' : r.error); if (r.ok) setVnote(''); }}>Apply</Button>
          </div>
        </section>
        <section>
          <div className="bx-section-title">Notes</div>
          {(record.notes || []).length ? <Timeline items={record.notes.map((n) => ({ id: n.id, text: n.text, meta: `${fmtDateTime(n.at)} · ${n.by}` }))} /> : <div className="bx-faint">No notes.</div>}
          <div className="bx-row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
            <TextInput label="Add note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={!note.trim() || !can('note.add')} onClick={() => { const r = addRecordNote(record.id, note); setErr(r.ok ? '' : r.error); if (r.ok) setNote(''); }}>Add</Button>
          </div>
        </section>
        <section className="bx-row">
          <Button icon={FilePlus2} disabled={!can('incident.create')} onClick={() => setCreating(true)}>Create incident</Button>
          <Button icon={ListPlus} disabled={!can('task.create')} onClick={() => setTaskOpen(true)}>Create task</Button>
        </section>
      </Drawer>
      <IncidentForm open={creating} onClose={() => setCreating(false)} fromRecordId={record.id}
        initial={{ title: `${HAZARD_LABEL[hazard]}: ${record.location}`, hazard, stateCode: record.stateCode, district: record.district, location: record.location,
          severity: record.severity === 'None' ? 'Low' : record.severity, description: `Raised from monitoring record ${record.id} (${record.classification}).` }}
        onCreated={(id) => navigate(`/incidents/${id}`)} />
      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Create response task"
        footer={<><Button variant="primary" onClick={() => {
          const r = createTask({ ...task, location: record.location, stateCode: record.stateCode, dueHours: 6 });
          if (r.ok) setTaskOpen(false); else setErr(r.error);
        }}>Create task</Button><Button onClick={() => setTaskOpen(false)}>Cancel</Button></>}>
        <Select label="Category" value={task.category} onChange={(v) => setTask((t) => ({ ...t, category: v }))} options={TASK_CATEGORIES} />
        <Select label="Priority" value={task.priority} onChange={(v) => setTask((t) => ({ ...t, priority: v }))} options={TASK_PRIORITIES} />
        <TextInput label="Instructions" value={task.instructions} onChange={(e) => setTask((t) => ({ ...t, instructions: e.target.value }))} />
        <p className="bx-help">Location: {record.location}. The task is created unlinked; assign it from Field Operations.</p>
      </Modal>
      {alertOpen && <AlertDrawer alertId={alertOpen} onClose={() => setAlertOpen(null)} />}
    </>
  );
}

export default function HazardModule() {
  const { hazard } = useParams();
  const navigate = useNavigate();
  const cfg = HAZARD_CONFIG[hazard];
  const { data, scope, now } = useScoped();
  const [selected, setSelected] = useState(null);
  const [verif, setVerif] = useState('');
  const [severity, setSeverity] = useState('');

  const summary = useMemo(() => (cfg ? hazardSummary(data, hazard, scope, now) : null), [cfg, data, hazard, scope, now]);
  if (!cfg) return <Navigate to="/command-centre" replace />;

  const enabled = data.settings.hazardsEnabled[hazard] !== false;
  const sources = data.sources.filter((s) => s.hazards.includes(hazard));
  const flags = data.flags.filter((f) => f.hazard === hazard && (scope === 'IN' || f.stateCode === scope));
  const kpis = hazardKpis(hazard, { records: summary.records, alerts: summary.alerts, incidents: summary.incidents, now });
  const bSummary = hazardSummary(baselineFor(data.baseAt), hazard, scope, now);
  const bKpis = hazardKpis(hazard, { records: bSummary.records, alerts: bSummary.alerts, incidents: bSummary.incidents, now });
  const rows = summary.records.filter((r) => (!verif || r.verification === verif) && (!severity || r.severity === severity));
  const selectedRec = selected ? data.records.find((r) => r.id === selected) : null;

  const columns = [
    { id: 'id', header: 'Record ID', accessor: (r) => r.id, cell: (r) => <span className="bx-mono">{r.id}</span> },
    { id: 'loc', header: 'Location', accessor: (r) => `${r.location} · ${r.district}`, wrap: true },
    { id: 'value', header: cfg.valueHeader, accessor: (r) => r.value, num: typeof summary.records[0]?.value === 'number', cell: (r) => <strong>{String(r.value)}</strong> },
    { id: 'unit', header: 'Unit', accessor: (r) => r.unit || '—' },
    { id: 'source', header: 'Source', accessor: (r) => SOURCE_SHORT[r.sourceId] || r.sourceId },
    { id: 'ts', header: 'Source timestamp', accessor: (r) => r.sourceTimestamp, cell: (r) => fmtDateTime(r.sourceTimestamp) },
    { id: 'fresh', header: 'Freshness', accessor: (r) => freshness(r.sourceTimestamp, now).label, cell: (r) => { const f = freshness(r.sourceTimestamp, now); return <FreshnessBadge level={f.level} label={f.label} />; } },
    { id: 'verify', header: 'Verification', accessor: (r) => r.verification, cell: (r) => <VerificationBadge value={r.verification} /> },
    { id: 'class', header: 'Classification', accessor: (r) => r.classification, wrap: true },
    { id: 'sev', header: 'Severity', accessor: (r) => r.severity, sortValue: (r) => SEVERITY_RANK[r.severity], cell: (r) => <SeverityBadge value={r.severity === 'None' ? null : r.severity} /> },
    { id: 'act', header: 'Actions', sortable: false, cell: (r) => <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r.id); }}>Details</Button> },
  ];

  return (
    <div className="bx-page">
      <PageHeader title={`${HAZARD_LABEL[hazard]} Monitoring`} description={`${cfg.blurb} Scope: ${scopeLabel(scope)}.`} />
      {!enabled && <Banner kind="warning" title="Module marked as disabled by an administrator.">Shown for review only. Disabled hazards are greyed out in the sidebar.</Banner>}

      <div className="bx-kpi-grid">
        {kpis.map((k, i) => <KpiCard key={k.id} {...k} previous={bKpis[i].value} iconName={HAZARD_ICON[hazard]} />)}
      </div>

      <div className="bx-grid bx-grid-main">
        <Card title="Hazard summary" subtitle={`Scope: ${scopeLabel(scope)}`}>
          <div className="bx-grid bx-grid-2">
            <KeyValue items={[
              ['Latest update', summary.latest ? `${fmtDateTime(summary.latest)} (${fmtRelative(summary.latest, now)})` : 'No records'],
              ['Active events', `${summary.incidents.length} incident(s) · ${summary.alerts.length} warning(s)`],
              ['Open monitoring flags', flags.filter((f) => f.state === 'Open').length],
              ['Records in scope', summary.records.length],
            ]} />
            <div>
              <div className="bx-section-title">Data source status</div>
              {sources.length === 0 ? <div className="bx-faint">None mapped.</div> : sources.map((s) => (
                <div key={s.id} className="bx-row" style={{ marginBottom: 6, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <span>{s.short}</span><DataSourcePill status={s.status} lastSync={s.lastSuccess} now={now} />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Active incidents by severity" subtitle="Current scope">
          <BarsChart labels={SEVERITIES} datasets={[{ label: 'Incidents', data: SEVERITIES.map((s) => summary.severity[s]), colors: SEVERITIES.map((s) => SEVERITY_COLORS[s]) }]}
            legend={false} xTitle="Severity" yTitle="Incidents" unit="incidents" height={190} ariaLabel={`${HAZARD_LABEL[hazard]} incidents by severity`} />
        </Card>
      </div>

      {flags.length > 0 && (
        <Card title={`Monitoring flags (${flags.length})`} subtitle="Rule-based review prompts raised from current observations">
          <div className="bx-action-list">
            {flags.map((f) => (
              <div key={f.id} className="bx-action-item">
                <StatusBadge tone={SEVERITY_TONE[f.severity || 'Moderate']} label={f.severity || 'Moderate'} />
                <span className="bx-mono">{f.ruleId}</span>
                <div className="bx-action-main"><div className="bx-action-detail" style={{ marginTop: 0 }} title={f.text}>{f.district}: {f.text}</div></div>
                <button type="button" className="bx-action-btn" onClick={() => navigate('/incidents')}>Review</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Monitoring records" subtitle="Click a row for the detail drawer" flush>
        <DataTable columns={columns} rows={rows} pageSize={10} caption={`${HAZARD_LABEL[hazard]} monitoring records`}
          onRowClick={(r) => setSelected(r.id)} selectedKey={selected} exportName={`${hazard}-records`}
          defaultSort={{ id: 'sev', dir: 'desc' }} searchPlaceholder="ID, location, district…"
          filters={<>
            <Select label="Verification" compact value={verif} onChange={setVerif} placeholder="All" options={['Automated', ...VERIFICATION_STATUSES]} />
            <Select label="Severity" compact value={severity} onChange={setSeverity} placeholder="All" options={['None', ...SEVERITIES]} />
          </>}
          emptyTitle="No records in this scope" emptyHint="Switch scope to PAN INDIA or clear the filters." />
      </Card>
      {summary.records.length === 0 && <EmptyState title="No records for this hazard in the selected scope" hint="Switch the scope to PAN INDIA to see all monitoring records." />}

      {selectedRec && <RecordDrawer record={selectedRec} hazard={hazard} data={data} scope={scope} now={now} onClose={() => setSelected(null)} />}
    </div>
  );
}
