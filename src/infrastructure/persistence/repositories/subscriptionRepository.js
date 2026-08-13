const { q, qOne, qRun } = require('../db');

// ===== Subscriptions =====

async function listByVendor(vendorId) {
  return q('SELECT s.*, vc.name as cat_name FROM subscriptions s LEFT JOIN vendor_categories vc ON s.cat_id = vc.id WHERE s.vendor_id = ? ORDER BY s.id DESC', [vendorId]);
}

async function findById(id) {
  return qOne('SELECT id, cat_id FROM subscriptions WHERE id = ?', [id]);
}

async function findByIdAndVendor(id, vendorId) {
  return qOne('SELECT id FROM subscriptions WHERE id = ? AND vendor_id = ?', [id, vendorId]);
}

async function findByNameAndVendor(name, vendorId) {
  return qOne('SELECT id, cat_id FROM subscriptions WHERE name = ? AND vendor_id = ?', [name, vendorId]);
}

async function findActiveByIdAndVendor(id, vendorId) {
  return qOne('SELECT id FROM subscriptions WHERE id = ? AND vendor_id = ? AND is_active = 1', [id, vendorId]);
}

async function findActiveByNameAndVendor(name, vendorId) {
  return qOne('SELECT id FROM subscriptions WHERE name = ? AND vendor_id = ? AND is_active = 1', [name, vendorId]);
}

async function getCommission(id) {
  return qOne('SELECT commission_rate FROM subscriptions WHERE id = ?', [id]);
}

async function listAllWithCommission() {
  return q('SELECT id, name, vendor_id, cat_id, commission_rate FROM subscriptions');
}

async function create({ vendorId, catId, name, description, price, duration, image }) {
  return qRun('INSERT INTO subscriptions (vendor_id, cat_id, name, description, price, duration, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)', [vendorId, catId || null, name, description || '', price, duration || '', image]);
}

async function update(id, vendorId, { catId, name, description, price, duration, image }) {
  return qRun('UPDATE subscriptions SET cat_id=?, name=?, description=?, price=?, duration=?, image_path=? WHERE id=? AND vendor_id=?', [catId || null, name, description || '', price, duration || '', image, id, vendorId]);
}

async function updateWithActive(id, vendorId, { catId, name, description, price, duration, image, isActive }) {
  return qRun('UPDATE subscriptions SET cat_id=?, name=?, description=?, price=?, duration=?, image_path=?, is_active=? WHERE id=? AND vendor_id=?', [catId || null, name, description || '', price, duration || '', image, isActive, id, vendorId]);
}

async function deleteById(id, vendorId) {
  return qRun('DELETE FROM subscriptions WHERE id = ? AND vendor_id = ?', [id, vendorId]);
}

async function countByVendor(vendorId) {
  const r = await qOne('SELECT COUNT(*) as c FROM subscriptions WHERE vendor_id = ?', [vendorId]);
  return r ? r.c : 0;
}

async function countsByVendor() {
  return q('SELECT vendor_id, COUNT(*) as c FROM subscriptions GROUP BY vendor_id');
}

async function countAll() {
  const r = await qOne('SELECT COUNT(*) as c FROM subscriptions');
  return r ? r.c : 0;
}

async function countActive() {
  const r = await qOne('SELECT COUNT(*) as c FROM subscriptions WHERE is_active = 1');
  return r ? r.c : 0;
}

async function incrementViews(id) {
  return qRun('UPDATE subscriptions SET views = views + 1 WHERE id = ?', [id]);
}

async function listAll() {
  return q('SELECT * FROM subscriptions');
}

async function deleteAll() {
  return qRun('DELETE FROM subscriptions');
}

// ===== Marketplace search (public) =====

