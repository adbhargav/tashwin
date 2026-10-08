import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, Briefcase, Building2, ExternalLink, FileText, FolderTree, Image, LayoutDashboard, LogOut, Mail, Menu, Package,
  Pencil, Phone, Plus, Search, ShoppingCart, Store, Tag, Trash2, Users, X,
} from 'lucide-react';
import { api, asset, inr } from '../lib/api';
import { useAuth } from '../context/Auth';
import { openInvoice } from '../lib/pay';
import { useSeo } from '../lib/seo';
import CrudPage, { ImageField } from './CrudPage';
import { CONFIGS } from './configs';
import { Card, DataTable, Dropdown, EmptyState, ExportButton, FilterSelect, PageHeader, Pill, SearchBox, Skeleton, ToastProvider, compact, exportCsv, fmtDate, fmtDateTime, matches, useToast } from './ui';

const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const STATUS_TONE = { pending: 'amber', confirmed: 'blue', packed: 'indigo', shipped: 'purple', delivered: 'green', cancelled: 'red' };
const ROLE_TONE = { admin: 'brand', dealer: 'purple', customer: 'gray' };
const ROLE_OPTIONS = [['customer', 'Customer'], ['dealer', 'Dealer / distributor'], ['admin', 'Admin']];
const STATUS_OPTIONS = STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1)]);
const StatusPill = ({ status }) => <Pill tone={STATUS_TONE[status] || 'gray'}>{status}</Pill>;
const Avatar = ({ name, email }) => <span className="w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-semibold flex items-center justify-center uppercase shrink-0">{(name || email || '?').trim().slice(0, 2)}</span>;
const sinceDays = (n) => Date.now() - n * 86400000;

/* ===================== Sign in ===================== */
function AdminLogin() {
  const auth = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await auth.adminLogin(form.email, form.password); } catch (err) { setError(err.message); } finally { setBusy(false); }
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

/* ===================== Dashboard ===================== */
function Delta({ now, before }) {
  if (!before) return <span className="text-xs text-mute">{now ? 'New this month' : 'No sales last month'}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-700' : 'text-red-600'}`}>{up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(pct)}% vs last month</span>;
}

