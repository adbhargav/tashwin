CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- scrypt "salt:hash" for admin-panel password sign-in; set by `npm run seed:admin`. NULL for everyone else.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Three-level tree: department (Living) > group (Sofas) > page (Leather Sofas).
-- Every row gets its own storefront page at /c/:slug.
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INT REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image TEXT DEFAULT '',
  banner_image TEXT DEFAULT '',
  description TEXT DEFAULT '',
  show_in_nav BOOLEAN NOT NULL DEFAULT true,
  show_on_home BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  price INT NOT NULL,
  mrp INT NOT NULL DEFAULT 0,
  images JSONB NOT NULL DEFAULT '[]',
  tag TEXT DEFAULT '',
  material TEXT DEFAULT '',
  color TEXT DEFAULT '',
  dimensions TEXT DEFAULT '',
  care TEXT DEFAULT '',
  warranty TEXT DEFAULT '',
  stock INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
-- Search-engine title and description written in the admin panel. Empty means the storefront builds them from the name and description.
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';
-- What dealers / distributors (users.role = 'dealer') pay. NULL means they pay the normal price.
ALTER TABLE products ADD COLUMN IF NOT EXISTS dealer_price INT;

-- An offer page lists products with discount >= min_discount, optionally limited to a category subtree.
CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subtitle TEXT DEFAULT '',
  image TEXT DEFAULT '',
  min_discount INT NOT NULL DEFAULT 0,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT '';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';

-- Site-wide settings edited in the admin panel, one JSON value per key (e.g. 'seo').
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

-- placement: 'strip' (promo strip under navbar), 'hero' (big slider at the top of the home page), 'gallery' (real-life squares)
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  placement TEXT NOT NULL DEFAULT 'hero',
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  image TEXT DEFAULT '',
  link TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- A signed-in shopper's cart ([{ id, qty }]), saved so it follows them across devices and admins can see it.
CREATE TABLE IF NOT EXISTS carts (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  items JSONB NOT NULL,
  total INT NOT NULL,
  address JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set when the "complete your order" email has gone out for an unpaid order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
