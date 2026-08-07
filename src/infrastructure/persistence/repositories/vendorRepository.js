const { db } = require('../db');

// ===== Vendors =====

function create({ username, password, fullname = '', display_name = username, age = 0, location = '', email = '', phone = '', social_link = '', photo_path = null, status = 'pending' }) {
  return db.prepare('INSERT INTO vendors (username, password, fullname, display_name, age, location, email, phone, social_link, photo_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(username, password, fullname, display_name, age, location, email, phone, social_link, photo_path, status);
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM vendors WHERE username = ?').get(username);
}

function findById(id) {
  return db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
}

function findActiveById(id) {
  return db.prepare('SELECT id, username, fullname, display_name, status FROM vendors WHERE id = ? AND status = ?').get(id, 'active');
}

function findAdminByRole() {
  return db.prepare("SELECT id FROM vendors WHERE fullname = 'مشرف المنصة'").get();
}

function getProfile(id) {
  return db.prepare('SELECT id, username, fullname, display_name, age, location, email, phone, social_link, photo_path, status, commission_rate, created_at FROM vendors WHERE id = ?').get(id);
}

function updateStatus(id, status) {
  return db.prepare('UPDATE vendors SET status = ? WHERE id = ?').run(status, id);
}

function updateStatusWithReason(id, status, reason) {
  db.prepare('UPDATE vendors SET status = ? WHERE id = ?').run(status, id);
  return db.prepare('UPDATE vendors SET reject_reason = ? WHERE id = ?').run(reason, id);
}

function setCommission(id, rate) {
  return db.prepare('UPDATE vendors SET commission_rate = ? WHERE id = ?').run(rate, id);
}

function resetCommission(id) {
  return db.prepare('UPDATE vendors SET commission_rate = NULL WHERE id = ?').run(id);
}

function getCommission(id) {
  return db.prepare('SELECT commission_rate FROM vendors WHERE id = ?').get(id);
}

function setDeleteRequested(id) {
  return db.prepare('UPDATE vendors SET delete_requested = 1 WHERE id = ?').run(id);
}

function getDeleteRequested(id) {
  const v = db.prepare('SELECT delete_requested FROM vendors WHERE id = ?').get(id);
  return v ? v.delete_requested : 0;
}

function listAll() {
  return db.prepare('SELECT id, username, fullname, display_name, age, location, email, phone, social_link, photo_path, status, commission_rate, delete_requested, created_at FROM vendors ORDER BY id DESC').all();
}

function listAdminVendors() {
  return db.prepare("SELECT id, username, fullname, display_name, phone, email, location, photo_path, created_at FROM vendors WHERE fullname = 'مشرف المنصة' ORDER BY id ASC").all();
}

function listActivePublic() {
  return db.prepare("SELECT id, display_name, phone FROM vendors WHERE status = 'active' AND username != ?").all('admin');
}

function findManyByIds(ids) {
  if (!ids || !ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare('SELECT id, display_name, phone FROM vendors WHERE id IN (' + placeholders + ')').all(...ids);
}

function countAll() {
  return db.prepare('SELECT COUNT(*) as count FROM vendors').get().count;
}

function countActive() {
  return db.prepare("SELECT COUNT(*) as count FROM vendors WHERE status = 'active'").get().count;
}

function countPending() {
  return db.prepare("SELECT COUNT(*) as count FROM vendors WHERE status = 'pending'").get().count;
}

function countRejected() {
  return db.prepare("SELECT COUNT(*) as count FROM vendors WHERE status = 'rejected'").get().count;
}

function countDeleteRequests() {
  return db.prepare('SELECT COUNT(*) as count FROM vendors WHERE delete_requested = 1').get().count;
}

function countNonAdmin() {
  return db.prepare("SELECT COUNT(*) as c FROM vendors WHERE username != ?").get('admin').c;
}

function countActiveNonAdmin() {
  return db.prepare("SELECT COUNT(*) as c FROM vendors WHERE status = 'active' AND username != 'admin'").get().c;
}

// ===== Full account purge (respects FK dependencies) =====

function deleteFull(id) {
  db.prepare('DELETE FROM customer_offers WHERE subscription_id IN (SELECT id FROM subscriptions WHERE vendor_id = ?)').run(id);
  db.prepare('DELETE FROM ratings WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM activity_log WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM auth_tokens WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM vendor_point_transactions WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM vendor_commission_reductions WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM vendor_points WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM subscriptions WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM vendor_categories WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM delete_responses WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM orders WHERE vendor_id = ?').run(id);
  return db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
}

function deleteNonAdmin() {
  return db.prepare("DELETE FROM vendors WHERE username != 'admin'").run();
}

// ===== Delete requests =====

function saveDeleteResponse(vendorId, response) {
  return db.prepare('INSERT OR REPLACE INTO delete_responses (vendor_id, response) VALUES (?, ?)').run(vendorId, response);
}

function listDeleteRequests() {
  return db.prepare('SELECT v.*, dr.response, dr.created_at as req_date FROM vendors v JOIN delete_responses dr ON v.id = dr.vendor_id WHERE v.delete_requested = 1 ORDER BY dr.id DESC').all();
}

function deleteAllDeleteResponses() {
  return db.prepare('DELETE FROM delete_responses').run();
}

module.exports = {
  create,
  findByUsername,
  findById,
  findActiveById,
  findAdminByRole,
  getProfile,
  updateStatus,
  updateStatusWithReason,
  setCommission,
  resetCommission,
  getCommission,
  setDeleteRequested,
  getDeleteRequested,
  listAll,
  listAdminVendors,
  listActivePublic, findManyByIds,
  countAll,
  countActive,
  countPending,
  countRejected,
  countDeleteRequests,
  countNonAdmin,
  countActiveNonAdmin,
  deleteFull,
  deleteNonAdmin,
  saveDeleteResponse,
  listDeleteRequests,
  deleteAllDeleteResponses
};