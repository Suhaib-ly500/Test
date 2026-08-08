const crypto = require('crypto');
const tokenRepository = require('../../infrastructure/persistence/repositories/tokenRepository');
const vendorRepository = require('../../infrastructure/persistence/repositories/vendorRepository');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isExpired(sessionOrDate) {
  if (!sessionOrDate) return true;
  const created = typeof sessionOrDate === 'object' ? sessionOrDate.created_at : sessionOrDate;
  if (!created) return false;
  const t = Date.parse(String(created).replace(' ', 'T'));
  if (isNaN(t)) return false;
  return (Date.now() - t) > TOKEN_TTL_MS;
}

async function issueToken(vendorId, isAdmin) {
  const token = crypto.randomBytes(32).toString('hex');
  await tokenRepository.insert(vendorId, token, isAdmin ? 1 : 0);
  return token;
}

async function logout(token) {
  if (token) await tokenRepository.deleteByToken(token);
}

async function cleanupExpired() {
  await tokenRepository.deleteExpired();
}

async function cleanupOldForVendor(vendorId) {
  await tokenRepository.deleteOldForVendor(vendorId);
}

async function findSession(token) {
  return tokenRepository.findSession(token);
}

module.exports = { TOKEN_TTL_MS, isExpired, issueToken, logout, cleanupExpired, cleanupOldForVendor, findSession };