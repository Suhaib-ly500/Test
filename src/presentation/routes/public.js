const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { config } = require('../../infrastructure/config');
const { getSetting } = require('../../infrastructure/persistence/db');
const vendorRepository = require('../../infrastructure/persistence/repositories/vendorRepository');
const subscriptionRepository = require('../../infrastructure/persistence/repositories/subscriptionRepository');
const categoryRepository = require('../../infrastructure/persistence/repositories/categoryRepository');
const orderRepository = require('../../infrastructure/persistence/repositories/orderRepository');
const pointsRepository = require('../../infrastructure/persistence/repositories/pointsRepository');
const contentRepository = require('../../infrastructure/persistence/repositories/contentRepository');
const pointsService = require('../../application/services/pointsService');
const { validate } = require('../../application/utils/validate');
const { encrypt } = require('../../application/utils/crypto');
const { requirePublicToken, setupLimiter, strictPostLimiter } = require('../middleware/auth');
const { upload, complaintUpload } = require('../middleware/uploads');
const { PUBLIC_POINTS_SETTINGS_KEYS } = require('../../domain/entities');

let transporter = null;
function initTransporter() {
  const emailUser = config.vaultData.EMAIL_USER || process.env.EMAIL_USER || '';
  const emailPass = config.vaultData.EMAIL_PASS || process.env.EMAIL_PASS || '';
  if (emailUser && emailUser !== 'your-email@gmail.com') {
    try {
      transporter = nodemailer.createTransport({
        host: config.vaultData.EMAIL_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(config.vaultData.EMAIL_PORT || process.env.EMAIL_PORT || '587'),
        secure: (config.vaultData.EMAIL_SECURE || process.env.EMAIL_SECURE) === 'true',
        auth: { user: emailUser, pass: emailPass }
      });
    } catch (e) { console.log('ظپط´ظ„ ط¥ط¹ط¯ط§ط¯ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ'); }
  }
}

