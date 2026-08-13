const { getSetting } = require('../../infrastructure/persistence/db');
const { computeEffectiveRate } = require('../../domain/commission');
const subscriptionRepository = require('../../infrastructure/persistence/repositories/subscriptionRepository');
const categoryRepository = require('../../infrastructure/persistence/repositories/categoryRepository');
const vendorRepository = require('../../infrastructure/persistence/repositories/vendorRepository');
const pointsRepository = require('../../infrastructure/persistence/repositories/pointsRepository');

// Resolution order: subscription -> category -> vendor -> global default, minus active reductions
async function effectiveRate(vendorId, subId, catId) {
  const now = new Date().toISOString();
  let reductionTotal = 0;
  if (vendorId) {
    const reductions = await pointsRepository.sumActiveReductions(vendorId, now);
    if (reductions && reductions.total > 0) reductionTotal = reductions.total;
  }
  const sub = subId ? await subscriptionRepository.getCommission(subId) : null;
  const cat = catId ? await categoryRepository.getCommission(catId) : null;
  const vendor = vendorId ? await vendorRepository.getCommission(vendorId) : null;
  const globalRate = parseFloat(await getSetting('global_commission_rate', '0')) || 0;
  return computeEffectiveRate({
    subRate: sub ? sub.commission_rate : undefined,
    catRate: cat ? cat.commission_rate : undefined,
    vendorRate: vendor ? vendor.commission_rate : undefined,
    globalRate,
    reductionTotal
  });
}

// Same rules as effectiveRate but with pre-fetched values (no DB calls)
function effectiveRateBatched({ subRate, catRate, vendorRate, globalRate, reductionTotal }) {
  return computeEffectiveRate({
    subRate: subRate === null || subRate === undefined ? undefined : subRate,
    catRate: catRate === null || catRate === undefined ? undefined : catRate,
    vendorRate: vendorRate === null || vendorRate === undefined ? undefined : vendorRate,
    globalRate,
    reductionTotal
  });
}

module.exports = { effectiveRate, effectiveRateBatched };