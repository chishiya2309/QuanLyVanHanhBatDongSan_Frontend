import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
const base = 'http://127.0.0.1:5182';
const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const output = '.hallmark/shots/customer-lookup';
mkdirSync(output, { recursive: true });
let mode = 'full'; const calls = [];
const customer = { id: id(2), fullName: 'Nguyễn Văn An', phone: '0901234567', identityType: null, identityNo: null, email: null, birthDate: null, address: null, note: null, version: 0 };
const stay = { tenancyId: id(5), roomId: id(3), roomCode: 'A101', roomName: 'Phòng A101', buildingId: id(4), buildingName: 'Tòa An Bình', contractId: id(6), contractNumber: 'HD-2026-01', contractStartDate: '2026-01-01', contractEndDate: '2026-12-31', fromDate: '2026-01-01', toDate: null, contractStatus: 'ACTIVE', current: true };
const server = await createServer({ server: { port: 5182, strictPort: true, host: '127.0.0.1' }, plugins: [{ name: 'uc22-test-fixture', configureServer(server) {
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, base);
    if (!url.pathname.startsWith('/api/')) return next();
    calls.push(url.pathname + url.search);
    const reply = (data, status = 200, extra = {}) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ status, message: 'OK', data, ...extra })); };
    if (url.pathname.endsWith('/auth/me')) return reply({ accountId: id(99), loginName: 'Host UC22', role: 'HOST', hostId: id(1), customerId: null });
    if (url.pathname.endsWith('/profile')) return reply({ accountId: id(99), businessName: 'Host kiểm thử', businessPhone: '0901234567', businessEmail: 'host@example.test', officeAddress: '', version: 0 });
    if (url.pathname.endsWith('/rooms/search')) return reply([{ id: id(3), code: 'A101', buildingName: 'Tòa An Bình' }]);
    if (url.pathname.endsWith('/customers/search')) {
      if (mode === 'error') return reply(null, 500, { code: 'RENTAL_DATA_INCONSISTENT' });
      const size = Number(url.searchParams.get('size') || 20), requestedPage = Number(url.searchParams.get('page') || 0);
      const content = mode === 'empty' ? [] : [{ ...customer, rentals: [stay, { ...stay, tenancyId: id(7), roomCode: 'B202' }] }];
      const data = { content, page: 0, requestedPage, pageReset: requestedPage > 0, size, totalElements: content.length, totalPages: content.length ? 1 : 0, first: true, last: true };
      if (mode === 'loading') return setTimeout(() => reply(data), 1500);
      return reply(data);
    }
    if (url.pathname.endsWith('/rental-history')) return mode === 'error' ? reply(null, 500, { code: 'RENTAL_DATA_INCONSISTENT' })
      : reply({ customerId: id(2), items: mode === 'empty' ? [] : [stay, { ...stay, tenancyId: id(7), roomCode: 'B202', fromDate: '2025-01-01', toDate: '2026-01-01', current: false }] });
    if (url.pathname.endsWith('/customers/' + id(2))) return reply(customer, 200, { message: 'Lấy thông tin Customer thành công' });
    return reply(null, 404);
  });
} }] });
await server.listen();
console.log(`UC22 fixture ${base}; pid=${process.pid}`);
if (process.argv.includes('--serve-only')) await new Promise(() => {});
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + '/customers/search?mode=CURRENT'); await page.waitForSelector('.lookup-table');
  assert.equal(await page.$$eval('.lookup-table tbody tr', rows => rows.length), 1);
  assert.ok((await page.$eval('.lookup-table', el => el.textContent)).includes('B202'));
  await page.screenshot({ path: output + '/desktop.png', fullPage: true });
  await page.focus('.lookup-filters input');
  assert.ok(await page.$eval('.lookup-filters input', el => el.matches(':focus-visible')));
  await page.type('.lookup-filters input', 'An'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.search.includes('q=An')); await page.waitForSelector('.lookup-table');
  await page.click('.lookup-table a'); await page.waitForSelector('.lookup-history');
  assert.ok((await page.$eval('.lookup-history', el => el.textContent)).includes('Chưa kết thúc'));
  await page.screenshot({ path: output + '/history.png', fullPage: true });
  await page.goBack(); await page.waitForSelector('.lookup-table'); assert.ok(page.url().includes('q=An'));
  await page.goForward(); await page.waitForSelector('.lookup-history');
  await page.goBack(); await page.waitForSelector('.lookup-table');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.$eval('.lookup-table a', el => { const r = el.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; }));
  await page.screenshot({ path: output + '/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  mode = 'loading'; await page.reload(); await page.waitForSelector('.lookup-skeleton');
  await page.screenshot({ path: output + '/loading.png', fullPage: true }); await page.waitForSelector('.lookup-table');
  mode = 'empty'; await page.reload(); await page.waitForFunction(() => document.body.textContent.includes('Không có Customer đang thuê phù hợp'));
  await page.screenshot({ path: output + '/empty.png', fullPage: true });
  mode = 'error'; await page.reload(); await page.waitForSelector('.lookup-state[role=alert]');
  assert.ok(!(await page.$eval('.lookup-page', el => el.textContent)).includes('0 Customer phù hợp'));
  await page.screenshot({ path: output + '/error.png', fullPage: true });
  mode = 'full'; await page.goto(base + '/customers/search?mode=CURRENT&page=999'); await page.waitForSelector('.lookup-table');
  await page.waitForFunction(() => !location.search.includes('page='));
  assert.deepEqual(errors, []);
  writeFileSync(output + '/checks.json', JSON.stringify({ checks: ['desktop', 'mobile', 'loading', 'keyboard focus', 'search submit', 'history intervals', 'back context', 'forward context', 'mobile history action', 'empty', 'error', 'page reset'], errors, calls }, null, 2));
  console.log('UC22 browser checks passed');
} finally { await browser.close(); if (!process.argv.includes('--serve')) await server.close(); }
if (process.argv.includes('--serve')) console.log('Fixture remains available for Hallmark render');
