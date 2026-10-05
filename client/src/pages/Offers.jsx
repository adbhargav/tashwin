import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, asset } from '../lib/api';
import { useSeo } from '../lib/seo';

export default function Offers() {
  useSeo({ title: 'Furniture Offers & Deals', description: 'Current offers and discounts on sofas, beds, dining and office furniture at Tashwin Furniture.' });
  const [offers, setOffers] = useState(null);
  useEffect(() => { api('/api/offers').then(setOffers).catch(() => setOffers([])); }, []);
  if (!offers) return <div className="min-h-[70vh]" />;
  return (
    <div className="px-4 md:px-[50px]">
      <h1 className="heading my-10">Offers</h1>
      {offers.length === 0 && <p className="text-center py-20 text-base">No offers are running right now. Please check back soon.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6">
        {offers.map((o) => (
          <Link key={o.id} to={`/offers/${o.slug}`} className="group block p-2">
            <div className="relative overflow-hidden rounded-[10px] bg-soft aspect-[880/1168]">
              <img src={asset(o.image)} alt={o.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              {o.min_discount > 0 && <span className="absolute top-3 left-3 bg-brand text-white font-medium rounded px-2.5 py-1.5">Min. {o.min_discount}% off</span>}
            </div>
            <h2 className="text-xl md:text-2xl leading-7 text-ink mt-3.5">{o.title}</h2>
            <p className="mt-1">{o.subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
