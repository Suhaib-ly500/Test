const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const SRC = __dirname;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// إعدادات التعمية القصوى
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 1,
  debugProtection: false,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 5,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1,
  transformObjectKeys: true,
  unicodeEscapeSequence: true
};

function obfuscateFile(inputPath, outputPath) {
  const code = fs.readFileSync(inputPath, 'utf8');
  console.log(`  📄 ${path.basename(inputPath)} → تعمية...`);
  const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
  fs.writeFileSync(outputPath, result.getObfuscatedCode(), 'utf8');
  const originalSize = Buffer.byteLength(code, 'utf8');
  const obfSize = Buffer.byteLength(result.getObfuscatedCode(), 'utf8');
  console.log(`     ✅ ${(originalSize/1024).toFixed(1)}KB → ${(obfSize/1024).toFixed(1)}KB`);
}

async function processHTML(inputPath, outputPath) {
  let html = fs.readFileSync(inputPath, 'utf8');
  console.log(`  📄 ${path.basename(inputPath)} → تعمية + تصغير...`);

  // استخراج كل <script> blocks
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const originalScript = match[1].trim();
    if (!originalScript) continue;

    // تجاهل السكربتات التي تستورد من مصادر خارجية
    if (match[0].includes('src=')) continue;

    try {
      const obfuscated = JavaScriptObfuscator.obfuscate(originalScript, {
        ...OBFUSCATOR_OPTIONS,
        disableConsoleOutput: false // نترك console للتشغيل
      }).getObfuscatedCode();

      // استبدال النص الأصلي بالنص المعمى
      html = html.replace(originalScript, obfuscated);
    } catch (e) {
      /*console.log(`     ⚠️  فشل تعمية في ${path.basename(inputPath)}: ${e.message}`);*/
    }
  }

  // تصغير HTML
  try {
    html = await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyCSS: true,
      minifyJS: false, // مش معمى بالفعل
      useShortDoctype: true
    });
  } catch (e) {
  /*  console.log(`     ⚠️  فشل تصغير HTML: ${e.message}`);*/
  }

  fs.writeFileSync(outputPath, html, 'utf8');
  const originalSize = Buffer.byteLength(fs.readFileSync(inputPath, 'utf8'), 'utf8');
  const newSize = Buffer.byteLength(html, 'utf8');
  /*console.log(`     ✅ ${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB`);*/
}

async function build() {
  /*console.log('');
  console.log('🔐 ========================================');
  console.log('🔐   Matrix Pro - Build System');
  console.log('🔐   تعمية وحماية الكود بالكامل');
  console.log('🔐 ========================================');
  console.log('');*/

  // إنشاء مجلد dist
  ensureDir(DIST);
  ensureDir(path.join(DIST, 'uploads'));
  ensureDir(path.join(DIST, 'ssl'));

  // 1. تعمية ملفات السيرفر
  console.log('📦 تعمية ملفات السيرفر:');
  console.log('──────────────────────────────');

  const serverFiles = [
    'server.js',
    'vault.js',
    'setup-vault.js'
  ];

  for (const file of serverFiles) {
    const srcPath = path.join(SRC, file);
    if (fs.existsSync(srcPath)) {
      obfuscateFile(srcPath, path.join(DIST, file));
    }
  }

  // 2. تعمية وتصغير ملفات HTML
 /* console.log('');
  console.log('📦 تعمية وتصغير ملفات HTML:');
  console.log('──────────────────────────────');*/

  const htmlFiles = [
    'index.html',
    'admin.html',
    'vendor.html',
    'terms.html',
    'privacy.html',
    'setup.html'
  ];

  for (const file of htmlFiles) {
    const srcPath = path.join(SRC, file);
    if (fs.existsSync(srcPath)) {
      await processHTML(srcPath, path.join(DIST, file));
    }
  }

  // 3. نسخ الملفات الثابتة
/*  console.log('');
  console.log('📦 نسخ الملفات الثابتة:');
  console.log('──────────────────────────────');*/

  const staticFiles = [
    'package.json',
    '.env',
    '.gitignore',
    'logo.png',
    'favicon.ico'
  ];

  for (const file of staticFiles) {
    const srcPath = path.join(SRC, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(DIST, file));
      /*console.log(`  ✅ ${file}`);*/
    }
  }

  // نسخ مجلد css المحلي (Tailwind)
  const cssSrc = path.join(SRC, 'css');
  if (fs.existsSync(cssSrc)) {
    ensureDir(path.join(DIST, 'css'));
    const cssFiles = fs.readdirSync(cssSrc);
    for (const f of cssFiles) {
      const fPath = path.join(cssSrc, f);
      if (fs.statSync(fPath).isFile()) {
        fs.copyFileSync(fPath, path.join(DIST, 'css', f));
      }
    }
  }

  // نسخ مجلد uploads إن وجد
  const uploadsSrc = path.join(SRC, 'uploads');
  if (fs.existsSync(uploadsSrc)) {
    const files = fs.readdirSync(uploadsSrc);
    for (const f of files) {
      const fPath = path.join(uploadsSrc, f);
      if (fs.statSync(fPath).isFile()) {
        fs.copyFileSync(fPath, path.join(DIST, 'uploads', f));
      }
    }
  /*  console.log(`  ✅ uploads/ (${files.length} files)`);*/
  }

  // 4. إنشاء script تشغيل للـ dist
  const runScript = `@echo off
echo.
echo 🔐 Matrix Pro - Protected Build
echo ====================================
echo.
if "%VAULT_PASSWORD%"=="" (
  echo ⚠️  يرجى تعيين VAULT_PASSWORD
  echo    مثال:
  echo    set VAULT_PASSWORD=your-password
  echo    start.bat
  echo.
  pause
  exit /b
)
echo ✅ جاري تشغيل المنصة...
node server.js
pause
`;
  fs.writeFileSync(path.join(DIST, 'start.bat'), runScript, 'utf8');
 /* console.log('  ✅ start.bat');*/

  // PowerShell run script
  const psScript = `$env:VAULT_PASSWORD = Read-Host "🔐 أدخل كلمة مرور الخزنة" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:VAULT_PASSWORD)
$env:VAULT_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
Write-Host "✅ جاري تشغيل المنصة..." -ForegroundColor Green
node server.js
`;
  fs.writeFileSync(path.join(DIST, 'start.ps1'), psScript, 'utf8');
 /* console.log('  ✅ start.ps1');*/

  // Summary
/*  console.log('');
  console.log(' ========================================');
  console.log('✅  BUILD COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('📂 المخرجات في: dist/');
  console.log('🚀 للتشغيل:');
  console.log('   cd dist');
  console.log('   $env:VAULT_PASSWORD="your-pass"; node server.js');
  console.log('   أو استخدم start.bat');
  console.log('');*/
}

build().catch(e => {
 /* console.error('❌ فشل البناء:', e.message);*/
  process.exit(1);
});
