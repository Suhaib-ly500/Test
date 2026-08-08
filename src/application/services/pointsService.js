const { getSetting } = require('../../infrastructure/persistence/db');
const pointsRepository = require('../../infrastructure/persistence/repositories/pointsRepository');

// Earn customer points for a completed order (idempotent per call site)
async function awardCustomerPoints(phone, orderId) {
  if (!phone) return 0;
  const ptsPerOrder = parseFloat(await getSetting('customer_points_per_order', '5')) || 5;
  const exist = await pointsRepository.getCustomerPoints(phone);
  if (exist) await pointsRepository.addCustomerPoints(phone, ptsPerOrder);
  else await pointsRepository.createCustomerPoints(phone, ptsPerOrder);
  await pointsRepository.insertCustomerTxn(phone, ptsPerOrder, 'earn', orderId || 0);
  return ptsPerOrder;
}

// Redeem customer points when placing an order (no order_id recorded on txn)
async function redeemCustomerPoints(phone, points) {
  if (!points || !phone) return;
  const cp = await pointsRepository.getCustomerPoints(phone);
  if (cp && cp.points >= points) {
    await pointsRepository.redeemCustomerPoints(phone, points);
    await pointsRepository.insertCustomerTxnNoOrder(phone, points, 'redeem');
  }
}

// Shared flow when an order is marked completed (vendor or admin):
// customer points + vendor daily-target earnings
async function completeOrderPoints({ vendorId, orderId, amount, phone }) {
  await awardCustomerPoints(phone, orderId);
  if (!vendorId) return;
  const today = new Date().toISOString().split('T')[0];
  const target = parseFloat(await getSetting('vendor_daily_target', '200')) || 200;
  const ptsPerTarget = parseFloat(await getSetting('vendor_points_per_target', '10')) || 10;
  let vp = await pointsRepository.getVendorPoints(vendorId);
  if (vp && vp.daily_sales_date === today) await pointsRepository.updateVendorDailySales(vendorId, amount || 0);
  else if (vp) await pointsRepository.resetVendorDailySales(vendorId, amount || 0, today);
  else await pointsRepository.createVendorPoints(vendorId, 0, today, amount || 0);
  vp = await pointsRepository.getVendorPoints(vendorId);
  if (vp && vp.daily_sales_total >= target) {
    let earnedPts = Math.floor(vp.daily_sales_total / target) * ptsPerTarget;
    const prevEarned = await pointsRepository.sumVendorEarnedToday(vendorId, today);
    earnedPts = Math.max(0, earnedPts - prevEarned);
    if (earnedPts > 0) {
      await pointsRepository.addVendorPoints(vendorId, earnedPts);
      await pointsRepository.insertVendorTxn(vendorId, earnedPts, 'earn');
    }
  }
}

// Redeem vendor points for a commission reduction
async function redeemVendorPoints(vendorId, points) {
  const vp = await pointsRepository.getVendorPoints(vendorId);
  if (!vp || vp.points < points) return null;
  const reductionPercent = parseFloat(await getSetting('vendor_commission_reduction_per_point', '1')) || 1;
  const hours = parseFloat(await getSetting('vendor_reduction_hours', '24')) || 24;
  const totalReduction = reductionPercent * points;
  const expires = new Date(Date.now() + hours * 3600000).toISOString();
  await pointsRepository.redeemReduction(vendorId, points, totalReduction, expires);
  return totalReduction;
}

module.exports = { awardCustomerPoints, redeemCustomerPoints, completeOrderPoints, redeemVendorPoints };