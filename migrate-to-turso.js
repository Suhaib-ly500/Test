// نقل جميع البيانات من matrix-pro.db المحلية إلى قاعدة Turso السحابية
// التشغيل: node migrate-to-turso.js  (يقرأ بيانات Turso من .env.turso)
const fs = require('fs');
for (const file of ['.env', '.env.turso']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
}
process.env.VAULT_PASSWORD = process.env.VAULT_PASSWORD || 'matrix-pro-default-vault-key-2026';
const { db, turso, qRun, qExec, q, ensureSchema } = require('./src/infrastructure/persistence/db');

const PREFERRED_ORDER = [
  'settings', 'page_content', 'custom_assets',
  'vendors', 'vendor_categories', 'subscriptions', 'delete_responses',
  'orders', 'activity_log', 'auth_tokens',
  'featured_subscriptions', 'ratings', 'complaints',
  'customer_points', 'customer_point_transactions',
  'vendor_points', 'vendor_point_transactions', 'vendor_commission_reductions',
  'customer_offers', 'subscription_views', 'files'
];

(async () => {
  if (!turso) {
    console.error('❌ TURSO_DATABASE_URL / TURSO_AUTH_TOKEN غير معرّفين (تحقق من .env.turso)');
    process.exit(1);
  }

  console.log('تهيئة البنية على Turso...');
  await ensureSchema();
  await qExec('PRAGMA foreign_keys = OFF');

  const localTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
  const orderPref = localTables.filter(t => PREFERRED_ORDER.includes(t)).concat(localTables.filter(t => !PREFERRED_ORDER.includes(t)));
  console.log('الجداول:', orderPref.join(', '));

  for (const table of [...orderPref].reverse()) {
    await qExec(`DELETE FROM "${table}"`).catch(() => {});
  }

  let totalRows = 0;
  for (const table of orderPref) {
    const cols = db.prepare(`PRAGMA table_info('${table}')`).all().map(c => c.name);
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) {
      console.log(`   ${table}: فارغ`);
      continue;
    }
    const colList = cols.map(c => `"${c}"`).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    try {
      let inserted = 0;
      for (const row of rows) {
        await qRun(`INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`, cols.map(c => row[c] === undefined ? null : row[c]));
        inserted++;
      }
      totalRows += inserted;
      console.log(`   ${table}: ${inserted} صفوف ✓`);
    } catch (e) {
      console.error(`   ${table}: فشل — ${e.message}`);
      process.exit(1);
    }
  }

  console.log(`\nاكتمل النقل: ${totalRows} صفاً`);
  process.exit(0);
})().catch(e => {
  console.error('خطأ عام:', e.message);
  process.exit(1);
});