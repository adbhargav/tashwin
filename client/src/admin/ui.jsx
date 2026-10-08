import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Search, X, XCircle } from 'lucide-react';

// Shared building blocks for the admin panel: toasts, page headers, toolbar controls, the data table and CSV export.

/* ---------- Toasts ---------- */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (message, kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-start gap-2.5 rounded-lg px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)] text-white text-sm ${t.kind === 'error' ? 'bg-red-600' : 'bg-[#222]'}`}>
            {t.kind === 'error' ? <XCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-green-400" />}
            <span>{t.message}</span>
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="ml-auto opacity-70 hover:opacity-100"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Layout pieces ---------- */
export function PageHeader({ title, count, description, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-[22px] leading-7 text-ink font-medium">{title}{count != null && <span className="ml-2 text-base font-normal text-body">({count})</span>}</h1>
        {description && <p className="mt-1 max-w-2xl">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export const Card = ({ title, action, className = '', children }) => (
  <section className={`bg-white rounded-xl border border-line ${className}`}>
    {(title || action) && <div className="flex items-center justify-between px-5 pt-4 pb-3"><h2 className="text-[15px] text-ink font-medium">{title}</h2>{action}</div>}
    {children}
  </section>
);

export const EmptyState = ({ title = 'Nothing here yet', hint }) => (
  <div className="px-4 py-14 text-center"><p className="text-ink font-medium">{title}</p>{hint && <p className="text-sm mt-1">{hint}</p>}</div>
);

export const Skeleton = ({ rows = 6 }) => (
  <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 rounded bg-soft" />)}</div>
);

export const Toggle = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-[#ccc]'}`}>
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);

