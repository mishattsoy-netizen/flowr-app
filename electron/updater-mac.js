// Custom macOS auto-updater used in place of electron-updater's MacUpdater.
//
// electron-updater's MacUpdater refuses to apply an update unless the app is
// code-signed (it validates the new bundle's signature against the running
// one before swapping). Flowr ships unsigned on macOS (no Apple Developer
// account), so that path is dead on arrival there — it always errors out
// silently. This module replaces it with a from-scratch flow: poll GitHub
// Releases directly, download the .zip asset, and swap the .app bundle via a
// detached helper script that outlives this process. It matches the same
// event/method shape electron-updater exposes (checkForUpdates,
// quitAndInstall, 'update-available'/'update-downloaded'/'download-progress'/
// 'error' events) so electron/main.js and the renderer's flowrUpdater bridge
// need no changes.

const { app } = require('electron');
const { EventEmitter } = require('events');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REPO_OWNER = 'mishattsoy-netizen';
const REPO_NAME = 'flowr-app-releases';
const LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'Flowr');
const LOG_FILE = path.join(LOG_DIR, 'updater.log');

function log(...args) {
  const line = `[MacUpdater ${new Date().toISOString()}] ${args.join(' ')}`;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) { /* best-effort */ }
}

// GET with redirect following (GitHub release asset downloads redirect to S3).
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        httpsGet(res.headers.location, headers).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  const res = await httpsGet(url, {
    'User-Agent': 'flowr-app-updater',
    Accept: 'application/vnd.github+json',
  });
  return new Promise((resolve, reject) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    res.on('error', reject);
  });
}

function downloadToFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    httpsGet(url, { 'User-Agent': 'flowr-app-updater' }).then((res) => {
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const out = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress && total) {
          onProgress({
            percent: (received / total) * 100,
            transferred: received,
            total,
          });
        }
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      out.on('error', reject);
      res.on('error', reject);
    }, reject);
  });
}

// Walk up from the running executable to find the enclosing `*.app` bundle
// root, rather than assuming /Applications — users can run from Downloads.
function findAppBundleRoot(execPath) {
  let dir = execPath;
  while (dir && dir !== path.dirname(dir)) {
    if (dir.endsWith('.app')) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

class MacUpdater extends EventEmitter {
  constructor() {
    super();
    this._downloadedZipPath = null;
  }

  async checkForUpdates() {
    log('checkForUpdates invoked');
    const release = await fetchJson(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
    );
    if (!release || !release.tag_name) {
      throw new Error('Could not read latest release from GitHub');
    }

    const currentVersion = app.getVersion();
    const latestVersion = release.tag_name;
    log(`current=${currentVersion} latest=${latestVersion}`);

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      log('No update available');
      return null;
    }

    const asset = (release.assets || []).find((a) => a.name.endsWith('.zip'));
    if (!asset) {
      throw new Error('No .zip asset found in latest release');
    }

    this.emit('update-available', { version: latestVersion });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-update-'));
    const zipPath = path.join(tmpDir, asset.name);

    await downloadToFile(asset.browser_download_url, zipPath, (progress) => {
      this.emit('download-progress', progress);
    });

    this._downloadedZipPath = zipPath;
    log(`Downloaded update to ${zipPath}`);
    this.emit('update-downloaded', { version: latestVersion });
    return { version: latestVersion };
  }

  quitAndInstall() {
    if (!this._downloadedZipPath) {
      log('quitAndInstall called with no downloaded update — ignoring');
      return;
    }

    const appBundle = findAppBundleRoot(process.execPath);
    if (!appBundle) {
      log('Could not resolve running .app bundle path — aborting install');
      this.emit('error', new Error('Could not resolve app bundle path'));
      return;
    }

    const zipPath = this._downloadedZipPath;
    const pid = process.pid;
    const swapTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-swap-'));
    const scriptPath = path.join(swapTmpDir, 'swap.sh');

    // Runs detached, after this process has exited, so it can safely replace
    // the bundle currently backing our own running executable. `ditto -x -k`
    // (not `unzip`) preserves the .app's extended attrs/resource forks.
    const script = `#!/bin/bash
exec >> "${LOG_FILE}" 2>&1
echo "[swap $(date)] waiting for pid ${pid} to exit"
while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done
echo "[swap] extracting ${zipPath}"
ditto -x -k "${zipPath}" "${swapTmpDir}/extracted"
NEW_APP=$(find "${swapTmpDir}/extracted" -maxdepth 1 -name "*.app" | head -n 1)
if [ -z "$NEW_APP" ]; then
  echo "[swap] ERROR: no .app found in extracted update"
  exit 1
fi
echo "[swap] replacing ${appBundle} with $NEW_APP"
rm -rf "${appBundle}"
mv "$NEW_APP" "${appBundle}"
xattr -cr "${appBundle}"
echo "[swap] relaunching"
open "${appBundle}"
rm -rf "${swapTmpDir}"
`;

    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    log(`Spawning swap script ${scriptPath}`);

    const child = spawn('/bin/bash', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    app.quit();
  }
}

const macUpdater = new MacUpdater();
macUpdater.autoDownload = true;
macUpdater.logger = {
  info: (msg) => log('[INFO]', msg),
  warn: (msg) => log('[WARN]', msg),
  error: (msg) => log('[ERROR]', msg),
};

// Mirror electron-updater's checkForUpdatesAndNotify() name used by main.js.
macUpdater.checkForUpdatesAndNotify = () => macUpdater.checkForUpdates();

module.exports = { autoUpdater: macUpdater };
