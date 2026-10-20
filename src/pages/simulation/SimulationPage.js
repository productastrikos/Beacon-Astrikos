import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, SkipForward, RotateCcw, Repeat, CircleCheck, Circle, CircleDot } from 'lucide-react';
import { SCENARIOS } from '../../data/demo/scenarios';
import { useData } from '../../state/dataStore';
import { useAuth } from '../../state/hooks';
import { startScenario, pauseScenario, resumeScenario, stepScenario, resetScenario, replayScenario } from '../../state/simulation';
import { PageHeader, Card, Banner, Timeline, KeyValue } from '../../components/ui/Layout';
import { Button } from '../../components/ui/Controls';
import { Badge, SeverityBadge, IncidentStatusBadge, TaskStatusBadge } from '../../components/ui/Badges';
import { HAZARD_LABEL } from '../../types';
import { fmtDateTime, fmtTime } from '../../utils/format';
import { toastStore } from '../../state/uiStore';

const EMPTY_RUN = { status: 'idle', stepIndex: 0, log: [], created: { incidents: [], alerts: [], tasks: [], records: [], flags: [] }, modified: {} };
const STATUS_COLOR = { idle: 'grey', running: 'cyan', paused: 'amber', completed: 'green' };

function opSummary(ops) {
  const c = {};
  ops.forEach((o) => { c[o.op] = (c[o.op] || 0) + 1; });
  const label = { record: 'record', flag: 'flag', alert: 'alert', incident: 'incident', incidentPatch: 'incident update', task: 'task', assign: 'assignment', taskPatch: 'task update', link: 'link', resourcePatch: 'resource update' };
  return Object.entries(c).map(([k, n]) => `${n} ${label[k] || k}${n > 1 ? 's' : ''}`).join(' · ');
}

