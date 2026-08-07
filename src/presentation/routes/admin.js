const bcrypt = require('bcryptjs');
const { getSetting, setSetting } = require('../../infrastructure/persistence/db');
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

  app.post('/api/admin/orders', requireAdmin, (req, res) => {
    const { customer_name, customer_phone, customer_email, vendor_id, subscription_name, amount, status } = req.body;
    const err = validate({
      customer_name: { required: true, type: 'string', maxLength: 100, label: 'ط§ط³ظ… ط§ظ„ط²ط¨ظˆظ†' },
      customer_phone: { type: 'string', maxLength: 30, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' },
      subscription_name: { required: true, type: 'string', maxLength: 200, label: 'ط§ط³ظ… ط§ظ„ط§ط´طھط±ط§ظƒ' },
      amount: { required: true, type: 'number', min: 0, max: 999999, label: 'ط§ظ„ظ…ط¨ظ„ط؛' },
      status: { type: 'string', oneOf: ['pending', 'completed', 'cancelled'], label: 'ط§ظ„ط­ط§ظ„ط©' }
    }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    orderRepository.insert({
      customer_name: encrypt(String(customer_name)),
      customer_phone: encrypt(String(customer_phone)),
      customer_email,
      vendor_id,
      subscription_name,
      amount,
      status
    });
    res.json({ success: true, message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط·ظ„ط¨' });
  });

  app.post('/api/admin/create-admin', requireAdmin, upload.single('photo'), (req, res) => {
    try {
      const { username, password, phone, email, city } = req.body;
      const err = validate({ username: { required: true, type: 'string', minLength: 3, maxLength: 50, label: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ…' }, password: { required: true, type: 'string', minLength: 8, maxLength: 100, label: 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±' }, phone: { type: 'string', maxLength: 30, label: 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ' }, email: { type: 'string', maxLength: 200, label: 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ' }, city: { type: 'string', maxLength: 100, label: 'ط§ظ„ظ…ط¯ظٹظ†ط©' } }, req.body);
      if (err) return res.status(400).json({ success: false, message: err });
      const exist = vendorRepository.findByUsername(username);
      if (exist) return res.status(400).json({ success: false, message: 'ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ط§ظ‹' });
      const photo = req.file ? '/uploads/' + req.file.filename : null;
      const hashed = bcrypt.hashSync(password, 10);
      vendorRepository.create({ username, password: hashed, fullname: 'ظ…ط´ط±ظپ ط§ظ„ظ…ظ†طµط©', display_name: 'ط§ظ„ط¥ط¯ط§ط±ط©', status: 'active', phone: phone || '', email: email || '', location: city || '', photo_path: photo });
      contentRepository.logActivity(0, 'ط¥ظ†ط´ط§ط، ظ…ط´ط±ظپ', 'طھظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ظ…ط´ط±ظپ ط¬ط¯ظٹط¯: ' + username);
      res.json({ success: true, message: 'طھظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط§ظ„ظ…ط´ط±ظپ ط¨ظ†ط¬ط§ط­' });
    } catch (e) { console.error('ط®ط·ط£ ط¯ط§ط®ظ„ظٹ:', e.message); res.status(500).json({ success: false, message: 'ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹. ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰' }); }
  });

  app.get('/api/admin/admins', requireAdmin, (req, res) => {
    const admins = vendorRepository.listAdminVendors();
    res.json({ success: true, admins });
  });

  app.get('/api/admin/orders', requireAdmin, (req, res) => {
    const orders = orderRepository.listAllWithVendor();
    const ordersWithCommission = orders.map(o => {
      const sub = o.subscription_name ? subscriptionRepository.findByNameAndVendor(o.subscription_name, o.vendor_id) : null;
      const rate = commissionService.effectiveRate(o.vendor_id || 0, sub ? sub.id : null, sub ? sub.cat_id : null);
      return { ...o, customer_name: decrypt(o.customer_name), customer_phone: decrypt(o.customer_phone), commission_rate: rate, commission_amount: parseFloat((o.amount * rate / 100).toFixed(2)), vendor_share: parseFloat((o.amount * (100 - rate) / 100).toFixed(2)) };
    });
    res.json({ success: true, orders: ordersWithCommission });
  });

  app.get('/api/admin/report-details', requireAdmin, (req, res) => {
    const report = {
      totalVendors: vendorRepository.countNonAdmin(),
      activeVendors: vendorRepository.countActiveNonAdmin(),
      pendingVendors: vendorRepository.countPending(),
      rejectedVendors: vendorRepository.countRejected(),
      totalSubs: subscriptionRepository.countAll(),
      activeSubs: subscriptionRepository.countActive(),
      totalOrders: orderRepository.countAll(),
      completedOrders: orderRepository.countByStatus('completed'),
      pendingOrders: orderRepository.countByStatus('pending'),
      cancelledOrders: orderRepository.countByStatus('cancelled'),
      totalRevenue: orderRepository.sumCompleted()
    };
    res.json({ success: true, report });
  });

  app.get('/api/admin/vendors', requireAdmin, (req, res) => {
    const vendors = vendorRepository.listAll();
    const vendorsWithStats = vendors.map(v => {
      const ordersCount = orderRepository.countByVendor(v.id);
      const completedTotal = orderRepository.sumCompletedByVendor(v.id);
      const subsCount = subscriptionRepository.countByVendor(v.id);
      return { ...v, orders_count: ordersCount, completed_total: completedTotal, subs_count: subsCount };
    });
    res.json({ success: true, vendors: vendorsWithStats });
  });

  app.post('/api/admin/vendors/:id/approve', requireAdmin, (req, res) => {
    vendorRepository.updateStatus(req.params.id, 'active');
    contentRepository.logActivity(0, 'طھظپط¹ظٹظ„ ظ…ط²ظˆط¯', 'طھظ… طھظپط¹ظٹظ„ ط§ظ„ظ…ط²ظˆط¯ ط±ظ‚ظ… ' + req.params.id);
    res.json({ success: true, message: 'طھظ… ظ‚ط¨ظˆظ„ ط·ظ„ط¨ ط§ظ„ظ…ط²ظˆط¯' });
  });

  app.patch('/api/admin/vendors/:id/status', requireAdmin, (req, res) => {
    const { status, rejected_reason } = req.body;
    if (!VENDOR_STATUSES.includes(status)) return res.json({ success: false, message: 'ط­ط§ظ„ط© ط؛ظٹط± طµط§ظ„ط­ط©' });
    vendorRepository.updateStatus(req.params.id, status);
    if (rejected_reason) vendorRepository.updateStatusWithReason(req.params.id, status, rejected_reason);
    contentRepository.logActivity(0, status === 'active' ? 'طھظپط¹ظٹظ„ ظ…ط²ظˆط¯' : 'ط±ظپط¶ ظ…ط²ظˆط¯', 'طھظ… طھط؛ظٹظٹط± ط­ط§ظ„ط© ط§ظ„ظ…ط²ظˆط¯ ط±ظ‚ظ… ' + req.params.id + ' ط¥ظ„ظ‰ ' + status);
    res.json({ success: true, message: status === 'active' ? 'طھظ… ظ‚ط¨ظˆظ„ ط·ظ„ط¨ ط§ظ„ظ…ط²ظˆط¯' : 'طھظ… ط±ظپط¶ ط·ظ„ط¨ ط§ظ„ظ…ط²ظˆط¯' });
  });

  app.post('/api/admin/vendors/:id/reject', requireAdmin, (req, res) => {
    vendorRepository.updateStatus(req.params.id, 'rejected');
    contentRepository.logActivity(0, 'ط±ظپط¶ ظ…ط²ظˆط¯', 'طھظ… ط±ظپط¶ ط§ظ„ظ…ط²ظˆط¯ ط±ظ‚ظ… ' + req.params.id);
    res.json({ success: true, message: 'طھظ… ط±ظپط¶ ط§ظ„ظ…ط²ظˆط¯' });
  });

  app.post('/api/admin/vendors/:id/delete', requireAdmin, (req, res) => {
    vendorRepository.deleteFull(req.params.id);
    contentRepository.logActivity(0, 'ط­ط°ظپ ظ…ط²ظˆط¯', 'طھظ… ط­ط°ظپ ط§ظ„ظ…ط²ظˆط¯ ط±ظ‚ظ… ' + req.params.id + ' ظˆط¬ظ…ظٹط¹ ط¨ظٹط§ظ†ط§طھظ‡');
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨ ظˆط¬ظ…ظٹط¹ ط¨ظٹط§ظ†ط§طھظ‡' });
  });

  app.post('/api/admin/vendors/:id/approve-delete', requireAdmin, (req, res) => {
    vendorRepository.deleteFull(req.params.id);
    contentRepository.logActivity(0, 'ظ‚ط¨ظˆظ„ ط·ظ„ط¨ ط­ط°ظپ', 'طھظ… ظ‚ط¨ظˆظ„ ط·ظ„ط¨ ط­ط°ظپ ط§ظ„ظ…ط²ظˆط¯ ط±ظ‚ظ… ' + req.params.id);
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨ ظˆط¬ظ…ظٹط¹ ط¨ظٹط§ظ†ط§طھظ‡' });
  });

  app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
    orderRepository.deleteById(req.params.id);
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط·ظ„ط¨' });
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const err = validate({ status: { required: true, type: 'string', oneOf: ['pending', 'completed', 'cancelled', 'awaiting_verification'], label: 'ط§ظ„ط­ط§ظ„ط©' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const order = orderRepository.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
    orderRepository.updateStatusAdmin(req.params.id, status);
    if (status === 'completed' && order.status !== 'completed') {
      const orderPhone = decrypt(order.customer_phone);
      pointsService.completeOrderPoints({ vendorId: order.vendor_id, orderId: order.id, amount: order.amount, phone: orderPhone });
      contentRepository.logActivity(order.vendor_id || 0, 'طھط£ظƒظٹط¯ ط·ظ„ط¨ (ط¥ط¯ط§ط±ط©)', 'طھظ… طھط£ظƒظٹط¯ ط§ط³طھظƒظ…ط§ظ„ ط§ظ„ط·ظ„ط¨ ط±ظ‚ظ… ' + req.params.id + ' ط¨ظˆط§ط³ط·ط© ط§ظ„ط¥ط¯ط§ط±ط©');
    }
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط·ظ„ط¨' });
  });

  app.get('/api/admin/stats', requireAdmin, (req, res) => {
    res.json({ success: true, stats: {
      vendorsCount: vendorRepository.countAll(),
      activeVendors: vendorRepository.countActive(),
      pendingVendors: vendorRepository.countPending(),
      ordersCount: orderRepository.countAll(),
      totalRevenue: orderRepository.sumCompleted(),
      pendingOrders: orderRepository.countByStatus('pending'),
      awaitingVerification: orderRepository.countByStatus('awaiting_verification'),
      deleteRequests: vendorRepository.countDeleteRequests(),
      totalViews: subscriptionRepository.totalViews()
    } });
  });

  app.get('/api/admin/views', requireAdmin, (req, res) => {
    const views = subscriptionRepository.listViews(200);
    res.json({ success: true, views, stats: { todayViews: subscriptionRepository.countTodayViews(), uniqueIPs: subscriptionRepository.countUniqueIpsToday(), topSubs: subscriptionRepository.topViewed(5) } });
  });

  app.get('/api/admin/activity-log', requireAdmin, (req, res) => {
    const logs = contentRepository.listLogsFiltered(req.query);
    res.json({ success: true, logs });
  });

  app.get('/api/admin/settings', requireAdmin, (req, res) => {
    const globalRate = getSetting('global_commission_rate', '0');
    res.json({ success: true, global_commission_rate: globalRate ? parseFloat(globalRate) : 0 });
  });

  app.post('/api/admin/settings/commission', requireAdmin, (req, res) => {
    const { rate } = req.body;
    const r = parseFloat(rate);
    if (isNaN(r) || r < 0 || r > 100) return res.status(400).json({ success: false, message: 'ط§ظ„ظ†ط³ط¨ط© ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط¨ظٹظ† 0 ظˆ 100' });
    setSetting('global_commission_rate', r);
    contentRepository.logActivity(0, 'طھط¹ط¯ظٹظ„ ط¥ط¹ط¯ط§ط¯ط§طھ', 'طھط؛ظٹظٹط± ظ†ط³ط¨ط© ط§ظ„ط¹ظ…ظˆظ„ط© ط§ظ„ط¹ط§ظ…ط© ط¥ظ„ظ‰ ' + r + '%');
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ظ†ط³ط¨ط© ط§ظ„ط¹ظ…ظˆظ„ط© ط§ظ„ط¹ط§ظ…ط©' });
  });

  app.post('/api/admin/vendors/:id/commission', requireAdmin, (req, res) => {
    const { rate } = req.body;
    const id = req.params.id;
    if (rate === null || rate === undefined || rate === '') {
      vendorRepository.resetCommission(id);
      contentRepository.logActivity(0, 'طھط¹ط¯ظٹظ„ ط¹ظ…ظˆظ„ط©', 'ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ط¹ظ…ظˆظ„ط© ط§ظ„ظ…ط²ظˆط¯ ' + id + ' ط¥ظ„ظ‰ ط§ظ„ط§ظپطھط±ط§ط¶ظٹ');
      return res.json({ success: true, message: 'طھظ… ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ط§ظ„ط¹ظ…ظˆظ„ط© ظ„ظ„ظ‚ظٹظ…ط© ط§ظ„ط§ظپطھط±ط§ط¶ظٹط©' });
    }
    const r = parseFloat(rate);
    if (isNaN(r) || r < 0 || r > 100) return res.status(400).json({ success: false, message: 'ط§ظ„ظ†ط³ط¨ط© ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط¨ظٹظ† 0 ظˆ 100' });
    vendorRepository.setCommission(id, r);
    contentRepository.logActivity(0, 'طھط¹ط¯ظٹظ„ ط¹ظ…ظˆظ„ط©', 'طھط¹ظٹظٹظ† ط¹ظ…ظˆظ„ط© ط§ظ„ظ…ط²ظˆط¯ ' + id + ' ط¥ظ„ظ‰ ' + r + '%');
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ظ†ط³ط¨ط© ط§ظ„ط¹ظ…ظˆظ„ط© ظ„ظ„ظ…ط²ظˆط¯' });
  });

  app.get('/api/admin/complaints', requireAdmin, (req, res) => {
    const complaints = contentRepository.listComplaints().map(c => ({
      ...c,
      customer_name: decrypt(c.customer_name),
      customer_phone: decrypt(c.customer_phone),
      vendor_name: decrypt(c.vendor_name),
      reason: decrypt(c.reason)
    }));
    res.json({ success: true, complaints });
  });

  app.post('/api/admin/complaints/:id', requireAdmin, (req, res) => {
    const { status, admin_response } = req.body;
    const err = validate({ status: { required: true, type: 'string', oneOf: ['accepted', 'rejected'], label: 'ط§ظ„ط­ط§ظ„ط©' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    contentRepository.updateComplaint(req.params.id, status, admin_response);
    res.json({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط´ظƒظˆظ‰' });
  });

  app.get('/api/featured', requireAdmin, (req, res) => {
    const featured = subscriptionRepository.listFeaturedAll();
    res.json({ success: true, featured });
  });

  app.post('/api/admin/featured', requireAdmin, (req, res) => {
    const { subscription_id, special_price } = req.body;
    const err = validate({ subscription_id: { required: true, type: 'number', label: 'ط§ظ„ط§ط´طھط±ط§ظƒ' }, special_price: { type: 'number', min: 0, label: 'ط§ظ„ط³ط¹ط± ط§ظ„ظ…ظ…ظٹط²' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const exist = subscriptionRepository.findFeatured(subscription_id);
    if (exist) return res.status(400).json({ success: false, message: 'ط§ظ„ط§ط´طھط±ط§ظƒ ظ…ظ…ظٹط² ط¨ط§ظ„ظپط¹ظ„' });
    subscriptionRepository.addFeatured(subscription_id, special_price);
    contentRepository.logActivity(0, 'ط¥ط¶ط§ظپط© ظ…ظ…ظٹط²', 'طھظ… ط¥ط¶ط§ظپط© ط§ط´طھط±ط§ظƒ ظ…ظ…ظٹط² ط±ظ‚ظ… ' + subscription_id);
    res.json({ success: true, message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط§ط´طھط±ط§ظƒ ط¥ظ„ظ‰ ط§ظ„ظ…ظ…ظٹط²ط©' });
  });

  app.delete('/api/admin/featured/:id', requireAdmin, (req, res) => {
    subscriptionRepository.removeFeatured(req.params.id);
    res.json({ success: true, message: 'طھظ… ط¥ط²ط§ظ„ط© ط§ظ„ط§ط´طھط±ط§ظƒ ظ…ظ† ط§ظ„ظ…ظ…ظٹط²ط©' });
  });

  app.get('/api/admin/delete-requests', requireAdmin, (req, res) => {
    const requests = vendorRepository.listDeleteRequests();
    res.json({ success: true, requests });
  });

  app.post('/api/admin/clear-revenue', requireAdmin, (req, res) => {
    orderRepository.clearCompletedRevenue();
    contentRepository.logActivity(0, 'طھطµظپظٹط± ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ', 'طھظ… طھطµظپظٹط± ط¬ظ…ظٹط¹ ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ');
    res.json({ success: true, message: 'طھظ… طھطµظپظٹط± ط¬ظ…ظٹط¹ ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ' });
  });

  app.post('/api/admin/reset-all', requireAdmin, (req, res) => {
    subscriptionRepository.deleteAllOffers();
    subscriptionRepository.deleteAllRatings();
    contentRepository.deleteAllLogs();
    tokenRepository.deleteAll();
    pointsRepository.deleteAllVendorTxns();
    pointsRepository.deleteAllReductions();
    pointsRepository.deleteAllVendorPoints();
    pointsRepository.deleteAllCustomerTxns();
    pointsRepository.deleteAllCustomerPoints();
    subscriptionRepository.deleteAllViews();
    subscriptionRepository.deleteAllFeatured();
    contentRepository.deleteAllComplaints();
    vendorRepository.deleteAllDeleteResponses();
    orderRepository.deleteAll();
    subscriptionRepository.deleteAll();
    categoryRepository.deleteAll();
    vendorRepository.deleteNonAdmin();
    contentRepository.logActivity(0, 'ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ط§ظ„ظ…ظ†طµط©', 'طھظ… ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ط¬ظ…ظٹط¹ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ظ†طµط©');
    res.json({ success: true, message: 'طھظ… ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ط§ظ„ظ…ظ†طµط© ط¨ظ†ط¬ط§ط­' });
  });

  app.get('/api/admin/points-settings', requireAdmin, (req, res) => {
    const settings = {};
    for (const k of POINTS_SETTINGS_KEYS) settings[k] = parseFloat(getSetting(k, '0'));
    res.json({ success: true, settings });
  });

  app.post('/api/admin/points-settings', requireAdmin, (req, res) => {
    const { key, value } = req.body;
    const err = validate({ key: { required: true, type: 'string', oneOf: POINTS_SETTINGS_KEYS, label: 'ط§ظ„ظ…ظپطھط§ط­' }, value: { required: true, type: 'number', min: 0, label: 'ط§ظ„ظ‚ظٹظ…ط©' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    setSetting(key, value);
    res.json({ success: true, message: 'طھظ… ط§ظ„ط­ظپط¸' });
  });

  app.get('/api/admin/customer-points', requireAdmin, (req, res) => {
    const points = pointsRepository.listAllCustomerPoints();
    const transactions = pointsRepository.listCustomerTxns(100);
    res.json({ success: true, points, transactions });
  });

  app.get('/api/admin/vendor-points-summary', requireAdmin, (req, res) => {
    const data = pointsRepository.listAllVendorPoints();
    const reductions = pointsRepository.listAllReductions();
    res.json({ success: true, data, reductions });
  });

  app.post('/api/admin/vendor-points/add', requireAdmin, (req, res) => {
    const { vendor_id, points } = req.body;
    const err = validate({ vendor_id: { required: true, type: 'number', label: 'ط§ظ„ظ…ط²ظˆط¯' }, points: { required: true, type: 'number', min: 1, label: 'ط§ظ„ظ†ظ‚ط§ط·' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    const vp = pointsRepository.getVendorPoints(vendor_id);
    if (vp) pointsRepository.addVendorPoints(vendor_id, points);
    else pointsRepository.createVendorPoints(vendor_id, points, null, 0);
    pointsRepository.insertVendorTxn(vendor_id, points, 'earn');
    res.json({ success: true, message: 'طھظ… ط¥ط¶ط§ظپط© ' + points + ' ظ†ظ‚ط·ط© ظ„ظ„ظ…ط²ظˆط¯' });
  });

  app.get('/api/admin/offers', requireAdmin, (req, res) => {
    const offers = subscriptionRepository.listOffersAll();
    res.json({ success: true, offers });
  });

  app.post('/api/admin/offers', requireAdmin, (req, res) => {
    const { subscription_id, discount_percent, valid_until } = req.body;
    const err = validate({ subscription_id: { required: true, type: 'number', label: 'ط§ظ„ط§ط´طھط±ط§ظƒ' }, discount_percent: { required: true, type: 'number', min: 1, max: 100, label: 'ظ†ط³ط¨ط© ط§ظ„ط®طµظ…' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    subscriptionRepository.createOffer(subscription_id, discount_percent, valid_until);
    res.json({ success: true, message: 'طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط¹ط±ط¶' });
  });

  app.delete('/api/admin/offers/:id', requireAdmin, (req, res) => {
    subscriptionRepository.deleteOffer(req.params.id);
    res.json({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ط¹ط±ط¶' });
  });

  app.get('/api/admin/pages', requireAdmin, (req, res) => {
    const pages = contentRepository.listPages();
    res.json({ success: true, pages });
  });

  app.post('/api/admin/pages/:slug', requireAdmin, (req, res) => {
    const { title, content } = req.body;
    const slug = req.params.slug;
    const err = validate({ title: { type: 'string', maxLength: 200, label: 'ط§ظ„ط¹ظ†ظˆط§ظ†' }, content: { type: 'string', label: 'ط§ظ„ظ…ط­طھظˆظ‰' } }, req.body);
    if (err) return res.status(400).json({ success: false, message: err });
    contentRepository.upsertPage(slug, title || '', content);
    contentRepository.logActivity(0, 'طھط¹ط¯ظٹظ„ ظ…ط­طھظˆظ‰', 'طھط­ط¯ظٹط« ظ…ط­طھظˆظ‰ طµظپط­ط© "' + slug + '"');
    res.json({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„ظ…ط­طھظˆظ‰ ط¨ظ†ط¬ط§ط­' });
  });

  app.get('/api/admin/custom-assets', requireAdmin, (req, res) => {
    const rows = contentRepository.listAssets();
    const assets = {};
    for (const r of rows) assets[r.key] = r.value;
    res.json({ success: true, assets });
  });

  app.post('/api/admin/custom-assets', requireAdmin, (req, res) => {
    const { key, value } = req.body;
    const error = validate({ key: { required: true, type: 'string', oneOf: CUSTOM_ASSET_KEYS }, value: { type: 'string' } }, req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    contentRepository.setAsset(key, value);
    contentRepository.logActivity(0, 'طھط¹ط¯ظٹظ„ Custom Assets', 'طھط­ط¯ظٹط« ' + key);
    res.json({ success: true, message: 'طھظ… ط§ظ„ط­ظپط¸' });
  });

};