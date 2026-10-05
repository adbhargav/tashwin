import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderTree, Image, IndianRupee, LayoutDashboard, LogOut, Package, Pencil, Search, ShoppingCart, Sofa, Store, Tag, Trash2, Users } from 'lucide-react';
import { api, asset, inr } from '../lib/api';
import { useAuth } from '../context/Auth';
import { StatusBadge } from '../pages/Account';
import { openInvoice } from '../lib/pay';
import CrudPage, { ImageField } from './CrudPage';
import { useSeo } from '../lib/seo';
import { CONFIGS } from './configs';

const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/api/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <p>Loading…</p>;
  const cards = [[IndianRupee, 'Revenue (paid)', inr(s.revenue)], [ShoppingCart, 'Orders', s.orders], [Sofa, 'Products', s.products], [FolderTree, 'Categories', s.categories], [Users, 'Customers', s.users]];
  return (
    <div>
      <h1 className="text-2xl text-ink font-medium mb-5">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(([Icon, label, value]) => (
          <div key={label} className="bg-white rounded-lg border border-line p-5">
            <Icon size={22} className="text-brand mb-3" />
            <p className="text-2xl text-ink font-medium">{value}</p><p>{label}</p>
          </div>
        ))}
      </div>
      <h2 className="text-lg text-ink font-medium mb-3">Recent Orders</h2>
      <OrdersTable orders={s.recent} />
    </div>
  );
}

function OrdersTable({ orders, onStatus }) {
  return (
    <div className="bg-white rounded-lg border border-line overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="border-b border-line text-xs uppercase text-mute">
          {['Order', 'Customer', 'Items', 'Total', 'Payment', 'Delivery status'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
        </tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-line last:border-0 align-top">
              <td className="px-4 py-3 text-ink whitespace-nowrap">#{o.id}<span className="block text-xs text-body">{date(o.created_at)}</span></td>
              <td className="px-4 py-3 text-ink">{o.address.name}<span className="block text-xs text-body">{o.email} · {o.address.phone}</span>
                <span className="block text-xs text-body">{o.address.line1}, {o.address.city} {o.address.pincode}</span></td>
              <td className="px-4 py-3">{o.items.map((i) => <span key={i.productId} className="block">{i.qty} × {i.name}</span>)}</td>
              <td className="px-4 py-3 text-ink whitespace-nowrap">{inr(o.total)}</td>
              <td className="px-4 py-3 capitalize">
                <span className={o.payment_status === 'paid' ? 'text-green-700' : 'text-amber-700'}>{o.payment_status === 'paid' ? 'Paid' : 'Incomplete'}</span>
                {o.payment_status === 'paid' && <button onClick={() => openInvoice(`/api/admin/orders/${o.id}/invoice`).catch((e) => alert(e.message))} className="block text-xs text-brand hover:underline">Invoice</button>}
              </td>
              <td className="px-4 py-3">
                {onStatus ? (
                  <select aria-label={`Status of order ${o.id}`} value={o.status} onChange={(e) => onStatus(o, e.target.value)} className="field !py-1.5 !w-auto capitalize">
                    {STATUSES.map((st) => <option key={st}>{st}</option>)}
                  </select>
                ) : <StatusBadge status={o.status} />}
              </td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center">No orders yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState(null);
  const load = () => api('/api/admin/orders').then(setOrders);
  useEffect(() => { load(); }, []);
  const [notice, setNotice] = useState('');
  const onStatus = async (o, status) => {
    setNotice(`Updating order #${o.id}…`);
    try {
      const res = await api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status } });
      setNotice(`Order #${o.id} is now “${status}”. ${res.emailed ? `The customer (${o.email}) has been emailed.` : 'The email to the customer could not be sent — check the email settings on the server.'}`);
      load();
    } catch (e) { setNotice(e.message); }
  };
  if (!orders) return <p>Loading…</p>;
  return (
    <div>
      <h1 className="text-2xl text-ink font-medium mb-5">Orders <span className="text-base font-normal text-body">({orders.length})</span></h1>
      <p className="mb-4">Changing an order’s delivery status emails the customer straight away.</p>
      {notice && <p role="status" className="bg-white border border-line rounded-lg px-4 py-3 mb-4 text-ink">{notice}</p>}
      <OrdersTable orders={orders} onStatus={onStatus} />
    </div>
  );
}

