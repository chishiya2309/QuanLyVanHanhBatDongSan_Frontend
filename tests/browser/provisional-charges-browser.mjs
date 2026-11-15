import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.PROVISIONAL_PREVIEW_URL || 'http://127.0.0.1:5179';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/provisional-charges'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(), checks = [], errors = [], businessCalls = [];
page.on('pageerror', e => errors.push(e.message));
// Preserve the isolated production-component entry on a real document reload.
const previewHtml = await (await fetch(base + '/tests/fixtures/provisional-charges-preview.html')).text();
await page.setRequestInterception(true);
page.on('request', request => {
  const url = new URL(request.url());
  if (request.isNavigationRequest() && url.origin === new URL(base).origin && ['/provisional-charges', '/portal/provisional-charges'].includes(url.pathname))
    void request.respond({ status: 200, contentType: 'text/html', body: previewHtml });
  else void request.continue();
});
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const text = value => page.waitForFunction(value => document.body.innerText.includes(value), {}, value);
const ready = () => page.waitForSelector('[data-testid=provisional-total]');
async function open(state = 'full', role = 'HOST', entry = 'detail') {
  await page.goto(`${base}/tests/fixtures/provisional-charges-preview.html?state=${state}&role=${role}&entry=${entry}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.pc-page h1');
}
async function click(label) {
  await page.waitForFunction(label => [...document.querySelectorAll('.pc-page button')].some(b => b.textContent.trim() === label && !b.disabled), {}, label);
  await page.evaluate(label => [...document.querySelectorAll('.pc-page button')].find(b => b.textContent.trim() === label && !b.disabled).click(), label);
}
async function select(selector, value) { await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, selector); await page.select(selector, value); }
async function shot(name) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); }
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS ' + name); }
async function layout() {
  const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    controls: [...document.querySelectorAll('.pc-page button, .pc-page select, .pc-page summary')].filter(n => n.getClientRects().length).map(n => ({ text: n.textContent.slice(0, 50), height: n.getBoundingClientRect().height })) }));
  assert.ok(result.scroll <= result.width, `Page overflow ${result.scroll}/${result.width}`);
  assert.ok(result.controls.every(c => c.height >= 44), JSON.stringify(result.controls.filter(c => c.height < 44)));
}
async function recordCalls() { businessCalls.push(...await page.evaluate(() => window.__uc39Calls.filter(c => c.path.includes('/provisional-charges/')))); }

try {
  for (const width of [390, 768, 1440, 1920]) await check(`FULL ledger ${width}px: labels, 44px targets, no page overflow`, async () => {
    await page.setViewport({ width, height: 900 }); await open(); await ready(); await layout(); await shot('full-' + width); await recordCalls();
  });
  await check('Long amounts, exact decimals and long missing reasons fit mobile and desktop', async () => {
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 900 }); await open('long'); await ready();
      await text('9.007.199.254.740.993'); await text('120,123456789012345678901'); await layout(); await shot('long-' + width);
      await open('partial'); await ready(); await text('Thiếu chỉ số cuối và đơn giá lịch sử'); await layout(); await shot('partial-' + width); await recordCalls();
    }
  });
  await page.setViewport({ width: 1440, height: 900 });
  await check('Host chooses room then ascending period, clears old detail on room change', async () => {
    await open('full', 'HOST', 'search'); await text('Chọn phòng và kỳ để xem tạm tính');
    assert.equal(await page.$('[data-testid=provisional-total]'), null);
    await select('#pc-room', id(10)); await page.waitForFunction(() => !document.querySelector('#pc-period').disabled);
    assert.deepEqual(await page.$$eval('#pc-period option', options => options.map(o => o.value)), ['', id(2), id(1)]);
    await select('#pc-period', id(1)); await ready(); await select('#pc-room', id(11));
    await text('Chọn phòng và kỳ để xem tạm tính'); assert.equal(await page.$('[data-testid=provisional-total]'), null);
    assert.equal(new URL(page.url()).searchParams.has('periodId'), false); await recordCalls();
  });
  await check('Customer independent multi-room scope, no Host API, correct active navigation', async () => {
    await open('full', 'CUSTOMER', 'search'); await text('Chọn phòng và kỳ để xem tạm tính');
    assert.deepEqual(await page.$$eval('#pc-room option', options => options.map(o => o.textContent)), ['Chọn phòng', '101, Tòa A', '101, Tòa B']);
    await select('#pc-room', id(10)); await select('#pc-period', id(2)); await ready();
    const calls = await page.evaluate(() => window.__uc39Calls.filter(c => c.path.includes('/provisional-charges/')));
    assert.ok(calls.length && calls.every(c => c.path.includes('/customer/')));
    assert.equal(await page.$('.property-switcher'), null); assert.equal(await page.$('.system-status-box'), null);
    assert.match(await page.$eval('.dash-sidebar [aria-current=page]', n => n.textContent), /Tạm tính dịch vụ/);
    await shot('customer-desktop'); await recordCalls();
    await page.reload({ waitUntil: 'networkidle0' }); await ready();
    assert.ok((await page.evaluate(() => window.__uc39Calls.filter(c => c.path.includes('/provisional-charges/')))).every(c => c.path.includes('/customer/')));
    await recordCalls();
  });
  await check('Back/Forward and real document refresh retain exact URL context', async () => {
    await open(); await ready(); await select('#pc-room', id(11)); await text('Chọn phòng và kỳ để xem tạm tính');
    await page.goBack(); await ready(); assert.match(new URL(page.url()).search, /periodId=/);
    await page.goForward(); await text('Chọn phòng và kỳ để xem tạm tính');
    await page.goBack(); await ready(); await page.reload({ waitUntil: 'networkidle0' }); await ready(); await recordCalls();
  });
  await check('PARTIAL, INSUFFICIENT_DATA and EMPTY preserve backend meanings', async () => {
    await open('partial'); await ready(); await text('Tổng một phần'); assert.match(await page.$eval('[data-testid=provisional-total]', n => n.textContent), /-20\.000/);
    assert.ok(await page.$('.pc-badge--missing')); await recordCalls();
    await open('insufficient'); await ready(); assert.equal(await page.$eval('[data-testid=provisional-total]', n => n.textContent), 'Chưa đủ dữ liệu để tạm tính'); await shot('insufficient');
    await open('empty'); await ready(); await text('Không có khoản dịch vụ/phí trong kỳ đã chọn'); assert.equal(await page.$('.pc-table'), null); await shot('empty');
  });
  await check('304 verifies the same snapshot and removes pending stale label', async () => {
    await open(); await ready(); const original = await page.$eval('[data-testid=provisional-total]', n => n.textContent);
    await click('Tải lại'); await page.waitForFunction(() => document.querySelector('.pc-result')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.$eval('[data-testid=provisional-total]', n => n.textContent), original);
    assert.equal(await page.$('.pc-notice'), null); assert.equal((await page.evaluate(() => window.__uc39Calls.at(-1).etag)), '"' + 'a'.repeat(64) + '"'); await recordCalls();
  });
  await check('Reload failure and concurrency keep same-context data explicitly stale', async () => {
    for (const mode of ['stale', 'concurrent']) {
      await open(mode); await ready(); await click('Tải lại'); await text('Chưa cập nhật'); await page.waitForSelector('.pc-notice');
      assert.ok(await page.$('[data-testid=provisional-total]')); await shot(mode); await recordCalls();
    }
  });
  await check('Denied, ended tenancy, sealed period and invalid source disclose no totals', async () => {
    for (const mode of ['denied', 'moved', 'closed', 'source', 'read-error']) {
      await open(mode); await page.waitForSelector('.pc-state--error'); assert.equal(await page.$('[data-testid=provisional-total]'), null);
      await shot(mode); await recordCalls();
    }
    await open('full', 'ADMIN'); await text('Không có quyền truy cập');
    assert.equal((await page.evaluate(() => window.__uc39Calls.filter(c => c.path.includes('/provisional-charges/')).length)), 0);
  });
  await check('A late response cannot replace period B or clear its status', async () => {
    await open('race'); await page.waitForSelector('#pc-period:not(:disabled)'); await select('#pc-period', id(2)); await ready();
    await new Promise(resolve => setTimeout(resolve, 1400));
    assert.match(await page.$eval('.pc-period-heading', n => n.textContent), /21\/09\/2026/);
    assert.equal(await page.$('.pc-state--error'), null); await recordCalls();
  });
  await check('Keyboard disclosure, instant focus and reduced motion; mobile navigation works', async () => {
    await open(); await ready(); await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.focus('.pc-basis summary'); assert.notEqual(await page.$eval('.pc-basis summary', n => getComputedStyle(n).outlineStyle), 'none');
    await page.keyboard.press('Enter'); assert.ok(await page.$('.pc-basis[open]')); await text('Giá phòng');
    await page.setViewport({ width: 390, height: 900 }); await layout(); await page.click('.dash-mobile-menu-toggle');
    await page.waitForSelector('.dash-sidebar.is-mobile-open');
    await page.evaluate(() => [...document.querySelectorAll('.dash-sidebar button')].find(b => b.textContent.trim() === 'Tạm tính dịch vụ').click());
    await text('Chọn phòng và kỳ để xem tạm tính'); assert.equal(await page.$('.dash-sidebar.is-mobile-open'), null); await shot('keyboard-mobile'); await recordCalls();
  });
  assert.ok(businessCalls.length > 0 && businessCalls.every(c => c.method === 'GET'), 'UC39 business calls must be GET only');
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors, businessRequests: businessCalls.length, methods: [...new Set(businessCalls.map(c => c.method))] }, null, 2));
  console.log(`UC39 browser: ${checks.length} checks passed, ${businessCalls.length} business GETs`);
} finally { await browser.close(); }
