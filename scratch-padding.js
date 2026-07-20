const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/**/*.{tsx,ts,jsx,js}', { cwd: process.cwd() });
let filesChanged = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let changed = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('popup-glass-small')) {
      const orig = lines[i];
      lines[i] = lines[i].replace(/\b(p-[0-9.]+|px-[0-9.]+|py-[0-9.]+|pt-[0-9.]+|pb-[0-9.]+|pl-[0-9.]+|pr-[0-9.]+)\b\s*/g, '');
      if (orig !== lines[i]) changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    filesChanged++;
    console.log('Updated', file);
  }
}
console.log('Total files updated:', filesChanged);
