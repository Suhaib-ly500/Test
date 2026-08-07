const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VAULT_FILE = path.join(__dirname, 'vault.enc');
const ITERATIONS = 200000;
const KEY_LENGTH = 32;
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;

function deriveKey(masterPassword, salt) {
  return crypto.pbkdf2Sync(masterPassword, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

function encryptVault(data, masterPassword) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterPassword, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(data);
  let encrypted = cipher.update(json, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  const payload = { salt: salt.toString('hex'), iv: iv.toString('hex'), tag: authTag.toString('hex'), data: encrypted };
  fs.writeFileSync(VAULT_FILE, JSON.stringify(payload), 'utf8');
}

function decryptVault(masterPassword) {
  if (!fs.existsSync(VAULT_FILE)) return null;
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
  } catch(err) {
    console.error("❌ ملف vault.enc تالف - احذفه واعد تشغيل setup");
    return null;
  }
  const salt = Buffer.from(payload.salt, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.tag, 'hex');
  const key = deriveKey(masterPassword, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

function vaultExists() {
  return fs.existsSync(VAULT_FILE);
}

function getMasterPassword() {
  const envPass = process.env.VAULT_PASSWORD;
  if (envPass && envPass.length >= 8) return envPass;
  if (!vaultExists()) return 'matrix-pro-default-vault-key-2026';
  if (!envPass) {
    console.error('❌ الخزنة موجودة لكن لم يتم تعيين VAULT_PASSWORD');
    console.error('   قم بتعيينها: $env:VAULT_PASSWORD="your-password"');
    process.exit(1);
  }
  if (envPass.length < 8) {
    console.error('❌ VAULT_PASSWORD يجب أن تكون 8 أحرف على الأقل');
    process.exit(1);
  }
  return envPass;
}

const DEFAULT_STRUCTURE = {
  ENCRYPTION_KEY: '',
  ADMIN_USERNAME: '',
  ADMIN_PASSWORD: '',
  ADMIN_PHONE: '',
  ADMIN_EMAIL: '',
  ADMIN_CITY: '',
  ADMIN_PHOTO: '',
  DB_PATH: 'matrix-pro.db',
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: '587',
  EMAIL_SECURE: 'false',
  EMAIL_USER: '',
  EMAIL_PASS: '',
  EMAIL_FROM_NAME: 'ماتريكس برو'
};

function load() {
  const masterPass = getMasterPassword();
  try {
    let data;
    if (!vaultExists()) {
      data = { ...DEFAULT_STRUCTURE, ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex') };
      encryptVault(data, masterPass);
    } else {
      data = decryptVault(masterPass);
    }
    // .env values override vault (API Keys move)
    const envOverrides = ['ENCRYPTION_KEY','EMAIL_USER','EMAIL_PASS','EMAIL_HOST','EMAIL_PORT','EMAIL_SECURE','EMAIL_FROM_NAME','DB_PATH'];
    envOverrides.forEach(key => {
      if (process.env[key] !== undefined && process.env[key] !== '') data[key] = process.env[key];
    });
    return data;
  } catch (e) {
    console.error('❌ فشل فك تشفير الخزنة. تحقق من كلمة مرور');
    process.exit(1);
  }
}

function save(data) {
  const masterPass = getMasterPassword();
  encryptVault(data, masterPass);
}

module.exports = { load, save, vaultExists, VAULT_FILE };
