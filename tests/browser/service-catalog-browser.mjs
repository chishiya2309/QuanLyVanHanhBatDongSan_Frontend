import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LosslessNumber, parse, stringify } from 'lossless-json';

const base = process.env.CATALOG_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/service-catalog'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(); const errors = [], checks = [];
const id = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
let rows, calls, mode, role, count, csrfGate, acceptDiscard = true;
function reset() {
  rows = [{ id: id(1), systemCode: 'ELECTRICITY', name: 'Điện', unit: 'kWh', method: 'METERED', active: false, pricingStatus: 'UNCONFIGURED', defaultPrice: null, currentPriceRevisionId: null, effectiveFrom: null, version: new LosslessNumber('0') },
    { id: id(2), systemCode: 'WATER', name: 'Nước', unit: 'm³', method: 'METERED', active: false, pricingStatus: 'UNCONFIGURED', defaultPrice: null, currentPriceRevisionId: null, effectiveFrom: null, version: new LosslessNumber('0') },
    { id: id(3), systemCode: null, name: 'Internet', unit: 'tháng', method: 'FIXED', active: true, pricingStatus: 'CONFIGURED', defaultPrice: new LosslessNumber('100000'), currentPriceRevisionId: id(4), effectiveFrom: '2026-11-01T00:00:00.000001Z', version: new LosslessNumber('9007199254740993') }];
  calls = []; mode = 'full'; role = 'HOST'; count = 5; csrfGate = null;
}
reset();
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', async (dialog) => { if (acceptDiscard) await dialog.accept(); else await dialog.dismiss(); });
await page.setRequestInterception(true);
page.on('request', async (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) { await request.continue(); return; }
  calls.push({ path: url.pathname, method: request.method(), body: request.postData(), csrf: request.headers()['x-csrf-token'], search: url.search });
  const reply = (status, message, data = null, fieldErrors = {}) => request.respond({ status, contentType: 'application/json', body: stringify(status >= 400 ? { status, message, fieldErrors } : { status, message, data }) }).catch(() => undefined);
  if (url.pathname.endsWith('/auth/me')) return mode === 'session' ? reply(401, 'Expired') : reply(200, 'OK', { accountId: id(8), loginName: 'Host kiểm thử UC19', role, hostId: id(1), customerId: null });
  if (url.pathname.endsWith('/auth/refresh')) return reply(401, 'Expired');
  if (url.pathname.endsWith('/auth/csrf')) { if (csrfGate) await csrfGate; return reply(200, 'OK', { headerName: 'X-CSRF-TOKEN', token: 'browser-uc19' }); }
  if (!url.pathname.includes('/services')) return reply(404, 'Unexpected test endpoint');
  if (mode === 'forbidden') return reply(403, 'Bạn không có quyền thực hiện chức năng này');
  if (request.method() !== 'GET') {
    if (mode === 'csrf') return reply(403, 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại');
    if (mode === 'stale') { rows[2].name = 'Internet đã thay đổi'; rows[2].version = new LosslessNumber('9007199254740994'); mode = 'full'; return reply(409, 'Dữ liệu dịch vụ đã thay đổi. Vui lòng tải lại dữ liệu'); }
    if (mode === 'status-conflict') return reply(409, 'Trạng thái dịch vụ không còn phù hợp. Vui lòng tải lại dữ liệu', null, { active: 'false' });
    if (mode === 'price-conflict') return reply(409, 'Không thể cập nhật đơn giá tại thời điểm được xác định');
    if (mode === 'price-required') return reply(409, 'Vui lòng thiết lập đơn giá trước khi bật dịch vụ');
    if (mode === 'gone') return reply(404, 'Không thể truy cập dịch vụ được yêu cầu');
    if (mode === 'invalid') return reply(400, 'Dữ liệu không hợp lệ', null, { name: 'SQL private', unexpected: 'secret' });
    if (mode === 'save-error') return reply(500, request.method() === 'POST' ? 'Thêm dịch vụ không thành công' : request.method() === 'PUT' ? 'Cập nhật dịch vụ không thành công' : 'Thay đổi trạng thái dịch vụ không thành công');
    const input = parse(request.postData()); const adding = request.method() === 'POST';
    const item = adding ? { ...rows[2], id: id(count++), systemCode: null, active: true } : rows.find((item) => item.id === url.pathname.split('/')[4]);
    const firstPrice = item.pricingStatus === 'UNCONFIGURED';
    if (request.method() === 'PATCH') item.active = input.active;
    else { item.name = input.name; item.unit = input.unit; item.defaultPrice = input.defaultPrice; item.pricingStatus = 'CONFIGURED'; item.currentPriceRevisionId = id(4); item.effectiveFrom = '2026-11-08T00:00:00Z'; if (firstPrice) item.active = true; if (adding) item.method = input.method; }
    item.version = new LosslessNumber(String(BigInt(item.version.toString()) + 1n)); if (adding) rows.push(item);
    if (mode === 'uncertain') { mode = 'full'; return request.abort('failed'); }
    if (mode === 'refresh-fail') mode = 'list-error';
    return reply(adding ? 201 : 200, adding ? 'Thêm dịch vụ thành công' : request.method() === 'PUT' ? 'Cập nhật dịch vụ thành công' : item.active ? 'Bật lại dịch vụ thành công' : 'Tắt dịch vụ thành công', item);
  }
  const list = url.pathname.endsWith('/services');
  if (mode === 'list-error' && list) return reply(500, 'Không thể tải danh mục dịch vụ');
  if (mode === 'detail-error' && !list) return reply(500, 'Không thể tải thông tin dịch vụ');
  if (mode === 'malformed') return reply(200, list ? 'Lấy danh mục dịch vụ thành công' : 'Lấy thông tin dịch vụ thành công', {});
  if (list) return reply(200, 'Lấy danh mục dịch vụ thành công', mode === 'empty' ? [] : rows);
  return reply(200, 'Lấy thông tin dịch vụ thành công', rows.find((item) => item.id === url.pathname.split('/').at(-1)));
});
const waitText = (text) => page.waitForFunction((text) => document.body.innerText.includes(text), {}, text);
const open = (path = '/services') => page.goto(base + path, { waitUntil: 'networkidle0' });
const ready = () => page.waitForSelector('.catalog-heading button:not(:disabled)');
const modal = () => page.waitForSelector('dialog[open]');
async function click(text, parent = 'body') {
  await page.waitForFunction((text, parent) => [...document.querySelector(parent).querySelectorAll('button')].some((node) => node.textContent.trim() === text && !node.disabled && node.getClientRects().length), {}, text, parent);
  await page.evaluate((text, parent) => [...document.querySelector(parent).querySelectorAll('button')].find((node) => node.textContent.trim() === text && !node.disabled && node.getClientRects().length).click(), text, parent);
}
const fill = async (selector, value) => { await page.waitForSelector(selector + ':not(:disabled)'); await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(selector, value); };
const writes = () => calls.filter((item) => item.path.includes('/services') && item.method !== 'GET');
const edit = async (target = id(3)) => { await open(`/services?action=edit&serviceId=${target}`); await page.waitForSelector('#catalog-name:not(:disabled)'); };
const shot = (name) => page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
async function check(name, run) { if (process.env.CATALOG_BROWSER_GROUP && !name.includes(process.env.CATALOG_BROWSER_GROUP)) return; await run(); checks.push(name); console.log('PASS ' + name); }
try {
  await page.setViewport({ width: 1440, height: 900 });
  await check('Host scope, no synthetic dashboard, accent-insensitive client filtering', async () => {
    await open(); await ready(); assert.equal(await page.$$eval('[aria-current=page]', (nodes) => nodes.length), 1);
    assert.equal(await page.$('#propertySwitcher'), null); assert.ok(calls.filter((call) => call.path.endsWith('/services')).every((call) => !call.search));
    await fill('#catalog-search', 'dien'); await page.keyboard.press('Enter'); await waitText('1 kết quả'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-search'); assert.ok(await page.$eval('.catalog-table', (node) => node.innerText.includes('Điện')));
    await shot('filtered-desktop');
  });
  await check('Back/Forward, direct modal, Escape and focus restoration', async () => {
    await open('/services?q=dien'); await ready(); await click('Thiết lập giá', '.catalog-table'); await page.waitForSelector('#catalog-name:not(:disabled)');
    await page.goBack(); await page.waitForFunction(() => !document.querySelector('dialog[open]')); await page.goForward(); await page.waitForSelector('#catalog-name:not(:disabled)');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); assert.equal(new URL(page.url()).searchParams.get('q'), 'dien');
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
    await open('/services?action=edit&serviceId=bad'); await waitText('Thao tác không hợp lệ'); assert.equal(await page.$('dialog[open]'), null);
  });
  await check('Provisioned first zero price is one PUT; method readonly and no PATCH', async () => {
    reset(); await edit(id(1)); assert.equal(await page.$eval('#catalog-defaultPrice', (node) => node.value), ''); await fill('#catalog-defaultPrice', '0');
    await click('Lưu và bật dịch vụ', 'dialog'); await waitText('Cập nhật dịch vụ thành công'); assert.equal(writes().length, 1); assert.equal(writes()[0].method, 'PUT');
    assert.deepEqual(Object.keys(parse(writes()[0].body)).sort(), ['defaultPrice', 'name', 'unit', 'version']); assert.equal(rows[0].active, true);
  });
  await check('All creation methods accept explicit zero and keep query context', async () => {
    for (const method of ['METERED', 'FIXED', 'QUANTITY', 'CUSTOM']) {
      await open('/services?q=khongkhop&action=create'); await ready(); await fill('#catalog-name', 'Dịch vụ ' + method); await fill('#catalog-unit', 'lần'); await page.select('#catalog-method', method); await fill('#catalog-defaultPrice', '0');
      await click('Thêm dịch vụ', 'dialog'); await waitText('Thêm dịch vụ thành công'); assert.equal(new URL(page.url()).searchParams.get('q'), 'khongkhop'); assert.ok(writes().at(-1).body.includes('"defaultPrice":0')); assert.equal(writes().at(-1).csrf, 'browser-uc19');
    }
  });
  await check('Lossless maximum price/version, explicit conflict review and retained draft', async () => {
    reset(); await edit(); await fill('#catalog-name', 'Bản nháp của tôi'); mode = 'stale'; await click('Lưu thay đổi', 'dialog'); await waitText('Thông tin hiện có');
    assert.equal(writes().length, 1); assert.equal(await page.$eval('dialog button[type=submit]', (node) => node.disabled), true);
    await click('Chỉnh sửa theo dữ liệu mới', 'dialog'); await fill('#catalog-defaultPrice', '9999999999999999999'); await shot('edit-price-desktop');
    await click('Lưu thay đổi', 'dialog'); await waitText('Cập nhật dịch vụ thành công'); assert.ok(writes().at(-1).body.includes('"version":9007199254740994')); assert.ok(writes().at(-1).body.includes('"defaultPrice":9999999999999999999'));
  });
  await check('Deactivate, price update while inactive and reactivate use explicit targets', async () => {
    await open(); await ready(); await click('Tắt dịch vụ', '.catalog-table'); await waitText('Các cấu hình phòng hiện hữu'); await click('Tắt dịch vụ', 'dialog'); await waitText('Tắt dịch vụ thành công');
    assert.equal(rows[2].active, false); await edit(); await fill('#catalog-defaultPrice', '9007199254740993'); await click('Lưu thay đổi', 'dialog'); await waitText('Cập nhật dịch vụ thành công'); assert.equal(rows[2].active, false);
    await click('Bật lại', '.catalog-table'); await waitText('không tự thêm dịch vụ vào các phòng'); await click('Bật lại dịch vụ', 'dialog'); await waitText('Bật lại dịch vụ thành công'); assert.equal(rows[2].active, true);
  });
  await check('Validation, CSRF, known save failures and distinct 409 branches do not retry', async () => {
    await open('/services?action=create'); await ready(); await click('Thêm dịch vụ', 'dialog'); await waitText('Vui lòng nhập tên dịch vụ'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-name');
    await edit(); mode = 'invalid'; await click('Lưu thay đổi', 'dialog'); await waitText('Vui lòng kiểm tra tên dịch vụ'); assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('SQL private'));
    mode = 'csrf'; await click('Lưu thay đổi', 'dialog'); await waitText('CSRF token bị thiếu'); mode = 'save-error'; await click('Lưu thay đổi', 'dialog'); await waitText('Cập nhật dịch vụ không thành công');
    mode = 'price-conflict'; const before = writes().length; await click('Lưu thay đổi', 'dialog'); await waitText('Không thể cập nhật đơn giá tại thời điểm được xác định'); assert.equal(writes().length, before + 1);
    mode = 'full'; await open('/services?action=deactivate&serviceId=' + id(3)); await waitText('Các cấu hình phòng hiện hữu'); mode = 'status-conflict'; await click('Tắt dịch vụ', 'dialog'); await waitText('Trạng thái hiện tại: Đã tắt'); assert.equal(await page.$('dialog[open]'), null); mode = 'full';
  });
  await check('Uncertain results and post-success refresh failure remain distinct', async () => {
    await edit(); mode = 'uncertain'; const before = writes().length; await click('Lưu thay đổi', 'dialog'); await waitText('Chưa xác định được kết quả. Dữ liệu có thể đã được lưu.'); assert.equal(writes().length, before + 1);
    await edit(); mode = 'refresh-fail'; await click('Lưu thay đổi', 'dialog'); await waitText('Cập nhật dịch vụ thành công'); await waitText('Đang hiển thị dữ liệu cũ'); assert.equal(await page.$eval('.catalog-table button', (node) => node.disabled), true);
    mode = 'full'; await click('Thử lại'); await ready(); await waitText('Cập nhật dịch vụ thành công');
  });
  await check('Dirty discard, double Enter/click, pending cancel and keyboard containment', async () => {
    await edit(); await fill('#catalog-name', 'Chưa lưu'); acceptDiscard = false; await click('Hủy', 'dialog'); assert.ok(await page.$('dialog[open]')); acceptDiscard = true;
    await page.focus('dialog button[type=submit]'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-name');
    let release; csrfGate = new Promise((resolve) => { release = resolve; }); const before = writes().length;
    await page.evaluate(() => { const form = document.querySelector('dialog form'); form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => document.querySelector('dialog [data-catalog-cancel]').disabled); await page.keyboard.press('Escape'); assert.ok(await page.$('dialog[open]'));
    release(); csrfGate = null; await waitText('Cập nhật dịch vụ thành công'); assert.equal(writes().length, before + 1);
  });
  await check('Read error, malformed data, empty catalog and permissions are distinct', async () => {
    for (const state of ['list-error', 'malformed', 'empty']) { mode = state; await open(); await waitText(state === 'empty' ? 'Danh mục chưa có dữ liệu' : 'Không thể tải danh mục dịch vụ'); }
    for (const value of ['ADMIN', 'CUSTOMER']) { reset(); role = value; await open('/services?action=create'); await waitText('Bạn không có quyền thực hiện chức năng này'); assert.equal(calls.filter((call) => call.path.includes('/services')).length, 0); }
    reset(); mode = 'session'; await open(); await waitText('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại'); assert.equal(calls.filter((call) => call.path.includes('/services')).length, 0); reset();
  });
  await check('Responsive records, mobile navigation, 200% reflow and reduced motion', async () => {
    rows[2].name = 'Dịch vụ vệ sinh khu vực chung có tên rất dài ' + 'dài '.repeat(15); rows[2].defaultPrice = new LosslessNumber('9999999999999999999');
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 900 }); await open(); await ready();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      assert.ok(await page.$$eval('.catalog-money', (nodes) => nodes.filter((node) => !node.querySelector('.catalog-help')).every((node) => { const range = document.createRange(); range.selectNodeContents(node); return range.getClientRects().length === 1 && range.getBoundingClientRect().right <= node.getBoundingClientRect().right + 1; })), 'Full price stays readable on one line at ' + width);
      if (width === 1024) assert.ok(await page.$eval('.catalog-table', (node) => node.getBoundingClientRect().height < 600), 'Tablet catalog retains compact table density');
      if (width <= 1024) { await click('Điều hướng'); assert.ok(await page.$eval('.dash-sidebar', (node) => getComputedStyle(node).display !== 'none')); await click('Danh mục dịch vụ', '.dash-sidebar'); }
      await shot('list-' + width); await edit(id(1)); assert.ok(await page.evaluate(() => { const box = document.querySelector('dialog').getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; })); await shot('setup-' + width);
    }
    // A 1440px window at 200% zoom has a 720 CSS-pixel layout viewport.
    await page.setViewport({ width: 720, height: 450 }); await open(); await ready(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('reflow-200-percent');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await edit(id(1));
    // RentOps base.css caps reduced-motion transitions at .01ms with !important.
    assert.ok(await page.$eval('#catalog-name', (node) => getComputedStyle(node).transitionDuration.split(',').every((duration) => parseFloat(duration) <= 0.00001)));
  });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, process.env.CATALOG_BROWSER_GROUP ? 'results-filtered.json' : 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, pageErrors: errors,
    data: 'Synthetic intercepted API responses with real App and UC19 components', backendTransactionsVerified: false }, null, 2));
  console.log(`UC19: ${checks.length} browser groups passed`);
} catch (error) { await shot('failure'); console.error({ mode, text: await page.evaluate(() => document.body.innerText), lastWrite: writes().at(-1), pageErrors: errors }); throw error; }
finally { await browser.close(); }
