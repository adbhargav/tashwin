import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { migrate, q } from './db.js';
import { mail } from './mail.js';
import { SITE } from './site.js';
import publicRoutes, { clearCache } from './routes/public.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import { clearPageCache, servePages } from './pages.js';
import webhookRoutes from './routes/webhooks.js';
import { fetchUpload, localDir, publicUrl, r2Enabled } from './storage.js';

const app = express();
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5180').split(',') }));
// Webhooks must see the raw request body for signature checks, so they are mounted before the JSON parser.
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));
// Uploaded files: redirect to the bucket's public URL when there is one, otherwise stream them from R2;
// without R2 configured (local development) serve the uploads folder.
if (r2Enabled) {
  app.get('/uploads/:key', async (req, res) => {
    const key = req.params.key;
    if (!/^[\w.-]+$/.test(key)) return res.status(404).end();
    if (publicUrl) return res.redirect(301, `${publicUrl}/${key}`);
    try {
      const obj = await fetchUpload(key);
      res.set({ 'Content-Type': obj.ContentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', ...(obj.ContentLength && { 'Content-Length': obj.ContentLength }) });
      obj.Body.pipe(res);
    } catch (e) {
      res.status(e.$metadata?.httpStatusCode === 404 || e.name === 'NoSuchKey' ? 404 : 502).end();
    }
  });
} else {
  app.use('/uploads', express.static(localDir, { maxAge: '30d' }));
}

// Any write may change what the storefront shows, so drop cached catalogue responses.
// (Saving a shopper's cart happens constantly and changes nothing on the storefront, so it is left out.)
app.use('/api', (req, res, next) => { if (req.method !== 'GET' && req.path !== '/me/cart') { clearCache(); clearPageCache(); } next(); });

// Search engines: every public page is listed in the sitemap; private pages are kept out of the index.
// In production these two paths must reach this server from the site's own domain (same as /api and /uploads).
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n${['admin', 'account', 'cart', 'checkout', 'login', 'search'].map((p) => `Disallow: /${p}`).join('\n')}\n\nSitemap: ${SITE.url}/sitemap.xml\n`,
  );
});
app.get('/sitemap.xml', async (req, res) => {
  const [categories, offers, products, projects] = await Promise.all([
    q(`SELECT slug FROM categories WHERE active ORDER BY id`),
    q(`SELECT slug FROM offers WHERE active ORDER BY id`),
    q(`SELECT slug, created_at FROM products WHERE active ORDER BY id`),
    q(`SELECT slug, created_at FROM projects WHERE active ORDER BY id`),
  ]);
  const url = (path, priority, lastmod) =>
    `<url><loc>${SITE.url}${path}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`;
  const urls = [
    url('/', '1.0'), url('/offers', '0.7'), url('/projects', '0.7'), url('/support', '0.3'),
    url('/privacy-policy', '0.2'), url('/terms-and-conditions', '0.2'), url('/refund-policy', '0.2'),
    ...categories.map((c) => url(`/c/${c.slug}`, '0.8')),
    ...offers.map((o) => url(`/offers/${o.slug}`, '0.6')),
    ...projects.map((p) => url(`/projects/${p.slug}`, '0.6', p.created_at)),
    ...products.map((p) => url(`/product/${p.slug}`, '0.9', p.created_at)),
  ];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
});

app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);
app.use('/api', userRoutes);
// When the storefront has been built (client/dist), this server also serves the site itself.
servePages(app);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Unpaid orders left sitting get one "complete your order" email (and an alert to the admins).
async function remindIncompleteOrders() {
  const minutes = Number(process.env.INCOMPLETE_ORDER_MINUTES) || 30;
  const orders = await q(
    `UPDATE orders o SET reminder_sent_at = now() FROM users u
     WHERE u.id = o.user_id AND o.payment_status = 'unpaid' AND o.status = 'pending' AND o.reminder_sent_at IS NULL
       AND o.created_at < now() - make_interval(mins => $1) AND o.created_at > now() - interval '7 days'
     RETURNING o.*, u.email`,
    [minutes],
  );
  for (const o of orders) { mail.orderIncomplete(o, o.email); mail.adminIncompleteOrder(o, o.email); }
}

const port = process.env.PORT || 4000;
await migrate();
// Open a few database connections up front so the first visitors do not wait for them.
await Promise.all(Array.from({ length: 5 }, () => q('SELECT 1')));
setInterval(() => remindIncompleteOrders().catch((e) => console.error(e)), 60 * 1000);
app.listen(port, () => console.log(`Tashwin API on http://localhost:${port}`));
