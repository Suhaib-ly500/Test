// نقل الصور الموجودة في مجلد uploads إلى جدول files في قاعدة البيانات
// التشغيل: node migrate-uploads-to-db.js
const fs = require('fs');
const path = require('path');
const uploadRepository = require('./src/infrastructure/persistence/repositories/uploadRepository');

(async () => {
  const dir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(dir)) {
    console.log('مجلد uploads غير موجود - لا يوجد ما يُنقل');
    process.exit(0);
  }

  const MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };

  const files = fs.readdirSync(dir).filter((f) => {
    const full = path.join(dir, f);
    return fs.statSync(full).isFile();
  });

  let ok = 0;
  let skipped = 0;
  for (const f of files) {
    try {
      if (await uploadRepository.getFile(f)) {
        skipped++;
        continue;
      }
      const data = fs.readFileSync(path.join(dir, f));
      const ext = path.extname(f).toLowerCase();
      await uploadRepository.saveFile(f, MIME_BY_EXT[ext] || 'application/octet-stream', data);
      ok++;
    } catch (e) {
      console.log('خطأ في', f, '-', e.message);
    }
  }
  console.log(`تم نقل ${ok} صورة إلى قاعدة البيانات، و${skipped} كانت موجودة مسبقاً`);
})().catch((e) => {
  console.error('فشل تنفيذ السكربت:', e.message);
  process.exit(1);
});
