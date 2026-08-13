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

const SCHEMA_SQL = `
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

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    mime TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    data BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const ALTER_STATEMENTS = [
  "ALTER TABLE customer_offers ADD COLUMN valid_until DATETIME",
  "ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN points_used INTEGER DEFAULT 0"
];

const INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
  CREATE INDEX IF NOT EXISTS idx_vendors_delete_requested ON vendors(delete_requested);

  CREATE INDEX IF NOT EXISTS idx_categories_vendor ON vendor_categories(vendor_id);

  CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor ON subscriptions(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor_name ON subscriptions(vendor_id, name);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_cat_active ON subscriptions(cat_id, is_active);

  CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_vendor_status ON orders(vendor_id, status);

  CREATE INDEX IF NOT EXISTS idx_activity_vendor ON activity_log(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

  CREATE INDEX IF NOT EXISTS idx_tokens_vendor ON auth_tokens(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_tokens_created ON auth_tokens(created_at);

  CREATE INDEX IF NOT EXISTS idx_ratings_sub ON ratings(subscription_id);

  CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

  CREATE INDEX IF NOT EXISTS idx_customer_txn_phone ON customer_point_transactions(customer_phone);

  CREATE INDEX IF NOT EXISTS idx_vendor_txn_vendor ON vendor_point_transactions(vendor_id);

  CREATE INDEX IF NOT EXISTS idx_reductions_vendor_expiry ON vendor_commission_reductions(vendor_id, expires_at);

  CREATE INDEX IF NOT EXISTS idx_offers_sub ON customer_offers(subscription_id);

  CREATE INDEX IF NOT EXISTS idx_views_sub ON subscription_views(subscription_id);
  CREATE INDEX IF NOT EXISTS idx_views_created ON subscription_views(created_at);
`;

const defaultPointSettings = [
  ['customer_points_per_order', '5'],
  ['customer_point_discount', '0.5'],
  ['customer_max_discount_percent', '50'],
  ['vendor_daily_target', '200'],
  ['vendor_points_per_target', '10'],
  ['vendor_commission_reduction_per_point', '1'],
  ['vendor_reduction_hours', '24']
];

function migrateOrdersScreenshotSync() {
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
  } catch (e) {}
}

if (!turso) {
  // الوضع المحلي: نفس السلوك السابق الفوري
  db.exec(SCHEMA_SQL);
  for (const s of ALTER_STATEMENTS) {
    try { db.exec(s); } catch (e) {}
  }
  try { db.exec(INDEX_SQL); } catch (e) { console.warn('[db] فشل إنشاء الفهارس:', e.message); }
  migrateOrdersScreenshotSync();
  for (const [k, v] of defaultPointSettings) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  }
}

// ================= طبقة الوصول الموحّدة (متزامنة/غير متزامنة) =================

function toBufferSafe(v) {
  if (v == null) return v;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (Array.isArray(v)) return Buffer.from(v);
  return v;
}

function rowsToObjects(columns, rows) {
  return rows.map(r => {
    const o = {};
    for (let i = 0; i < columns.length; i++) {
      const v = r[i];
      o[columns[i]] = (v instanceof Uint8Array || v instanceof ArrayBuffer || Array.isArray(v)) ? toBufferSafe(v) : v;
    }
    return o;
  });
}

async function qExec(sql) {
  if (turso) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const s of stmts) await turso.execute({ sql: s });
    return;
  }
  db.exec(sql);
}

async function q(sql, params = []) {
  if (turso) {
    const r = await turso.execute({ sql, args: params });
    return rowsToObjects(r.columns, r.rows);
  }
  return db.prepare(sql).all(...params);
}

async function qOne(sql, params = []) {
  if (turso) {
    const r = await turso.execute({ sql, args: params });
    return rowsToObjects(r.columns, r.rows)[0];
  }
  return db.prepare(sql).get(...params);
}

let txnBuffer = null;

async function qRun(sql, params = []) {
  if (turso) {
    if (txnBuffer) {
      txnBuffer.push({ sql, args: params });
      return { changes: 0, lastInsertRowid: 0 };
    }
    const r = await turso.execute({ sql, args: params });
    return { changes: r.rowsAffected || 0, lastInsertRowid: Number(r.lastInsertRowid) || 0 };
  }
  return db.prepare(sql).run(...params);
}

async function qTxn(fn) {
  if (turso) {
    // عميل HTTP عديم الحالة: لا يدعم BEGIN/COMMIT عبر طلبات منفصلة،
    // لذلك نجمع الأوامر ونرسلها كدفعة واحدة ذرّية (Hrana batch)
    const prev = txnBuffer;
    txnBuffer = [];
    try {
      const r = await fn();
      if (txnBuffer.length) {
        await turso.batch(txnBuffer, 'write');
      }
      return r;
    } finally {
      txnBuffer = prev;
    }
  }
  return fn();
}

async function ensureSchema() {
  if (!turso) return;
  await qExec(SCHEMA_SQL);
  for (const s of ALTER_STATEMENTS) {
    try { await qExec(s); } catch (e) {}
  }
  try {
    const tblInfo = await q("PRAGMA table_info('orders')");
    if (!tblInfo.find(c => c.name === 'screenshot_path')) {
      await qExec("ALTER TABLE orders ADD COLUMN screenshot_path TEXT DEFAULT ''");
      await qExec(`CREATE TABLE orders_new (
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
      await qExec("INSERT INTO orders_new SELECT id,customer_name,customer_phone,customer_email,vendor_id,subscription_name,amount,status,discount_amount,points_used,'' as screenshot_path,created_at FROM orders");
      await qExec("DROP TABLE orders");
      await qExec("ALTER TABLE orders_new RENAME TO orders");
    }
  } catch (e) {}
  try {
    await qExec(INDEX_SQL);
  } catch (e) {
    console.warn('[db] فشل إنشاء الفهارس:', e.message);
  }
  for (const [k, v] of defaultPointSettings) {
    await qRun('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }
}

async function getSetting(key, fallback) {
  const row = await qOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

async function setSetting(key, value) {
  return qRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
}

module.exports = { db, turso, q, qOne, qRun, qExec, qTxn, getSetting, setSetting, ensureSchema };