import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { api, asset } from '../lib/api';

const readSize = (file) => new Promise((resolve) => {
  const im = new Image();
  im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
  im.onerror = () => resolve(null);
  im.src = URL.createObjectURL(file);
});

// Image upload with the exact recommended size shown, plus a warning when the chosen file's shape will be cropped.
export function ImageField({ value, onChange, size, multiple = false }) {
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
        const dim = await readSize(file);
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
          Recommended size: <strong>{size.w} × {size.h} px</strong> · JPG, PNG or WebP · max 5 MB<br />{size.note}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {list.map((url, i) => (
          <div key={url + i} className="relative h-24 rounded-md overflow-hidden bg-soft border border-line" style={{ aspectRatio: size ? `${size.w}/${size.h}` : '1' }}>
            <img src={asset(url)} alt="" className="w-full h-full object-cover" />
            <button type="button" aria-label="Remove image" onClick={() => onChange(multiple ? list.filter((_, n) => n !== i) : '')}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={12} /></button>
          </div>
        ))}
        {(multiple || !list.length) && (
          <label className="h-24 w-24 rounded-md border border-dashed border-[#bbb] flex flex-col items-center justify-center gap-1 text-xs cursor-pointer hover:border-brand hover:text-brand">
            <Upload size={18} />{busy ? 'Uploading…' : 'Upload'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={pick} className="hidden" disabled={busy} />
          </label>
        )}
      </div>
      {warn && <p role="status" className="text-xs text-amber-700 mt-2">{warn}</p>}
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function Field({ f, form, setForm, ctx }) {
  const value = form[f.key];
  const set = (v) => setForm({ ...form, [f.key]: v });
  if (f.type === 'image' || f.type === 'images') {
    return <ImageField value={value} onChange={set} multiple={f.type === 'images'} size={typeof f.size === 'function' ? f.size(form) : f.size} />;
  }
  if (f.type === 'checkbox') {
    return <label className="flex items-center gap-2.5 text-ink cursor-pointer"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="accent-brand w-4 h-4" />{f.label}</label>;
  }
  if (f.type === 'select') {
    return (
      <select className="field" value={value ?? ''} onChange={(e) => set(e.target.value)} required={f.required}>
        {!f.required && <option value="">{f.empty || '— None —'}</option>}
        {f.options(ctx, form).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  }
  if (f.type === 'textarea') return <textarea className="field" rows={3} placeholder={f.placeholder} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
  return <input className="field" type={f.type || 'text'} min={f.type === 'number' ? 0 : undefined} required={f.required} placeholder={f.placeholder}
    value={value ?? ''} onChange={(e) => set(e.target.value)} />;
}

// Config-driven list + modal form used for categories, products, offers and banners.
export default function CrudPage({ config }) {
  const { resource, title, fields, columns, defaults, ctxLoad, rows: arrange } = config;
  const [rows, setRows] = useState(null);
  const [ctx, setCtx] = useState({});
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    const [data, extra] = await Promise.all([api(`/api/admin/${resource}`), ctxLoad ? ctxLoad() : {}]);
    setCtx({ ...extra, rows: data });
    setRows(data);
  };
  useEffect(() => { setRows(null); setForm(null); setFilter(''); load().catch((e) => setError(e.message)); }, [resource]);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/api/admin/${resource}${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', body: form });
      setForm(null);
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(row) {
    if (!confirm(`Delete “${row.name || row.title || `#${row.id}`}”? This cannot be undone.`)) return;
    try { await api(`/api/admin/${resource}/${row.id}`, { method: 'DELETE' }); await load(); } catch (err) { alert(err.message); }
  }

  if (!rows) return <p>{error || 'Loading…'}</p>;
  const shown = (arrange ? arrange(rows) : rows).filter((r) => !filter || JSON.stringify(Object.values(r)).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl text-ink font-medium">{title} <span className="text-base font-normal text-body">({rows.length})</span></h1>
        <div className="flex gap-3">
          <input className="field !py-2 w-52" placeholder="Search…" aria-label="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button onClick={() => { setError(''); setForm({ ...defaults }); }} className="btn btn-primary !py-2.5"><Plus size={16} />Add New</button>
        </div>
      </div>
      {config.help && <p className="mb-4 max-w-3xl">{config.help}</p>}
      <div className="bg-white rounded-lg border border-line overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-line text-xs uppercase text-mute">
            {columns.map((c) => <th key={c.label} className="px-4 py-3 font-medium">{c.label}</th>)}<th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0 hover:bg-soft">
                {columns.map((c) => <td key={c.label} className="px-4 py-2.5 text-ink">{c.render(row, ctx)}</td>)}
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <button aria-label="Edit" onClick={() => { setError(''); setForm({ ...defaults, ...row }); }} className="p-2 hover:text-brand"><Pencil size={16} /></button>
                  <button aria-label="Delete" onClick={() => remove(row)} className="p-2 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true">
          <form onSubmit={save} className="bg-white rounded-xl w-full max-w-2xl my-8 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl text-ink font-medium">{form.id ? 'Edit' : 'Add'} {config.singular}</h2>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="p-1"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.filter((f) => !f.show || f.show(form)).map((f) => (
                <div key={f.key} className={f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
                  {f.type !== 'checkbox' && <span className="label">{f.label}{f.required && ' *'}</span>}
                  <Field f={f} form={form} setForm={setForm} ctx={ctx} />
                  {(f.hint || f.count) && (
                    <p className="text-xs mt-1">
                      {f.hint}{f.count && <span className={(form[f.key] || '').length > f.count ? 'text-amber-700' : ''}> {(form[f.key] || '').length} / {f.count} characters{(form[f.key] || '').length > f.count && ' — Google will cut this short'}</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {error && <p role="alert" className="text-red-600 mt-4">{error}</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setForm(null)} className="btn btn-outline !py-2.5">Cancel</button>
              <button disabled={busy} className="btn btn-primary !py-2.5">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
