const { getSetting } = require('../../infrastructure/persistence/db');
const pointsRepository = require('../../infrastructure/persistence/repositories/pointsRepository');

// Earn customer points for a completed order (idempotent per call site)
function awardCustomerPoints(phone, orderId) {
  if (!phone) return 0;
  const ptsPerOrder = parseFloat(getSetting('customer_points_per_order', '5'));
  const exist = pointsRepository.getCustomerPoints(phone);
  if (exist) pointsRepository.addCustomerPoints(phone, ptsPerOrder);
  else pointsRepository.createCustomerPoints(phone, ptsPerOrder);
  pointsRepository.insertCustomerTxn(phone, ptsPerOrder, 'earn', orderId || 0);
  return ptsPerOrder;
}

// Redeem customer points when placing an order (no order_id recorded on txn)
function redeemCustomerPoints(phone, points) {
  if (!points || !phone) return;
  const cp = pointsRepository.getCustomerPoints(phone);
  if (cp && cp.points >= points) {
    pointsRepository.redeemCustomerPoints(phone, points);
    pointsRepository.insertCustomerTxnNoOrder(phone, points, 'redeem');
  }
}

// Shared flow when an order is marked completed (vendor or admin):
// customer points + vendor daily-target earnings
function completeOrderPoints({ vendorId, orderId, amount, phone }) {
  awardCustomerPoints(phone, orderId);
  if (!vendorId) return;
  const today = new Date().toISOString().split('T')[0];
  const target = parseFloat(getSetting('vendor_daily_target', '200'));
  const ptsPerTarget = parseFloat(getSetting('vendor_points_per_target', '10'));
  let vp = pointsRepository.getVendorPoints(vendorId);
  if (vp && vp.daily_sales_date === today) pointsRepository.updateVendorDailySales(vendorId, amount || 0);
  else if (vp) pointsRepository.resetVendorDailySales(vendorId, amount || 0, today);
  else pointsRepository.createVendorPoints(vendorId, 0, today, amount || 0);
  vp = pointsRepository.getVendorPoints(vendorId);
  if (vp && vp.daily_sales_total >= target) {
    let earnedPts = Math.floor(vp.daily_sales_total / target) * ptsPerTarget;
    const prevEarned = pointsRepository.sumVendorEarnedToday(vendorId, today);
    earnedPts = Math.max(0, earnedPts - prevEarned);
    if (earnedPts > 0) {
      pointsRepository.addVendorPoints(vendorId, earnedPts);
      pointsRepository.insertVendorTxn(vendorId, earnedPts, 'earn');
    }
  }
}

// Redeem vendor points for a commission reduction
function redeemVendorPoints(vendorId, points) {
  const vp = pointsRepository.getVendorPoints(vendorId);
  if (!vp || vp.points < points) return null;
  const reductionPercent = parseFloat(getSetting('vendor_commission_reduction_per_point', '1'));
  const hours = parseFloat(getSetting('vendor_reduction_hours', '24'));
  const totalReduction = reductionPercent * points;
  const expires = new Date(Date.now() + hours * 3600000).toISOString();
  pointsRepository.redeemReduction(vendorId, points, totalReduction, expires);
  return totalReduction;
}

module.exports = { awardCustomerPoints, redeemCustomerPoints, completeOrderPoints, redeemVendorPoints };