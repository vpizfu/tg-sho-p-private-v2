const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const OPTIONS = {
  compact: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  rotateStringArray: true,
  shuffleStringArray: true,
};

const FILES = [
  'js-files/core.js',
  'js-files/products.js',
  'js-files/modals.js',
  'js-files/ui_common.js',
  'js-files/screens/cart.js',
  'js-files/screens/sale.js',
  'js-files/screens/profile.js',
  'js-files/screens/about.js',
];

FILES.forEach(filePath => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn('[obfuscate] not found:', filePath);
    return;
  }
  const source = fs.readFileSync(fullPath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, OPTIONS);
  fs.writeFileSync(fullPath, result.getObfuscatedCode(), 'utf8');
  console.log('[obfuscate] done:', filePath);
});

