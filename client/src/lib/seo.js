import { useEffect, useState } from 'react';
import { api, asset } from './api';
import { SITE } from './site';

// Site-wide SEO settings (home page title/description, default share image) are edited in Admin > SEO.
const DEFAULTS = {
  home_title: `${SITE.name} | Premium Furniture for Home & Office`,
  home_description: `${SITE.name} — premium furniture for home and office. Sofas, beds, dining, storage and workspaces with free delivery and installation.`,
  share_image: '/logo.png',
};
let site = null;
let loading = null;
const loadSite = () => (loading ||= api('/api/seo').then((s) => { site = s; }).catch(() => { site = {}; }));

const absolute = (url) => { const u = asset(url); return u && !/^https?:/.test(u) ? location.origin + u : u; };
const trim = (text, max = 160) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s;
};

function tag(selector, create, attr, value) {
  let el = document.head.querySelector(selector);
  if (!value) return el?.remove();
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}
const meta = (name, value) => tag(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', value);
const og = (key, value) => tag(`meta[property="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute('property', key); return m; }, 'content', value);

/**
 * Sets everything a search engine reads for the current page: title, description, canonical URL, social share
 * tags, robots and structured data. Pass null while the page's data is still loading.
 *   title      — page name; " | Tashwin Furniture" is appended
 *   fullTitle  — an admin-written SEO title, used exactly as typed
 *   home       — use the site-wide title and description from Admin > SEO
 *   noindex    — keep private or duplicate pages (cart, account, search results) out of Google
 *   jsonLd     — schema.org objects for rich results
 */
export function useSeo(opts) {
  const [, loaded] = useState(0);
  useEffect(() => { if (!site) loadSite().then(() => loaded(1)); }, []);
  const key = JSON.stringify(opts ?? null);
  useEffect(() => {
    if (!opts) return;
    const s = { ...DEFAULTS, ...Object.fromEntries(Object.entries(site || {}).filter(([, v]) => v)) };
    const title = opts.home ? s.home_title : opts.fullTitle || (opts.title ? `${opts.title} | ${SITE.name}` : s.home_title);
    const description = trim(opts.description || s.home_description);
    const url = location.origin + (location.pathname.replace(/\/$/, '') || '/');
    const image = absolute(opts.image || s.share_image);
    document.title = title;
    meta('description', description);
    meta('robots', opts.noindex ? 'noindex, nofollow' : 'index, follow');
    tag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', opts.noindex ? '' : url);
    og('og:site_name', SITE.name);
    og('og:type', opts.type || 'website');
    og('og:title', title);
    og('og:description', description);
    og('og:url', url);
    og('og:image', image);
    meta('twitter:card', 'summary_large_image');
    meta('twitter:title', title);
    meta('twitter:description', description);
    meta('twitter:image', image);
    document.getElementById('seo-jsonld')?.remove();
    if (opts.jsonLd?.length) {
      const el = Object.assign(document.createElement('script'), { id: 'seo-jsonld', type: 'application/ld+json' });
      el.textContent = JSON.stringify(opts.jsonLd.length === 1 ? opts.jsonLd[0] : opts.jsonLd);
      document.head.appendChild(el);
    }
  }, [key, site]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const breadcrumbLd = (crumbs) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'Home', path: '/' }, ...crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: location.origin + c.path })),
});

export const productLd = (p) => ({
  '@context': 'https://schema.org', '@type': 'Product',
  name: p.name,
  description: trim(p.seo_description || p.description || p.subtitle, 500),
  image: (p.images || []).map(absolute),
  sku: String(p.id),
  brand: { '@type': 'Brand', name: SITE.name },
  ...(p.material && { material: p.material }),
  ...(p.color && { color: p.color }),
  offers: {
    '@type': 'Offer', url: `${location.origin}/product/${p.slug}`, priceCurrency: 'INR', price: p.price,
    availability: `https://schema.org/${p.stock > 0 ? 'InStock' : 'OutOfStock'}`, itemCondition: 'https://schema.org/NewCondition',
  },
});

export const organizationLd = () => [
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name, url: location.origin, logo: `${location.origin}/logo.png`, email: SITE.email, telephone: SITE.phone, sameAs: Object.values(SITE.social || {}) },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: location.origin,
    potentialAction: { '@type': 'SearchAction', target: `${location.origin}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
];
