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
    } catch (e) { console.log('فشل إعداد البريد الإلكتروني'); }
  }
}

module.exports = (app) => {

  app.get('/api/setup/check', (req, res) => {
    const v = require('../../../vault').load();
    if (v.ADMIN_USERNAME && v.ADMIN_PASSWORD) return res.json({ success: true, setup_done: true });
    res.json({ success: true, setup_done: false });
  });

  app.post('/api/setup/admin', setupLimiter, (req, res, next) => { upload.single('photo')(req, res, async function(err) {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const v = require('../../../vault').load();
      if (v.ADMIN_USERNAME && v.ADMIN_PASSWORD) return res.status(400).json({ success: false, message: 'تم إعداد المشرف مسبقاً' });

      const { username, password, email, phone, city } = req.body;
      const err = validate({
        username: { required: true, type: 'string', minLength: 3, maxLength: 50, label: 'اسم المستخدم' },
        password: { required: true, type: 'string', minLength: 8, maxLength: 100, label: 'كلمة المرور' },
        email: { type: 'string', maxLength: 200, label: 'البريد الإلكتروني' },
        phone: { type: 'string', maxLength: 30, label: 'رقم الهاتف' },
        city: { type: 'string', maxLength: 100, label: 'المدينة' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });

      const exist = await vendorRepository.findByUsername(username);
      if (exist) return res.status(400).json({ success: false, message: 'اسم المستخدم موجود مسبقاً اختر اسماً آخر' });

      const photo = req.file ? '/uploads/' + req.file.filename : null;
      const hashed = bcrypt.hashSync(password, 10);

      await vendorRepository.create({ username, password: hashed, fullname: 'مشرف المنصة', display_name: 'الإدارة', status: 'active', phone: phone || '', email: email || '', location: city || '', photo_path: photo });

      const vdata = require('../../../vault').load();
      vdata.ADMIN_USERNAME = username;
      vdata.ADMIN_PASSWORD = password;
      vdata.ADMIN_EMAIL = email || '';
      vdata.ADMIN_PHONE = phone || '';
      vdata.ADMIN_CITY = city || '';
      if (photo) vdata.ADMIN_PHOTO = photo;
      require('../../../vault').save(vdata);

      await contentRepository.logActivity(0, 'إعداد أولي', 'تم إنشاء حساب المشرف الأول: ' + username);
      console.log('تم إنشاء حساب المشرف');

      res.json({ success: true, message: 'تم إنشاء حساب المشرف بنجاح' });
    } catch (e) { console.error('خطأ داخلي:', e.message); res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع. حاول مرة أخرى' }); }
  }); });

  app.post('/api/support', requirePublicToken, strictPostLimiter, (req, res) => {
    const { name, phone, message } = req.body;
    const err = validate({ name: { required: true, type: 'string', maxLength: 100, label: 'الاسم' }, phone: { required: true, type: 'string', maxLength: 20, label: 'رقم الهاتف' }, message: { required: true, type: 'string', maxLength: 2000, label: 'الرسالة' } }, req.body);
    if (err) return res.json({ success: false, message: err });
    const supportEmail = config.supportEmail;
    if (!transporter) {
      contentRepository.logActivity(0, 'support_message', 'الاسم: ' + name + ' | الهاتف: ' + phone + ' | الرسالة: ' + message).catch(() => {});
      return res.json({ success: true, message: 'تم استلام رسالتك. سنتواصل معك قريباً.' });
    }
    const mailOptions = { from: '"دعم ماتريكس برو" <' + (config.vaultData.EMAIL_USER || 'support@matrixpro.com') + '>', replyTo: phone ? phone + '@sms.local' : undefined, to: supportEmail, subject: 'رسالة دعم فني من ' + name, html: '<h3>رسالة دعم فني جديدة</h3><p><strong>الاسم:</strong> ' + name + '</p><p><strong>رقم الهاتف:</strong> ' + phone + '</p><p><strong>الرسالة:</strong></p><p>' + message + '</p><hr><p style="color:#888;font-size:12px;">هذه الرسالة أُرسلت عبر نموذج الدعم الفني في منصة ماتريكس برو</p>' };
    transporter.sendMail(mailOptions, (errMail) => {
      if (errMail) {
        contentRepository.logActivity(0, 'support_message', 'الاسم: ' + name + ' | الهاتف: ' + phone + ' | الرسالة: ' + message).catch(() => {});
        return res.json({ success: true, message: 'تم استلام رسالتك. سنتواصل معك قريباً.' });
      }
      res.json({ success: true, message: 'تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.' });
    });
  });

  app.get('/api/marketplace/offerings', async (req, res, next) => {
    try {
      const { search, vendor, category } = req.query;
      const subs = await subscriptionRepository.searchOfferings({ search, vendor, category });
      const vendorMap = {};
      for (const s of subs) {
        const avgRating = await subscriptionRepository.avgRatingFor(s.id);
        const feat = await subscriptionRepository.findFeatured(s.id);
        const offer = await subscriptionRepository.findActiveOfferForSub(s.id);
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
      }
      res.json({ success: true, offerings: Object.values(vendorMap) });
    } catch (e) { next(e); }
  });

  app.post('/api/marketplace/view/:subId', requirePublicToken, async (req, res, next) => {
    try {
      const subId = Number(req.params.subId);
      if (!Number.isInteger(subId) || subId <= 0) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      await subscriptionRepository.insertView(subId, ip);
      await subscriptionRepository.incrementViews(subId);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  app.get('/api/featured-subscriptions', async (req, res, next) => {
    try {
      const subs = await subscriptionRepository.listFeaturedActive();
      const subsWithExtra = [];
      for (const s of subs) {
        const avgRating = await subscriptionRepository.avgRatingFor(s.id);
        subsWithExtra.push({ ...s, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0 });
      }
      res.json({ success: true, subscriptions: subsWithExtra });
    } catch (e) { next(e); }
  });

  app.get('/api/customer-points/:phone', async (req, res, next) => {
    try {
      const cp = await pointsRepository.getCustomerPoints(req.params.phone);
      res.json({ success: true, points: cp ? cp.points : 0 });
    } catch (e) { next(e); }
  });

  app.get('/api/customer-offers/active', async (req, res, next) => {
    try {
      const offers = await subscriptionRepository.listOffersActive();
      res.json({ success: true, offers });
    } catch (e) { next(e); }
  });

  app.get('/api/points-settings-public', async (req, res, next) => {
    try {
      const settings = {};
      for (const k of PUBLIC_POINTS_SETTINGS_KEYS) settings[k] = parseFloat(await getSetting(k, '0'));
      res.json({ success: true, settings });
    } catch (e) { next(e); }
  });

  app.get('/api/marketplace/vendors', async (req, res, next) => {
    try {
      const vendors = await vendorRepository.listActivePublic();
      res.json({ success: true, vendors });
    } catch (e) { next(e); }
  });

  app.get('/api/marketplace/categories', async (req, res, next) => {
    try {
      const rows = await subscriptionRepository.listCategoriesWithSubs();
      res.json({ success: true, categories: rows });
    } catch (e) { next(e); }
  });

  app.post('/api/ratings', requirePublicToken, strictPostLimiter, async (req, res, next) => {
    try {
      const { subscription_id, vendor_id, customer_name, rating, review } = req.body;
      const err = validate({
        subscription_id: { required: true, type: 'number', label: 'الاشتراك' },
        rating: { required: true, type: 'number', min: 1, max: 5, label: 'التقييم' },
        customer_name: { type: 'string', maxLength: 100, label: 'اسم الزبون' },
        review: { type: 'string', maxLength: 1000, label: 'المراجعة' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await subscriptionRepository.insertRating({ subscription_id, vendor_id, customer_name, rating, review });
      res.json({ success: true, message: 'شكراً على تقييمك!' });
    } catch (e) { next(e); }
  });

  app.get('/api/ratings/:subscriptionId', async (req, res, next) => {
    try {
      const subId = Number(req.params.subscriptionId);
      if (!Number.isInteger(subId) || subId <= 0) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
      const ratings = await subscriptionRepository.listRatingsFor(subId);
      const avgRating = await subscriptionRepository.avgRatingFor(subId);
      res.json({ success: true, ratings, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0 });
    } catch (e) { next(e); }
  });

  app.post('/api/complaints', requirePublicToken, strictPostLimiter, complaintUpload.single('screenshot'), async (req, res, next) => {
    try {
      const { customer_name, customer_phone, vendor_name, subscription_name, reason } = req.body;
      const err = validate({
        customer_name: { required: true, type: 'string', maxLength: 100, label: 'اسم الزبون' },
        customer_phone: { required: true, type: 'string', maxLength: 30, label: 'رقم الهاتف' },
        vendor_name: { required: true, type: 'string', maxLength: 200, label: 'اسم المزود' },
        subscription_name: { required: true, type: 'string', maxLength: 200, label: 'اسم الاشتراك' },
        reason: { required: true, type: 'string', minLength: 5, maxLength: 2000, label: 'الشكوى' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const screenshot = req.file ? '/uploads/' + req.file.filename : null;
      await contentRepository.createComplaint({ customer_name: encrypt(String(customer_name)), customer_phone: encrypt(String(customer_phone)), vendor_name: encrypt(String(vendor_name)), subscription_name, reason: encrypt(String(reason)), screenshot_path: screenshot });
      res.json({ success: true, message: 'تم تقديم الشكوى بنجاح' });
    } catch (e) { next(e); }
  });

  app.post('/api/orders', requirePublicToken, strictPostLimiter, async (req, res, next) => {
    try {
      const { customer_name, customer_phone, items, discount_amount, points_used } = req.body;
      const err = validate({
        customer_name: { required: true, type: 'string', maxLength: 100, label: 'اسم العميل' },
        customer_phone: { required: true, type: 'string', maxLength: 30, label: 'رقم الهاتف' },
        items: { required: true, type: 'array', minLength: 1, label: 'العناصر' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      for (const item of items) {
        if (!item.vendor_id || !item.subscription_name || item.amount === undefined || item.amount === null) {
          return res.status(400).json({ success: false, message: 'كل عنصر يجب أن يحتوي على vendor_id و subscription_name و amount' });
        }
        const vendorIdNum = Number(item.vendor_id);
        if (isNaN(vendorIdNum)) return res.status(400).json({ success: false, message: 'vendor_id غير صالح' });
        const amountNum = Number(item.amount);
        if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ success: false, message: 'amount غير صالح' });
        const sub = await subscriptionRepository.findActiveByIdAndVendor(item.subscription_id, vendorIdNum);
        if (!sub) {
          const byName = await subscriptionRepository.findActiveByNameAndVendor(item.subscription_name, vendorIdNum);
          if (!byName) return res.status(400).json({ success: false, message: 'الاشتراك "' + item.subscription_name + '" غير متوفر أو موقوف' });
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
      await orderRepository.insertMany(rows);
      for (const item of items) {
        await contentRepository.logActivity(Number(item.vendor_id), 'طلب جديد', 'طلب جديد من "' + customer_name + '" لـ "' + item.subscription_name + '" بقيمة ' + item.amount + ' د.ل');
      }
      let pointsEarned = 0;
      if (customer_phone) pointsEarned = await pointsService.awardCustomerPoints(customer_phone, 0);
      if (points_used && customer_phone) await pointsService.redeemCustomerPoints(customer_phone, points_used);
      const vendorIds = [...new Set(items.map(i => Number(i.vendor_id)))];
      const vendors = await vendorRepository.findManyByIds(vendorIds);
      res.json({ success: true, message: 'تم إرسال طلباتك بنجاح', vendors: vendors, points_earned: pointsEarned });
    } catch (e) { next(e); }
  });

  app.get('/api/pages/:slug', async (req, res, next) => {
    try {
      const page = await contentRepository.getPage(req.params.slug);
      if (!page) return res.json({ success: true, page: null });
      res.json({ success: true, page });
    } catch (e) { next(e); }
  });

  app.get('/api/custom-assets', async (req, res, next) => {
    try {
      const rows = await contentRepository.listAssets();
      const assets = {};
      for (const r of rows) assets[r.key] = r.value;
      res.json({ success: true, assets });
    } catch (e) { next(e); }
  });

};

module.exports.initTransporter = initTransporter;
