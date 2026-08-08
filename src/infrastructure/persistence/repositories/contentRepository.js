const { q, qOne, qRun } = require('../db');

// ===== Activity log =====

async function logActivity(vendorId, action, details) {
  return qRun('INSERT INTO activity_log (vendor_id, action, details) VALUES (?, ?, ?)', [vendorId || 0, action, details || '']);
}

async function listVendorLogs(vendorId, limit) {
  return q('SELECT * FROM activity_log WHERE vendor_id = ? ORDER BY id DESC LIMIT ?', [vendorId, limit]);
}

async function listLogsFiltered({ vendor_name, date_from, date_to, action }) {
  let sql = 'SELECT l.*, v.display_name as vendor_name FROM activity_log l LEFT JOIN vendors v ON l.vendor_id = v.id WHERE 1=1';
  const params = [];
  if (vendor_name) { sql += ' AND v.display_name LIKE ?'; params.push('%' + vendor_name + '%'); }
  if (date_from) { sql += ' AND date(l.created_at) >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND date(l.created_at) <= ?'; params.push(date_to); }
  if (action) { sql += ' AND l.action = ?'; params.push(action); }
  sql += ' ORDER BY l.id DESC LIMIT 200';
  return q(sql, params);
}

async function deleteAllLogs() {
  return qRun('DELETE FROM activity_log');
}

async function deleteVendorLogs(vendorId) {
  return qRun('DELETE FROM activity_log WHERE vendor_id = ?', [vendorId]);
}

// ===== Complaints =====

async function listComplaints() {
  return q('SELECT * FROM complaints ORDER BY id DESC');
}

async function createComplaint({ customer_name, customer_phone, vendor_name, subscription_name, reason, screenshot_path }) {
  return qRun('INSERT INTO complaints (customer_name, customer_phone, vendor_name, subscription_name, reason, screenshot_path) VALUES (?, ?, ?, ?, ?, ?)', [customer_name, customer_phone, vendor_name, subscription_name, reason, screenshot_path]);
}

async function updateComplaint(id, status, adminResponse) {
  return qRun('UPDATE complaints SET status = ?, admin_response = ? WHERE id = ?', [status, adminResponse || null, id]);
}

async function deleteAllComplaints() {
  return qRun('DELETE FROM complaints');
}

// ===== Page content =====

async function getPage(slug) {
  return qOne('SELECT * FROM page_content WHERE slug = ?', [slug]);
}

async function listPages() {
  return q('SELECT * FROM page_content');
}

async function upsertPage(slug, title, content) {
  const existing = await getPage(slug);
  if (existing) return qRun('UPDATE page_content SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?', [title || existing.title, content, slug]);
  return qRun('INSERT INTO page_content (slug, title, content) VALUES (?, ?, ?)', [slug, title || '', content]);
}

// ===== Custom assets =====

async function listAssets() {
  return q('SELECT key, value FROM custom_assets');
}

async function setAsset(key, value) {
  return qRun("INSERT OR REPLACE INTO custom_assets (key, value, updated_at) VALUES (?, ?, datetime('now'))", [key, value]);
}

module.exports = {
  logActivity, listVendorLogs, listLogsFiltered, deleteAllLogs, deleteVendorLogs,
  listComplaints, createComplaint, updateComplaint, deleteAllComplaints,
  getPage, listPages, upsertPage,
  listAssets, setAsset
};