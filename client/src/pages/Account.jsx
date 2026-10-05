import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, Heart, LayoutDashboard, LogOut, MapPin, Package, Trash2, User } from 'lucide-react';
import { api, asset, inr } from '../lib/api';
import { useAuth } from '../context/Auth';
import ProductCard from '../components/ProductCard';
import { ADDRESS_FIELDS, EMPTY_ADDRESS } from './Checkout';
import { openInvoice, payForOrder } from '../lib/pay';
import { useSeo } from '../lib/seo';

const STATUS_STYLE = { pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800', packed: 'bg-indigo-100 text-indigo-800', shipped: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-700' };
export const StatusBadge = ({ status }) => <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLE[status] || 'bg-gray-100'}`}>{status}</span>;
const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function useLoad(path) {
  const [data, setData] = useState(null);
  const reload = () => api(path).then(setData).catch(() => setData([]));
  useEffect(() => { reload(); }, [path]);
  return [data, reload];
}

function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '' });
  const [saved, setSaved] = useState(false);
  const submit = async (e) => { e.preventDefault(); await updateProfile(form); setSaved(true); };
  return (
    <form onSubmit={submit} className="max-w-md">
      <h2 className="text-xl text-ink font-medium mb-5">My Profile</h2>
      <label className="block mb-4"><span className="label">Email</span><input className="field bg-soft" value={user.email} disabled /></label>
      <label className="block mb-4"><span className="label">Full name</span><input className="field" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setSaved(false); }} /></label>
      <label className="block mb-5"><span className="label">Phone</span><input className="field" inputMode="numeric" value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setSaved(false); }} /></label>
      <button className="btn btn-primary">Save Changes</button>
      {saved && <span role="status" className="ml-4 text-green-700">Saved</span>}
    </form>
  );
}

function Orders() {
  const [orders] = useLoad('/api/me/orders');
  if (!orders) return null;
  return (
    <div>
      <h2 className="text-xl text-ink font-medium mb-5">My Orders</h2>
      {orders.length === 0 && <p>You have not placed any orders yet. <Link to="/" className="text-brand underline">Start shopping</Link></p>}
      <div className="space-y-4">
        {orders.map((o) => (
          <Link key={o.id} to={`/account/orders/${o.id}`} className="flex items-center gap-4 border border-line rounded-lg p-4 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            <div className="w-16 h-16 rounded-md overflow-hidden bg-soft shrink-0">{o.items[0]?.image && <img src={asset(o.items[0].image)} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="text-ink font-medium">Order #{o.id}</p>
              <p className="truncate">{o.items.map((i) => i.name).join(', ')} · {date(o.created_at)}</p>
            </div>
            <div className="text-right"><p className="text-ink font-medium mb-1">{inr(o.total)}</p><StatusBadge status={o.status} /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const STEPS = ['confirmed', 'packed', 'shipped', 'delivered'];
function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [order, reload] = useLoad(`/api/me/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justPaid, setJustPaid] = useState(false);
  if (!order) return null;
  const unpaid = order.payment_status !== 'paid' && order.status === 'pending';
  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const completePayment = () => run(async () => {
    const res = await api(`/api/orders/${order.id}/pay`, { method: 'POST' });
    if (await payForOrder(res, { name: order.address.name, email: user.email, phone: order.address.phone })) { setJustPaid(true); await reload(); }
  });
  if (!order.id) return <p>Order not found.</p>;
  const reached = STEPS.indexOf(order.status);
  const a = order.address;
  return (
    <div>
      {unpaid && (
        <div role="status" className="flex flex-wrap items-center gap-3 bg-amber-50 text-amber-900 rounded-lg p-4 mb-6">
          <AlertCircle className="shrink-0" />
          <div className="flex-1 min-w-[200px]"><p className="font-medium">Payment incomplete</p><p>Your order is saved. Complete the payment to confirm it.</p></div>
          <button onClick={completePayment} disabled={busy} className="btn btn-primary !py-2.5">{busy ? 'Please wait…' : 'Complete Payment'}</button>
        </div>
      )}
      {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
      {!unpaid && (params.get('placed') || justPaid) && (
        <div role="status" className="flex items-center gap-3 bg-green-50 text-green-800 rounded-lg p-4 mb-6">
          <CheckCircle2 /><div><p className="font-medium">Thank you! Your order has been placed.</p><p>We will keep you updated as it moves.</p></div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h2 className="text-xl text-ink font-medium">Order #{order.id}</h2>
        <StatusBadge status={order.status} />
      </div>
      {order.status !== 'cancelled' && order.status !== 'pending' && (
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="text-center">
                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-white text-xs ${i <= reached ? 'bg-brand' : 'bg-[#ddd]'}`}>{i + 1}</div>
                <p className={`mt-1 capitalize text-xs ${i <= reached ? 'text-ink' : ''}`}>{s}</p>
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 mb-5 ${i < reached ? 'bg-brand' : 'bg-[#ddd]'}`} />}
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-line border-y border-line">
        {order.items.map((i) => (
          <Link key={i.productId} to={`/product/${i.slug}`} className="flex items-center gap-4 py-4">
            <div className="w-20 h-20 rounded-md overflow-hidden bg-soft shrink-0">{i.image && <img src={asset(i.image)} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0"><p className="text-ink font-medium">{i.name}</p><p className="truncate">{i.subtitle}</p><p>Qty {i.qty}</p></div>
            <p className="text-ink font-medium">{inr(i.price * i.qty)}</p>
          </Link>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-6 mt-6">
        <div><p className="text-ink font-medium mb-1">Delivery address</p><p>{a.name} · {a.phone}</p><p>{a.line1}{a.line2 && `, ${a.line2}`}</p><p>{a.city}, {a.state} {a.pincode}</p></div>
        <div className="sm:text-right"><p className="text-ink font-medium mb-1">Payment</p><p className="capitalize">{order.payment_status} · {date(order.created_at)}</p><p className="text-lg text-ink font-medium mt-1">Total {inr(order.total)}</p>
          {order.payment_status === 'paid' && (
            <button onClick={() => run(() => openInvoice(`/api/me/orders/${order.id}/invoice`))} className="btn btn-outline !py-2.5 mt-3"><FileText size={16} />Invoice</button>
          )}</div>
      </div>
    </div>
  );
}

function Wishlist() {
  const [items] = useLoad('/api/me/wishlist');
  if (!items) return null;
  return (
    <div>
      <h2 className="text-xl text-ink font-medium mb-5">My Wishlist</h2>
      {items.length === 0 && <p>Your wishlist is empty. Tap the heart on any product to save it here.</p>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{items.map((p) => <ProductCard key={p.id} product={p} compact />)}</div>
    </div>
  );
}

function Addresses() {
  const [list, reload] = useLoad('/api/me/addresses');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try { await api('/api/me/addresses', { method: 'POST', body: form }); setForm(null); setError(''); reload(); } catch (err) { setError(err.message); }
  };
  const remove = async (id) => { await api(`/api/me/addresses/${id}`, { method: 'DELETE' }); reload(); };
  if (!list) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl text-ink font-medium">Saved Addresses</h2>
        {!form && <button onClick={() => setForm(EMPTY_ADDRESS)} className="btn btn-outline !py-2.5">+ Add Address</button>}
      </div>
      {form && (
        <form onSubmit={save} className="grid grid-cols-2 gap-4 border border-line rounded-lg p-5 mb-6">
          {ADDRESS_FIELDS.map(([key, label, span]) => (
            <label key={key} className={span}><span className="label">{label}</span>
              <input className="field" required={key !== 'line2'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
          ))}
          {error && <p role="alert" className="col-span-2 text-red-600">{error}</p>}
          <div className="col-span-2 flex gap-3"><button className="btn btn-primary !py-2.5">Save</button><button type="button" onClick={() => setForm(null)} className="btn btn-outline !py-2.5">Cancel</button></div>
        </form>
      )}
      {list.length === 0 && !form && <p>No saved addresses yet.</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {list.map((a) => (
          <div key={a.id} className="border border-line rounded-lg p-4 flex justify-between gap-3">
            <div><p className="text-ink font-medium">{a.name} · {a.phone}</p><p>{a.line1}{a.line2 && `, ${a.line2}`}</p><p>{a.city}, {a.state} {a.pincode}</p></div>
            <button aria-label="Delete address" onClick={() => remove(a.id)} className="self-start p-1 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Account() {
  useSeo({ title: 'My Account', noindex: true });
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="min-h-[70vh]" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  const link = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg whitespace-nowrap transition-colors ${isActive ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-soft text-ink'}`;
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-[28px] leading-9 text-ink">Hello, {user.name || user.email.split('@')[0]}</h1>
      <p className="mb-6">{user.email}</p>
      <div className="grid lg:grid-cols-12 gap-8">
        <nav className="lg:col-span-3 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
          <NavLink end to="/account" className={link}><User size={18} />Profile</NavLink>
          <NavLink to="/account/orders" className={link}><Package size={18} />Orders</NavLink>
          <NavLink to="/account/wishlist" className={link}><Heart size={18} />Wishlist</NavLink>
          <NavLink to="/account/addresses" className={link}><MapPin size={18} />Addresses</NavLink>
          {user.role === 'admin' && <NavLink to="/admin" className={link}><LayoutDashboard size={18} />Admin Panel</NavLink>}
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-ink hover:bg-soft whitespace-nowrap"><LogOut size={18} />Sign Out</button>
        </nav>
        <div className="lg:col-span-9 min-h-[40vh]">
          <Routes>
            <Route index element={<Profile />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="addresses" element={<Addresses />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
