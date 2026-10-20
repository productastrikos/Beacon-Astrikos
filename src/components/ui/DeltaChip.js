import React from 'react';

/**
 * Tinted, borderless delta chip. Colour reflects meaning, not direction:
 * upIsBad true -> up red / down green; false -> up green / down red; null -> neutral slate.
 * Format: "▲ +2", "▼ 3", optional suffix (e.g. "%"), zero shows "– 0".
 */
export default function DeltaChip({ value, upIsBad = null, suffix = '', title }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const zero = value === 0;
  const up = value > 0;
  const tone = zero || upIsBad === null ? 'slate' : (up === upIsBad ? 'red' : 'green');
  const abs = Math.abs(value).toLocaleString('en-IN');
  const text = zero ? '0' : `${up ? '+' : ''}${abs}${suffix}`;
  const tip = title || `${up ? '+' : zero ? '' : '−'}${abs}${suffix} vs previous period`;
  return (
    <span className={`bx-delta tone-${tone}`} title={tip} aria-label={tip}>
      {zero ? <span aria-hidden="true">{'–'}</span> : <span className="bx-delta-tri" aria-hidden="true">{up ? '▲' : '▼'}</span>}
      <span>{text}</span>
    </span>
  );
}
