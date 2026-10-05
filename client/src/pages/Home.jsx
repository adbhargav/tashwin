import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, ChevronLeft, ChevronRight, BadgeIndianRupee, MapPin, ShieldCheck, Truck, Users, Wrench } from 'lucide-react';
import { api, asset } from '../lib/api';
import { SITE } from '../lib/site';
import Slider from '../components/Slider';
import ProductCard from '../components/ProductCard';
import { organizationLd, useSeo } from '../lib/seo';

const POLICIES = [
  [Users, 'Thousands of', 'Happy Customers'], [Award, 'Premium', 'Craftsmanship'], [ShieldCheck, 'Unmatched', '5 Years Warranty'],
  [MapPin, 'Pan India', 'Delivery'], [Wrench, 'Free', 'Installation'], [BadgeIndianRupee, 'Secure', 'Online Payments'],
];
const DIFFERENCES = [
  [Award, 'Built To Win', ['Seasoned frames and tested mechanisms', 'Premium leather, fabric and solid wood', 'Finished by experienced craftsmen']],
  [Wrench, 'Free Installation', ['Assembly by trained professionals', 'No-mess installation at your home or office', 'Demonstration of every feature']],
  [ShieldCheck, '5 Year Warranty', ['Covers frame and mechanism', 'Straightforward claims', 'Dedicated after-sales support']],
  [Truck, 'Safe Delivery', ['Carefully packed, fully insured', 'Doorstep delivery across India', 'Live order tracking from your account']],
];

