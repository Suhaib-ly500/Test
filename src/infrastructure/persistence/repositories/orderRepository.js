const { db } = require('../db');

function insert({ customer_name, customer_phone, customer_email, vendor_id, subscription_name, amount, status, discount_amount, points_used }) {
  return db.prepare('INSERT INTO orders (customer_name, customer_phone, customer_email, vendor_id, subscription_name, amount, status, discount_amount, points_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(customer_name, customer_phone, customer_email, vendor_id || null, subscription_name, amount, status || 'pending', discount_amount || 0, points_used || 0);
}

// Bulk insert used by the public order endpoint
function insertMany(items) {
  const insert = db.prepare('INSERT INTO orders (customer_name, customer_phone, vendor_id, subscription_name, amount, status, discount_amount, points_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  return db.transaction((rows) => {
    for (let idx = 0; idx < rows.length; idx++) {
      const item = rows[idx];
      insert.run(item.customer_name, item.customer_phone, Number(item.vendor_id), item.subscription_name, Number(item.amount), 'pending', item.discountPerItem, item.pointsUsed);
    }
  })(items);
}

function listByVendor(vendorId) {
  return db.prepare('SELECT * FROM orders WHERE vendor_id = ? ORDER BY id DESC').all(vendorId);
}

function listAllWithVendor() {
  return db.prepare('SELECT o.*, v.display_name as vendor_name FROM orders o LEFT JOIN vendors v ON o.vendor_id = v.id ORDER BY o.id DESC').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

function findByIdAndVendor(id, vendorId) {
  return db.prepare('SELECT * FROM orders WHERE id=? AND vendor_id=?').get(id, vendorId);
}

function updateStatus(id, vendorId, status) {
  return db.prepare('UPDATE orders SET status=? WHERE id=? AND vendor_id=?').run(status, id, vendorId);
}

function updateStatusAdmin(id, status) {
  return db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
}

function updateToAwaiting(id, vendorId, screenshotsJson) {
  return db.prepare('UPDATE orders SET status=?, screenshot_path=? WHERE id=? AND vendor_id=?').run('awaiting_verification', JSON.stringify(screenshotsJson), id, vendorId);
}

function deleteById(id) {
  return db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

function countAll() {
  return db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
}

function countByStatus(status) {
  return db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = ?').get(status).count;
}

function countByVendor(vendorId) {
  return db.prepare('SELECT COUNT(*) as c FROM orders WHERE vendor_id = ?').get(vendorId).c;
}

function sumCompletedByVendor(vendorId) {
  return db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM orders WHERE vendor_id = ? AND status = 'completed'").get(vendorId).t;
}

function sumCompleted() {
  return db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM orders WHERE status = 'completed'").get().t;
}

function clearCompletedRevenue() {
  return db.prepare("UPDATE orders SET amount = 0 WHERE status = 'completed'").run();
}

function deleteAll() {
  return db.prepare('DELETE FROM orders').run();
}

module.exports = {
  insert, insertMany, listByVendor, listAllWithVendor, findById, findByIdAndVendor,
  updateStatus, updateStatusAdmin, updateToAwaiting, deleteById,
  countAll, countByStatus, countCompletedAndId: countByStatus, countByVendor, sumCompletedByVendor, sumCompleted,
  clearCompletedRevenue, deleteAll
};