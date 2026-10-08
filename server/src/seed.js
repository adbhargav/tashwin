// Demo data so the storefront is browsable out of the box. Re-running wipes the catalogue tables.
// Photos are Unsplash placeholders — replace them from the admin panel.
import { pool, q, one, migrate, slugify } from './db.js';

const img = (id, w, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
const PHOTOS = {
  sofa: ['1555041469-a586c61ea9bc', '1493663284031-b7e3aefcae8e', '1540574163026-643ea20ade25', '1550581190-9c1c48d21d6c', '1567538096630-e0c55bd6374c', '1506439773649-6e0eb8cfb237'],
  chair: ['1586023492125-27b2c045efd7', '1580480055273-228ff5388ef8', '1592078615290-033ee584e267', '1519710164239-da123dc03ef4', '1503602642458-232111445657', '1549497538-303791108f95'],
  table: ['1533090481720-856c6e3c1fdc', '1618221195710-dd6b41faaea6', '1577140917170-285929fb55b7', '1551298370-9d3d53740c72'],
  dining: ['1617806118233-18e1de247200', '1615874959474-d609969a20ed', '1595526114035-0d45ed16cfbf'],
  bed: ['1505693416388-ac5ce068fe85', '1522771739844-6a9f6d5f14af', '1616486338812-3dadae4b4ace', '1505691938895-1758d7feb511', '1560448204-e02f11c3d0e2'],
  storage: ['1595526114035-0d45ed16cfbf', '1538688525198-9b88f6f53126', '1556228453-efd6c1ff04f6', '1598300042247-d088f8ab3a91'],
  office: ['1524758631624-e2822e304c36', '1497366216548-37526070297c', '1518455027359-f3f8164ba6bd', '1541558869434-2840d308329a'],
  room: ['1600585154340-be6161a56a0c', '1583847268964-b28dc8f51f92', '1484101403633-562f891dc89a', '1634712282287-14ed57b9cc89', '1555043722-4523972f07ee'],
};

// [department, kind, [group, kind?, [leaf pages...]]]
const TREE = [
  ['Living', 'sofa', [
    ['Sofas', 'sofa', ['Leather Sofas', 'Fabric Sofas', 'Reclining Sofas', 'L Shaped Sofas', '3 Seater Sofas', '2 Seater Sofas']],
    ['Living Chairs', 'chair', ['Lounge Chairs', 'Rocker Chairs', 'Ottomans & Pouffes']],
    ['Tables', 'table', ['Coffee & Center Tables', 'Side & End Tables', 'Console Tables']],
    ['Living Storage', 'storage', ['TV Units', 'Shoe Racks']],
  ]],
  ['Dining', 'dining', [
    ['Dining Sets', 'dining', ['4 Seater Dining Sets', '6 Seater Dining Sets', 'Marble Dining Sets']],
    ['Dining Seating', 'chair', ['Dining Chairs']],
    ['Dining Storage', 'storage', ['Sideboards & Crockery Units']],
  ]],
  ['Bedroom', 'bed', [
    ['Beds', 'bed', ['King Size Beds', 'Queen Size Beds', 'Upholstered Beds']],
    ['Wardrobes', 'storage', ['2 Door Wardrobes', '3 Door Wardrobes']],
    ['Bedroom Storage', 'storage', ['Bed Side Tables', 'Dressing Tables', 'Chest Of Drawers']],
  ]],
  ['Office', 'office', [
    ['Office Chairs', 'chair', ['Ergonomic Chairs', 'Executive Chairs', 'Visitor Chairs']],
    ['Office Desks', 'office', ['Study Tables', 'Executive Desks']],
  ]],
];
const POPULAR = ['Leather Sofas', 'Fabric Sofas', 'Reclining Sofas', '6 Seater Dining Sets', 'King Size Beds', 'Ergonomic Chairs',
  'Coffee & Center Tables', 'Lounge Chairs', 'TV Units', '2 Door Wardrobes', 'Study Tables', 'Dining Chairs'];

const NAMES = ['Aurelia', 'Montclair', 'Verano', 'Kestrel', 'Odessa', 'Halden', 'Soriano', 'Bexley', 'Linnea', 'Carrow', 'Tavira', 'Emsworth', 'Novara', 'Rhodes', 'Isolde', 'Marlow'];
const MATERIALS = { sofa: ['Leather', 'Fabric', 'Leatherette'], chair: ['Mesh', 'Fabric', 'Leatherette'], table: ['Solid Wood', 'Marble', 'Glass'], dining: ['Solid Wood', 'Marble'], bed: ['Solid Wood', 'Fabric'], storage: ['Engineered Wood', 'Solid Wood'], office: ['Engineered Wood', 'Solid Wood'] };
const COLORS = ['Walnut Brown', 'Oyster Grey', 'Honey Beige', 'Charcoal', 'Tan', 'Ivory'];
const TAGS = ['Best Seller', '', '', 'New Arrival', '', 'Clearance Sale'];
const BASE_PRICE = { sofa: 62000, chair: 14000, table: 18000, dining: 78000, bed: 56000, storage: 32000, office: 21000 };

await migrate();
await q(`TRUNCATE wishlist, products, offers, banners, categories RESTART IDENTITY CASCADE`);

const insertCat = (parent, name, kind, i, extra = {}) => one(
  `INSERT INTO categories (parent_id, name, slug, image, banner_image, description, show_on_home, sort_order)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
  [parent, name, slugify(name), img(PHOTOS[kind][i % PHOTOS[kind].length], 840, 600), img(PHOTOS.room[i % PHOTOS.room.length], 1920, 480),
    `Explore Tashwin ${name.toLowerCase()} — crafted with premium materials, honest pricing and a finish built to last.`,
    POPULAR.includes(name), extra.sort ?? i],
);

let n = 0;
for (const [d, [dept, deptKind, groups]] of TREE.entries()) {
  const department = await insertCat(null, dept, deptKind, d);
  for (const [g, [group, kind, leaves]] of groups.entries()) {
    const groupRow = await insertCat(department.id, group, kind, g);
    for (const [l, leaf] of leaves.entries()) {
      const leafRow = await insertCat(groupRow.id, leaf, kind, l + g, { sort: POPULAR.includes(leaf) ? POPULAR.indexOf(leaf) : l });
      for (let k = 0; k < 3; k++, n++) {
        const name = NAMES[n % NAMES.length];
        const material = MATERIALS[kind][n % MATERIALS[kind].length];
        const color = COLORS[n % COLORS.length];
        const mrp = Math.round((BASE_PRICE[kind] * (1 + (n % 7) * 0.22)) / 100) * 100;
        const off = [45, 30, 50, 20, 35, 60, 0][n % 7];
        const photos = PHOTOS[kind];
        const item = leaf.replace(/s$/, '').replace(/Sofa$/, 'Sofa');
        await q(
          // Dealers pay 12% under the selling price, rounded to the nearest hundred.
          `INSERT INTO products (category_id, name, subtitle, slug, description, price, mrp, images, tag, material, color, dimensions, care, warranty, stock, featured, dealer_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, round($6 * 0.88 / 100) * 100)`,
          [leafRow.id, name, `${material} ${item} in ${color}`, slugify(`${name} ${material} ${item} ${color} ${n}`),
            `${name} pairs clean, contemporary lines with everyday comfort. Built on a seasoned frame and finished in ${color.toLowerCase()} ${material.toLowerCase()}, it is made to anchor the room for years.`,
            Math.round((mrp * (100 - off)) / 10000) * 100, mrp,
            JSON.stringify([0, 1, 2, 3].map((j) => img(photos[(n + j) % photos.length], 800, 800))),
            TAGS[n % TAGS.length], material, color, 'W 210 cm × D 92 cm × H 88 cm',
            'Wipe with a soft dry cloth. Keep away from direct sunlight and moisture.', '5 year manufacturer warranty',
            n % 11 === 5 ? 0 : 12, n % 4 === 0],
        );
      }
    }
  }
}

const offers = [
  ['Flat 50% Off', 'Half price on signature pieces', 50, null, 'sofa', 0],
  ['Cosy Beds', 'Up to 45% off on beds', 20, 'beds', 'bed', 1],
  ['Timeless Dining', 'Dining sets from ₹39,900', 20, 'dining-sets', 'dining', 0],
  ['Workspace Deals', 'Ergonomic chairs and desks', 20, 'office', 'office', 0],
  ['Clearance Sale', 'Min. 35% off — last few pieces', 35, null, 'room', 2],
];
for (const [i, [title, subtitle, min, catSlug, kind, p]] of offers.entries()) {
  const cat = catSlug ? await one(`SELECT id FROM categories WHERE slug = $1`, [catSlug]) : null;
  await q(`INSERT INTO offers (title, slug, subtitle, image, min_discount, category_id, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [title, slugify(title), subtitle, img(PHOTOS[kind][p], 880, 1168), min, cat?.id ?? null, i]);
}

const banners = [
  ['strip', 'Grab 50% OFF on 100+ Products', 'SHOP YOUR FAVOURITES NOW', '', '/offers/flat-50-off'],
  ['strip', 'Workspaces Built To Win', 'EXPLORE OFFICE FURNITURE', '', '/c/office'],
  ['strip', 'Clearance Sale Is Live', 'LAST FEW PIECES LEFT', '', '/offers/clearance-sale'],
  ['hero', 'Living, Reimagined', 'Sofas and recliners crafted for the way you unwind', img(PHOTOS.room[0], 1920, 800), '/c/living'],
  ['hero', 'Born To Win Workspaces', 'Ergonomic seating for focused days', img(PHOTOS.office[1], 1920, 800), '/c/office'],
  ['hero', 'The Bedroom Edit', 'Beds and wardrobes in warm, natural finishes', img(PHOTOS.bed[2], 1920, 800), '/c/bedroom'],
  ...PHOTOS.room.concat(PHOTOS.sofa.slice(0, 3)).map((id) => ['gallery', '', '', img(id, 1000, 1000), '']),
];
for (const [i, b] of banners.entries()) {
  await q(`INSERT INTO banners (placement, title, subtitle, image, link, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`, [...b, i]);
}

console.log(`Seeded ${n} products`);
await pool.end();
