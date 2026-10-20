import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { toastStore } from '../../state/uiStore';

const TTL = 6000;

function Toast({ toast }) {
  const timer = useRef(null);
  const left = useRef(TTL);
  const startedAt = useRef(0);
  const start = () => {
    startedAt.current = Date.now();
    timer.current = setTimeout(() => toastStore.dismiss(toast.id), left.current);
  };
  const pause = () => {
    clearTimeout(timer.current);
    left.current = Math.max(600, left.current - (Date.now() - startedAt.current));
  };
  useEffect(() => { start(); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bx-toast" role={toast.kind === 'error' ? 'alert' : 'status'} onMouseEnter={pause} onMouseLeave={start}>
      <span className={`bx-toast-dot k-${toast.kind}`} aria-hidden="true" />
      <div className="bx-toast-body">
        <div className="bx-toast-title">{toast.title || toast.text}</div>
        {toast.title && toast.text && <div className="bx-toast-text">{toast.text}</div>}
      </div>
      <button type="button" className="bx-toast-close" aria-label="Dismiss notification" onClick={() => toastStore.dismiss(toast.id)}><X size={14} strokeWidth={1.5} aria-hidden="true" /></button>
    </div>
  );
}

export default function Toasts() {
  const toasts = toastStore.use();
  return (
    <div className="bx-toasts" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}
