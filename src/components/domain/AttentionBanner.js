import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, TriangleAlert, CircleCheck, Search } from 'lucide-react';
import { isActiveIncident, isActiveAlert } from '../../state/selectors';
import { fmtRelative, fmtTime } from '../../utils/format';
import { Drawer } from '../ui/Overlay';
import { Button } from '../ui/Controls';
import { StatusBadge } from '../ui/Badges';
import { SEVERITY_TONE } from '../ui/badgeTones';
import { HAZARD_LABEL } from '../../types';
import { stateName } from './common';
import AlertDrawer from './AlertDrawer';
import { useDrawerParam } from '../../state/useDrawerParam';
import { acknowledgeAlert, acknowledgeAttention } from '../../state/actions';
import { useLiveData } from '../../state/LiveDataProvider';

const CAP_LEVEL = { Extreme: 'Critical', Severe: 'High' };

/** Every item needing review: active Critical/High incidents and active Extreme/Severe agency warnings. */
export function attentionItems(incidents, alerts, now) {
  const inc = incidents.filter((i) => isActiveIncident(i) && ['Critical', 'High'].includes(i.severity)).map((i) => ({
    key: `i-${i.id}`, kind: 'incident', id: i.id, level: i.severity, title: i.title, hazard: HAZARD_LABEL[i.hazard],
    location: `${i.district}, ${stateName(i.stateCode)}`, at: i.createdAt, acked: !!i.attentionAck,
  }));
  const al = alerts.filter((a) => isActiveAlert(a, now) && a.classification !== 'Historical' && CAP_LEVEL[a.severity]).map((a) => ({
    key: `a-${a.id}`, kind: 'alert', id: a.id, level: CAP_LEVEL[a.severity], title: a.headline, hazard: HAZARD_LABEL[a.hazard],
    location: a.areaDesc, at: a.sent, acked: !!a.ackAt,
  }));
  return [...inc, ...al];
}

const ackItem = (it) => (it.kind === 'alert' ? acknowledgeAlert(it.id) : acknowledgeAttention(it.id));

