const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const srcAdmin = path.join(__dirname, 'src/app/admin');
const tempAdmin = path.join(__dirname, 'node_modules/temp_admin');
const srcApiAdmin = path.join(__dirname, 'src/app/api/admin');
const tempApiAdmin = path.join(__dirname, 'node_modules/temp_api_admin');
const srcComponentsAdmin = path.join(__dirname, 'src/components/admin');
const tempComponentsAdmin = path.join(__dirname, 'node_modules/temp_components_admin');

console.log('[Build Wrapper] Preparing production build...');

// 1. Move folders out of src/app to exclude them from compiling
let movedAdmin = false;
let movedApiAdmin = false;
let movedComponentsAdmin = false;

try {
  if (fs.existsSync(srcAdmin)) {
    fs.renameSync(srcAdmin, tempAdmin);
    movedAdmin = true;
    console.log('[Build Wrapper] Temporarily moved src/app/admin out of source tree.');
  }
  if (fs.existsSync(srcApiAdmin)) {
    fs.renameSync(srcApiAdmin, tempApiAdmin);
    movedApiAdmin = true;
    console.log('[Build Wrapper] Temporarily moved src/app/api/admin out of source tree.');
  }
  if (fs.existsSync(srcComponentsAdmin)) {
    fs.renameSync(srcComponentsAdmin, tempComponentsAdmin);
    movedComponentsAdmin = true;
    console.log('[Build Wrapper] Temporarily moved src/components/admin out of source tree.');
  }
} catch (e) {
  console.error('[Build Wrapper] Failed to move folders:', e);
}

// 2. Run next build
let buildStatus = 0;
try {
  const result = spawnSync('npx', ['next', 'build'], {
    stdio: 'inherit',
    shell: true
  });
  buildStatus = result.status;
} catch (e) {
  console.error('[Build Wrapper] Next.js build execution failed:', e);
  buildStatus = 1;
}

// 3. Restore folders (runs ALWAYS, even if build fails)
console.log('[Build Wrapper] Restoring admin workspace directories...');
try {
  if (movedAdmin && fs.existsSync(tempAdmin)) {
    fs.renameSync(tempAdmin, srcAdmin);
    console.log('[Build Wrapper] Restored src/app/admin.');
  }
  if (movedApiAdmin && fs.existsSync(tempApiAdmin)) {
    fs.renameSync(tempApiAdmin, srcApiAdmin);
    console.log('[Build Wrapper] Restored src/app/api/admin.');
  }
  if (movedComponentsAdmin && fs.existsSync(tempComponentsAdmin)) {
    fs.renameSync(tempComponentsAdmin, srcComponentsAdmin);
    console.log('[Build Wrapper] Restored src/components/admin.');
  }
} catch (e) {
  console.error('[Build Wrapper] Failed to restore folders:', e);
}

// 4. Run postbuild actions if build succeeded
if (buildStatus === 0) {
  console.log('[Build Wrapper] Running postbuild tasks...');
  try {
    fs.cpSync('public', '.next/standalone/public', { recursive: true, force: true });
    fs.cpSync('.next/static', '.next/standalone/.next/static', { recursive: true, force: true });
    fs.cpSync('src/lib/bot/prompts', '.next/standalone/src/lib/bot/prompts', { recursive: true, force: true });
    console.log('[Build Wrapper] Static files and prompts copied to standalone.');
  } catch (e) {
    console.error('[Build Wrapper] Postbuild tasks failed:', e);
    buildStatus = 1;
  }
}

process.exit(buildStatus);
