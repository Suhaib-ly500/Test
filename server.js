require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { config, ensureSSLCert } = require('./src/infrastructure/config');
const vendorRepository = require('./src/infrastructure/persistence/repositories/vendorRepository');
const { securityHeaders, sameOriginGuard } = require('./src/presentation/middleware/security');
const { apiLimiter, htmlTokenMiddleware } = require('./src/presentation/middleware/auth');
const registerPublicRoutes = require('./src/presentation/routes/public');
const registerVendorRoutes = require('./src/presentation/routes/vendor');
const registerAdminRoutes = require('./src/presentation/routes/admin');
const { ADMIN_ROLE_NAME } = require('./src/domain/entities');

const app = express();

app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(config.uploadsDir, { dotfiles: 'deny' }));

// Redirect friendly URLs to .html pages
app.get(['/admin', '/vendor', '/setup', '/terms', '/privacy', '/login'], (req, res) => {
  res.redirect(301, req.path + '.html');
});

// Inject per-page CSRF token into HTML pages
app.use(htmlTokenMiddleware);

// Serve static files (non-html), blocking dotfiles and secrets like .env
const staticServe = express.static(config.root, { dotfiles: 'deny' });
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) return next();
  if (req.path.startsWith('/node_modules/') || req.path.startsWith('/dist/') || req.path.startsWith('/js-src/')) {
    return res.status(404).send('Not found');
  }
  if (/\.(env|enc|pem|crt|key|log|bak|sqlite|db)(?:-wal|-shm)?$/i.test(req.path)) {
    return res.status(404).send('Not found');
  }
  staticServe(req, res, next);
});

app.use('/api/', apiLimiter);
app.use(sameOriginGuard);

// ====== Startup: ensure admin account exists ======
const ADMIN_USER = config.adminUsername;
const ADMIN_PASS = config.adminPassword;
if (ADMIN_USER && ADMIN_PASS) {
  if (!vendorRepository.findAdminByRole()) {
    const hashedPwd = bcrypt.hashSync(ADMIN_PASS, 10);
    vendorRepository.create({
      username: ADMIN_USER,
      password: hashedPwd,
      fullname: ADMIN_ROLE_NAME,
      display_name: 'الإدارة',
      status: 'active',
      phone: config.vaultData.ADMIN_PHONE || '',
      email: config.vaultData.ADMIN_EMAIL || '',
      location: config.vaultData.ADMIN_CITY || '',
      photo_path: config.vaultData.ADMIN_PHOTO || ''
    });
    console.log('تم إنشاء حساب المشرف: ' + ADMIN_USER);
  }
} else {
  console.log('لم يتم إعداد حساب المشرف بعد. افتح /setup.html لإنشائه');
}

// ====== Routes ======
registerPublicRoutes(app);
registerVendorRoutes(app);
registerAdminRoutes(app);
registerPublicRoutes.initTransporter();

// ====== JSON / upload error handler (returns JSON instead of leaking stack) ======
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const isApi = req.path.startsWith('/api/');
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err.type === 'request.size.invalid') {
    return isApi ? res.status(400).json({ success: false, message: 'بيانات غير صالحة' }) : res.status(400).send('Bad request');
  }
  if (err instanceof multer.MulterError || (err && /^(نوع الملف|امتداد الملف|المحتوى|حجم الملف)/.test(String(err.message)))) {
    return isApi ? res.status(400).json({ success: false, message: err.message }) : res.status(400).send('Bad request');
  }
  if (isApi) return res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع. حاول مرة أخرى' });
  next(err);
});

// ====== Server startup ======
const sslCreds = ensureSSLCert();
// Optional: force HTTPS (set FORCE_HTTPS=1 in .env)
if (sslCreds && process.env.FORCE_HTTPS === '1') {
  app.use((req, res, next) => {
    if (!req.secure) return res.redirect(301, 'https://' + (req.headers.host || 'localhost') + req.originalUrl);
    next();
  });
}
if (sslCreds) {
  https.createServer(sslCreds, app).listen(config.httpsPort, () => {
    console.log('منصة سهم تعمل عبر HTTPS على: https://localhost:' + config.httpsPort);
  });
}
app.listen(config.port, () => {
  const proto = sslCreds ? 'HTTP (يحول إلى HTTPS)' : 'HTTP';
  console.log('منصة سهم تعمل عبر ' + proto + ' على: http://localhost:' + config.port);
  if (!sslCreds) console.log('HTTPS غير متاح. قم بتثبيت OpenSSL لتفعيل الاتصالات');
});