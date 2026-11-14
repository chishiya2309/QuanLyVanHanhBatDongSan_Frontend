import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
const base = process.env.METER_PREVIEW_URL || 'http://127.0.0.1:5178';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/meter-readings'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(), checks = [], errors = [];
page.on('pageerror', (error) => errors.push(error.message)); page.on('dialog', (d) => d.accept());
const waitText = (text) => page.waitForFunction((text) => document.body.innerText.includes(text), {}, text);
const open = async (query = '') => { await page.goto(base + '/tests/fixtures/meter-readings-preview.html?' + query, { waitUntil: 'networkidle0' }); await page.waitForSelector('.mr-page h1'); };
const ready = () => page.waitForSelector('.mr-table tbody th');
async function click(text) {
  await page.waitForFunction((text) => [...document.querySelectorAll('.mr-page button, .mr-page a')].some((b) => b.textContent.trim() === text && !b.disabled), {}, text);
  await page.evaluate((text) => [...document.querySelectorAll('.mr-page button, .mr-page a')].find((b) => b.textContent.trim() === text && !b.disabled).click(), text);
}
async function fill(selector, text) { await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); if (text) await page.type(selector, text); }
const writes = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('uc37-preview-calls') || '[]').filter((c) => c.method === 'POST' || c.method === 'PATCH'));
const first = '#mr-00000000-0000-4000-8000-000000000010', second = '#mr-00000000-0000-4000-8000-000000000012';
async function batch() {
  await ready(); await fill(first + '-start', '0'); await page.click('input[name=confirmStart]'); await fill(first + '-end', '0'); await fill(second + '-end', '120.123456789012345678901');
}
async function shot(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); }
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS ' + name); }
async function layout() {
  const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, controls: [...document.querySelectorAll('.mr-page button, .mr-page select, .mr-page input:not([type=checkbox]), .mr-page .mr-check-label, .mr-page .mr-row-check, .mr-page .mr-period-option')].filter((n) => n.getClientRects().length).map((n) => ({ text: n.textContent?.slice(0, 80), height: n.getBoundingClientRect().height })) }));
  assert.ok(result.scroll <= result.width, `Overflow ${result.scroll}/${result.width}`);
  assert.ok(result.controls.every((c) => c.height >= 44), JSON.stringify(result.controls.filter((c) => c.height < 44)));
}
try {
  for (const width of [390, 768, 1440]) await check(`Responsive ledger ${width}px, labels, touch targets, no page overflow`, async () => { await page.setViewport({ width, height: 900 }); await open(); await ready(); await layout(); await shot('batch-' + width); });
  await page.setViewport({ width: 1440, height: 900 });
  await check('Host navigation, direct existing DRAFT correction and browser Back/Forward', async () => {
    await open('entry=detail&view=single'); await ready(); await click('Cập nhật chỉ số'); await page.waitForSelector('input[name=endIndex]'); await fill('input[name=endIndex]', '12.5'); await click('Lưu cập nhật'); await waitText('Đã cập nhật chỉ số.');
    const calls = await writes(); assert.equal(calls.length, 1); assert.equal(calls[0].method, 'PATCH'); assert.deepEqual(Object.keys(JSON.parse(calls[0].body)), ['endIndex', 'version']);
    await click('Về danh sách chỉ số'); await ready(); await click('Xem tiến độ'); await waitText('Phòng còn thiếu chỉ số'); await page.goBack(); await ready(); await page.goForward(); await waitText('Phòng còn thiếu chỉ số'); await shot('progress-desktop');
    await page.evaluate(() => [...document.querySelectorAll('.dash-sidebar button')].find((b) => b.textContent.trim() === 'Khách thuê').click());
    await page.waitForFunction(() => location.pathname === '/customers' && !document.querySelector('.mr-page'));
    await page.goBack(); await waitText('Phòng còn thiếu chỉ số');
  });
  await check('Partial batch preserves exact saved rows and retries only selected failed item', async () => {
    await open('state=partial'); await batch(); await click('Lưu các mục đã chọn'); await waitText('Đã lưu 1 mục; 1 mục chưa được lưu');
    await page.waitForFunction((s) => document.querySelector(s) && !document.querySelector(s).disabled, {}, second + '-end');
    assert.equal(await page.$(first + '-end'), null); assert.equal((await writes()).length, 1);
    await page.click('input[aria-label^="Chọn lưu phòng 101, Nước"]'); await click('Lưu các mục đã chọn'); await waitText('Đã lưu tất cả 1 mục đã gửi.');
    const calls = await writes(); assert.equal(calls.length, 2); assert.equal(JSON.parse(calls[1].body).items.length, 1); assert.ok(calls[1].body.includes('120.123456789012345678901')); await shot('partial-retried');
  });
  await check('Lost response reconciles committed batch without replay', async () => {
    await open('state=lost-response'); await batch(); await click('Lưu các mục đã chọn'); await waitText('Chưa xác định đầy đủ kết quả lưu'); await click('Đối chiếu kết quả thực tế'); await waitText('Đã đối chiếu dữ liệu thực tế.');
    assert.equal((await writes()).length, 1); assert.equal(await page.$(second + '-end'), null); await shot('reconciled');
  });
  await check('Save success remains visible after refresh fails, stale progress marked explicitly', async () => {
    await open('state=reload-error'); await batch(); await click('Lưu các mục đã chọn'); await waitText('Kết quả lưu đã được xác nhận'); assert.ok(await page.$('.mr-stats--stale')); await click('Tải lại tiến độ'); assert.equal((await writes()).length, 1); await shot('saved-refresh-error');
  });
  await check('NONE_SAVED is not a success and SEALED remains view-only', async () => {
    await open('state=none'); await batch(); await click('Lưu các mục đã chọn'); await waitText('Không có mục nào được lưu'); assert.equal(await page.$('.mr-notice--success'), null); await shot('none-saved');
    await open('state=locked&entry=detail'); await ready(); assert.equal(await page.$eval('button', () => [...document.querySelectorAll('.mr-page button')].find((b) => b.textContent === 'Cập nhật chỉ số').disabled), true); assert.equal(await page.$('input[name=endIndex]'), null); await shot('locked');
  });
  await check('Genuine empty and load error remain distinct; ADMIN sees no meter data', async () => {
    await open('state=empty'); await waitText('Không có dữ liệu cần ghi chỉ số'); assert.equal(await page.$eval('.mr-stats dd', (n) => n.textContent), '0'); await shot('empty');
    await open('state=read-error'); await waitText('Không thể tải dữ liệu'); assert.equal(await page.$('.mr-stats'), null); await shot('load-error');
    await open('state=admin'); await waitText('Bạn không có quyền'); assert.equal(await page.$('.mr-table'), null);
  });
  await check('Keyboard focus is visible and reduced motion remains usable', async () => {
    await open('view=single'); await ready(); await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.focus('.mr-views a'); const outline = await page.$eval('.mr-views a', (n) => getComputedStyle(n).outlineStyle); assert.notEqual(outline, 'none');
    await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement?.tagName === 'A')); await shot('keyboard');
  });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(`UC37 browser: ${checks.length} checks passed`);
} finally { await browser.close(); }
