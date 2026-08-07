// Obfuscate readable sources from js-src/ into served obfuscated files in js/.
// Usage: node obfuscate-js.js
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'js-src');
const OUT_DIR = path.join(ROOT, 'js');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 1,
  debugProtection: false,
  disableConsoleOutput: false,
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

const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js')).sort();
for (const f of files) {
  const code = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  const big = Buffer.byteLength(code, 'utf8') > 40 * 1024;
  const options = big ? {
    ...OBFUSCATOR_OPTIONS,
    deadCodeInjection: false,
    controlFlowFlatteningThreshold: 0.5,
    splitStrings: false,
    stringArrayThreshold: 0.8,
    stringArrayWrappersCount: 3,
    stringArrayWrappersParametersMaxCount: 3
  } : OBFUSCATOR_OPTIONS;
  const result = JavaScriptObfuscator.obfuscate(code, options);
  fs.writeFileSync(path.join(OUT_DIR, f), result.getObfuscatedCode(), 'utf8');
  const obfSize = Buffer.byteLength(result.getObfuscatedCode(), 'utf8');
  console.log(`✅ ${f}${big ? ' (balanced)' : ''}: ${(Buffer.byteLength(code, 'utf8') / 1024).toFixed(1)}KB → ${(obfSize / 1024).toFixed(1)}KB`);
}
console.log('Done.');