async function searchOfferings({ search, vendor, category }) {
  let sql = 'SELECT s.*, v.id as vendor_id, v.display_name as vendor_name, v.phone as vendor_phone, v.photo_path as vendor_photo, vc.id as cat_id, vc.name as cat_name, vc.description as cat_description, vc.image_path as cat_image FROM subscriptions s JOIN vendors v ON s.vendor_id = v.id LEFT JOIN vendor_categories vc ON s.cat_id = vc.id WHERE v.status = ?';
  const params = ['active'];
  if (search) { sql += ' AND (s.name LIKE ? OR s.description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  if (vendor) { sql += ' AND s.vendor_id = ?'; params.push(vendor); }
  if (category) {
    if (category === 'uncategorized') sql += ' AND s.cat_id IS NULL';
    else { sql += ' AND s.cat_id = ?'; params.push(category); }
  }
  sql += ' ORDER BY v.id, vc.id, s.id DESC';
  return q(sql, params);
}

async function listCategoriesWithSubs() {
  return q('SELECT vc.*, v.display_name as vendor_name FROM vendor_categories vc JOIN vendors v ON vc.vendor_id = v.id WHERE v.status = ? AND (SELECT COUNT(*) FROM subscriptions WHERE cat_id = vc.id AND is_active = 1) > 0 ORDER BY vc.name', ['active']);
}

// ===== Featured subscriptions =====

async function findFeatured(subscriptionId) {
  return qOne('SELECT * FROM featured_subscriptions WHERE subscription_id = ?', [subscriptionId]);
}

async function listFeaturedActive() {
  return q('SELECT s.*, v.display_name as vendor_name, v.phone as vendor_phone, vc.name as cat_name, f.special_price FROM featured_subscriptions f JOIN subscriptions s ON f.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id LEFT JOIN vendor_categories vc ON s.cat_id = vc.id WHERE v.status = ? AND s.is_active = 1 ORDER BY f.id DESC', ['active']);
}

async function listFeaturedAll() {
  return q('SELECT f.*, s.name as sub_name, v.display_name as vendor_name FROM featured_subscriptions f JOIN subscriptions s ON f.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id ORDER BY f.id DESC');
}

async function addFeatured(subscriptionId, specialPrice) {
  return qRun('INSERT INTO featured_subscriptions (subscription_id, special_price) VALUES (?, ?)', [subscriptionId, specialPrice || null]);
}

async function removeFeatured(id) {
  return qRun('DELETE FROM featured_subscriptions WHERE id = ?', [id]);
}

async function deleteAllFeatured() {
  return qRun('DELETE FROM featured_subscriptions');
}

// ===== Customer offers =====

async function findActiveOfferForSub(subscriptionId) {
  return qOne(`SELECT * FROM customer_offers WHERE subscription_id = ? AND (valid_until IS NULL OR valid_until > datetime('now'))`, [subscriptionId]);
}

async function listOffersActive() {
  return q(`SELECT co.*, s.name as sub_name, s.price, v.display_name as vendor_name FROM customer_offers co JOIN subscriptions s ON co.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id WHERE (co.valid_until IS NULL OR co.valid_until > datetime('now')) AND s.is_active = 1`);
}

async function listOffersAll() {
  return q('SELECT co.*, s.name as sub_name, s.price, v.display_name as vendor_name FROM customer_offers co JOIN subscriptions s ON co.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id ORDER BY co.id DESC');
}

async function createOffer(subscriptionId, discountPercent, validUntil) {
  return qRun('INSERT INTO customer_offers (subscription_id, discount_percent, valid_until) VALUES (?, ?, ?)', [subscriptionId, discountPercent, validUntil || null]);
}

async function deleteOffer(id) {
  return qRun('DELETE FROM customer_offers WHERE id = ?', [id]);
}

async function deleteOffersBySub(subscriptionId) {
  return qRun('DELETE FROM customer_offers WHERE subscription_id = ?', [subscriptionId]);
}

async function deleteAllOffers() {
  return qRun('DELETE FROM customer_offers');
}

// ===== Ratings =====

async function avgRatingFor(subscriptionId) {
  return qOne('SELECT AVG(rating) as avg FROM ratings WHERE subscription_id = ?', [subscriptionId]);
}

async function listRatingsFor(subscriptionId) {
  return q('SELECT * FROM ratings WHERE subscription_id = ? ORDER BY id DESC', [subscriptionId]);
}

async function insertRating({ subscription_id, vendor_id, customer_name, rating, review }) {
  return qRun('INSERT INTO ratings (subscription_id, vendor_id, customer_name, rating, review) VALUES (?, ?, ?, ?, ?)', [subscription_id, vendor_id || null, customer_name || '', parseInt(rating), review || '']);
}

async function deleteAllRatings() {
  return qRun('DELETE FROM ratings');
}

// ===== Subscription views =====

async function insertView(subscriptionId, ip) {
  return qRun('INSERT INTO subscription_views (subscription_id, viewer_ip) VALUES (?, ?)', [subscriptionId, String(ip).slice(0, 100)]);
}

async function listViews(limit) {
  return q('SELECT sv.*, s.name as sub_name, v.display_name as vendor_name FROM subscription_views sv JOIN subscriptions s ON sv.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id ORDER BY sv.id DESC LIMIT ?', [limit]);
}

async function countTodayViews() {
  const r = await qOne("SELECT COUNT(*) as c FROM subscription_views WHERE date(created_at) = date('now')");
  return r ? r.c : 0;
}

async function countUniqueIpsToday() {
  const r = await qOne("SELECT COUNT(DISTINCT viewer_ip) as c FROM subscription_views WHERE date(created_at) = date('now')");
  return r ? r.c : 0;
}

async function topViewed(limit) {
  return q('SELECT s.name, v.display_name as vendor, COUNT(*) as views_count FROM subscription_views sv JOIN subscriptions s ON sv.subscription_id = s.id JOIN vendors v ON s.vendor_id = v.id GROUP BY sv.subscription_id ORDER BY views_count DESC LIMIT ?', [limit]);
}

async function totalViews() {
  const r = await qOne('SELECT COALESCE(SUM(views), 0) as total FROM subscriptions');
  return r ? r.total : 0;
}

async function deleteAllViews() {
  return qRun('DELETE FROM subscription_views');
}

module.exports = {
  listByVendor, findById, findByIdAndVendor, findByNameAndVendor, findActiveByIdAndVendor, findActiveByNameAndVendor,
  getCommission, listAllWithCommission, create, update, updateWithActive, deleteById, countByVendor, countsByVendor, countAll, countActive, incrementViews,
  listAll, deleteAll, searchOfferings, listCategoriesWithSubs,
  findFeatured, listFeaturedActive, listFeaturedAll, addFeatured, removeFeatured, deleteAllFeatured,
  findActiveOfferForSub, listOffersActive, listOffersAll, createOffer, deleteOffer, deleteOffersBySub, deleteAllOffers,
  avgRatingFor, listRatingsFor, insertRating, deleteAllRatings,
  insertView, listViews, countTodayViews, countUniqueIpsToday, topViewed, totalViews, deleteAllViews
};