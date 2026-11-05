import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LosslessNumber, stringify } from 'lossless-json';

const base = process.env.ASSETS_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/asset-placements'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(); const errors = [], checks = [];
const id = '11111111-1111-4111-8111-111111111111';
const uuid = (n) => '22222222-2222-4222-8222-' + String(n).padStart(12, '0');
const roomA = uuid(1), roomB = uuid(2);
const rooms = [{ id: roomA, code: '101', name: 'Phòng cùng tên', areaName: 'Khu Đông', buildingName: 'Tòa A', floorName: 'Tầng 1', status: 'OCCUPIED' },
  { id: roomB, code: '202', name: 'Phòng cùng tên', areaName: 'Khu Tây', buildingName: 'Tòa B', floorName: 'Tầng 2', status: 'MAINTENANCE' }];
let asset, locations, conditions, count, calls, mode = 'full', role = 'HOST', csrfGate = null;
function reset() {
  asset = { assetId: id, name: 'Máy lạnh Daikin 1.5 HP', purchaseValue: new LosslessNumber('9999999999999999999'), condition: 'GOOD', note: null,
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', currentPlacement: null };
  locations = []; count = 10; calls = []; mode = 'full'; role = 'HOST';
  conditions = [{ recordId: uuid(9), assetId: id, condition: 'GOOD', recordedAt: asset.createdAt, recordedByAccountId: uuid(8), note: null,
    placementId: null, roomId: null, roomCode: null, roomName: null }];
}
reset();
const at = () => `2026-11-02T00:00:${String(count++).padStart(2, '0')}.000001Z`;
page.on('pageerror', (error) => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', async (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) { await request.continue(); return; }
  calls.push({ path: url.pathname, search: url.search, method: request.method(), body: request.postData(), csrf: request.headers()['x-csrf-token'] });
  const reply = (status, message, data = null) => request.respond({ status, contentType: 'application/json', body: stringify({ status, message, data }) }).catch(() => undefined);
  if (url.pathname.endsWith('/auth/me')) return mode === 'session' ? reply(401, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại') : reply(200, 'OK', { accountId: uuid(8), loginName: 'Host kiểm thử UC18', role, hostId: id, customerId: null });
  if (url.pathname.endsWith('/auth/refresh')) return reply(401, 'Expired');
  if (url.pathname.endsWith('/auth/csrf')) { if (csrfGate) await csrfGate; return reply(200, 'OK', { token: 'browser-uc18', headerName: 'X-CSRF-TOKEN' }); }
  if (mode === 'forbidden') return reply(403, 'Bạn không có quyền thực hiện chức năng này');
  if (url.pathname.endsWith('/rooms/search')) {
    if (mode === 'room-error') return reply(500, 'Không thể tải danh sách phòng. Vui lòng thử lại');
    if (mode === 'room-empty') return reply(200, 'Không tìm thấy phòng phù hợp', []);
    return reply(200, 'Tra cứu danh sách phòng thành công', rooms);
  }
  if (!url.pathname.includes('/assets')) return reply(404, 'Unexpected test endpoint');
  if (request.method() === 'POST') {
    if (mode === 'csrf') return reply(403, 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại');
    if (mode === 'source-changed') return reply(409, 'Dữ liệu bố trí đã thay đổi. Vui lòng tải lại dữ liệu');
    if (mode === 'same-room') return reply(409, 'Tài sản đang được bố trí tại phòng đã chọn. Vui lòng chọn phòng khác');
    if (mode === 'room-gone') return reply(404, 'Không thể truy cập phòng được yêu cầu');
    const input = JSON.parse(request.postData());
    if (url.pathname.endsWith('/condition-records')) {
      asset.condition = input.condition;
      const record = { recordId: uuid(count + 100), assetId: id, condition: input.condition, recordedAt: at(), recordedByAccountId: uuid(8), note: input.note,
        placementId: asset.currentPlacement?.placementId || null, roomId: asset.currentPlacement?.roomId || null,
        roomCode: asset.currentPlacement?.roomCode || null, roomName: asset.currentPlacement?.roomName || null };
      conditions.unshift(record);
      return reply(201, 'Ghi nhận tình trạng tài sản thành công', record);
    }
    const transfer = url.pathname.endsWith('/transfers');
    if (mode === 'save-error') return reply(500, transfer ? 'Chuyển tài sản không thành công' : 'Gán tài sản không thành công');
    const room = rooms.find((item) => item.id === input.roomId), time = at();
    if (transfer) {
      assert.equal(input.sourcePlacementId, asset.currentPlacement.placementId);
      locations.find((item) => item.placementId === input.sourcePlacementId).toAt = time;
    }
    const placement = { placementId: uuid(count + 200), assetId: id, roomId: room.id, roomCode: room.code, roomName: room.name, fromAt: time, toAt: null, conditionAtStart: asset.condition };
    locations.unshift(placement); asset.currentPlacement = { ...placement };
    if (mode === 'uncertain') { mode = 'full'; return request.abort('failed'); }
    if (mode === 'refresh-error') mode = 'detail-error';
    return reply(transfer ? 200 : 201, transfer ? 'Chuyển tài sản thành công' : 'Gán tài sản vào phòng thành công', placement);
  }
  if (url.pathname.endsWith('/history')) {
    if (mode === 'history-error') return reply(500, 'Không thể tải lịch sử tài sản');
    if (mode === 'malformed-history') return reply(200, 'Lấy lịch sử tài sản thành công', { assetId: id });
    return reply(200, 'Lấy lịch sử tài sản thành công', { assetId: id, locationHistory: locations, conditionHistory: conditions });
  }
  if (url.pathname.endsWith('/assets')) return reply(200, 'Lấy danh sách tài sản thành công', { content: [asset], page: 0, size: Number(url.searchParams.get('size') || '20'), totalElements: 1, totalPages: 1, first: true, last: true });
  if (mode === 'detail-error') return reply(500, 'Không thể tải thông tin tài sản. Vui lòng thử lại sau');
  return reply(200, 'Lấy thông tin tài sản thành công', asset);
});
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (value) => page.waitForFunction((needle) => document.body.innerText.includes(needle), {}, value);
const open = (path = '/assets') => page.goto(base + path, { waitUntil: 'networkidle0' });
async function click(label, parent = 'body') {
  await page.waitForFunction((label, parent) => [...document.querySelector(parent).querySelectorAll('button,a')].some((node) => node.textContent.trim() === label && node.getClientRects().length && !node.disabled), {}, label, parent);
  await page.evaluate((label, parent) => [...document.querySelector(parent).querySelectorAll('button,a')].find((node) => node.textContent.trim() === label && node.getClientRects().length && !node.disabled).click(), label, parent);
}
const modal = () => page.waitForFunction(() => document.querySelector('dialog[open] #asset-roomId:not(:disabled)'));
const choose = async (id) => { await modal(); await page.select('#asset-roomId', id); };
const writes = () => calls.filter((call) => call.method === 'POST' && call.path.includes('/assets'));
const shot = (name) => page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
async function check(name, action) { await action(); checks.push(name); console.log('PASS ' + name); }
try {
  await page.setViewport({ width: 1440, height: 900 });
  await check('List/detail dialogs, cancel focus, Back/Forward and query context', async () => {
    await open('/assets?q=Máy&page=0&size=50'); await waitText('Chưa bố trí');
    await page.focus('.asset-table button'); await click('Gán vào phòng', '.asset-table'); await modal();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'asset-roomId');
    await page.goBack(); await page.waitForFunction(() => !document.querySelector('dialog[open]')); await page.goForward(); await modal();
    await choose(roomA); await click('Hủy', 'dialog'); assert.equal(new URL(page.url()).searchParams.get('q'), 'Máy'); assert.equal(writes().length, 0);
    await open(`/assets/${id}?placement=assign`); await modal(); await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(new URL(page.url()).pathname, '/assets/' + id);
  });
  await check('Assignment, repeated inspection, transfer and independent historical context', async () => {
    await open(`/assets/${id}?placement=assign`); await choose(roomA); await click('Xác nhận gán', 'dialog'); await waitText('Gán tài sản vào phòng thành công');
    assert.ok(await page.evaluate(() => document.activeElement !== document.body), 'Restore focus after successful modal submission');
    assert.equal(conditions.length, 1); assert.deepEqual(JSON.parse(writes()[0].body), { roomId: roomA }); assert.equal(writes()[0].csrf, 'browser-uc18');
    for (let index = 0; index < 2; index++) {
      await click('Ghi nhận tình trạng'); await page.waitForSelector('#asset-condition'); await page.select('#asset-condition', 'DAMAGED'); await click('Lưu ghi nhận'); await waitText('Ghi nhận tình trạng tài sản thành công');
    }
    await click('Chuyển phòng'); await modal(); assert.equal(await page.$eval('#asset-roomId', (node) => [...node.options].some((option) => option.value === '22222222-2222-4222-8222-000000000001')), false);
    const source = asset.currentPlacement.placementId; await choose(roomB); await click('Xác nhận chuyển', 'dialog'); await waitText('Chuyển tài sản thành công');
    assert.equal(conditions.length, 3); assert.equal(JSON.parse(writes().at(-1).body).sourcePlacementId, source);
    assert.equal(locations[1].toAt, locations[0].fromAt); assert.equal(locations[1].conditionAtStart, 'GOOD');
    await click('Xem lịch sử'); await waitText('Không có phòng bố trí tại thời điểm ghi nhận');
    assert.equal(await page.$$eval('.asset-history-table:nth-of-type(1)', (nodes) => nodes.length), 2);
    assert.equal(await page.$$eval('.asset-history-section:nth-of-type(2) tbody tr', (nodes) => nodes.length), 3);
    const rows = await page.$$eval('.asset-history-section:nth-of-type(2) tbody tr', (nodes) => nodes.map((node) => node.innerText));
    assert.ok(rows[0].includes('101 —') && rows[1].includes('101 —') && !rows[2].includes('202 —')); await shot('history-desktop');
  });
  await check('Empty histories, read errors and malformed responses remain distinct', async () => {
    reset(); conditions = []; await open(`/assets/${id}/history`); await waitText('Chưa có lịch sử vị trí'); await waitText('Chưa có lịch sử tình trạng'); await shot('history-empty');
    mode = 'history-error'; await open(`/assets/${id}/history`); await waitText('Không thể tải lịch sử tài sản'); assert.ok(!(await text()).includes('Chưa có lịch sử vị trí')); await shot('history-error');
    mode = 'malformed-history'; await click('Thử lại'); await waitText('Không thể tải lịch sử tài sản'); mode = 'full'; await click('Thử lại'); await waitText('Chưa có lịch sử vị trí');
  });
  await check('Room loading errors/empty do not block history; invalid modal URL is normalized', async () => {
    for (const candidate of ['room-empty', 'room-error']) {
      mode = candidate; await open(`/assets/${id}?placement=assign`); await waitText(candidate === 'room-empty' ? 'Không có phòng đích phù hợp' : 'Không thể tải danh sách phòng');
      assert.equal(await page.$eval('dialog button[type=submit]', (node) => node.disabled), true); await click('Hủy', 'dialog'); await click('Xem lịch sử'); await waitText('Chưa có lịch sử vị trí');
    }
    mode = 'full'; await open('/assets?placement=assign&targetAssetId=bad'); await waitText('Vui lòng lựa chọn đầy đủ'); assert.equal(new URL(page.url()).searchParams.has('placement'), false);
  });
  await check('CSRF, room 404, save failure and uncertain outcome never silently retry', async () => {
    reset(); await open(`/assets/${id}?placement=assign`); await choose(roomA); mode = 'csrf'; await click('Xác nhận gán', 'dialog'); await waitText('CSRF token bị thiếu hoặc không hợp lệ');
    assert.equal(await page.$eval('#asset-roomId', (node) => node.value), roomA);
    mode = 'room-gone'; await click('Xác nhận gán', 'dialog'); await waitText('Không thể truy cập phòng được yêu cầu'); await modal(); assert.equal(await page.$eval('#asset-roomId', (node) => node.value), '');
    await choose(roomA); mode = 'save-error'; await click('Xác nhận gán', 'dialog'); await waitText('Gán tài sản không thành công'); assert.equal(writes().length, 3);
    mode = 'full'; await click('Gán vào phòng'); await choose(roomA); mode = 'uncertain'; await click('Xác nhận gán', 'dialog'); await waitText('Chưa xác định được kết quả bố trí'); assert.equal(writes().length, 4); assert.equal(locations.length, 1);
  });
  await check('409 same-room keeps selection flow; changed source ends the current transfer', async () => {
    await open(`/assets/${id}?placement=transfer`); await choose(roomB); mode = 'same-room'; await click('Xác nhận chuyển', 'dialog'); await waitText('Tài sản đang được bố trí tại phòng đã chọn');
    await choose(roomB); mode = 'source-changed'; const before = writes().length; await click('Xác nhận chuyển', 'dialog'); await waitText('Dữ liệu bố trí đã thay đổi');
    assert.equal(writes().length, before + 1); assert.equal(await page.$('dialog[open]'), null); mode = 'full';
  });
  await check('Mutation success survives failed refresh and stale actions stay blocked', async () => {
    reset(); await open(`/assets/${id}?placement=assign`); await choose(roomA); mode = 'refresh-error'; await click('Xác nhận gán', 'dialog');
    await waitText('Gán tài sản vào phòng thành công'); await waitText('Không thể tải thông tin tài sản'); assert.equal(await page.$eval('.asset-form-actions button', (node) => node.disabled), true);
    mode = 'full'; await click('Thử lại'); await waitText('Chuyển phòng');
  });
  await check('Navigation during pending CSRF suppresses a stale POST', async () => {
    reset(); await open(`/assets/${id}`); await click('Gán vào phòng'); await choose(roomA); let release; csrfGate = new Promise((done) => { release = done; });
    await click('Xác nhận gán', 'dialog'); await waitText('Đang lưu');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && !new URL(location.href).searchParams.has('placement'));
    const delivered = page.waitForResponse((response) => response.url().endsWith('/auth/csrf') && response.status() === 200);
    release(); csrfGate = null; await delivered;
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    assert.equal(writes().length, 0);
  });
  await check('Host-only access and session termination clear protected screens', async () => {
    for (const candidate of ['ADMIN', 'CUSTOMER']) { role = candidate; calls = []; await open(`/assets/${id}/history`); await waitText('Bạn không có quyền thực hiện chức năng này'); assert.equal(calls.filter((call) => call.path.includes('/assets') || call.path.includes('/rooms/search')).length, 0); }
    role = 'HOST'; mode = 'forbidden'; await open('/assets'); await waitText('Bạn không có quyền thực hiện chức năng này'); assert.ok(!(await text()).includes('Daikin'));
    mode = 'session'; await open(`/assets/${id}?placement=assign`); await waitText('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại'); assert.equal(new URL(page.url()).pathname, '/');
  });
  await check('390/768/1024/1440 layouts, long content, dialog focus trap and reduced motion', async () => {
    reset(); asset.name += ' — ' + 'TàiSảnTênDàiKhôngKhoảngTrắng'.repeat(4); rooms[1].name += ' — Phòng có tên dài để kiểm tra xuống dòng';
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 900 }); await open('/assets'); await waitText('Chưa bố trí'); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('[aria-current="page"]')].filter((node) => node.getClientRects().length).length), 1, 'Exactly one visible navigation entry at ' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'list overflow ' + width); await shot('list-' + width);
      await open(`/assets/${id}?placement=assign`); await modal();
      assert.ok(await page.$eval('dialog', (node) => node.scrollWidth <= node.clientWidth + 1), 'dialog overflow ' + width);
      await page.focus('dialog button:last-child'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'asset-roomId'); await shot('assign-' + width);
      await open(`/assets/${id}/history`); await waitText('Không có phòng bố trí tại thời điểm ghi nhận'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'history overflow ' + width); await shot('history-' + width);
    }
    await page.setViewport({ width: 640, height: 450, deviceScaleFactor: 2 }); await open(`/assets/${id}?placement=assign`); await modal();
    assert.ok(await page.$eval('dialog', (node) => node.scrollWidth <= node.clientWidth + 1)); await shot('reflow-200');
  });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks, pageErrors: errors,
    data: 'synthetic intercepted API responses; real App, shell, UC17 and UC18', backendTransactionsVerified: false }, null, 2));
  console.log(`UC18 browser: ${checks.length} groups passed`);
} catch (error) { await shot('failure'); console.error({ pageErrors: errors, text: await text() }); throw error; }
finally { await browser.close(); }
