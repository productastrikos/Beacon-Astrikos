import React from 'react';
import { KPI_STATUS_LABEL } from './badgeTones';

/** Footer row: [● STATUS] ........ [VIEW DETAILS]. `status` is 'green' | 'amber' | 'red' | null. */
export default function KpiCardFooter({ status, onViewDetails, label }) {
  const text = KPI_STATUS_LABEL[status];
  return (
    <div className="bx-kpi-foot">
      {text ? <span className={`bx-kpi-status tone-${status}`}><span className="bx-dot" aria-hidden="true" style={{ width: 6, height: 6 }} />{text}</span> : <span />}
      <span className="bx-kpi-foot-right">
        <button type="button" className="bx-kpi-viewlink" onClick={onViewDetails} aria-label={`View details for ${label}`}>View details</button>
      </span>
    </div>
  );
}
