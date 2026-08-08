const { q, qOne, qRun, qTxn } = require('../db');

async function insert({ customer_name, customer_phone, customer_email, vendor_id, subscription_name, amount, status, discount_amount, points_used }) {
  return qRun('INSERT INTO orders (customer_name, customer_phone, customer_email, vendor_id, subscription_name, amount, status, discount_amount, points_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [customer_name, customer_phone, customer_email, vendor_id || null, subscription_name, amount, status || 'pending', discount_amount || 0, points_used || 0]);
}

// Bulk insert used by the public order endpoint
async function insertMany(items) {
  return qTxn(async () => {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      await qRun('INSERT INTO orders (customer_name, customer_phone, vendor_id, subscription_name, amount, status, discount_amount, points_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [item.customer_name, item.customer_phone, Number(item.vendor_id), item.subscription_name, Number(item.amount), 'pending', item.discountPerItem, item.pointsUsed]);
    }
  });
}

async function listByVendor(vendorId) {
  return q('SELECT * FROM orders WHERE vendor_id = ? ORDER BY id DESC', [vendorId]);
}

async function listAllWithVendor() {
  return q('SELECT o.*, v.display_name as vendor_name FROM orders o LEFT JOIN vendors v ON o.vendor_id = v.id ORDER BY o.id DESC');
}

async function findById(id) {
  return qOne('SELECT * FROM orders WHERE id = ?', [id]);
}

async function findByIdAndVendor(id, vendorId) {
  return qOne('SELECT * FROM orders WHERE id=? AND vendor_id=?', [id, vendorId]);
}

async function updateStatus(id, vendorId, status) {
  return qRun('UPDATE orders SET status=? WHERE id=? AND vendor_id=?', [status, id, vendorId]);
}

async function updateStatusAdmin(id, status) {
  return qRun('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
}

async function updateToAwaiting(id, vendorId, screenshotsJson) {
  return qRun('UPDATE orders SET status=?, screenshot_path=? WHERE id=? AND vendor_id=?', ['awaiting_verification', JSON.stringify(screenshotsJson), id, vendorId]);
}

async function deleteById(id) {
  return qRun('DELETE FROM orders WHERE id = ?', [id]);
}

async function countAll() {
  const r = await qOne('SELECT COUNT(*) as count FROM orders');
  return r ? r.count : 0;
}

async function countByStatus(status) {
  const r = await qOne('SELECT COUNT(*) as count FROM orders WHERE status = ?', [status]);
  return r ? r.count : 0;
}

async function countByVendor(vendorId) {
  const r = await qOne('SELECT COUNT(*) as c FROM orders WHERE vendor_id = ?', [vendorId]);
  return r ? r.c : 0;
}

async function sumCompletedByVendor(vendorId) {
  const r = await qOne("SELECT COALESCE(SUM(amount), 0) as t FROM orders WHERE vendor_id = ? AND status = 'completed'", [vendorId]);
  return r ? r.t : 0;
}

async function sumCompleted() {
  const r = await qOne("SELECT COALESCE(SUM(amount), 0) as t FROM orders WHERE status = 'completed'");
  return r ? r.t : 0;
}

async function clearCompletedRevenue() {
  return qRun("UPDATE orders SET amount = 0 WHERE status = 'completed'");
}

async function deleteAll() {
  return qRun('DELETE FROM orders');
}

module.exports = {
  insert, insertMany, listByVendor, listAllWithVendor, findById, findByIdAndVendor,
  updateStatus, updateStatusAdmin, updateToAwaiting, deleteById,
  countAll, countByStatus, countCompletedAndId: countByStatus, countByVendor, sumCompletedByVendor, sumCompleted,
  clearCompletedRevenue, deleteAll
};