const { db } = require('../db');

// ===== Customer points =====

function getCustomerPoints(phone) {
  return db.prepare('SELECT points FROM customer_points WHERE phone=?').get(phone);
}

function createCustomerPoints(phone, points) {
  return db.prepare('INSERT INTO customer_points (phone, points) VALUES (?, ?)').run(phone, points);
}

function addCustomerPoints(phone, points) {
  return db.prepare('UPDATE customer_points SET points = points + ? WHERE phone=?').run(points, phone);
}

function redeemCustomerPoints(phone, points) {
  return db.prepare('UPDATE customer_points SET points = points - ? WHERE phone=?').run(points, phone);
}

function insertCustomerTxn(phone, points, type, orderId) {
  return db.prepare('INSERT INTO customer_point_transactions (customer_phone, points, type, order_id) VALUES (?, ?, ?, ?)').run(phone, points, type, orderId === undefined ? null : orderId);
}

function insertCustomerTxnNoOrder(phone, points, type) {
  return db.prepare('INSERT INTO customer_point_transactions (customer_phone, points, type) VALUES (?,?,?)').run(phone, points, type);
}

function listAllCustomerPoints() {
  return db.prepare('SELECT * FROM customer_points ORDER BY points DESC').all();
}

function listCustomerTxns(limit) {
  return db.prepare('SELECT * FROM customer_point_transactions ORDER BY id DESC LIMIT ?').all(limit);
}

function deleteAllCustomerPoints() {
  return db.prepare('DELETE FROM customer_points').run();
}

function deleteAllCustomerTxns() {
  return db.prepare('DELETE FROM customer_point_transactions').run();
}

// ===== Vendor points =====

function getVendorPoints(vendorId) {
  return db.prepare('SELECT * FROM vendor_points WHERE vendor_id=?').get(vendorId);
}

function createVendorPoints(vendorId, points, dailyDate, dailyTotal) {
  return db.prepare('INSERT INTO vendor_points (vendor_id, points, daily_sales_date, daily_sales_total) VALUES (?, ?, ?, ?)').run(vendorId, points, dailyDate, dailyTotal);
}

function addVendorPoints(vendorId, points) {
  return db.prepare('UPDATE vendor_points SET points = points + ? WHERE vendor_id=?').run(points, vendorId);
}

function redeemVendorPoints(vendorId, points) {
  return db.prepare('UPDATE vendor_points SET points = points - ? WHERE vendor_id=?').run(points, vendorId);
}

function updateVendorDailySales(vendorId, amount) {
  return db.prepare('UPDATE vendor_points SET daily_sales_total = daily_sales_total + ? WHERE vendor_id=?').run(amount, vendorId);
}

function resetVendorDailySales(vendorId, amount, today) {
  return db.prepare('UPDATE vendor_points SET daily_sales_total = ?, daily_sales_date = ? WHERE vendor_id=?').run(amount, today, vendorId);
}

function insertVendorTxn(vendorId, points, type) {
  return db.prepare('INSERT INTO vendor_point_transactions (vendor_id, points, type) VALUES (?, ?, ?)').run(vendorId, points, type);
}

function sumVendorEarnedToday(vendorId, today) {
  return db.prepare("SELECT COALESCE(SUM(points),0) as total FROM vendor_point_transactions WHERE vendor_id=? AND type='earn' AND date(created_at)=?").get(vendorId, today).total;
}

function listAllVendorPoints() {
  return db.prepare('SELECT vp.*, v.display_name as vendor_name FROM vendor_points vp JOIN vendors v ON vp.vendor_id = v.id ORDER BY vp.points DESC').all();
}

function listAllReductions() {
  return db.prepare('SELECT vcr.*, v.display_name as vendor_name FROM vendor_commission_reductions vcr JOIN vendors v ON vcr.vendor_id = v.id ORDER BY vcr.expires_at ASC').all();
}

function deleteAllVendorPoints() {
  return db.prepare('DELETE FROM vendor_points').run();
}

function deleteAllVendorTxns() {
  return db.prepare('DELETE FROM vendor_point_transactions').run();
}

function deleteAllReductions() {
  return db.prepare('DELETE FROM vendor_commission_reductions').run();
}

function deleteVendorPoints(vendorId) {
  return db.prepare('DELETE FROM vendor_points WHERE vendor_id = ?').run(vendorId);
}

function deleteVendorTxns(vendorId) {
  return db.prepare('DELETE FROM vendor_point_transactions WHERE vendor_id = ?').run(vendorId);
}

function deleteVendorReductions(vendorId) {
  return db.prepare('DELETE FROM vendor_commission_reductions WHERE vendor_id = ?').run(vendorId);
}

// ===== Commission reductions =====

function listActiveReductions(vendorId) {
  return db.prepare(`SELECT * FROM vendor_commission_reductions WHERE vendor_id=? AND expires_at > datetime('now') ORDER BY expires_at ASC`).all(vendorId);
}

function sumActiveReductions(vendorId, nowIso) {
  return db.prepare('SELECT COALESCE(SUM(reduction_percent),0) as total FROM vendor_commission_reductions WHERE vendor_id=? AND expires_at > ?').get(vendorId, nowIso);
}

function insertReduction(vendorId, reductionPercent, expiresIso) {
  return db.prepare('INSERT INTO vendor_commission_reductions (vendor_id, reduction_percent, expires_at) VALUES (?, ?, ?)').run(vendorId, reductionPercent, expiresIso);
}

function redeemReduction(vendorId, points, reductionPercent, expiresIso) {
  redeemVendorPoints(vendorId, points);
  insertVendorTxn(vendorId, points, 'redeem');
  return insertReduction(vendorId, reductionPercent, expiresIso);
}

// ===== Settings helpers =====

function getSettingValue(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

module.exports = {
  getCustomerPoints, createCustomerPoints, addCustomerPoints, redeemCustomerPoints,
  insertCustomerTxn, insertCustomerTxnNoOrder, listAllCustomerPoints, listCustomerTxns,
  deleteAllCustomerPoints, deleteAllCustomerTxns,
  getVendorPoints, createVendorPoints, addVendorPoints, redeemVendorPoints,
  updateVendorDailySales, resetVendorDailySales, insertVendorTxn, sumVendorEarnedToday,
  listAllVendorPoints, listAllReductions, deleteAllVendorPoints, deleteAllVendorTxns, deleteAllReductions,
  deleteVendorPoints, deleteVendorTxns, deleteVendorReductions,
  listActiveReductions, sumActiveReductions, insertReduction, redeemReduction,
  getSetting: getSettingValue
};