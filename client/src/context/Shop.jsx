import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from './Auth';

const ShopContext = createContext(null);
export const useShop = () => useContext(ShopContext);

const readCart = () => {
  try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; }
};

export function ShopProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(readCart);
  const [wishIds, setWishIds] = useState([]);

  useEffect(() => { api('/api/categories').then(setCategories).catch(() => {}); }, []);
  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);

  // Signed-in shoppers also keep their cart on the server: an empty browser picks up the saved cart on sign-in,
  // and after that every change is saved (shortly after the last one).
  const savedFor = useRef(null);
  useEffect(() => {
    if (!user) { savedFor.current = null; return; }
    const save = (items) => api('/api/me/cart', { method: 'PUT', body: { items: items.map((i) => ({ id: i.id, qty: i.qty })) } }).catch(() => {});
    if (savedFor.current !== user.id) {
      const restore = readCart().length ? Promise.resolve() : api('/api/me/cart').then((items) => { if (items.length) setCart(items); });
      restore.catch(() => {}).finally(() => { savedFor.current = user.id; save(readCart()); });
      return;
    }
    const t = setTimeout(() => save(cart), 800);
    return () => clearTimeout(t);
  }, [cart, user]);
  // Cart lines keep a copy of the price, so refresh them for whoever is looking (dealers have their own prices).
  const dealer = user?.role === 'dealer';
  useEffect(() => {
    const ids = readCart().map((i) => i.id);
    if (!ids.length) return;
    api(`/api/cart-prices?ids=${ids.join(',')}`).then((rows) => setCart((prev) => prev.flatMap((i) => {
      const now = rows.find((r) => r.id === i.id);
      return now ? [{ ...i, price: now.price, mrp: now.mrp, stock: now.stock, qty: Math.max(1, Math.min(i.qty, now.stock || 1)) }] : [];
    }))).catch(() => {});
  }, [dealer]);
  useEffect(() => {
    if (!user) return setWishIds([]);
    api('/api/me/wishlist').then((items) => setWishIds(items.map((p) => p.id))).catch(() => {});
  }, [user]);

  // Departments > groups > pages, as shown in the navbar mega menu.
  const tree = useMemo(() => {
    const kids = (id) => categories.filter((c) => c.parent_id === id).map((c) => ({ ...c, children: kids(c.id) }));
    return kids(null);
  }, [categories]);

  const value = {
    categories, tree, cart, wishIds,
    cartCount: cart.reduce((n, i) => n + i.qty, 0),
    cartTotal: cart.reduce((n, i) => n + i.price * i.qty, 0),
    addToCart(p, qty = 1) {
      setCart((prev) => {
        const found = prev.find((i) => i.id === p.id);
        const next = Math.min((found?.qty || 0) + qty, p.stock);
        if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: next } : i));
        return [...prev, { id: p.id, qty: next, name: p.name, subtitle: p.subtitle, slug: p.slug, image: p.images?.[0] || '', price: p.price, mrp: p.mrp, stock: p.stock }];
      });
    },
    setQty: (id, qty) => setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i))),
    removeFromCart: (id) => setCart((prev) => prev.filter((i) => i.id !== id)),
    clearCart: () => setCart([]),
    async toggleWish(productId) {
      if (!user) return navigate('/login', { state: { from: location.pathname } });
      const has = wishIds.includes(productId);
      setWishIds((ids) => (has ? ids.filter((i) => i !== productId) : [...ids, productId]));
      await api(`/api/me/wishlist/${productId}`, { method: has ? 'DELETE' : 'POST' }).catch(() => {});
    },
  };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
