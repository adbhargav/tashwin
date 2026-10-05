import { api, asset, inr } from '../lib/api';
import { IMAGE_SIZES } from '../lib/site';

const Thumb = ({ src, wide }) => (
  <div className={`h-11 ${wide ? 'w-20' : 'w-11'} rounded bg-soft overflow-hidden`}>{src && <img src={asset(src)} alt="" className="w-full h-full object-cover" />}</div>
);
const Dot = ({ on }) => <span className={`inline-block w-2.5 h-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-[#ccc]'}`} title={on ? 'Yes' : 'No'} />;

// Flatten the category tree depth-first so tables and dropdowns read like the storefront menu.
export function orderedCategories(rows) {
  const out = [];
  const walk = (parentId, depth) => rows.filter((c) => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .forEach((c) => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
  walk(null, 0);
  return out;
}
const categoryOptions = (rows, maxDepth = 2) => orderedCategories(rows).filter((c) => c.depth <= maxDepth).map((c) => [c.id, `${'— '.repeat(c.depth)}${c.name}`]);
const loadCategories = async () => ({ categories: await api('/api/admin/categories') });
const LEVELS = ['Department', 'Group', 'Page'];

export const CONFIGS = {
  categories: {
    resource: 'categories', title: 'Categories', singular: 'Category',
    help: 'Three levels: Department (navbar item) → Group (mega-menu column) → Page. Every category automatically gets its own storefront page at /c/its-slug.',
    rows: orderedCategories,
    defaults: { parent_id: '', name: '', slug: '', image: '', banner_image: '', description: '', show_in_nav: true, show_on_home: false, sort_order: 0, active: true, seo_title: '', seo_description: '' },
    columns: [
      { label: 'Image', render: (r) => <Thumb src={r.image} wide /> },
      { label: 'Name', render: (r) => <span style={{ paddingLeft: r.depth * 22 }} className={r.depth === 0 ? 'font-medium' : ''}>{r.depth > 0 && '└ '}{r.name}</span> },
      { label: 'Level', render: (r) => LEVELS[r.depth] },
      { label: 'Page URL', render: (r) => <a href={`/c/${r.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">/c/{r.slug}</a> },
      { label: 'Home', render: (r) => <Dot on={r.show_on_home} /> },
      { label: 'Active', render: (r) => <Dot on={r.active} /> },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, half: true },
      { key: 'slug', label: 'URL slug', half: true, placeholder: 'auto-generated from name' },
      { key: 'parent_id', label: 'Parent category', type: 'select', empty: '— None (top-level department) —',
        options: (ctx, form) => categoryOptions(ctx.rows, 1).filter(([id]) => id !== form.id) },
      { key: 'image', label: 'Card image', type: 'image', size: IMAGE_SIZES.categoryCard },
      { key: 'banner_image', label: 'Page banner (optional)', type: 'image', size: IMAGE_SIZES.categoryBanner },
      { key: 'description', label: 'Page description', type: 'textarea' },
      { key: 'seo_title', label: 'SEO title (the headline shown on Google)', count: 60, placeholder: 'Leave empty to use: Name | Tashwin Furniture', hint: 'Put the main search words first.' },
      { key: 'seo_description', label: 'SEO description (the text under the headline on Google)', type: 'textarea', count: 160, hint: 'Leave empty to use the page description.' },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true, hint: 'Lower numbers appear first' },
      { key: 'show_in_nav', label: 'Show in navbar (departments)', type: 'checkbox' },
      { key: 'show_on_home', label: 'Show in “Popular Categories” on the home page', type: 'checkbox' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
    ],
  },

  products: {
    resource: 'products', title: 'Products', singular: 'Product', ctxLoad: loadCategories,
    defaults: { category_id: '', name: '', subtitle: '', slug: '', description: '', price: '', mrp: '', dealer_price: '', images: [], tag: '', material: '', color: '', dimensions: '', care: '', warranty: '', stock: 0, featured: false, active: true, seo_title: '', seo_description: '' },
    columns: [
      { label: 'Image', render: (r) => <Thumb src={r.images[0]} /> },
      { label: 'Name', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-body">{r.subtitle}</p></div> },
      { label: 'Category', render: (r, ctx) => ctx.categories?.find((c) => c.id === r.category_id)?.name || '—' },
      { label: 'Price', render: (r) => <div>{inr(r.price)}{r.mrp > r.price && <del className="block text-xs text-body">{inr(r.mrp)}</del>}</div> },
      { label: 'Dealer price', render: (r) => (r.dealer_price != null ? inr(r.dealer_price) : '—') },
      { label: 'Stock', render: (r) => <span className={r.stock <= 0 ? 'text-red-600' : ''}>{r.stock}</span> },
      { label: 'Best seller', render: (r) => <Dot on={r.featured} /> },
      { label: 'Active', render: (r) => <Dot on={r.active} /> },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, half: true },
      { key: 'subtitle', label: 'Short description line', half: true, placeholder: 'Leather 3 Seater Sofa in Tan' },
      { key: 'category_id', label: 'Category', type: 'select', required: true, half: true, options: (ctx) => [['', 'Select a category'], ...categoryOptions(ctx.categories || [])] },
      { key: 'slug', label: 'URL slug', half: true, placeholder: 'auto-generated from name' },
      { key: 'price', label: 'Selling price (₹)', type: 'number', required: true, half: true },
      { key: 'mrp', label: 'MRP (₹)', type: 'number', half: true, hint: 'The “% off” is calculated from MRP and selling price' },
      { key: 'dealer_price', label: 'Dealer / distributor price (₹)', type: 'number', half: true, hint: 'Shown instead of the selling price to users marked as Dealer. Leave empty to charge dealers the normal price.' },
      { key: 'images', label: 'Product images', type: 'images', size: IMAGE_SIZES.product },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'seo_title', label: 'SEO title (the headline shown on Google)', count: 60, placeholder: 'Leave empty to use: Name – Short description line | Tashwin Furniture', hint: 'Put the main search words first.' },
      { key: 'seo_description', label: 'SEO description (the text under the headline on Google)', type: 'textarea', count: 160, hint: 'Leave empty to use the product description.' },
      { key: 'material', label: 'Material', half: true, hint: 'Used by the Material filter' },
      { key: 'color', label: 'Colour', half: true, hint: 'Used by the Colour filter' },
      { key: 'dimensions', label: 'Dimensions', half: true },
      { key: 'warranty', label: 'Warranty', half: true },
      { key: 'care', label: 'Material and care', type: 'textarea' },
      { key: 'stock', label: 'Stock quantity', type: 'number', half: true },
      { key: 'tag', label: 'Badge on card', half: true, placeholder: 'Best Seller, New Arrival…' },
      { key: 'featured', label: 'Show in “Best Sellers” on the home page', type: 'checkbox' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
    ],
  },

  offers: {
    resource: 'offers', title: 'Offers', singular: 'Offer', ctxLoad: loadCategories,
    help: 'Each offer shows as a card on the home page and Offers page, and opens its own page listing every product that meets the minimum discount (optionally within one category).',
    defaults: { title: '', slug: '', subtitle: '', image: '', min_discount: 0, category_id: '', sort_order: 0, active: true, seo_title: '', seo_description: '' },
    columns: [
      { label: 'Image', render: (r) => <Thumb src={r.image} /> },
      { label: 'Title', render: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-body">{r.subtitle}</p></div> },
      { label: 'Min. discount', render: (r) => `${r.min_discount}%` },
      { label: 'Category', render: (r, ctx) => ctx.categories?.find((c) => c.id === r.category_id)?.name || 'All' },
      { label: 'Page URL', render: (r) => <a href={`/offers/${r.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">/offers/{r.slug}</a> },
      { label: 'Active', render: (r) => <Dot on={r.active} /> },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, half: true },
      { key: 'slug', label: 'URL slug', half: true, placeholder: 'auto-generated from title' },
      { key: 'subtitle', label: 'Subtitle' },
      { key: 'image', label: 'Offer card image', type: 'image', size: IMAGE_SIZES.offer },
      { key: 'seo_title', label: 'SEO title (the headline shown on Google)', count: 60, placeholder: 'Leave empty to use: Title | Tashwin Furniture', hint: 'Put the main search words first.' },
      { key: 'seo_description', label: 'SEO description (the text under the headline on Google)', type: 'textarea', count: 160, hint: 'Leave empty to use the subtitle.' },
      { key: 'min_discount', label: 'Minimum discount %', type: 'number', half: true, hint: 'Products with at least this % off are listed' },
      { key: 'category_id', label: 'Limit to category', type: 'select', half: true, empty: 'All categories', options: (ctx) => categoryOptions(ctx.categories || []) },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
    ],
  },

  banners: {
    resource: 'banners', title: 'Banners', singular: 'Banner',
    help: 'Promo strip: the three text links under the navbar. Hero slider: the big banner at the top of the home page. Gallery: the “Real Life” squares (the first one is also the showroom photo).',
    defaults: { placement: 'hero', title: '', subtitle: '', image: '', link: '', sort_order: 0, active: true },
    columns: [
      { label: 'Image', render: (r) => <Thumb src={r.image} wide /> },
      { label: 'Placement', render: (r) => ({ strip: 'Promo strip', hero: 'Hero slider', gallery: 'Gallery' }[r.placement]) },
      { label: 'Title', render: (r) => <div><p className="font-medium">{r.title || '—'}</p><p className="text-xs text-body">{r.subtitle}</p></div> },
      { label: 'Link', render: (r) => r.link || '—' },
      { label: 'Active', render: (r) => <Dot on={r.active} /> },
    ],
    fields: [
      { key: 'placement', label: 'Placement', type: 'select', required: true, half: true, options: () => [['hero', 'Hero slider'], ['strip', 'Promo strip (text only)'], ['gallery', 'Gallery']] },
      { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
      { key: 'title', label: 'Title', half: true },
      { key: 'subtitle', label: 'Subtitle', half: true },
      { key: 'image', label: 'Image', type: 'image', show: (f) => f.placement !== 'strip', size: (f) => IMAGE_SIZES[f.placement === 'gallery' ? 'gallery' : 'hero'] },
      { key: 'link', label: 'Link', placeholder: '/c/sofas or /offers/flat-50-off', hint: 'Where the banner goes when clicked' },
      { key: 'active', label: 'Active (visible on the website)', type: 'checkbox' },
    ],
  },
};
