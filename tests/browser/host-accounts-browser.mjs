import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.HOST_ACCOUNTS_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/host-accounts'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(); const errors = []; const checks = [];
const group = process.argv[2];
const path = '/admin/host-accounts'; const id = '11111111-1111-4111-8111-111111111111';
const initial = () => [
  { accountId: id, loginEmail: 'anbinh@example.test', businessName: 'Nhà An Bình', status: 'ACTIVE', createdAt: '2026-10-30T18:00:00Z', officeAddress: '12 Nguyễn Văn Thủ, TP. Hồ Chí Minh', businessPhone: '0901234567', businessEmail: 'business@example.test', logoUrl: null },
  { accountId: '22222222-2222-4222-8222-222222222222', loginEmail: 'minhphat@example.test', businessName: 'Căn hộ Minh Phát', status: 'LOCKED', createdAt: '2026-10-29T09:30:00Z', officeAddress: null, businessPhone: null, businessEmail: null, logoUrl: null },
  { accountId: '33333333-3333-4333-8333-333333333333', loginEmail: 'long.email.for.record.without.profile@example.test', businessName: null, status: 'ACTIVE', createdAt: '2026-10-28T10:00:00Z', officeAddress: null, businessPhone: null, businessEmail: null, logoUrl: null },
];
let rows = initial(); let role = 'ADMIN'; let mode = 'full'; let calls = []; let patchGate = null;
page.on('pageerror', (error) => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', async (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) { await request.continue(); return; }
  calls.push({ path: url.pathname, method: request.method(), body: request.postData(), csrf: request.headers()['x-csrf-token'] });
  const respond = (status, message, data = null) => request.respond({ status, contentType: 'application/json', body: JSON.stringify({ status, message, data }) });
  if (url.pathname.endsWith('/auth/me')) return respond(200, 'ok', { accountId: 'preview-admin', loginName: 'Quản trị viên', role, hostId: null, customerId: null });
  if (url.pathname.endsWith('/auth/csrf')) return respond(200, 'ok', { token: 'preview-only', headerName: 'X-CSRF-TOKEN' });
  if (url.pathname.includes(path)) {
    if (mode === 'permission') return respond(403, 'Bạn không có quyền thực hiện chức năng này');
    if (mode === 'session') return respond(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại');
    const account = rows.find((row) => url.pathname.includes(row.accountId));
    if (request.method() === 'PATCH') {
      if (patchGate) await patchGate;
      if (mode === 'csrf') return respond(403, 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại');
      if (mode === 'mutation-error') return respond(500, 'internal detail');
      const unlocking = url.pathname.endsWith('/unlock'); account.status = unlocking ? 'ACTIVE' : 'LOCKED';
      if (mode === 'refresh-error') mode = 'list-error';
      return respond(200, unlocking ? 'Mở khóa tài khoản Host thành công' : 'Khóa tài khoản Host thành công');
    }
    if (account) return respond(200, 'Lấy thông tin chi tiết Host thành công', { ...account });
    if (mode === 'list-error') return respond(500, 'internal detail');
    if (mode === 'malformed') return respond(200, 'ok', {});
    return respond(200, 'Lấy danh sách tài khoản Host thành công', mode === 'empty' ? [] : rows);
  }
  return respond(404, 'Fixture endpoint not provided');
});
async function check(name, action) { if (group && !name.includes(group)) return; await action(); checks.push(name); console.log('PASS ' + name); }
async function visit({ target = path, width = 1280, state = 'full', as = 'ADMIN', height = 900 } = {}) {
  rows = initial(); role = as; mode = state; calls = []; patchGate = null;
  await page.setViewport({ width, height }); await page.goto(base + target, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready); await page.waitForSelector(state === 'session' ? '#loginName' : '.host-page');
}
async function text() { return page.$eval('.host-page', (el) => el.textContent); }
async function waitText(value) { await page.waitForFunction((value) => document.body.textContent.includes(value), {}, value); }
async function clickText(selector, label) {
  const handle = await page.evaluateHandle((selector, label) => [...document.querySelectorAll(selector)].find((el) => el.textContent === label && el.getBoundingClientRect().height > 0), selector, label);
  assert.ok(handle.asElement(), label); await handle.asElement().click(); await handle.dispose();
}
async function shot(name) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' has no horizontal overflow'); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); }
async function openLock() { await clickText('.host-button', 'Khóa tài khoản'); await page.waitForSelector('dialog[open]'); }
try {
  await check('list/detail layouts at 375, 834 and 1280 with complete records and touch targets', async () => {
    for (const width of [375, 834, 1280]) for (const detail of [false, true]) {
      await visit({ width, target: path + (detail ? '/' + id : '') }); await page.waitForSelector(detail ? '.host-detail' : '.host-mobile-list li');
      await shot(`${detail ? 'detail' : 'list'}-${width}`);
      assert.ok((await text()).includes(id)); assert.equal(await page.$('#propertySwitcher'), null);
      assert.equal(await page.$('.analytics-alerts-grid'), null);
      assert.ok(await page.$$eval('.host-page button, .host-page a, .host-mobile-nav a', (els) => els.filter((el) => el.getBoundingClientRect().height > 0).every((el) => { const r = el.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; })));
      if (width < 1024) assert.ok(await page.$eval('.host-mobile-nav', (el) => el.getBoundingClientRect().height > 0));
      if (detail) assert.ok((await text()).includes('Email kinh doanh') && (await text()).includes('Email đăng nhập'));
    }
  });
  await check('direct URLs, refresh, Back/Forward and mobile navigation retain Admin session', async () => {
    await visit({ width: 375 }); const bootRequests = calls.filter((c) => c.path.endsWith('/auth/me')).length;
    await clickText('.host-mobile-list a', 'Xem chi tiết'); await page.waitForSelector('.host-detail');
    assert.equal(new URL(page.url()).pathname, path + '/' + id);
    await page.goBack(); await page.waitForSelector('.host-mobile-list li'); await page.goForward(); await page.waitForSelector('.host-detail');
    assert.equal(calls.filter((c) => c.path.endsWith('/auth/me')).length, bootRequests);
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('.host-detail');
    await clickText('.host-mobile-nav a', 'Tổng quan'); await page.waitForSelector('.greeting-title');
    await clickText('.host-mobile-nav a', 'Tài khoản Host'); await page.waitForSelector('.host-mobile-list li');
    assert.equal(calls.filter((c) => c.path.endsWith('/auth/me')).length, bootRequests * 2);
  });
  await check('Host and Customer direct access never request or display Admin data', async () => {
    for (const as of ['HOST', 'CUSTOMER']) {
      await visit({ as, target: path + '/' + id }); await waitText('Bạn không có quyền thực hiện chức năng này');
      assert.equal(calls.filter((c) => c.path.includes('/admin/')).length, 0);
      assert.equal(await page.$('.host-detail'), null);
    }
  });
  await check('empty, server error and malformed response remain distinct', async () => {
    await visit({ state: 'empty' }); await waitText('Chưa có tài khoản Host'); await shot('empty');
    for (const state of ['list-error', 'malformed']) {
      await visit({ state }); await waitText('Không thể tải danh sách tài khoản Host. Vui lòng thử lại sau');
      assert.ok(!(await text()).includes('Chưa có tài khoản Host')); mode = 'full'; await clickText('.host-button', 'Thử lại'); await page.waitForSelector('.host-table tbody tr');
    }
  });
  await check('native dialog focus, keyboard trapping, Escape, backdrop and cancellation', async () => {
    await visit({ target: path + '/' + id }); await openLock();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Hủy');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Xác nhận');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Hủy'); await shot('confirmation-1280');
    await page.keyboard.press('Escape'); assert.equal(await page.$('dialog[open]'), null); assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Khóa tài khoản');
    await openLock(); await page.mouse.click(2, 2); assert.equal(await page.$('dialog[open]'), null);
    assert.equal(calls.filter((c) => c.method === 'PATCH').length, 0);
  });
  await check('preflight status conflict prevents stale confirmation', async () => {
    await visit(); rows[0].status = 'LOCKED'; await clickText('.host-button', 'Khóa tài khoản'); await waitText('Tài khoản Host đã bị khóa');
    assert.equal(await page.$('dialog[open]'), null); assert.equal(calls.filter((c) => c.method === 'PATCH').length, 0);
  });
  await check('busy dismissal and duplicate submits are blocked; lock/unlock refresh exact current account', async () => {
    await visit({ target: path + '/' + id }); await openLock(); let release;
    patchGate = new Promise((resolve) => { release = resolve; });
    await page.$eval('dialog form', (el) => { el.requestSubmit(); el.requestSubmit(); });
    await waitText('Đang xử lý'); await page.keyboard.press('Escape'); await page.mouse.click(2, 2);
    assert.ok(await page.$('dialog[open]')); assert.ok(await page.$$eval('dialog button', (els) => els.every((el) => el.disabled)));
    release(); patchGate = null; await waitText('Khóa tài khoản Host thành công'); await waitText('Mở khóa tài khoản');
    let mutations = calls.filter((c) => c.method === 'PATCH'); assert.equal(mutations.length, 1); assert.equal(mutations[0].body, undefined); assert.equal(mutations[0].csrf, 'preview-only');
    await clickText('.host-button', 'Mở khóa tài khoản'); await page.waitForSelector('dialog[open]');
    assert.ok((await page.$eval('dialog', (el) => el.textContent)).includes('Các phiên đã thu hồi sẽ không được khôi phục'));
    await clickText('dialog button', 'Xác nhận'); await waitText('Mở khóa tài khoản Host thành công');
    mutations = calls.filter((c) => c.method === 'PATCH'); assert.equal(mutations.length, 2); assert.ok(mutations[1].path.endsWith('/' + id + '/unlock'));
    assert.equal(calls.some((c) => c.path.endsWith('/logout') || c.path.endsWith('/refresh')), false);
  });
  await check('CSRF failure and uncertain mutation failure close dialog, re-read and require manual action', async () => {
    for (const state of ['csrf', 'mutation-error']) {
      await visit({ target: path + '/' + id }); await openLock(); mode = state; await clickText('dialog button', 'Xác nhận');
      await waitText(state === 'csrf' ? 'CSRF token bị thiếu hoặc không hợp lệ' : 'Khóa tài khoản Host không thành công');
      assert.equal(await page.$('dialog[open]'), null); assert.equal(calls.filter((c) => c.method === 'PATCH').length, 1);
      assert.ok(calls.filter((c) => c.path.endsWith('/' + id)).length >= 3);
    }
  });
  await check('mutation success survives refresh failure and stays blocked until synchronized', async () => {
    await visit({ target: path + '/' + id }); await openLock(); mode = 'refresh-error'; await clickText('dialog button', 'Xác nhận');
    await waitText('Khóa tài khoản Host thành công'); await waitText('Không thể tải danh sách tài khoản Host');
    assert.ok(await page.$eval('.host-detail-actions button', (el) => el.disabled)); await shot('success-refresh-failure');
    mode = 'full'; await clickText('.host-button', 'Thử lại'); await page.waitForSelector('.host-detail-actions button:not([disabled])');
  });
  await check('revoked permission purges Admin data and expired session returns to login without logout', async () => {
    await visit({ state: 'permission' }); await waitText('Bạn không có quyền thực hiện chức năng này'); assert.equal(await page.$('.host-table'), null);
    await visit({ state: 'session' }); await waitText('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại');
    assert.equal(new URL(page.url()).pathname, '/'); assert.equal(await page.$('.host-page'), null);
    assert.equal(calls.some((c) => c.path.endsWith('/logout')), false);
  });
  await check('200% text/reflow, short mobile dialog and reduced motion remain operable', async () => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await visit({ target: path + '/' + id, width: 640, height: 450 });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' }); await shot('detail-reflow-200'); await openLock();
    await page.$eval('dialog', (el) => { el.scrollTop = el.scrollHeight; }); await shot('confirmation-reflow-200'); await clickText('dialog button', 'Hủy');
    await visit({ target: path + '/' + id, width: 375, height: 500 }); await openLock(); await shot('confirmation-375'); await clickText('dialog button', 'Hủy');
  });
  assert.deepEqual(errors, []); writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, passed: checks.length, errors }, null, 2));
  console.log(`PASS ${checks.length} UC07 browser checks; screenshots: ${output}`);
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
  console.error(await page.evaluate(() => ({ path: location.pathname, content: document.querySelector('main')?.textContent, buttons: [...document.querySelectorAll('.host-page button')].map((el) => ({ text: el.textContent, disabled: el.disabled })) })));
  throw error;
} finally { await browser.close(); }
