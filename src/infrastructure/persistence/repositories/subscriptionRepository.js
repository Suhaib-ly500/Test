const { db } = require('../db');

// ===== Subscriptions =====

function listByVendor(vendorId) {
  return db.prepare('SELECT s.*, vc.name as cat_name FROM subscriptions s LEFT JOIN vendor_categories vc ON s.cat_id = vc.id WHERE s.vendor_id = ? ORDER BY s.id DESC').all(vendorId);
}

function findById(id) {
  return db.prepare('SELECT id, cat_id FROM subscriptions WHERE id = ?').get(id);
}

function findByIdAndVendor(id, vendorId) {
  return db.prepare('SELECT id FROM subscriptions WHERE id = ? AND vendor_id = ?').get(id, vendorId);
}

function findByNameAndVendor(name, vendorId) {
  return db.prepare('SELECT id, cat_id FROM subscriptions WHERE name = ? AND vendor_id = ?').get(name, vendorId);
}

function findActiveByIdAndVendor(id, vendorId) {
  return db.prepare('SELECT id FROM subscriptions WHERE id = ? AND vendor_id = ? AND is_active = 1').get(id, vendorId);
}

function findActiveByNameAndVendor(name, vendorId) {
  return db.prepare('SELECT id FROM subscriptions WHERE name = ? AND vendor_id = ? AND is_active = 1').get(name, vendorId);
}

function getCommission(id) {
  return db.prepare('SELECT commission_rate FROM subscriptions WHERE id = ?').get(id);
}

function create({ vendorId, catId, name, description, price, duration, image }) {
  return db.prepare('INSERT INTO subscriptions (vendor_id, cat_id, name, description, price, duration, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)').run(vendorId, catId || null, name, description || '', price, duration || '', image);
}

function update(id, vendorId, { catId, name, description, price, duration, image }) {
  return db.prepare('UPDATE subscriptions SET cat_id=?, name=?, description=?, price=?, duration=?, image_path=? WHERE id=? AND vendor_id=?').run(catId || null, name, description || '', price, duration || '', image, id, vendorId);
}

function updateWithActive(id, vendorId, { catId, name, description, price, duration, image, isActive }) {
  return db.prepare('UPDATE subscriptions SET cat_id=?, name=?, description=?, price=?, duration=?, image_path=?, is_active=? WHERE id=? AND vendor_id=?').run(catId || null, name, description || '', price, duration || '', image, isActive, id, vendorId);
}

function deleteById(id, vendorId) {
  return db.prepare('DELETE FROM subscriptions WHERE id = ? AND vendor_id = ?').run(id, vendorId);
}

function countByVendor(vendorId) {
  return db.prepare('SELECT COUNT(*) as c FROM subscriptions WHERE vendor_id = ?').get(vendorId).c;
}

function countAll() {
  return db.prepare('SELECT COUNT(*) as c FROM subscriptions').get().c;
}

function countActive() {
  return db.prepare('SELECT COUNT(*) as c FROM subscriptions WHERE is_active = 1').get().c;
}

function incrementViews(id) {
  return db.prepare('UPDATE subscriptions SET views = views + 1 WHERE id = ?').run(id);
}

function listAll() {
  return db.prepare('SELECT * FROM subscriptions').all();
}

function deleteAll() {
  return db.prepare('DELETE FROM subscriptions').run();
}

// ===== Marketplace search (public) =====

