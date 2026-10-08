import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { q, one, slugify } from '../db.js';
import { clearRoleCache, requireAuth, requireAdmin } from '../auth.js';
import { mail, invoiceHtml } from '../mail.js';
import { saveUpload } from '../storage.js';
import { sendPasswordReset } from '../reset.js';
import { DEFAULT_POLICIES, POLICY_PAGES } from '../policies.js';

const r = Router();
r.use(requireAuth, requireAdmin);

// Images up to 8 MB and videos up to 60 MB, kept in memory just long enough to hand to storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|avif|gif)|video\/(mp4|webm|quicktime))$/.test(file.mimetype)),
});
const uploadError = (err, req, res, next) => (err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large (images up to 8 MB, videos up to 60 MB)' : err.message }) : next());

r.post('/upload', upload.single('file'), uploadError, async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Upload a JPG, PNG, WebP, GIF image or an MP4 / WebM video' });
  if (f.mimetype.startsWith('image/') && f.size > 8 * 1024 * 1024) return res.status(400).json({ error: 'Images must be under 8 MB' });
  const key = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(f.originalname).toLowerCase() || `.${f.mimetype.split('/')[1]}`}`;
  res.json({ url: await saveUpload(key, f.buffer, f.mimetype), type: f.mimetype.split('/')[0], size: f.size });
});

r.get('/stats', async (req, res) => {
  const [totals, months, days, byMonth, statuses, top, lowStock, recent, attention] = await Promise.all([
    one(`SELECT (SELECT count(*) FROM products WHERE active)::int AS products,
                (SELECT count(*) FROM products WHERE active AND stock <= 0)::int AS out_of_stock,
                (SELECT count(*) FROM products WHERE active AND stock BETWEEN 1 AND 3)::int AS low_stock,
                (SELECT count(*) FROM users WHERE role <> 'admin')::int AS customers,
                (SELECT count(*) FROM users WHERE role = 'dealer')::int AS dealers,
                (SELECT count(*) FROM users WHERE role <> 'admin' AND created_at > now() - interval '30 days')::int AS new_customers,
                (SELECT count(*) FROM orders WHERE payment_status = 'paid')::int AS paid_orders,
                (SELECT coalesce(sum(total), 0) FROM orders WHERE payment_status = 'paid')::bigint AS revenue,
                (SELECT count(*) FROM orders WHERE payment_status = 'paid' AND status IN ('confirmed', 'packed'))::int AS to_ship,
                (SELECT count(*) FROM orders WHERE payment_status <> 'paid' AND status = 'pending')::int AS incomplete,
                (SELECT count(*) FROM carts WHERE jsonb_array_length(items) > 0 AND updated_at > now() - interval '7 days')::int AS active_carts`),
    one(`SELECT coalesce(sum(total) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::bigint AS revenue_this,
                coalesce(sum(total) FILTER (WHERE created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now())), 0)::bigint AS revenue_last,
                count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS orders_this,
                count(*) FILTER (WHERE created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now()))::int AS orders_last
         FROM orders WHERE payment_status = 'paid'`),
    q(`SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(o.total), 0)::bigint AS revenue, count(o.id)::int AS orders
       FROM generate_series(current_date - 29, current_date, '1 day') d
       LEFT JOIN orders o ON o.payment_status = 'paid' AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = d::date
       GROUP BY d ORDER BY d`),
    q(`SELECT to_char(m, 'YYYY-MM') AS month, coalesce(sum(o.total), 0)::bigint AS revenue, count(o.id)::int AS orders
       FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), '1 month') m
       LEFT JOIN orders o ON o.payment_status = 'paid' AND date_trunc('month', o.created_at AT TIME ZONE 'Asia/Kolkata') = m
       GROUP BY m ORDER BY m`),
    q(`SELECT status, count(*)::int AS count FROM orders WHERE payment_status = 'paid' GROUP BY status`),
    q(`SELECT i."productId" AS id, i.name, sum(i.qty)::int AS units, sum(i.qty * i.price)::bigint AS revenue, p.images, p.slug, p.stock
       FROM orders o, jsonb_to_recordset(o.items) AS i("productId" int, name text, qty int, price int)
       LEFT JOIN products p ON p.id = i."productId"
       WHERE o.payment_status = 'paid' AND o.created_at > now() - interval '90 days'
       GROUP BY i."productId", i.name, p.images, p.slug, p.stock ORDER BY revenue DESC LIMIT 6`),
    q(`SELECT id, name, subtitle, slug, images, stock FROM products WHERE active AND stock <= 3 ORDER BY stock, id LIMIT 8`),
    q(`SELECT o.*, u.email, u.name AS customer_name FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 8`),
    q(`SELECT o.id, o.total, o.created_at, u.email, u.name AS customer_name FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.payment_status <> 'paid' AND o.status = 'pending' AND o.created_at > now() - interval '7 days' ORDER BY o.id DESC LIMIT 6`),
  ]);
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v]));
  res.json({
    totals: num(totals), months: num(months),
    revenueByDay: days.map(num), revenueByMonth: byMonth.map(num),
    statuses: Object.fromEntries(statuses.map((s) => [s.status, s.count])),
    topProducts: top.map(num), lowStock, recent, incomplete: attention,
  });
});

// Generic CRUD for the content tables; `cols` is the whitelist of writable columns.
const TABLES = {
  categories: { cols: ['parent_id', 'name', 'slug', 'image', 'banner_image', 'description', 'show_in_nav', 'show_on_home', 'sort_order', 'active', 'seo_title', 'seo_description'], order: 'sort_order, id', slugFrom: 'name' },
  products: { cols: ['category_id', 'name', 'subtitle', 'slug', 'description', 'price', 'mrp', 'dealer_price', 'images', 'tag', 'material', 'color', 'dimensions', 'care', 'warranty', 'stock', 'featured', 'active', 'seo_title', 'seo_description'], order: 'id DESC', slugFrom: 'name', json: ['images'] },
  offers: { cols: ['title', 'slug', 'subtitle', 'description', 'image', 'banner_image', 'product_ids', 'min_discount', 'category_id', 'sort_order', 'active', 'seo_title', 'seo_description'], order: 'sort_order, id', slugFrom: 'title', json: ['product_ids'] },
  projects: { cols: ['title', 'slug', 'category', 'client', 'location', 'completed_on', 'summary', 'description', 'cover_image', 'images', 'video', 'featured', 'sort_order', 'active', 'seo_title', 'seo_description'], order: 'sort_order, id DESC', slugFrom: 'title', json: ['images'] },
  banners: { cols: ['placement', 'title', 'subtitle', 'image', 'link', 'sort_order', 'active'], order: 'placement, sort_order, id' },
};

function values(t, body) {
  const data = { ...body };
  // Slugs are never typed by the admin: a new row gets one from its name/title, an existing row keeps its slug on rename.
  if (t.slugFrom) { if (!data.slug && data[t.slugFrom]) data.slug = slugify(data[t.slugFrom]); else if (data.slug) data.slug = slugify(data.slug); else delete data.slug; }
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

// "sofas", then "sofas-2", "sofas-3"… so two items with the same name never collide.
async function uniqueSlug(table, slug, excludeId = 0) {
  const taken = new Set((await q(`SELECT slug FROM ${table} WHERE slug LIKE $1 AND id <> $2`, [`${slug}%`, excludeId])).map((r) => r.slug));
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n++) if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
}

function dbError(res, e) {
  if (e.code === '23505') return res.status(409).json({ error: 'That slug is already in use — choose a different one' });
  if (e.code === '23503') return res.status(409).json({ error: 'This item is still in use (move or delete its sub-categories first)' });
  if (e.code === '23502' || e.code === '22P02') return res.status(400).json({ error: 'A required field is missing or invalid' });
  throw e;
}

// From the product form: tick the offers a product belongs to. Adds it to those offers' hand-picked lists and removes it from the rest.
async function syncProductOffers(productId, offerIds) {
  const wanted = new Set(offerIds.map(Number).filter(Boolean));
  for (const o of await q(`SELECT id, product_ids FROM offers`)) {
    const has = o.product_ids.includes(productId);
    if (wanted.has(o.id) && !has) await q(`UPDATE offers SET product_ids = product_ids || $1::jsonb WHERE id = $2`, [JSON.stringify([productId]), o.id]);
    if (!wanted.has(o.id) && has) await q(`UPDATE offers SET product_ids = (SELECT coalesce(jsonb_agg(x), '[]') FROM jsonb_array_elements(product_ids) x WHERE x::int <> $1) WHERE id = $2`, [productId, o.id]);
  }
}

for (const [name, t] of Object.entries(TABLES)) {
  r.get(`/${name}`, async (req, res) => res.json(await q(`SELECT * FROM ${name} ORDER BY ${t.order}`)));
  r.post(`/${name}`, async (req, res) => {
    const { cols, vals } = values(t, req.body);
    if (cols.includes('slug')) vals[cols.indexOf('slug')] = await uniqueSlug(name, vals[cols.indexOf('slug')] || name);
    try {
      const row = await one(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, vals);
      if (name === 'products' && Array.isArray(req.body.offer_ids)) await syncProductOffers(row.id, req.body.offer_ids);
      res.json(row);
    } catch (e) { dbError(res, e); }
  });
  r.put(`/${name}/:id`, async (req, res) => {
    const { cols, vals } = values(t, req.body);
    if (cols.includes('slug')) vals[cols.indexOf('slug')] = await uniqueSlug(name, vals[cols.indexOf('slug')] || name, Number(req.params.id));
    if (name === 'categories' && String(req.body.parent_id) === req.params.id) return res.status(400).json({ error: 'A category cannot be its own parent' });
    try {
      const row = await one(`UPDATE ${name} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`, [...vals, req.params.id]);
      if (row && name === 'products' && Array.isArray(req.body.offer_ids)) await syncProductOffers(row.id, req.body.offer_ids);
      row ? res.json(row) : res.status(404).json({ error: 'Not found' });
    } catch (e) { dbError(res, e); }
  });
  // Bulk actions from the table toolbar: switch several rows on/off or delete them in one go.
  r.patch(`/${name}/bulk`, async (req, res) => {
    const ids = (req.body.ids || []).map(Number).filter(Boolean);
    if (!ids.length || typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Nothing to update' });
    await q(`UPDATE ${name} SET active = $1 WHERE id = ANY($2)`, [req.body.active, ids]);
    res.json({ ok: true, count: ids.length });
  });
  r.post(`/${name}/bulk-delete`, async (req, res) => {
    const ids = (req.body.ids || []).map(Number).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Nothing selected' });
    try {
      await q(`DELETE FROM ${name} WHERE id = ANY($1)`, [ids]);
      res.json({ ok: true, count: ids.length });
    } catch (e) { dbError(res, e); }
  });
  r.delete(`/${name}/:id`, async (req, res) => {
    try {
      if (name === 'products') await syncProductOffers(Number(req.params.id), []);
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

// Policy pages (privacy, terms, refund). Empty text in the editor means "use the default wording".
r.get('/settings/policies', async (req, res) => {
  const saved = (await one(`SELECT value FROM settings WHERE key = 'policies'`))?.value || {};
  res.json(POLICY_PAGES.map((p) => ({ ...p, body: saved[p.key] || '', default: DEFAULT_POLICIES[p.key] })));
});
r.put('/settings/policies', async (req, res) => {
  const value = Object.fromEntries(POLICY_PAGES.map((p) => [p.key, String(req.body[p.key] ?? '').trim()]));
  await q(`INSERT INTO settings (key, value) VALUES ('policies', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(value)]);
  res.json({ ok: true });
});

