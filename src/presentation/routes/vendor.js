const bcrypt = require('bcryptjs');
const { getSetting } = require('../../infrastructure/persistence/db');
const vendorRepository = require('../../infrastructure/persistence/repositories/vendorRepository');
const categoryRepository = require('../../infrastructure/persistence/repositories/categoryRepository');
const subscriptionRepository = require('../../infrastructure/persistence/repositories/subscriptionRepository');
const orderRepository = require('../../infrastructure/persistence/repositories/orderRepository');
const pointsRepository = require('../../infrastructure/persistence/repositories/pointsRepository');
const contentRepository = require('../../infrastructure/persistence/repositories/contentRepository');
const authService = require('../../application/services/authService');
const commissionService = require('../../application/services/commissionService');
const pointsService = require('../../application/services/pointsService');
const { validate } = require('../../application/utils/validate');
const { encrypt, decrypt } = require('../../application/utils/crypto');
const { loginLimiter, requireVendor } = require('../middleware/auth');
const { upload, verifyUpload } = require('../middleware/uploads');
const { ADMIN_ROLE_NAME } = require('../../domain/entities');

// Precomputed dummy hash so username-enumeration timing stays uniform
const DUMMY_HASH = bcrypt.hashSync('dummy-password-timing', 10);

module.exports = (app) => {

  app.post('/api/vendor/register', upload.single('photo'), (req, res) => {
    try {
      const { username, password, fullname, age, location, email, display_name, phone, social_link } = req.body;
      const err = validate({
        username: { required: true, type: 'string', minLength: 3, maxLength: 50, label: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ…' },
        password: { required: true, type: 'string', minLength: 8, maxLength: 100, label: 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±' },
        fullname: { type: 'string', maxLength: 100, label: 'ط§ظ„ط§ط³ظ… ط§ظ„ظƒط§ظ…ظ„' },
        email: { type: 'string', maxLength: 200, label: 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ' },
        display_name: { type: 'string', maxLength: 100, label: 'ط§ظ„ط§ط³ظ… ط§ظ„ظ…ط¹ط±ظˆط¶' },
        phone: { type: 'string', maxLength: 30, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' },
        age: { type: 'number', min: 10, max: 150, label: 'ط§ظ„ط¹ظ…ط±' },
        social_link: { type: 'string', maxLength: 500, label: 'ط±ط§ط¨ط· ط§ظ„طھظˆط§طµظ„' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const exist = vendorRepository.findByUsername(username);
      if (exist) return res.status(400).json({ success: false, message: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ط§ظ‹' });
      const hashed = bcrypt.hashSync(password, 10);
      const photo = req.file ? '/uploads/' + req.file.filename : null;
      vendorRepository.create({ username, password: hashed, fullname: fullname || '', display_name: display_name || username, age: age || 0, location: location || '', email: email || '', phone: phone || '', social_link: social_link || '', photo_path: photo, status: 'pending' });
      contentRepository.logActivity(0, 'طھط³ط¬ظٹظ„ ط¬ط¯ظٹط¯', 'طھظ… طھط³ط¬ظٹظ„ ط­ط³ط§ط¨ ط¬ط¯ظٹط¯: ' + username);
      res.json({ success: true, message: 'طھظ… ط§ظ„طھط³ط¬ظٹظ„ ط¨ظ†ط¬ط§ط­. ط§ظ†طھط¸ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ط¥ط¯ط§ط±ط©.' });
    } catch (e) { console.error('ط®ط·ط£ ط¯ط§ط®ظ„ظٹ:', e.message); res.status(500).json({ success: false, message: 'ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹. ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰' }); }
  });

  app.post('/api/vendor/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    const err = validate({ username: { required: true, type: 'string', label: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ…' }, password: { required: true, type: 'string', label: 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const vendor = vendorRepository.findByUsername(username);
    if (!vendor) { bcrypt.compareSync(password || '', DUMMY_HASH); return res.status(401).json({ success: false, message: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ط£ظˆ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط®ط§ط·ط¦ط©' }); }
    if (!bcrypt.compareSync(password, vendor.password)) return res.status(401).json({ success: false, message: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ط£ظˆ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط®ط§ط·ط¦ط©' });
    if (vendor.status !== 'active') return res.status(403).json({ success: false, message: 'ط­ط³ط§ط¨ظƒ ط؛ظٹط± ظ†ط´ط·. ط§ظ†طھط¸ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ط¥ط¯ط§ط±ط©' });
    authService.cleanupOldForVendor(vendor.id);
    const isAdmin = vendor.fullname === ADMIN_ROLE_NAME ? 1 : 0;
    const token = authService.issueToken(vendor.id, isAdmin);
    contentRepository.logActivity(vendor.id, 'طھط³ط¬ظٹظ„ ط¯ط®ظˆظ„', 'طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„');
    res.json({ success: true, token, vendor: { id: vendor.id, username: vendor.username, fullname: vendor.fullname, display_name: vendor.display_name, is_admin: isAdmin } });
  });

  app.post('/api/vendor/logout', (req, res) => {
    const token = req.headers['x-auth-token'] || req.headers['x-vendor-id'];
    authService.logout(token);
    res.json({ success: true });
  });

  app.get('/api/vendor/verify-token', (req, res) => {
    const token = req.headers['x-auth-token'] || req.headers['x-vendor-id'];
    if (!token || /^\d+$/.test(token)) return res.json({ valid: false });
    const session = authService.findSession(token);
    if (!session) return res.json({ valid: false });
    const vendor = vendorRepository.findActiveById(session.vendor_id);
    if (!vendor) return res.json({ valid: false });
    res.json({ valid: true, vendor: { id: vendor.id, username: vendor.username, fullname: vendor.fullname, display_name: vendor.display_name, is_admin: session.is_admin } });
  });

  app.get('/api/vendor/profile', requireVendor, (req, res) => {
    const vendor = vendorRepository.getProfile(req.vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'ط§ظ„ظ…ط²ظˆط¯ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
    res.json({ success: true, vendor });
  });

  app.get('/api/vendor/subscriptions', requireVendor, (req, res) => {
    const subs = subscriptionRepository.listByVendor(req.vendorId);
    const subsWithExtra = subs.map(s => {
      const avgRating = subscriptionRepository.avgRatingFor(s.id);
      return { ...s, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0, effective_commission_rate: commissionService.effectiveRate(req.vendorId, s.id, s.cat_id) };
    });
    res.json({ success: true, subscriptions: subsWithExtra });
  });

  app.post('/api/vendor/subscriptions', requireVendor, upload.single('sub_image'), (req, res) => {
    const { name, description, price, duration, cat_id } = req.body;
    const err = validate({
      name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„ط§ط´طھط±ط§ظƒ' },
      price: { required: true, type: 'number', min: 0, max: 999999, label: 'ط§ظ„ط³ط¹ط±' },
      duration: { type: 'string', maxLength: 100, label: 'ط§ظ„ظ…ط¯ط©' },
      description: { type: 'string', maxLength: 2000, label: 'ط§ظ„ظˆطµظپ' }
    }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const image = req.file ? '/uploads/' + req.file.filename : null;
    subscriptionRepository.create({ vendorId: req.vendorId, catId: cat_id, name, description, price, duration, image });
    contentRepository.logActivity(req.vendorId, 'ط¥ط¶ط§ظپط© ط§ط´طھط±ط§ظƒ', 'ط£ط¶ط§ظپ ط§ط´طھط±ط§ظƒ "' + name + '"');
    res.json({ success: true, message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط§ط´طھط±ط§ظƒ' });
  });

  app.put('/api/vendor/subscriptions/:id', requireVendor, upload.single('sub_image'), (req, res) => {
    const { name, description, price, duration, cat_id } = req.body;
    const is_active = req.body.is_active !== undefined ? (req.body.is_active === true || req.body.is_active === 'true' || req.body.is_active === 1 || req.body.is_active === '1' ? 1 : 0) : null;
    const err = validate({
      name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„ط§ط´طھط±ط§ظƒ' },
      price: { required: true, type: 'number', min: 0, max: 999999, label: 'ط§ظ„ط³ط¹ط±' },
      duration: { type: 'string', maxLength: 100, label: 'ط§ظ„ظ…ط¯ط©' },
      description: { type: 'string', maxLength: 2000, label: 'ط§ظ„ظˆطµظپ' }
    }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    let image = req.body.existing_image;
    if (req.file) image = '/uploads/' + req.file.filename;
    const data = { catId: cat_id, name, description, price, duration, image };
    if (is_active !== null) subscriptionRepository.updateWithActive(req.params.id, req.vendorId, { ...data, isActive: is_active });
    else subscriptionRepository.update(req.params.id, req.vendorId, data);
    contentRepository.logActivity(req.vendorId, 'طھط­ط¯ظٹط« ط§ط´طھط±ط§ظƒ', 'ط­ط¯ط« ط§ط´طھط±ط§ظƒ "' + name + '"');
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ط§ط´طھط±ط§ظƒ' });
  });

  app.delete('/api/vendor/subscriptions/:id', requireVendor, (req, res) => {
    subscriptionRepository.deleteOffersBySub(req.params.id);
    subscriptionRepository.deleteById(req.params.id, req.vendorId);
    contentRepository.logActivity(req.vendorId, 'ط­ط°ظپ ط§ط´طھط±ط§ظƒ', 'ط­ط°ظپ ط§ط´طھط±ط§ظƒ ط±ظ‚ظ… ' + req.params.id);
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط§ط´طھط±ط§ظƒ' });
  });

  app.get('/api/vendor/categories', requireVendor, (req, res) => {
    const cats = categoryRepository.listByVendor(req.vendorId);
    const catsWithCommission = cats.map(c => {
      const rate = commissionService.effectiveRate(req.vendorId, null, c.id);
      return { ...c, effective_commission_rate: rate };
    });
    res.json({ success: true, categories: catsWithCommission });
  });

  app.post('/api/vendor/categories', requireVendor, upload.single('cat_image'), (req, res) => {
    const { name, description } = req.body;
    const err = validate({ name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„طµظ†ظپ' }, description: { type: 'string', maxLength: 2000, label: 'ط§ظ„ظˆطµظپ' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const image = req.file ? '/uploads/' + req.file.filename : null;
    categoryRepository.create(req.vendorId, name, description, image);
    contentRepository.logActivity(req.vendorId, 'ط¥ط¶ط§ظپط© طµظ†ظپ', 'ط£ط¶ط§ظپ طµظ†ظپ "' + name + '"');
    res.json({ success: true, message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„طµظ†ظپ' });
  });

  app.put('/api/vendor/categories/:id', requireVendor, upload.single('cat_image'), (req, res) => {
    const { name, description } = req.body;
    const err = validate({ name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„طµظ†ظپ' }, description: { type: 'string', maxLength: 2000, label: 'ط§ظ„ظˆطµظپ' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    let image = req.body.existing_image;
    if (req.file) image = '/uploads/' + req.file.filename;
    categoryRepository.update(req.params.id, req.vendorId, name, description, image);
    contentRepository.logActivity(req.vendorId, 'طھط­ط¯ظٹط« طµظ†ظپ', 'ط­ط¯ط« طµظ†ظپ "' + name + '"');
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„طµظ†ظپ' });
  });

  app.delete('/api/vendor/categories/:id', requireVendor, (req, res) => {
    const subs = categoryRepository.listSubIds(req.params.id, req.vendorId);
    categoryRepository.deleteOffersForSubs(subs);
    categoryRepository.deleteSubsByCat(req.params.id, req.vendorId);
    categoryRepository.deleteById(req.params.id, req.vendorId);
    contentRepository.logActivity(req.vendorId, 'ط­ط°ظپ طµظ†ظپ', 'ط­ط°ظپ طµظ†ظپ ط±ظ‚ظ… ' + req.params.id);
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„طµظ†ظپ ظˆط¬ظ…ظٹط¹ ط§ظ„ط§ط´طھط±ط§ظƒط§طھ ط§ظ„طھط§ط¨ط¹ط© ظ„ظ‡' });
  });

  app.post('/api/vendor/categories/batch-delete', requireVendor, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'ظٹط±ط¬ظ‰ طھط­ط¯ظٹط¯ ط§ظ„ط£طµظ†ط§ظپ' });
    for (const id of ids) {
      const subs = categoryRepository.listSubIds(id, req.vendorId);
      categoryRepository.deleteOffersForSubs(subs);
      categoryRepository.deleteSubsByCat(id, req.vendorId);
      categoryRepository.deleteById(id, req.vendorId);
    }
    contentRepository.logActivity(req.vendorId, 'ط­ط°ظپ ظ…ط¬ظ…ظˆط¹ط©', 'ط­ط°ظپ ' + ids.length + ' طµظ†ظپ ظ…ط¹ ط§ط´طھط±ط§ظƒط§طھظ‡ط§');
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط£طµظ†ط§ظپ ط§ظ„ظ…ط­ط¯ط¯ط© ظˆط¬ظ…ظٹط¹ ط§ظ„ط§ط´طھط±ط§ظƒط§طھ ط§ظ„طھط§ط¨ط¹ط©' });
  });

  app.post('/api/vendor/subscriptions/batch-delete', requireVendor, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'ظٹط±ط¬ظ‰ طھط­ط¯ظٹط¯ ط§ظ„ط§ط´طھط±ط§ظƒط§طھ' });
    for (const id of ids) {
      subscriptionRepository.deleteOffersBySub(id);
      subscriptionRepository.deleteById(id, req.vendorId);
    }
    contentRepository.logActivity(req.vendorId, 'ط­ط°ظپ ظ…ط¬ظ…ظˆط¹ط©', 'ط­ط°ظپ ' + ids.length + ' ط§ط´طھط±ط§ظƒ');
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط§ط´طھط±ط§ظƒط§طھ ط§ظ„ظ…ط­ط¯ط¯ط©' });
  });

  app.get('/api/vendor/orders', requireVendor, (req, res) => {
    const orders = orderRepository.listByVendor(req.vendorId);
    const ordersWithCommission = orders.map(o => {
      const sub = subscriptionRepository.findByNameAndVendor(o.subscription_name, req.vendorId);
      const rate = commissionService.effectiveRate(req.vendorId, sub ? sub.id : null, sub ? sub.cat_id : null);
      return { ...o, customer_name: decrypt(o.customer_name), customer_phone: decrypt(o.customer_phone), commission_rate: rate, commission_amount: parseFloat((o.amount * rate / 100).toFixed(2)), vendor_share: parseFloat((o.amount * (100 - rate) / 100).toFixed(2)) };
    });
    res.json({ success: true, orders: ordersWithCommission });
  });

  app.patch('/api/vendor/orders/:id/status', requireVendor, (req, res) => {
    const { status } = req.body;
    const err = validate({ status: { required: true, type: 'string', oneOf: ['completed', 'cancelled'], label: 'ط§ظ„ط­ط§ظ„ط©' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const order = orderRepository.findByIdAndVendor(req.params.id, req.vendorId);
    if (!order) return res.status(404).json({ success: false, message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
    if (order.status === 'completed') return res.json({ success: true, message: 'ط§ظ„ط·ظ„ط¨ ظ…ظƒطھظ…ظ„ ظ…ط³ط¨ظ‚ط§ظ‹' });
    orderRepository.updateStatus(req.params.id, req.vendorId, status);
    if (status === 'completed') {
      const orderPhone = decrypt(order.customer_phone);
      pointsService.completeOrderPoints({ vendorId: req.vendorId, orderId: order.id, amount: order.amount, phone: orderPhone });
      contentRepository.logActivity(req.vendorId, 'طھط£ظƒظٹط¯ ط·ظ„ط¨', 'طھظ… طھط£ظƒظٹط¯ ط§ط³طھظƒظ…ط§ظ„ ط§ظ„ط·ظ„ط¨ ط±ظ‚ظ… ' + req.params.id);
    } else {
      contentRepository.logActivity(req.vendorId, 'ط¥ظ„ط؛ط§ط، ط·ظ„ط¨', 'طھظ… ط¥ظ„ط؛ط§ط، ط§ظ„ط·ظ„ط¨ ط±ظ‚ظ… ' + req.params.id);
    }
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط·ظ„ط¨' });
  });

  app.post('/api/vendor/orders/:id/verify', requireVendor, (req, res, next) => {
    verifyUpload.array('screenshots', 5)(req, res, function(err) {
      if (err) return res.status(400).json({ success: false, message: err.message || 'ط®ط·ط£ ظپظٹ ط±ظپط¹ ط§ظ„ظ…ظ„ظپط§طھ' });
      next();
    });
  }, (req, res) => {
    const order = orderRepository.findByIdAndVendor(req.params.id, req.vendorId);
    if (!order) return res.status(404).json({ success: false, message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
    if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'ظٹظ…ظƒظ† طھط£ظƒظٹط¯ ط§ظ„ط·ظ„ط¨ط§طھ ظ‚ظٹط¯ ط§ظ„ط§ظ†طھط¸ط§ط± ظپظ‚ط·' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'ظٹط±ط¬ظ‰ ط±ظپط¹ طµظˆط± ط´ط§ط´ط© ظˆط§طھط³ط§ط¨' });
    const paths = req.files.map(f => '/uploads/' + f.filename);
    orderRepository.updateToAwaiting(req.params.id, req.vendorId, paths);
    contentRepository.logActivity(req.vendorId, 'طھط£ظƒظٹط¯ ط¨ط§ظ„طµظˆط±ط©', 'طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط±ظ‚ظ… ' + req.params.id + ' ظ„ظ„ط¥ط¯ط§ط±ط© ظ„ظ„طھط­ظ‚ظ‚');
    res.json({ success: true, message: 'طھظ… ط¥ط±ط³ط§ظ„ ط§ظ„ط·ظ„ط¨ ظ„ظ„ط¥ط¯ط§ط±ط© ظ„ظ„طھط­ظ‚ظ‚' });
  });

  app.post('/api/vendor/request-delete', requireVendor, (req, res) => {
    const { reason } = req.body;
    const err = validate({ reason: { required: true, type: 'string', minLength: 5, maxLength: 1000, label: 'ط³ط¨ط¨ ط§ظ„ط­ط°ظپ' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    vendorRepository.setDeleteRequested(req.vendorId);
    vendorRepository.saveDeleteResponse(req.vendorId, reason);
    contentRepository.logActivity(req.vendorId, 'ط·ظ„ط¨ ط­ط°ظپ', 'ط·ظ„ط¨ ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨ ط¨ط³ط¨ط¨: ' + reason);
    res.json({ success: true, message: 'طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط­ط°ظپ. ط³ظٹطھظ… ظ…ط±ط§ط¬ط¹طھظ‡ ظ…ظ† ط§ظ„ط¥ط¯ط§ط±ط©.' });
  });

  app.get('/api/vendor/activity-log', requireVendor, (req, res) => {
    const logs = contentRepository.listVendorLogs(req.vendorId, 50);
    res.json({ success: true, logs });
  });

  app.get('/api/vendor/delete-response-status', requireVendor, (req, res) => {
    const delete_requested = vendorRepository.getDeleteRequested(req.vendorId);
    res.json({ success: true, delete_requested });
  });

  app.get('/api/vendor/points', requireVendor, (req, res) => {
    const vp = pointsRepository.getVendorPoints(req.vendorId);
    const reductions = pointsRepository.listActiveReductions(req.vendorId);
    const rate = commissionService.effectiveRate(req.vendorId, null, null);
    res.json({ success: true, points: vp ? vp.points : 0, reductions, effective_rate: rate, effective_commission_rate: rate });
  });

  app.post('/api/vendor/redeem-points', requireVendor, (req, res) => {
    const { points } = req.body;
    const err = validate({ points: { required: true, type: 'number', min: 1, label: 'ط§ظ„ظ†ظ‚ط§ط·' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const totalReduction = pointsService.redeemVendorPoints(req.vendorId, points);
    if (totalReduction === null) return res.status(400).json({ success: false, message: 'ط§ظ„ظ†ظ‚ط§ط· ط؛ظٹط± ظƒط§ظپظٹط©' });
    res.json({ success: true, message: 'طھظ… ط§ط³طھط¨ط¯ط§ظ„ ' + points + ' ظ†ظ‚ط·ط© ظ„طھط®ظپظٹط¶ ط§ظ„ط¹ظ…ظˆظ„ط© ط¨ظ†ط³ط¨ط© ' + totalReduction + '%' });
  });

};