function searchOfferings({ search, vendor, category }) {
  let sql = 'SELECT s.*, v.id as vendor_id, v.display_name as vendor_name, v.phone as vendor_phone, v.photo_path as vendor_photo, vc.id as cat_id, vc.name as cat_name, vc.description as cat_description, vc.image_path as cat_image FROM subscriptions s JOIN vendors v ON s.vendor_id = v.id LEFT JOIN vendor_categories vc ON s.cat_id = vc.id WHERE v.status = ?';
  const params = ['active'];
  if (search) { sql += ' AND (s.name LIKE ? OR s.description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  if (vendor) { sql += ' AND s.vendor_id = ?'; params.push(vendor); }
  if (category) {
    if (category === 'uncategorized') sql += ' AND s.cat_id IS NULL';
    else { sql += ' AND s.cat_id = ?'; params.push(category); }
  }
  sql += ' ORDER BY v.id, vc.id, s.id DESC';
  return db.prepare(sql).all(...params);
}

function listCategoriesWithSubs() {
  return db.prepare('SELECT vc.*, v.display_name as vendor_name FROM vendor_categories vc JOIN vendors v ON vc.vendor_id = v.id WHERE v.status = ? AND (SELECT COUNT(*) FROM subscriptions WHERE cat_id = vc.id AND is_active = 1) > 0 ORDER BY vc.name').all('active');
}

// ===== Featured subscriptions =====

function findFeatured(subscriptionId) {
  return db.prepare('SELECT * FROM featured_subscriptions WHERE subscription_id = ?').get(subscriptionId);
}

function listFeaturedActive() {
  return db.prepare('SELECT s.*, v.display_name as vendor_name, v.phone as vendor_phone, vc.name as cat_name, f.special_price FROM featured_subscriptions f JOIN subscriptions s ON f.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id LEFT JOIN vendor_categories vc ON s.cat_id = vc.id WHERE v.status = ? AND s.is_active = 1 ORDER BY f.id DESC').all('active');
}

function listFeaturedAll() {
  return db.prepare('SELECT f.*, s.name as sub_name, v.display_name as vendor_name FROM featured_subscriptions f JOIN subscriptions s ON f.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id ORDER BY f.id DESC').all();
}

function addFeatured(subscriptionId, specialPrice) {
  return db.prepare('INSERT INTO featured_subscriptions (subscription_id, special_price) VALUES (?, ?)').run(subscriptionId, specialPrice || null);
}

function removeFeatured(id) {
  return db.prepare('DELETE FROM featured_subscriptions WHERE id = ?').run(id);
}

function deleteAllFeatured() {
  return db.prepare('DELETE FROM featured_subscriptions').run();
}

// ===== Customer offers =====

function findActiveOfferForSub(subscriptionId) {
  return db.prepare(`SELECT * FROM customer_offers WHERE subscription_id = ? AND (valid_until IS NULL OR valid_until > datetime('now'))`).get(subscriptionId);
}

function listOffersActive() {
  return db.prepare(`SELECT co.*, s.name as sub_name, s.price, v.display_name as vendor_name FROM customer_offers co JOIN subscriptions s ON co.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id WHERE (co.valid_until IS NULL OR co.valid_until > datetime('now')) AND s.is_active = 1`).all();
}

function listOffersAll() {
  return db.prepare('SELECT co.*, s.name as sub_name, s.price, v.display_name as vendor_name FROM customer_offers co JOIN subscriptions s ON co.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id ORDER BY co.id DESC').all();
}

function createOffer(subscriptionId, discountPercent, validUntil) {
  return db.prepare('INSERT INTO customer_offers (subscription_id, discount_percent, valid_until) VALUES (?, ?, ?)').run(subscriptionId, discountPercent, validUntil || null);
}

function deleteOffer(id) {
  return db.prepare('DELETE FROM customer_offers WHERE id = ?').run(id);
}

function deleteOffersBySub(subscriptionId) {
  return db.prepare('DELETE FROM customer_offers WHERE subscription_id = ?').run(subscriptionId);
}

function deleteAllOffers() {
  return db.prepare('DELETE FROM customer_offers').run();
}

// ===== Ratings =====

function avgRatingFor(subscriptionId) {
  return db.prepare('SELECT AVG(rating) as avg FROM ratings WHERE subscription_id = ?').get(subscriptionId);
}

function listRatingsFor(subscriptionId) {
  return db.prepare('SELECT * FROM ratings WHERE subscription_id = ? ORDER BY id DESC').all(subscriptionId);
}

function insertRating({ subscription_id, vendor_id, customer_name, rating, review }) {
  return db.prepare('INSERT INTO ratings (subscription_id, vendor_id, customer_name, rating, review) VALUES (?, ?, ?, ?, ?)').run(subscription_id, vendor_id || null, customer_name || '', parseInt(rating), review || '');
}

function deleteAllRatings() {
  return db.prepare('DELETE FROM ratings').run();
}

// ===== Subscription views =====

function insertView(subscriptionId, ip) {
  return db.prepare('INSERT INTO subscription_views (subscription_id, viewer_ip) VALUES (?, ?)').run(subscriptionId, String(ip).slice(0, 100));
}

function listViews(limit) {
  return db.prepare('SELECT sv.*, s.name as sub_name, v.display_name as vendor_name FROM subscription_views sv JOIN subscriptions s ON sv.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id ORDER BY sv.id DESC LIMIT ?').all(limit);
}

function countTodayViews() {
  return db.prepare("SELECT COUNT(*) as c FROM subscription_views WHERE date(created_at) = date('now')").get().c;
}

function countUniqueIpsToday() {
  return db.prepare("SELECT COUNT(DISTINCT viewer_ip) as c FROM subscription_views WHERE date(created_at) = date('now')").get().c;
}

function topViewed(limit) {
  return db.prepare('SELECT s.name, v.display_name as vendor, COUNT(*) as views_count FROM subscription_views sv JOIN subscriptions s ON sv.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id GROUP BY sv.subscription_id ORDER BY views_count DESC LIMIT ?').all(limit);
}

function totalViews() {
  return db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM subscriptions').get().total;
}

function deleteAllViews() {
  return db.prepare('DELETE FROM subscription_views').run();
}

module.exports = {
  listByVendor, findById, findByIdAndVendor, findByNameAndVendor, findActiveByIdAndVendor, findActiveByNameAndVendor,
  getCommission, create, update, updateWithActive, deleteById, countByVendor, countAll, countActive, incrementViews,
  listAll, deleteAll, searchOfferings, listCategoriesWithSubs,
  findFeatured, listFeaturedActive, listFeaturedAll, addFeatured, removeFeatured, deleteAllFeatured,
  findActiveOfferForSub, listOffersActive, listOffersAll, createOffer, deleteOffer, deleteOffersBySub, deleteAllOffers,
  avgRatingFor, listRatingsFor, insertRating, deleteAllRatings,
  insertView, listViews, countTodayViews, countUniqueIpsToday, topViewed, totalViews, deleteAllViews
};