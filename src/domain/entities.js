// Domain entities and business constants — pure, no dependencies

const VENDOR_STATUSES = ['pending', 'active', 'rejected'];
const ORDER_STATUSES = ['pending', 'completed', 'cancelled', 'awaiting_verification'];
const COMPLAINT_STATUSES = ['pending', 'accepted', 'rejected'];
const POINT_TXN_TYPES = ['earn', 'redeem'];

const ADMIN_ROLE_NAME = 'مشرف المنصة';
const CUSTOM_ASSET_KEYS = ['custom_css', 'custom_js', 'custom_html'];

const POINTS_SETTINGS_KEYS = [
  'customer_points_per_order',
  'customer_point_discount',
  'customer_max_discount_percent',
  'vendor_daily_target',
  'vendor_points_per_target',
  'vendor_commission_reduction_per_point',
  'vendor_reduction_hours'
];

const PUBLIC_POINTS_SETTINGS_KEYS = ['customer_point_discount', 'customer_max_discount_percent'];

module.exports = {
  VENDOR_STATUSES,
  ORDER_STATUSES,
  COMPLAINT_STATUSES,
  POINT_TXN_TYPES,
  ADMIN_ROLE_NAME,
  CUSTOM_ASSET_KEYS,
  POINTS_SETTINGS_KEYS,
  PUBLIC_POINTS_SETTINGS_KEYS
};
