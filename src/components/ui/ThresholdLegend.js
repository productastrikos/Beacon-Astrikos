import React from 'react';

/** "THRESHOLD" label plus three dot + range items (green / amber / red). */
export default function ThresholdLegend({ labels }) {
  if (!labels) return null;
  const tones = ['green', 'amber', 'red'];
  return (
    <div className="bx-threshold">
      <div className="bx-threshold-label">Threshold</div>
      <ul className="bx-threshold-items">
        {labels.map((l, i) => (
          <li key={tones[i]}><span className={`bx-threshold-dot tone-${tones[i]}`} aria-hidden="true" />{l}</li>
        ))}
      </ul>
    </div>
  );
}
