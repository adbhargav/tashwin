import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Heart, Share2 } from 'lucide-react';
import { useShop } from '../context/Shop';
import { asset, inr } from '../lib/api';
import { useShare } from '../lib/share';

// Mirrors the reference listing card: 8px padded wrap, square #f8f8f8 image box, tag top-left,
// wishlist button revealed on hover, name/subtitle left with the price block floated right.
export default function ProductCard({ product: p, compact = false }) {
  const { wishIds, toggleWish } = useShop();
  const [active, setActive] = useState(0);
  const wished = wishIds.includes(p.id);
  const images = p.images?.length ? p.images : [''];
  const soldOut = p.stock <= 0;
  const [share, copied] = useShare(p);

  return (
    <div className="group relative bg-white rounded-lg p-2 border border-transparent transition-[box-shadow,border-color] duration-300 hover:border-line hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="relative rounded-lg bg-soft overflow-hidden aspect-square mb-2.5">
        <Link to={`/product/${p.slug}`} aria-label={p.name}>
          {images[active] && (
            <img src={asset(images[active])} alt={p.name} loading="lazy"
              className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04] ${soldOut ? 'opacity-60' : ''}`} />
          )}
        </Link>
        {(soldOut || p.tag) && (
          <span className={`absolute top-2 left-2 rounded px-2 py-2 text-white font-medium leading-[17px] ${soldOut ? 'bg-ink' : 'bg-tag'}`}>
            {soldOut ? 'Sold Out' : p.tag}
          </span>
        )}
        <button onClick={() => toggleWish(p.id)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-[#f6f6f6] flex items-center justify-center transition-opacity duration-200 hover:[&>svg]:scale-110 ${wished ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100'}`}>
          <Heart size={17} className={`transition-transform ${wished ? 'fill-brand text-brand' : 'text-ink'}`} />
        </button>
        <button onClick={share} aria-label={`Share ${p.name}`}
          className="absolute top-12 right-2 w-8 h-8 rounded-full bg-[#f6f6f6] flex items-center justify-center transition-opacity duration-200 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 hover:[&>svg]:scale-110">
          {copied ? <Check size={16} className="text-green-700" /> : <Share2 size={16} className="text-ink transition-transform" />}
        </button>
        {copied && <span role="status" className="absolute top-[52px] right-12 rounded bg-ink text-white text-xs px-2 py-1 whitespace-nowrap">Link copied</span>}
      </div>
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/product/${p.slug}`} className={`block font-medium text-ink mb-[5px] truncate ${compact ? 'text-[17px] leading-[22px]' : 'text-xl leading-6'}`}>{p.name}</Link>
          <p className={`mb-2.5 line-clamp-2 ${compact ? 'text-sm' : 'text-base leading-[19px]'}`}>{p.subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="whitespace-nowrap">
            {p.discount > 0 && <span className="font-medium text-brand mr-2">{p.discount}% off</span>}
            <span className={`font-medium text-ink ${compact ? 'text-[17px]' : 'text-xl leading-[25px]'}`}>{inr(p.price)}</span>
          </div>
          {p.mrp > p.price && <del className={compact ? 'text-sm' : 'text-base leading-[22px]'}>{inr(p.mrp)}</del>}
          {p.dealer_pricing && <p className="text-xs font-medium text-brand">Dealer price</p>}
        </div>
      </div>
      {!compact && images.length > 1 && (
        <div className="flex mt-1">
          {images.slice(0, 5).map((src, i) => (
            <button key={i} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} aria-label={`View image ${i + 1}`}
              className={`w-[50px] h-[50px] mr-2 rounded overflow-hidden border transition-colors duration-300 ${i === active ? 'border-ink' : 'border-transparent'}`}>
              <img src={asset(src)} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