module.exports = (app) => {

  app.get('/api/setup/check', (req, res) => {
    const v = require('../../vault').load();
    if (v.ADMIN_USERNAME && v.ADMIN_PASSWORD) return res.json({ success: true, setup_done: true });
    res.json({ success: true, setup_done: false });
  });

  app.post('/api/setup/admin', setupLimiter, (req, res, next) => { upload.single('photo')(req, res, function(err) {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const v = require('../../vault').load();
      if (v.ADMIN_USERNAME && v.ADMIN_PASSWORD) return res.status(400).json({ success: false, message: 'طھظ… ط¥ط¹ط¯ط§ط¯ ط§ظ„ظ…ط´ط±ظپ ظ…ط³ط¨ظ‚ط§ظ‹' });

      const { username, password, email, phone, city } = req.body;
      const err = validate({
        username: { required: true, type: 'string', minLength: 3, maxLength: 50, label: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ…' },
        password: { required: true, type: 'string', minLength: 8, maxLength: 100, label: 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±' },
        email: { type: 'string', maxLength: 200, label: 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ' },
        phone: { type: 'string', maxLength: 30, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' },
        city: { type: 'string', maxLength: 100, label: 'ط§ظ„ظ…ط¯ظٹظ†ط©' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });

      const exist = vendorRepository.findByUsername(username);
      if (exist) return res.status(400).json({ success: false, message: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ط§ظ‹ ط§ط®طھط± ط§ط³ظ…ط§ظ‹ ط¢ط®ط±' });

      const photo = req.file ? '/uploads/' + req.file.filename : null;
      const hashed = bcrypt.hashSync(password, 10);

      vendorRepository.create({ username, password: hashed, fullname: 'ظ…ط´ط±ظپ ط§ظ„ظ…ظ†طµط©', display_name: 'ط§ظ„ط¥ط¯ط§ط±ط©', status: 'active', phone: phone || '', email: email || '', location: city || '', photo_path: photo });

      const vdata = require('../../vault').load();
      vdata.ADMIN_USERNAME = username;
      vdata.ADMIN_PASSWORD = password;
      vdata.ADMIN_EMAIL = email || '';
      vdata.ADMIN_PHONE = phone || '';
      vdata.ADMIN_CITY = city || '';
      if (photo) vdata.ADMIN_PHOTO = photo;
      require('../../vault').save(vdata);

      contentRepository.logActivity(0, 'ط¥ط¹ط¯ط§ط¯ ط£ظˆظ„ظٹ', 'طھظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط§ظ„ظ…ط´ط±ظپ ط§ظ„ط£ظˆظ„: ' + username);
      console.log('طھظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط§ظ„ظ…ط´ط±ظپ');

      res.json({ success: true, message: 'طھظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط§ظ„ظ…ط´ط±ظپ ط¨ظ†ط¬ط§ط­' });
    } catch (e) { console.error('ط®ط·ط£ ط¯ط§ط®ظ„ظٹ:', e.message); res.status(500).json({ success: false, message: 'ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹. ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰' }); }
  }); });

  app.post('/api/support', requirePublicToken, strictPostLimiter, (req, res) => {
    const { name, phone, message } = req.body;
    const err = validate({ name: { required: true, type: 'string', maxLength: 100, label: 'ط§ظ„ط§ط³ظ…' }, phone: { required: true, type: 'string', maxLength: 20, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' }, message: { required: true, type: 'string', maxLength: 2000, label: 'ط§ظ„ط±ط³ط§ظ„ط©' } }, req.body);
    if (err) return res.json({ success: false, message: err });
    const supportEmail = config.supportEmail;
    if (!transporter) {
      contentRepository.logActivity(0, 'support_message', 'ط§ظ„ط§ط³ظ…: ' + name + ' | ط§ظ„ظ‡ط§طھظپ: ' + phone + ' | ط§ظ„ط±ط³ط§ظ„ط©: ' + message);
      return res.json({ success: true, message: 'طھظ… ط§ط³طھظ„ط§ظ… ط±ط³ط§ظ„طھظƒ. ط³ظ†طھظˆط§طµظ„ ظ…ط¹ظƒ ظ‚ط±ظٹط¨ط§ظ‹.' });
    }
    const mailOptions = { from: '"ط¯ط¹ظ… ظ…ط§طھط±ظٹظƒط³ ط¨ط±ظˆ" <' + (config.vaultData.EMAIL_USER || 'support@matrixpro.com') + '>', replyTo: phone ? phone + '@sms.local' : undefined, to: supportEmail, subject: 'ط±ط³ط§ظ„ط© ط¯ط¹ظ… ظپظ†ظٹ ظ…ظ† ' + name, html: '<h3>ط±ط³ط§ظ„ط© ط¯ط¹ظ… ظپظ†ظٹ ط¬ط¯ظٹط¯ط©</h3><p><strong>ط§ظ„ط§ط³ظ…:</strong> ' + name + '</p><p><strong>ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ:</strong> ' + phone + '</p><p><strong>ط§ظ„ط±ط³ط§ظ„ط©:</strong></p><p>' + message + '</p><hr><p style="color:#888;font-size:12px;">ظ‡ط°ظ‡ ط§ظ„ط±ط³ط§ظ„ط© ط£ظڈط±ط³ظ„طھ ط¹ط¨ط± ظ†ظ…ظˆط°ط¬ ط§ظ„ط¯ط¹ظ… ط§ظ„ظپظ†ظٹ ظپظٹ ظ…ظ†طµط© ظ…ط§طھط±ظٹظƒط³ ط¨ط±ظˆ</p>' };
    transporter.sendMail(mailOptions, (errMail) => {
      if (errMail) {
        contentRepository.logActivity(0, 'support_message', 'ط§ظ„ط§ط³ظ…: ' + name + ' | ط§ظ„ظ‡ط§طھظپ: ' + phone + ' | ط§ظ„ط±ط³ط§ظ„ط©: ' + message);
        return res.json({ success: true, message: 'طھظ… ط§ط³طھظ„ط§ظ… ط±ط³ط§ظ„طھظƒ. ط³ظ†طھظˆط§طµظ„ ظ…ط¹ظƒ ظ‚ط±ظٹط¨ط§ظ‹.' });
      }
      res.json({ success: true, message: 'طھظ… ط¥ط±ط³ط§ظ„ ط±ط³ط§ظ„طھظƒ ط¨ظ†ط¬ط§ط­. ط³ظ†طھظˆط§طµظ„ ظ…ط¹ظƒ ظ‚ط±ظٹط¨ط§ظ‹.' });
    });
  });

  app.get('/api/marketplace/offerings', (req, res) => {
    const { search, vendor, category } = req.query;
    const subs = subscriptionRepository.searchOfferings({ search, vendor, category });
    const vendorMap = {};
    subs.forEach(s => {
      const avgRating = subscriptionRepository.avgRatingFor(s.id);
      const feat = subscriptionRepository.findFeatured(s.id);
      const offer = subscriptionRepository.findActiveOfferForSub(s.id);
      const sub = { id: s.id, name: s.name, description: s.description, price: s.price, duration: s.duration, image_path: s.image_path, is_active: s.is_active, is_paused: s.is_active === 0, views: s.views, created_at: s.created_at, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0, featured: !!feat, featured_price: feat ? feat.special_price : null, is_featured: !!feat, offer: offer ? offer.discount_percent : null };
      const vId = s.vendor_id;
      if (!vendorMap[vId]) vendorMap[vId] = { vendor: { id: vId, display_name: s.vendor_name, phone: s.vendor_phone, photo: s.vendor_photo }, categories: [], uncategorized: [] };
      if (s.cat_id) {
        let cat = vendorMap[vId].categories.find(c => c.id === s.cat_id);
        if (!cat) { cat = { id: s.cat_id, name: s.cat_name, description: s.cat_description, image_path: s.cat_image, subscriptions: [] }; vendorMap[vId].categories.push(cat); }
        cat.subscriptions.push(sub);
      } else {
        vendorMap[vId].uncategorized.push(sub);
      }
    });
    res.json({ success: true, offerings: Object.values(vendorMap) });
  });

  app.post('/api/marketplace/view/:subId', requirePublicToken, (req, res) => {
    const subId = Number(req.params.subId);
    if (!Number.isInteger(subId) || subId <= 0) return res.status(400).json({ success: false, message: 'ظ…ط¹ط±ظپ ط؛ظٹط± طµط§ظ„ط­' });
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    subscriptionRepository.insertView(subId, ip);
    subscriptionRepository.incrementViews(subId);
    res.json({ success: true });
  });

  app.get('/api/featured-subscriptions', (req, res) => {
    const subs = subscriptionRepository.listFeaturedActive();
    const subsWithExtra = subs.map(s => {
      const avgRating = subscriptionRepository.avgRatingFor(s.id);
      return { ...s, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0 };
    });
    res.json({ success: true, subscriptions: subsWithExtra });
  });

  app.get('/api/customer-points/:phone', (req, res) => {
    const cp = pointsRepository.getCustomerPoints(req.params.phone);
    res.json({ success: true, points: cp ? cp.points : 0 });
  });

  app.get('/api/customer-offers/active', (req, res) => {
    const offers = subscriptionRepository.listOffersActive();
    res.json({ success: true, offers });
  });

  app.get('/api/points-settings-public', (req, res) => {
    const settings = {};
    for (const k of PUBLIC_POINTS_SETTINGS_KEYS) settings[k] = parseFloat(getSetting(k, '0'));
    res.json({ success: true, settings });
  });

  app.get('/api/marketplace/vendors', (req, res) => {
    const vendors = vendorRepository.listActivePublic();
    res.json({ success: true, vendors });
  });

  app.get('/api/marketplace/categories', (req, res) => {
    const rows = subscriptionRepository.listCategoriesWithSubs();
    res.json({ success: true, categories: rows });
  });

  app.post('/api/ratings', requirePublicToken, strictPostLimiter, (req, res) => {
    const { subscription_id, vendor_id, customer_name, rating, review } = req.body;
    const err = validate({
      subscription_id: { required: true, type: 'number', label: 'ط§ظ„ط§ط´طھط±ط§ظƒ' },
      rating: { required: true, type: 'number', min: 1, max: 5, label: 'ط§ظ„طھظ‚ظٹظٹظ…' },
      customer_name: { type: 'string', maxLength: 100, label: 'ط§ط³ظ… ط§ظ„ط²ط¨ظˆظ†' },
      review: { type: 'string', maxLength: 1000, label: 'ط§ظ„ظ…ط±ط§ط¬ط¹ط©' }
    }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    subscriptionRepository.insertRating({ subscription_id, vendor_id, customer_name, rating, review });
    res.json({ success: true, message: 'ط´ظƒط±ط§ظ‹ ط¹ظ„ظ‰ طھظ‚ظٹظٹظ…ظƒ!' });
  });

  app.get('/api/ratings/:subscriptionId', (req, res) => {
    const subId = Number(req.params.subscriptionId);
    if (!Number.isInteger(subId) || subId <= 0) return res.status(400).json({ success: false, message: 'ظ…ط¹ط±ظپ ط؛ظٹط± طµط§ظ„ط­' });
    const ratings = subscriptionRepository.listRatingsFor(subId);
    const avgRating = subscriptionRepository.avgRatingFor(subId);
    res.json({ success: true, ratings, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0 });
  });

  app.post('/api/complaints', requirePublicToken, strictPostLimiter, complaintUpload.single('screenshot'), (req, res) => {
    const { customer_name, customer_phone, vendor_name, subscription_name, reason } = req.body;
    const err = validate({
      customer_name: { required: true, type: 'string', maxLength: 100, label: 'ط§ط³ظ… ط§ظ„ط²ط¨ظˆظ†' },
      customer_phone: { required: true, type: 'string', maxLength: 30, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' },
      vendor_name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„ظ…ط²ظˆط¯' },
      subscription_name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„ط§ط´طھط±ط§ظƒ' },
      reason: { required: true, type: 'string', minLength: 5, maxLength: 2000, label: 'ط§ظ„ط´ظƒظˆظ‰' }
    }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const screenshot = req.file ? '/uploads/' + req.file.filename : null;
    contentRepository.createComplaint({ customer_name: encrypt(String(customer_name)), customer_phone: encrypt(String(customer_phone)), vendor_name: encrypt(String(vendor_name)), subscription_name, reason: encrypt(String(reason)), screenshot_path: screenshot });
    res.json({ success: true, message: 'طھظ… طھظ‚ط¯ظٹظ… ط§ظ„ط´ظƒظˆظ‰ ط¨ظ†ط¬ط§ط­' });
  });

  app.post('/api/orders', requirePublicToken, strictPostLimiter, (req, res) => {
    const { customer_name, customer_phone, items, discount_amount, points_used } = req.body;
    const err = validate({
      customer_name: { required: true, type: 'string', maxLength: 100, label: 'ط§ط³ظ… ط§ظ„ط¹ظ…ظٹظ„' },
      customer_phone: { required: true, type: 'string', maxLength: 30, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' },
      items: { required: true, type: 'array', minLength: 1, label: 'ط§ظ„ط¹ظ†ط§طµط±' }
    }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    for (const item of items) {
      if (!item.vendor_id || !item.subscription_name || item.amount === undefined || item.amount === null) {
        return res.status(400).json({ success: false, message: 'ظƒظ„ ط¹ظ†طµط± ظٹط¬ط¨ ط£ظ† ظٹط­طھظˆظٹ ط¹ظ„ظ‰ vendor_id ظˆ subscription_name ظˆ amount' });
      }
      const vendorIdNum = Number(item.vendor_id);
      if (isNaN(vendorIdNum)) return res.status(400).json({ success: false, message: 'vendor_id ط؛ظٹط± طµط§ظ„ط­' });
      const amountNum = Number(item.amount);
      if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ success: false, message: 'amount ط؛ظٹط± طµط§ظ„ط­' });
      const sub = subscriptionRepository.findActiveByIdAndVendor(item.subscription_id, vendorIdNum);
      if (!sub) {
        const byName = subscriptionRepository.findActiveByNameAndVendor(item.subscription_name, vendorIdNum);
        if (!byName) return res.status(400).json({ success: false, message: 'ط§ظ„ط§ط´طھط±ط§ظƒ "' + item.subscription_name + '" ط؛ظٹط± ظ…طھظˆظپط± ط£ظˆ ظ…ظˆظ‚ظˆظپ' });
      }
    }
    const encName = encrypt(String(customer_name));
    const encPhone = encrypt(String(customer_phone));
    const rows = items.map((item, idx) => ({
      customer_name: encName,
      customer_phone: encPhone,
      vendor_id: Number(item.vendor_id),
      subscription_name: item.subscription_name,
      amount: Number(item.amount),
      discountPerItem: discount_amount && items.length ? (discount_amount / items.length) : 0,
      pointsUsed: (idx === 0) ? (points_used || 0) : 0
    }));
    orderRepository.insertMany(rows);
    for (const item of items) {
      contentRepository.logActivity(Number(item.vendor_id), 'ط·ظ„ط¨ ط¬ط¯ظٹط¯', 'ط·ظ„ط¨ ط¬ط¯ظٹط¯ ظ…ظ† "' + customer_name + '" ظ„ظ€ "' + item.subscription_name + '" ط¨ظ‚ظٹظ…ط© ' + item.amount + ' ط¯.ظ„');
    }
    let pointsEarned = 0;
    if (customer_phone) pointsEarned = pointsService.awardCustomerPoints(customer_phone, 0);
    if (points_used && customer_phone) pointsService.redeemCustomerPoints(customer_phone, points_used);
    const vendorIds = [...new Set(items.map(i => Number(i.vendor_id)))];
    const vendors = vendorRepository.findManyByIds(vendorIds);
    res.json({ success: true, message: 'طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ط§طھظƒ ط¨ظ†ط¬ط§ط­', vendors: vendors, points_earned: pointsEarned });
  });

  app.get('/api/pages/:slug', (req, res) => {
    const page = contentRepository.getPage(req.params.slug);
    if (!page) return res.json({ success: true, page: null });
    res.json({ success: true, page });
  });

  app.get('/api/custom-assets', (req, res) => {
    const rows = contentRepository.listAssets();
    const assets = {};
    for (const r of rows) assets[r.key] = r.value;
    res.json({ success: true, assets });
  });

};

module.exports.initTransporter = initTransporter;