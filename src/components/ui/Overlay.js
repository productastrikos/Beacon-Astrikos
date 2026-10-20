import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button, TextArea } from './Controls';

/** Keeps Tab / Shift+Tab inside the dialog. */
function trapFocus(e, root) {
  if (e.key !== 'Tab' || !root) return;
  const items = [...root.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
}

/** Right-hand detail drawer. Closes on Escape or scrim click; focus moves in. */
export function Drawer({ open, onClose, title, subtitle, children, footer, width }) {
  const ref = useRef(null);
  useEscape(onClose);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="bx-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="bx-drawer" style={width ? { width: `min(${width}px, 100vw)` } : undefined} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}
        ref={ref} tabIndex={-1} onKeyDown={(e) => trapFocus(e, ref.current)}>
        <div className="bx-drawer-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
            {subtitle && <div className="bx-card-sub">{subtitle}</div>}
          </div>
          <button type="button" className="bx-drawer-close" onClick={onClose} aria-label="Close details"><X size={15} strokeWidth={1.5} /></button>
        </div>
        <div className="bx-drawer-body">{children}</div>
        {footer && <div className="bx-drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  useEscape(onClose);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="bx-scrim" onClick={onClose} aria-hidden="true" style={{ zIndex: 62 }} />
      <div className="bx-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} style={{ zIndex: 63 }}>
        <div className="bx-drawer-head">
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          <button type="button" className="bx-icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="bx-modal-body">{children}</div>
        {footer && <div className="bx-drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

/** Reason / note prompt used for escalations, closures, completions. */
export function PromptModal({ open, onClose, title, label, placeholder, required = true, confirmLabel = 'Confirm', onConfirm, description, danger }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setText(''); setError(''); } }, [open]);
  const submit = () => {
    if (required && !text.trim()) { setError('This field is required.'); return; }
    const res = onConfirm(text.trim());
    if (res && res.ok === false) { setError(res.error); return; }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant={danger ? 'danger' : 'primary'} onClick={submit}>{confirmLabel}</Button>
        <Button onClick={onClose}>Cancel</Button>
      </>}>
      {description && <p className="bx-muted">{description}</p>}
      <TextArea label={label} value={text} onChange={(e) => { setText(e.target.value); setError(''); }} placeholder={placeholder} error={error} autoFocus />
    </Modal>
  );
}