function PromoStrip({ items }) {
  if (!items.length) return null;
  return (
    <section className="bg-[#fbf5d6]">
      <div className="flex flex-col md:flex-row items-center justify-between md:px-[70px] py-1 md:py-[11px]">
        {items.slice(0, 3).map((b, i) => (
          <div key={b.id} className="flex items-center flex-1 justify-center w-full">
            {i > 0 && <div className="hidden md:block w-px h-12 bg-black/15 mx-2.5" />}
            <Link to={b.link || '/offers'} className="group flex-1 text-center px-3.5 py-2 md:py-0">
              <p className="text-[15px] md:text-[17px] leading-[25.5px] font-bold text-[#111]">{b.title}</p>
              <p className="text-[13px] md:text-[15px] leading-[22.5px] text-[#111] inline-flex items-center gap-1">
                {b.subtitle}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </p>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroSlider({ slides }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count, paused]);
  if (!count) return null;
  const arrow = 'hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white/90 text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform hover:scale-110';
  return (
    <section aria-label="Featured" className="relative overflow-hidden bg-soft aspect-[4/3] sm:aspect-[16/9] lg:aspect-[1920/800]"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((s, n) => (
        <Link key={s.id} to={s.link || '/'} inert={n !== i}
          className={`absolute inset-0 transition-opacity duration-700 ${n === i ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <img src={asset(s.image)} alt={s.title} className={`w-full h-full object-cover transition-transform duration-[6000ms] ease-out ${n === i ? 'scale-105' : 'scale-100'}`} />
          {s.title && (
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex flex-col justify-center px-6 md:px-24 text-white">
              <h2 className="text-3xl md:text-6xl md:leading-[70px] font-medium max-w-2xl">{s.title}</h2>
              <p className="mt-3 md:mt-5 text-base md:text-xl md:leading-7 max-w-lg text-white/90">{s.subtitle}</p>
              <span className="btn btn-primary mt-5 md:mt-8 self-start">Shop Now <ArrowRight size={16} /></span>
            </div>
          )}
        </Link>
      ))}
      {count > 1 && (
        <>
          <button aria-label="Previous slide" onClick={() => setI((i - 1 + count) % count)} className={`${arrow} left-6`}><ChevronLeft size={22} /></button>
          <button aria-label="Next slide" onClick={() => setI((i + 1) % count)} className={`${arrow} right-6`}><ChevronRight size={22} /></button>
          <div className="absolute bottom-3 inset-x-0 z-10 flex justify-center">
            {slides.map((s, n) => (
              <button key={s.id} aria-label={`Slide ${n + 1}`} aria-current={n === i} onClick={() => setI(n)}
                className={`h-2.5 mx-1.5 rounded-full border border-white transition-all duration-300 ${n === i ? 'w-8 bg-white' : 'w-2.5 bg-white/30'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function Home() {
  useSeo({ home: true, jsonLd: organizationLd() });
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('bestSellers');
  useEffect(() => { api('/api/home').then(setData).catch(() => setData({ banners: [], popular: [], offers: [], bestSellers: [], newArrivals: [] })); }, []);
  if (!data) return <div className="min-h-[70vh]" />;
  const by = (placement) => data.banners.filter((b) => b.placement === placement);
  const products = data[tab];

  return (
    <div>
      <HeroSlider slides={by('hero')} />
      <PromoStrip items={by('strip')} />

      <section>
        <h1 className="heading my-10">Top Notch Policies</h1>
        <ul className="flex flex-wrap justify-center mb-[50px]">
          {POLICIES.map(([Icon, a, b]) => (
            <li key={b} className="hvr-bounce w-1/3 md:w-auto text-center px-4 pt-2.5 md:mx-2.5 mb-3">
              <Icon size={40} strokeWidth={1.1} className="mx-auto mb-2.5 text-brand" />
              <p className="leading-[21px]">{a}<br />{b}</p>
            </li>
          ))}
        </ul>
      </section>

      {data.popular.length > 0 && (
        <section className="px-[10px] md:px-[26px]">
          <h2 className="heading mb-[25px]">Popular Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-[11px] gap-y-6 pt-3.5">
            {data.popular.map((c) => (
              <Link key={c.id} to={`/c/${c.slug}`} className="group m-[5px] rounded-lg">
                <div className="overflow-hidden rounded-lg bg-soft aspect-[7/5]">
                  <img src={asset(c.image)} alt={c.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                </div>
                <p className="text-center text-[15.4px] leading-[23px] font-medium pt-[11px] mb-2.5 transition-colors group-hover:text-ink">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.offers.length > 0 && (
        <section className="px-4 md:px-[50px] mt-[25px]">
          <h2 className="heading mb-[25px]">Great Deals on Your Favourites</h2>
          <Slider itemClass="w-[70%] sm:w-1/2 lg:w-1/4">
            {data.offers.map((o) => (
              <Link key={o.id} to={`/offers/${o.slug}`} className="group block p-2">
                <div className="overflow-hidden rounded-[10px] bg-soft aspect-[880/1168]">
                  <img src={asset(o.image)} alt={o.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <h3 className="text-2xl leading-7 text-ink mt-3.5">{o.title}</h3>
                <p className="mt-1">{o.subtitle}</p>
              </Link>
            ))}
          </Slider>
        </section>
      )}

      <section className="px-4 md:px-[50px] mt-[50px]">
        <div className="flex justify-center gap-8 mb-[25px]">
          {[['bestSellers', 'Best Sellers'], ['newArrivals', 'New Arrivals']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`text-2xl md:text-[36px] md:leading-[44px] pb-1 border-b-2 transition-colors ${tab === key ? 'text-ink border-brand' : 'text-mute border-transparent hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <Slider>{products.map((p) => <ProductCard key={p.id} product={p} compact />)}</Slider>
      </section>

      <section className="px-[15px] mt-[50px]">
        <h2 className="heading mb-[25px]">Visit A Tashwin Showroom</h2>
        <div className="grid lg:grid-cols-12 gap-[21px]">
          <div className="lg:col-span-7 overflow-hidden rounded-[5px] bg-soft h-[280px] lg:h-[600px]">
            {by('gallery')[0] && <img src={asset(by('gallery')[0].image)} alt="Tashwin showroom" loading="lazy" className="w-full h-full object-cover" />}
          </div>
          <div className="lg:col-span-5 flex items-center justify-center text-center py-6">
            <div className="max-w-[371px]">
              <h3 className="text-2xl leading-[29px] text-ink mb-3">See, Sit And Feel Before You Buy</h3>
              <p className="font-medium mb-2.5">Up to 50% off on selected products</p>
              <div className="mt-[21px] w-[260px] mx-auto">
                <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="btn btn-outline w-full h-[50px] !p-3 mb-5">Call {SITE.phone}</a>
                <Link to="/support" className="btn btn-outline w-full h-[50px] !p-3">Bulk &amp; Office Orders</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {by('gallery').length > 1 && (
        <section className="mt-2.5">
          <h2 className="heading my-10">See Our Products in Real Life</h2>
          <div className="px-[10px]">
            <Slider itemClass="w-[70%] sm:w-[40%] lg:w-[28.5%]">
              {by('gallery').slice(1).map((g) => (
                <div key={g.id} className="mx-[10.5px] overflow-hidden bg-soft aspect-square">
                  <img src={asset(g.image)} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                </div>
              ))}
            </Slider>
          </div>
        </section>
      )}

      <section className="bg-soft mt-16 px-4 md:px-8 py-10">
        <h2 className="heading mb-8">The Tashwin Differences</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1376px] mx-auto">
          {DIFFERENCES.map(([Icon, title, points]) => (
            <div key={title} className="bg-white rounded-lg p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              <Icon size={44} strokeWidth={1.1} className="text-brand mb-4" />
              <h3 className="text-xl text-ink font-medium mb-4">{title}</h3>
              <ul className="space-y-3 text-base leading-[19px]">{points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
