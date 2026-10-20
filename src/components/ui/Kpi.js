import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { KPI_META } from '../../data/kpiMeta';
import { KPI_THRESHOLDS, thresholdStatus, thresholdLabels, upIsBad, SCOPE_FACTOR } from '../../config/kpiThresholds';
import { useUi } from '../../state/uiStore';
import { KPI_ICON } from '../../config/icons';
import DeltaChip from './DeltaChip';
import KpiCardFooter from './KpiCardFooter';
import ThresholdLegend from './ThresholdLegend';
import KpiDetailDrawer from './KpiDetailDrawer';
import { HazardIcon } from './HazardIcon';
import { fmtDateTime } from '../../utils/format';
import { useData } from '../../state/dataStore';
import { cumulativeSeries } from '../../utils/kpiHelpers';

const fmt = (v) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v));
const dateOf = (it) => it.createdAt || it.sent || it.sourceTimestamp || it.lastSuccess || null;
const STATUS_TEXT = { green: 'Normal', amber: 'Warning', red: 'Critical' };

function trendOf(raw, previous) {
  if (typeof raw !== 'number' || typeof previous !== 'number') return { delta: null };
  return { delta: raw - previous };
}

/** Brief count-up (~400 ms) whenever a numeric value changes. */
function useCountUp(target, ms = 400) {
  const [shown, setShown] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (typeof target !== 'number') { setShown(target); prev.current = target; return undefined; }
    const from = typeof prev.current === 'number' ? prev.current : target;
    if (from === target) { setShown(target); return undefined; }
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setShown(Math.round(from + (target - from) * p));
      if (p < 1) raf = requestAnimationFrame(step); else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); prev.current = target; };
  }, [target, ms]);
  return shown;
}

/**
 * The single KPI card used on every page.
 * Props: id (key into kpiThresholds / kpiMeta), label, value (number or string), raw (numeric for status), previous, description,
 *   stats [{label,value}] mini stats, progress { value, target, label } (bar vs target), series { labels, values } (7 days),
 *   breakdown { title, labels, data, xTitle, yTitle }, rows { columns:[{header,get}], items }, target (number, drawer target line), to.
 */
export default function KpiCard({
  id, label, value, raw, previous, description, progress, series, breakdown, rows, iconName, icon: Icon, to, target, targetLabel, unit, asOf, explanation, source,
}) {
  const storeBaseAt = useData((st) => st.baseAt);
  const scale = useUi((u) => (u.scope === 'IN' ? SCOPE_FACTOR : 1));
  const [open, setOpen] = useState(false);
  const base = KPI_META[id] || {};
  const cfg = KPI_THRESHOLDS[id];
  const numeric = typeof raw === 'number' ? raw : (typeof value === 'number' ? value : null);
  const status = thresholdStatus(id, numeric, scale);
  const shown = useCountUp(typeof value === 'number' ? value : null);
  const display = typeof value === 'number' ? shown : value;
  const { delta } = trendOf(numeric, previous);
  const glyph = iconName || KPI_ICON[id];
  const unitWord = unit !== undefined ? unit : (cfg ? cfg.unit : null);
  const desc = description || (cfg && cfg.description) || '';
  const timestamp = fmtDateTime(asOf || new Date().toISOString());
  const labels = thresholdLabels(cfg, scale);
  const info = explanation || base.explanation || desc;
  const route = to !== undefined ? to : base.to;

  const barPct = progress ? Math.max(0, Math.min(100, progress.target ? (progress.value / progress.target) * 100 : progress.value)) : 0;

  const metrics = [
    ['Target', progress && progress.target != null ? `${fmt(progress.target)}${progress.unit || ''}` : (cfg && !cfg.info ? (cfg.dir === 'lower' ? `≤ ${cfg.green}` : `≥ ${cfg.green}`) + (unitWord ? ` ${unitWord}` : '') : 'Not defined')],
    ['Baseline', previous != null ? `${fmt(previous)}${unitWord ? ` ${unitWord}` : ''}` : 'Not recorded'],
    ['Threshold', labels ? `Green ${labels[0]} · Amber ${labels[1]}${labels[2] ? ` · Red ${labels[2]}` : ''}` : 'Informational'],
    ['Status', status ? STATUS_TEXT[status] : 'Informational'],
    ['Source', source || base.source || 'Operational registers'],
    ['Last updated', timestamp],
  ];
  const derivedSeries = series || (rows && rows.items.length && rows.items.every((it) => dateOf(it)) ? { ...cumulativeSeries(rows.items, dateOf), unit: unitWord } : null);

  return (
    <>
      <div className={`bx-kpi ${status ? `is-${status}` : ''}`} data-status={status || 'none'}>
        <div className="bx-kpi-head">
          <span className="bx-kpi-label">
            {glyph ? <HazardIcon name={glyph} size={16} style={{ color: 'var(--accent)' }} />
              : Icon && <Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            <span className="bx-kpi-title">{label}</span>
            {info && <span className="bx-kpi-info" tabIndex={0} role="img" aria-label={`About ${label}: ${info}`} title={info}><Info size={14} strokeWidth={1.5} aria-hidden="true" /></span>}
          </span>
          <DeltaChip value={delta} upIsBad={upIsBad(id)}
            title={delta === null ? undefined : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)} vs previous period (${fmtDateTime(storeBaseAt)})`} />
        </div>
        <div className="bx-kpi-body">
          <div className="bx-kpi-value" aria-live="off">
            <span className="bx-kpi-num">{display}</span>
            {unitWord && <span className="bx-kpi-unit">{unitWord}</span>}
          </div>
          {desc && <p className="bx-kpi-desc">{desc}</p>}
          {progress && (
            <div className="bx-kpi-progress">
              <div className="bx-kpi-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(barPct)} aria-label={progress.label || 'Progress against target'}>
                <span className={`tone-${status || 'neutral'}`} style={{ width: `${barPct}%` }} />
              </div>
              <div className="bx-kpi-bar-label"><span>{progress.label || ''}</span><span>Target {fmt(progress.target)}{progress.unit || ''}</span></div>
            </div>
          )}
          {labels && <ThresholdLegend labels={labels} />}
        </div>
        <KpiCardFooter status={status} label={label} onViewDetails={() => setOpen(true)} />
      </div>
      {open && (
        <KpiDetailDrawer onClose={() => setOpen(false)} id={id} name={base.name || label} page={base.source || 'Beacon'} value={display} unit={unitWord} status={status}
          explanation={info || '—'} metrics={metrics} series={derivedSeries} seriesUnit={derivedSeries ? derivedSeries.unit || unitWord : null}
          target={target !== undefined ? target : (progress ? progress.target : null)} targetLabel={targetLabel} breakdown={breakdown} rows={rows} route={route}
          asOf={timestamp} higherIsBetter={cfg ? cfg.dir === 'higher' : false} thresholdLabels={labels} />
      )}
    </>
  );
}
