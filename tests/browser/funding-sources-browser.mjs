import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
const base = process.env.FUNDING_PREVIEW_URL || 'http://127.0.0.1:5179';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/funding-sources'); mkdirSync(output, { recursive: true });
// Verify the dev server before allocating a browser process.
const preview = await (await fetch(base + '/tests/fixtures/funding-sources-preview.html')).text();
const browser = await puppeteer.launch({ executablePath, headless: true });
let page = await browser.newPage();
let viewport = { width: 1440, height: 900 };
const checks = [], errors = [];
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const text = s => page.waitForFunction(s => document.body.innerText.includes(s), {}, s);
const ready = () => page.waitForSelector('.fs-table');
const writes = () => page.evaluate(() => window.__uc40Calls.filter(c => ['POST', 'PATCH'].includes(c.method)));
async function open(mode = 'full', role = 'HOST') {
  // Release each previous document on memory-constrained machines; navigation checks
  // within a group still use the same real document/history.
  await page.close(); page = await browser.newPage(); await page.setViewport(viewport);
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => {
    const url = new URL(r.url());
    if (r.isNavigationRequest() && url.origin === new URL(base).origin && ['/funding-sources', '/'].includes(url.pathname)) void r.respond({ status: 200, contentType: 'text/html', body: preview });
    else void r.continue();
  });
  await page.goto(`${base}/tests/fixtures/funding-sources-preview.html?state=${mode}&role=${role}`, { waitUntil: 'networkidle0' }); await page.waitForSelector('.fs-page h1');
}
async function click(label, scope = '.fs-page, .fs-dialog') {
  await page.waitForFunction((label, scope) => [...document.querySelectorAll(scope)].flatMap(n => [...n.querySelectorAll('button')]).some(b => b.textContent.trim() === label && !b.disabled), {}, label, scope);
  await page.evaluate((label, scope) => [...document.querySelectorAll(scope)].flatMap(n => [...n.querySelectorAll('button')]).find(b => b.textContent.trim() === label && !b.disabled).click(), label, scope);
}
async function fill(selector, value) { await page.click(selector); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(selector, value); assert.equal(await page.$eval(selector, n => n.value), value, 'Typed value must remain complete'); }
async function shot(name) { await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); }
async function layout(dialog = false) {
  const r = await page.evaluate(dialog => {
    const scope = dialog ? '.fs-dialog' : '.fs-page';
    const footer = document.querySelector('.fs-dialog-footer')?.getBoundingClientRect();
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, footerBottom: footer?.bottom,
      targets: [...document.querySelectorAll(scope + ' button, ' + scope + ' select, ' + scope + ' input')].filter(n => n.getClientRects().length).map(n => ({ height: n.getBoundingClientRect().height, font: parseFloat(getComputedStyle(n).fontSize), text: n.textContent.slice(0, 40) })) };
  }, dialog);
  assert.ok(r.scroll <= r.width, `Overflow ${r.scroll}/${r.width}`); assert.ok(r.targets.every(c => c.height >= 44), JSON.stringify(r.targets.filter(c => c.height < 44)));
  if (r.width < 760) assert.ok(r.targets.every(c => c.font >= 16), 'Mobile controls must be >=16px');
  if (dialog) assert.ok(r.footerBottom <= (await page.evaluate(() => innerHeight)), 'Dialog footer must remain visible');
}
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS ' + name); }
try {
  for (const width of [390, 768, 1440, 1920]) await check(`Production table ${width}px, accessible labels and no overflow`, async () => {
    viewport = { width, height: 900 }; await open('long'); await ready(); await layout(); await shot('list-' + width);
    assert.equal(await page.$$eval('.fs-table tbody tr', rows => rows.length), 3);
  });
  viewport = { width: 1440, height: 900 };
  await check('Filters, Back/Forward, document reload and sidebar current state', async () => {
    await open(); await ready(); assert.match(await page.$eval('.dash-sidebar [aria-current=page]', n => n.textContent), /Quản lý nguồn tiền/);
    await page.select('#fs-filter-type', 'BANK'); await page.waitForFunction(() => document.querySelectorAll('.fs-table tbody tr').length === 2);
    await page.goBack(); await page.waitForFunction(() => document.querySelector('#fs-filter-type')?.value === '');
    await page.goForward(); await page.waitForFunction(() => document.querySelector('#fs-filter-type')?.value === 'BANK');
    await page.reload({ waitUntil: 'networkidle0' }); await ready(); assert.equal(await page.$eval('#fs-filter-type', n => n.value), 'BANK');
  });
  await check('BANK main flow keeps zero prefix, validates, saves once and refreshes', async () => {
    await open('slow-write'); await ready(); await click('Thêm tài khoản ngân hàng'); await page.waitForSelector('.fs-dialog[open]');
    await click('Lưu', '.fs-dialog'); await page.waitForSelector('#fs-name[aria-invalid=true]'); assert.equal(await page.evaluate(() => document.activeElement.id), 'fs-name');
    await fill('#fs-name', 'VCB cơ sở mới'); await page.select('#fs-bankCode', 'VCB'); await fill('#fs-accountNumber', '000123456789'); await fill('#fs-accountHolder', 'Nguyễn Thị An'); await layout(true); await shot('create-bank');
    await page.evaluate(() => { const b = document.querySelector('.fs-dialog button[type=submit]'); b.click(); b.click(); }); await text('Tạo nguồn tiền thành công');
    const calls = await writes(); assert.equal(calls.length, 1); const payload = JSON.parse(calls[0].body); assert.equal(payload.bankDetails.accountNumber, '000123456789'); assert.equal(payload.hostId, undefined);
    assert.ok(calls[0].csrf); assert.equal(await page.$('.fs-dialog'), null);
  });
  await check('CASH stays available during bank-directory failure; Escape cancels and returns focus', async () => {
    await open('bank-error'); await ready(); await click('Thêm nguồn tiền mặt'); await page.waitForSelector('#fs-name'); await fill('#fs-name', 'Quỹ cơ sở B');
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.querySelector('.fs-dialog').contains(document.activeElement))); }
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.fs-dialog')); assert.equal((await writes()).length, 0);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Thêm nguồn tiền mặt');
    await click('Thêm nguồn tiền mặt'); await fill('#fs-name', 'Quỹ cơ sở B'); await click('Lưu', '.fs-dialog'); await text('Tạo nguồn tiền thành công');
    assert.deepEqual(JSON.parse((await writes())[0].body), { name: 'Quỹ cơ sở B', type: 'CASH' });
  });
  await check('History-locked BANK edits name only, preserving exact numeric version', async () => {
    await open(); await ready(); await page.evaluate(() => [...document.querySelectorAll('.fs-table tbody tr')].find(r => r.textContent.includes('MB tiền thuê nhà')).querySelector('button').click());
    await page.waitForSelector('#fs-accountNumber[readonly]'); await fill('#fs-name', 'Tên ngân hàng đã đổi'); await shot('locked-edit'); await click('Lưu', '.fs-dialog'); await text('Cập nhật nguồn tiền thành công');
    const body = (await writes())[0].body; assert.equal(body, '{"name":"Tên ngân hàng đã đổi","version":9007199254740993}');
  });
  await check('No-room deactivation still confirms; changing impact needs new token and second confirmation', async () => {
    for (const mode of ['no-rooms', 'impact-changed']) {
      await open(mode); await ready(); await click('Ngừng hoạt động'); await text('Phòng bị ảnh hưởng'); assert.equal((await writes()).length, 0);
      await click('Xác nhận ngừng hoạt động', '.fs-dialog');
      if (mode === 'impact-changed') { await text('Các phòng bị ảnh hưởng đã thay đổi'); assert.equal((await writes()).length, 1); await click('Xác nhận ngừng hoạt động', '.fs-dialog'); }
      await text('Ngừng hoạt động nguồn tiền thành công'); const calls = await writes(); assert.ok(calls.at(-1).body.includes(mode === 'impact-changed' ? 'b'.repeat(64) : 'a'.repeat(64)));
    }
  });
  await check('30-room warning scrolls with reachable footer and full room details on mobile', async () => {
    viewport = { width: 390, height: 700 }; await open('many-rooms'); await ready(); await click('Ngừng hoạt động'); await text('Phòng bị ảnh hưởng (30)'); await layout(true);
    assert.equal(await page.$$eval('.fs-room-list li', n => n.length), 30); await shot('impact-mobile');
    await page.$eval('.fs-dialog-body', n => { n.scrollTop = n.scrollHeight; }); await layout(true); await shot('impact-mobile-bottom');
    await click('Hủy', '.fs-dialog'); assert.equal((await writes()).length, 0);
  });
  await check('Mobile form uses 16px controls and activation sends no token', async () => {
    await open(); await ready(); await click('Thêm tài khoản ngân hàng'); await page.waitForSelector('#fs-name'); await layout(true); await shot('bank-mobile'); await click('Hủy', '.fs-dialog');
    await click('Kích hoạt lại'); await text('Xác nhận kích hoạt lại'); await click('Xác nhận kích hoạt', '.fs-dialog'); await text('Kích hoạt nguồn tiền thành công'); const body = (await writes())[0].body; assert.ok(body.includes('"active":true')); assert.ok(!body.includes('confirmationToken'));
  });
  await check('Unknown write result is never replayed; explicit GET verification shows committed result', async () => {
    await open('uncertain'); await ready(); await click('Thêm nguồn tiền mặt'); await fill('#fs-name', 'Quỹ kiểm tra'); await click('Lưu', '.fs-dialog'); await text('Chưa xác định kết quả thao tác'); await shot('uncertain');
    await click('Kiểm tra kết quả', '.fs-dialog'); await text('Dữ liệu kiểm tra từ hệ thống'); assert.equal((await writes()).length, 1); assert.equal(await page.$('.fs-dialog button[type=submit]'), null);
  });
  await check('Empty/error states, forbidden role and session replacement disclose no stale bank data', async () => {
    await open('empty'); await text('Chưa có nguồn tiền'); await shot('empty'); await open('read-error'); await text('Chưa thể tải danh sách'); await shot('error');
    for (const role of ['CUSTOMER', 'ADMIN']) { await open('full', role); await text('Bạn không có quyền quản lý nguồn tiền'); assert.equal(await page.evaluate(() => window.__uc40Calls.filter(c => c.path.includes('/funding-sources') || c.path.endsWith('/banks')).length), 0); }
    await open(); await ready(); await click('Thêm tài khoản ngân hàng'); await fill('#fs-accountNumber', '001234567890');
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'rentops-session-change', newValue: JSON.stringify({ accountId: null, nonce: 'ended' }) })));
    await page.waitForFunction(() => !document.querySelector('.fs-page')); assert.equal(await page.$('.fs-dialog'), null); assert.ok(!(await page.content()).includes('001234567890'));
  });
  assert.deepEqual(errors, []); console.log(`PASS ${checks.length} UC40 browser groups`);
} catch (error) {
  console.error('Browser state:', page.url(), await page.evaluate(() => document.body.innerText.slice(0, 1800)).catch(() => 'unavailable'));
  await shot('failure').catch(() => undefined); throw error;
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checks, pageErrors: errors }, null, 2)); await browser.close();
}
