import { Router } from 'express';
import { q, one } from '../db.js';
import { checkAdminLogin, devAuthEnabled, signAdminToken, signDevToken, viewer } from '../auth.js';
import { sendPasswordReset } from '../reset.js';
import { DEFAULT_POLICIES, POLICY_PAGES } from '../policies.js';

const r = Router();

// The database is a network hop away, so catalogue responses are cached in memory for a minute.
// Any write (admin edit, order, payment) clears the cache — see index.js.
const cache = new Map();
export const clearCache = () => cache.clear();
function cached(req, res, next) {
  const key = (req.dealer ? 'dealer ' : '') + req.originalUrl;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return res.json(hit.body);
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) cache.set(key, { body, expires: Date.now() + 60 * 1000 });
    return json(body);
  };
  next();
}

// Dealers / distributors pay products.dealer_price where one is set; everything else about the catalogue is the same.
// Select with productCols(dealer), then pass the rows through priced() so `price` is what this viewer pays
// and the dealer price never reaches ordinary customers.
const priceSql = (dealer) => (dealer ? 'coalesce(p.dealer_price, p.price)' : 'p.price');
const discountSql = (dealer) => `(CASE WHEN p.mrp > ${priceSql(dealer)} THEN round((p.mrp - ${priceSql(dealer)}) * 100.0 / p.mrp) ELSE 0 END)`;
export const productCols = (dealer) => `p.*, ${priceSql(dealer)} AS shown_price, ${discountSql(dealer)}::int AS discount`;
// Dealers also get the normal selling price as `retail_price` so the storefront can show what they are saving.
export const priced = (rows, dealer) => rows.map(({ shown_price, dealer_price, ...p }) => {
  const dealer_pricing = Boolean(dealer && dealer_price != null);
  return { ...p, price: shown_price, dealer_pricing, ...(dealer_pricing && { retail_price: p.price }) };
});
const subtree = (n) =>
  `p.category_id IN (WITH RECURSIVE t AS (SELECT id FROM categories WHERE id = $${n}
     UNION ALL SELECT c.id FROM categories c JOIN t ON c.parent_id = t.id) SELECT id FROM t)`;

async function breadcrumb(categoryId) {
  if (!categoryId) return [];
  return q(
    `WITH RECURSIVE t AS (SELECT id, parent_id, name, slug, 0 AS depth FROM categories WHERE id = $1
       UNION ALL SELECT c.id, c.parent_id, c.name, c.slug, t.depth + 1 FROM categories c JOIN t ON c.id = t.parent_id)
     SELECT name, slug FROM t ORDER BY depth DESC`,
    [categoryId],
  );
}

r.get('/config', (req, res) => {
  res.json({ razorpayKeyId: process.env.RAZORPAY_KEY_ID || null, devAuth: devAuthEnabled });
});

r.post('/auth/dev-login', async (req, res) => {
  if (!devAuthEnabled) return res.status(404).json({ error: 'Not found' });
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  res.json({ token: await signDevToken(email, req.body.name || email.split('@')[0]) });
});

// Admin panel password sign-in. Five wrong attempts lock that address out for 15 minutes.
const failures = new Map();
r.post('/auth/admin-login', async (req, res) => {
  const now = Date.now();
  const f = failures.get(req.ip);
  if (f && f.count >= 5 && now - f.at < 15 * 60_000) return res.status(429).json({ error: 'Too many attempts — please try again later' });
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!(await checkAdminLogin(email, req.body.password || ''))) {
    failures.set(req.ip, { count: f && now - f.at < 15 * 60_000 ? f.count + 1 : 1, at: now });
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  failures.delete(req.ip);
  res.json({ token: await signAdminToken(email) });
});

r.get('/policies', cached, async (req, res) => {
  const saved = (await one(`SELECT value FROM settings WHERE key = 'policies'`))?.value || {};
  res.json(POLICY_PAGES.map((p) => ({ ...p, body: saved[p.key] || DEFAULT_POLICIES[p.key] })));
});

