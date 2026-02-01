import fs from 'fs';

const path = 'version.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
data.version = (data.version || 0) + 1;
fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('New version:', data.version);
