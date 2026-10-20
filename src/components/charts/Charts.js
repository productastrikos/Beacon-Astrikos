import React, { useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { getChartTokens } from '../chartUtils';
import { useUi } from '../../state/uiStore';
import { EmptyState } from '../ui/Layout';
import { BarChart3 } from 'lucide-react';
import { HazardIcon } from '../ui/HazardIcon';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

export const SEVERITY_COLORS = { Critical: '#ef4444', High: '#f97316', Moderate: '#f59e0b', Low: '#3b82f6' };
const SERIES = ['#2dd4bf', '#60a5fa', '#fbbf24', '#34d399', '#94a3b8', '#fb923c'];

function useTokens() {
  const theme = useUi((s) => s.theme);
  // Re-read CSS variables whenever the theme changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getChartTokens(), [theme]);
}

/**
 * Shared chart defaults: labelled X and Y axes (titles, 11px ticks, 12px titles), zero-based integer count axes,
 * light gridlines, a legend whenever there is more than one series, and tooltips that show value + unit.
 */
function baseOptions(t, { stacked, legend, yTitle, xTitle, horizontal, unit = '', integer = true, beginAtZero = true, multi = false, compact = false } = {}) {
  const axisTitle = (text) => ({ display: !!text, text, color: t.tickMuted, font: { size: compact ? 10 : 11, weight: '500' }, padding: 4 });
  const countAxis = { stacked, beginAtZero, grid: { color: t.gridColor }, ticks: { color: t.tickMuted, font: { size: 10 }, precision: integer ? 0 : undefined } };
  const catAxis = { stacked, grid: { color: t.gridColor }, ticks: { color: t.tickMuted, font: { size: 10 }, maxRotation: 0, autoSkip: true } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: legend ?? multi, position: 'bottom', labels: { color: t.legendColor, boxWidth: 12, boxHeight: 3, font: { size: compact ? 10 : 11 } } },
      tooltip: {
        backgroundColor: t.tooltipBg, borderColor: t.tooltipBorder, borderWidth: 1, titleColor: t.tooltipTitle, bodyColor: t.tooltipBody, padding: 8,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed[horizontal ? 'x' : 'y']}${unit ? ` ${unit}` : ''}` },
      },
    },
    scales: {
      x: { ...(horizontal ? countAxis : catAxis), title: axisTitle(xTitle) },
      y: { ...(horizontal ? catAxis : countAxis), title: axisTitle(yTitle) },
    },
  };
}

function Empty() {
  return <EmptyState title="No data for the current filters" hint="Adjust the time range, hazard or scope." icon={BarChart3} />;
}

/**
 * Line chart. datasets: [{ label, data (null = gap), color, dashed, diamond, fill, line }]
 * `line: true` draws a flat reference line (threshold / target) with no points.
 */
export function TrendChart({
  labels, datasets, xTitle = 'Date', yTitle = 'Count', unit, integer, beginAtZero, height, ariaLabel, legendIcons, compact,
}) {
  const t = useTokens();
  const has = datasets.some((d) => d.data.some((v) => v !== null && v !== undefined && v !== 0));
  if (!labels.length || !has) return <Empty />;
  const data = {
    labels,
    datasets: datasets.map((d, i) => {
      const color = d.color || SERIES[i % SERIES.length];
      return {
        label: d.label, data: d.data, borderColor: color, backgroundColor: `${color}26`, borderWidth: d.line ? 1.5 : 2,
        pointRadius: d.line ? 0 : d.diamond ? 5 : (labels.length > 20 ? 0 : 3), pointStyle: d.diamond ? 'rectRot' : 'circle',
        pointBackgroundColor: color, tension: d.line ? 0 : 0.25, fill: d.fill ?? (i === 0 && !d.line && !d.dashed), spanGaps: false,
        borderDash: d.dashed || d.line ? [7, 4] : undefined,
      };
    }),
  };
  const options = baseOptions(t, { yTitle, xTitle, unit, integer, beginAtZero, legend: legendIcons ? false : undefined, multi: datasets.length > 1, compact });
  return (
    <div>
      {legendIcons && (
        <ul className="bx-legend" aria-label="Chart legend">
          {datasets.map((d, i) => (
            <li key={d.label}>
              {legendIcons[i] && <HazardIcon name={legendIcons[i]} size={14} />}
              <span className={`bx-legend-swatch ${d.dashed || d.line ? 'is-dashed' : ''}`} style={{ '--sw': d.color || SERIES[i % SERIES.length] }} aria-hidden="true" />
              {d.label}
            </li>
          ))}
        </ul>
      )}
      <div className="bx-chart" style={height ? { height } : undefined} role="img" aria-label={ariaLabel || `${yTitle} by ${xTitle}`}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

const valueLabelsPlugin = (color, horizontal) => ({
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 11px Inter, Roboto, system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((ds, di) => {
      if (chart.data.datasets.length > 1 && ds.stack) return; // stacked totals are not labelled
      chart.getDatasetMeta(di).data.forEach((el, i) => {
        const v = ds.data[i];
        if (!v) return;
        if (horizontal) { ctx.textAlign = 'left'; ctx.fillText(String(v), el.x + 6, el.y); } else { ctx.textAlign = 'center'; ctx.fillText(String(v), el.x, el.y - 8); }
      });
    });
    ctx.restore();
  },
});

/** Draws "■ Label" on one line under each x tick; the square uses the same colour token as the bar. */
const axisSquaresPlugin = (colors, textColor) => ({
  id: 'axisSquares',
  afterDraw(chart) {
    const x = chart.scales.x;
    if (!x) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '500 11px Inter, Roboto, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    x.ticks.forEach((_tick, i) => {
      const text = String(chart.data.labels[i]);
      const size = 10;
      const gap = 5;
      const w = size + gap + ctx.measureText(text).width;
      const left = x.getPixelForTick(i) - w / 2;
      const y = x.top + 14;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(left, y - size / 2, size, size, 2); else ctx.rect(left, y - size / 2, size, size);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.fillText(text, left + size + gap, y);
    });
    ctx.restore();
  },
});

/** Bar chart. xTitle / yTitle label the horizontal / vertical axes literally. Values are drawn on the bars. */
export function BarsChart({
  labels, datasets, stacked = false, horizontal = false, xTitle, yTitle = 'Count', unit, integer, height, onBarClick, ariaLabel, legend, labelSquares, compact,
}) {
  const t = useTokens();
  const has = datasets.some((d) => d.data.some((v) => v));
  if (!labels.length || !has) return <Empty />;
  const data = {
    labels,
    datasets: datasets.map((d, i) => ({
      label: d.label, data: d.data, stack: d.stack, backgroundColor: d.colors || d.color || SERIES[i % SERIES.length], borderRadius: 2, maxBarThickness: 36,
    })),
  };
  const options = baseOptions(t, {
    stacked, xTitle: xTitle ?? (horizontal ? 'Count' : 'Category'), yTitle: horizontal ? (yTitle === 'Count' ? 'Category' : yTitle) : yTitle,
    horizontal, unit, integer, legend, multi: datasets.length > 1, compact,
  });
  if (!horizontal) options.layout = { padding: { top: 14 } }; else options.layout = { padding: { right: 24 } };
  if (onBarClick) {
    options.onClick = (_e, els) => { if (els.length) onBarClick(labels[els[0].index], els[0].datasetIndex); };
    options.onHover = (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; };
  }
  const squares = labelSquares && !horizontal;
  if (squares) {
    options.scales.x.ticks.callback = () => '';
    options.scales.x.afterFit = (scale) => { scale.height = Math.max(scale.height, 28); };
  }
  const plugins = [valueLabelsPlugin(t.tooltipTitle, horizontal), ...(squares ? [axisSquaresPlugin(labelSquares, t.tickMuted)] : [])];
  return (
    <div className="bx-chart" style={height ? { height } : undefined} role="img" aria-label={ariaLabel || `${yTitle} by ${xTitle || 'category'}`}>
      <Bar data={data} options={options} plugins={plugins} />
    </div>
  );
}
