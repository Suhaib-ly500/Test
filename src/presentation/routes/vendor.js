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

  app.post('/api/vendor/register', upload.single('photo'), async (req, res, next) => {
    try {
      const { username, password, fullname, age, location, email, display_name, phone, social_link } = req.body;
      const err = validate({
        username: { required: true, type: 'string', minLength: 3, maxLength: 50, label: 'اسم المستخدم' },
        password: { required: true, type: 'string', minLength: 8, maxLength: 100, label: 'كلمة المرور' },
        fullname: { type: 'string', maxLength: 100, label: 'الاسم الكامل' },
        email: { type: 'string', maxLength: 200, label: 'البريد الإلكتروني' },
        display_name: { type: 'string', maxLength: 100, label: 'الاسم المعروض' },
        phone: { type: 'string', maxLength: 30, label: 'رقم الهاتف' },
        age: { type: 'number', min: 10, max: 150, label: 'العمر' },
        social_link: { type: 'string', maxLength: 500, label: 'رابط التواصل' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const exist = await vendorRepository.findByUsername(username);
      if (exist) return res.status(400).json({ success: false, message: 'اسم المستخدم موجود مسبقاً' });
      const hashed = bcrypt.hashSync(password, 10);
      const photo = req.file ? '/uploads/' + req.file.filename : null;
      await vendorRepository.create({ username, password: hashed, fullname: fullname || '', display_name: display_name || username, age: age || 0, location: location || '', email: email || '', phone: phone || '', social_link: social_link || '', photo_path: photo, status: 'pending' });
      await contentRepository.logActivity(0, 'تسجيل جديد', 'تم تسجيل حساب جديد: ' + username);
      res.json({ success: true, message: 'تم التسجيل بنجاح. انتظر موافقة الإدارة.' });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/login', loginLimiter, async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const err = validate({ username: { required: true, type: 'string', label: 'اسم المستخدم' }, password: { required: true, type: 'string', label: 'كلمة المرور' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const vendor = await vendorRepository.findByUsername(username);
      if (!vendor) { bcrypt.compareSync(password || '', DUMMY_HASH); return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور خاطئة' }); }
      if (!bcrypt.compareSync(password, vendor.password)) return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور خاطئة' });
      if (vendor.status !== 'active') return res.status(403).json({ success: false, message: 'حسابك غير نشط. انتظر موافقة الإدارة' });
      await authService.cleanupOldForVendor(vendor.id);
      const isAdmin = vendor.fullname === ADMIN_ROLE_NAME ? 1 : 0;
      const token = await authService.issueToken(vendor.id, isAdmin);
      await contentRepository.logActivity(vendor.id, 'تسجيل دخول', 'تم تسجيل الدخول');
      res.json({ success: true, token, vendor: { id: vendor.id, username: vendor.username, fullname: vendor.fullname, display_name: vendor.display_name, is_admin: isAdmin } });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/logout', async (req, res, next) => {
    try {
      const token = req.headers['x-auth-token'] || req.headers['x-vendor-id'];
      await authService.logout(token);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/verify-token', async (req, res, next) => {
    try {
      const token = req.headers['x-auth-token'] || req.headers['x-vendor-id'];
      if (!token || /^\d+$/.test(token)) return res.json({ valid: false });
      const session = await authService.findSession(token);
      if (!session) return res.json({ valid: false });
      const vendor = await vendorRepository.findActiveById(session.vendor_id);
      if (!vendor) return res.json({ valid: false });
      res.json({ valid: true, vendor: { id: vendor.id, username: vendor.username, fullname: vendor.fullname, display_name: vendor.display_name, is_admin: session.is_admin } });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/profile', requireVendor, async (req, res, next) => {
    try {
      const vendor = await vendorRepository.getProfile(req.vendorId);
      if (!vendor) return res.status(404).json({ success: false, message: 'المزود غير موجود' });
      res.json({ success: true, vendor });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/subscriptions', requireVendor, async (req, res, next) => {
    try {
      const subs = await subscriptionRepository.listByVendor(req.vendorId);
      const subsWithExtra = [];
      for (const s of subs) {
        const avgRating = await subscriptionRepository.avgRatingFor(s.id);
        const rate = await commissionService.effectiveRate(req.vendorId, s.id, s.cat_id);
        subsWithExtra.push({ ...s, avg_rating: avgRating && avgRating.avg !== null ? parseFloat(avgRating.avg.toFixed(1)) : 0, effective_commission_rate: rate });
      }
      res.json({ success: true, subscriptions: subsWithExtra });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/subscriptions', requireVendor, upload.single('sub_image'), async (req, res, next) => {
    try {
      const { name, description, price, duration, cat_id } = req.body;
      const err = validate({
        name: { required: true, type: 'string', maxLength: 200, label: 'اسم الاشتراك' },
        price: { required: true, type: 'number', min: 0, max: 999999, label: 'السعر' },
        duration: { type: 'string', maxLength: 100, label: 'المدة' },
        description: { type: 'string', maxLength: 2000, label: 'الوصف' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const image = req.file ? '/uploads/' + req.file.filename : null;
      await subscriptionRepository.create({ vendorId: req.vendorId, catId: cat_id, name, description, price, duration, image });
      await contentRepository.logActivity(req.vendorId, 'إضافة اشتراك', 'أضاف اشتراك "' + name + '"');
      res.json({ success: true, message: 'تم إضافة الاشتراك' });
    } catch (e) { next(e); }
  });

  app.put('/api/vendor/subscriptions/:id', requireVendor, upload.single('sub_image'), async (req, res, next) => {
    try {
      const { name, description, price, duration, cat_id } = req.body;
      const is_active = req.body.is_active !== undefined ? (req.body.is_active === true || req.body.is_active === 'true' || req.body.is_active === 1 || req.body.is_active === '1' ? 1 : 0) : null;
      const err = validate({
        name: { required: true, type: 'string', maxLength: 200, label: 'اسم الاشتراك' },
        price: { required: true, type: 'number', min: 0, max: 999999, label: 'السعر' },
        duration: { type: 'string', maxLength: 100, label: 'المدة' },
        description: { type: 'string', maxLength: 2000, label: 'الوصف' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      let image = req.body.existing_image;
      if (req.file) image = '/uploads/' + req.file.filename;
      const data = { catId: cat_id, name, description, price, duration, image };
      if (is_active !== null) await subscriptionRepository.updateWithActive(req.params.id, req.vendorId, { ...data, isActive: is_active });
      else await subscriptionRepository.update(req.params.id, req.vendorId, data);
      await contentRepository.logActivity(req.vendorId, 'تحديث اشتراك', 'حدث اشتراك "' + name + '"');
      res.json({ success: true, message: 'تم تحديث الاشتراك' });
    } catch (e) { next(e); }
  });

  app.delete('/api/vendor/subscriptions/:id', requireVendor, async (req, res, next) => {
    try {
      await subscriptionRepository.deleteOffersBySub(req.params.id);
      await subscriptionRepository.deleteById(req.params.id, req.vendorId);
      await contentRepository.logActivity(req.vendorId, 'حذف اشتراك', 'حذف اشتراك رقم ' + req.params.id);
      res.json({ success: true, message: 'تم حذف الاشتراك' });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/categories', requireVendor, async (req, res, next) => {
    try {
      const cats = await categoryRepository.listByVendor(req.vendorId);
      const catsWithCommission = [];
      for (const c of cats) {
        const rate = await commissionService.effectiveRate(req.vendorId, null, c.id);
        catsWithCommission.push({ ...c, effective_commission_rate: rate });
      }
      res.json({ success: true, categories: catsWithCommission });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/categories', requireVendor, upload.single('cat_image'), async (req, res, next) => {
    try {
      const { name, description } = req.body;
      const err = validate({ name: { required: true, type: 'string', maxLength: 200, label: 'اسم الصنف' }, description: { type: 'string', maxLength: 2000, label: 'الوصف' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const image = req.file ? '/uploads/' + req.file.filename : null;
      await categoryRepository.create(req.vendorId, name, description, image);
      await contentRepository.logActivity(req.vendorId, 'إضافة صنف', 'أضاف صنف "' + name + '"');
      res.json({ success: true, message: 'تم إضافة الصنف' });
    } catch (e) { next(e); }
  });

  app.put('/api/vendor/categories/:id', requireVendor, upload.single('cat_image'), async (req, res, next) => {
    try {
      const { name, description } = req.body;
      const err = validate({ name: { required: true, type: 'string', maxLength: 200, label: 'اسم الصنف' }, description: { type: 'string', maxLength: 2000, label: 'الوصف' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      let image = req.body.existing_image;
      if (req.file) image = '/uploads/' + req.file.filename;
      await categoryRepository.update(req.params.id, req.vendorId, name, description, image);
      await contentRepository.logActivity(req.vendorId, 'تحديث صنف', 'حدث صنف "' + name + '"');
      res.json({ success: true, message: 'تم تحديث الصنف' });
    } catch (e) { next(e); }
  });

  app.delete('/api/vendor/categories/:id', requireVendor, async (req, res, next) => {
    try {
      const subs = await categoryRepository.listSubIds(req.params.id, req.vendorId);
      await categoryRepository.deleteOffersForSubs(subs);
      await categoryRepository.deleteSubsByCat(req.params.id, req.vendorId);
      await categoryRepository.deleteById(req.params.id, req.vendorId);
      await contentRepository.logActivity(req.vendorId, 'حذف صنف', 'حذف صنف رقم ' + req.params.id);
      res.json({ success: true, message: 'تم حذف الصنف وجميع الاشتراكات التابعة له' });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/categories/batch-delete', requireVendor, async (req, res, next) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'يرجى تحديد الأصناف' });
      for (const id of ids) {
        const subs = await categoryRepository.listSubIds(id, req.vendorId);
        await categoryRepository.deleteOffersForSubs(subs);
        await categoryRepository.deleteSubsByCat(id, req.vendorId);
        await categoryRepository.deleteById(id, req.vendorId);
      }
      await contentRepository.logActivity(req.vendorId, 'حذف مجموعة', 'حذف ' + ids.length + ' صنف مع اشتراكاتها');
      res.json({ success: true, message: 'تم حذف الأصناف المحددة وجميع الاشتراكات التابعة' });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/subscriptions/batch-delete', requireVendor, async (req, res, next) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'يرجى تحديد الاشتراكات' });
      for (const id of ids) {
        await subscriptionRepository.deleteOffersBySub(id);
        await subscriptionRepository.deleteById(id, req.vendorId);
      }
      await contentRepository.logActivity(req.vendorId, 'حذف مجموعة', 'حذف ' + ids.length + ' اشتراك');
      res.json({ success: true, message: 'تم حذف الاشتراكات المحددة' });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/orders', requireVendor, async (req, res, next) => {
    try {
      const orders = await orderRepository.listByVendor(req.vendorId);
      const ordersWithCommission = [];
      for (const o of orders) {
        const sub = await subscriptionRepository.findByNameAndVendor(o.subscription_name, req.vendorId);
        const rate = await commissionService.effectiveRate(req.vendorId, sub ? sub.id : null, sub ? sub.cat_id : null);
        ordersWithCommission.push({ ...o, customer_name: decrypt(o.customer_name), customer_phone: decrypt(o.customer_phone), commission_rate: rate, commission_amount: parseFloat((o.amount * rate / 100).toFixed(2)), vendor_share: parseFloat((o.amount * (100 - rate) / 100).toFixed(2)) });
      }
      res.json({ success: true, orders: ordersWithCommission });
    } catch (e) { next(e); }
  });

  app.patch('/api/vendor/orders/:id/status', requireVendor, async (req, res, next) => {
    try {
      const { status } = req.body;
      const err = validate({ status: { required: true, type: 'string', oneOf: ['completed', 'cancelled'], label: 'الحالة' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const order = await orderRepository.findByIdAndVendor(req.params.id, req.vendorId);
      if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
      if (order.status === 'completed') return res.json({ success: true, message: 'الطلب مكتمل مسبقاً' });
      await orderRepository.updateStatus(req.params.id, req.vendorId, status);
      if (status === 'completed') {
        const orderPhone = decrypt(order.customer_phone);
        await pointsService.completeOrderPoints({ vendorId: req.vendorId, orderId: order.id, amount: order.amount, phone: orderPhone });
        await contentRepository.logActivity(req.vendorId, 'تأكيد طلب', 'تم تأكيد استكمال الطلب رقم ' + req.params.id);
      } else {
        await contentRepository.logActivity(req.vendorId, 'إلغاء طلب', 'تم إلغاء الطلب رقم ' + req.params.id);
      }
      res.json({ success: true, message: 'تم تحديث حالة الطلب' });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/orders/:id/verify', requireVendor, (req, res, next) => {
    verifyUpload.array('screenshots', 5)(req, res, function(err) {
      if (err) return res.status(400).json({ success: false, message: err.message || 'خطأ في رفع الملفات' });
      next();
    });
  }, async (req, res, next) => {
    try {
      const order = await orderRepository.findByIdAndVendor(req.params.id, req.vendorId);
      if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
      if (order.status !== 'pending') return res.status(400).json({ success: false, message: 'يمكن تأكيد الطلبات قيد الانتظار فقط' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'يرجى رفع صور شاشة واتساب' });
      const paths = req.files.map(f => '/uploads/' + f.filename);
      await orderRepository.updateToAwaiting(req.params.id, req.vendorId, paths);
      await contentRepository.logActivity(req.vendorId, 'تأكيد بالصورة', 'تم إرسال طلب رقم ' + req.params.id + ' للإدارة للتحقق');
      res.json({ success: true, message: 'تم إرسال الطلب للإدارة للتحقق' });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/request-delete', requireVendor, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const err = validate({ reason: { required: true, type: 'string', minLength: 5, maxLength: 1000, label: 'سبب الحذف' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await vendorRepository.setDeleteRequested(req.vendorId);
      await vendorRepository.saveDeleteResponse(req.vendorId, reason);
      await contentRepository.logActivity(req.vendorId, 'طلب حذف', 'طلب حذف الحساب بسبب: ' + reason);
      res.json({ success: true, message: 'تم إرسال طلب الحذف. سيتم مراجعته من الإدارة.' });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/activity-log', requireVendor, async (req, res, next) => {
    try {
      const logs = await contentRepository.listVendorLogs(req.vendorId, 50);
      res.json({ success: true, logs });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/delete-response-status', requireVendor, async (req, res, next) => {
    try {
      const delete_requested = await vendorRepository.getDeleteRequested(req.vendorId);
      res.json({ success: true, delete_requested });
    } catch (e) { next(e); }
  });

  app.get('/api/vendor/points', requireVendor, async (req, res, next) => {
    try {
      const vp = await pointsRepository.getVendorPoints(req.vendorId);
      const reductions = await pointsRepository.listActiveReductions(req.vendorId);
      const rate = await commissionService.effectiveRate(req.vendorId, null, null);
      res.json({ success: true, points: vp ? vp.points : 0, reductions, effective_rate: rate, effective_commission_rate: rate });
    } catch (e) { next(e); }
  });

  app.post('/api/vendor/redeem-points', requireVendor, async (req, res, next) => {
    try {
      const { points } = req.body;
      const err = validate({ points: { required: true, type: 'number', min: 1, label: 'النقاط' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const totalReduction = await pointsService.redeemVendorPoints(req.vendorId, points);
      if (totalReduction === null) return res.status(400).json({ success: false, message: 'النقاط غير كافية' });
      res.json({ success: true, message: 'تم استبدال ' + points + ' نقطة لتخفيض العمولة بنسبة ' + totalReduction + '%' });
    } catch (e) { next(e); }
  });

};