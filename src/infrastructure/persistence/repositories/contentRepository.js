const { db } = require('../db');

// ===== Activity log =====

function logActivity(vendorId, action, details) {
  return db.prepare('INSERT INTO activity_log (vendor_id, action, details) VALUES (?, ?, ?)').run(vendorId || 0, action, details || '');
}

function listVendorLogs(vendorId, limit) {
  return db.prepare('SELECT * FROM activity_log WHERE vendor_id = ? ORDER BY id DESC LIMIT ?').all(vendorId, limit);
}

function listLogsFiltered({ vendor_name, date_from, date_to, action }) {
  let sql = 'SELECT l.*, v.display_name as vendor_name FROM activity_log l LEFT JOIN vendors v ON l.vendor_id = v.id WHERE 1=1';
  const params = [];
  if (vendor_name) { sql += ' AND v.display_name LIKE ?'; params.push('%' + vendor_name + '%'); }
  if (date_from) { sql += ' AND date(l.created_at) >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND date(l.created_at) <= ?'; params.push(date_to); }
  if (action) { sql += ' AND l.action = ?'; params.push(action); }
  sql += ' ORDER BY l.id DESC LIMIT 200';
  return db.prepare(sql).all(...params);
}

function deleteAllLogs() {
  return db.prepare('DELETE FROM activity_log').run();
}

function deleteVendorLogs(vendorId) {
  return db.prepare('DELETE FROM activity_log WHERE vendor_id = ?').run(vendorId);
}

// ===== Complaints =====

function listComplaints() {
  return db.prepare('SELECT * FROM complaints ORDER BY id DESC').all();
}

function createComplaint({ customer_name, customer_phone, vendor_name, subscription_name, reason, screenshot_path }) {
  return db.prepare('INSERT INTO complaints (customer_name, customer_phone, vendor_name, subscription_name, reason, screenshot_path) VALUES (?, ?, ?, ?, ?, ?)').run(customer_name, customer_phone, vendor_name, subscription_name, reason, screenshot_path);
}

function updateComplaint(id, status, adminResponse) {
  return db.prepare('UPDATE complaints SET status = ?, admin_response = ? WHERE id = ?').run(status, adminResponse || null, id);
}

function deleteAllComplaints() {
  return db.prepare('DELETE FROM complaints').run();
}

// ===== Page content =====

function getPage(slug) {
  return db.prepare('SELECT * FROM page_content WHERE slug = ?').get(slug);
}

function listPages() {
  return db.prepare('SELECT * FROM page_content').all();
}

function upsertPage(slug, title, content) {
  const existing = getPage(slug);
  if (existing) return db.prepare('UPDATE page_content SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?').run(title || existing.title, content, slug);
  return db.prepare('INSERT INTO page_content (slug, title, content) VALUES (?, ?, ?)').run(slug, title || '', content);
}

// ===== Custom assets =====

function listAssets() {
  return db.prepare('SELECT key, value FROM custom_assets').all();
}

function setAsset(key, value) {
  return db.prepare("INSERT OR REPLACE INTO custom_assets (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
}

module.exports = {
  logActivity, listVendorLogs, listLogsFiltered, deleteAllLogs, deleteVendorLogs,
  listComplaints, createComplaint, updateComplaint, deleteAllComplaints,
  getPage, listPages, upsertPage,
  listAssets, setAsset
};