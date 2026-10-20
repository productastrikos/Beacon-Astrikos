import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../state/dataStore';
import { Timeline } from '../ui/Layout';
import { fmtDateTime } from '../../utils/format';
import { HAZARD_LABEL } from '../../types';
import { STATE_NAME } from '../../data/demo/geography';
import { OutcomeBadge } from '../ui/Badges';

export const hazardLabel = (h) => HAZARD_LABEL[h] || h;
export const stateName = (c) => STATE_NAME[c] || c;

/** Audit trail for a single entity (who did what, when). */
export function ActivityLog({ entityId, limit = 30, extra }) {
  const store = useData((s) => s.audit);
  const audit = useMemo(() => {
    const real = store.filter((a) => a.entityId === entityId);
    if (!extra) return real;
    const have = new Set(real.filter((a) => a.action === 'Task stage changed').map((a) => a.next));
    return [...real, ...extra.filter((e) => !have.has(e.next))].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [store, entityId, extra]);
  const items = useMemo(() => audit.slice(0, limit).map((a) => ({
    id: a.id,
    text: (
      <span>
        <strong>{a.action}</strong>
        {a.previous || a.next ? <span className="bx-muted"> — {a.previous ? `${a.previous} → ` : ''}{a.next}</span> : null}
        {a.outcome !== 'Success' && <> <OutcomeBadge value={a.outcome} /></>}
        {a.detail ? <div className="bx-faint">{a.detail}</div> : null}
      </span>
    ),
    meta: `${fmtDateTime(a.at)} · ${a.userName}${a.role && a.role !== '—' ? ` (${a.role})` : ''} · ${a.source}`,
  })), [audit, limit]);
  return <Timeline items={items} empty="No actions recorded yet." />;
}

export function IncidentLink({ id, children }) {
  return <Link to={`/incidents/${id}`} onClick={(e) => e.stopPropagation()}>{children || id}</Link>;
}