r.get('/orders', async (req, res) => {
  res.json(await q(`SELECT o.*, u.email, u.name AS customer_name, u.role AS customer_role FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 2000`));
});
r.get('/orders/:id', async (req, res) => {
  const order = await one(
    `SELECT o.*, u.email, u.name AS customer_name, u.phone AS customer_phone, u.role AS customer_role, u.id AS customer_id,
            (SELECT count(*) FROM orders x WHERE x.user_id = u.id AND x.payment_status = 'paid')::int AS customer_orders
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [req.params.id]);
  order ? res.json(order) : res.status(404).json({ error: 'Order not found' });
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
    `SELECT ${USER_COLS}, (SELECT count(*) FROM orders o WHERE o.user_id = users.id AND o.payment_status = 'paid')::int AS orders,
            (SELECT coalesce(sum(total), 0) FROM orders o WHERE o.user_id = users.id AND o.payment_status = 'paid')::bigint AS spent,
            (SELECT max(created_at) FROM orders o WHERE o.user_id = users.id AND o.payment_status = 'paid') AS last_order_at
     FROM users ORDER BY id DESC LIMIT 2000`,
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

// Accounts live in Firebase, so creating one goes through Firebase's own sign-up API with the web API key.
// Used to set up dealer accounts from the admin panel; the dealer fills in address details at their first checkout.
const firebaseKey = process.env.FIREBASE_API_KEY || '';
async function firebaseAuth(action, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${firebaseKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message || 'Firebase request failed'), { code: data.error?.message });
  return data;
}

r.post('/users', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const role = ['dealer', 'customer'].includes(req.body.role) ? req.body.role : 'dealer';
  if (!firebaseKey) return res.status(503).json({ error: 'FIREBASE_API_KEY is not set on the server, so accounts cannot be created here' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Phone must be 10 digits' });
  let uid;
  try {
    uid = (await firebaseAuth('signUp', { email, password, returnSecureToken: false })).localId;
  } catch (e) {
    if (e.code !== 'EMAIL_EXISTS') return res.status(400).json({ error: e.message.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) });
    // Already has a login: keep it and just make sure they are set up with the right role here.
    const existing = await one(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) {
      clearRoleCache();
      const user = await one(`UPDATE users SET role = $2, name = CASE WHEN $3 <> '' THEN $3 ELSE name END, phone = CASE WHEN $4 <> '' THEN $4 ELSE phone END WHERE id = $1 RETURNING ${USER_COLS}`, [existing.id, role, name, phone]);
      return res.json({ ...user, existed: true });
    }
    uid = `pending:${email}`;
  }
  const user = await one(
    `INSERT INTO users (firebase_uid, email, name, phone, role) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, phone = EXCLUDED.phone RETURNING ${USER_COLS}`,
    [uid, email, name, phone, role],
  );
  mail.welcome(user);
  res.status(201).json(user);
});

// Emails the account holder a password-reset link (from our own address when the service account is configured).
r.post('/users/:id/reset-password', async (req, res) => {
  const user = await one(`SELECT email, name FROM users WHERE id = $1`, [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    const how = await sendPasswordReset(user.email, user.name);
    res.json({ ok: true, email: user.email, how });
  } catch (e) { res.status(400).json({ error: e.message }); }
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
