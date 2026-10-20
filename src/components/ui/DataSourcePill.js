import React from 'react';
import { StatusBadge } from './Badges';
import { SOURCE_STATUS_TONE } from './badgeTones';
import { fmtRelative } from '../../utils/format';

/** "● Connected" / "● Delayed" / "● Offline" pill with the last successful sync time beside it. */
export default function DataSourcePill({ status, lastSync, now = Date.now(), showTime = true }) {
  return (
    <span className="bx-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <StatusBadge tone={SOURCE_STATUS_TONE[status]} label={status} />
      {showTime && <span className="bx-faint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{lastSync ? `synced ${fmtRelative(lastSync, now)}` : 'no sync yet'}</span>}
    </span>
  );
}
