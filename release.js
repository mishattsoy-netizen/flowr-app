const fs = require('fs');
const { execSync } = require('child_process');

function log(msg) {
  console.log(`\n=== [RELEASE] ${msg} ===`);
}

function run(cmd) {
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

// 1. Verify GH_TOKEN is set
if (!process.env.GH_TOKEN) {
  console.error('\nError: GH_TOKEN environment variable is not set!');
  console.error('Please set it in PowerShell before running this script:');
  console.error('  $env:GH_TOKEN="your_github_token"\n');
  process.exit(1);
}

// 2. Read package.json
const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;

// 3. Determine new version
let newVersion = process.argv[2];
if (!newVersion) {
  // Auto patch bump: e.g. 1.0.0 -> 1.0.1
  const parts = oldVersion.split('.').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1;
    newVersion = parts.join('.');
  } else {
    newVersion = oldVersion;
  }
}

log(`Bumping version: ${oldVersion} -> ${newVersion}`);
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

try {
  // 4. Commit version bump
  log('Staging and committing version bump...');
  run(`git add package.json`);
  run(`git commit -m "chore: release v${newVersion}"`);

  // 5. Build Next.js
  log('Compiling Next.js frontend...');
  run('npm run build');

  // 6. Build and publish Electron app
  log('Packaging and publishing Electron app to GitHub Releases...');
  run('npx electron-builder --publish always');

  // 7. Push to GitHub (triggers Vercel deploy)
  log('Pushing commit to GitHub to trigger Vercel web deployment...');
  run('git push origin main');

  log(`SUCCESS! Version v${newVersion} is published on GitHub (Desktop installer) and deployed on Vercel (Web app)!`);
} catch (err) {
  console.error('\nRelease failed with error:', err.message);
  process.exit(1);
}
