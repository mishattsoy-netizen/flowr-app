/**
 * Proves the fact the whole editor design rests on:
 *   a native Selection CANNOT cross an editing-host boundary.
 *
 * Model A — each block its own contenteditable → selection stays in block 1.
 * Model B — one contenteditable host, plain-div blocks → selection spans them.
 *
 * Run: node scripts/probe-selection.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setContent(`
  <div id="A-wrap">
    <div class="blk" contenteditable="true" id="a1">First block text</div>
    <div class="blk" contenteditable="true" id="a2">Second block text</div>
  </div>
  <hr>
  <div id="B-wrap" contenteditable="true">
    <div class="blk" id="b1">First block text</div>
    <div class="blk" id="b2">Second block text</div>
  </div>
  <style>.blk{padding:8px;font:16px monospace}</style>
`);

async function dragSelect(fromSel, toSel) {
  const from = await page.locator(fromSel).boundingBox();
  const to = await page.locator(toSel).boundingBox();
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 60, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  return page.evaluate(() => {
    const s = window.getSelection();
    const blk = (n) => n?.parentElement?.closest?.('.blk')?.id;
    return {
      text: s.toString(),
      anchorBlock: blk(s.anchorNode),
      focusBlock: blk(s.focusNode),
      crossesBlocks: blk(s.anchorNode) !== blk(s.focusNode),
    };
  });
}

const a = await dragSelect('#a1', '#a2');
console.log('MODEL A (per-block contenteditable):', a);
if (a.crossesBlocks) throw new Error('UNEXPECTED: Model A crossed blocks.');

await page.evaluate(() => window.getSelection().removeAllRanges());

const b = await dragSelect('#b1', '#b2');
console.log('MODEL B (single host):            ', b);
if (!b.crossesBlocks) throw new Error('UNEXPECTED: Model B did NOT cross blocks.');

console.log('\n✓ Confirmed: only a single editing host permits cross-block selection.');
await browser.close();
