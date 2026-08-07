function sameOriginGuard(req, res, next) {
  const method = req.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) return next();
  const secFetch = req.headers['sec-fetch-site'];
  if (secFetch && secFetch === 'cross-site') {
    return res.status(403).json({ success: false, message: 'غير مصرح' });
  }
  const origin = req.headers['origin'];
  if (origin && origin !== 'null') {
    const host = req.headers.host || '';
    let oHost = null;
    try { oHost = (origin.startsWith('http') || origin.startsWith('https') ? origin.split('://')[1] : origin).split('/')[0].split(':')[0]; } catch (e) { return res.status(403).json({ success: false, message: 'غير مصرح' }); }
    const reqHost = (host || '').split(':')[0];
    if (oHost !== reqHost) return res.status(403).json({ success: false, message: 'غير مصرح' });
  }
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

module.exports = { securityHeaders, sameOriginGuard };