function StatTile({ label, value, sub, to, tone }) {
  const body = (
    <>
      <p className="text-sm">{label}</p>
      <p className={`text-[26px] leading-8 font-medium mt-1 ${tone === 'alert' ? 'text-red-600' : 'text-ink'}`}>{value}</p>
      <div className="mt-1 min-h-[18px]">{sub}</div>
    </>
  );
  const cls = 'block bg-white rounded-xl border border-line p-5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)]';
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

// Single-series revenue bars with a hover tooltip. Width is fluid; the SVG scales to the card.
function RevenueChart({ points, labelOf }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 220, padL = 8, padB = 26, padT = 12;
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const niceMax = Math.pow(10, Math.floor(Math.log10(max))) * Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max))));
  const innerH = H - padB - padT;
  const slot = (W - padL) / points.length;
  const barW = Math.max(4, Math.min(28, slot * 0.6));
  const y = (v) => padT + innerH - (v / niceMax) * innerH;
  const ticks = [0, 0.5, 1].map((f) => niceMax * f);
  const labelEvery = Math.ceil(points.length / 6);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Revenue chart">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#eee" /><text x={padL} y={y(t) - 4} fontSize="10" fill="#999">{compact(t)}</text></g>)}
        {points.map((p, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const top = y(p.revenue);
          const h = Math.max(0, padT + innerH - top);
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={p.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
              {h > 0 && <path d={`M${x} ${padT + innerH} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${padT + innerH} Z`} fill={hover === i ? '#e0620f' : '#f9761f'} />}
              {h === 0 && <rect x={x} y={padT + innerH - 2} width={barW} height={2} fill="#e5e5e5" />}
              {i % labelEvery === 0 && <text x={padL + i * slot + slot / 2} y={H - 8} fontSize="10" fill="#999" textAnchor="middle">{labelOf(p)}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -top-2 rounded-md bg-[#222] text-white text-xs px-2.5 py-1.5 whitespace-nowrap shadow" style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <strong>{inr(points[hover].revenue)}</strong> · {points[hover].orders} order{points[hover].orders === 1 ? '' : 's'}<br /><span className="opacity-70">{labelOf(points[hover], true)}</span>
        </div>
      )}
    </div>
  );
}

const ProductLine = ({ p, right }) => (
  <li className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
    <div className="w-10 h-10 rounded-md bg-soft overflow-hidden shrink-0">{p.images?.[0] && <img src={asset(p.images[0])} alt="" className="w-full h-full object-cover" />}</div>
    <div className="min-w-0 flex-1"><p className="text-ink truncate">{p.name}</p>{p.subtitle && <p className="text-xs truncate">{p.subtitle}</p>}</div>
    <div className="text-right shrink-0">{right}</div>
  </li>
);

function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  useEffect(() => { api('/api/admin/stats').then(setS).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="text-red-600">{error}</p>;
  if (!s) return <Skeleton rows={8} />;
  const { totals: t, months: m } = s;
  const points = range === '30d'
    ? s.revenueByDay.map((d) => ({ key: d.day, revenue: d.revenue, orders: d.orders, date: new Date(d.day) }))
    : s.revenueByMonth.map((d) => ({ key: d.month, revenue: d.revenue, orders: d.orders, date: new Date(`${d.month}-01`) }));
  const labelOf = (p, long) => (range === '30d'
    ? p.date.toLocaleDateString('en-IN', long ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' })
    : p.date.toLocaleDateString('en-IN', long ? { month: 'long', year: 'numeric' } : { month: 'short' }));
  const rangeTotal = points.reduce((n, p) => n + p.revenue, 0);
  const pipeline = STATUSES.filter((st) => st !== 'pending').map((st) => [st, s.statuses[st] || 0]);
  const pipelineMax = Math.max(1, ...pipeline.map(([, n]) => n));
  const aov = t.paid_orders ? Math.round(t.revenue / t.paid_orders) : 0;

  return (
    <div>
      <PageHeader title="Dashboard" description={`Overview as of ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}.`}>
        <Link to="/admin/orders?status=to_ship" className="btn btn-outline !py-2 !px-4 text-sm"><Package size={15} />{t.to_ship} to ship</Link>
        <Link to="/admin/products" className="btn btn-primary !py-2 !px-4 text-sm">Manage products</Link>
      </PageHeader>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatTile label="Revenue (paid)" value={compact(t.revenue)} sub={<Delta now={m.revenue_this} before={m.revenue_last} />} to="/admin/orders" />
        <StatTile label="Paid orders" value={t.paid_orders} sub={<Delta now={m.orders_this} before={m.orders_last} />} to="/admin/orders" />
        <StatTile label="Average order value" value={compact(aov)} sub={<span className="text-xs text-mute">{m.orders_this} order{m.orders_this === 1 ? '' : 's'} this month</span>} />
        <StatTile label="Customers" value={t.customers} sub={<span className="text-xs text-mute">+{t.new_customers} in 30 days · {t.dealers} dealer{t.dealers === 1 ? '' : 's'}</span>} to="/admin/users" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile label="Awaiting dispatch" value={t.to_ship} sub={<span className="text-xs text-mute">Paid, not yet shipped</span>} to="/admin/orders?status=to_ship" />
        <StatTile label="Incomplete payments" value={t.incomplete} sub={<span className="text-xs text-mute">Started checkout, not paid</span>} to="/admin/orders?status=incomplete" tone={t.incomplete ? 'alert' : undefined} />
        <StatTile label="Out of stock" value={t.out_of_stock} sub={<span className="text-xs text-mute">{t.low_stock} more running low</span>} to="/admin/products?stock=out" tone={t.out_of_stock ? 'alert' : undefined} />
        <StatTile label="Active carts" value={t.active_carts} sub={<span className="text-xs text-mute">Signed-in shoppers, last 7 days</span>} to="/admin/users" />
      </div>

      <div className="grid xl:grid-cols-3 gap-5 mb-5">
        <Card className="xl:col-span-2 p-5" title={`Revenue · ${compact(rangeTotal)} ${range === '30d' ? 'in the last 30 days' : 'in the last 12 months'}`}
          action={<div className="flex rounded-lg border border-line p-0.5 text-xs">{[['30d', '30 days'], ['12m', '12 months']].map(([v, l]) => <button key={v} onClick={() => setRange(v)} className={`px-3 py-1 rounded-md ${range === v ? 'bg-ink text-white' : 'hover:bg-soft'}`}>{l}</button>)}</div>}>
          <RevenueChart points={points} labelOf={labelOf} />
        </Card>
        <Card title="Order pipeline" className="p-5" action={<Link to="/admin/orders" className="text-xs text-brand hover:underline">All orders</Link>}>
          <ul className="space-y-3">
            {pipeline.map(([st, n]) => (
              <li key={st}>
                <Link to={`/admin/orders?status=${st}`} className="flex items-center justify-between text-sm mb-1"><StatusPill status={st} /><span className="text-ink font-medium">{n}</span></Link>
                <div className="h-1.5 rounded-full bg-soft overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(n / pipelineMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-5 mb-5">
        <Card title="Top sellers · 90 days" className="p-5">
          {s.topProducts.length ? <ul>{s.topProducts.map((p) => <ProductLine key={p.id ?? p.name} p={p} right={<><p className="text-ink">{inr(p.revenue)}</p><p className="text-xs">{p.units} sold</p></>} />)}</ul> : <EmptyState title="No paid orders yet" />}
        </Card>
        <Card title="Stock alerts" className="p-5" action={<Link to="/admin/products?stock=low" className="text-xs text-brand hover:underline">Stock view</Link>}>
          {s.lowStock.length ? <ul>{s.lowStock.map((p) => <ProductLine key={p.id} p={p} right={p.stock <= 0 ? <Pill tone="red">Out</Pill> : <Pill tone="amber">{p.stock} left</Pill>} />)}</ul> : <EmptyState title="Stock levels are healthy" />}
        </Card>
        <Card title="Needs follow-up" className="p-5" action={<Link to="/admin/orders?status=incomplete" className="text-xs text-brand hover:underline">View all</Link>}>
          {s.incomplete.length ? (
            <ul>{s.incomplete.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1"><Link to={`/admin/orders/${o.id}`} className="text-ink hover:text-brand">Order #{o.id} · {inr(o.total)}</Link><p className="text-xs truncate">{o.customer_name || o.email} · {fmtDateTime(o.created_at)}</p></div>
              </li>
            ))}</ul>
          ) : <EmptyState title="No unpaid checkouts this week" />}
        </Card>
      </div>

      <Card title="Recent orders" action={<Link to="/admin/orders" className="text-xs text-brand hover:underline">All orders</Link>}>
        <OrdersTable orders={s.recent} compactView />
      </Card>
    </div>
  );
}

/* ===================== Orders ===================== */
function OrdersTable({ orders, loading, compactView, selectable, selected, onSelect }) {
  const navigate = useNavigate();
  const columns = [
    { key: 'id', label: 'Order', width: 110, render: (o) => <><span className="font-medium">#{o.id}</span><span className="block text-xs text-body">{fmtDateTime(o.created_at)}</span></> },
    { key: 'customer', label: 'Customer', nowrap: false, sort: (o) => o.customer_name || o.email, render: (o) => (
      <div className="flex items-center gap-2.5 min-w-[200px]"><Avatar name={o.address?.name || o.customer_name} email={o.email} />
        <div className="min-w-0"><p className="truncate">{o.address?.name || o.customer_name || '—'}</p><p className="text-xs text-body truncate">{o.email}{o.customer_role === 'dealer' && ' · dealer'}</p></div></div>) },
    { key: 'items', label: 'Items', nowrap: false, sort: (o) => o.items.reduce((n, i) => n + i.qty, 0), render: (o) => (
      <span title={o.items.map((i) => `${i.qty} × ${i.name}`).join('\n')}>{o.items.reduce((n, i) => n + i.qty, 0)} item{o.items.reduce((n, i) => n + i.qty, 0) === 1 ? '' : 's'}<span className="block text-xs text-body truncate max-w-[220px]">{o.items.map((i) => i.name).join(', ')}</span></span>) },
    { key: 'city', label: 'Deliver to', sort: (o) => o.address?.city, render: (o) => <>{o.address?.city}<span className="block text-xs text-body">{o.address?.pincode}</span></> },
    { key: 'total', label: 'Total', align: 'right', render: (o) => <span className="font-medium whitespace-nowrap">{inr(o.total)}</span> },
    { key: 'payment_status', label: 'Payment', render: (o) => (o.payment_status === 'paid' ? <Pill tone="green">Paid</Pill> : <Pill tone="amber">Unpaid</Pill>) },
    { key: 'status', label: 'Status', sort: (o) => STATUSES.indexOf(o.status), render: (o) => <StatusPill status={o.status} /> },
  ];
  return <DataTable columns={compactView ? columns.filter((c) => c.key !== 'city') : columns} rows={orders} loading={loading} pageSize={compactView ? 8 : 25}
    selectable={selectable} selected={selected} onSelect={onSelect} onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
    empty={<EmptyState title="No orders match" hint="Try another status, date range or search." />} />;
}

function Orders() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const status = params.get('status') || 'all';
  const [orders, setOrders] = useState(null);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('all');
  const [payment, setPayment] = useState('');
  useEffect(() => { api('/api/admin/orders').then(setOrders).catch(() => setOrders([])); }, []);
  const setStatus = (v) => navigate(v === 'all' ? '/admin/orders' : `/admin/orders?status=${v}`, { replace: true });

  const tabs = [['all', 'All'], ['to_ship', 'To ship'], ...STATUSES.filter((s) => s !== 'pending').map((s) => [s, s]), ['incomplete', 'Incomplete payment']];
  const byStatus = (o) => status === 'all' ? true
    : status === 'to_ship' ? o.payment_status === 'paid' && ['confirmed', 'packed'].includes(o.status)
    : status === 'incomplete' ? o.payment_status !== 'paid' && o.status === 'pending'
    : o.status === status && (status === 'cancelled' || o.payment_status === 'paid');
  const counts = useMemo(() => Object.fromEntries(tabs.map(([k]) => [k, (orders || []).filter((o) => byStatus.call(null, o) && true).length])), [orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => (orders || []).filter((o) => byStatus(o)
    && (!payment || o.payment_status === payment)
    && (range === 'all' || new Date(o.created_at).getTime() > sinceDays(Number(range)))
    && (matches(o, search) || String(o.id) === search.replace('#', ''))), [orders, status, payment, range, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = shown.filter((o) => o.payment_status === 'paid').reduce((n, o) => n + o.total, 0);
  const doExport = () => exportCsv('orders', [
    { label: 'Order', value: 'id' }, { label: 'Date', value: (o) => new Date(o.created_at).toISOString() }, { label: 'Customer', value: (o) => o.address.name }, { label: 'Email', value: 'email' },
    { label: 'Phone', value: (o) => o.address.phone }, { label: 'Address', value: (o) => [o.address.line1, o.address.line2, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(', ') },
    { label: 'Items', value: (o) => o.items.map((i) => `${i.qty} x ${i.name}`).join('; ') }, { label: 'Total', value: 'total' }, { label: 'Payment', value: 'payment_status' },
    { label: 'Razorpay payment', value: 'razorpay_payment_id' }, { label: 'Status', value: 'status' },
  ], shown);

  return (
    <div>
      <PageHeader title="Orders" count={orders?.length} description="Click an order to see its details, change its delivery status or print the invoice.">
        <ExportButton onClick={doExport} disabled={!shown.length} />
      </PageHeader>
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-line mb-4">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`px-3.5 py-2.5 text-sm whitespace-nowrap capitalize border-b-2 -mb-px ${status === k ? 'border-brand text-ink font-medium' : 'border-transparent hover:text-ink'}`}>
            {l}{orders && <span className="ml-1.5 text-xs text-mute">{counts[k]}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search order #, customer, phone, product…" />
        <FilterSelect label="Date range" value={range} onChange={setRange} options={[['all', 'All time'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} />
        {(status === 'all') && <FilterSelect label="Payment" value={payment} onChange={setPayment} options={[['', 'Payment'], ['paid', 'Paid'], ['unpaid', 'Unpaid']]} />}
        <span className="ml-auto text-sm">{shown.length} order{shown.length === 1 ? '' : 's'} · <span className="text-ink font-medium">{inr(total)}</span> paid</span>
      </div>
      <OrdersTable orders={shown} loading={!orders} />
    </div>
  );
}

const Field = ({ label, children }) => <div><p className="text-xs uppercase tracking-wider text-mute">{label}</p><div className="text-ink mt-0.5">{children}</div></div>;

function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api(`/api/admin/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="text-red-600">{error}</p>;
  if (!order) return <Skeleton rows={8} />;
  const a = order.address;
  const setStatus = async (status) => {
    setBusy(true);
    try {
      const res = await api(`/api/admin/orders/${id}`, { method: 'PATCH', body: { status } });
      setOrder({ ...order, ...res });
      toast(res.emailed ? `Marked “${status}” — ${order.email} has been emailed.` : `Marked “${status}”. The customer email could not be sent — check the email settings on the server.`, res.emailed ? 'success' : 'error');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div>
      <Link to="/admin/orders" className="inline-flex items-center gap-1 mb-3 hover:text-brand"><ArrowLeft size={16} />All orders</Link>
      <PageHeader title={`Order #${order.id}`} description={`Placed ${fmtDateTime(order.created_at)}${order.payment_status === 'paid' ? ' · paid via Razorpay' : ' · payment not completed'}`}>
        {order.payment_status === 'paid' && <button onClick={() => openInvoice(`/api/admin/orders/${order.id}/invoice`).catch((e) => toast(e.message, 'error'))} className="btn btn-outline !py-2 !px-4 text-sm"><FileText size={15} />Invoice</button>}
        <label className="flex items-center gap-2 text-sm">Status
          <Dropdown label="Order status" value={order.status} disabled={busy} onChange={setStatus} options={STATUS_OPTIONS} align="right" />
        </label>
      </PageHeader>
      <div className="grid xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <Card title={`Items (${order.items.reduce((n, i) => n + i.qty, 0)})`}>
            <table className="w-full text-left text-[13.5px]">
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.productId} className="border-t border-line">
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-md bg-soft overflow-hidden shrink-0">{i.image && <img src={asset(i.image)} alt="" className="w-full h-full object-cover" />}</div>
                      <div><a href={`/product/${i.slug}`} target="_blank" rel="noreferrer" className="text-ink hover:text-brand">{i.name}</a><p className="text-xs">{i.subtitle}</p></div></div></td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{i.qty} × {inr(i.price)}</td>
                    <td className="px-5 py-3 text-right text-ink font-medium whitespace-nowrap">{inr(i.qty * i.price)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line"><td className="px-5 py-3" colSpan={2}>Delivery &amp; installation</td><td className="px-5 py-3 text-right">Free</td></tr>
                <tr className="border-t border-line text-ink font-medium"><td className="px-5 py-3" colSpan={2}>Total (incl. taxes)</td><td className="px-5 py-3 text-right text-base">{inr(order.total)}</td></tr>
              </tbody>
            </table>
          </Card>
          <Card title="Progress" className="p-5">
            <ol className="flex flex-wrap gap-y-3">
              {['confirmed', 'packed', 'shipped', 'delivered'].map((st, i, arr) => {
                const reached = order.status === 'cancelled' ? -1 : arr.indexOf(order.status);
                return (
                  <li key={st} className="flex items-center flex-1 min-w-[120px] last:flex-none">
                    <div className="text-center"><div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-white text-xs ${i <= reached ? 'bg-brand' : 'bg-[#ddd]'}`}>{i + 1}</div><p className={`mt-1 capitalize text-xs ${i <= reached ? 'text-ink' : ''}`}>{st}</p></div>
                    {i < arr.length - 1 && <div className={`h-0.5 flex-1 mx-2 mb-5 ${i < reached ? 'bg-brand' : 'bg-[#ddd]'}`} />}
                  </li>
                );
              })}
            </ol>
            {order.status === 'cancelled' && <p className="mt-3 text-red-600">This order was cancelled.</p>}
            <p className="text-xs mt-4">Changing the status above emails the customer straight away.</p>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Customer" className="p-5" action={<Link to={`/admin/users/${order.customer_id}`} className="text-xs text-brand hover:underline">Profile</Link>}>
            <div className="flex items-center gap-3 mb-4"><Avatar name={order.customer_name} email={order.email} /><div><p className="text-ink">{order.customer_name || a.name}</p><p className="text-xs">{order.customer_orders} paid order{order.customer_orders === 1 ? '' : 's'} · <span className="capitalize">{order.customer_role}</span></p></div></div>
            <div className="space-y-3">
              <Field label="Email"><a href={`mailto:${order.email}`} className="hover:text-brand inline-flex items-center gap-1.5"><Mail size={14} />{order.email}</a></Field>
              <Field label="Phone"><a href={`tel:${a.phone}`} className="hover:text-brand inline-flex items-center gap-1.5"><Phone size={14} />{a.phone}</a></Field>
            </div>
          </Card>
          <Card title="Delivery address" className="p-5">
            <p className="text-ink">{a.name}</p><p>{a.line1}{a.line2 && `, ${a.line2}`}</p><p>{a.city}, {a.state} {a.pincode}</p>
            <a href={`https://maps.google.com/?q=${encodeURIComponent([a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-brand hover:underline">Open in Maps<ExternalLink size={13} /></a>
          </Card>
          <Card title="Payment" className="p-5">
            <div className="space-y-3">
              <Field label="Status">{order.payment_status === 'paid' ? <Pill tone="green">Paid</Pill> : <Pill tone="amber">Unpaid</Pill>}</Field>
              {order.razorpay_order_id && <Field label="Razorpay order"><span className="break-all text-sm">{order.razorpay_order_id}</span></Field>}
              {order.razorpay_payment_id && <Field label="Razorpay payment"><span className="break-all text-sm">{order.razorpay_payment_id}</span></Field>}
              {order.reminder_sent_at && <Field label="Payment reminder sent">{fmtDateTime(order.reminder_sent_at)}</Field>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ===================== Users & Dealers ===================== */
// One component backs two pages: Users (customers and admins) and Dealers (distributors who get dealer prices).
function UsersPage({ dealers = false }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [activity, setActivity] = useState('');
  const [picker, setPicker] = useState(null); // dealers page: search box for converting a customer
  const [mode, setMode] = useState('create'); // 'create' a new login | 'convert' an existing customer
  const [draft, setDraft] = useState({ name: '', email: '', phone: '', password: '' });
  const [creating, setCreating] = useState(false);
  const createDealer = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const u = await api('/api/admin/users', { method: 'POST', body: { ...draft, role: 'dealer' } });
      toast(u.existed ? `${u.email} already had an account — it is now a dealer.` : `Dealer account created for ${u.email}. Share the email and password with them.`);
      setPicker(null); setDraft({ name: '', email: '', phone: '', password: '' }); load();
    } catch (err) { toast(err.message, 'error'); } finally { setCreating(false); }
  };
  const load = () => api('/api/admin/users').then(setUsers).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setUserRole = async (u, newRole) => { try { await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { role: newRole } }); toast(`${u.email} is now a ${newRole}`); setPicker(null); load(); } catch (e) { toast(e.message, 'error'); } };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}? Their cart, wishlist and saved addresses are deleted too. This cannot be undone.`)) return;
    try { await api(`/api/admin/users/${u.id}`, { method: 'DELETE' }); toast('User deleted'); load(); } catch (e) { toast(e.message, 'error'); }
  };
  const inScope = (u) => (dealers ? u.role === 'dealer' : u.role !== 'dealer');
  const scoped = (users || []).filter(inScope);
  const shown = scoped.filter((u) => matches(u, search) && (!role || u.role === role)
    && (!activity || (activity === 'buyers' ? u.orders > 0 : activity === 'new' ? new Date(u.created_at).getTime() > sinceDays(30) : u.orders === 0)));
  const candidates = !picker ? [] : (users || []).filter((u) => u.role === 'customer' && matches(u, picker)).slice(0, 8);
  const title = dealers ? 'Dealers / Distributors' : 'Users';
  const base = dealers ? '/admin/dealers' : '/admin/users';
  const columns = [
    { key: 'name', label: dealers ? 'Dealer' : 'Customer', nowrap: false, sort: (u) => u.name || u.email, render: (u) => <div className="flex items-center gap-2.5 min-w-[220px]"><Avatar name={u.name} email={u.email} /><div className="min-w-0"><p className="font-medium truncate">{u.name || '—'}</p><p className="text-xs text-body truncate">{u.email}</p></div></div> },
    { key: 'phone', label: 'Phone', render: (u) => u.phone || <span className="text-mute">—</span> },
    { key: 'created_at', label: 'Joined', render: (u) => fmtDate(u.created_at) },
    { key: 'orders', label: 'Orders', align: 'right' },
    { key: 'spent', label: 'Spent', align: 'right', render: (u) => (u.spent ? inr(u.spent) : <span className="text-mute">—</span>) },
    { key: 'last_order_at', label: 'Last order', render: (u) => fmtDate(u.last_order_at) },
    { key: 'role', label: 'Role', render: (u) => (
      <span onClick={(e) => e.stopPropagation()}><Dropdown size="sm" label={`Role of ${u.email}`} value={u.role} disabled={u.id === me.id} onChange={(v) => setUserRole(u, v)} options={ROLE_OPTIONS} align="right" /></span>) },
  ];
  const spent = shown.reduce((n, u) => n + Number(u.spent || 0), 0);
  return (
    <div>
      <PageHeader title={title} count={scoped.length}
        description={dealers
          ? <>Dealers and distributors see and pay the dealer price set on each product. Customers become dealers here or from their profile; <Link to="/admin/users" className="text-brand hover:underline">regular users are listed separately</Link>.</>
          : <>Customers and admins. Click a row to see their orders, cart and saved addresses. <Link to="/admin/dealers" className="text-brand hover:underline">Dealers / distributors have their own page</Link>.</>}>
        <ExportButton disabled={!shown.length} onClick={() => exportCsv(dealers ? 'dealers' : 'users', [
          { label: 'ID', value: 'id' }, { label: 'Name', value: 'name' }, { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' }, { label: 'Role', value: 'role' },
          { label: 'Joined', value: (u) => u.created_at.slice(0, 10) }, { label: 'Paid orders', value: 'orders' }, { label: 'Total spent', value: 'spent' }, { label: 'Last order', value: (u) => (u.last_order_at || '').slice(0, 10) },
        ], shown)} />
        {dealers && <button onClick={() => setPicker('')} className="btn btn-primary !py-2 !px-4 text-sm"><Plus size={16} />Add dealer</button>}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, phone…" />
        {!dealers && <FilterSelect label="Role" value={role} onChange={setRole} options={[['', 'All roles'], ['customer', 'Customers'], ['admin', 'Admins']]} />}
        <FilterSelect label="Activity" value={activity} onChange={setActivity} options={[['', 'All activity'], ['buyers', 'Has ordered'], ['none', 'Never ordered'], ['new', 'Joined in last 30 days']]} />
        <span className="ml-auto text-sm">{shown.length} of {scoped.length}{dealers && <> · <span className="text-ink font-medium">{inr(spent)}</span> dealer sales</>}</span>
      </div>
      <DataTable columns={columns} rows={shown} loading={!users} defaultSort={{ key: 'created_at', dir: 'desc' }} onRowClick={(u) => navigate(`${base}/${u.id}`)}
        empty={<EmptyState title={dealers ? 'No dealers yet' : 'No users match'} hint={dealers ? 'Click “Add dealer” to convert an existing customer, or change a user’s role from their profile.' : 'Try another search or filter.'} />}
        actions={(u) => (
          <>
            <Link to={`${base}/${u.id}`} aria-label={`View or edit ${u.email}`} className="inline-block p-2 hover:text-brand"><Pencil size={15} /></Link>
            {u.id !== me.id && <button aria-label={`Delete ${u.email}`} onClick={() => remove(u)} className="p-2 hover:text-red-600"><Trash2 size={15} /></button>}
          </>
        )} />

      {picker != null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setPicker(null); }}>
          <div className="bg-white rounded-xl w-full max-w-lg my-8 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl text-ink font-medium">Add a dealer</h2><button type="button" aria-label="Close" onClick={() => setPicker(null)} className="p-1"><X size={20} /></button></div>
            <div className="flex rounded-lg bg-soft p-1 text-sm mb-5">
              {[['create', 'Create new account'], ['convert', 'Convert existing customer']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setMode(v)} className={`flex-1 rounded-md py-1.5 ${mode === v ? 'bg-white text-ink font-medium shadow-sm' : 'hover:text-ink'}`}>{l}</button>
              ))}
            </div>
            {mode === 'create' ? (
              <form onSubmit={createDealer} className="space-y-4">
                <p className="text-sm">The dealer signs in at the store with this email and password. Their delivery address and other details are filled in when they place their first order.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="label">Dealer / business name *</span><input className="field" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                  <label className="block"><span className="label">Phone</span><input className="field" inputMode="numeric" pattern="\d{10}" title="10 digits" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
                </div>
                <label className="block"><span className="label">Email *</span><input className="field" type="email" required autoComplete="off" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
                <label className="block"><span className="label">Password *</span><input className="field" type="text" required minLength={6} autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
                  <p className="text-xs mt-1">At least 6 characters. Shown in plain text so you can copy it to the dealer; they can change it later with “Forgot password”.</p></label>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setPicker(null)} className="btn btn-outline !py-2 !px-4 text-sm">Cancel</button>
                  <button disabled={creating} className="btn btn-primary !py-2 !px-4 text-sm">{creating ? 'Creating…' : 'Create dealer account'}</button>
                </div>
              </form>
            ) : (
              <>
                <p className="mb-4 text-sm">For someone who already has a customer account on the website. They keep their login and see dealer prices from their next sign-in.</p>
                <SearchBox value={picker} onChange={setPicker} placeholder="Search customers by name, email or phone…" />
                <ul className="mt-3 divide-y divide-line">
                  {candidates.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={u.name} email={u.email} /><div className="min-w-0 flex-1"><p className="text-ink truncate">{u.name || '—'}</p><p className="text-xs truncate">{u.email}{u.phone && ` · ${u.phone}`}</p></div>
                      <button onClick={() => setUserRole(u, 'dealer')} className="btn btn-outline !py-1.5 !px-3 text-sm">Make dealer</button>
                    </li>
                  ))}
                  {picker && !candidates.length && <li className="py-6 text-center">No customer matches “{picker}”.</li>}
                  {!picker && <li className="py-6 text-center text-sm">Start typing to find a customer.</li>}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ProductRow = ({ p, right }) => (
  <li className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
    <div className="w-12 h-12 rounded-md bg-soft overflow-hidden shrink-0">{p.images[0] && <img src={asset(p.images[0])} alt="" className="w-full h-full object-cover" />}</div>
    <div className="min-w-0 flex-1"><a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="text-ink hover:text-brand hover:underline">{p.name}</a><p className="text-xs truncate">{p.subtitle}</p></div>
    <p className="text-ink whitespace-nowrap">{right}</p>
  </li>
);

// One user's profile: edit or delete the account, and see their cart, orders, addresses and wishlist.
function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api(`/api/admin/users/${id}`).then((d) => { setData(d); setForm({ name: d.user.name || '', phone: d.user.phone || '', role: d.user.role }); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Skeleton rows={8} />;
  const { user, stats, cart, orders, addresses, wishlist } = data;
  const self = user.id === me.id;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api(`/api/admin/users/${id}`, { method: 'PATCH', body: self ? { name: form.name, phone: form.phone } : form }); await load(); toast('Profile saved'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete ${user.email}? Their cart, wishlist and saved addresses are deleted too. This cannot be undone.`)) return;
    try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); toast('User deleted'); navigate(user.role === 'dealer' ? '/admin/dealers' : '/admin/users'); } catch (err) { toast(err.message, 'error'); }
  };
  const resetPassword = async () => {
    try { const r = await api(`/api/admin/users/${id}/reset-password`, { method: 'POST' }); toast(`Password reset link sent to ${r.email}${r.how === 'firebase' ? ' (sent by Firebase — ask them to check spam)' : ''}`); } catch (err) { toast(err.message, 'error'); }
  };
  const cartTotal = cart.reduce((n, i) => n + i.price * i.qty, 0);
  const tiles = [['Paid orders', stats.orders], ['Total spent', inr(stats.spent)], ['Products ordered', stats.productsOrdered], ['Incomplete orders', stats.incompleteOrders], ['Items in cart', cart.reduce((n, i) => n + i.qty, 0)], ['Wishlist', wishlist.length]];
  return (
    <div>
      <Link to={user.role === 'dealer' ? '/admin/dealers' : '/admin/users'} className="inline-flex items-center gap-1 mb-3 hover:text-brand"><ArrowLeft size={16} />{user.role === 'dealer' ? 'All dealers' : 'All users'}</Link>
      <PageHeader title={user.name || user.email} description={<>{user.email} · joined {fmtDate(user.created_at)} · <Pill tone={ROLE_TONE[user.role]}>{user.role}</Pill></>}>
        {!self && <button onClick={remove} className="btn btn-outline !py-2 !px-4 text-sm !text-red-600 !border-red-200 hover:!bg-red-50"><Trash2 size={15} />Delete user</button>}
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-5">
        {tiles.map(([label, value]) => <div key={label} className="bg-white rounded-xl border border-line p-4"><p className="text-xl text-ink font-medium">{value}</p><p className="text-sm">{label}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Card title="Profile" className="p-5">
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className="label">Name</span><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="block"><span className="label">Phone</span><input className="field" inputMode="numeric" pattern="\d{10}" title="10 digits" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            </div>
            <label className="block"><span className="label">Role</span>
              <Dropdown className="w-full" label="Role" value={form.role} disabled={self} onChange={(v) => setForm({ ...form, role: v })} options={ROLE_OPTIONS} />
              <p className="text-xs mt-1">{self ? 'You cannot change your own role.' : 'Dealers / distributors see and pay the dealer price set on each product.'}</p></label>
            <p className="text-xs">The email is the sign-in identity and cannot be changed here.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={busy} className="btn btn-primary !py-2 !px-5 text-sm">{busy ? 'Saving…' : 'Save changes'}</button>
              <button type="button" onClick={resetPassword} className="btn btn-outline !py-2 !px-4 text-sm">Send password reset email</button>
            </div>
          </form>
        </Card>
        <Card title={`Cart (${cart.length})`} className="p-5">
          {cart.length ? (
            <>
              <ul>{cart.map((p) => <ProductRow key={p.id} p={p} right={`${p.qty} × ${inr(p.price)}`} />)}</ul>
              <p className="flex justify-between text-ink font-medium mt-3"><span>Cart total</span><span>{inr(cartTotal)}</span></p>
              <p className="text-xs mt-1">Last changed {fmtDateTime(data.cartUpdatedAt)}</p>
            </>
          ) : <EmptyState title={data.cartUpdatedAt ? 'Their cart is empty' : 'No saved cart yet'} hint={data.cartUpdatedAt ? undefined : 'A cart is saved once the user is signed in and adds or changes an item.'} />}
        </Card>
        <Card title={`Wishlist (${wishlist.length})`} className="p-5">
          {wishlist.length ? <ul>{wishlist.map((p) => <ProductRow key={p.id} p={p} right={inr(p.price)} />)}</ul> : <EmptyState title="Nothing in their wishlist" />}
        </Card>
        <Card title={`Saved addresses (${addresses.length})`} className="p-5">
          {addresses.length ? addresses.map((a) => (
            <p key={a.id} className="py-2.5 border-b border-line last:border-0"><span className="text-ink">{a.name}</span> · {a.phone}<br />{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</p>
          )) : <EmptyState title="No saved addresses" />}
        </Card>
      </div>
      <Card title={`Orders (${orders.length})`}><OrdersTable orders={orders.map((o) => ({ ...o, customer_name: user.name }))} compactView /></Card>
    </div>
  );
}

/* ===================== SEO ===================== */
function SeoPage() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/admin/settings/seo').then((s) => setForm({ home_title: '', home_description: '', share_image: '', ...s })).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="text-red-600">{error}</p>;
  if (!form) return <Skeleton rows={5} />;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { setForm(await api('/api/admin/settings/seo', { method: 'PUT', body: form })); toast('SEO settings saved'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const count = (key, max) => <span className={form[key].length > max ? 'text-amber-700' : ''}>{form[key].length} / {max} characters</span>;
  return (
    <div className="max-w-3xl">
      <PageHeader title="SEO" description="These apply to the home page and are the fallback for every other page. Each product, category and offer has its own “Search engine listing” section in its edit form." />
      <Card title="Home page" className="p-5">
        <form onSubmit={save} className="space-y-4">
          <label className="block"><span className="label">Home page title</span>
            <input className="field" value={form.home_title} placeholder="Tashwin Furniture | Premium Furniture for Home & Office" onChange={(e) => setForm({ ...form, home_title: e.target.value })} />
            <p className="text-xs mt-1">The headline Google shows for your home page. {count('home_title', 60)}</p></label>
          <label className="block"><span className="label">Home page description</span>
            <textarea className="field" rows={3} value={form.home_description} onChange={(e) => setForm({ ...form, home_description: e.target.value })} />
            <p className="text-xs mt-1">The text under the headline. {count('home_description', 160)}</p></label>
          <div><span className="label">Share image</span>
            <ImageField value={form.share_image} onChange={(v) => setForm({ ...form, share_image: v })} size={{ w: 1200, h: 630, note: 'Shown when a page without its own photo is shared' }} /></div>
          <button disabled={busy} className="btn btn-primary !py-2 !px-5 text-sm">{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      </Card>
      <Card title="Getting listed on Google" className="p-5 mt-5">
        <p>Your sitemap lists every active product, category and offer page and updates by itself: <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="text-brand hover:underline">/sitemap.xml</a>. Once the site is live on its own domain, add the domain in Google Search Console and submit that sitemap there.</p>
      </Card>
    </div>
  );
}

/* ===================== Policies ===================== */
function PoliciesPage() {
  const toast = useToast();
  const [pages, setPages] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/admin/settings/policies').then(setPages).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="text-red-600">{error}</p>;
  if (!pages) return <Skeleton rows={6} />;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api('/api/admin/settings/policies', { method: 'PUT', body: Object.fromEntries(pages.map((p) => [p.key, p.body])) }); toast('Policies saved'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const update = (key, body) => setPages(pages.map((p) => (p.key === key ? { ...p, body } : p)));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Policies" description="The Privacy Policy, Terms & Conditions and Refund Policy pages linked from the footer. Leave a box empty to use the built-in wording shown below it. Format: a line starting with “## ” is a heading, lines starting with “- ” are bullet points, a blank line starts a new paragraph." />
      <form onSubmit={save} className="space-y-5">
        {pages.map((p) => (
          <Card key={p.key} title={p.title} className="p-5" action={<a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline inline-flex items-center gap-1">View page<ExternalLink size={12} /></a>}>
            <textarea className="field font-mono text-[13px] leading-5" rows={14} value={p.body} placeholder={p.default} onChange={(e) => update(p.key, e.target.value)} />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span>{p.body ? `${p.body.length} characters` : 'Using the built-in wording (shown greyed above). Start typing to replace it.'}</span>
              {!p.body && <button type="button" onClick={() => update(p.key, p.default)} className="text-brand hover:underline">Copy the built-in wording here to edit it</button>}
            </div>
          </Card>
        ))}
        <button disabled={busy} className="btn btn-primary !py-2 !px-5 text-sm">{busy ? 'Saving…' : 'Save all policies'}</button>
      </form>
    </div>
  );
}

/* ===================== Shell ===================== */
const NAV = [
  { group: 'Overview', items: [['', LayoutDashboard, 'Dashboard']] },
  { group: 'Sales', items: [['orders', ShoppingCart, 'Orders'], ['users', Users, 'Users'], ['dealers', Briefcase, 'Dealers']] },
  { group: 'Catalogue', items: [['products', Package, 'Products'], ['categories', FolderTree, 'Categories'], ['offers', Tag, 'Offers'], ['banners', Image, 'Banners'], ['projects', Building2, 'Projects']] },
  { group: 'Marketing', items: [['seo', Search, 'SEO']] },
  { group: 'Settings', items: [['policies', FileText, 'Policies']] },
];
const TITLES = { '': 'Dashboard', orders: 'Orders', users: 'Users', dealers: 'Dealers / Distributors', products: 'Products', categories: 'Categories', offers: 'Offers', banners: 'Banners', projects: 'Projects', seo: 'SEO', policies: 'Policies' };

function Shell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { api('/api/admin/stats').then((s) => setBadge(s.totals.to_ship)).catch(() => {}); }, [pathname]);
  const section = pathname.split('/')[2] || '';
  const link = ({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${isActive ? 'bg-brand text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`;
  const nav = (
    <>
      <div className="bg-white rounded-lg p-2 mb-5"><img src="/logo.png" alt="Tashwin Furniture" className="h-11 mx-auto" /></div>
      {NAV.map(({ group, items }) => (
        <div key={group} className="mb-4">
          <p className="px-3 mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">{group}</p>
          {items.map(([to, Icon, label]) => (
            <NavLink key={to} end={!to} to={`/admin/${to}`} className={link}>
              <Icon size={17} />{label}{to === 'orders' && badge > 0 && <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">{badge}</span>}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="mt-auto pt-4 border-t border-white/10">
        <Link to="/" className={link({ isActive: false })}><Store size={17} />View store</Link>
        <button onClick={logout} className={`${link({ isActive: false })} w-full`}><LogOut size={17} />Sign out</button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-[#f4f5f7] lg:flex">
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#1f1f1f] min-h-screen p-4 sticky top-0 h-screen flex-col overflow-y-auto">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#1f1f1f] p-4 flex flex-col overflow-y-auto">{nav}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-line px-4 md:px-8 h-14 flex items-center gap-3">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="lg:hidden p-1.5 -ml-1.5"><Menu size={20} /></button>
          <p className="text-sm"><span className="text-mute">Admin</span> <span className="mx-1.5 text-mute">/</span> <span className="text-ink font-medium">{TITLES[section] || 'Details'}</span></p>
          <div className="ml-auto flex items-center gap-3">
            <a href="/" target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-sm hover:text-brand"><ExternalLink size={14} />Open store</a>
            <div className="flex items-center gap-2"><Avatar name={user.name} email={user.email} /><span className="hidden md:block text-sm text-ink">{user.email}</span></div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
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
  return (
    <ToastProvider>
      <Shell>
        <Routes>
          <Route index element={<Dashboard />} />
          {Object.keys(CONFIGS).map((k) => <Route key={k} path={k} element={<CrudPage key={k} config={CONFIGS[k]} />} />)}
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="dealers" element={<UsersPage dealers />} />
          <Route path="dealers/:id" element={<UserDetail />} />
          <Route path="seo" element={<SeoPage />} />
          <Route path="policies" element={<PoliciesPage />} />
        </Routes>
      </Shell>
    </ToastProvider>
  );
}
