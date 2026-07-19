import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => { if (msg.text().includes('DEBUG')) console.log('[log]', msg.text()); });

await page.goto('http://localhost:3000/dev-note');
await page.waitForTimeout(1500);

await page.click('[data-block-id="blk-body"] [data-block-content]');
await page.waitForTimeout(200);

await page.evaluate(() => navigator.clipboard.writeText('line one\nline two'));
await page.waitForTimeout(200);

await page.keyboard.press('Control+a');
await page.waitForTimeout(300);
await page.keyboard.press('Control+v');
await page.waitForTimeout(1000);

console.log('Errors with SHORT single-line paste:', errors.length);
errors.forEach((e, i) => console.log(`Error ${i + 1}:`, e.slice(0, 200)));

const storeBlocks = await page.evaluate(() => {
  const entity = window.__store.getState().entities.find(e => e.id === 'dev-note-fixture');
  return entity?.content?.map(b => ({ id: b.id, type: b.type, content: b.content?.slice(0, 30) }));
});
console.log('store blocks after crash:', JSON.stringify(storeBlocks, null, 2));

const domBlockIds = await page.evaluate(() => {
  const host = document.querySelector('[contenteditable="true"]');
  return host ? Array.from(host.querySelectorAll('[data-block-id]')).map(b => b.getAttribute('data-block-id')) : null;
});
console.log('DOM block ids after crash:', JSON.stringify(domBlockIds));

await browser.close();
