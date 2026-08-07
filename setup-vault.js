require('dotenv').config({
    path: require('path').join(__dirname, '..', '.env')
});

const vault = require('./vault');
const crypto = require('crypto');

const args = process.argv.slice(2);

function maskSecret(val) {
  const s = String(val);
  return s.length > 8 ? s.slice(0, 4) + '...' + s.slice(-4) : '****';
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
أداة إدارة الخزنة الآمنة - Matrix Pro Vault
===============================================
ملاحظة: قيم .env لها أولوية على vault.enc
الاستخدام:
  node setup-vault.js                     # عرض الإعدادات الحالية
  node setup-vault.js --set KEY=VALUE     # تعيين قيمة (مثال: --set ADMIN_PASSWORD=myPass)
  node setup-vault.js --init              # إعادة تعيين الخزنة بمفاتيح جديدة
  node setup-vault.js --show              # عرض جميع الإعدادات (مخفي لكلمة المرور)

المتغيرات المتاحة:
  ENCRYPTION_KEY        - مفتاح تشفير البيانات (يُولد تلقائياً)
  ADMIN_USERNAME        - اسم مستخدم المشرف (admin)
  ADMIN_PASSWORD        - كلمة مرور المشرف
  DB_PATH               - مسار قاعدة البيانات
  EMAIL_HOST            - خادم البريد الإلكتروني
  EMAIL_PORT            - منفذ البريد
  EMAIL_SECURE          - true/false
  EMAIL_USER            - بريد المستخدم
  EMAIL_PASS            - كلمة مرور البريد
  EMAIL_FROM_NAME       - اسم المرسل

ملاحظة:
  - كلمة مرور الخزنة تمر عبر متغير البيئة VAULT_PASSWORD
  - مثال: $env:VAULT_PASSWORD="mySecret"; node server.js
`);
  process.exit(0);
}

function init() {
  const data = {
    ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
ADMIN_USERNAME: '',
ADMIN_PASSWORD: '',
    DB_PATH: 'matrix-pro.db',
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: '587',
    EMAIL_SECURE: 'false',
    EMAIL_USER: '',
    EMAIL_PASS: '',
    EMAIL_FROM_NAME: 'ماتريكس برو'
  };
  vault.save(data);
  console.log('✅ تم إنشاء خزنة جديدة بنجاح');
  console.log('   ENCRYPTION_KEY:', maskSecret(data.ENCRYPTION_KEY));
  console.log('   ADMIN_USERNAME:', data.ADMIN_USERNAME);
  console.log('   ADMIN_PASSWORD:', maskSecret(data.ADMIN_PASSWORD));
  console.log('');
  //console.log('⚠️  احفظ هذه القيم في مكان آمن!');
 // console.log('💡 استخدم: $env:VAULT_PASSWORD="your-password"; node server.js');
}

if (args.includes('--init')) {
  const envPass = process.env.VAULT_PASSWORD;
  if (!envPass || envPass.length < 8) {
    console.log('⚠️  لإنشاء خزنة آمنة، استخدم:');
    console.log('   $env:VAULT_PASSWORD="كلمة_مرور_قوية"; node setup-vault.js --init');
 console.log('❌ لا يمكن إنشاء الخزنة بدون تعيين VAULT_PASSWORD.');
process.exit(1);
  }
  init();
  process.exit(0);
}

if (args.includes('--show')) {
  if (!vault.vaultExists()) {
    console.log('❌ الخزنة غير موجودة. أنشئها أولاً: node setup-vault.js --init');
    process.exit(1);
  }
  const data = vault.load();
  for (const [k, v] of Object.entries(data)) {
    if (k.includes('PASS') || k.includes('KEY') || k.includes('SECRET')) {
      const val = String(v);
      console.log(`  ${k}: ${val.length > 8 ? val.slice(0, 4) + '...' + val.slice(-4) : '****'}`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  }
  process.exit(0);
}

const setArgs = args.filter(a => a.startsWith('--set='));
if (setArgs.length) {
  const data = vault.vaultExists() ? vault.load() : {};
  for (const arg of setArgs) {
    const eq = arg.indexOf('=');
    const key = arg.slice(6, eq);
    const val = arg.slice(eq + 1);
    data[key] = val;
  }
  vault.save(data);
  console.log('✅ تم حفظ الإعدادات بنجاح');
  process.exit(0);
}

if (!vault.vaultExists()) {
  console.log('🔐 الخزنة غير موجودة. جاري إنشاء خزنة جديدة...');
  init();
  process.exit(0);
}

const data = vault.load();
console.log('الإعدادات الحالية في الخزنة:');
for (const [k, v] of Object.entries(data)) {
  if (k.includes('PASS') || k.includes('KEY') || k.includes('SECRET')) {
    const val = String(v);
    console.log(`  ${k}: ${val.length > 8 ? val.slice(0, 4) + '...' + val.slice(-4) : '****'}`);
  } else {
    console.log(`  ${k}: ${v}`);
  }
}
console.log('');
console.log('لتعديل قيمة: node setup-vault.js --set KEY=VALUE');
console.log('لعرض الكل:    node setup-vault.js --show');
