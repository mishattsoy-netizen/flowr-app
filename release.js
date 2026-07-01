const fs = require('fs');
const { execSync } = require('child_process');

function log(msg) {
  console.log(`\n=== [RELEASE] ${msg} ===`);
}

function run(cmd) {
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

// 1. Read package.json
const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;

// 2. Determine new version
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
  // 3. Commit version bump + any other pending tracked changes
  log('Staging and committing release changes...');
  run(`git add -u`); // stage all tracked modified/deleted files
  // Only commit if there's actually something staged
  const staged = execSync('git diff --cached --name-only').toString().trim();
  if (staged) {
    run(`git commit -m "chore: release v${newVersion}"`);
  } else {
    console.log('Nothing new to commit — version already up to date.');
  }

  // 4. Create and push the git tag
  log(`Creating and pushing git tag v${newVersion}...`);
  try {
    run(`git tag -d v${newVersion}`);
  } catch (e) {}
  run(`git tag v${newVersion}`);
  try {
    run(`git push origin :refs/tags/v${newVersion}`);
  } catch (e) {}
  run(`git push origin v${newVersion}`);

  // 5. Push the commit to GitHub. This triggers:
  //    - the release-desktop.yml CI workflow, which builds and publishes the
  //      Windows/macOS/Linux desktop installers as GitHub Release assets
  //    - the Vercel deployment for the web app
  //    Building/publishing locally here as well would race the CI workflow
  //    against this machine's build and can clobber assets the other already
  //    uploaded to the same release — so this script leaves all desktop
  //    packaging and publishing to CI.
  log('Pushing commit to GitHub to trigger CI desktop build/publish and Vercel web deployment...');
  run(`git push origin main`);

  log(`SUCCESS! v${newVersion} pushed. Watch the "Build and Publish Desktop App" GitHub Action for build/publish progress across all platforms.`);
} catch (err) {
  console.error('\nRelease failed with error:', err.message);
  process.exit(1);
}
