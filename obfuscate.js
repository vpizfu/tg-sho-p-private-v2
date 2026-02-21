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

function getJsFiles(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...getJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const FILES = getJsFiles('js-files');

FILES.forEach(filePath => {
  const source = fs.readFileSync(filePath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, OPTIONS);
  fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
  console.log('[obfuscate] done:', filePath);
});

