import React from 'react';
import { ICONS } from '../icons';

/**
 * Thin outline icon (Lucide, strokeWidth 1.5, no fill). Decorative by default: adjacent text carries the meaning.
 * Pass `label` to expose it to assistive tech instead.
 */
export function HazardIcon({ name, size = 16, label, className = '', style }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return <Cmp size={size} strokeWidth={1.5} fill="none" className={`bx-icon ${className}`} style={{ flexShrink: 0, ...style }} {...a11y} />;
}

export default HazardIcon;