export default function SimulationPage() {
  const runs = useData((s) => s.simRuns);
  const data = useData();
  const { can } = useAuth();
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === selectedId);
  const run = runs[selectedId] || EMPTY_RUN;
  const allowed = can('sim.run');
  const act = (fn) => { const r = fn(selectedId); if (!r.ok) toastStore.push({ kind: 'error', text: r.error }); };

  const created = useMemo(() => ({
    incidents: data.incidents.filter((i) => run.created.incidents.includes(i.id)),
    alerts: data.alerts.filter((a) => run.created.alerts.includes(a.id)),
    tasks: data.tasks.filter((t) => run.created.tasks.includes(t.id)),
    records: data.records.filter((r) => run.created.records.includes(r.id)),
    flags: data.flags.filter((f) => run.created.flags.includes(f.id)),
  }), [data, run]);
  const audit = useMemo(() => data.audit.filter((a) => a.simRunId === selectedId).slice(0, 40), [data.audit, selectedId]);
  const modified = Object.entries(run.modified || {}).flatMap(([k, m]) => Object.keys(m).map((id) => `${k.replace(/s$/, '')} ${id}`));
  const finished = run.status === 'completed';

  return (
    <>
      <PageHeader title="Simulation & Replay"
        description="Execute predefined scenarios against the shared data store. Each step creates or updates real records in this app, so KPIs, registers, tasks and the audit trail stay in sync." />
      {!allowed && <div style={{ marginBottom: 12 }}><Banner kind="info">Your role can view scenarios but cannot run them.</Banner></div>}

      <div className="bx-grid bx-grid-main">
        <div className="bx-stack">
          {SCENARIOS.map((s) => {
            const r = runs[s.id] || { status: 'idle', stepIndex: 0 };
            const selected = s.id === selectedId;
            return (
              <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} aria-pressed={selected}
                className="bx-card" style={{ textAlign: 'left', cursor: 'pointer', borderColor: selected ? 'var(--app-accent)' : undefined, padding: 0 }}>
                <div className="bx-card-head">
                  <div>
                    <div className="bx-card-title">{s.id} · {s.name}</div>
                    <div className="bx-card-sub">{HAZARD_LABEL[s.hazard]} · {s.steps.length} steps</div>
                  </div>
                  <Badge color={STATUS_COLOR[r.status]}>{r.status === 'idle' ? 'Not started' : r.status[0].toUpperCase() + r.status.slice(1)} {r.status !== 'idle' && `· ${r.stepIndex}/${s.steps.length}`}</Badge>
                </div>
                <div className="bx-card-body" style={{ fontSize: 12 }}>{s.summary}</div>
              </button>
            );
          })}
        </div>

        <div className="bx-stack">
          <Card title={`${scenario.id} · ${scenario.name}`}
            subtitle={`Status: ${run.status === 'idle' ? 'Not started' : run.status} · step ${run.stepIndex} of ${scenario.steps.length}`}>
            <div className="bx-progress" role="progressbar" aria-valuemin={0} aria-valuemax={scenario.steps.length} aria-valuenow={run.stepIndex} aria-label="Scenario progress">
              <span style={{ width: `${(run.stepIndex / scenario.steps.length) * 100}%` }} />
            </div>
            <div className="bx-row" style={{ marginTop: 10 }}>
              <Button variant="primary" icon={Play} disabled={!allowed || run.status !== 'idle'} onClick={() => act(startScenario)}>Start</Button>
              <Button icon={Pause} disabled={!allowed || run.status !== 'running'} onClick={() => act(pauseScenario)}>Pause</Button>
              <Button icon={Play} disabled={!allowed || run.status !== 'paused'} onClick={() => act(resumeScenario)}>Resume</Button>
              <Button icon={SkipForward} disabled={!allowed || finished} onClick={() => act(stepScenario)}>Step</Button>
              <Button icon={Repeat} disabled={!allowed || run.status === 'idle'} onClick={() => act(replayScenario)}>Replay</Button>
              <Button icon={RotateCcw} variant="danger" disabled={!allowed || run.status === 'idle'} onClick={() => act(resetScenario)}>Reset</Button>
            </div>
            <div style={{ marginTop: 12 }}>
              <KeyValue items={[
                ['Triggering condition', scenario.trigger],
                ['Expected behaviour', scenario.expected],
                ['Final outcome', finished ? <strong>{scenario.outcome}</strong> : <span className="bx-faint">Available when the scenario completes. {scenario.outcome}</span>],
              ]} />
            </div>
          </Card>

          <Card title="Event timeline">
            <ol className="bx-timeline">
              {scenario.steps.map((st, i) => {
                const executed = i < run.stepIndex;
                const next = i === run.stepIndex && run.status !== 'completed';
                const at = run.log?.find((l) => l.stepId === st.id);
                const Icon = executed ? CircleCheck : next ? CircleDot : Circle;
                return (
                  <li key={st.id} style={{ opacity: executed || next ? 1 : 0.6 }}>
                    <div className="bx-row" style={{ gap: 6 }}>
                      <Icon size={14} aria-hidden="true" color={executed ? 'var(--bx-green)' : next ? 'var(--app-accent)' : 'var(--app-text-faint)'} />
                      <span className="bx-mono bx-faint">{st.offset}</span>
                      <strong>{st.title}</strong>
                      {executed && <Badge color="green">Done {at ? fmtTime(at.at) : ''}</Badge>}
                      {next && <Badge color="cyan">Next</Badge>}
                    </div>
                    <div className="bx-muted">{st.detail}</div>
                    <div className="bx-timeline-meta">{opSummary(st.ops)}</div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>

      <div className="bx-grid bx-grid-2" style={{ marginTop: 12 }}>
        <Card title="Generated records" subtitle="Click through to inspect results in the connected modules">
          {run.stepIndex === 0 ? <div className="bx-faint">Nothing generated yet. Start or step the scenario.</div> : (
            <div className="bx-stack" style={{ gap: 10 }}>
              {created.alerts.length > 0 && <div><div className="bx-section-title">Alerts</div>{created.alerts.map((a) => (
                <div key={a.id}><Link to={`/alerts?open=${a.id}`} className="bx-mono">{a.id}</Link> {a.headline}</div>))}</div>}
              {created.flags.length > 0 && <div><div className="bx-section-title">Monitoring flags</div>{created.flags.map((f) => (
                <div key={f.id}><span className="bx-mono">{f.ruleId}</span> {f.district}: {f.text}</div>))}</div>}
              {created.records.length > 0 && <div><div className="bx-section-title">Records</div>{created.records.map((r) => (
                <div key={r.id}><Link to={`/hazards/${r.hazard}`} className="bx-mono">{r.id}</Link> {r.location}: {String(r.value)} {r.unit}</div>))}</div>}
              {created.incidents.length > 0 && <div><div className="bx-section-title">Incidents</div>{created.incidents.map((i) => (
                <div key={i.id} className="bx-row"><Link to={`/incidents/${i.id}`} className="bx-mono">{i.id}</Link><SeverityBadge value={i.severity} /><IncidentStatusBadge value={i.status} /><span>{i.title}</span></div>))}</div>}
              {created.tasks.length > 0 && <div><div className="bx-section-title">Response tasks</div>{created.tasks.map((t) => (
                <div key={t.id} className="bx-row"><Link to={`/field-operations?open=${t.id}`} className="bx-mono">{t.id}</Link><TaskStatusBadge value={t.status} /><span>{t.category} — {t.location}</span></div>))}</div>}
              {modified.length > 0 && <div><div className="bx-section-title">Baseline records modified (restored on reset)</div>{modified.map((m) => <div key={m} className="bx-mono">{m}</div>)}</div>}
            </div>
          )}
        </Card>
        <Card title="Scenario audit events">
          <Timeline items={audit.map((a) => ({ id: a.id, text: <span><strong>{a.action}</strong> — {a.entityType} {a.entityId}{a.next ? ` → ${a.next}` : ''}</span>, meta: `${fmtDateTime(a.at)} · ${a.userName}` }))}
            empty="No simulation events yet." />
        </Card>
      </div>
    </>
  );
}
