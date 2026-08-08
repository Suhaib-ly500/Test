const { q, qOne, qRun } = require('../db');

async function listByVendor(vendorId) {
  return q('SELECT vc.*, (SELECT COUNT(*) FROM subscriptions WHERE cat_id = vc.id) as sub_count FROM vendor_categories vc WHERE vc.vendor_id = ? ORDER BY vc.id DESC', [vendorId]);
}

async function findById(id) {
  return qOne('SELECT * FROM vendor_categories WHERE id = ?', [id]);
}

async function getCommission(id) {
  return qOne('SELECT commission_rate FROM vendor_categories WHERE id = ?', [id]);
}

async function create(vendorId, name, description, image) {
  return qRun('INSERT INTO vendor_categories (vendor_id, name, description, image_path) VALUES (?, ?, ?, ?)', [vendorId, name, description || '', image]);
}

async function update(id, vendorId, name, description, image) {
  return qRun('UPDATE vendor_categories SET name=?, description=?, image_path=? WHERE id=? AND vendor_id=?', [name, description || '', image, id, vendorId]);
}

async function deleteById(id, vendorId) {
  return qRun('DELETE FROM vendor_categories WHERE id = ? AND vendor_id = ?', [id, vendorId]);
}

async function listSubIds(catId, vendorId) {
  return q('SELECT id FROM subscriptions WHERE cat_id = ? AND vendor_id = ?', [catId, vendorId]);
}

async function deleteSubsByCat(catId, vendorId) {
  return qRun('DELETE FROM subscriptions WHERE cat_id = ? AND vendor_id = ?', [catId, vendorId]);
}

async function deleteOffersForSubs(subIds) {
  for (const s of subIds) {
    await qRun('DELETE FROM customer_offers WHERE subscription_id = ?', [s.id]);
  }
}

async function deleteAll() {
  return qRun('DELETE FROM vendor_categories');
}

module.exports = { listByVendor, findById, getCommission, create, update, deleteById, listSubIds, deleteSubsByCat, deleteOffersForSubs, deleteAll };