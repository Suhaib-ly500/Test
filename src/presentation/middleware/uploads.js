const path = require('path');
const multer = require('multer');
const { config } = require('../../infrastructure/config');
const uploadRepository = require('../../infrastructure/persistence/repositories/uploadRepository');

const ALLOWED_MIME = {
  'image/jpeg': 'jpg/jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

// Signatures: null bytes are wildcards (RIFF/WEBP header)
const MAGIC = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]
};

function matchesMagic(buf, mime) {
  const sig = MAGIC[mime];
  if (!sig || buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (sig[i] !== null && buf[i] !== sig[i]) return false;
  }
  return true;
}

function makeStorage(prefix) {
  return {
    _handleFile(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = (prefix ? prefix + '-' : '') + unique + ext;
      const chunks = [];
      let received = 0;
      let done = false;
      const finish = (err, info) => {
        if (done) return;
        done = true;
        if (err) return cb(err);
        cb(null, info);
      };
      file.stream.on('data', (data) => {
        received += data.length;
        if (received > config.maxFileSize) {
          finish(new Error('حجم الملف أكبر من الحد المسموح'));
          try { file.stream.destroy(); } catch (e) {}
          return;
        }
        chunks.push(data);
      });
      file.stream.on('error', () => finish(new Error('فشل قراءة الملف')));
      file.stream.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (!matchesMagic(buf, file.mimetype)) {
          return finish(new Error('المحتوى ليس صورة صحيحة'));
        }
        uploadRepository.saveFile(filename, file.mimetype, buf).then(() => {
          finish(null, {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            filename,
            size: received
          });
        }).catch(() => finish(new Error('فشل حفظ الملف')));
      });
    },
    _removeFile(req, file, cb) {
      if (file.filename) {
        uploadRepository.removeFile(file.filename).catch(() => {});
      }
      cb(null);
    }
  };
}

const imageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (!ALLOWED_MIME[file.mimetype]) return cb(new Error('نوع الملف غير مسموح. استخدم JPG, PNG, GIF, WEBP فقط'));
  if (!allowedExt.includes(ext)) return cb(new Error('امتداد الملف غير مسموح'));
  cb(null, true);
};

const upload = multer({ storage: makeStorage(''), limits: { fileSize: config.maxFileSize }, fileFilter: imageFilter });
const complaintUpload = multer({ storage: makeStorage('complaint'), limits: { fileSize: config.maxFileSize }, fileFilter: imageFilter });
const verifyUpload = multer({ storage: makeStorage('verify'), limits: { fileSize: config.maxFileSize }, fileFilter: imageFilter });

module.exports = { upload, complaintUpload, verifyUpload };
