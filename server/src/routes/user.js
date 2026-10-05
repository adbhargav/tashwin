import { Router } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { q, one, pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { priced, productCols } from './public.js';
import { mail, invoiceHtml } from '../mail.js';

const r = Router();
r.use(requireAuth);

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, NODE_ENV } = process.env;
const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET }) : null;
// Without Razorpay keys, local development completes orders with a mock payment so checkout can be tested.
const mockPayments = !razorpay && NODE_ENV !== 'production';

r.get('/me', (req, res) => res.json(req.user));

r.put('/me', async (req, res) => {
  const { name = '', phone = '' } = req.body;
  res.json(await one(`UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING id, firebase_uid, email, name, phone, role, created_at`, [name, phone, req.user.id]));
});

r.get('/me/wishlist', async (req, res) => {
  const dealer = req.user.role === 'dealer';
  res.json(priced(await q(
    `SELECT ${productCols(dealer)} FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = $1 AND p.active ORDER BY p.id DESC`,
    [req.user.id],
  ), dealer));
});
r.post('/me/wishlist/:productId', async (req, res) => {
  await q(`INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.user.id, req.params.productId]);
  res.json({ ok: true });
});
r.delete('/me/wishlist/:productId', async (req, res) => {
  await q(`DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2`, [req.user.id, req.params.productId]);
  res.json({ ok: true });
});

// The cart lives in the browser; signed-in shoppers also save it here as [{ id, qty }].
r.get('/me/cart', async (req, res) => {
  const dealer = req.user.role === 'dealer';
  const saved = (await one(`SELECT items FROM carts WHERE user_id = $1`, [req.user.id]))?.items || [];
  const products = priced(await q(`SELECT ${productCols(dealer)} FROM products p WHERE p.id = ANY($1) AND p.active AND p.stock > 0`, [saved.map((i) => i.id)]), dealer);
  res.json(saved.flatMap((i) => {
    const p = products.find((x) => x.id === i.id);
    return p ? [{ id: p.id, qty: Math.min(i.qty, p.stock), name: p.name, subtitle: p.subtitle, slug: p.slug, image: p.images[0] || '', price: p.price, mrp: p.mrp, stock: p.stock }] : [];
  }));
});
r.put('/me/cart', async (req, res) => {
  const items = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 100)
    .map((i) => ({ id: Number(i.id), qty: Math.floor(Number(i.qty)) })).filter((i) => i.id > 0 && i.qty > 0);
  await q(`INSERT INTO carts (user_id, items) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items, updated_at = now()`,
    [req.user.id, JSON.stringify(items)]);
  res.json({ ok: true });
});

const ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];
function readAddress(body) {
  const a = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, String(body?.[f] ?? '').trim()]));
  const missing = ADDRESS_FIELDS.filter((f) => f !== 'line2' && !a[f]);
  if (missing.length) return { error: `Missing address fields: ${missing.join(', ')}` };
  if (!/^\d{6}$/.test(a.pincode)) return { error: 'Pincode must be 6 digits' };
  if (!/^\d{10}$/.test(a.phone)) return { error: 'Phone must be 10 digits' };
  return { address: a };
}

r.get('/me/addresses', async (req, res) => {
  res.json(await q(`SELECT * FROM addresses WHERE user_id = $1 ORDER BY id DESC`, [req.user.id]));
});
r.post('/me/addresses', async (req, res) => {
  const { address: a, error } = readAddress(req.body);
  if (error) return res.status(400).json({ error });
  res.json(await one(
    `INSERT INTO addresses (user_id, name, phone, line1, line2, city, state, pincode) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user.id, ...ADDRESS_FIELDS.map((f) => a[f])],
  ));
});
r.delete('/me/addresses/:id', async (req, res) => {
  await q(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.json({ ok: true });
});

r.get('/me/orders', async (req, res) => {
  res.json(await q(`SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC`, [req.user.id]));
});
r.get('/me/orders/:id', async (req, res) => {
  const order = await one(`SELECT * FROM orders WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Confirms the order once, then emails the customer (with invoice) and the admins.
async function confirmPaid(order, paymentId, email) {
  const paid = await markPaid(order.id, paymentId);
  if (paid) { mail.orderConfirmed(paid, email); mail.adminNewOrder(paid, email); }
}

async function razorpayDetails(order) {
  let id = order.razorpay_order_id;
  if (!id) {
    id = (await razorpay.orders.create({ amount: order.total * 100, currency: 'INR', receipt: `order_${order.id}` })).id;
    await q(`UPDATE orders SET razorpay_order_id = $1 WHERE id = $2`, [id, order.id]);
  }
  return { orderId: id, amount: order.total * 100, keyId: RAZORPAY_KEY_ID };
}

async function markPaid(orderId, paymentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE orders SET payment_status = 'paid', status = 'confirmed', razorpay_payment_id = $2
       WHERE id = $1 AND payment_status <> 'paid' RETURNING *`,
      [orderId, paymentId],
    );
    if (rows[0]) {
      for (const it of rows[0].items) {
        await client.query(`UPDATE products SET stock = greatest(stock - $1, 0) WHERE id = $2`, [it.qty, it.productId]);
      }
    }
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Prices are always re-read from the database; the client only sends product ids and quantities.
r.post('/orders', async (req, res) => {
  const { address, error } = readAddress(req.body.address);
  if (error) return res.status(400).json({ error });
  const wanted = (req.body.items || []).map((i) => ({ id: Number(i.productId), qty: Math.floor(Number(i.qty)) }))
    .filter((i) => i.id && i.qty > 0);
  if (!wanted.length) return res.status(400).json({ error: 'Your cart is empty' });
  if (!razorpay && !mockPayments) return res.status(503).json({ error: 'Online payments are not configured yet' });

  const dealer = req.user.role === 'dealer';
  const products = await q(`SELECT * FROM products WHERE id = ANY($1) AND active`, [wanted.map((i) => i.id)]);
  const items = [];
  for (const w of wanted) {
    const p = products.find((x) => x.id === w.id);
    if (!p) return res.status(400).json({ error: 'A product in your cart is no longer available' });
    if (p.stock < w.qty) return res.status(400).json({ error: `Only ${p.stock} left of ${p.name}` });
    items.push({ productId: p.id, name: p.name, subtitle: p.subtitle, slug: p.slug, image: p.images[0] || '', price: dealer && p.dealer_price != null ? p.dealer_price : p.price, qty: w.qty });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = await one(
    `INSERT INTO orders (user_id, items, total, address) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, JSON.stringify(items), total, JSON.stringify(address)],
  );

  // Remember what was typed at checkout so the next order is pre-filled: the address (unless already saved)
  // and, when the profile has none yet, the name and phone.
  await q(
    `INSERT INTO addresses (user_id, name, phone, line1, line2, city, state, pincode)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE NOT EXISTS (
       SELECT 1 FROM addresses WHERE user_id = $1 AND name = $2 AND phone = $3 AND line1 = $4 AND line2 = $5 AND city = $6 AND state = $7 AND pincode = $8)`,
    [req.user.id, ...ADDRESS_FIELDS.map((f) => address[f])],
  );
  await q(`UPDATE users SET name = CASE WHEN name = '' THEN $2 ELSE name END, phone = CASE WHEN phone = '' THEN $3 ELSE phone END WHERE id = $1`,
    [req.user.id, address.name, address.phone]);

  if (mockPayments) {
    await confirmPaid(order, 'mock_payment', req.user.email);
    return res.json({ orderId: order.id, mock: true });
  }
  res.json({ orderId: order.id, razorpay: await razorpayDetails(order) });
});

// Resume payment for an order that was created but never paid.
r.post('/orders/:id/pay', async (req, res) => {
  const order = await one(`SELECT * FROM orders WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  if (!order || order.payment_status === 'paid' || order.status === 'cancelled') return res.status(400).json({ error: 'This order cannot be paid for' });
  if (!razorpay) return res.status(503).json({ error: 'Online payments are not configured yet' });
  res.json({ orderId: order.id, razorpay: await razorpayDetails(order) });
});

r.get('/me/orders/:id/invoice', async (req, res) => {
  const order = await one(`SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND payment_status = 'paid'`, [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Invoice not available' });
  res.json({ html: invoiceHtml(order, req.user.email) });
});

r.post('/orders/:id/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const order = await one(`SELECT * FROM orders WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  if (!order || !razorpay || order.razorpay_order_id !== razorpay_order_id) return res.status(400).json({ error: 'Invalid payment' });
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const given = Buffer.from(String(razorpay_signature || ''));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }
  await confirmPaid(order, razorpay_payment_id, req.user.email);
  res.json({ ok: true });
});

export default r;
