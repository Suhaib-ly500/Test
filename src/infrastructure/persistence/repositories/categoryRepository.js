const { db } = require('../db');

function listByVendor(vendorId) {
  return db.prepare('SELECT vc.*, (SELECT COUNT(*) FROM subscriptions WHERE cat_id = vc.id) as sub_count FROM vendor_categories vc WHERE vc.vendor_id = ? ORDER BY vc.id DESC').all(vendorId);
}

function findById(id) {
  return db.prepare('SELECT * FROM vendor_categories WHERE id = ?').get(id);
}

function getCommission(id) {
  return db.prepare('SELECT commission_rate FROM vendor_categories WHERE id = ?').get(id);
}

function create(vendorId, name, description, image) {
  return db.prepare('INSERT INTO vendor_categories (vendor_id, name, description, image_path) VALUES (?, ?, ?, ?)').run(vendorId, name, description || '', image);
}

function update(id, vendorId, name, description, image) {
  return db.prepare('UPDATE vendor_categories SET name=?, description=?, image_path=? WHERE id=? AND vendor_id=?').run(name, description || '', image, id, vendorId);
}

function deleteById(id, vendorId) {
  return db.prepare('DELETE FROM vendor_categories WHERE id = ? AND vendor_id = ?').run(id, vendorId);
}

function listSubIds(catId, vendorId) {
  return db.prepare('SELECT id FROM subscriptions WHERE cat_id = ? AND vendor_id = ?').all(catId, vendorId);
}

function deleteSubsByCat(catId, vendorId) {
  return db.prepare('DELETE FROM subscriptions WHERE cat_id = ? AND vendor_id = ?').run(catId, vendorId);
}

function deleteOffersForSubs(subIds) {
  const del = db.prepare('DELETE FROM customer_offers WHERE subscription_id = ?');
  for (const s of subIds) del.run(s.id);
}

function deleteAll() {
  return db.prepare('DELETE FROM vendor_categories').run();
}

module.exports = { listByVendor, findById, getCommission, create, update, deleteById, listSubIds, deleteSubsByCat, deleteOffersForSubs, deleteAll };