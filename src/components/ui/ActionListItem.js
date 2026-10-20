import React from 'react';

/**
 * Bordered "requiring action" row: tone dot, bold name + tinted risk pill, muted one-line detail,
 * and a bordered View Details button on the right.
 */
export default function ActionListItem({ tone = 'amber', title, risk, detail, onView, viewLabel = 'View Details' }) {
  return (
    <div className="bx-action-item">
      <span className={`bx-action-dot tone-${tone}`} aria-hidden="true" />
      <div className="bx-action-main">
        <div className="bx-action-title">
          <strong title={title}>{title}</strong>
          {risk && <span className={`bx-risk-pill tone-${tone}`}>{risk}</span>}
        </div>
        {detail && <div className="bx-action-detail" title={detail}>{detail}</div>}
      </div>
      <button type="button" className="bx-action-btn" onClick={onView} aria-label={`${viewLabel}: ${title}`}>{viewLabel}</button>
    </div>
  );
}
