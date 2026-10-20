import React from 'react';
import {
  SEVERITY_TONE, CAP_SEVERITY_TONE, VERIFICATION_TONE, INCIDENT_STATUS_TONE, TASK_STATUS_TONE, PRIORITY_TONE, SOURCE_STATUS_TONE,
  CLASSIFICATION_TONE, ALERT_STATUS_TONE, AVAILABILITY_TONE, ROAD_TONE, FRESHNESS_TONE, REVIEW_TONE, OUTCOME_TONE, toneClass,
} from './badgeTones';

/** The one shared badge: soft tinted pill with a leading 6px dot. No icons. */
export function StatusBadge({ tone = 'slate', label, children, title, className = '' }) {
  return (
    <span className={`bx-badge c-${toneClass(tone)} ${className}`} title={title}>
      <span className="bx-dot" aria-hidden="true" />
      {label ?? children}
    </span>
  );
}

/** Generic badge (legacy API). `color` is a tone name; any `icon`/`dot` props are ignored. */
export function Badge({ color = 'grey', children, title, className = '' }) {
  return <StatusBadge tone={color} title={title} className={className}>{children}</StatusBadge>;
}

export function SeverityBadge({ value }) {
  if (!value) return <span className="bx-faint">—</span>;
  return <StatusBadge tone={SEVERITY_TONE[value]} label={value} title={`${value} severity`} />;
}
export function CapSeverityBadge({ value }) {
  return <StatusBadge tone={CAP_SEVERITY_TONE[value]} label={value || 'Unknown'} title="Severity as published by the source" />;
}
export function IncidentStatusBadge({ value }) { return <StatusBadge tone={INCIDENT_STATUS_TONE[value]} label={value} />; }
export function TaskStatusBadge({ value }) { return <StatusBadge tone={TASK_STATUS_TONE[value]} label={value} />; }
export function PriorityBadge({ value }) { return <StatusBadge tone={PRIORITY_TONE[value]} label={value} />; }
export function VerificationBadge({ value }) {
  return <StatusBadge tone={VERIFICATION_TONE[value]} label={value} />;
}
export function SourceStatusBadge({ value }) {
  return <StatusBadge tone={SOURCE_STATUS_TONE[value]} label={value} />;
}
export function ClassificationBadge({ value }) {
  return <StatusBadge tone={CLASSIFICATION_TONE[value]} label={value} />;
}
export function AlertStatusBadge({ value }) { return <StatusBadge tone={ALERT_STATUS_TONE[value]} label={value} />; }
export function AvailabilityBadge({ value }) { return <StatusBadge tone={AVAILABILITY_TONE[value]} label={value} />; }
export function RoadBadge({ value }) { return <StatusBadge tone={ROAD_TONE[value]} label={value} />; }
export function FreshnessBadge({ level, label }) { return <StatusBadge tone={FRESHNESS_TONE[level]} label={label} />; }
export function ReviewBadge({ value }) { return <StatusBadge tone={REVIEW_TONE[value]} label={value} />; }
export function OutcomeBadge({ value }) { return <StatusBadge tone={OUTCOME_TONE[value]} label={value} />; }

