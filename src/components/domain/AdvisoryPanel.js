import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { computeAdvisories } from '../../state/advisoryRules';
import { useLiveData } from '../../state/LiveDataProvider';
import { useAuth } from '../../state/hooks';
import { fmtTime } from '../../utils/format';
import { Drawer } from '../ui/Overlay';
import TaskForm from './TaskForm';
import IncidentForm from './IncidentForm';

const LEVEL_TONE = { 'ACT NOW': 'red', REVIEW: 'amber', MONITOR: 'blue' };

function Pill({ level }) { return <span className={`bx-adv-pill tone-${LEVEL_TONE[level]}`}>{level}</span>; }

/** Full advisory structure: root cause, evidence, recommendations, projected impact, actions. `wide` lays it out in two columns. */
function AdvisoryDetail({ adv, onAction, wide }) {
  const { can } = useAuth();
  return (
    <div className={`bx-adv-body ${wide ? 'is-wide' : ''}`}>
      <div>
        <div className="bx-kd-label">Root cause</div>
        {[['Primary', adv.rootCause.primary], ['Contributing', adv.rootCause.contributing], ['Systemic', adv.rootCause.systemic]].map(([k, v]) => (
          <p key={k} className="bx-adv-cause"><strong>{k}</strong> · {v}</p>
        ))}
        <div className="bx-kd-label" style={{ marginTop: 14 }}>Evidence</div>
        <ol className="bx-kd-steps">
          {adv.evidence.map((t, i) => <li key={t}><span className="bx-kd-num">{i + 1}</span><span>{t}</span></li>)}
        </ol>
      </div>
      <div>
        <div className="bx-kd-label">Recommendations</div>
        <ul className="bx-adv-recs">{adv.recommendations.map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="bx-kd-label" style={{ marginTop: 14 }}>Projected impact</div>
        <div className="bx-adv-tiles">
          {adv.impact.map((t) => <div key={t.label} className="bx-adv-tile"><strong>{t.value}</strong><span>{t.label}</span></div>)}
        </div>
        {adv.actions.length > 0 && (
          <>
            <div className="bx-kd-label" style={{ marginTop: 14 }}>Actions</div>
            <div className="bx-adv-actions">
              {adv.actions.map((a) => (
                <button key={a.label} type="button" disabled={!can(a.kind === 'task' ? 'task.create' : 'incident.create')} onClick={() => onAction(a)}>{a.label} ›</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * AI Advisory: rule-based insights regenerated from the live store on every tick for the current scope.
 * The top-scoring insight is featured as "Requires action today"; the rest are listed with a drawer for the full detail.
 */
export default function AdvisoryPanel({ data, scope, now }) {
  const navigate = useNavigate();
  const { lastTick } = useLiveData();
  const advisories = useMemo(() => computeAdvisories(data, scope, now), [data, scope, now]);
  const [openId, setOpenId] = useState(null);
  const [taskInit, setTaskInit] = useState(null);
  const [incInit, setIncInit] = useState(null);
  const [fresh, setFresh] = useState(() => new Set());
  const seen = useRef(null);

  useEffect(() => {
    const ids = new Set(advisories.map((a) => a.id));
    const prev = seen.current;
    seen.current = ids;
    if (!prev) return undefined;
    const added = new Set([...ids].filter((i) => !prev.has(i)));
    if (!added.size) return undefined;
    setFresh(added);
    const t = setTimeout(() => setFresh(new Set()), 1500);
    return () => clearTimeout(t);
  }, [advisories]);

  const featured = advisories[0];
  const rest = advisories.slice(1, 7);
  const open = advisories.find((a) => a.id === openId);
  const count = (lvl) => advisories.filter((a) => a.level === lvl).length;
  const act = (a) => { if (a.kind === 'task') setTaskInit(a.initial); else setIncInit(a.initial); };

  return (
    <section className="bx-card bx-adv" aria-label="AI Advisory">
      <div className="bx-card-head">
        <div>
          <h2 className="bx-card-title"><Sparkles size={14} strokeWidth={1.5} aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-2px', color: 'var(--accent)' }} />AI Advisory</h2>
          <div className="bx-card-sub">Insights generated from live operational data · updated {fmtTime(lastTick)}</div>
        </div>
        <span className="bx-adv-count">{count('ACT NOW')} act now · {count('REVIEW')} review · {count('MONITOR')} monitor</span>
      </div>
      <div className="bx-card-body">
        {!featured ? (
          <div className="bx-faint" style={{ fontSize: 12 }}>No advisories at the moment. Conditions in this scope are within normal ranges.</div>
        ) : (
          <>
            <div className={`bx-adv-featured ${fresh.has(featured.id) ? 'is-fresh' : ''}`}>
              <div className="bx-adv-kicker">REQUIRES ACTION TODAY</div>
              <div className="bx-adv-meta"><Pill level="ACT NOW" /><span className="bx-mono">{featured.id}</span><span>{featured.category}</span></div>
              <h3 className="bx-adv-title">{featured.title}</h3>
              <AdvisoryDetail adv={featured} onAction={act} wide />
            </div>
            {rest.length > 0 && (
              <>
                <div className="bx-kd-label" style={{ margin: '16px 0 6px' }}>Prioritised advisories</div>
                <ul className="bx-adv-list">
                  {rest.map((a) => (
                    <li key={a.id} className={fresh.has(a.id) ? 'is-fresh' : ''}>
                      <div className="bx-adv-meta"><Pill level={a.level} /><span className="bx-mono">{a.id}</span><span>{a.category}</span></div>
                      <div className="bx-adv-row">
                        <div style={{ minWidth: 0 }}>
                          <div className="bx-adv-rtitle" title={a.title}>{a.title}</div>
                          <div className="bx-adv-rsum" title={a.summary}>{a.summary}</div>
                        </div>
                        <button type="button" className="bx-action-btn" onClick={() => setOpenId(a.id)}>View ›</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
      {open && (
        <Drawer open onClose={() => setOpenId(null)} title={open.category} subtitle={`${open.id} · ${open.level}`} width={440}>
          <h3 className="bx-adv-title">{open.title}</h3>
          <AdvisoryDetail adv={open} onAction={act} />
        </Drawer>
      )}
      <TaskForm open={!!taskInit} onClose={() => setTaskInit(null)} initial={taskInit || undefined} onCreated={(id) => navigate(`/field-operations?open=${id}`)} />
      <IncidentForm open={!!incInit} onClose={() => setIncInit(null)} initial={incInit || undefined} onCreated={(id) => navigate(`/incidents/${id}`)} />
    </section>
  );
}
