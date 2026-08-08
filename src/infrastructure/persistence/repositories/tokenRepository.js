const { q, qOne, qRun } = require('../db');

async function insert(vendorId, token, isAdmin) {
  return qRun('INSERT INTO auth_tokens (vendor_id, token, is_admin) VALUES (?, ?, ?)', [vendorId, token, isAdmin || 0]);
}

async function deleteByToken(token) {
  return qRun('DELETE FROM auth_tokens WHERE token = ?', [token]);
}

async function findSession(token) {
  return qOne('SELECT vendor_id, is_admin, created_at FROM auth_tokens WHERE token = ?', [token]);
}

async function findAdminSession(token) {
  return qOne('SELECT vendor_id, created_at FROM auth_tokens WHERE token = ? AND is_admin = 1', [token]);
}

async function deleteOldForVendor(vendorId) {
  return qRun("DELETE FROM auth_tokens WHERE vendor_id = ? AND created_at < datetime('now', '-30 days')", [vendorId]);
}

async function deleteExpired() {
  try { await qRun("DELETE FROM auth_tokens WHERE created_at < datetime('now', '-30 days')"); } catch (e) {}
}

async function deleteAll() {
  return qRun('DELETE FROM auth_tokens');
}

async function deleteByVendor(vendorId) {
  return qRun('DELETE FROM auth_tokens WHERE vendor_id = ?', [vendorId]);
}

module.exports = { insert, deleteByToken, findSession, findAdminSession, deleteOldForVendor, deleteExpired, deleteAll, deleteByVendor };