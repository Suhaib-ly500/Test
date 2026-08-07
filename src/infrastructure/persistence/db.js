const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('../config');

let turso = null;
try {
  let createClient;
  try {
    ({ createClient } = require('@libsql/client'));
  } catch (e1) {
    console.warn('[turso] العميل الثنائي غير متاح، استخدام Web client:', e1.message.split('\n')[0]);
    ({ createClient } = require('@libsql/client/web'));
  }
  require('dotenv').config();
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('[turso] العميل جاهز');
  }
} catch (e) {
  console.warn('[turso] فشل تحميل العميل:', e.message);
}

const dbPath = path.join(config.root, config.vaultData.DB_PATH || 'matrix-pro.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    fullname TEXT DEFAULT '',
    display_name TEXT DEFAULT '',
    age INTEGER DEFAULT 0,
    location TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    social_link TEXT DEFAULT '',
    photo_path TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','rejected')),
    commission_rate REAL,
    delete_requested INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendor_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_path TEXT,
    commission_rate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    cat_id INTEGER,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    duration TEXT DEFAULT '',
    image_path TEXT,
    is_active INTEGER DEFAULT 1,
    views INTEGER DEFAULT 0,
    commission_rate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (cat_id) REFERENCES vendor_categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT DEFAULT '',
    vendor_id INTEGER,
    subscription_name TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    discount_amount REAL DEFAULT 0,
    points_used INTEGER DEFAULT 0,
    screenshot_path TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS delete_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER UNIQUE NOT NULL,
    response TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS featured_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER UNIQUE NOT NULL,
    special_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    vendor_id INTEGER,
    customer_name TEXT DEFAULT '',
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    review TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    subscription_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    screenshot_path TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    admin_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS page_content (
    slug TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customer_points (
    phone TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS customer_point_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_phone TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('earn','redeem')),
    order_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendor_points (
    vendor_id INTEGER PRIMARY KEY,
    points INTEGER DEFAULT 0,
    daily_sales_date TEXT,
    daily_sales_total REAL DEFAULT 0,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vendor_point_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('earn','redeem')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vendor_commission_reductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    reduction_percent REAL NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customer_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    discount_percent REAL NOT NULL,
    valid_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscription_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    viewer_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_assets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec("ALTER TABLE customer_offers ADD COLUMN valid_until DATETIME"); } catch(e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN points_used INTEGER DEFAULT 0"); } catch(e) {}
try {
  const tblInfo = db.prepare("PRAGMA table_info('orders')").all();
  if (!tblInfo.find(c => c.name === 'screenshot_path')) {
    db.exec("ALTER TABLE orders ADD COLUMN screenshot_path TEXT DEFAULT ''");
    db.exec(`CREATE TABLE orders_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      vendor_id INTEGER,
      subscription_name TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      discount_amount REAL DEFAULT 0,
      points_used INTEGER DEFAULT 0,
      screenshot_path TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )`);
    db.exec("INSERT INTO orders_new SELECT id,customer_name,customer_phone,customer_email,vendor_id,subscription_name,amount,status,discount_amount,points_used,'' as screenshot_path,created_at FROM orders");
    db.exec("DROP TABLE orders");
    db.exec("ALTER TABLE orders_new RENAME TO orders");
  }
} catch(e) {}

const defaultPointSettings = [
  ['customer_points_per_order', '5'],
  ['customer_point_discount', '0.5'],
  ['customer_max_discount_percent', '50'],
  ['vendor_daily_target', '200'],
  ['vendor_points_per_target', '10'],
  ['vendor_commission_reduction_per_point', '1'],
  ['vendor_reduction_hours', '24']
];
for (const [k, v] of defaultPointSettings) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

module.exports = { db, turso, getSetting, setSetting };