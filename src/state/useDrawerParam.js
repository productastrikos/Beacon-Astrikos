import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Drawer open-state kept in a query param of the CURRENT page (e.g. /command-centre?task=TSK-3004).
 * Opening pushes a history entry, so Back closes the drawer; a drawer opened from a pasted/refreshed URL is closed by replacing the param.
 * Focus returns to the element that opened the drawer.
 */
const pushed = new Set();
let trigger = null;
const EXTRA = ['act'];

export function useDrawerParam(key) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const value = params.get(key);
  const act = params.get('act');

  const open = useCallback((id, action) => {
    trigger = document.activeElement;
    pushed.add(key);
    const next = new URLSearchParams(params);
    next.set(key, id);
    if (action) next.set('act', action); else next.delete('act');
    setParams(next);
  }, [key, params, setParams]);

  const close = useCallback(() => {
    if (pushed.has(key)) { pushed.delete(key); navigate(-1); } else {
      const next = new URLSearchParams(params);
      next.delete(key);
      EXTRA.forEach((k) => next.delete(k));
      setParams(next, { replace: true });
    }
    const el = trigger;
    trigger = null;
    setTimeout(() => {
      if (!el || !el.isConnected) return;
      const target = el.offsetParent === null ? el.closest('[tabindex]') : el;
      if (target && target.focus) target.focus();
    }, 60);
  }, [key, params, navigate, setParams]);

  return { value, act, open, close };
}
