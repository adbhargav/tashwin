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
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <h1 className="heading mb-4">Support</h1>
      <p className="text-base mb-8">Questions about a product, an order, or a bulk / office requirement? We are happy to help.</p>
      <div className="grid sm:grid-cols-3 gap-4 text-ink">
        <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="bg-soft rounded-lg p-6"><Phone className="mx-auto mb-3 text-brand" />{SITE.phone}</a>
        <a href={`mailto:${SITE.email}`} className="bg-soft rounded-lg p-6 break-all"><Mail className="mx-auto mb-3 text-brand" />{SITE.email}</a>
        <div className="bg-soft rounded-lg p-6"><MapPin className="mx-auto mb-3 text-brand" />{SITE.address}</div>
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
        <Route path="support" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
