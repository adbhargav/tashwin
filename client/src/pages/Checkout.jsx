import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/Auth';
import { useShop } from '../context/Shop';
import { OrderSummary } from './Cart';
import { payForOrder } from '../lib/pay';
import { useSeo } from '../lib/seo';

export const ADDRESS_FIELDS = [
  ['name', 'Full name', 'col-span-2 sm:col-span-1'], ['phone', 'Phone (10 digits)', 'col-span-2 sm:col-span-1'],
  ['line1', 'House / flat, street', 'col-span-2'], ['line2', 'Area, landmark (optional)', 'col-span-2'],
  ['city', 'City', 'col-span-2 sm:col-span-1'], ['state', 'State', 'col-span-2 sm:col-span-1'], ['pincode', 'Pincode', 'col-span-2 sm:col-span-1'],
];
export const EMPTY_ADDRESS = Object.fromEntries(ADDRESS_FIELDS.map(([k]) => [k, '']));

export default function Checkout() {
  useSeo({ title: 'Checkout', noindex: true });
  const { user, loading } = useAuth();
  const { cart, clearCart } = useShop();
  const navigate = useNavigate();
  const [saved, setSaved] = useState([]);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setAddress((a) => ({ ...a, name: a.name || user.name, phone: a.phone || user.phone }));
    // Pre-fill from the most recent saved address; failing that, from the address on their last order.
    api('/api/me/addresses').then(async (list) => {
      setSaved(list);
      if (list[0]) return setAddress(list[0]);
      const last = (await api('/api/me/orders'))[0]?.address;
      if (last) setAddress({ ...EMPTY_ADDRESS, ...last });
    }).catch(() => {});
  }, [user]);

  if (loading) return <div className="min-h-[70vh]" />;
  if (!user) return <Navigate to="/login" state={{ from: '/checkout' }} replace />;
  if (!cart.length && !busy) return <Navigate to="/cart" replace />;

  async function pay(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await api('/api/orders', { method: 'POST', body: { address, items: cart.map((i) => ({ productId: i.id, qty: i.qty })) } });
      const paid = res.mock || await payForOrder(res, { name: address.name, email: user.email, phone: address.phone });
      // The order now exists either way; an unpaid one can be completed from its order page.
      clearCart();
      navigate(`/account/orders/${res.orderId}?${paid ? 'placed' : 'incomplete'}=1`, { replace: true });
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <form onSubmit={pay} className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-[28px] leading-9 text-ink mb-6">Checkout</h1>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <h2 className="text-lg font-medium text-ink mb-4">Delivery Address</h2>
          {saved.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-5">
              {saved.map((a) => (
                <button type="button" key={a.id} onClick={() => setAddress(a)}
                  className={`text-left rounded-lg border px-4 py-3 max-w-[260px] transition-colors ${address.id === a.id ? 'border-brand bg-brand/5' : 'border-[#ddd] hover:border-ink'}`}>
                  <span className="block text-ink font-medium">{a.name}</span>
                  <span className="block truncate">{a.line1}, {a.city} {a.pincode}</span>
                </button>
              ))}
              <button type="button" onClick={() => setAddress(EMPTY_ADDRESS)} className="rounded-lg border border-dashed border-[#bbb] px-4 py-3 hover:border-ink">+ New address</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {ADDRESS_FIELDS.map(([key, label, span]) => (
              <label key={key} className={span}>
                <span className="label">{label}</span>
                <input className="field" required={key !== 'line2'} value={address[key] || ''}
                  inputMode={key === 'phone' || key === 'pincode' ? 'numeric' : undefined}
                  pattern={key === 'phone' ? '\\d{10}' : key === 'pincode' ? '\\d{6}' : undefined}
                  onChange={(e) => setAddress({ ...address, id: undefined, [key]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4">
          <OrderSummary>
            {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
            <button disabled={busy} className="btn btn-primary w-full mt-6">{busy ? 'Processing…' : 'Pay Securely'}</button>
            <p className="text-xs text-center mt-3">Payments are processed securely by Razorpay.</p>
          </OrderSummary>
        </div>
      </div>
    </form>
  );
}
