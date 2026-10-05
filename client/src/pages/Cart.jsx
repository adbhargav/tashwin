import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useShop } from '../context/Shop';
import { asset, inr } from '../lib/api';
import { useSeo } from '../lib/seo';

export function OrderSummary({ children }) {
  const { cart, cartTotal } = useShop();
  const mrpTotal = cart.reduce((n, i) => n + Math.max(i.mrp, i.price) * i.qty, 0);
  return (
    <div className="bg-soft rounded-lg p-6 lg:sticky lg:top-[140px]">
      <h2 className="text-lg font-medium text-ink mb-4">Order Summary</h2>
      <div className="space-y-3 text-[15px]">
        <div className="flex justify-between"><span>Total MRP</span><span>{inr(mrpTotal)}</span></div>
        {mrpTotal > cartTotal && <div className="flex justify-between"><span>Discount</span><span className="text-brand">− {inr(mrpTotal - cartTotal)}</span></div>}
        <div className="flex justify-between"><span>Delivery &amp; Installation</span><span className="text-ink">Free</span></div>
        <div className="flex justify-between border-t border-[#ddd] pt-3 text-lg font-medium text-ink"><span>Total</span><span>{inr(cartTotal)}</span></div>
      </div>
      {children}
    </div>
  );
}

export default function Cart() {
  useSeo({ title: 'Your Cart', noindex: true });
  const { cart, setQty, removeFromCart } = useShop();
  if (!cart.length) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl text-ink">Your cart is empty</h1>
        <p>Explore our collections and find something you love.</p>
        <Link to="/" className="btn btn-primary">Continue Shopping</Link>
      </div>
    );
  }
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-[28px] leading-9 text-ink mb-6">Shopping Cart</h1>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 divide-y divide-line border-y border-line">
          {cart.map((i) => (
            <div key={i.id} className="flex gap-4 py-5">
              <Link to={`/product/${i.slug}`} className="w-24 h-24 md:w-36 md:h-36 shrink-0 rounded-lg overflow-hidden bg-soft">
                {i.image && <img src={asset(i.image)} alt={i.name} className="w-full h-full object-cover" />}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/product/${i.slug}`} className="text-lg font-medium text-ink">{i.name}</Link>
                    <p className="truncate">{i.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-medium text-ink">{inr(i.price * i.qty)}</p>
                    {i.mrp > i.price && <del>{inr(i.mrp * i.qty)}</del>}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center border border-[#ccc] rounded-full px-1">
                    <button aria-label="Decrease quantity" disabled={i.qty <= 1} onClick={() => setQty(i.id, i.qty - 1)} className="p-2 text-ink disabled:opacity-30"><Minus size={14} /></button>
                    <span className="w-7 text-center text-ink font-medium">{i.qty}</span>
                    <button aria-label="Increase quantity" disabled={i.qty >= i.stock} onClick={() => setQty(i.id, i.qty + 1)} className="p-2 text-ink disabled:opacity-30"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => removeFromCart(i.id)} className="flex items-center gap-1.5 hover:text-ink"><Trash2 size={15} />Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-4">
          <OrderSummary><Link to="/checkout" className="btn btn-primary w-full mt-6">Proceed to Checkout</Link></OrderSummary>
        </div>
      </div>
    </div>
  );
}
