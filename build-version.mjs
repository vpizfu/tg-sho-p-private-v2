import fs from 'fs';

const versionJson = JSON.parse(fs.readFileSync('version.json', 'utf8'));
const v = String(versionJson.version);

let tpl = fs.readFileSync('index.template.html', 'utf8');
tpl = tpl.replace(/__APP_VERSION__/g, v);

fs.writeFileSync('index.html', tpl, 'utf8');
console.log('index.html built with version', v);
