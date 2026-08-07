const path = require('path');
const fs = require('fs');
const selfsigned = require('selfsigned');
const vault = require('../../vault');

const ROOT = path.join(__dirname, '..', '..');
const vaultData = vault.load();

const config = {
  root: ROOT,
  port: parseInt(process.env.PORT) || 3000,
  httpsPort: parseInt(process.env.HTTPS_PORT) || 3443,
  sslDir: path.join(ROOT, 'ssl'),
  encryptionKey: vaultData.ENCRYPTION_KEY || require('crypto').randomBytes(32).toString('hex'),
  adminUsername: vaultData.ADMIN_USERNAME || '',
  adminPassword: vaultData.ADMIN_PASSWORD || '',
  uploadsDir: path.join(ROOT, process.env.UPLOADS_DIR || 'uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  supportEmail: process.env.SUPPORT_EMAIL || 'bwrwys150@gmail.com',
  vaultData
};

process.env.ENCRYPTION_KEY = config.encryptionKey;

function ensureSSLCert() {
  if (!fs.existsSync(config.sslDir)) fs.mkdirSync(config.sslDir, { recursive: true });
  const keyPath = path.join(config.sslDir, 'key.pem');
  const certPath = path.join(config.sslDir, 'cert.pem');
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    try {
      const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 3650, keySize: 2048, algorithm: 'sha256' });
      fs.writeFileSync(keyPath, pems.private);
      fs.writeFileSync(certPath, pems.cert);
    } catch (e) {
      console.error('فشل إنشاء شهادة SSL:', e.message);
      return null;
    }
  }
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

module.exports = { config, ensureSSLCert };