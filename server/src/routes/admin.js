import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { q, one, slugify } from '../db.js';
import { clearRoleCache, requireAuth, requireAdmin } from '../auth.js';
import { mail, invoiceHtml } from '../mail.js';

const r = Router();
r.use(requireAuth, requireAdmin);

const upload = multer({
  storage: multer.diskStorage({
    destination: new URL('../../uploads', import.meta.url).pathname,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)),
});

r.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a JPG, PNG or WebP image under 5 MB' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

r.get('/stats', async (req, res) => {
  const stats = await one(
    `SELECT (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM categories)::int AS categories,
            (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM orders)::int AS orders,
            (SELECT coalesce(sum(total), 0) FROM orders WHERE payment_status = 'paid')::int AS revenue`,
  );
  const recent = await q(`SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 6`);
  res.json({ ...stats, recent });
});

// Generic CRUD for the content tables; `cols` is the whitelist of writable columns.
const TABLES = {
  categories: { cols: ['parent_id', 'name', 'slug', 'image', 'banner_image', 'description', 'show_in_nav', 'show_on_home', 'sort_order', 'active', 'seo_title', 'seo_description'], order: 'sort_order, id', slugFrom: 'name' },
  products: { cols: ['category_id', 'name', 'subtitle', 'slug', 'description', 'price', 'mrp', 'dealer_price', 'images', 'tag', 'material', 'color', 'dimensions', 'care', 'warranty', 'stock', 'featured', 'active', 'seo_title', 'seo_description'], order: 'id DESC', slugFrom: 'name', json: ['images'] },
  offers: { cols: ['title', 'slug', 'subtitle', 'image', 'min_discount', 'category_id', 'sort_order', 'active', 'seo_title', 'seo_description'], order: 'sort_order, id', slugFrom: 'title' },
  banners: { cols: ['placement', 'title', 'subtitle', 'image', 'link', 'sort_order', 'active'], order: 'placement, sort_order, id' },
};

function values(t, body) {
  const data = { ...body };
  // Only touch the slug when the request carries one (or the name it comes from), so a partial update keeps the page URL.
  if (t.slugFrom && (data.slug || data[t.slugFrom])) data.slug = slugify(data.slug || data[t.slugFrom]);
  else delete data.slug;
  const cols = t.cols.filter((c) => data[c] !== undefined);
  const vals = cols.map((c) => {
    const v = data[c];
    if (t.json?.includes(c)) return JSON.stringify(v);
    // A blank number box means 0 for the optional numbers; a blank id or price is NULL (price then fails as required).
    if (v === '' && /^mrp$|^stock$|_order$|^min_discount$/.test(c)) return 0;
    return v === '' && /_id$|^price$|^dealer_price$/.test(c) ? null : v;
  });
  return { cols, vals };
}

function dbError(res, e) {
  if (e.code === '23505') return res.status(409).json({ error: 'That slug is already in use — choose a different one' });
  if (e.code === '23503') return res.status(409).json({ error: 'This item is still in use (move or delete its sub-categories first)' });
  if (e.code === '23502' || e.code === '22P02') return res.status(400).json({ error: 'A required field is missing or invalid' });
  throw e;
}

