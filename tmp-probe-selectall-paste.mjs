import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const longText = readFileSync('x test.md', 'utf-8');

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  if (msg.text().includes('DEBUG-BI')) console.log('[log]', msg.text());
});

await page.goto('http://localhost:3000/dev-note');
await page.waitForTimeout(1500);

await page.click('[data-block-id="blk-body"] [data-block-content]');
await page.waitForTimeout(200);

await page.evaluate((text) => navigator.clipboard.writeText(text), longText);
await page.waitForTimeout(200);

await page.keyboard.press('Control+a');
await page.waitForTimeout(300);
await page.keyboard.press('Control+v');
await page.waitForTimeout(1500);

console.log('Errors captured:', errors.length);
errors.forEach((e, i) => console.log(`Error ${i + 1}:`, e.slice(0, 300)));

const storeCount = await page.evaluate(() => {
  const entity = window.__store.getState().entities.find(e => e.id === 'dev-note-fixture');
  return entity?.content?.length;
});
console.log('store block count after select-all + paste:', storeCount);

await page.screenshot({ path: 'tmp-selectall-screenshot.png', fullPage: false });
console.log('screenshot saved');

await browser.close();
