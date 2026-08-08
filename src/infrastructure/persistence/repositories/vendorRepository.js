const { q, qOne, qRun, qTxn } = require('../db');

// ===== Vendors =====

async function create({ username, password, fullname = '', display_name = username, age = 0, location = '', email = '', phone = '', social_link = '', photo_path = null, status = 'pending' }) {
  return qRun('INSERT INTO vendors (username, password, fullname, display_name, age, location, email, phone, social_link, photo_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [username, password, fullname, display_name, age, location, email, phone, social_link, photo_path, status]);
}

async function findByUsername(username) {
  return qOne('SELECT * FROM vendors WHERE username = ?', [username]);
}

async function findById(id) {
  return qOne('SELECT * FROM vendors WHERE id = ?', [id]);
}

async function findActiveById(id) {
  return qOne('SELECT id, username, fullname, display_name, status FROM vendors WHERE id = ? AND status = ?', [id, 'active']);
}

async function findAdminByRole() {
  return qOne("SELECT id FROM vendors WHERE fullname = 'مشرف المنصة'");
}

async function getProfile(id) {
  return qOne('SELECT id, username, fullname, display_name, age, location, email, phone, social_link, photo_path, status, commission_rate, created_at FROM vendors WHERE id = ?', [id]);
}

async function updateStatus(id, status) {
  return qRun('UPDATE vendors SET status = ? WHERE id = ?', [status, id]);
}

async function updateStatusWithReason(id, status, reason) {
  await qRun('UPDATE vendors SET status = ? WHERE id = ?', [status, id]);
  return qRun('UPDATE vendors SET reject_reason = ? WHERE id = ?', [reason, id]);
}

async function setCommission(id, rate) {
  return qRun('UPDATE vendors SET commission_rate = ? WHERE id = ?', [rate, id]);
}

async function resetCommission(id) {
  return qRun('UPDATE vendors SET commission_rate = NULL WHERE id = ?', [id]);
}

async function getCommission(id) {
  return qOne('SELECT commission_rate FROM vendors WHERE id = ?', [id]);
}

async function setDeleteRequested(id) {
  return qRun('UPDATE vendors SET delete_requested = 1 WHERE id = ?', [id]);
}

async function getDeleteRequested(id) {
  const v = await qOne('SELECT delete_requested FROM vendors WHERE id = ?', [id]);
  return v ? v.delete_requested : 0;
}

async function listAll() {
  return q('SELECT id, username, fullname, display_name, age, location, email, phone, social_link, photo_path, status, commission_rate, delete_requested, created_at FROM vendors ORDER BY id DESC');
}

async function listAdminVendors() {
  return q("SELECT id, username, fullname, display_name, phone, email, location, photo_path, created_at FROM vendors WHERE fullname = 'مشرف المنصة' ORDER BY id ASC");
}

async function listActivePublic() {
  return q("SELECT id, display_name, phone FROM vendors WHERE status = 'active' AND username != ?", ['admin']);
}

async function findManyByIds(ids) {
  if (!ids || !ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return q('SELECT id, display_name, phone FROM vendors WHERE id IN (' + placeholders + ')', ids);
}

async function countAll() {
  const r = await qOne('SELECT COUNT(*) as count FROM vendors');
  return r ? r.count : 0;
}

async function countActive() {
  const r = await qOne("SELECT COUNT(*) as count FROM vendors WHERE status = 'active'");
  return r ? r.count : 0;
}

async function countPending() {
  const r = await qOne("SELECT COUNT(*) as count FROM vendors WHERE status = 'pending'");
  return r ? r.count : 0;
}

async function countRejected() {
  const r = await qOne("SELECT COUNT(*) as count FROM vendors WHERE status = 'rejected'");
  return r ? r.count : 0;
}

async function countDeleteRequests() {
  const r = await qOne('SELECT COUNT(*) as count FROM vendors WHERE delete_requested = 1');
  return r ? r.count : 0;
}

async function countNonAdmin() {
  const r = await qOne("SELECT COUNT(*) as c FROM vendors WHERE username != ?", ['admin']);
  return r ? r.c : 0;
}

async function countActiveNonAdmin() {
  const r = await qOne("SELECT COUNT(*) as c FROM vendors WHERE status = 'active' AND username != 'admin'");
  return r ? r.c : 0;
}

// ===== Full account purge (respects FK dependencies) =====

async function deleteFull(id) {
  return qTxn(async () => {
    await qRun('DELETE FROM customer_offers WHERE subscription_id IN (SELECT id FROM subscriptions WHERE vendor_id = ?)', [id]);
    await qRun('DELETE FROM ratings WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM activity_log WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM auth_tokens WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM vendor_point_transactions WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM vendor_commission_reductions WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM vendor_points WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM subscriptions WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM vendor_categories WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM delete_responses WHERE vendor_id = ?', [id]);
    await qRun('DELETE FROM orders WHERE vendor_id = ?', [id]);
    return qRun('DELETE FROM vendors WHERE id = ?', [id]);
  });
}

async function deleteNonAdmin() {
  return qRun("DELETE FROM vendors WHERE username != 'admin'");
}

// ===== Delete requests =====

async function saveDeleteResponse(vendorId, response) {
  return qRun('INSERT OR REPLACE INTO delete_responses (vendor_id, response) VALUES (?, ?)', [vendorId, response]);
}

async function listDeleteRequests() {
  return q('SELECT v.*, dr.response, dr.created_at as req_date FROM vendors v JOIN delete_responses dr ON v.id = dr.vendor_id WHERE v.delete_requested = 1 ORDER BY dr.id DESC');
}

async function deleteAllDeleteResponses() {
  return qRun('DELETE FROM delete_responses');
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