r.get('/seo', cached, async (req, res) => {
  res.json((await one(`SELECT value FROM settings WHERE key = 'seo'`))?.value || {});
});

// "Forgot password" on the store. The reply is the same whether or not the email exists, so it cannot be used to
// check who has an account; a wrong address simply gets no email. Five requests per address per 15 minutes.
const resetRequests = new Map();
r.post('/auth/forgot', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  const now = Date.now();
  const hits = (resetRequests.get(req.ip) || []).filter((t) => now - t < 15 * 60_000);
  if (hits.length >= 5) return res.status(429).json({ error: 'Too many attempts — please try again later' });
  resetRequests.set(req.ip, [...hits, now]);
  try {
    const user = await one(`SELECT name FROM users WHERE email = $1`, [email]);
    await sendPasswordReset(email, user?.name);
  } catch (e) {
    if (!/No account/.test(e.message)) return res.status(503).json({ error: e.message });
  }
  res.json({ ok: true });
});

r.get('/categories', cached, async (req, res) => {
  res.json(await q(`SELECT * FROM categories WHERE active ORDER BY sort_order, id`));
});

r.get('/home', viewer, cached, async (req, res) => {
  const cols = productCols(req.dealer);
  const [banners, popular, offers, bestSellers, newArrivals, projects] = await Promise.all([
    q(`SELECT * FROM banners WHERE active ORDER BY sort_order, id`),
    q(`SELECT * FROM categories WHERE active AND show_on_home ORDER BY sort_order, id`),
    q(`SELECT * FROM offers WHERE active ORDER BY sort_order, id`),
    q(`SELECT ${cols} FROM products p WHERE p.active AND p.featured ORDER BY p.id DESC LIMIT 12`),
    q(`SELECT ${cols} FROM products p WHERE p.active ORDER BY p.created_at DESC, p.id DESC LIMIT 12`),
    q(`SELECT id, title, slug, category, location, summary, cover_image FROM projects WHERE active AND featured ORDER BY sort_order, id DESC LIMIT 3`),
  ]);
  res.json({ banners, popular, offers, projects, bestSellers: priced(bestSellers, req.dealer), newArrivals: priced(newArrivals, req.dealer) });
});

