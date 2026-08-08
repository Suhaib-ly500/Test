const { q, qOne, qRun, qTxn } = require('../db');

// ===== Customer points =====

async function getCustomerPoints(phone) {
  return qOne('SELECT points FROM customer_points WHERE phone=?', [phone]);
}

async function createCustomerPoints(phone, points) {
  return qRun('INSERT INTO customer_points (phone, points) VALUES (?, ?)', [phone, points]);
}

async function addCustomerPoints(phone, points) {
  return qRun('UPDATE customer_points SET points = points + ? WHERE phone=?', [points, phone]);
}

async function redeemCustomerPoints(phone, points) {
  return qRun('UPDATE customer_points SET points = points - ? WHERE phone=?', [points, phone]);
}

async function insertCustomerTxn(phone, points, type, orderId) {
  return qRun('INSERT INTO customer_point_transactions (customer_phone, points, type, order_id) VALUES (?, ?, ?, ?)', [phone, points, type, orderId === undefined ? null : orderId]);
}

async function insertCustomerTxnNoOrder(phone, points, type) {
  return qRun('INSERT INTO customer_point_transactions (customer_phone, points, type) VALUES (?,?,?)', [phone, points, type]);
}

async function listAllCustomerPoints() {
  return q('SELECT * FROM customer_points ORDER BY points DESC');
}

async function listCustomerTxns(limit) {
  return q('SELECT * FROM customer_point_transactions ORDER BY id DESC LIMIT ?', [limit]);
}

async function deleteAllCustomerPoints() {
  return qRun('DELETE FROM customer_points');
}

async function deleteAllCustomerTxns() {
  return qRun('DELETE FROM customer_point_transactions');
}

// ===== Vendor points =====

async function getVendorPoints(vendorId) {
  return qOne('SELECT * FROM vendor_points WHERE vendor_id=?', [vendorId]);
}

async function createVendorPoints(vendorId, points, dailyDate, dailyTotal) {
  return qRun('INSERT INTO vendor_points (vendor_id, points, daily_sales_date, daily_sales_total) VALUES (?, ?, ?, ?)', [vendorId, points, dailyDate, dailyTotal]);
}

async function addVendorPoints(vendorId, points) {
  return qRun('UPDATE vendor_points SET points = points + ? WHERE vendor_id=?', [points, vendorId]);
}

async function redeemVendorPoints(vendorId, points) {
  return qRun('UPDATE vendor_points SET points = points - ? WHERE vendor_id=?', [points, vendorId]);
}

async function updateVendorDailySales(vendorId, amount) {
  return qRun('UPDATE vendor_points SET daily_sales_total = daily_sales_total + ? WHERE vendor_id=?', [amount, vendorId]);
}

async function resetVendorDailySales(vendorId, amount, today) {
  return qRun('UPDATE vendor_points SET daily_sales_total = ?, daily_sales_date = ? WHERE vendor_id=?', [amount, today, vendorId]);
}

async function insertVendorTxn(vendorId, points, type) {
  return qRun('INSERT INTO vendor_point_transactions (vendor_id, points, type) VALUES (?, ?, ?)', [vendorId, points, type]);
}

async function sumVendorEarnedToday(vendorId, today) {
  const r = await qOne("SELECT COALESCE(SUM(points),0) as total FROM vendor_point_transactions WHERE vendor_id=? AND type='earn' AND date(created_at)=?", [vendorId, today]);
  return r ? r.total : 0;
}

async function listAllVendorPoints() {
  return q('SELECT vp.*, v.display_name as vendor_name FROM vendor_points vp JOIN vendors v ON vp.vendor_id = v.id ORDER BY vp.points DESC');
}

async function listAllReductions() {
  return q('SELECT vcr.*, v.display_name as vendor_name FROM vendor_commission_reductions vcr JOIN vendors v ON vcr.vendor_id = v.id ORDER BY vcr.expires_at ASC');
}

async function deleteAllVendorPoints() {
  return qRun('DELETE FROM vendor_points');
}

async function deleteAllVendorTxns() {
  return qRun('DELETE FROM vendor_point_transactions');
}

async function deleteAllReductions() {
  return qRun('DELETE FROM vendor_commission_reductions');
}

async function deleteVendorPoints(vendorId) {
  return qRun('DELETE FROM vendor_points WHERE vendor_id = ?', [vendorId]);
}

async function deleteVendorTxns(vendorId) {
  return qRun('DELETE FROM vendor_point_transactions WHERE vendor_id = ?', [vendorId]);
}

async function deleteVendorReductions(vendorId) {
  return qRun('DELETE FROM vendor_commission_reductions WHERE vendor_id = ?', [vendorId]);
}

// ===== Commission reductions =====

async function listActiveReductions(vendorId) {
  return q(`SELECT * FROM vendor_commission_reductions WHERE vendor_id=? AND expires_at > datetime('now') ORDER BY expires_at ASC`, [vendorId]);
}

async function sumActiveReductions(vendorId, nowIso) {
  return qOne('SELECT COALESCE(SUM(reduction_percent),0) as total FROM vendor_commission_reductions WHERE vendor_id=? AND expires_at > ?', [vendorId, nowIso]);
}

async function insertReduction(vendorId, reductionPercent, expiresIso) {
  return qRun('INSERT INTO vendor_commission_reductions (vendor_id, reduction_percent, expires_at) VALUES (?, ?, ?)', [vendorId, reductionPercent, expiresIso]);
}

async function redeemReduction(vendorId, points, reductionPercent, expiresIso) {
  return qTxn(async () => {
    await redeemVendorPoints(vendorId, points);
    await insertVendorTxn(vendorId, points, 'redeem');
    return insertReduction(vendorId, reductionPercent, expiresIso);
  });
}

// ===== Settings helpers =====

async function getSettingValue(key, fallback) {
  const row = await qOne('SELECT value FROM settings WHERE key = ?', [key]);
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