import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { parse, stringify, LosslessNumber } from 'lossless-json';

const base = process.env.ASSETS_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/assets'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(); const errors = []; const checks = [];
const id = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const initial = () => Array.from({ length: 23 }, (_, index) => ({ assetId: index === 0 ? id : index === 1 ? secondId : '33333333-3333-4333-8333-' + String(index).padStart(12, '0'),
  name: index === 0 ? 'Máy lạnh Daikin 1.5 HP' : index === 1 ? 'Tủ lạnh Panasonic' : 'Tài sản kiểm thử ' + index,
  purchaseValue: new LosslessNumber(index === 0 ? '9007199254740993' : index === 1 ? '9999999999999999999' : '0'),
  condition: ['GOOD', 'DAMAGED', 'REPAIRING', 'RETIRED'][index % 4], note: index % 2 ? 'Ghi chú %_! có dấu tiếng Việt' : null,
  createdAt: '2026-10-31T17:00:00Z', updatedAt: '2026-11-01T02:35:00Z' }));
let rows = initial(), role = 'HOST', mode = 'full', calls = [], csrfGate = null, holdSearch = null, heldSearchDone = null;
page.on('pageerror', (error) => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', async (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) { await request.continue(); return; }
  calls.push({ path: url.pathname, search: url.search, method: request.method(), body: request.postData(), csrf: request.headers()['x-csrf-token'] });
  const reply = (status, message, data = null) => request.respond({ status, contentType: 'application/json', body: stringify({ status, message, data }) }).catch(() => undefined);
  if (url.pathname.endsWith('/auth/me')) return reply(200, 'OK', { accountId: 'browser-host', loginName: 'Chủ nhà kiểm thử', role, hostId: id, customerId: null });
  if (url.pathname.endsWith('/auth/csrf')) { if (csrfGate) await csrfGate; return reply(200, 'OK', { token: 'browser-token', headerName: 'X-CSRF-TOKEN' }); }
  if (!url.pathname.includes('/assets')) return reply(404, 'Unexpected endpoint in test');
  if (mode === 'session') return reply(401, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại');
  if (mode === 'forbidden') return reply(403, 'Bạn không có quyền thực hiện chức năng này');
  if (request.method() === 'POST' || request.method() === 'PUT') {
    if (mode === 'csrf') return reply(403, 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại');
    if (mode === 'write-error') return reply(500, 'SQL must not appear');
    if (mode === 'field-error') return request.respond({ status: 400, contentType: 'application/json', body: JSON.stringify({ status: 400, message: 'Dữ liệu không hợp lệ', fieldErrors: { name: 'Vui lòng nhập tên tài sản', hostId: 'SQL' } }) });
    const body = parse(request.postData()); const asset = rows.find((row) => url.pathname.includes(row.assetId));
    if (url.pathname.endsWith('/condition-records')) {
      asset.condition = body.condition;
      if (mode === 'uncertain') { mode = 'full'; return request.abort('failed'); }
      if (mode === 'refresh-error') mode = 'read-error';
      return reply(201, 'Ghi nhận tình trạng tài sản thành công', { recordId: secondId, assetId: asset.assetId, condition: body.condition, recordedAt: asset.updatedAt, recordedByAccountId: secondId, note: body.note });
    }
    if (request.method() === 'PUT') Object.assign(asset, body);
    else rows.unshift({ ...initial()[0], assetId: '99999999-9999-4999-8999-' + String(rows.length + 1).padStart(12, '0'), ...body, note: null, condition: 'GOOD' });
    const result = request.method() === 'PUT' ? asset : rows[0];
    if (mode === 'uncertain') { mode = 'full'; return request.abort('failed'); }
    if (mode === 'refresh-error') mode = 'read-error';
    return reply(request.method() === 'PUT' ? 200 : 201, request.method() === 'PUT' ? 'Cập nhật tài sản thành công' : 'Thêm tài sản thành công', result);
  }
  if (mode === 'loading') return;
  if (mode === 'read-error') return reply(500, url.pathname.endsWith('/assets') ? 'Không thể tải danh sách tài sản. Vui lòng thử lại sau' : 'Không thể tải thông tin tài sản. Vui lòng thử lại sau');
  if (mode === 'malformed') return reply(200, 'Lấy danh sách tài sản thành công', { content: [] });
  if (!url.pathname.endsWith('/assets')) {
    const asset = rows.find((row) => url.pathname.endsWith(row.assetId));
    return asset ? reply(200, 'Lấy thông tin tài sản thành công', asset) : reply(404, 'Không thể truy cập tài sản được yêu cầu');
  }
  const q = url.searchParams.get('q') || '', size = Number(url.searchParams.get('size')), index = Number(url.searchParams.get('page'));
  const held = holdSearch && q === 'cũ';
  if (held) await holdSearch;
  const found = mode === 'empty' ? [] : rows.filter((row) => (row.name + ' ' + (row.note || '')).toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  await reply(200, 'Lấy danh sách tài sản thành công', { content: found.slice(index * size, (index + 1) * size), page: index, size, totalElements: found.length, totalPages: Math.ceil(found.length / size), first: index === 0, last: index >= Math.ceil(found.length / size) - 1 });
  if (held) heldSearchDone?.();
});
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (value) => page.waitForFunction((needle) => document.body.innerText.includes(needle), {}, value);
async function open(path = '/assets') { await page.goto(base + path, { waitUntil: 'networkidle0' }); }
async function click(label, parent = 'body') {
  await page.waitForFunction((label, parent) => [...document.querySelector(parent).querySelectorAll('a,button')].some((node) => node.textContent.trim() === label && node.getClientRects().length && !node.disabled), {}, label, parent);
  await page.evaluate((label, parent) => [...document.querySelector(parent).querySelectorAll('a,button')].find((node) => node.textContent.trim() === label && node.getClientRects().length && !node.disabled).click(), label, parent);
}
async function fill(selector, value) { await page.waitForSelector(selector, { visible: true }); await page.click(selector, { count: 3 }); await page.keyboard.press('Backspace'); if (value) await page.type(selector, value); }
async function listReady() { await page.waitForFunction(() => { const button = document.querySelector('[data-create-asset]'); return button && !button.disabled; }); }
async function shot(name) { await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); }
const mutationCalls = () => calls.filter((call) => call.path.includes('/assets') && ['POST', 'PUT'].includes(call.method));
async function check(name, action) { await action(); checks.push(name); console.log('PASS ' + name); }

try {
  await page.setViewport({ width: 1280, height: 900 });
  await check('Host shell, server pagination, canonical query, exact display', async () => {
    await open('/assets?page=-2&size=3'); await listReady(); assert.match(page.url(), /page=0&size=20/);
    const body = await text(); assert.ok(body.includes('9.007.199.254.740.993')); assert.ok(body.includes('9.999.999.999.999.999.999')); assert.ok(body.includes('0')); assert.ok(body.includes('23 kết quả'));
    assert.ok(!body.includes('Chào buổi sáng') && !body.includes('Dữ liệu đồng bộ') && !body.includes('Tất cả cơ sở'));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('[aria-current="page"]')].filter((node) => node.getClientRects().length).length), 1);
    await click('Trang sau'); await waitText('Trang 2 / 2'); assert.equal(await page.$$eval('.asset-table tbody tr', (nodes) => nodes.length), 3);
    await page.select('.asset-size select', '10'); await waitText('Trang 1 / 3');
    await page.goBack(); await waitText('Trang 2 / 2'); await page.goForward(); await waitText('Trang 1 / 3');
  });
  await check('Debounced literal search, Enter, whitespace and query history', async () => {
    await fill('#asset-search', '%_!'); await page.keyboard.press('Enter'); await waitText('11 kết quả'); assert.equal(new URL(page.url()).searchParams.get('q'), '%_!');
    await fill('#asset-search', '  Máy lạnh  '); await page.keyboard.press('Enter'); await waitText('1 kết quả'); assert.equal(new URL(page.url()).searchParams.get('q'), 'Máy lạnh');
    await click('Xem chi tiết'); await waitText('Ngày tạo'); assert.equal(new URL(page.url()).searchParams.get('q'), 'Máy lạnh');
    await page.reload({ waitUntil: 'networkidle0' }); await waitText('Ngày tạo'); await click('Quay lại danh sách'); await listReady(); assert.equal(new URL(page.url()).searchParams.get('q'), 'Máy lạnh');
    await fill('#asset-search', '   '); await page.keyboard.press('Enter'); await waitText('23 kết quả'); assert.equal(new URL(page.url()).searchParams.get('q'), null);
    await fill('#asset-search', 'a'.repeat(201)); const previous = calls.length; await page.keyboard.press('Enter'); await waitText('Từ khóa không được vượt quá 200 ký tự'); assert.equal(calls.length, previous);
    await click('Xóa tìm kiếm'); await listReady();
  });
  await check('Create modal focus trap, Escape, backdrop, Back/Forward and direct entry', async () => {
    await page.focus('[data-create-asset]'); await click('Thêm tài sản'); await page.waitForSelector('dialog[open]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'asset-name');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Hủy');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'asset-name');
    await page.keyboard.press('Escape'); await page.waitForSelector('dialog', { hidden: true }); assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-create-asset')), true);
    await click('Thêm tài sản'); await page.goBack(); await page.waitForSelector('dialog', { hidden: true }); await page.goForward(); await page.waitForSelector('dialog[open]');
    await page.mouse.click(3, 3); await page.waitForSelector('dialog', { hidden: true });
    await open('/assets?create=1'); await page.waitForSelector('dialog[open]'); await click('Hủy', 'dialog'); assert.ok(!new URL(page.url()).searchParams.has('create')); assert.equal(mutationCalls().length, 0);
  });
  await check('Zero, 53-bit boundary and 19-digit numeric wire; pending cancellation; double submit', async () => {
    for (const amount of ['0', '9007199254740993', '9999999999999999999']) {
      await listReady(); await click('Thêm tài sản'); await fill('#asset-name', 'Máy kiểm thử ' + amount); await fill('#asset-purchaseValue', amount);
      const count = mutationCalls().length; let release; csrfGate = new Promise((done) => { release = done; });
      await page.evaluate(() => { const form = document.querySelector('dialog form'); form.requestSubmit(); form.requestSubmit(); });
      await page.waitForFunction(() => document.querySelector('dialog button[type="submit"]').disabled); await page.keyboard.press('Escape'); assert.ok(await page.$('dialog[open]'));
      await page.evaluate(() => { history.back(); }); await page.waitForFunction(() => new URL(location.href).searchParams.get('create') === '1'); assert.ok(await page.$('dialog[open]'));
      assert.equal(await page.$eval('dialog button[type="button"]', (node) => node.disabled), true); release(); csrfGate = null;
      await waitText('Thêm tài sản thành công'); await page.waitForSelector('dialog', { hidden: true }); await listReady();
      assert.equal(mutationCalls().length, count + 1); const call = mutationCalls().at(-1); assert.match(call.body, new RegExp('"purchaseValue":' + amount + '[,}]')); assert.equal(call.csrf, 'browser-token');
      assert.deepEqual(Object.keys(parse(call.body)), ['name', 'purchaseValue']); assert.ok(await page.$('a[href*="99999999-9999-4999-8999-"]'));
    }
  });
  await check('Edit general note, separate inspection note and same-condition record', async () => {
    await open('/assets/' + id + '/edit?q=Máy&page=0&size=20'); await page.waitForSelector('#asset-note');
    await fill('#asset-note', 'Ghi chú chung mới'); await click('Lưu'); await waitText('Cập nhật tài sản thành công'); await waitText('Ghi chú chung mới');
    const last = mutationCalls().at(-1); assert.equal(last.method, 'PUT'); assert.ok(!last.path.includes('condition-records')); assert.match(last.body, /"purchaseValue":9007199254740993/);
    await click('Ghi nhận tình trạng'); await page.waitForSelector('#asset-condition'); assert.equal(await page.$eval('#asset-condition', (node) => node.value), ''); assert.equal(await page.$eval('#asset-note', (node) => node.value), '');
    await click('Lưu ghi nhận'); await waitText('Vui lòng chọn tình trạng tài sản hợp lệ'); await page.select('#asset-condition', 'GOOD'); await fill('#asset-note', 'Kiểm tra vẫn tốt');
    const count = mutationCalls().length; await click('Lưu ghi nhận'); await waitText('Ghi nhận tình trạng tài sản thành công'); assert.equal(mutationCalls().length, count + 1); assert.equal(mutationCalls().at(-1).body, '{"condition":"GOOD","note":"Kiểm tra vẫn tốt"}'); await waitText('Ghi chú chung mới');
  });
  await check('Mutation refresh error preserves success, blocks stale actions; retry recovers', async () => {
    await open('/assets/' + id + '/edit'); await page.waitForSelector('#asset-name'); mode = 'refresh-error'; await click('Lưu');
    await waitText('Cập nhật tài sản thành công'); await waitText('Không thể tải thông tin tài sản. Vui lòng thử lại sau');
    assert.equal(await page.$eval('.asset-panel [aria-disabled="true"]', (node) => node.textContent), 'Chỉnh sửa'); mode = 'full'; await click('Thử lại'); await waitText('Ngày tạo');
  });
  await check('Uncertain outcome reloads and warns without automatic duplicate', async () => {
    await open('/assets/' + id + '/condition'); await page.waitForSelector('#asset-condition'); await page.select('#asset-condition', 'GOOD'); mode = 'uncertain'; const count = mutationCalls().length;
    await click('Lưu ghi nhận'); await waitText('Chưa xác định được kết quả lưu'); await waitText('bạn có thể tạo thêm tài sản hoặc bản ghi tình trạng'); await waitText('Ngày tạo'); assert.equal(mutationCalls().length, count + 1);
  });
  await check('Validation, CSRF and save failures retain draft and focus', async () => {
    await open('/assets/' + id + '/edit'); await page.waitForSelector('#asset-name'); await fill('#asset-name', 'Tên chưa lưu');
    mode = 'csrf'; await click('Lưu'); await waitText('CSRF token bị thiếu hoặc không hợp lệ'); assert.equal(await page.$eval('#asset-name', (node) => node.value), 'Tên chưa lưu');
    mode = 'field-error'; await click('Lưu'); await waitText('Vui lòng nhập tên tài sản'); assert.equal(await page.evaluate(() => document.activeElement.id), 'asset-name');
    mode = 'write-error'; await click('Lưu'); await waitText('Không thể hoàn tất thao tác'); assert.equal(await page.$eval('#asset-name', (node) => node.value), 'Tên chưa lưu'); mode = 'full';
  });
  await check('Loading, empty, search empty, error, malformed and missing asset', async () => {
    mode = 'loading'; await page.goto(base + '/assets', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.asset-skeleton'); await shot('loading');
    mode = 'empty'; await open(); await waitText('Chưa có tài sản'); assert.ok(!(await text()).includes('Trang 1 / 0')); await shot('empty');
    mode = 'full'; await open('/assets?q=Khôngtồntại'); await waitText('Không tìm thấy tài sản phù hợp');
    mode = 'read-error'; await open(); await waitText('Không thể tải danh sách tài sản'); await shot('error');
    mode = 'malformed'; await open(); await waitText('Không thể tải danh sách tài sản'); assert.ok(!(await text()).includes('Chưa có tài sản'));
    mode = 'full'; await open('/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); await waitText('Không thể truy cập tài sản được yêu cầu'); assert.equal(new URL(page.url()).pathname, '/assets');
    await open('/assets?page=99'); await listReady(); await page.waitForFunction(() => new URL(location.href).searchParams.get('page') !== '99'); assert.ok(!(await text()).includes('Chưa có tài sản'));
  });
  await check('Old search response cannot overwrite new query', async () => {
    await open(); await listReady(); let release; holdSearch = new Promise((done) => { release = done; }); const oldFinished = new Promise((done) => { heldSearchDone = done; });
    await fill('#asset-search', 'cũ'); await page.keyboard.press('Enter'); await page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'cũ');
    await fill('#asset-search', 'Daikin'); await page.keyboard.press('Enter'); await waitText('1 kết quả'); release(); holdSearch = null;
    await oldFinished; await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))); heldSearchDone = null;
    assert.ok((await text()).includes('Máy lạnh Daikin')); assert.ok(!(await text()).includes('Không tìm thấy tài sản phù hợp'));
  });
  await check('Host-only access, 403 clearing and 401 session reset', async () => {
    for (const candidate of ['ADMIN', 'CUSTOMER']) { role = candidate; calls = []; await open('/assets?create=1'); await waitText('Bạn không có quyền thực hiện chức năng này'); assert.equal(calls.filter((call) => call.path.includes('/assets')).length, 0); }
    role = 'HOST'; mode = 'forbidden'; await open(); await waitText('Bạn không có quyền thực hiện chức năng này'); assert.ok(!(await text()).includes('Daikin'));
    mode = 'session'; calls = []; await open(); await waitText('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại'); assert.equal(new URL(page.url()).pathname, '/'); assert.ok(!calls.some((call) => call.path.endsWith('/logout'))); mode = 'full';
  });
  await check('Responsive 375/834/1280/1920, long content, mobile nav, 200% reflow and reduced motion', async () => {
    rows = initial().slice(0, 4); rows[0].name += ' — ' + 'TàiSảnTênDàiKhôngCóKhoảngTrắng'.repeat(5); rows[0].note = 'Ghi chú dài '.repeat(50);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    for (const width of [375, 834, 1280, 1920]) {
      await page.setViewport({ width, height: 900 }); await open(); await listReady(); await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow at ' + width);
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('.asset-money')].filter((node) => node.getClientRects().length).every((node) => { const range = document.createRange(); range.selectNodeContents(node); return range.getClientRects().length === 1 && range.getBoundingClientRect().right <= node.getBoundingClientRect().right + 1; })), 'Money remains on one readable line at ' + width);
      assert.ok(await page.$eval('.logout-btn', (node) => node.getBoundingClientRect().height >= 44), '44px logout target');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('[aria-current="page"]')].filter((node) => node.getClientRects().length).length), 1);
      if (width < 1024) { await click('Tổng quan', '.asset-mobile-nav'); await click('Tài sản', '.asset-mobile-nav'); await listReady(); }
      await shot('list-' + width); await open('/assets/' + id + '/edit'); await page.waitForSelector('#asset-name'); await shot('edit-' + width);
      await open('/assets/' + id + '/condition'); await page.waitForSelector('#asset-condition'); await shot('condition-' + width);
      await open('/assets?create=1'); await page.waitForSelector('dialog[open]'); await shot('create-' + width);
    }
    // Effective viewport at 200% browser zoom on a 1280px display: 640 CSS pixels.
    await page.setViewport({ width: 640, height: 450, deviceScaleFactor: 2 }); await open(); await listReady();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.asset-mobile-records .asset-money')].every((node) => { const range = document.createRange(); range.selectNodeContents(node); return range.getClientRects().length === 1 && range.getBoundingClientRect().right <= node.getBoundingClientRect().right + 1; }))); await shot('reflow-200');
  });
  assert.deepEqual(errors, []); writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, pageErrors: errors, data: 'synthetic intercepted API responses; real App and UC17 components', backendTransactionsVerified: false }, null, 2));
  console.log(`UC17 browser: ${checks.length} groups passed`);
} catch (error) { await shot('failure'); console.error(await text()); throw error; }
finally { await browser.close(); }
