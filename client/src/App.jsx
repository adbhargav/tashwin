import { lazy, Suspense, useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Listing from './pages/Listing';
import Offers from './pages/Offers';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Account from './pages/Account';
import Projects, { ProjectDetail } from './pages/Projects';
import Policy from './pages/Policy';
import { SITE } from './lib/site';
import { useAuth } from './context/Auth';
import { useSeo } from './lib/seo';

const Admin = lazy(() => import('./admin/Admin'));

function StoreLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <Header />
      <main className="pt-[60px] lg:pt-[120px]"><Outlet /></main>
      {pathname !== '/login' && <Footer />}
    </>
  );
}

function Support() {
  useSeo({ title: 'Support & Contact', description: 'Contact Tashwin Furniture for product questions, order help, and bulk or office furniture requirements.' });
  const tel = `tel:${SITE.phone.replace(/\s/g, '')}`;
  const cards = [
    { Icon: Phone, label: 'Call us', value: SITE.phone, note: 'Orders, bulk and office enquiries', href: tel, cta: 'Call now' },
    { Icon: Mail, label: 'Email us', value: SITE.email, note: 'Send your requirement or order number', href: `mailto:${SITE.email}`, cta: 'Write to us' },
    { Icon: MapPin, label: 'Visit the showroom', value: SITE.address, note: `GSTIN ${SITE.gstin}`, href: `https://maps.google.com/?q=${encodeURIComponent(`${SITE.name}, ${SITE.address}`)}`, cta: 'Get directions', external: true },
  ];
  return (
    <div className="max-w-[1100px] mx-auto px-4 py-12 md:py-16">
      <h1 className="heading mb-3">We're here to help</h1>
      <p className="text-base text-center max-w-xl mx-auto mb-10">Questions about a product, an order, or a bulk / office requirement? Reach us any of these ways.</p>
      <div className="grid md:grid-cols-3 gap-5">
        {cards.map(({ Icon, label, value, note, href, cta, external }) => (
          <a key={label} href={href} {...(external && { target: '_blank', rel: 'noreferrer' })}
            className="group flex flex-col bg-white rounded-xl border border-line p-6 md:p-7 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <span className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-5"><Icon size={22} /></span>
            <span className="text-xs uppercase tracking-wider text-mute mb-1.5">{label}</span>
            <span className="text-ink text-[17px] leading-6 font-medium [overflow-wrap:anywhere]">{value}</span>
            <span className="text-sm mt-2">{note}</span>
            <span className="mt-auto pt-6 text-brand font-medium group-hover:underline">{cta} →</span>
          </a>
        ))}
      </div>
      <div className="mt-10 bg-soft rounded-xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-lg text-ink font-medium">Already ordered?</p>
          <p>Track delivery, download your invoice or complete a pending payment from your account.</p>
        </div>
        <Link to="/account/orders" className="btn btn-dark self-start md:self-auto whitespace-nowrap">Track your order</Link>
      </div>
    </div>
  );
}

function NotFound() {
  useSeo({ title: 'Page not found', noindex: true });
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <h1 className="heading">Page not found</h1>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // Dealers see their own prices, so pages reload their data when the viewer's price tier changes (sign in / out).
  const tier = useAuth().user?.role === 'dealer' ? 'dealer' : 'retail';
  return (
    <Routes key={tier}>
      <Route path="/admin/*" element={<Suspense fallback={null}><Admin /></Suspense>} />
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="c/:slug" element={<Listing mode="category" />} />
        <Route path="offers" element={<Offers />} />
        <Route path="offers/:slug" element={<Listing mode="offer" />} />
        <Route path="search" element={<Listing mode="search" />} />
        <Route path="product/:slug" element={<Product />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="login" element={<Login />} />
        <Route path="account/*" element={<Account />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:slug" element={<ProjectDetail />} />
        <Route path="support" element={<Support />} />
        <Route path=":slug" element={<Policy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