r.get('/projects', cached, async (req, res) => {
  res.json(await q(`SELECT id, title, slug, category, client, location, completed_on, summary, cover_image, featured FROM projects WHERE active ORDER BY featured DESC, sort_order, id DESC`));
});
r.get('/projects/:slug', cached, async (req, res) => {
  const project = await one(`SELECT * FROM projects WHERE slug = $1 AND active`, [req.params.slug]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const more = await q(`SELECT id, title, slug, category, location, cover_image FROM projects WHERE active AND id <> $1 ORDER BY (category = $2) DESC, sort_order, id DESC LIMIT 3`, [project.id, project.category]);
  res.json({ project, more });
});

r.get('/offers', cached, async (req, res) => {
  res.json(await q(`SELECT * FROM offers WHERE active ORDER BY sort_order, id`));
});

// One listing endpoint backs category pages, offer pages and search.
r.get('/products', viewer, cached, async (req, res) => {
  const PRICE = priceSql(req.dealer);
  const DISCOUNT = discountSql(req.dealer);
  const { category, offer, q: search, sort, material, color, minPrice, maxPrice, inStock } = req.query;
  const where = ['p.active'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  let page = null;
  let extras = null;
  let pickedOrder = null;

  if (category) {
    const cat = await one(`SELECT * FROM categories WHERE slug = $1 AND active`, [category]);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    page = { type: 'category', ...cat };
    extras = Promise.all([
      breadcrumb(cat.id),
      q(`SELECT * FROM categories WHERE parent_id = $1 AND active ORDER BY sort_order, id`, [cat.id]),
    ]).then(([crumbs, children]) => { page.breadcrumb = crumbs; page.children = children; });
    params.push(cat.id); where.push(subtree(params.length));
  } else if (offer) {
    const off = await one(`SELECT * FROM offers WHERE slug = $1 AND active`, [offer]);
    if (!off) return res.status(404).json({ error: 'Offer not found' });
    page = { type: 'offer', ...off, name: off.title, description: off.description || off.subtitle, breadcrumb: [] };
    // An offer lists every product matching its discount rule plus any hand-picked products, picked ones first.
    const picked = (off.product_ids || []).map(Number).filter(Boolean);
    params.push(off.min_discount);
    let rule = `${DISCOUNT} >= $${params.length}`;
    if (off.category_id) { params.push(off.category_id); rule += ` AND ${subtree(params.length)}`; }
    if (picked.length) { params.push(picked); where.push(`((${rule}) OR p.id = ANY($${params.length}))`); pickedOrder = picked; } else where.push(rule);
  }
  if (search) add(`(p.name || ' ' || p.subtitle || ' ' || p.material) ILIKE ?`, `%${search}%`);

  // Facets come from the page's full product set, before the shopper's own filters narrow it.
  const base = where.join(' AND ');
  const baseParams = [...params];
  const facetsQuery = one(
    `SELECT coalesce(array_agg(DISTINCT p.material) FILTER (WHERE p.material <> ''), '{}') AS materials,
            coalesce(array_agg(DISTINCT p.color) FILTER (WHERE p.color <> ''), '{}') AS colors,
            coalesce(min(${PRICE}), 0) AS min_price, coalesce(max(${PRICE}), 0) AS max_price
     FROM products p WHERE ${base}`,
    baseParams,
  );

  if (material) add(`p.material = ANY(?)`, String(material).split(','));
  if (color) add(`p.color = ANY(?)`, String(color).split(','));
  if (minPrice) add(`${PRICE} >= ?`, Number(minPrice) || 0);
  if (maxPrice) add(`${PRICE} <= ?`, Number(maxPrice) || 0);
  if (inStock === '1') where.push(`p.stock > 0`);

  const order = {
    price_asc: `${PRICE} ASC`, price_desc: `${PRICE} DESC`, new: 'p.created_at DESC, p.id DESC', discount: `${DISCOUNT} DESC`,
  }[sort] || 'p.featured DESC, p.id DESC';
  const [facets, items] = await Promise.all([
    facetsQuery,
    q(`SELECT ${productCols(req.dealer)} FROM products p WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 120`, params),
    extras,
  ]);
  if (pickedOrder && !sort) {
    const rank = (p) => { const i = pickedOrder.indexOf(p.id); return i === -1 ? pickedOrder.length : i; };
    items.sort((a, b) => rank(a) - rank(b));
  }
  res.json({ page, items: priced(items, req.dealer), total: items.length, facets });
});

// Current price and stock for the products in a shopper's cart, so a saved cart follows price changes and dealer pricing.
r.get('/cart-prices', viewer, async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean).slice(0, 200);
  const rows = await q(`SELECT ${productCols(req.dealer)} FROM products p WHERE p.id = ANY($1) AND p.active`, [ids]);
  res.json(priced(rows, req.dealer).map((p) => ({ id: p.id, price: p.price, mrp: p.mrp, stock: p.stock })));
});

r.get('/products/:slug', viewer, cached, async (req, res) => {
  const cols = productCols(req.dealer);
  const [product] = priced(await q(`SELECT ${cols} FROM products p WHERE p.slug = $1 AND p.active`, [req.params.slug]), req.dealer);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const [crumbs, related] = await Promise.all([
    breadcrumb(product.category_id),
    q(`SELECT ${cols} FROM products p WHERE p.active AND p.category_id = $1 AND p.id <> $2 ORDER BY p.id DESC LIMIT 8`,
      [product.category_id, product.id]),
  ]);
  res.json({ product, breadcrumb: crumbs, related: priced(related, req.dealer) });
});

export default r;