const ROLE_OPTIONS = <><option>customer</option><option value="dealer">dealer / distributor</option><option>admin</option></>;

function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const load = () => api('/api/admin/users').then(setUsers);
  useEffect(() => { load(); }, []);
  const setRole = async (u, role) => { try { await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { role } }); load(); } catch (e) { alert(e.message); } };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}? Their cart, wishlist and saved addresses are deleted too. This cannot be undone.`)) return;
    try { await api(`/api/admin/users/${u.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  };
  if (!users) return <p>Loading…</p>;
  return (
    <div>
      <h1 className="text-2xl text-ink font-medium mb-5">Users <span className="text-base font-normal text-body">({users.length})</span></h1>
      <div className="bg-white rounded-lg border border-line overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-line text-xs uppercase text-mute">{['Name', 'Email', 'Phone', 'Joined', 'Orders', 'Role', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-soft">
                <td className="px-4 py-3"><Link to={`/admin/users/${u.id}`} className="text-ink font-medium hover:text-brand hover:underline">{u.name || '—'}</Link></td>
                <td className="px-4 py-3"><Link to={`/admin/users/${u.id}`} className="text-ink hover:text-brand hover:underline">{u.email}</Link></td>
                <td className="px-4 py-3">{u.phone || '—'}</td><td className="px-4 py-3">{date(u.created_at)}</td><td className="px-4 py-3 text-ink">{u.orders}</td>
                <td className="px-4 py-3">
                  <select aria-label={`Role of ${u.email}`} value={u.role} disabled={u.id === me.id} onChange={(e) => setRole(u, e.target.value)} className="field !py-1.5 !w-auto capitalize">{ROLE_OPTIONS}</select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <Link to={`/admin/users/${u.id}`} aria-label={`View or edit ${u.email}`} className="inline-block p-2 hover:text-brand"><Pencil size={16} /></Link>
                  {u.id !== me.id && <button aria-label={`Delete ${u.email}`} onClick={() => remove(u)} className="p-2 hover:text-red-600"><Trash2 size={16} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ProductRow = ({ p, right }) => (
  <li className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
    <div className="w-12 h-12 rounded bg-soft overflow-hidden shrink-0">{p.images[0] && <img src={asset(p.images[0])} alt="" className="w-full h-full object-cover" />}</div>
    <div className="min-w-0 flex-1"><a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="text-ink hover:text-brand hover:underline">{p.name}</a><p className="text-xs truncate">{p.subtitle}</p></div>
    <p className="text-ink whitespace-nowrap">{right}</p>
  </li>
);
const Box = ({ title, children }) => <section className="bg-white rounded-lg border border-line p-5"><h2 className="text-lg text-ink font-medium mb-3">{title}</h2>{children}</section>;

// One user's profile: edit or delete the account, and see their cart, orders, addresses and wishlist.
function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api(`/api/admin/users/${id}`).then((d) => { setData(d); setForm({ name: d.user.name || '', phone: d.user.phone || '', role: d.user.role }); }).catch((e) => setStatus(e.message));
  useEffect(() => { load(); }, [id]);
  if (!data) return <p>{status || 'Loading…'}</p>;
  const { user, stats, cart, orders, addresses, wishlist } = data;
  const self = user.id === me.id;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setStatus('');
    try { await api(`/api/admin/users/${id}`, { method: 'PATCH', body: self ? { name: form.name, phone: form.phone } : form }); await load(); setStatus('Saved'); } catch (err) { setStatus(err.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete ${user.email}? Their cart, wishlist and saved addresses are deleted too. This cannot be undone.`)) return;
    try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); navigate('/admin/users'); } catch (err) { setStatus(err.message); }
  };
  const cartTotal = cart.reduce((n, i) => n + i.price * i.qty, 0);
  const cards = [['Paid orders', stats.orders], ['Total spent', inr(stats.spent)], ['Products ordered', stats.productsOrdered], ['Incomplete orders', stats.incompleteOrders],
    ['Items in cart', cart.reduce((n, i) => n + i.qty, 0)], ['Wishlist', wishlist.length]];
  return (
    <div>
      <Link to="/admin/users" className="inline-flex items-center gap-1 mb-3 hover:text-brand"><ArrowLeft size={16} />All users</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div><h1 className="text-2xl text-ink font-medium">{user.name || user.email}</h1><p>{user.email} · joined {date(user.created_at)} · <span className="capitalize">{user.role}</span></p></div>
        {!self && <button onClick={remove} className="btn btn-outline !py-2.5 !text-red-600 !border-red-200 hover:!bg-red-50"><Trash2 size={16} />Delete user</button>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {cards.map(([label, value]) => <div key={label} className="bg-white rounded-lg border border-line p-4"><p className="text-xl text-ink font-medium">{value}</p><p className="text-sm">{label}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Box title="Edit profile">
          <form onSubmit={save} className="space-y-4">
            <label className="block"><span className="label">Name</span><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className="label">Phone</span><input className="field" inputMode="numeric" pattern="\d{10}" title="10 digits" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="block"><span className="label">Role</span>
              <select className="field capitalize" value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLE_OPTIONS}</select>
              <p className="text-xs mt-1">{self ? 'You cannot change your own role.' : 'Dealers / distributors see and pay the dealer price set on each product.'}</p></label>
            <p className="text-xs">The email is the sign-in identity and cannot be changed here.</p>
            <div className="flex items-center gap-4"><button disabled={busy} className="btn btn-primary !py-2.5">{busy ? 'Saving…' : 'Save'}</button>{status && <p role="status">{status}</p>}</div>
          </form>
        </Box>
        <Box title={`Cart (${cart.length})`}>
          {cart.length ? (
            <>
              <ul>{cart.map((p) => <ProductRow key={p.id} p={p} right={`${p.qty} × ${inr(p.price)}`} />)}</ul>
              <p className="flex justify-between text-ink font-medium mt-3"><span>Cart total</span><span>{inr(cartTotal)}</span></p>
              <p className="text-xs mt-1">Last changed {date(data.cartUpdatedAt)}</p>
            </>
          ) : <p>{data.cartUpdatedAt ? 'Their cart is empty.' : 'No saved cart yet — a cart is saved once the user is signed in and adds or changes an item.'}</p>}
        </Box>
        <Box title={`Wishlist (${wishlist.length})`}>
          {wishlist.length ? <ul>{wishlist.map((p) => <ProductRow key={p.id} p={p} right={inr(p.price)} />)}</ul> : <p>Nothing in their wishlist.</p>}
        </Box>
        <Box title={`Saved addresses (${addresses.length})`}>
          {addresses.length ? addresses.map((a) => (
            <p key={a.id} className="py-2.5 border-b border-line last:border-0"><span className="text-ink">{a.name}</span> · {a.phone}<br />{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</p>
          )) : <p>No saved addresses.</p>}
        </Box>
      </div>
      <h2 className="text-lg text-ink font-medium mb-3">Orders ({orders.length})</h2>
      <OrdersTable orders={orders} />
    </div>
  );
}

// Site-wide SEO. Per-page SEO lives on each product, category and offer form.
function SeoPage() {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/admin/settings/seo').then((s) => setForm({ home_title: '', home_description: '', share_image: '', ...s })).catch((e) => setStatus(e.message)); }, []);
  if (!form) return <p>{status || 'Loading…'}</p>;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setStatus('');
    try { setForm(await api('/api/admin/settings/seo', { method: 'PUT', body: form })); setStatus('Saved'); } catch (err) { setStatus(err.message); } finally { setBusy(false); }
  };
  const count = (key, max) => <span className={form[key].length > max ? 'text-amber-700' : ''}>{form[key].length} / {max} characters</span>;
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl text-ink font-medium mb-2">SEO</h1>
      <p className="mb-5">These apply to the home page and are the fallback for every other page. Each product, category and offer has its own “SEO title” and “SEO description” in its edit form.</p>
      <form onSubmit={save} className="bg-white rounded-lg border border-line p-6 space-y-4">
        <label className="block"><span className="label">Home page title</span>
          <input className="field" value={form.home_title} placeholder="Tashwin Furniture | Premium Furniture for Home & Office" onChange={(e) => setForm({ ...form, home_title: e.target.value })} />
          <p className="text-xs mt-1">The headline Google shows for your home page. {count('home_title', 60)}</p></label>
        <label className="block"><span className="label">Home page description</span>
          <textarea className="field" rows={3} value={form.home_description} onChange={(e) => setForm({ ...form, home_description: e.target.value })} />
          <p className="text-xs mt-1">The text under the headline. {count('home_description', 160)}</p></label>
        <div><span className="label">Share image</span>
          <ImageField value={form.share_image} onChange={(v) => setForm({ ...form, share_image: v })} size={{ w: 1200, h: 630, note: 'Shown when a page without its own photo is shared' }} /></div>
        <div className="flex items-center gap-4">
          <button disabled={busy} className="btn btn-primary !py-2.5">{busy ? 'Saving…' : 'Save'}</button>
          {status && <p role="status">{status}</p>}
        </div>
      </form>
      <div className="bg-white rounded-lg border border-line p-6 mt-5">
        <h2 className="text-lg text-ink font-medium mb-2">Getting listed on Google</h2>
        <p>Your sitemap lists every active product, category and offer page and updates by itself: <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="text-brand hover:underline">/sitemap.xml</a>. Once the site is live on its own domain, add the domain in Google Search Console and submit that sitemap there.</p>
      </div>
    </div>
  );
}

const NAV = [['', LayoutDashboard, 'Dashboard'], ['categories', FolderTree, 'Categories'], ['products', Package, 'Products'], ['offers', Tag, 'Offers'],
  ['banners', Image, 'Banners'], ['orders', ShoppingCart, 'Orders'], ['users', Users, 'Users'], ['seo', Search, 'SEO']];

function AdminLogin() {
  const auth = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await auth.adminLogin(form.email, form.password);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-soft">
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8">
        <img src="/logo.png" alt="Tashwin Furniture" className="h-14 mx-auto mb-5" />
        <h1 className="text-2xl text-ink text-center mb-6">Admin Sign In</h1>
        <form onSubmit={submit}>
          <label className="block mb-4"><span className="label">Email</span>
            <input className="field" type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></label>
          <label className="block mb-4"><span className="label">Password</span>
            <input className="field" type="password" required autoComplete="current-password" value={form.password} onChange={set('password')} /></label>
          {error && <p role="alert" className="text-red-600 mb-3">{error}</p>}
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Please wait…' : 'Sign In'}</button>
        </form>
        <p className="text-center mt-6"><Link to="/" className="text-brand hover:underline">Back to store</Link></p>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, loading, logout } = useAuth();
  useSeo({ title: 'Admin', noindex: true });
  if (loading) return <div className="min-h-screen" />;
  if (!user) return <AdminLogin />;
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xl text-ink">This area is for administrators only.</p>
        <p>Signed in as {user.email}</p>
        <div className="flex gap-3"><button onClick={logout} className="btn btn-outline">Sign in as admin</button><Link to="/" className="btn btn-primary">Back to store</Link></div>
      </div>
    );
  }
  const link = ({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${isActive ? 'bg-brand text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`;
  return (
    <div className="min-h-screen md:flex bg-soft">
      <aside className="md:w-60 shrink-0 bg-[#222] md:min-h-screen p-4 md:sticky md:top-0 md:h-screen flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
        <div className="hidden md:block bg-white rounded-lg p-2 mb-4"><img src="/logo.png" alt="Tashwin Furniture" className="h-12 mx-auto" /></div>
        {NAV.map(([to, Icon, label]) => <NavLink key={to} end={!to} to={`/admin/${to}`} className={link}><Icon size={18} />{label}</NavLink>)}
        <div className="md:mt-auto flex md:flex-col gap-1">
          <Link to="/" className={link({ isActive: false })}><Store size={18} />View Store</Link>
          <button onClick={logout} className={link({ isActive: false })}><LogOut size={18} />Sign Out</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <Routes>
          <Route index element={<Dashboard />} />
          {Object.keys(CONFIGS).map((k) => <Route key={k} path={k} element={<CrudPage key={k} config={CONFIGS[k]} />} />)}
          <Route path="orders" element={<Orders />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="seo" element={<SeoPage />} />
        </Routes>
      </main>
    </div>
  );
}
