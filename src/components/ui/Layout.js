import React from 'react';
import { Info, AlertTriangle, OctagonAlert, CheckCircle2, Inbox } from 'lucide-react';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="bx-page-head">
      <div>
        <h1 className="bx-page-title">{title}</h1>
        {description && <p className="bx-page-desc">{description}</p>}
      </div>
      {actions && <div className="bx-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, flush, children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`bx-card ${className}`}>
      {(title || actions) && (
        <div className="bx-card-head">
          <div>
            {title && <h2 className="bx-card-title">{title}</h2>}
            {subtitle && <div className="bx-card-sub">{subtitle}</div>}
          </div>
          {actions && <div className="bx-row">{actions}</div>}
        </div>
      )}
      <div className={`bx-card-body ${flush ? 'is-flush' : ''}`}>{children}</div>
    </Tag>
  );
}

export { default as KpiCard } from './Kpi';

const BANNER_ICON = { info: Info, warning: AlertTriangle, danger: OctagonAlert, success: CheckCircle2 };
export function Banner({ kind = 'info', title, children, actions }) {
  const Icon = BANNER_ICON[kind] || Info;
  return (
    <div className={`bx-banner k-${kind}`} role={kind === 'danger' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <strong>{title} </strong>}
        {children}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title = 'Nothing to show', hint, icon: Icon = Inbox, children }) {
  return (
    <div className="bx-empty">
      <Icon size={22} aria-hidden="true" style={{ margin: '0 auto 6px', opacity: 0.6 }} />
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {children}
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="bx-kv">
      {items.filter(Boolean).map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v == null || v === '' ? '—' : v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div className="bx-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key}
          className={`bx-tab ${value === t.key ? 'is-active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}{t.count != null ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

export function Timeline({ items, empty = 'No activity recorded.' }) {
  if (!items.length) return <div className="bx-faint">{empty}</div>;
  return (
    <ol className="bx-timeline">
      {items.map((it) => (
        <li key={it.id}>
          <div>{it.text}</div>
          <div className="bx-timeline-meta">{it.meta}</div>
        </li>
      ))}
    </ol>
  );
}
