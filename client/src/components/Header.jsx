import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive, Armchair, BedDouble, Briefcase, ChevronDown, Headphones, Heart, Lamp, Menu, Phone, Search, ShoppingBag,
  Sofa, Table2, Truck, User, Utensils, X,
} from 'lucide-react';
import { useShop } from '../context/Shop';
import { useAuth } from '../context/Auth';
import { asset } from '../lib/api';
import { SITE } from '../lib/site';

const PILLS = [
  { to: '/', label: 'Furniture', end: true },
  { to: '/offers', label: 'Offers' },
  { to: '/search?sort=new', label: 'New Arrivals' },
  { to: '/c/office', label: 'Workspaces' },
];

const ICONS = [[/sofa/i, Sofa], [/chair|seating/i, Armchair], [/bed|mattress/i, BedDouble], [/dining/i, Utensils], [/table|desk/i, Table2],
  [/storage|wardrobe/i, Archive], [/office/i, Briefcase]];
const groupIcon = (name) => (ICONS.find(([re]) => re.test(name)) || [null, Lamp])[1];

function MegaMenu({ dept, close }) {
  return (
    <div className="mega px-[30px]">
      <div className="flex -mx-[30px]">
        {dept.children.map((group) => {
          const Icon = groupIcon(group.name);
          const wide = group.children.length > 5;
          return (
            <div key={group.id} className={`mega-col ${wide ? 'w-2/6' : 'w-1/6'}`}>
              <Link to={`/c/${group.slug}`} onClick={close} className="flex items-center mb-[22px] h-[30px] text-ink font-medium">
                <Icon size={26} strokeWidth={1.25} className="mr-[9px] text-brand" />
                {group.name}
              </Link>
              <ul className={wide ? 'columns-2 gap-[30px]' : ''}>
                <li><Link to={`/c/${group.slug}`} onClick={close} className="mega-link">All {group.name}</Link></li>
                {group.children.map((leaf) => (
                  <li key={leaf.id}><Link to={`/c/${leaf.slug}`} onClick={close} className="mega-link">{leaf.name}</Link></li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="mega-col flex-1 min-w-[200px]">
          <Link to={`/c/${dept.slug}`} onClick={close} className="block group/img">
            <div className="overflow-hidden rounded-lg bg-soft aspect-[7/5]">
              {dept.image && <img src={asset(dept.image)} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105" />}
            </div>
            <span className="block mt-3 text-ink font-medium">Explore All {dept.name} →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SearchBox({ onDone }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    setQ('');
    onDone?.();
  };
  return (
    <form onSubmit={submit} className="flex items-center border border-[#ddd] rounded-full pl-4 pr-1 h-9 bg-white focus-within:border-brand transition-colors">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search furniture" aria-label="Search furniture"
        className="w-full lg:w-44 text-[13px] text-ink outline-none bg-transparent" />
      <button aria-label="Search" className="p-2 text-mute hover:text-ink"><Search size={16} /></button>
    </form>
  );
}

export default function Header() {
  const { tree, cartCount, wishIds } = useShop();
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { setDrawer(false); setOpen(null); }, [location]);
  useEffect(() => { document.body.style.overflow = drawer ? 'hidden' : ''; }, [drawer]);

  const isPillActive = (p) => (p.end ? location.pathname === '/' : (location.pathname + location.search).startsWith(p.to));
  const badge = (n) => n > 0 && (
    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-brand text-white text-[10px] leading-4 text-center">{n}</span>
  );

  return (
    <header>
      {/* Desktop: 70px brand row + 50px category row, fixed */}
      <div className="hidden lg:block fixed top-0 inset-x-0 z-40 bg-white h-[120px]">
        <div className="relative z-10 bg-white h-[70px] flex items-center justify-between pl-[14px] pr-[30px]">
          <ul className="flex items-center flex-1">
            {PILLS.map((p) => (
              <li key={p.label} className="mr-1"><Link to={p.to} className={`nav-pill ${isPillActive(p) ? 'active' : ''}`}>{p.label}</Link></li>
            ))}
          </ul>
          <Link to="/" aria-label={SITE.name} className="shrink-0"><img src="/logo.png" alt={SITE.name} className="h-[54px] w-auto" /></Link>
          <div className="flex items-center justify-end flex-1 text-[11px] uppercase">
            <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="icon-link"><Phone size={14} className="mr-1.5" />{SITE.phone}</a>
            <Link to="/support" className="icon-link ml-2.5"><Headphones size={16} className="mr-1.5" />Support</Link>
            <Link to="/account/orders" className="icon-link ml-2.5"><Truck size={18} className="mr-1.5" />Track your order</Link>
          </div>
        </div>
        <div className="relative z-10 bg-white h-[50px] flex justify-between px-[30px] shadow-[0_2px_6px_rgba(0,0,0,0.16)]">
          <nav className="flex items-center">
            {tree.filter((d) => d.show_in_nav).map((dept) => (
              <div key={dept.id} className={`menu-l1 h-[50px] mr-4 ${open === dept.id ? 'open' : ''}`}
                onMouseEnter={() => setOpen(dept.id)} onMouseLeave={() => setOpen(null)}>
                <Link to={`/c/${dept.slug}`} className="menu-l1-link">{dept.name}</Link>
                {dept.children.length > 0 && <MegaMenu dept={dept} close={() => setOpen(null)} />}
              </div>
            ))}
            <NavLink to="/offers" className="menu-l1-link !text-brand">Offers</NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <SearchBox />
            <Link to={user ? '/account' : '/login'} aria-label="Account" className="icon-link !p-2.5"><User size={19} strokeWidth={1.5} /></Link>
            <Link to="/account/wishlist" aria-label="Wishlist" className="icon-link !p-2.5"><Heart size={19} strokeWidth={1.5} />{badge(wishIds.length)}</Link>
            <Link to="/cart" aria-label="Cart" className="icon-link !p-2.5"><ShoppingBag size={19} strokeWidth={1.5} />{badge(cartCount)}</Link>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white h-[60px] flex items-center justify-between px-3 shadow-[0_2px_6px_rgba(0,0,0,0.16)]">
        <button aria-label="Open menu" onClick={() => setDrawer(true)} className="p-2 text-ink"><Menu size={22} /></button>
        <Link to="/"><img src="/logo.png" alt={SITE.name} className="h-[42px] w-auto" /></Link>
        <div className="flex items-center">
          <Link to={user ? '/account' : '/login'} aria-label="Account" className="p-2 text-ink"><User size={20} strokeWidth={1.5} /></Link>
          <Link to="/cart" aria-label="Cart" className="relative p-2 text-ink"><ShoppingBag size={20} strokeWidth={1.5} />{badge(cartCount)}</Link>
        </div>
      </div>
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[86%] max-w-sm bg-white overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <img src="/logo.png" alt="" className="h-10" />
              <button aria-label="Close menu" onClick={() => setDrawer(false)} className="p-2 text-ink"><X size={22} /></button>
            </div>
            <SearchBox onDone={() => setDrawer(false)} />
            <nav className="mt-4">
              {tree.filter((d) => d.show_in_nav).map((dept) => (
                <div key={dept.id} className="border-b border-line">
                  <button onClick={() => setExpanded(expanded === dept.id ? null : dept.id)}
                    className="w-full flex items-center justify-between py-3.5 text-[15px] font-medium text-ink">
                    {dept.name}<ChevronDown size={18} className={`transition-transform ${expanded === dept.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded === dept.id && (
                    <div className="pb-3">
                      <Link to={`/c/${dept.slug}`} className="block py-1.5 text-brand">All {dept.name}</Link>
                      {dept.children.map((group) => (
                        <div key={group.id} className="mt-2">
                          <Link to={`/c/${group.slug}`} className="block py-1.5 font-medium text-ink">{group.name}</Link>
                          {group.children.map((leaf) => <Link key={leaf.id} to={`/c/${leaf.slug}`} className="block py-1.5 pl-3">{leaf.name}</Link>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link to="/offers" className="block py-3.5 text-[15px] font-medium text-brand border-b border-line">Offers</Link>
              <Link to="/account/wishlist" className="block py-3.5 text-[15px] font-medium text-ink border-b border-line">Wishlist</Link>
              <Link to="/account/orders" className="block py-3.5 text-[15px] font-medium text-ink">Track your order</Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
