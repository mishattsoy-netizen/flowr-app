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
  // 4. Commit version bump + any other pending tracked changes
  log('Staging and committing release changes...');
  run(`git add -u`); // stage all tracked modified/deleted files
  // Only commit if there's actually something staged
  const staged = execSync('git diff --cached --name-only').toString().trim();
  if (staged) {
    run(`git commit -m "chore: release v${newVersion}"`);
  } else {
    console.log('Nothing new to commit — version already up to date.');
  }

  // 5. Build Next.js
  log('Compiling Next.js frontend...');
  run('npm run build');

  // 5.5 Create and push Git tag first (required for "releaseType: release" to succeed)
  log(`Creating and pushing git tag v${newVersion}...`);
  try {
    run(`git tag -d v${newVersion}`);
  } catch (e) {}
  run(`git tag v${newVersion}`);
  try {
    run(`git push origin :refs/tags/v${newVersion}`);
  } catch (e) {}
  run(`git push origin v${newVersion}`);

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
