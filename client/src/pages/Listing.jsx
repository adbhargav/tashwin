import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { api, asset, inr } from '../lib/api';
import { breadcrumbLd, useSeo } from '../lib/seo';
import ProductCard from '../components/ProductCard';

const SORTS = [['', 'Recommended'], ['price_asc', 'Price: Low to High'], ['price_desc', 'Price: High to Low'], ['new', 'Newest First'], ['discount', 'Biggest Discount']];

function Dropdown({ label, count, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative inline-flex mx-[3.5px] mb-1">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={`filter-pill ${count ? 'selected' : ''}`}>
        {label}{count > 0 && ` (${count})`}<ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="absolute left-0 top-full mt-2 z-20 min-w-[220px] bg-white rounded-lg shadow-[0_6px_20px_rgba(0,0,0,0.16)] p-4">{children}</div>}
    </div>
  );
}

// One page component backs category pages (/c/:slug), offer pages (/offers/:slug) and search.
export default function Listing({ mode }) {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const query = new URLSearchParams(params);
  if (mode === 'category') query.set('category', slug);
  if (mode === 'offer') query.set('offer', slug);
  const key = query.toString();

  useEffect(() => {
    setError('');
    api(`/api/products?${key}`).then(setData).catch((e) => { setData(null); setError(e.message); });
  }, [key]);

  const set = (name, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    setParams(next, { replace: true });
  };
  const list = (name) => (params.get(name) ? params.get(name).split(',') : []);
  const toggle = (name, v) => {
    const cur = list(name);
    set(name, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(','));
  };

  const seoPage = data?.page;
  const seoName = seoPage?.name || (params.get('q') ? `Search: ${params.get('q')}` : params.get('sort') === 'new' ? 'New Arrivals' : 'All Furniture');
  useSeo(error ? { title: 'Page not found', noindex: true } : data && {
    fullTitle: seoPage?.seo_title,
    title: seoPage?.type === 'category' ? `${seoName} — Buy ${seoName} Online` : seoName,
    description: seoPage?.seo_description || seoPage?.description || `Shop ${seoName} at Tashwin Furniture — ${data.total} designs with free delivery and installation.`,
    image: seoPage?.banner_image || seoPage?.image || data.items[0]?.images?.[0],
    noindex: mode === 'search' && Boolean(params.get('q')),
    jsonLd: seoPage?.type === 'category' ? [breadcrumbLd(seoPage.breadcrumb.map((c) => ({ name: c.name, path: `/c/${c.slug}` })))] : undefined,
  });

  if (error) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><p className="text-xl text-ink">{error}</p><Link to="/" className="btn btn-primary">Back to home</Link></div>;
  if (!data) return <div className="min-h-[70vh]" />;

  const { page, items, facets } = data;
  const title = page?.name || (params.get('q') ? `Results for “${params.get('q')}”` : params.get('sort') === 'new' ? 'New Arrivals' : 'All Furniture');
  const priceCount = (params.get('minPrice') ? 1 : 0) + (params.get('maxPrice') ? 1 : 0);
  const hasFilters = ['material', 'color', 'minPrice', 'maxPrice', 'inStock'].some((k) => params.get(k));

  const checks = (name, options) => options.map((o) => (
    <label key={o} className="flex items-center gap-2.5 py-1.5 cursor-pointer text-ink whitespace-nowrap">
      <input type="checkbox" checked={list(name).includes(o)} onChange={() => toggle(name, o)} className="accent-brand w-4 h-4" />{o}
    </label>
  ));

  return (
    <div>
      {page?.banner_image && (
        <div className="px-[15px] pt-4"><div className="overflow-hidden rounded-lg bg-soft aspect-[3/1] md:aspect-[4/1]">
          <img src={asset(page.banner_image)} alt="" className="w-full h-full object-cover" />
        </div></div>
      )}
      <div className="px-4 xl:px-[42px]">
        <ol className="flex flex-wrap my-4 leading-[17px]">
          <li><Link to="/" className="text-body/80 hover:text-ink">Furniture</Link></li>
          {page?.type === 'offer' && <li><span className="mx-2">/</span><Link to="/offers" className="text-body/80 hover:text-ink">Offers</Link></li>}
          {page?.breadcrumb?.slice(0, -1).map((b) => (
            <li key={b.slug}><span className="mx-2">/</span><Link to={`/c/${b.slug}`} className="text-body/80 hover:text-ink">{b.name}</Link></li>
          ))}
          <li><span className="mx-2">/</span>{title}</li>
        </ol>
        <div className="flex flex-wrap items-baseline gap-x-3 mt-6">
          <h1 className="text-[28px] md:text-[36px] leading-[44px] text-ink">{title}</h1>
          <span className="text-base">({items.length} products)</span>
        </div>
        {page?.description && <p className="mt-2 max-w-3xl text-base leading-6">{page.description}</p>}

        {page?.children?.length > 0 && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar mt-6 pb-1">
            {page.children.map((c) => (
              <Link key={c.id} to={`/c/${c.slug}`} className="group shrink-0 w-[150px] md:w-[210px]">
                <div className="overflow-hidden rounded-lg bg-soft aspect-[7/5]">
                  <img src={asset(c.image)} alt={c.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                </div>
                <p className="text-center text-[15px] font-medium pt-2.5 group-hover:text-ink transition-colors">{c.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="sticky top-[60px] lg:top-[120px] z-20 bg-white px-4 xl:px-[42px] py-3.5 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex flex-wrap items-center">
            <h5 className="text-[11.55px] mr-[5px]">Filter by:</h5>
            {facets.materials.length > 0 && <Dropdown label="Material" count={list('material').length}>{checks('material', facets.materials)}</Dropdown>}
            {facets.colors.length > 0 && <Dropdown label="Colour" count={list('color').length}>{checks('color', facets.colors)}</Dropdown>}
            <Dropdown label="Price" count={priceCount}>
              <p className="text-xs mb-2">{inr(facets.min_price)} – {inr(facets.max_price)}</p>
              <div className="flex items-center gap-2">
                <input type="number" min="0" placeholder="Min" defaultValue={params.get('minPrice') || ''} onBlur={(e) => set('minPrice', e.target.value)} className="field !py-2 w-24" />
                <span>to</span>
                <input type="number" min="0" placeholder="Max" defaultValue={params.get('maxPrice') || ''} onBlur={(e) => set('maxPrice', e.target.value)} className="field !py-2 w-24" />
              </div>
            </Dropdown>
            {hasFilters && <button onClick={() => setParams(params.get('q') ? { q: params.get('q') } : {}, { replace: true })} className="ml-2 text-brand underline">Clear all</button>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={params.get('inStock') === '1'} onChange={(e) => set('inStock', e.target.checked ? '1' : '')} className="accent-brand w-[18px] h-[18px]" />
              Exclude Out of Stock
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[11.55px]">Sort by:</span>
              <select value={params.get('sort') || ''} onChange={(e) => set('sort', e.target.value)} className="filter-pill !pr-3 outline-none cursor-pointer">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="px-2 xl:px-[26px] mt-2">
        {items.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-xl text-ink mb-2">No products found</p>
            <p>Try removing a filter or explore another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-[17px]">
            {items.map((p) => <div key={p.id} className="px-2 xl:px-4"><ProductCard product={p} /></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
