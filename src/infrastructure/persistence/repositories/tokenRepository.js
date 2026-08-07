const { db } = require('../db');

function insert(vendorId, token, isAdmin) {
  return db.prepare('INSERT INTO auth_tokens (vendor_id, token, is_admin) VALUES (?, ?, ?)').run(vendorId, token, isAdmin || 0);
}

function deleteByToken(token) {
  return db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
}

function findSession(token) {
  return db.prepare('SELECT vendor_id, is_admin, created_at FROM auth_tokens WHERE token = ?').get(token);
}

function findAdminSession(token) {
  return db.prepare('SELECT vendor_id, created_at FROM auth_tokens WHERE token = ? AND is_admin = 1').get(token);
}

function deleteOldForVendor(vendorId) {
  return db.prepare("DELETE FROM auth_tokens WHERE vendor_id = ? AND created_at < datetime('now', '-30 days')").run(vendorId);
}

function deleteExpired() {
  try { db.prepare("DELETE FROM auth_tokens WHERE created_at < datetime('now', '-30 days')").run(); } catch (e) {}
}

function deleteAll() {
  return db.prepare('DELETE FROM auth_tokens').run();
}

function deleteByVendor(vendorId) {
  return db.prepare('DELETE FROM auth_tokens WHERE vendor_id = ?').run(vendorId);
}

module.exports = { insert, deleteByToken, findSession, findAdminSession, deleteOldForVendor, deleteExpired, deleteAll, deleteByVendor };