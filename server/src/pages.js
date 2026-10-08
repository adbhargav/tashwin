// Serves the built storefront (client/dist) with each page's title, description and share tags already in the HTML.
// WhatsApp, Facebook and other link-preview bots do not run JavaScript, so they only see what is written here;
// once the page loads in a browser, client/src/lib/seo.js keeps the same tags up to date.
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { one } from './db.js';
import { SITE } from './site.js';

const dist = process.env.CLIENT_DIST || fileURLToPath(new URL('../../client/dist', import.meta.url));
const indexFile = `${dist}/index.html`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const trim = (text, max = 160) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s;
};
const absolute = (url) => (url && !/^https?:/.test(url) ? SITE.url + url : url);
const named = (title) => `${title} | ${SITE.name}`;

// Keep these fallbacks in step with DEFAULTS and the page titles in client/src/lib/seo.js and the page components.
async function pageHead(path) {
  const seo = (await one(`SELECT value FROM settings WHERE key = 'seo'`))?.value || {};
  const home = {
    title: seo.home_title || `${SITE.name} | Premium Furniture for Home & Office`,
    description: seo.home_description || `${SITE.name} — premium furniture for home and office. Sofas, beds, dining, storage and workspaces with free delivery and installation.`,
    image: seo.share_image || '/logo.png',
  };
  const [, section, slug] = path.split('/');
  if (section === 'product' && slug) {
    const p = await one(`SELECT name, subtitle, description, images, seo_title, seo_description FROM products WHERE slug = $1 AND active`, [slug]);
    if (!p) return { ...home, title: named('Product not found'), status: 404 };
    return {
      title: p.seo_title || named([p.name, p.subtitle].filter(Boolean).join(' – ')),
      description: p.seo_description || p.description || p.subtitle || home.description,
      image: p.images[0] || home.image, type: 'product',
    };
  }
  if (section === 'c' && slug) {
    const c = await one(`SELECT name, description, image, banner_image, seo_title, seo_description FROM categories WHERE slug = $1 AND active`, [slug]);
    if (!c) return { ...home, title: named('Page not found'), status: 404 };
    return {
      title: c.seo_title || named(`${c.name} — Buy ${c.name} Online`),
      description: c.seo_description || c.description || `Shop ${c.name} at ${SITE.name} with free delivery and installation.`,
      image: c.banner_image || c.image || home.image,
    };
  }
  if (section === 'offers' && slug) {
    const o = await one(`SELECT title, subtitle, image, seo_title, seo_description FROM offers WHERE slug = $1 AND active`, [slug]);
    if (!o) return { ...home, title: named('Page not found'), status: 404 };
    return { title: o.seo_title || named(o.title), description: o.seo_description || o.subtitle || home.description, image: o.image || home.image };
  }
  if (section === 'projects' && slug) {
    const p = await one(`SELECT title, category, location, summary, description, cover_image, images, seo_title, seo_description FROM projects WHERE slug = $1 AND active`, [slug]);
    if (!p) return { ...home, title: named('Project not found'), status: 404 };
    return { title: p.seo_title || named(`${p.title} — ${p.category} project${p.location ? ` in ${p.location}` : ''}`), description: p.seo_description || p.summary || p.description || home.description, image: p.cover_image || p.images[0] || home.image, type: 'article' };
  }
  if (section === 'projects') return { ...home, title: named('Our Projects'), description: `Offices, homes and showrooms furnished by ${SITE.name}. See our completed projects.` };
  if (section === 'offers') return { ...home, title: named('Furniture Offers & Deals'), description: `Current offers and discounts on sofas, beds, dining and office furniture at ${SITE.name}.` };
  const policy = { 'privacy-policy': 'Privacy Policy', 'terms-and-conditions': 'Terms & Conditions', 'refund-policy': 'Refund & Return Policy' }[section];
  if (policy) return { ...home, title: named(policy), description: `${policy} of ${SITE.name}.` };
  if (section === 'support') return { ...home, title: named('Support & Contact') };
  return home;
}

function render(template, path, head) {
  const url = SITE.url + (path.replace(/\/$/, '') || '/');
  const description = trim(head.description);
  const image = absolute(head.image);
  const tags = [
    `<title>${esc(head.title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    ...Object.entries({
      'og:site_name': SITE.name, 'og:type': head.type || 'website', 'og:title': head.title, 'og:description': description, 'og:url': url, 'og:image': image,
    }).map(([k, v]) => `<meta property="${k}" content="${esc(v)}" />`),
    ...Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': head.title, 'twitter:description': description, 'twitter:image': image })
      .map(([k, v]) => `<meta name="${k}" content="${esc(v)}" />`),
  ].join('\n    ');
  return template.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace('</head>', `  ${tags}\n  </head>`);
}

const cache = new Map();
export const clearPageCache = () => cache.clear();

// Mounted last: static build files first, then every other page URL gets the HTML shell with its own tags.
export function servePages(app) {
  if (!existsSync(indexFile)) return false;
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use(async (req, res, next) => {
    // Not a page: API calls, uploads, and missing files such as an old /assets/x.js.
    if (req.method !== 'GET' || /^\/(api|uploads)(\/|$)/.test(req.path) || /\.\w+$/.test(req.path)) return next();
    let hit = cache.get(req.path);
    if (!(hit?.expires > Date.now())) {
      const head = await pageHead(req.path);
      // Read the build each time so a new `npm run build` is picked up without restarting the server.
      hit = { status: head.status || 200, html: render(readFileSync(indexFile, 'utf8'), req.path, head), expires: Date.now() + 60 * 1000 };
      cache.set(req.path, hit);
    }
    res.status(hit.status).type('html').send(hit.html);
  });
  return true;
}
