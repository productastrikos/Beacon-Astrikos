import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from './Overlay';
import { Button } from './Controls';
import { TrendChart, BarsChart } from '../charts/Charts';
import { forecast, nextDayLabels } from '../../utils/kpiHelpers';
import { toCsv, downloadText } from '../../utils/format';

const STATUS_PILL = { green: ['On track', 'green'], amber: ['Monitor', 'amber'], red: ['Needs action', 'red'] };
const ACTIONS = {
  'cc.': ['Assign owners to unassigned incidents.', 'Verify incidents that are still pending.', 'Escalate responses that have stalled.'],
  'al.': ['Acknowledge outstanding alerts.', 'Link alerts to the incidents they relate to.', 'Review alerts about to expire.'],
  'fo.': ['Assign unassigned tasks to an available team.', 'Follow up overdue tasks with the responsible team.', 'Verify tasks awaiting review.'],
  'int.': ['Check the status of delayed and offline sources.', 'Confirm the last successful sync with the source owner.'],
  'an.': ['Review the slowest acknowledgements and completions.', 'Check which hazards or states drive the result.'],
  'hz.': ['Review the records beyond threshold.', 'Create incidents or tasks where verification is needed.', 'Confirm gauge and station readings.'],
};

/**
 * Compact metric drawer: summary, metrics table, 7-day trend with 3-day forecast, breakdown, narrative,
 * insights, AI advisory and (when WARNING / CRITICAL) a numbered roadmap. Re-renders live with its card.
 */
