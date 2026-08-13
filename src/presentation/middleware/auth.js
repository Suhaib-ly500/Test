const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { config } = require('../../infrastructure/config');
const tokenRepository = require('../../infrastructure/persistence/repositories/tokenRepository');
const vendorRepository = require('../../infrastructure/persistence/repositories/vendorRepository');
const authService = require('../../application/services/authService');

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const validPageTokens = new Set();
const secret = config.encryptionKey;

function signToken(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function generatePageToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const t = Date.now().toString(36);
  return t + '.' + token + '.' + signToken(t + '.' + token);
}

function verifyPageToken(token) {
  if (!token) return false;
  if (validPageTokens.has(token)) return true;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [t, tok, sig] = parts;
  if (!t || !tok || !sig) return false;
  const expected = signToken(t + '.' + tok);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const issuedAt = parseInt(t, 36);
  if (!issuedAt || Date.now() - issuedAt > TOKEN_TTL_MS) return false;
  validPageTokens.add(token);
  return true;
}

setInterval(() => { validPageTokens.clear(); }, 3600000);

setInterval(() => { authService.cleanupExpired().catch(() => {}); }, 3600000);

const htmlTokenMiddleware = (req, res, next) => {
  let servePath = req.path;
  if (servePath === '/' || servePath === '') servePath = '/index.html';
  if (servePath.endsWith('.html')) {
    // Path traversal protection: reject '..' segments and anything escaping the root
    const parts = servePath.split(/[\\/]/);
    if (parts.some(p => p === '..')) {
      return res.status(404).send('Not found');
    }
    const resolved = path.resolve(config.root, '.' + servePath);
    const rootResolved = path.resolve(config.root);
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      return res.status(404).send('Not found');
    }
    if (!fs.existsSync(resolved)) return next();
    const token = generatePageToken();
    const content = fs.readFileSync(resolved, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(content.replace('</head>', '<meta name="csrf-token" content="' + token + '">\n</head>'));
  }
  next();
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { success: false, message: '�?�?�?�?�?�?�? �?��?�?�? �?�?�?�?. �?�?�?�? 15 �?�?�?�?�?.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: 'طلبات كثيرة جداً. حاول لاحقاً.' }
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'طلبات كثيرة جداً. حاول لاحقاً.' }
});

const strictPostLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'طلبات كثيرة جداً. حاول لاحقاً.' }
});

async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ success: false, message: 'غير مصرح' });
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      if (!token || /^\d+$/.test(token)) return res.status(401).json({ success: false, message: 'غير مصرح - توكن غير صالح' });
      const session = await tokenRepository.findAdminSession(token);
      if (session && !authService.isExpired(session)) {
        req.adminId = session.vendor_id;
        return next();
      }
    }
    res.status(401).json({ success: false, message: 'غير مصرح - توكن غير صالح' });
  } catch (e) {
    next(e);
  }
}

async function requireVendor(req, res, next) {
  try {
    const token = req.headers['x-vendor-id'] || req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ success: false, message: 'غير مصرح - يرجى تسجيل الدخول' });
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(401).json({ success: false, message: 'غير مصرح - توكن غير صالح' });
    const session = await tokenRepository.findSession(token);
    if (!session || authService.isExpired(session)) {
      if (session) { try { await tokenRepository.deleteByToken(token); } catch (e) {} }
      return res.status(401).json({ success: false, message: 'توكن غير صالح. يرجى تسجيل الدخول مرة أخرى' });
    }
    const vendor = await vendorRepository.findActiveById(session.vendor_id);
    if (vendor) { req.vendorId = vendor.id; return next(); }
    res.status(403).json({ success: false, message: 'حسابك غير نشط' });
  } catch (e) {
    next(e);
  }
}

function requirePublicToken(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (!token || !verifyPageToken(token)) {
    return res.status(403).json({ success: false, message: 'طلب غير مصرح - يرجى تحديث الصفحة' });
  }
  next();
}

module.exports = { loginLimiter, apiLimiter, setupLimiter, strictPostLimiter, requireAdmin, requireVendor, requirePublicToken, htmlTokenMiddleware };