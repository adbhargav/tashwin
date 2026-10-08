import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { DataTable, Dropdown, EmptyState, ExportButton, FilterSelect, PageHeader, SearchBox, Toggle, exportCsv, matches, useToast } from './ui';
import { api, asset, inr } from '../lib/api';

const readSize = (file) => new Promise((resolve) => {
  const im = new Image();
  im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
  im.onerror = () => resolve(null);
  im.src = URL.createObjectURL(file);
});

// Image upload with the exact recommended size shown, plus a warning when the chosen file's shape will be cropped.
export function ImageField({ value, onChange, size, multiple = false, video = false }) {
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');
  const [error, setError] = useState('');
  const list = multiple ? value || [] : value ? [value] : [];

  async function pick(e) {
    const files = [...e.target.files];
    e.target.value = '';
    setBusy(true); setWarn(''); setError('');
    try {
      const urls = [];
      for (const file of files) {
        const dim = video ? null : await readSize(file);
        if (dim && size) {
          if (Math.abs(dim.w / dim.h - size.w / size.h) > 0.03) setWarn(`“${file.name}” is ${dim.w} × ${dim.h} px — a different shape from ${size.w} × ${size.h}, so it will be cropped to fit.`);
          else if (dim.w < size.w * 0.7) setWarn(`“${file.name}” is ${dim.w} × ${dim.h} px — smaller than recommended, so it may look blurry.`);
        }
        const form = new FormData();
        form.append('file', file);
        urls.push((await api('/api/admin/upload', { method: 'POST', form })).url);
      }
      onChange(multiple ? [...list, ...urls] : urls[0]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div>
      {size && (
        <p className="text-xs bg-[#fff4ea] text-[#8a4a12] rounded px-2.5 py-1.5 mb-2">
          Recommended size: <strong>{size.w} × {size.h} px</strong> · JPG, PNG or WebP · max 8 MB<br />{size.note}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {list.map((url, i) => (
          <div key={url + i} className="relative h-24 rounded-md overflow-hidden bg-soft border border-line" style={{ aspectRatio: size ? `${size.w}/${size.h}` : '1' }}>
            {video || /\.(mp4|webm|mov)(\?|$)/i.test(url) ? <video src={asset(url)} muted className="w-full h-full object-cover" /> : <img src={asset(url)} alt="" className="w-full h-full object-cover" />}
            <button type="button" aria-label="Remove image" onClick={() => onChange(multiple ? list.filter((_, n) => n !== i) : '')}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={12} /></button>
          </div>
        ))}
        {(multiple || !list.length) && (
          <label className="h-24 w-24 rounded-md border border-dashed border-[#bbb] flex flex-col items-center justify-center gap-1 text-xs cursor-pointer hover:border-brand hover:text-brand">
            <Upload size={18} />{busy ? 'Uploading…' : 'Upload'}
            <input type="file" accept={video ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp'} multiple={multiple} onChange={pick} className="hidden" disabled={busy} />
          </label>
        )}
      </div>
      {warn && <p role="status" className="text-xs text-amber-700 mt-2">{warn}</p>}
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

// Search-and-add list of products, kept in the admin's order (used by offers).
function ProductPicker({ value = [], onChange, products = [] }) {
  const [query, setQuery] = useState('');
  const ids = value.map(Number);
  const byId = (id) => products.find((p) => p.id === id);
  const results = query.trim() ? products.filter((p) => !ids.includes(p.id) && `${p.name} ${p.subtitle}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  const move = (i, d) => { const next = [...ids]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); onChange(next); };
  return (
    <div className="rounded-lg border border-line">
      <label className="relative block border-b border-line">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input className="w-full py-2.5 pl-9 pr-3 text-sm text-ink rounded-t-lg focus:outline-none" placeholder="Search products by name to add them…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {results.length > 0 && (
        <ul className="border-b border-line bg-soft/60 max-h-72 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded bg-white overflow-hidden shrink-0">{p.images[0] && <img src={asset(p.images[0])} alt="" className="w-full h-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><p className="text-sm text-ink truncate">{p.name}</p><p className="text-xs truncate">{p.subtitle} · {inr(p.price)}{!p.active && ' · inactive'}</p></div>
              <button type="button" onClick={() => { onChange([...ids, p.id]); setQuery(''); }} className="btn btn-outline !py-1 !px-3 text-xs"><Plus size={13} />Add</button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && !results.length && <p className="px-3 py-3 text-sm border-b border-line">No products match “{query}”.</p>}
      {ids.length ? (
        <ol>
          {ids.map((id, i) => { const p = byId(id); return (
            <li key={id} className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-0">
              <span className="w-5 text-xs text-mute text-right">{i + 1}</span>
              <div className="w-9 h-9 rounded bg-soft overflow-hidden shrink-0">{p?.images[0] && <img src={asset(p.images[0])} alt="" className="w-full h-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><p className="text-sm text-ink truncate">{p?.name || `Product #${id} (deleted)`}</p>{p && <p className="text-xs truncate">{p.subtitle} · {inr(p.price)}{p.mrp > p.price && ` · ${Math.round((p.mrp - p.price) * 100 / p.mrp)}% off`}</p>}</div>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 hover:text-ink disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" aria-label="Move down" disabled={i === ids.length - 1} onClick={() => move(i, 1)} className="p-1.5 hover:text-ink disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" aria-label="Remove" onClick={() => onChange(ids.filter((x) => x !== id))} className="p-1.5 hover:text-red-600"><X size={15} /></button>
            </li>
          ); })}
        </ol>
      ) : <p className="px-3 py-4 text-sm text-center">No products picked yet — search above to add some.</p>}
    </div>
  );
}

function Field({ f, form, setForm, ctx }) {
  const value = form[f.key];
  const set = (v) => setForm({ ...form, [f.key]: v });
  if (f.type === 'checks') {
    const opts = f.options(ctx, form);
    const picked = (value || []).map(Number);
    if (!opts.length) return <p className="text-sm">{f.emptyText || 'Nothing to choose from yet.'}</p>;
    return (
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-line p-4">
        {opts.map(([v, l, note]) => (
          <label key={v} className="flex items-center gap-2.5 text-ink cursor-pointer">
            <input type="checkbox" className="accent-brand w-4 h-4" checked={picked.includes(Number(v))} onChange={(e) => set(e.target.checked ? [...picked, Number(v)] : picked.filter((x) => x !== Number(v)))} />
            <span className="truncate">{l}</span>{note && <span className="text-xs text-mute">({note})</span>}
          </label>
        ))}
      </div>
    );
  }
  if (f.type === 'products') return <ProductPicker value={value || []} onChange={set} products={ctx.products || []} />;
  if (f.type === 'video') {
    // Either an uploaded file or a pasted YouTube link.
    return (
      <div className="space-y-2">
        <ImageField value={value && !/youtu/.test(value) ? value : ''} onChange={set} video />
        <input className="field" placeholder="…or paste a YouTube link" value={/youtu/.test(value || '') ? value : ''} onChange={(e) => set(e.target.value)} />
      </div>
    );
  }
  if (f.type === 'image' || f.type === 'images') {
    return <ImageField value={value} onChange={set} multiple={f.type === 'images'} size={typeof f.size === 'function' ? f.size(form) : f.size} />;
  }
  if (f.type === 'checkbox') {
    return <label className="flex items-center gap-2.5 text-ink cursor-pointer"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="accent-brand w-4 h-4" />{f.label}</label>;
  }
  if (f.type === 'select') {
    const opts = f.options(ctx, form).filter(([v]) => v !== '');
    return <Dropdown className="w-full" value={value ?? ''} onChange={set} required={f.required} label={f.label} creatable={f.creatable}
      options={f.required ? opts : [['', f.empty || '— None —'], ...opts]} placeholder={f.required ? 'Select…' : f.empty || '— None —'} />;
  }
  if (f.type === 'textarea') return <textarea className="field" rows={3} placeholder={f.placeholder} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
  return <input className="field" type={f.type || 'text'} min={f.type === 'number' ? 0 : undefined} required={f.required} placeholder={f.placeholder}
    value={value ?? ''} onChange={(e) => set(e.target.value)} />;
}

// Config-driven list + modal form used for categories, products, offers and banners.
// Each config supplies columns, form fields, optional filters and the CSV columns; this page adds search,
// sorting, paging, bulk actions, inline active switches and export on top.
export default function CrudPage({ config }) {
  const { resource, title, singular, fields, columns, defaults, ctxLoad, rows: arrange, decorate, filters = [], csv, help } = config;
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [ctx, setCtx] = useState({});
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  // Dashboard links open a pre-filtered view, e.g. /admin/products?stock=out.
  const { search: query } = useLocation();
  const [filterValues, setFilterValues] = useState(() => Object.fromEntries(filters.map((f) => [f.key, new URLSearchParams(query).get(f.key) || ''])));
  const [selected, setSelected] = useState([]);

  const load = async () => {
    const [data, extra] = await Promise.all([api(`/api/admin/${resource}`), ctxLoad ? ctxLoad() : {}]);
    setCtx({ ...extra, rows: data });
    setRows(data);
    setSelected([]);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, [resource]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const base = (arrange ? arrange(rows) : rows).map((r) => r);
    const decorated = decorate ? decorate(base, ctx) : base;
    return decorated.filter((r) => matches(r, search) && filters.every((f) => !filterValues[f.key] || f.test(r, filterValues[f.key], ctx)));
  }, [rows, search, filterValues, arrange, filters, ctx]);

  const run = async (fn, done) => {
    try { await fn(); await load(); if (done) toast(done); } catch (e) { toast(e.message, 'error'); }
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/api/admin/${resource}${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', body: form });
      setForm(null);
      await load();
      toast(`${singular} ${form.id ? 'updated' : 'added'}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const remove = (row) => {
    if (!confirm(`Delete “${row.name || row.title || `#${row.id}`}”? This cannot be undone.`)) return;
    run(() => api(`/api/admin/${resource}/${row.id}`, { method: 'DELETE' }), `${singular} deleted`);
  };
  const setActive = (row, active) => run(() => api(`/api/admin/${resource}/${row.id}`, { method: 'PUT', body: { ...row, active } }));
  const bulk = (active) => run(() => api(`/api/admin/${resource}/bulk`, { method: 'PATCH', body: { ids: selected, active } }), `${selected.length} ${active ? 'activated' : 'deactivated'}`);
  const bulkDelete = () => {
    if (!confirm(`Delete ${selected.length} selected ${selected.length === 1 ? singular.toLowerCase() : title.toLowerCase()}? This cannot be undone.`)) return;
    run(() => api(`/api/admin/${resource}/bulk-delete`, { method: 'POST', body: { ids: selected } }), `${selected.length} deleted`);
  };
  const duplicate = (row) => {
    const { id: _id, created_at: _created, ...copy } = row;
    setError('');
    setForm({ ...defaults, ...copy, name: copy.name ? `${copy.name} (copy)` : copy.name, title: copy.title ? `${copy.title} (copy)` : copy.title, slug: '', active: false });
  };
  const doExport = () => exportCsv(resource, csv || fields.filter((f) => !['image', 'images'].includes(f.type)).map((f) => ({ label: f.label, value: f.key })), shown);

  const hasActive = 'active' in defaults;
  const tableColumns = [
    ...columns,
    ...(hasActive ? [{ key: 'active', label: 'Active', width: 70, sort: (r) => (r.active ? 1 : 0), render: (r) => <Toggle on={r.active} onChange={(v) => setActive(r, v)} label={`${r.name || r.title} active`} /> }] : []),
  ];
  const activeFilters = Object.values(filterValues).filter(Boolean).length;

  return (
    <div>
      <PageHeader title={title} count={rows?.length} description={help}>
        <ExportButton onClick={doExport} disabled={!shown.length} />
        <button onClick={() => { setError(''); setForm({ ...defaults }); }} className="btn btn-primary !py-2 !px-4 text-sm"><Plus size={16} />Add {singular}</button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SearchBox value={search} onChange={setSearch} placeholder={`Search ${title.toLowerCase()}…`} />
        {filters.map((f) => (
          <FilterSelect key={f.key} label={f.label} value={filterValues[f.key] || ''} onChange={(v) => setFilterValues({ ...filterValues, [f.key]: v })}
            options={[['', f.label], ...(typeof f.options === 'function' ? f.options(ctx) : f.options)]} />
        ))}
        {(search || activeFilters > 0) && <button onClick={() => { setSearch(''); setFilterValues({}); }} className="text-sm text-brand hover:underline">Clear</button>}
        <span className="ml-auto text-sm">{shown.length} of {rows?.length ?? 0}</span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 rounded-lg bg-[#222] text-white px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          {hasActive && <><button onClick={() => bulk(true)} className="ml-3 rounded-md bg-white/10 px-3 py-1 hover:bg-white/20">Activate</button>
            <button onClick={() => bulk(false)} className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20">Deactivate</button></>}
          <button onClick={bulkDelete} className="rounded-md bg-red-500/80 px-3 py-1 hover:bg-red-500">Delete</button>
          <button onClick={() => setSelected([])} className="ml-auto opacity-70 hover:opacity-100">Clear selection</button>
        </div>
      )}

      {error && !form && <p role="alert" className="text-red-600 mb-3">{error}</p>}
      <DataTable columns={tableColumns} rows={shown} loading={!rows} selectable selected={selected} onSelect={setSelected}
        onRowClick={(row) => { setError(''); setForm({ ...defaults, ...row }); }}
        empty={<EmptyState title={search || activeFilters ? 'No matches' : `No ${title.toLowerCase()} yet`} hint={search || activeFilters ? 'Try a different search or clear the filters.' : `Click “Add ${singular}” to create the first one.`} />}
        actions={(row) => (
          <>
            <button aria-label="Edit" title="Edit" onClick={() => { setError(''); setForm({ ...defaults, ...row }); }} className="p-1.5 hover:text-brand"><Pencil size={15} /></button>
            <button aria-label="Duplicate" title="Duplicate" onClick={() => duplicate(row)} className="p-1.5 hover:text-brand"><Copy size={15} /></button>
            <button aria-label="Delete" title="Delete" onClick={() => remove(row)} className="p-1.5 hover:text-red-600"><Trash2 size={15} /></button>
          </>
        )} />

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <form onSubmit={save} className="bg-white rounded-xl w-full max-w-2xl my-8 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl text-ink font-medium">{form.id ? 'Edit' : 'Add'} {singular}</h2>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="p-1"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.filter((f) => !f.show || f.show(form)).map((f) => (
                f.section ? <h3 key={f.section} className="col-span-2 text-xs uppercase tracking-wider text-mute pt-3 border-t border-line">{f.section}</h3> : (
                  <div key={f.key} className={f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
                    {f.type !== 'checkbox' && <span className="label">{f.label}{f.required && ' *'}</span>}
                    <Field f={f} form={form} setForm={setForm} ctx={ctx} />
                    {(f.hint || f.count) && (
                      <p className="text-xs mt-1">
                        {f.hint}{f.count && <span className={(form[f.key] || '').length > f.count ? 'text-amber-700' : ''}> {(form[f.key] || '').length} / {f.count} characters{(form[f.key] || '').length > f.count && ' — Google will cut this short'}</span>}
                      </p>
                    )}
                  </div>
                )
              ))}
            </div>
            {error && <p role="alert" className="text-red-600 mt-4">{error}</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setForm(null)} className="btn btn-outline !py-2.5">Cancel</button>
              <button disabled={busy} className="btn btn-primary !py-2.5">{busy ? 'Saving…' : form.id ? 'Save changes' : `Add ${singular}`}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
