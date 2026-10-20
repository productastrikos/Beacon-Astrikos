import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, Search, Download } from 'lucide-react';
import { EmptyState } from '../ui/Layout';
import { Button } from '../ui/Controls';
import { toCsv, downloadText } from '../../utils/format';

/**
 * Compact, searchable, sortable, paginated table.
 * columns: [{ id, header, accessor(row) → primitive (sort/search/CSV),
 *             cell?(row) → node, num?, wrap?, sortValue?(row), sortable? }]
 */
export default function DataTable({
  columns, rows, rowKey = 'id', onRowClick, selectedKey, searchable = true, searchPlaceholder = 'Search…',
  filters, pageSize = 10, defaultSort, emptyTitle = 'No records match the current filters', emptyHint,
  exportName, caption, toolbarExtra, dense, rowSignature, initialQuery = '', hidePagerWhenFits, maxHeight,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(defaultSort || null);
  const [page, setPage] = useState(0);
  const [flash, setFlash] = useState(() => new Set());
  const seen = useRef(null);
  const keyOf = (r) => (typeof rowKey === 'function' ? rowKey(r) : r[rowKey]);
  const sigOf = rowSignature || ((r) => r.updatedAt || null);

  // Highlight rows that are new or changed since the previous render (live updates), then fade after 1.5 s.
  useEffect(() => {
    const next = new Map(rows.map((r) => [keyOf(r), sigOf(r)]));
    const prev = seen.current;
    seen.current = next;
    if (!prev) return undefined;
    const changed = new Set();
    next.forEach((sig, k) => { if (!prev.has(k) || (sig !== null && prev.get(k) !== sig)) changed.add(k); });
    if (!changed.size) return undefined;
    setFlash(changed);
    const t = setTimeout(() => setFlash(new Set()), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => String(c.accessor ? c.accessor(r) ?? '' : '').toLowerCase().includes(q)));
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return filtered;
    const val = (r) => (col.sortValue ? col.sortValue(r) : col.accessor(r));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = val(a); const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > pages - 1) setPage(0); }, [pages, page]);
  useEffect(() => { setPage(0); }, [query, rows.length]);
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (id) => setSort((cur) => {
    if (!cur || cur.id !== id) return { id, dir: 'asc' };
    if (cur.dir === 'asc') return { id, dir: 'desc' };
    return null;
  });

  const exportCsv = () => {
    const cols = columns.filter((c) => c.accessor).map((c) => ({ header: c.header, value: (r) => c.accessor(r) }));
    downloadText(`${exportName}.csv`, toCsv(sorted, cols));
  };

  return (
    <div>
      {(searchable || filters || exportName || toolbarExtra) && (
        <div className="bx-toolbar">
          {searchable && (
            <div className="bx-field bx-search">
              <label className="bx-label" htmlFor={`search-${caption || 'tbl'}`}>Search</label>
              <div style={{ position: 'relative' }}>
                <Search size={13} aria-hidden="true" style={{ position: 'absolute', left: 8, top: 8, color: 'var(--app-text-faint)' }} />
                <input id={`search-${caption || 'tbl'}`} className="bx-input" style={{ paddingLeft: 26 }} placeholder={searchPlaceholder}
                  value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
          )}
          {filters}
          <div style={{ flex: 1 }} />
          {toolbarExtra}
          {exportName && <Button size="sm" icon={Download} onClick={exportCsv} disabled={!sorted.length}>Export CSV</Button>}
        </div>
      )}
      <div className="bx-table-wrap" style={maxHeight ? { maxHeight } : undefined}>
        <table className="bx-table" style={dense ? { fontSize: 11.5 } : undefined}>
          {caption && <caption className="bx-sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort && sort.id === c.id;
                const canSort = c.sortable !== false && c.accessor;
                return (
                  <th key={c.id} className={c.num ? 'is-num' : ''} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {canSort ? (
                      <button type="button" onClick={() => toggleSort(c.id)}>
                        {c.header}
                        {active ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const key = typeof rowKey === 'function' ? rowKey(r) : r[rowKey];
              return (
                <tr key={key}
                  className={`${onRowClick ? 'is-clickable' : ''} ${selectedKey != null && selectedKey === key ? 'is-selected' : ''} ${flash.has(key) ? 'is-flash' : ''}`}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}>
                  {columns.map((c) => (
                    <td key={c.id} className={`${c.num ? 'is-num' : ''} bx-cell`} title={c.accessor && typeof c.accessor(r) === 'string' ? c.accessor(r) : undefined}>
                      {c.cell ? c.cell(r) : (c.accessor ? c.accessor(r) ?? '—' : null)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!view.length && <EmptyState title={emptyTitle} hint={emptyHint} />}
      </div>
      {sorted.length > 0 && !(hidePagerWhenFits && sorted.length <= pageSize) && (
        <div className="bx-pager">
          <span>Showing {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length} record{sorted.length === 1 ? '' : 's'}</span>
          {sorted.length > pageSize && (
            <span className="bx-row">
              <button type="button" className="bx-pager-btn" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
              <span>Page {page + 1} / {pages}</span>
              <button type="button" className="bx-pager-btn" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