export const Pill = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-700', green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-800', indigo: 'bg-indigo-100 text-indigo-800', purple: 'bg-purple-100 text-purple-800', brand: 'bg-brand/10 text-brand',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap ${tones[tone]}`}>{children}</span>;
};

/* ---------- Toolbar controls ---------- */
export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  return (
    <label className="relative block">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
      <input className="field !py-2 !pl-9 w-60" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mute hover:text-ink"><X size={14} /></button>}
    </label>
  );
}

/* ---------- Dropdown ---------- */
// Styled replacement for <select>. options: [value, label, depth?]; depth indents nested choices (category trees).
// The panel is position: fixed so it is never clipped by a scrolling table, and it flips upward near the bottom edge.
// `creatable` lets the user type a value that is not in the list and add it on the spot.
export function Dropdown({ value, onChange, options, label, placeholder, clearable, required, disabled, creatable, size = 'md', className = '', align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const panel = useRef(null);
  const current = options.find((o) => String(o[0]) === String(value ?? '')) || (creatable && value ? [value, value] : undefined);
  const searchable = creatable || options.length > 8;
  const canCreate = creatable && query.trim() && !options.some((o) => o[1].toLowerCase() === query.trim().toLowerCase());
  const shown = query ? options.filter((o) => o[1].toLowerCase().includes(query.toLowerCase())) : options;

  useLayoutEffect(() => {
    if (!open) return;
    const r = btn.current.getBoundingClientRect();
    const height = Math.min(360, 48 + shown.length * 36 + (searchable ? 48 : 0));
    const below = window.innerHeight - r.bottom;
    setPos({ left: align === 'right' ? undefined : r.left, right: align === 'right' ? window.innerWidth - r.right : undefined, width: Math.max(r.width, 220),
      top: below < height && r.top > below ? undefined : r.bottom + 4, bottom: below < height && r.top > below ? window.innerHeight - r.top + 4 : undefined });
  }, [open, shown.length, searchable, align]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!panel.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    // The page (or a dialog) scrolling moves the button away from the fixed panel, so close; scrolling the list itself is fine.
    const scroll = (e) => { if (!panel.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', key); window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const pick = (v) => { onChange(v); setOpen(false); };
  const pad = size === 'sm' ? 'py-1.5 pl-3 pr-2 text-[13px]' : 'py-2 pl-3.5 pr-2.5 text-sm';
  return (
    <div className={`relative inline-block ${className}`}>
      {/* Keeps native "please fill out this field" validation working inside forms. */}
      {required && <input tabIndex={-1} aria-hidden className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" required value={value ?? ''} onChange={() => {}} />}
      <button ref={btn} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}
        className={`w-full inline-flex items-center gap-2 rounded-md border bg-white text-left transition-colors disabled:opacity-50 ${pad} ${open ? 'border-brand ring-2 ring-brand/15' : current && clearable ? 'border-ink/60' : 'border-[#d9d9d9] hover:border-[#bbb]'}`}>
        <span className={`flex-1 truncate ${current ? 'text-ink' : 'text-body'}`}>{current ? current[1] : placeholder || label}</span>
        {clearable && current ? <span role="button" aria-label="Clear" onClick={(e) => { e.stopPropagation(); pick(''); }} className="text-mute hover:text-ink"><X size={14} /></span>
          : <ChevronDown size={15} className={`text-mute transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && pos && (
        <div ref={panel} role="listbox" style={pos} className="fixed z-[70] bg-white rounded-lg border border-line shadow-[0_12px_40px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col max-h-[360px]">
          {searchable && (
            <div className="p-2 border-b border-line">
              <label className="relative block"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
                <input autoFocus className="w-full rounded-md border border-[#e3e3e3] py-1.5 pl-8 pr-2 text-sm text-ink focus:border-brand focus:outline-none" placeholder={creatable ? 'Type to filter or add new…' : 'Type to filter…'} value={query}
                  onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); pick(query.trim()); } }} /></label>
            </div>
          )}
          <ul className="overflow-y-auto py-1">
            {shown.map(([v, l, depth = 0]) => {
              const selected = String(v) === String(value ?? '');
              return (
                <li key={v}>
                  <button type="button" role="option" aria-selected={selected} onClick={() => pick(v)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-soft ${selected ? 'text-brand font-medium' : depth === 0 && options.some((o) => o[2] > 0) ? 'text-ink font-medium' : 'text-ink'}`}
                    style={{ paddingLeft: 12 + depth * 16 }}>
                    <span className="flex-1 truncate">{l}</span>{selected && <Check size={15} />}
                  </button>
                </li>
              );
            })}
            {canCreate && (
              <li><button type="button" onClick={() => pick(query.trim())} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-brand font-medium hover:bg-soft border-t border-line"><Plus size={15} />Add “{query.trim()}”</button></li>
            )}
            {!shown.length && !canCreate && <li className="px-3 py-6 text-center text-sm">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// Toolbar filter: the first option is the "all" choice and doubles as the button label.
export const FilterSelect = ({ value, onChange, options, label }) => {
  const [[allValue, allLabel], ...rest] = options;
  return <Dropdown value={value === allValue ? '' : value} onChange={(v) => onChange(v === '' ? allValue : v)} options={rest} label={label} placeholder={allLabel} clearable />;
};

export const ExportButton = ({ onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="btn btn-outline !py-2 !px-4 text-sm"><Download size={15} />Export CSV</button>
);

/* ---------- CSV ---------- */
export function exportCsv(filename, columns, rows) {
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))];
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${filename}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Data table ---------- */
// columns: [{ key, label, render(row), sort(row) -> comparable, align: 'right', width }]
// Sorting, paging and selection are handled here; the caller passes already-filtered rows.
export function DataTable({ columns, rows, rowKey = (r) => r.id, onRowClick, selectable, selected, onSelect, pageSize = 25, defaultSort, loading, empty, actions }) {
  const [sort, setSort] = useState(defaultSort || null); // { key, dir }
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [rows.length, sort?.key, sort?.dir]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const get = col?.sort || ((r) => r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const cmp = x == null ? 1 : y == null ? -1 : typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const shown = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const allShownSelected = selectable && shown.length > 0 && shown.every((r) => selected.includes(rowKey(r)));
  const toggleAll = () => onSelect(allShownSelected ? selected.filter((id) => !shown.some((r) => rowKey(r) === id)) : [...new Set([...selected, ...shown.map(rowKey)])]);
  const toggleSort = (key) => setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));

  return (
    <div className="bg-white rounded-xl border border-line">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-mute">
              {selectable && <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all on this page" className="accent-brand w-4 h-4" checked={allShownSelected} onChange={toggleAll} /></th>}
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={`px-3 py-3 font-medium whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.sort || c.sortable !== false && c.key in (rows[0] || {}) ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 hover:text-ink ${sort?.key === c.key ? 'text-ink' : ''}`}>
                      {c.label}{sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-50" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={columns.length + 2}><Skeleton /></td></tr>
              : shown.length === 0 ? <tr><td colSpan={columns.length + 2}>{empty || <EmptyState />}</td></tr>
              : shown.map((row) => {
                const id = rowKey(row);
                return (
                  <tr key={id} onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-line last:border-0 ${onRowClick ? 'cursor-pointer' : ''} ${selected?.includes(id) ? 'bg-brand/5' : 'hover:bg-soft'}`}>
                    {selectable && <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select row ${id}`} className="accent-brand w-4 h-4" checked={selected.includes(id)} onChange={() => onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])} /></td>}
                    {columns.map((c) => <td key={c.key} className={`px-3 py-2.5 text-ink align-middle ${c.align === 'right' ? 'text-right' : ''} ${c.nowrap === false ? '' : 'whitespace-nowrap'}`}>{c.render ? c.render(row) : row[c.key]}</td>)}
                    {actions && <td className="px-2 py-2.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>{actions(row)}</td>}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm">
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" className="p-1.5 rounded hover:bg-soft disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="px-2">Page {page + 1} of {pages}</span>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page" className="p-1.5 rounded hover:bg-soft disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Formatting ---------- */
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const compact = (n) => (n >= 1e7 ? `₹ ${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹ ${(n / 1e5).toFixed(2)} L` : `₹ ${Number(n || 0).toLocaleString('en-IN')}`);
export const matches = (row, text) => !text || JSON.stringify(Object.values(row)).toLowerCase().includes(text.toLowerCase());