for (const [name, t] of Object.entries(TABLES)) {
  r.get(`/${name}`, async (req, res) => res.json(await q(`SELECT * FROM ${name} ORDER BY ${t.order}`)));
  r.post(`/${name}`, async (req, res) => {
    const { cols, vals } = values(t, req.body);
    try {
      res.json(await one(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, vals));
    } catch (e) { dbError(res, e); }
  });
  r.put(`/${name}/:id`, async (req, res) => {
    const { cols, vals } = values(t, req.body);
    if (name === 'categories' && String(req.body.parent_id) === req.params.id) return res.status(400).json({ error: 'A category cannot be its own parent' });
    try {
      const row = await one(`UPDATE ${name} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`, [...vals, req.params.id]);
      row ? res.json(row) : res.status(404).json({ error: 'Not found' });
    } catch (e) { dbError(res, e); }
  });
  r.delete(`/${name}/:id`, async (req, res) => {
    try {
      await q(`DELETE FROM ${name} WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e) { dbError(res, e); }
  });
}

// Site-wide SEO: home page title and description, and the image shown when a link is shared.
const SEO_KEYS = ['home_title', 'home_description', 'share_image'];
r.get('/settings/seo', async (req, res) => res.json((await one(`SELECT value FROM settings WHERE key = 'seo'`))?.value || {}));
r.put('/settings/seo', async (req, res) => {
  const value = Object.fromEntries(SEO_KEYS.map((k) => [k, String(req.body[k] ?? '').trim()]));
  await q(`INSERT INTO settings (key, value) VALUES ('seo', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(value)]);
  res.json(value);
});

r.get('/orders', async (req, res) => {
  res.json(await q(`SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 500`));
});
r.patch('/orders/:id', async (req, res) => {
  const statuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
  if (!statuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  const before = await one(`SELECT o.status, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [req.params.id]);
  if (!before) return res.status(404).json({ error: 'Order not found' });
  const order = await one(`UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`, [req.body.status, req.params.id]);
  // Every status change emails the customer; `emailed` tells the admin panel whether that email went out.
  const emailed = before.status !== order.status && await mail.orderStatus(order, before.email);
  res.json({ ...order, emailed });
});
r.get('/orders/:id/invoice', async (req, res) => {
  const order = await one(`SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ html: invoiceHtml(order, order.email) });
});

const USER_COLS = 'id, email, name, phone, role, created_at';
r.get('/users', async (req, res) => {
  res.json(await q(
    `SELECT ${USER_COLS}, (SELECT count(*) FROM orders o WHERE o.user_id = users.id AND o.payment_status = 'paid')::int AS orders
     FROM users ORDER BY id DESC LIMIT 500`,
  ));
});

// Everything about one user: profile, orders, saved addresses, wishlist and what is sitting in their cart.
r.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id) || 0;
  const user = await one(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const [orders, addresses, wishlist, cart] = await Promise.all([
    q(`SELECT o.*, $2::text AS email FROM orders o WHERE o.user_id = $1 ORDER BY o.id DESC`, [id, user.email]),
    q(`SELECT * FROM addresses WHERE user_id = $1 ORDER BY id DESC`, [id]),
    q(`SELECT p.id, p.name, p.subtitle, p.slug, p.images, p.price FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = $1 ORDER BY p.id DESC`, [id]),
    one(`SELECT items, updated_at FROM carts WHERE user_id = $1`, [id]),
  ]);
  const inCart = await q(`SELECT id, name, subtitle, slug, images, price, dealer_price FROM products WHERE id = ANY($1)`, [(cart?.items || []).map((i) => i.id)]);
  const cartItems = (cart?.items || []).flatMap((i) => {
    const p = inCart.find((x) => x.id === i.id);
    return p ? [{ ...p, price: user.role === 'dealer' && p.dealer_price != null ? p.dealer_price : p.price, qty: i.qty }] : [];
  });
  const paid = orders.filter((o) => o.payment_status === 'paid');
  res.json({
    user, orders, addresses, wishlist, cart: cartItems, cartUpdatedAt: cart?.updated_at || null,
    stats: {
      orders: paid.length,
      spent: paid.reduce((n, o) => n + o.total, 0),
      productsOrdered: paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.qty, 0), 0),
      incompleteOrders: orders.length - paid.length,
    },
  });
});

r.patch('/users/:id', async (req, res) => {
  const { role, name, phone } = req.body;
  const self = Number(req.params.id) === req.user.id;
  if (role !== undefined && !['admin', 'customer', 'dealer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role !== undefined && self && role !== 'admin') return res.status(400).json({ error: 'You cannot change your own role' });
  if (phone !== undefined && phone !== '' && !/^\d{10}$/.test(String(phone))) return res.status(400).json({ error: 'Phone must be 10 digits' });
  clearRoleCache();
  const user = await one(
    `UPDATE users SET role = coalesce($1, role), name = coalesce($2, name), phone = coalesce($3, phone) WHERE id = $4 RETURNING ${USER_COLS}`,
    [role ?? null, name === undefined ? null : String(name).trim(), phone === undefined ? null : String(phone), req.params.id],
  );
  user ? res.json(user) : res.status(404).json({ error: 'User not found' });
});

// Orders are sales records, so a user who has any cannot be removed. Their cart, wishlist and addresses go with them.
r.delete('/users/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const { count } = await one(`SELECT count(*)::int AS count FROM orders WHERE user_id = $1`, [req.params.id]);
  if (count) return res.status(409).json({ error: `This user has ${count} order${count > 1 ? 's' : ''} on record, so the account cannot be deleted. Change their role instead.` });
  clearRoleCache();
  await q(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default r;
