# خطة نظام النقاط والمكافآت

## 1. قاعدة البيانات (جداول جديدة في server.js)

### جدول نقاط الزبائن
```sql
CREATE TABLE IF NOT EXISTS customer_points (
  phone TEXT PRIMARY KEY,
  points INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customer_point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_phone TEXT NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earn','redeem')),
  order_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### جدول نقاط المزودين وتخفيض العمولة
```sql
CREATE TABLE IF NOT EXISTS vendor_points (
  vendor_id INTEGER PRIMARY KEY,
  points INTEGER DEFAULT 0,
  daily_sales_date TEXT,
  daily_sales_total REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS vendor_point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earn','redeem')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vendor_commission_reductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL,
  reduction_percent REAL NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

### جدول العروض الخاصة للزبائن
```sql
CREATE TABLE IF NOT EXISTS customer_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  discount_percent REAL NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### إعدادات النقاط (في جدول settings)
- `customer_points_per_order` → عدد النقاط لكل طلب مكتمل
- `customer_point_discount` → قيمة الخصم لكل نقطة (د.ل)
- `customer_max_discount_percent` → أقصى خصم نسبة مئوية
- `vendor_daily_target` → هدف المبيعات اليومي للمزود
- `vendor_points_per_target` → نقاط المزود عند تحقيق الهدف
- `vendor_commission_reduction_per_point` → تخفيض العمولة % لكل نقطة
- `vendor_reduction_hours` → مدة تخفيض العمولة بالساعات

## 2. تعديلات Backend (server.js)

### New Endpoints
- `GET /api/customer-points/:phone` → public, returns points balance
- `POST /api/apply-points` → public, apply points as discount (validates, creates transaction)
- `GET /api/vendor/points` → vendor, returns balance + active reductions
- `POST /api/vendor/redeem-points` → vendor, redeem points for commission reduction
- `GET /api/admin/points-settings` → admin, get all points settings
- `POST /api/admin/points-settings` → admin, save all points settings
- `GET /api/admin/customer-points` → admin, list all customer points
- `GET /api/admin/vendor-points` → admin, list all vendor points + reductions
- `GET /api/admin/customer-offers` → admin, list offers
- `POST /api/admin/customer-offers` → admin, create/update offer
- `DELETE /api/admin/customer-offers/:id` → admin, delete offer

### Modified Endpoints
- `PATCH /api/vendor/orders/:id/status` → عند الإتمام: يمنح الزبون نقاط + يتحقق من target اليومي للمزود
- `GET /api/vendor/orders` → يعرض الخصم المطبق إن وجد
- `GET /api/admin/orders` → يعرض الخصم المطبق
- `GET /api/marketplace` → يعرض العروض الخاصة مع الاشتراكات
- `POST /api/orders` → يقبل `discount_amount` و `points_used`

## 3. لوحة التحكم (admin.html) — قسم جديد "نظام النقاط"

### Sidebar إضافة
```html
<button onclick="showSection('points-system')" class="sidebar-link w-full text-right">
  <svg>...</svg><span>نظام النقاط</span>
</button>
```

### Cards في القسم:
1. **إعدادات نقاط الزبائن**: points per order, discount per point, max discount %
2. **إعدادات نقاط المزودين**: daily target, points per target, commission reduction per point, reduction hours
3. **العروض الخاصة**: جدول + إضافة عرض (اختيار subscription, discount %)
4. **ملخص النقاط**: نقاط الزبائن + نقاط المزودين

## 4. السوق (index.html) — إضافة النقاط في الدفع

### في مودال الدفع (checkout-modal):
- بعد إدخال الهاتف، جلب نقاط الزبون
- عرض رصيد النقاط
- زر "استخدم النقاط للخصم"
- عند الاستخدام، حساب الخصم وتحديث المجموع
- عرض العروض الخاصة على الاشتراكات في البطاقة

### في submitOrder():
- إرسال `points_used` و `discount_amount` مع الطلب

## 5. لوحة تحكم المزود (vendor.html) — عرض النقاط

### في قسم النظرة العامة:
- بطاقة إحصائية جديدة: "نقاطي" تظهر رصيد النقاط

### في قسم الملف الشخصي:
- عرض رصيد النقاط
- زر "استبدال النقاط" → مودال لتحديد عدد النقاط → تخفيض العمولة لمدة معينة
- عرض التخفيضات النشطة (النسبة والمدة المتبقية)

## 6. تدفق العمل

### الزبون:
1. يضيف اشتراكات للسلة
2. يفتح مودال الدفع، يدخل اسمه وهاتفه
3. النظام يجلب نقاطه (إن وجدت)
4. يظهر رصيد النقاط مع عرض استخدم النقاط للخصم
5. يضغط على استخدام النقاط → يحسب الخصم ويحدث المجموع
6. يؤكد الطلب → ينشأ الطلب مع الخصم
7. بعد إتمام المزود للطلب → يمنح الزبون نقاط جديدة

### المزود:
1. يكمل طلب زبون → يكسب نقاط (للزبون) + النظام يتحقق من الtarget اليومي
2. إذا تجاوز الtarget اليومي → يكسب نقاط كبائع
3. في أي وقت → يستبدل نقاطه للحصول على تخفيض عمولة لمدة محددة

### الأدمن:
1. يضبط الإعدادات من لوحة التحكم
2. يضيف عروض خاصة على اشتراكات محددة
3. يشاهد ملخص النقاط

## 7. ترتيب التنفيذ

1. server.js: الجداول الجديدة + إعدادات النقاط endpoints
2. server.js: تعديل PATCH order status لمنح النقاط عند الإتمام
3. server.js: endpoints نقاط الزبون + نقاط المزود + العروض
4. admin.html: قسم نظام النقاط
5. index.html: إضافة النقاط في مودال الدفع
6. vendor.html: عرض نقاط المزود + استبدال النقاط
7. server.js: تعديل POST /api/orders لقبول الخصم
8. index.html: عرض العروض الخاصة
9. vendor.html: عرض تخفيض العمولة النشط في overview
