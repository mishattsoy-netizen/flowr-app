const path = require('path');
const next = require('next');
const { createServer } = require('http');

// Start Next.js programmatically
const port = process.env.PORT || 3000;

// The app.asar directory is one level up from this file's packaged location
// (which is in resources/app.asar.unpacked/electron/runner.js)
const appPath = path.join(__dirname, '..');

const nextApp = next({
  dev: false,
  dir: appPath
});
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`Next.js production server listening on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to start Next.js server:', err);
  process.exit(1);
});
