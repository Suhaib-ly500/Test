const bcrypt = require('bcryptjs');
const { getSetting, setSetting, qOne } = require('../../infrastructure/persistence/db');
const vendorRepository = require('../../infrastructure/persistence/repositories/vendorRepository');
const categoryRepository = require('../../infrastructure/persistence/repositories/categoryRepository');
const subscriptionRepository = require('../../infrastructure/persistence/repositories/subscriptionRepository');
const orderRepository = require('../../infrastructure/persistence/repositories/orderRepository');
const pointsRepository = require('../../infrastructure/persistence/repositories/pointsRepository');
const contentRepository = require('../../infrastructure/persistence/repositories/contentRepository');
const tokenRepository = require('../../infrastructure/persistence/repositories/tokenRepository');
const commissionService = require('../../application/services/commissionService');
const pointsService = require('../../application/services/pointsService');
const { validate } = require('../../application/utils/validate');
const { encrypt, decrypt } = require('../../application/utils/crypto');
const { requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/uploads');
const { ADMIN_ROLE_NAME, VENDOR_STATUSES, COMPLAINT_STATUSES, CUSTOM_ASSET_KEYS, POINTS_SETTINGS_KEYS } = require('../../domain/entities');

module.exports = (app) => {

  app.post('/api/admin/orders', requireAdmin, async (req, res, next) => {
    try {
      const { customer_name, customer_phone, customer_email, vendor_id, subscription_name, amount, status } = req.body;
      const err = validate({
        customer_name: { required: true, type: 'string', maxLength: 100, label: 'اسم الزبون' },
        customer_phone: { type: 'string', maxLength: 30, label: 'رقم الهاتف' },
        subscription_name: { required: true, type: 'string', maxLength: 200, label: 'اسم الاشتراك' },
        amount: { required: true, type: 'number', min: 0, max: 999999, label: 'المبلغ' },
        status: { type: 'string', oneOf: ['pending', 'completed', 'cancelled'], label: 'الحالة' }
      }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await orderRepository.insert({
        customer_name: encrypt(String(customer_name)),
        customer_phone: encrypt(String(customer_phone)),
        customer_email,
        vendor_id,
        subscription_name,
        amount,
        status
      });
      res.json({ success: true, message: 'تم إضافة الطلب' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/create-admin', requireAdmin, upload.single('photo'), async (req, res, next) => {
    try {
      const { username, password, phone, email, city } = req.body;
      const err = validate({ username: { required: true, type: 'string', minLength: 3, maxLength: 50, label: 'اسم المستخدم' }, password: { required: true, type: 'string', minLength: 8, maxLength: 100, label: 'كلمة المرور' }, phone: { type: 'string', maxLength: 30, label: 'رقم الهاتف' }, email: { type: 'string', maxLength: 200, label: 'البريد الإلكتروني' }, city: { type: 'string', maxLength: 100, label: 'المدينة' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const exist = await vendorRepository.findByUsername(username);
      if (exist) return res.status(400).json({ success: false, message: 'اسم المستخدم موجود مسبقاً' });
      const photo = req.file ? '/uploads/' + req.file.filename : null;
      const hashed = bcrypt.hashSync(password, 10);
      await vendorRepository.create({ username, password: hashed, fullname: 'مشرف المنصة', display_name: 'الإدارة', status: 'active', phone: phone || '', email: email || '', location: city || '', photo_path: photo });
      await contentRepository.logActivity(0, 'إنشاء مشرف', 'تم إنشاء حساب مشرف جديد: ' + username);
      res.json({ success: true, message: 'تم إنشاء حساب المشرف بنجاح' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/admins', requireAdmin, async (req, res, next) => {
    try {
      const admins = await vendorRepository.listAdminVendors();
      res.json({ success: true, admins });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/orders', requireAdmin, async (req, res, next) => {
    try {
      const [orders, subs, cats, vendors, reductions, globalRateRaw] = await Promise.all([
        orderRepository.listAllWithVendor(),
        subscriptionRepository.listAllWithCommission(),
        categoryRepository.listAllRates(),
        vendorRepository.listAllRates(),
        pointsRepository.sumActiveReductionsGrouped(new Date().toISOString()),
        getSetting('global_commission_rate', '0')
      ]);
      const subMap = new Map();
      for (const s of subs) subMap.set((s.vendor_id || 0) + '|' + s.name, s);
      const catMap = new Map(cats.map(c => [c.id, Number(c.commission_rate)]));
      const vendorMap = new Map(vendors.map(v => [v.id, v.commission_rate === null || v.commission_rate === undefined ? null : Number(v.commission_rate)]));
      const reductionMap = new Map(reductions.map(r => [r.vendor_id, Number(r.total) || 0]));
      const globalRate = parseFloat(globalRateRaw) || 0;
      const ordersWithCommission = [];
      for (const o of orders) {
        const sub = o.subscription_name ? subMap.get((o.vendor_id || 0) + '|' + o.subscription_name) : null;
        const rate = commissionService.effectiveRateBatched({
          subRate: sub && sub.commission_rate !== null && sub.commission_rate !== undefined ? Number(sub.commission_rate) : null,
          catRate: sub && sub.cat_id ? (catMap.has(sub.cat_id) ? catMap.get(sub.cat_id) : null) : null,
          vendorRate: o.vendor_id ? (vendorMap.has(o.vendor_id) ? vendorMap.get(o.vendor_id) : null) : null,
          globalRate,
          reductionTotal: o.vendor_id ? (reductionMap.get(o.vendor_id) || 0) : 0
        });
        ordersWithCommission.push({ ...o, customer_name: decrypt(o.customer_name), customer_phone: decrypt(o.customer_phone), commission_rate: rate, commission_amount: parseFloat((o.amount * rate / 100).toFixed(2)), vendor_share: parseFloat((o.amount * (100 - rate) / 100).toFixed(2)) });
      }
      res.json({ success: true, orders: ordersWithCommission });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/orders/count', requireAdmin, async (req, res, next) => {
    try {
      const count = await orderRepository.countAll();
      res.json({ success: true, count });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/report-details', requireAdmin, async (req, res, next) => {
    try {
      const row = await qOne(`SELECT
        (SELECT COUNT(*) FROM vendors WHERE username != 'admin') AS totalVendors,
        (SELECT COUNT(*) FROM vendors WHERE status='active' AND username != 'admin') AS activeVendors,
        (SELECT COUNT(*) FROM vendors WHERE status='pending') AS pendingVendors,
        (SELECT COUNT(*) FROM vendors WHERE status='rejected') AS rejectedVendors,
        (SELECT COUNT(*) FROM subscriptions) AS totalSubs,
        (SELECT COUNT(*) FROM subscriptions WHERE is_active=1) AS activeSubs,
        (SELECT COUNT(*) FROM vendor_categories) AS totalCategories,
        (SELECT COUNT(*) FROM orders) AS totalOrders,
        (SELECT COUNT(*) FROM orders WHERE status='completed') AS completedOrders,
        (SELECT COUNT(*) FROM orders WHERE status='pending') AS pendingOrders,
        (SELECT COUNT(*) FROM orders WHERE status='cancelled') AS cancelledOrders,
        (SELECT COALESCE(SUM(amount),0) FROM orders WHERE status='completed') AS totalRevenue,
        (SELECT COALESCE(SUM(amount),0) FROM orders WHERE status='pending') AS pendingRevenue,
        (SELECT COALESCE(SUM(views),0) FROM subscriptions) AS totalViews`);
      res.json({ success: true, report: row });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/vendors', requireAdmin, async (req, res, next) => {
    try {
      const vendors = await vendorRepository.listAll();
      const [ordersCounts, completedTotals, subsCounts] = await Promise.all([
        orderRepository.countsByVendor(),
        orderRepository.sumsCompletedByVendor(),
        subscriptionRepository.countsByVendor()
      ]);
      const ordersCountMap = new Map(ordersCounts.map(r => [r.vendor_id, r.c]));
      const completedMap = new Map(completedTotals.map(r => [r.vendor_id, r.t]));
      const subsCountMap = new Map(subsCounts.map(r => [r.vendor_id, r.c]));
      const vendorsWithStats = [];
      for (const v of vendors) {
        vendorsWithStats.push({ ...v, orders_count: ordersCountMap.get(v.id) || 0, completed_total: completedMap.get(v.id) || 0, subs_count: subsCountMap.get(v.id) || 0 });
      }
      res.json({ success: true, vendors: vendorsWithStats });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendors/:id/approve', requireAdmin, async (req, res, next) => {
    try {
      await vendorRepository.updateStatus(req.params.id, 'active');
      await contentRepository.logActivity(0, 'تفعيل مزود', 'تم تفعيل المزود رقم ' + req.params.id);
      res.json({ success: true, message: 'تم قبول طلب المزود' });
    } catch (e) { next(e); }
  });

  app.patch('/api/admin/vendors/:id/status', requireAdmin, async (req, res, next) => {
    try {
      const { status, rejected_reason } = req.body;
      if (!VENDOR_STATUSES.includes(status)) return res.json({ success: false, message: 'حالة غير صالحة' });
      await vendorRepository.updateStatus(req.params.id, status);
      if (rejected_reason) await vendorRepository.updateStatusWithReason(req.params.id, status, rejected_reason);
      await contentRepository.logActivity(0, status === 'active' ? 'تفعيل مزود' : 'رفض مزود', 'تم تغيير حالة المزود رقم ' + req.params.id + ' إلى ' + status);
      res.json({ success: true, message: status === 'active' ? 'تم قبول طلب المزود' : 'تم رفض طلب المزود' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendors/:id/reject', requireAdmin, async (req, res, next) => {
    try {
      await vendorRepository.updateStatus(req.params.id, 'rejected');
      await contentRepository.logActivity(0, 'رفض مزود', 'تم رفض المزود رقم ' + req.params.id);
      res.json({ success: true, message: 'تم رفض طلب المزود' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendors/:id/delete', requireAdmin, async (req, res, next) => {
    try {
      await vendorRepository.deleteFull(req.params.id);
      await contentRepository.logActivity(0, 'حذف مزود', 'تم حذف المزود رقم ' + req.params.id + ' وجميع بياناته');
      res.json({ success: true, message: 'تم حذف الحساب وجميع بياناته' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendors/:id/approve-delete', requireAdmin, async (req, res, next) => {
    try {
      await vendorRepository.deleteFull(req.params.id);
      await contentRepository.logActivity(0, 'قبول طلب حذف', 'تم قبول طلب حذف المزود رقم ' + req.params.id);
      res.json({ success: true, message: 'تم حذف الحساب وجميع بياناته' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendors/:id/reject-delete', requireAdmin, async (req, res, next) => {
    try {
      await vendorRepository.clearDeleteRequested(req.params.id);
      await contentRepository.logActivity(0, 'رفض طلب حذف', 'تم رفض طلب حذف المزود رقم ' + req.params.id);
      res.json({ success: true, message: 'تم رفض طلب الحذف' });
    } catch (e) { next(e); }
  });

  app.delete('/api/admin/orders/:id', requireAdmin, async (req, res, next) => {
    try {
      await orderRepository.deleteById(req.params.id);
      res.json({ success: true, message: 'تم حذف الطلب' });
    } catch (e) { next(e); }
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res, next) => {
    try {
      const { status } = req.body;
      const err = validate({ status: { required: true, type: 'string', oneOf: ['pending', 'completed', 'cancelled', 'awaiting_verification'], label: 'الحالة' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const order = await orderRepository.findById(req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
      await orderRepository.updateStatusAdmin(req.params.id, status);
      if (status === 'completed' && order.status !== 'completed') {
        const orderPhone = decrypt(order.customer_phone);
        await pointsService.completeOrderPoints({ vendorId: order.vendor_id, orderId: order.id, amount: order.amount, phone: orderPhone });
        await contentRepository.logActivity(order.vendor_id || 0, 'تأكيد طلب (إدارة)', 'تم تأكيد استكمال الطلب رقم ' + req.params.id + ' بواسطة الإدارة');
      }
      res.json({ success: true, message: 'تم تحديث حالة الطلب' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/stats', requireAdmin, async (req, res, next) => {
    try {
      const row = await qOne(`SELECT
        (SELECT COUNT(*) FROM vendors) AS vendorsCount,
        (SELECT COUNT(*) FROM vendors WHERE status='active') AS activeVendors,
        (SELECT COUNT(*) FROM vendors WHERE status='pending') AS pendingVendors,
        (SELECT COUNT(*) FROM orders) AS ordersCount,
        (SELECT COALESCE(SUM(amount),0) FROM orders WHERE status='completed') AS totalRevenue,
        (SELECT COUNT(*) FROM orders WHERE status='pending') AS pendingOrders,
        (SELECT COUNT(*) FROM orders WHERE status='awaiting_verification') AS awaitingVerification,
        (SELECT COUNT(*) FROM vendors WHERE delete_requested=1) AS deleteRequests,
        (SELECT COALESCE(SUM(views),0) FROM subscriptions) AS totalViews`);
      res.json({ success: true, stats: row });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/views', requireAdmin, async (req, res, next) => {
    try {
      const views = await subscriptionRepository.listViews(200);
      const stats = { todayViews: await subscriptionRepository.countTodayViews(), uniqueIPs: await subscriptionRepository.countUniqueIpsToday(), topSubs: await subscriptionRepository.topViewed(5) };
      res.json({ success: true, views, stats });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/activity-log', requireAdmin, async (req, res, next) => {
    try {
      const logs = await contentRepository.listLogsFiltered(req.query);
      res.json({ success: true, logs });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/settings', requireAdmin, async (req, res, next) => {
    try {
      const globalRate = await getSetting('global_commission_rate', '0');
      res.json({ success: true, global_commission_rate: globalRate ? parseFloat(globalRate) : 0 });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/settings/commission', requireAdmin, async (req, res, next) => {
    try {
      const { rate } = req.body;
      const r = parseFloat(rate);
      if (isNaN(r) || r < 0 || r > 100) return res.status(400).json({ success: false, message: 'النسبة يجب أن تكون بين 0 و 100' });
      await setSetting('global_commission_rate', r);
      await contentRepository.logActivity(0, 'تعديل إعدادات', 'تغيير نسبة العمولة العامة إلى ' + r + '%');
      res.json({ success: true, message: 'تم تحديث نسبة العمولة العامة' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendors/:id/commission', requireAdmin, async (req, res, next) => {
    try {
      const { rate } = req.body;
      const id = req.params.id;
      if (rate === null || rate === undefined || rate === '') {
        await vendorRepository.resetCommission(id);
        await contentRepository.logActivity(0, 'تعديل عمولة', 'إعادة تعيين عمولة المزود ' + id + ' إلى الافتراضي');
        return res.json({ success: true, message: 'تم إعادة تعيين العمولة للقيمة الافتراضية' });
      }
      const r = parseFloat(rate);
      if (isNaN(r) || r < 0 || r > 100) return res.status(400).json({ success: false, message: 'النسبة يجب أن تكون بين 0 و 100' });
      await vendorRepository.setCommission(id, r);
      await contentRepository.logActivity(0, 'تعديل عمولة', 'تعيين عمولة المزود ' + id + ' إلى ' + r + '%');
      res.json({ success: true, message: 'تم تحديث نسبة العمولة للمزود' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/complaints', requireAdmin, async (req, res, next) => {
    try {
      const complaints = [];
      const rows = await contentRepository.listComplaints();
      for (const c of rows) {
        complaints.push({
          ...c,
          customer_name: decrypt(c.customer_name),
          customer_phone: decrypt(c.customer_phone),
          vendor_name: decrypt(c.vendor_name),
          reason: decrypt(c.reason)
        });
      }
      res.json({ success: true, complaints });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/complaints/:id', requireAdmin, async (req, res, next) => {
    try {
      const { status, admin_response } = req.body;
      const err = validate({ status: { required: true, type: 'string', oneOf: ['accepted', 'rejected'], label: 'الحالة' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await contentRepository.updateComplaint(req.params.id, status, admin_response);
      res.json({ success: true, message: 'تم تحديث حالة الشكوى' });
    } catch (e) { next(e); }
  });

  app.get('/api/featured', requireAdmin, async (req, res, next) => {
    try {
      const featured = await subscriptionRepository.listFeaturedAll();
      res.json({ success: true, featured });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/featured', requireAdmin, async (req, res, next) => {
    try {
      const { subscription_id, special_price } = req.body;
      const err = validate({ subscription_id: { required: true, type: 'number', label: 'الاشتراك' }, special_price: { type: 'number', min: 0, label: 'السعر المميز' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const exist = await subscriptionRepository.findFeatured(subscription_id);
      if (exist) return res.status(400).json({ success: false, message: 'الاشتراك مميز بالفعل' });
      await subscriptionRepository.addFeatured(subscription_id, special_price);
      await contentRepository.logActivity(0, 'إضافة مميز', 'تم إضافة اشتراك مميز رقم ' + subscription_id);
      res.json({ success: true, message: 'تم إضافة الاشتراك إلى المميزة' });
    } catch (e) { next(e); }
  });

  app.delete('/api/admin/featured/:id', requireAdmin, async (req, res, next) => {
    try {
      await subscriptionRepository.removeFeatured(req.params.id);
      res.json({ success: true, message: 'تم إزالة الاشتراك من المميزة' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/delete-requests', requireAdmin, async (req, res, next) => {
    try {
      const requests = await vendorRepository.listDeleteRequests();
      res.json({ success: true, requests });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/clear-revenue', requireAdmin, async (req, res, next) => {
    try {
      await orderRepository.clearCompletedRevenue();
      await contentRepository.logActivity(0, 'تصفير الإيرادات', 'تم تصفير جميع الإيرادات');
      res.json({ success: true, message: 'تم تصفير جميع الإيرادات' });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/reset-all', requireAdmin, async (req, res, next) => {
    try {
      await subscriptionRepository.deleteAllOffers();
      await subscriptionRepository.deleteAllRatings();
      await contentRepository.deleteAllLogs();
      await tokenRepository.deleteAll();
      await pointsRepository.deleteAllVendorTxns();
      await pointsRepository.deleteAllReductions();
      await pointsRepository.deleteAllVendorPoints();
      await pointsRepository.deleteAllCustomerTxns();
      await pointsRepository.deleteAllCustomerPoints();
      await subscriptionRepository.deleteAllViews();
      await subscriptionRepository.deleteAllFeatured();
      await contentRepository.deleteAllComplaints();
      await vendorRepository.deleteAllDeleteResponses();
      await orderRepository.deleteAll();
      await subscriptionRepository.deleteAll();
      await categoryRepository.deleteAll();
      await vendorRepository.deleteNonAdmin();
      await contentRepository.logActivity(0, 'إعادة تعيين المنصة', 'تم إعادة تعيين جميع بيانات المنصة');
      res.json({ success: true, message: 'تم إعادة تعيين المنصة بنجاح' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/points-settings', requireAdmin, async (req, res, next) => {
    try {
      const settings = {};
      for (const k of POINTS_SETTINGS_KEYS) settings[k] = parseFloat(await getSetting(k, '0'));
      res.json({ success: true, settings });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/points-settings', requireAdmin, async (req, res, next) => {
    try {
      const { key, value } = req.body;
      const err = validate({ key: { required: true, type: 'string', oneOf: POINTS_SETTINGS_KEYS, label: 'المفتاح' }, value: { required: true, type: 'number', min: 0, label: 'القيمة' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await setSetting(key, value);
      res.json({ success: true, message: 'تم الحفظ' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/customer-points', requireAdmin, async (req, res, next) => {
    try {
      const points = await pointsRepository.listAllCustomerPoints();
      const transactions = await pointsRepository.listCustomerTxns(100);
      res.json({ success: true, points, transactions });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/vendor-points-summary', requireAdmin, async (req, res, next) => {
    try {
      const data = await pointsRepository.listAllVendorPoints();
      const reductions = await pointsRepository.listAllReductions();
      res.json({ success: true, data, reductions });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/vendor-points/add', requireAdmin, async (req, res, next) => {
    try {
      const { vendor_id, points } = req.body;
      const err = validate({ vendor_id: { required: true, type: 'number', label: 'المزود' }, points: { required: true, type: 'number', min: 1, label: 'النقاط' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const vp = await pointsRepository.getVendorPoints(vendor_id);
      if (vp) await pointsRepository.addVendorPoints(vendor_id, points);
      else await pointsRepository.createVendorPoints(vendor_id, points, null, 0);
      await pointsRepository.insertVendorTxn(vendor_id, points, 'earn');
      res.json({ success: true, message: 'تم إضافة ' + points + ' نقطة للمزود' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/offers', requireAdmin, async (req, res, next) => {
    try {
      const offers = await subscriptionRepository.listOffersAll();
      res.json({ success: true, offers });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/offers', requireAdmin, async (req, res, next) => {
    try {
      const { subscription_id, discount_percent, valid_until } = req.body;
      const err = validate({ subscription_id: { required: true, type: 'number', label: 'الاشتراك' }, discount_percent: { required: true, type: 'number', min: 1, max: 100, label: 'نسبة الخصم' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await subscriptionRepository.createOffer(subscription_id, discount_percent, valid_until);
      res.json({ success: true, message: 'تم إضافة العرض' });
    } catch (e) { next(e); }
  });

  app.delete('/api/admin/offers/:id', requireAdmin, async (req, res, next) => {
    try {
      await subscriptionRepository.deleteOffer(req.params.id);
      res.json({ success: true, message: 'تم حذف العرض' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/pages', requireAdmin, async (req, res, next) => {
    try {
      const pages = await contentRepository.listPages();
      res.json({ success: true, pages });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/pages/:slug', requireAdmin, async (req, res, next) => {
    try {
      const { title, content } = req.body;
      const slug = req.params.slug;
      const err = validate({ title: { type: 'string', maxLength: 200, label: 'العنوان' }, content: { type: 'string', label: 'المحتوى' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      await contentRepository.upsertPage(slug, title || '', content);
      await contentRepository.logActivity(0, 'تعديل محتوى', 'تحديث محتوى صفحة "' + slug + '"');
      res.json({ success: true, message: 'تم حفظ المحتوى بنجاح' });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/custom-assets', requireAdmin, async (req, res, next) => {
    try {
      const rows = await contentRepository.listAssets();
      const assets = {};
      for (const r of rows) assets[r.key] = r.value;
      res.json({ success: true, assets });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/custom-assets', requireAdmin, async (req, res, next) => {
    try {
      const { key, value } = req.body;
      const error = validate({ key: { required: true, type: 'string', oneOf: CUSTOM_ASSET_KEYS }, value: { type: 'string' } }, req.body);
      if (error) return res.status(400).json({ success: false, message: error });
      await contentRepository.setAsset(key, value);
      await contentRepository.logActivity(0, 'تعديل Custom Assets', 'تحديث ' + key);
      res.json({ success: true, message: 'تم الحفظ' });
    } catch (e) { next(e); }
  });

};