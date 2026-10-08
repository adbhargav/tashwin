import { api, asset, inr } from '../lib/api';
import { IMAGE_SIZES } from '../lib/site';
import { Pill } from './ui';

const Thumb = ({ src, wide }) => (
  <div className={`h-11 ${wide ? 'w-20' : 'w-11'} rounded-md bg-soft overflow-hidden shrink-0`}>{src && <img src={asset(src)} alt="" className="w-full h-full object-cover" />}</div>
);
const Dot = ({ on }) => <span className={`inline-block w-2.5 h-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-[#ccc]'}`} title={on ? 'Yes' : 'No'} />;
const NameCell = ({ image, name, sub, wide }) => (
  <div className="flex items-center gap-3 min-w-[200px] max-w-[360px]"><Thumb src={image} wide={wide} /><div className="min-w-0"><p className="font-medium truncate">{name}</p>{sub && <p className="text-xs text-body truncate">{sub}</p>}</div></div>
);

// Flatten the category tree depth-first so tables and dropdowns read like the storefront menu.
export function orderedCategories(rows) {
  const out = [];
  const walk = (parentId, depth) => rows.filter((c) => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .forEach((c) => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
  walk(null, 0);
  return out;
}
const categoryOptions = (rows, maxDepth = 2) => orderedCategories(rows).filter((c) => c.depth <= maxDepth).map((c) => [c.id, c.name, c.depth]);
const loadProductContext = async () => {
  const [categories, offers] = await Promise.all([api('/api/admin/categories'), api('/api/admin/offers')]);
  return { categories, offers };
};
const loadOfferContext = async () => {
  const [categories, products] = await Promise.all([api('/api/admin/categories'), api('/api/admin/products')]);
  return { categories, products };
};
const loadDestinations = async () => {
  const [categories, offers, projects] = await Promise.all([api('/api/admin/categories'), api('/api/admin/offers'), api('/api/admin/projects')]);
  return { categories, offers, projects };
};
// Where a banner can send the visitor, in plain words. The admin can still type any other address.
const destinationOptions = (ctx) => [
  ['/', 'Home page'], ['/offers', 'All offers'], ['/search?sort=new', 'New arrivals'], ['/projects', 'Our projects'], ['/support', 'Support / contact'],
  ...orderedCategories(ctx.categories || []).map((c) => [`/c/${c.slug}`, `${'Category: '.repeat(c.depth === 0 ? 1 : 0)}${c.name}`, c.depth]),
  ...(ctx.offers || []).map((o) => [`/offers/${o.slug}`, `Offer: ${o.title}`]),
  ...(ctx.projects || []).map((p) => [`/projects/${p.slug}`, `Project: ${p.title}`]),
];
const LEVELS = ['Department', 'Group', 'Page'];
export const PROJECT_TYPES = ['Office', 'Home', 'Showroom', 'Hospitality', 'Education', 'Other'];
// Suggested types plus any the admin has already typed in, so new ones stay available.
const projectTypes = (ctx) => [...new Set([...PROJECT_TYPES, ...(ctx.rows || []).map((r) => r.category).filter(Boolean)])].map((t) => [t, t]);
const catName = (ctx, id) => ctx.categories?.find((c) => c.id === id)?.name;
const SEO_FIELDS = (nameLabel, descLabel) => [
  { section: 'Search engine listing' },
  { key: 'seo_title', label: 'SEO title (the headline shown on Google)', count: 60, placeholder: `Leave empty to use: ${nameLabel} | Tashwin Furniture`, hint: 'Put the main search words first.' },
  { key: 'seo_description', label: 'SEO description (the text under the headline on Google)', type: 'textarea', count: 160, hint: `Leave empty to use the ${descLabel}.` },
];
const activeFilter = { key: 'active', label: 'Status', options: [['1', 'Active'], ['0', 'Inactive']], test: (r, v) => String(r.active ? 1 : 0) === v };

export const CONFIGS = {
  categories: {
    resource: 'categories', title: 'Categories', singular: 'Category',
    help: 'Three levels: Department (navbar item) → Group (mega-menu column) → Page. Every category automatically gets its own storefront page at /c/its-slug.',
    rows: orderedCategories,
    defaults: { parent_id: '', name: '', slug: '', image: '', banner_image: '', description: '', show_in_nav: true, show_on_home: false, sort_order: 0, active: true, seo_title: '', seo_description: '' },
    columns: [
      { key: 'name', label: 'Category', nowrap: false, sort: (r) => r.name, render: (r) => (
        <div className="flex items-center gap-3" style={{ paddingLeft: r.depth * 22 }}><Thumb src={r.image} wide /><span className={r.depth === 0 ? 'font-medium' : ''}>{r.depth > 0 && '└ '}{r.name}</span></div>) },
      { key: 'depth', label: 'Level', render: (r) => <Pill tone={['brand', 'blue', 'gray'][r.depth]}>{LEVELS[r.depth]}</Pill> },
      { key: 'slug', label: 'Page URL', render: (r) => <a href={`/c/${r.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">/c/{r.slug}</a> },
      { key: 'show_in_nav', label: 'Navbar', sort: (r) => (r.show_in_nav ? 1 : 0), render: (r) => <Dot on={r.show_in_nav} /> },
      { key: 'show_on_home', label: 'Home', sort: (r) => (r.show_on_home ? 1 : 0), render: (r) => <Dot on={r.show_on_home} /> },
      { key: 'sort_order', label: 'Order', align: 'right' },
    ],
    filters: [
      { key: 'depth', label: 'Level', options: LEVELS.map((l, i) => [String(i), l]), test: (r, v) => String(r.depth) === v },
      { key: 'show_on_home', label: 'Home page', options: [['1', 'Shown on home'], ['0', 'Not on home']], test: (r, v) => String(r.show_on_home ? 1 : 0) === v },
      activeFilter,
    ],
    csv: [{ label: 'ID', value: 'id' }, { label: 'Name', value: 'name' }, { label: 'Level', value: (r) => LEVELS[r.depth] }, { label: 'Slug', value: 'slug' }, { label: 'Sort order', value: 'sort_order' }, { label: 'Active', value: (r) => (r.active ? 'yes' : 'no') }, { label: 'SEO title', value: 'seo_title' }, { label: 'SEO description', value: 'seo_description' }],
    fields: [
      { key: 'parent_id', label: 'Parent category', type: 'select', half: true, empty: 'None — this is a department', options: (ctx, form) => categoryOptions((ctx.categories || []).filter((c) => c.id !== form.id), 1), hint: 'Departments have no parent. Groups sit under a department, pages under a group.' },
      { key: 'name', label: 'Name', required: true, half: true },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true, hint: 'Lower numbers appear first' },
      { key: 'image', label: 'Card image', type: 'image', size: IMAGE_SIZES.categoryCard },
      { key: 'banner_image', label: 'Page banner (optional)', type: 'image', size: IMAGE_SIZES.categoryBanner },
      { key: 'description', label: 'Page description', type: 'textarea' },
      { key: 'show_in_nav', label: 'Show in navbar (departments)', type: 'checkbox' },
      { key: 'show_on_home', label: 'Show in “Popular Categories” on the home page', type: 'checkbox' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
      ...SEO_FIELDS('Name', 'page description'),
    ],
  },

  products: {
    resource: 'products', title: 'Products', singular: 'Product', ctxLoad: loadProductContext,
    defaults: { category_id: '', name: '', subtitle: '', slug: '', description: '', price: '', mrp: '', dealer_price: '', images: [], tag: '', material: '', color: '', dimensions: '', care: '', warranty: '', stock: 0, featured: false, active: true, seo_title: '', seo_description: '' },
    columns: [
      { key: 'name', label: 'Product', nowrap: false, sort: (r) => r.name, render: (r) => <NameCell image={r.images[0]} name={r.name} sub={r.subtitle} /> },
      { key: 'category_id', label: 'Category', sort: (r) => r.category_name || '', render: (r) => <span className="text-body">{r.category_name || '—'}</span> },
      { key: 'price', label: 'Price', align: 'right', render: (r) => <>{inr(r.price)}{r.mrp > r.price && <del className="block text-xs text-body">{inr(r.mrp)}</del>}</> },
      { key: 'dealer_price', label: 'Dealer price', align: 'right', render: (r) => (r.dealer_price != null ? inr(r.dealer_price) : <span className="text-mute">—</span>) },
      { key: 'stock', label: 'Stock', align: 'right', render: (r) => (r.stock <= 0 ? <Pill tone="red">Out of stock</Pill> : r.stock <= 3 ? <Pill tone="amber">{r.stock} left</Pill> : r.stock) },
      { key: 'featured', label: 'Best seller', sort: (r) => (r.featured ? 1 : 0), render: (r) => <Dot on={r.featured} /> },
      { key: 'offer_names', label: 'In offers', nowrap: false, sort: (r) => r.offer_ids.length, render: (r) => (r.offer_names.length ? <span className="text-xs">{r.offer_names.join(', ')}</span> : <span className="text-mute">—</span>) },
    ],
    filters: [
      { key: 'category', label: 'Category', options: (ctx) => categoryOptions(ctx.categories || []), test: (r, v, ctx) => {
        // A department or group filter includes everything beneath it.
        const ids = new Set([Number(v)]);
        let grew = true;
        while (grew) { grew = false; for (const c of ctx.categories || []) if (ids.has(c.parent_id) && !ids.has(c.id)) { ids.add(c.id); grew = true; } }
        return ids.has(r.category_id);
      } },
      { key: 'stock', label: 'Stock', options: [['in', 'In stock'], ['low', 'Low (1–3)'], ['out', 'Out of stock']], test: (r, v) => (v === 'out' ? r.stock <= 0 : v === 'low' ? r.stock > 0 && r.stock <= 3 : r.stock > 3) },
      { key: 'featured', label: 'Best seller', options: [['1', 'Best sellers'], ['0', 'Others']], test: (r, v) => String(r.featured ? 1 : 0) === v },
      { key: 'dealer', label: 'Dealer price', options: [['1', 'Has dealer price'], ['0', 'No dealer price']], test: (r, v) => String(r.dealer_price != null ? 1 : 0) === v },
      { key: 'offer', label: 'Offer', options: (ctx) => (ctx.offers || []).map((o) => [String(o.id), o.title]), test: (r, v) => r.offer_ids.includes(Number(v)) },
      activeFilter,
    ],
    csv: [{ label: 'ID', value: 'id' }, { label: 'Name', value: 'name' }, { label: 'Subtitle', value: 'subtitle' }, { label: 'Category', value: 'category_name' }, { label: 'Slug', value: 'slug' }, { label: 'Price', value: 'price' }, { label: 'MRP', value: 'mrp' }, { label: 'Dealer price', value: 'dealer_price' }, { label: 'Stock', value: 'stock' }, { label: 'Material', value: 'material' }, { label: 'Colour', value: 'color' }, { label: 'Best seller', value: (r) => (r.featured ? 'yes' : 'no') }, { label: 'Active', value: (r) => (r.active ? 'yes' : 'no') }, { label: 'Image URL', value: (r) => r.images[0] || '' }],
    fields: [
      { key: 'name', label: 'Name', required: true, half: true },
      { key: 'subtitle', label: 'Short description line', half: true, placeholder: 'Leather 3 Seater Sofa in Tan' },
      { key: 'category_id', label: 'Category', type: 'select', required: true, half: true, options: (ctx) => [['', 'Select a category'], ...categoryOptions(ctx.categories || [])] },
      { section: 'Pricing & stock' },
      { key: 'price', label: 'Selling price (₹)', type: 'number', required: true, half: true },
      { key: 'mrp', label: 'MRP (₹)', type: 'number', half: true, hint: 'The “% off” is calculated from MRP and selling price' },
      { key: 'dealer_price', label: 'Dealer / distributor price (₹)', type: 'number', half: true, hint: 'Shown instead of the selling price to users marked as Dealer. Leave empty to charge dealers the normal price.' },
      { key: 'stock', label: 'Stock quantity', type: 'number', half: true },
      { section: 'Photos & details' },
      { key: 'images', label: 'Product images', type: 'images', size: IMAGE_SIZES.product },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'material', label: 'Material', half: true, hint: 'Used by the Material filter' },
      { key: 'color', label: 'Colour', half: true, hint: 'Used by the Colour filter' },
      { key: 'dimensions', label: 'Dimensions', half: true },
      { key: 'warranty', label: 'Warranty', half: true },
      { key: 'care', label: 'Material and care', type: 'textarea' },
      { key: 'tag', label: 'Badge on card', half: true, placeholder: 'Best Seller, New Arrival…' },
      { key: 'featured', label: 'Show in “Best Sellers” on the home page', type: 'checkbox' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
      { section: 'Offers' },
      { key: 'offer_ids', label: 'Show this product in these offers', type: 'checks', options: (ctx) => (ctx.offers || []).map((o) => [o.id, o.title, o.active ? '' : 'inactive']), emptyText: 'No offers yet — create one on the Offers page first.', hint: 'Ticked offers list this product at the top of their page, alongside anything their discount rule picks up.' },
      ...SEO_FIELDS('Name – Short description line', 'product description'),
    ],
  },

  offers: {
    resource: 'offers', title: 'Offers', singular: 'Offer', ctxLoad: loadOfferContext,
    help: 'Each offer is a card on the home page and the Offers page, and opens its own page with a banner and products: the hand-picked ones first, then everything its discount rule picks up.',
    defaults: { title: '', slug: '', subtitle: '', description: '', image: '', banner_image: '', product_ids: [], min_discount: 0, category_id: '', sort_order: 0, active: true, seo_title: '', seo_description: '' },
    columns: [
      { key: 'title', label: 'Offer', nowrap: false, sort: (r) => r.title, render: (r) => <NameCell image={r.image} name={r.title} sub={r.subtitle} /> },
      { key: 'product_ids', label: 'Products', nowrap: false, sort: (r) => r.product_ids.length, render: (r) => <span className="text-xs">{r.product_ids.length > 0 && <><Pill tone="brand">{r.product_ids.length} hand-picked</Pill> + </>}<span className="text-body">rule: ≥ {r.min_discount}% off{r.category_name ? ` in ${r.category_name}` : ''}</span></span> },
      { key: 'slug', label: 'Page URL', render: (r) => <a href={`/offers/${r.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">/offers/{r.slug}</a> },
      { key: 'sort_order', label: 'Order', align: 'right' },
    ],
    filters: [
      { key: 'mode', label: 'Products', options: [['picked', 'Hand-picked'], ['rule', 'Discount rule']], test: (r, v) => (v === 'picked') === r.product_ids.length > 0 },
      activeFilter,
    ],
    csv: [{ label: 'ID', value: 'id' }, { label: 'Title', value: 'title' }, { label: 'Subtitle', value: 'subtitle' }, { label: 'Hand-picked products', value: (r) => r.product_ids.length }, { label: 'Min discount %', value: 'min_discount' }, { label: 'Category', value: (r) => r.category_name || 'All' }, { label: 'Slug', value: 'slug' }, { label: 'Active', value: (r) => (r.active ? 'yes' : 'no') }],
    fields: [
      { key: 'title', label: 'Title', required: true, half: true },
      { key: 'subtitle', label: 'Subtitle', half: true, placeholder: 'Up to 45% off on beds' },
      { key: 'description', label: 'Text under the heading on the offer page', type: 'textarea' },
      { key: 'image', label: 'Offer card image', type: 'image', size: IMAGE_SIZES.offer },
      { key: 'banner_image', label: 'Offer page banner', type: 'image', size: IMAGE_SIZES.offerBanner },
      { section: 'Products in this offer' },
      { key: 'product_ids', label: 'Hand-picked products', type: 'products', hint: 'These show first on the offer page, in this order. Products can also be added from their own edit form.' },
      { key: 'min_discount', label: 'Rule: minimum discount %', type: 'number', half: true, hint: 'Every product with at least this % off is listed too. Set 100 to show only the hand-picked products.' },
      { key: 'category_id', label: 'Rule: limit to category', type: 'select', half: true, empty: 'All categories', options: (ctx) => categoryOptions(ctx.categories || []) },
      { section: 'Display' },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
      ...SEO_FIELDS('Title', 'subtitle'),
    ],
  },

  projects: {
    resource: 'projects', title: 'Projects', singular: 'Project',
    help: 'Completed work shown on the “Our Projects” page. Featured projects also appear on the home page.',
    defaults: { title: '', slug: '', category: 'Office', client: '', location: '', completed_on: '', summary: '', description: '', cover_image: '', images: [], video: '', featured: false, sort_order: 0, active: true, seo_title: '', seo_description: '' },
    columns: [
      { key: 'title', label: 'Project', nowrap: false, sort: (r) => r.title, render: (r) => <NameCell image={r.cover_image} name={r.title} sub={[r.client, r.location].filter(Boolean).join(' · ')} wide /> },
      { key: 'category', label: 'Type', render: (r) => <Pill tone={{ Office: 'blue', Home: 'brand', Showroom: 'purple', Hospitality: 'amber' }[r.category] || 'gray'}>{r.category}</Pill> },
      { key: 'completed_on', label: 'Completed', render: (r) => r.completed_on || '—' },
      { key: 'images', label: 'Photos', align: 'right', sort: (r) => r.images.length, render: (r) => `${r.images.length}${r.video ? ' + video' : ''}` },
      { key: 'slug', label: 'Page URL', render: (r) => <a href={`/projects/${r.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">/projects/{r.slug}</a> },
      { key: 'featured', label: 'On home', sort: (r) => (r.featured ? 1 : 0), render: (r) => <Dot on={r.featured} /> },
    ],
    filters: [
      { key: 'category', label: 'Type', options: projectTypes, test: (r, v) => r.category === v },
      { key: 'featured', label: 'Home page', options: [['1', 'Featured on home'], ['0', 'Not featured']], test: (r, v) => String(r.featured ? 1 : 0) === v },
      activeFilter,
    ],
    csv: [{ label: 'ID', value: 'id' }, { label: 'Title', value: 'title' }, { label: 'Type', value: 'category' }, { label: 'Client', value: 'client' }, { label: 'Location', value: 'location' }, { label: 'Completed', value: 'completed_on' }, { label: 'Slug', value: 'slug' }, { label: 'Featured', value: (r) => (r.featured ? 'yes' : 'no') }, { label: 'Active', value: (r) => (r.active ? 'yes' : 'no') }],
    fields: [
      { key: 'title', label: 'Project title', required: true, half: true, placeholder: 'Corporate office, HITEC City' },
      { key: 'category', label: 'Type', type: 'select', required: true, half: true, creatable: true, options: projectTypes, hint: 'Pick one or type a new type and press Enter.' },
      { key: 'client', label: 'Client (optional)', half: true, placeholder: 'Company or family name' },
      { key: 'location', label: 'Location', half: true, placeholder: 'Hyderabad' },
      { key: 'completed_on', label: 'Completed', half: true, placeholder: 'March 2026' },
      { key: 'summary', label: 'One-line summary', placeholder: '120 workstations, 6 cabins and a boardroom delivered in 3 weeks', hint: 'Shown on the project card and on the home page.' },
      { key: 'description', label: 'The story', type: 'textarea', hint: 'What the client needed, what was supplied, anything notable. Blank lines start new paragraphs.' },
      { section: 'Photos & video' },
      { key: 'cover_image', label: 'Cover photo', type: 'image', size: IMAGE_SIZES.projectCover },
      { key: 'images', label: 'Gallery photos', type: 'images', size: IMAGE_SIZES.projectPhoto },
      { key: 'video', label: 'Walkthrough video (optional)', type: 'video', hint: 'MP4 or WebM up to 60 MB, or paste a YouTube link.' },
      { section: 'Display' },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true, hint: 'Lower numbers appear first' },
      { key: 'featured', label: 'Feature on the home page (first 3 featured projects are shown)', type: 'checkbox' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
      ...SEO_FIELDS('Title — Type project in Location', 'one-line summary'),
    ],
  },

  banners: {
    resource: 'banners', title: 'Banners', singular: 'Banner', ctxLoad: loadDestinations,
    help: 'Promo strip: the three text links under the navbar. Hero slider: the big banner at the top of the home page. Gallery: the “Real Life” squares (the first one is also the showroom photo).',
    defaults: { placement: 'hero', title: '', subtitle: '', image: '', link: '', sort_order: 0, active: true },
    columns: [
      { key: 'title', label: 'Banner', nowrap: false, sort: (r) => r.title, render: (r) => <NameCell image={r.image} name={r.title || '—'} sub={r.subtitle} wide /> },
      { key: 'placement', label: 'Placement', render: (r) => <Pill tone={{ strip: 'blue', hero: 'brand', gallery: 'purple' }[r.placement]}>{{ strip: 'Promo strip', hero: 'Hero slider', gallery: 'Gallery' }[r.placement]}</Pill> },
      { key: 'link', label: 'Opens', nowrap: false, render: (r) => r.link_label || <span className="text-mute">—</span> },
      { key: 'sort_order', label: 'Order', align: 'right' },
    ],
    filters: [
      { key: 'placement', label: 'Placement', options: [['hero', 'Hero slider'], ['strip', 'Promo strip'], ['gallery', 'Gallery']], test: (r, v) => r.placement === v },
      activeFilter,
    ],
    csv: [{ label: 'ID', value: 'id' }, { label: 'Placement', value: 'placement' }, { label: 'Title', value: 'title' }, { label: 'Subtitle', value: 'subtitle' }, { label: 'Link', value: 'link' }, { label: 'Image URL', value: 'image' }, { label: 'Active', value: (r) => (r.active ? 'yes' : 'no') }],
    fields: [
      { key: 'placement', label: 'Placement', type: 'select', required: true, half: true, options: () => [['hero', 'Hero slider'], ['strip', 'Promo strip (text only)'], ['gallery', 'Gallery']] },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
      { key: 'title', label: 'Title', half: true },
      { key: 'subtitle', label: 'Subtitle', half: true },
      { key: 'image', label: 'Image', type: 'image', show: (f) => f.placement !== 'strip', size: (f) => IMAGE_SIZES[f.placement === 'gallery' ? 'gallery' : 'hero'] },
      { key: 'link', label: 'Where it opens', type: 'select', creatable: true, empty: 'Nowhere (just a picture)', options: destinationOptions, hint: 'Pick a page, or type a full web address for anything else.' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
    ],
  },
};

// Products and offers reference a category by id; attach its name once per load for display, search and export.
CONFIGS.offers.decorate = (rows, ctx) => rows.map((r) => ({ ...r, category_name: catName(ctx, r.category_id) || '' }));
CONFIGS.products.decorate = (rows, ctx) => rows.map((r) => {
  const inOffers = (ctx.offers || []).filter((o) => o.product_ids.includes(r.id));
  return { ...r, category_name: catName(ctx, r.category_id) || '', offer_ids: inOffers.map((o) => o.id), offer_names: inOffers.map((o) => o.title) };
});
CONFIGS.banners.decorate = (rows, ctx) => rows.map((r) => ({ ...r, link_label: destinationOptions(ctx).find(([v]) => v === r.link)?.[1] || r.link }));