/** Right-hand drawer listing all attention items, grouped unacknowledged Critical → unacknowledged High → acknowledged. */
function AttentionDrawer({ items, now, onClose, onOpen }) {
  const navigate = useNavigate();
  const { lastTick } = useLiveData();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [fresh, setFresh] = useState(() => new Set());
  const seen = useRef(null);

  useEffect(() => {
    const keys = new Set(items.map((x) => x.key));
    const prev = seen.current;
    seen.current = keys;
    if (!prev) return undefined;
    const added = new Set([...keys].filter((k) => !prev.has(k)));
    if (!added.size) return undefined;
    setFresh(added);
    const t = setTimeout(() => setFresh(new Set()), 1500);
    return () => clearTimeout(t);
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((x) => (filter === 'All' || x.level === filter)
      && (!q || `${x.title} ${x.hazard} ${x.location} ${x.id}`.toLowerCase().includes(q)));
    const rank = (x) => (x.acked ? 2 : x.level === 'Critical' ? 0 : 1);
    return list.sort((a, b) => rank(a) - rank(b) || (sort === 'new' ? new Date(b.at) - new Date(a.at) : new Date(a.at) - new Date(b.at)));
  }, [items, filter, query, sort]);

  const count = (lvl) => items.filter((x) => x.level === lvl).length;
  const pending = visible.filter((x) => !x.acked);

  return (
    <Drawer open onClose={onClose} title={`Attention required (${items.length})`} subtitle={`Items needing immediate review · updated ${fmtTime(lastTick)}`} width={440}
      footer={<>
        <Button size="sm" disabled={!pending.length} onClick={() => pending.forEach(ackItem)}>Acknowledge all visible</Button>
        <Button size="sm" variant="primary" onClick={() => { onClose(); navigate('/incidents'); }}>Open incident register</Button>
      </>}>
      <div className="bx-attn-tools">
        <div className="bx-seg" role="group" aria-label="Filter by severity">
          {[['All', items.length], ['Critical', count('Critical')], ['High', count('High')]].map(([k, n]) => (
            <button key={k} type="button" className={filter === k ? 'is-active' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{k} {n}</button>
          ))}
        </div>
        <div className="bx-attn-row">
          <label className="bx-attn-search"><Search size={13} strokeWidth={1.5} aria-hidden="true" />
            <input className="bx-input" placeholder="Search…" aria-label="Search attention items" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <select className="bx-select is-compact" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Sort: Newest</option>
            <option value="old">Sort: Oldest</option>
          </select>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="bx-empty">
          <CircleCheck size={22} strokeWidth={1.5} aria-hidden="true" style={{ margin: '0 auto 6px', opacity: 0.6 }} />
          <strong style={{ fontSize: 13 }}>Nothing needs attention right now</strong>
          <span style={{ fontSize: 11 }}>New critical and high items appear here as they arrive.</span>
        </div>
      ) : (
        <ul className="bx-attn-list">
          {visible.map((it) => (
            <li key={it.key} className={`bx-attn-row-item ${fresh.has(it.key) ? 'is-fresh' : ''} ${it.acked ? 'is-acked' : ''}`} onClick={() => onOpen(it)}>
              <div className="bx-attn-l1">
                <span className={`bx-action-dot tone-${it.level === 'Critical' ? 'red' : 'orange'}`} aria-hidden="true" />
                <strong title={it.title}>{it.title}</strong>
                {it.acked ? <StatusBadge tone="slate" label="Acknowledged" /> : <StatusBadge tone={SEVERITY_TONE[it.level]} label={it.level} />}
              </div>
              <div className="bx-attn-l2">{it.hazard} · {it.location} · <span className="bx-mono">{it.id}</span></div>
              <div className="bx-attn-l3">
                <span>{fmtRelative(it.at, now)}</span>
                <span className="bx-attn-actions">
                  {!it.acked && <button type="button" onClick={(e) => { e.stopPropagation(); ackItem(it); }}>Acknowledge</button>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(it); }}>Open ›</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

/**
 * Banner cycling through unacknowledged Critical items. VIEW ALL opens the full list in a drawer (no navigation);
 * clicking the title opens that item's record.
 */
export default function AttentionBanner({ incidents, alerts, now }) {
  const { open: openIncident } = useDrawerParam('incident');
  const [index, setIndex] = useState(0);
  const [list, setList] = useState(false);
  const [alertOpen, setAlertOpen] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());

  const all = useMemo(() => attentionItems(incidents, alerts, now), [incidents, alerts, now]);
  const items = useMemo(() => all.filter((x) => x.level === 'Critical' && !x.acked && !dismissed.has(x.key)).sort((a, b) => new Date(b.at) - new Date(a.at)), [all, dismissed]);

  const openRecord = (it) => {
    setList(false);
    if (it.kind === 'alert') setAlertOpen(it.id); else openIncident(it.id);
  };

  const i = Math.min(index, Math.max(items.length - 1, 0));
  const item = items[i];
  const go = (d) => setIndex((x) => (x + d + items.length) % items.length);

  return (
    <>
      {items.length > 0 && (
        <div className="bx-attention" role="alert">
          <div className="bx-attention-label">
            <TriangleAlert className="bx-icon-warn" size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="bx-attention-text"><span>ATTENTION REQUIRED</span><span className="bx-attention-sub">CRITICAL</span></span>
          </div>
          <div className="bx-attention-main">
            <button type="button" className="bx-attention-title" title={`Open ${item.id}`} onClick={() => openRecord(item)}>{item.title}</button>
            <div className="bx-attention-detail" title={`${item.hazard} · ${item.location} · ${fmtRelative(item.at, now)} · ${item.id}`}>{item.hazard} · {item.location} · {fmtRelative(item.at, now)} · <span className="bx-mono">{item.id}</span></div>
          </div>
          <div className="bx-attention-ctl">
            <span className="bx-mono">{i + 1} / {items.length}</span>
            <button type="button" className="bx-pager-btn" aria-label="Previous critical item" onClick={() => go(-1)} disabled={items.length < 2}><ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" /></button>
            <button type="button" className="bx-pager-btn" aria-label="Next critical item" onClick={() => go(1)} disabled={items.length < 2}><ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" /></button>
            <button type="button" className="bx-btn bx-btn-sm" onClick={() => setList(true)}>VIEW ALL</button>
            <button type="button" className="bx-pager-btn" aria-label="Dismiss" onClick={() => setDismissed((d) => new Set(d).add(item.key))}><X size={14} strokeWidth={1.5} aria-hidden="true" /></button>
          </div>
        </div>
      )}
      {list && <AttentionDrawer items={all} now={now} onClose={() => setList(false)} onOpen={openRecord} />}
      {alertOpen && <AlertDrawer alertId={alertOpen} onClose={() => setAlertOpen(null)} />}
    </>
  );
}
