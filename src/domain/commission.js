// Commission calculation rules — pure functions, no dependencies

function applyReduction(rate, reductionTotal) {
  return Math.max(0, rate - (reductionTotal || 0));
}

// Resolution order: subscription -> category -> vendor -> global default
function computeEffectiveRate({ subRate, catRate, vendorRate, globalRate, reductionTotal }) {
  if (subRate !== null && subRate !== undefined) return applyReduction(Number(subRate), reductionTotal);
  if (catRate !== null && catRate !== undefined) return applyReduction(Number(catRate), reductionTotal);
  if (vendorRate !== null && vendorRate !== undefined) return applyReduction(Number(vendorRate), reductionTotal);
  return applyReduction(Number(globalRate) || 0, reductionTotal);
}

module.exports = { applyReduction, computeEffectiveRate };
