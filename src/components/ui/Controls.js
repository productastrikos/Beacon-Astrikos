import React, { useId, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { HazardIcon } from './HazardIcon';

export function Button({ variant = 'default', size, icon: Icon, children, className = '', ...rest }) {
  const v = variant === 'primary' ? 'bx-btn-primary' : variant === 'danger' ? 'bx-btn-danger' : variant === 'ghost' ? 'bx-btn-ghost' : '';
  return (
    <button type="button" className={`bx-btn ${v} ${size === 'sm' ? 'bx-btn-sm' : ''} ${className}`} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 13 : 15} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, iconName, label, count, ...rest }) {
  return (
    <button type="button" className="bx-icon-btn" aria-label={label} title={label} {...rest}>
      {iconName ? <HazardIcon name={iconName} size={18} /> : <Icon size={17} aria-hidden="true" />}
      {count > 0 && <span className="bx-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </button>
  );
}

/** Label + control wrapper. Pass a render-prop child to receive the generated id. */
export function Field({ label, error, help, children, className = '' }) {
  const id = useId();
  return (
    <div className={`bx-field ${className}`}>
      {label && <label className="bx-label" htmlFor={id}>{label}</label>}
      {typeof children === 'function' ? children({ id, 'aria-invalid': !!error }) : children}
      {error && <span className="bx-error" role="alert">{error}</span>}
      {!error && help && <span className="bx-help">{help}</span>}
    </div>
  );
}

export function TextInput({ label, error, help, className, ...rest }) {
  return (
    <Field label={label} error={error} help={help} className={className}>
      {(p) => <input className={`bx-input ${error ? 'is-invalid' : ''}`} {...p} {...rest} />}
    </Field>
  );
}

export function TextArea({ label, error, help, className, ...rest }) {
  return (
    <Field label={label} error={error} help={help} className={className}>
      {(p) => <textarea className={`bx-textarea ${error ? 'is-invalid' : ''}`} {...p} {...rest} />}
    </Field>
  );
}

/** options: array of strings or {value,label}. */
export function Select({ label, options, value, onChange, placeholder, error, help, className, compact, disabled, ...rest }) {
  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Field label={label} error={error} help={help} className={className}>
      {(p) => (
        <select className={`bx-select ${compact ? 'is-compact' : ''}`} value={value ?? ''} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} {...p} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {norm.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

/**
 * Dropdown whose options carry icons (a native <select> cannot render SVG).
 * options: [{ value, label, icon? }]. Keyboard: Enter/Space/Arrows/Escape.
 */
export function IconSelect({ label, options, value, onChange, placeholder = 'All', compact = true }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const all = [{ value: '', label: placeholder }, ...options];
  const current = all.find((o) => o.value === value) || all[0];

  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open]);

  const choose = (v) => { onChange(v); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); setActive(all.indexOf(current)); } else setActive((a) => Math.min(a + 1, all.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(all[active].value); }
  };

  return (
    <div className="bx-field" ref={ref} style={{ position: 'relative' }}>
      {label && <span className="bx-label" id={`${id}-l`}>{label}</span>}
      <button type="button" className={`bx-select bx-iconselect ${compact ? 'is-compact' : ''}`} aria-haspopup="listbox" aria-expanded={open}
        aria-labelledby={label ? `${id}-l ${id}-b` : undefined} id={`${id}-b`} onClick={() => { setOpen((o) => !o); setActive(all.indexOf(current)); }} onKeyDown={onKey}>
        {current.icon && <HazardIcon name={current.icon} size={16} decorative />}
        <span style={{ flex: 1, textAlign: 'left' }}>{current.label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <ul className="bx-menu bx-iconselect-list" role="listbox" aria-labelledby={label ? `${id}-l` : undefined} style={{ left: 0, right: 'auto', minWidth: '100%' }}>
          {all.map((o, i) => (
            <li key={o.value || '__all'} role="option" aria-selected={o.value === value}
              className={`bx-menu-item ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}>
              {o.icon ? <HazardIcon name={o.icon} size={16} decorative /> : <span style={{ width: 16 }} />}
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