export default function KpiDetailDrawer({
  onClose, id, name, page, value, unit, status, explanation, metrics, series, seriesUnit, target, targetLabel, breakdown, rows, route, asOf, higherIsBetter, thresholdLabels,
}) {
  const navigate = useNavigate();
  const decimals = seriesUnit === '%' || seriesUnit === 'minutes';
  const trend = useMemo(() => {
    if (!series || series.values.length < 3) return null;
    const hist = series.values;
    const fc = forecast(hist, 3);
    const labels = [...series.labels, ...nextDayLabels(3)];
    const n = hist.length;
    const datasets = [
      { label: 'Historical', data: [...hist, null, null, null], color: '#2dd4bf', fill: true },
      { label: 'Forecast', data: [...hist.map((_, i) => (i === n - 1 ? hist[n - 1] : null)), ...fc], color: '#60a5fa', dashed: true, diamond: true },
      ...(target != null ? [{ label: targetLabel || 'Target', data: labels.map(() => target), color: '#fbbf24', line: true }] : []),
    ];
    const cur = hist[n - 1];
    const end = fc[fc.length - 1];
    const pct = cur ? Math.round(((end - cur) / cur) * 100) : null;
    const u = seriesUnit ? ` ${seriesUnit}` : '';
    const narrative = pct === null || end === cur
      ? `${name} is projected to hold steady at about ${end}${u} over the next 3 days.`
      : `${name} is projected to ${end > cur ? 'rise' : 'fall'} by ~${Math.abs(pct)}% over the next 3 days, to about ${end}${u}.`;
    return { labels, datasets, narrative, cur, end, first: hist[0], rising: end > cur, flat: end === cur };
  }, [series, target, targetLabel, name, seriesUnit]);

  const u = seriesUnit ? ` ${seriesUnit}` : '';
  const insights = [];
  if (status === 'green') insights.push(`Within the normal band (${thresholdLabels ? thresholdLabels[0] : 'configured limits'}); no action required.`);
  else if (status) insights.push(`Currently ${status === 'red' ? 'critical' : 'in the warning band'} against the configured thresholds.`);
  if (trend && !trend.flat && status !== 'green') insights.push(`The 3-day projection is moving ${trend.rising === !higherIsBetter ? 'further from' : 'toward'} the normal band.`);
  if (rows && rows.items.length) insights.push(`${rows.items.length} record${rows.items.length === 1 ? '' : 's'} contribute to this value.`);

  const advisory = (() => {
    if (!trend) return `${name} is ${status === 'green' ? 'within' : 'outside'} its configured thresholds. Review the contributing records for context.`;
    const gap = target != null ? ` The gap to target (${target}${u}) is ${Math.abs(Math.round((trend.cur - target) * 10) / 10)}${u}.` : '';
    const dir = trend.flat ? 'stable' : (trend.rising === !higherIsBetter ? 'worsening' : 'improving');
    return `Over the last 7 days ${name} moved from ${trend.first} to ${trend.cur}${u}, and the projection is ${dir} (${trend.end}${u} in 3 days).${gap} ${status === 'green' ? 'Continue routine monitoring.' : 'Prioritise the roadmap below.'}`;
  })();
  const actions = status && status !== 'green' ? (Object.entries(ACTIONS).find(([p]) => id && id.startsWith(p)) || [null, []])[1] : [];
  const [pillText, pillTone] = STATUS_PILL[status] || [];

  const exportCsv = () => {
    if (!rows) return;
    downloadText(`${(id || 'kpi').replace('.', '-')}.csv`, toCsv(rows.items, rows.columns.map((c) => ({ header: c.header, value: (r) => c.get(r) }))));
  };

  return (
    <Drawer open onClose={onClose} title={name} subtitle={page} width={440}
      footer={<>
        {route && <Button size="sm" variant="primary" onClick={() => { onClose(); navigate(route); }}>Open register</Button>}
        <Button size="sm" onClick={exportCsv} disabled={!rows || !rows.items.length}>Export</Button>
      </>}>
      <section>
        <div className="bx-kd-head">
          <div className="bx-kd-value"><span>{value}</span>{unit && <small>{unit}</small>}</div>
          {pillText && <span className={`bx-kd-pill tone-${pillTone}`}>{pillText}</span>}
        </div>
        <p className="bx-kd-text">{explanation}</p>
      </section>

      <section>
        <div className="bx-kd-label">Metrics</div>
        <div className="bx-kd-metrics">
          {metrics.map(([k, v]) => (<div key={k} className="bx-kd-row"><span>{k}</span><span>{v}</span></div>))}
        </div>
      </section>

      {trend && (
        <section>
          <div className="bx-kd-label">7-day trend &amp; forecast</div>
          <TrendChart compact labels={trend.labels} datasets={trend.datasets} xTitle="Date" yTitle={seriesUnit ? seriesUnit[0].toUpperCase() + seriesUnit.slice(1) : 'Count'}
            unit={seriesUnit} integer={!decimals} beginAtZero={!decimals} height={200} ariaLabel={`${name}: 7-day trend and 3-day forecast`} />
          <p className="bx-kd-text" style={{ marginTop: 8 }}>{trend.narrative}</p>
        </section>
      )}

      {breakdown && breakdown.labels.length > 0 && (
        <section>
          <div className="bx-kd-label">Breakdown{breakdown.title ? ` — ${breakdown.title}` : ''}</div>
          <BarsChart compact horizontal labels={breakdown.labels} datasets={[{ label: breakdown.title || 'Count', data: breakdown.data, color: '#2dd4bf' }]}
            xTitle={breakdown.xTitle || 'Count'} yTitle={breakdown.yTitle || 'Category'} legend={false} height={Math.max(130, 30 * breakdown.labels.length + 56)}
            ariaLabel={`${name} breakdown`} />
        </section>
      )}

      <section>
        <div className="bx-kd-label">Operational insights</div>
        {insights.map((t) => <p key={t} className="bx-kd-text">{t}</p>)}
      </section>
      <section>
        <div className="bx-kd-label">AI advisory</div>
        <p className="bx-kd-text">{advisory}</p>
      </section>
      <section>
        <div className="bx-kd-label">Recommended roadmap</div>
        {actions.length > 0 ? (
          <ol className="bx-kd-steps">
            {actions.map((t, i) => <li key={t}><span className="bx-kd-num">{i + 1}</span><span>{t}</span></li>)}
          </ol>
        ) : <p className="bx-kd-text">No corrective action required at this time.</p>}
      </section>
      <div className="bx-faint" style={{ fontSize: 10 }}>Updates live while open. As of {asOf}.</div>
    </Drawer>
  );
}
