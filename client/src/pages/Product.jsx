import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronDown, Heart, Minus, Plus, Share2, Truck } from 'lucide-react';
import { api, asset, inr } from '../lib/api';
import { useShop } from '../context/Shop';
import { useShare } from '../lib/share';
import ProductCard from '../components/ProductCard';
import Slider from '../components/Slider';
import { breadcrumbLd, productLd, useSeo } from '../lib/seo';

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!children) return null;
  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full h-14 flex items-center justify-between text-base text-ink font-medium">
        {title}<ChevronDown size={18} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-5 text-[15px] leading-6 whitespace-pre-line">{children}</div>}
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, wishIds, toggleWish } = useShop();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [share, copied] = useShare(data?.product || {});

  useEffect(() => {
    setData(null); setActive(0); setQty(1); setAdded(false); setError('');
    api(`/api/products/${slug}`).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  const seoProduct = data?.product;
  useSeo(error ? { title: 'Product not found', noindex: true } : seoProduct && {
    fullTitle: seoProduct.seo_title,
    title: [seoProduct.name, seoProduct.subtitle].filter(Boolean).join(' – '),
    description: seoProduct.seo_description || seoProduct.description || seoProduct.subtitle,
    image: seoProduct.images[0],
    type: 'product',
    jsonLd: [productLd(seoProduct), breadcrumbLd([...data.breadcrumb.map((c) => ({ name: c.name, path: `/c/${c.slug}` })), { name: seoProduct.name, path: `/product/${seoProduct.slug}` }])],
  });

  if (error) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><p className="text-xl text-ink">{error}</p><Link to="/" className="btn btn-primary">Back to home</Link></div>;
  if (!data) return <div className="min-h-[80vh]" />;
  const { product: p, breadcrumb, related } = data;
  const images = p.images.length ? p.images : [''];
  const soldOut = p.stock <= 0;
  const wished = wishIds.includes(p.id);
  const add = () => { addToCart(p, qty); setAdded(true); };

  return (
    <div>
      <div className="px-4 md:px-8">
        <ol className="flex flex-wrap my-4 leading-[17px]">
          <li><Link to="/" className="text-body/80 hover:text-ink">Furniture</Link></li>
          {breadcrumb.map((b) => <li key={b.slug}><span className="mx-2">/</span><Link to={`/c/${b.slug}`} className="text-body/80 hover:text-ink">{b.name}</Link></li>)}
          <li><span className="mx-2">/</span>{p.name}</li>
        </ol>
        <div className="grid lg:grid-cols-12 gap-[30px]">
          <div className="lg:col-span-8">
            <div className="lg:sticky lg:top-[136px] flex flex-col-reverse md:flex-row gap-[15px]">
              <div className="flex md:flex-col gap-2.5 md:w-[126px] shrink-0 overflow-auto no-scrollbar md:max-h-[751px]">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActive(i)} aria-label={`Image ${i + 1}`}
                    className={`shrink-0 w-20 md:w-full aspect-square rounded-lg overflow-hidden bg-soft border transition-colors ${i === active ? 'border-ink' : 'border-transparent'}`}>
                    {src && <img src={asset(src)} alt="" className="w-full h-full object-cover" />}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 aspect-square rounded-lg overflow-hidden bg-soft">
                {images[active] && <img src={asset(images[active])} alt={p.name} className="w-full h-full object-cover" />}
                {p.tag && <span className="absolute top-3 left-3 rounded px-2 py-2 bg-tag text-white font-medium leading-[17px]">{p.tag}</span>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[28px] leading-9 text-ink font-medium">{p.name}</h1>
              <div className="relative flex gap-2 shrink-0">
                <button onClick={() => toggleWish(p.id)} aria-label="Wishlist" className="w-10 h-10 rounded-full bg-[#f6f6f6] flex items-center justify-center hover:[&>svg]:scale-110">
                  <Heart size={19} className={`transition-transform ${wished ? 'fill-brand text-brand' : 'text-ink'}`} />
                </button>
                <button onClick={share} aria-label="Share this product" className="w-10 h-10 rounded-full bg-[#f6f6f6] flex items-center justify-center hover:[&>svg]:scale-110">
                  {copied ? <Check size={18} className="text-green-700" /> : <Share2 size={18} className="text-ink transition-transform" />}
                </button>
                {copied && <span role="status" className="absolute top-full right-0 mt-1.5 rounded bg-ink text-white text-xs px-2 py-1 whitespace-nowrap">Link copied</span>}
              </div>
            </div>
            <p className="text-base mt-1">{p.subtitle}</p>
            <div className="flex flex-wrap items-baseline gap-x-3 mt-6">
              <span className="text-[26px] leading-[29px] font-medium text-ink">{inr(p.price)}</span>
              {p.mrp > p.price && <del className="text-base">{inr(p.mrp)}</del>}
              {p.discount > 0 && <span className="text-base font-medium text-brand">{p.discount}% off</span>}
            </div>
            {p.dealer_pricing && (
              <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 rounded-lg bg-brand/10 px-3 py-2 text-sm">
                <span className="font-medium text-brand">Your dealer price</span>
                <span className="text-ink">Retail {inr(p.retail_price)}</span>
                {p.retail_price > p.price && <span className="text-green-700 font-medium">You save {inr(p.retail_price - p.price)} ({Math.round((p.retail_price - p.price) * 100 / p.retail_price)}%)</span>}
              </div>
            )}
            <p className="text-xs mt-1">Inclusive of all taxes</p>

            <div className="flex items-center gap-3 bg-soft rounded-lg px-4 py-3 mt-6">
              <Truck size={22} strokeWidth={1.4} className="text-ink" />
              <div><p className="text-ink font-medium">Free Delivery &amp; Installation</p><p className="text-xs">{soldOut ? 'Currently out of stock' : `In stock — ${p.stock} available`}</p></div>
            </div>

            <div className="flex gap-4 mt-5">
              <div className="flex items-center justify-between w-[130px] h-[53px] border border-[#ccc] rounded-full px-2">
                <button aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="p-2 text-ink disabled:opacity-30"><Minus size={16} /></button>
                <span className="text-base text-ink font-medium">{qty}</span>
                <button aria-label="Increase quantity" disabled={qty >= p.stock} onClick={() => setQty(qty + 1)} className="p-2 text-ink disabled:opacity-30"><Plus size={16} /></button>
              </div>
              {added
                ? <button onClick={() => navigate('/cart')} className="btn btn-dark flex-1 h-[53px]">Go to Cart</button>
                : <button onClick={add} disabled={soldOut} className="btn btn-primary flex-1 h-[53px]">{soldOut ? 'Sold Out' : 'Add to Cart'}</button>}
            </div>

            <p className="text-[15px] leading-6 mt-8 mb-4">{p.description}</p>
            <div className="border-t border-line">
              <Accordion title="Product Details" defaultOpen>
                {[p.material && `Material: ${p.material}`, p.color && `Colour: ${p.color}`].filter(Boolean).join('\n')}
              </Accordion>
              <Accordion title="Dimension">{p.dimensions}</Accordion>
              <Accordion title="Material and Care">{p.care}</Accordion>
              <Accordion title="Warranty">{p.warranty}</Accordion>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="px-4 md:px-8 mt-16">
          <h2 className="text-2xl leading-7 font-medium text-ink mb-6">You May Also Like</h2>
          <Slider>{related.map((r) => <ProductCard key={r.id} product={r} compact />)}</Slider>
        </section>
      )}
    </div>
  );
}
