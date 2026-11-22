import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path));
assert.ok(chrome, 'Set CHROME_PATH for the browser test');
const screenshots = process.env.UC70_SCREENSHOTS || join(tmpdir(), 'uc70-screenshots');
mkdirSync(screenshots, { recursive: true });

const route = '/reports/expiring-leases';
const bucketNames = ['OVERDUE', 'DAYS_0_TO_7', 'DAYS_8_TO_30', 'OVER_30'];
const leases = [-3, -1, 0, 7, 10, 34].map((daysRemaining, i) => ({
  contractId: 'lease-' + i, contractNumber: 'HD-00' + i, roomId: 'room-' + i, roomCode: 'A10' + i,
  buildingName: 'Tòa A', effectiveEndDate: new Date(Date.UTC(2026, 10, 21 + daysRemaining)).toISOString().slice(0, 10),
  daysRemaining, handoverStatus: i === 0 ? 'Đã bàn giao – Chờ hoàn tất hợp đồng' : 'Chưa bàn giao',
  customerName: 'Khách thuê ' + i, customerPhone: null, depositRequired: 3500000, depositHeld: null,
}));
const requests = [];
let mode = 'full';
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  if (path.startsWith('/api/v1/')) {
    let status = 200;
    let data;
    switch (path.slice(7)) {
      case '/auth/me': data = { accountId: 'test-host', loginName: 'Chủ nhà', role: 'HOST', hostId: 'host' }; break;
      case '/areas': data = [{ id: 'north', name: 'Khu Bắc', active: true }]; break;
      case '/buildings': data = [{ id: 'building-a', name: 'Tòa A', areaId: 'north', active: true }]; break;
      case '/host/settings/expiry-threshold': data = { expiryThresholdDays: 60, source: 'BACKEND_DEFAULT' }; break;
      case route: {
        requests.push(url.searchParams);
        if (mode === 'failure') { status = 500; break; }
        const page = Number(url.searchParams.get('page') || 0);
        const size = Number(url.searchParams.get('size') || 20);
        const rows = mode === 'empty' ? [] : leases;
        const visible = rows.slice(page * size, (page + 1) * size);
        const bucket = row => bucketNames[row.daysRemaining < 0 ? 0 : row.daysRemaining <= 7 ? 1 : row.daysRemaining <= 30 ? 2 : 3];
        data = {
          asOfDate: '2026-11-21', generatedAt: '2026-11-21T00:00:00Z',
          filter: { fromDate: '2026-11-21', toDate: '2027-01-20' },
          kpi: { expiringContracts: rows.length ? 4 : 0, expiringRooms: rows.length ? 4 : 0, overdueContracts: rows.length ? 2 : 0 },
          expiryGroups: bucketNames.map(name => ({
            bucket: name, total: rows.filter(row => bucket(row) === name).length,
            items: visible.filter(row => bucket(row) === name),
          })),
          page: { page, size, totalPages: Math.ceil(rows.length / size), totalElements: rows.length },
          warnings: rows.length ? [{ code: 'VACANT_WITH_ACTIVE_CONTRACT', roomId: 'room-0', contractId: 'lease-0' }] : [],
        };
        break;
      }
      case '/rental-contracts': data = { content: [], pageNumber: 0, pageSize: 15, totalElements: 0, totalPages: 0, last: true }; break;
      case '/rental-contracts/expiring-count': data = 0; break;
      case '/rental-contracts/lease-0':
        data = { id: 'lease-0', contractNumber: 'HD-000', status: 'ACTIVE', startDate: '2026-09-01', endDate: '2026-11-18',
          customerName: 'Khách thuê 0', currentRoomCode: 'A100', depositRequired: 3500000, tenancies: [], amendments: [] };
        break;
      default: status = 404;
    }
    response.writeHead(status, { 'Content-Type': 'application/json' });
    const send = () => response.end(JSON.stringify({ status, data, message: 'Test fixture' }));
    if (path === '/api/v1' + route && mode === 'loading') return setTimeout(send, 900);
    return send();
  }
  const asset = /^\/assets\/[\w.-]+\.(js|css)$/.exec(path);
  const file = asset ? path.slice(1) : 'index.html';
  const type = asset?.[1] === 'js' ? 'text/javascript' : asset ? 'text/css' : 'text/html';
  try {
    const content = readFileSync(join('dist', file));
    response.writeHead(200, { 'Content-Type': type });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [name, width] of [['desktop', 1440], ['tablet', 834], ['mobile', 390]]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(base + route + '?size=3', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(width < 640 ? '.expiry-cards li' : '.expiry-table tbody tr', { visible: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow at ' + width);
    await page.screenshot({ path: join(screenshots, name + '.png'), fullPage: true });
  }
  await page.setViewport({ width: 1440, height: 900 });
  await page.select('select', 'north');
  await page.waitForFunction(() => location.search.includes('areaId=north') && document.querySelector('.expiry-table tbody tr'));
  const focused = await page.$eval('.expiry-heading button', element => {
    element.focus();
    return element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none';
  });
  assert.ok(focused, 'Keyboard focus is visible');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Trang sau').click());
  await page.waitForFunction(() => location.search.includes('page=1') && document.querySelector('.expiry-table tbody tr'));
  assert.equal(requests.at(-1).get('areaId'), 'north');
  await page.goBack();
  await page.waitForFunction(() => location.search.includes('page=0') && document.querySelector('.expiry-table tbody tr'));
  await page.goForward();
  await page.waitForFunction(() => location.search.includes('page=1') && document.querySelector('.expiry-table tbody tr'));
  await page.goBack();
  for (const [label, heading] of [
    ['Gia hạn', 'Gia hạn hợp đồng thuê'],
    ['Bàn giao', 'Ghi nhận bàn giao trả phòng'],
    ['Thanh lý', 'Thanh lý hợp đồng thuê'],
  ]) {
    const action = '.expiry-table button[aria-label="' + label + ' HD-000"]';
    await page.waitForSelector(action, { visible: true });
    await page.click(action);
    await page.waitForFunction(() => location.pathname === '/rental-contracts' && !location.search.includes('action='));
    await page.waitForFunction(title => document.body.textContent.includes(title), {}, heading);
    await page.goBack();
    await page.waitForFunction(() => location.search.includes('areaId=north') && document.querySelector('.expiry-table tbody tr'));
  }

  mode = 'loading';
  await page.click('.expiry-heading button');
  await page.waitForSelector('.expiry-loading');
  await page.screenshot({ path: join(screenshots, 'loading.png'), fullPage: true });
  await page.waitForSelector('.expiry-table tbody tr');
  mode = 'failure';
  await page.click('.expiry-heading button');
  await page.waitForFunction(() => document.querySelector('.expiry-report [role=alert]')?.textContent.includes('Không thể tải báo cáo'));
  await page.screenshot({ path: join(screenshots, 'error.png'), fullPage: true });
  mode = 'empty';
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Thử lại').click());
  await page.waitForFunction(() => document.body.textContent.includes('Không có hợp đồng phù hợp'));
  await page.screenshot({ path: join(screenshots, 'empty.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS responsive layout, keyboard focus, loading, retry, empty state, pagination and contract navigation');
  console.log('Screenshots: ' + screenshots);
  if (process.argv.includes('--hallmark')) {
    mode = 'full';
    const skill = process.env.HALLMARK_DIR || join(homedir(), '.agents', 'skills', 'hallmark');
    process.exitCode = await new Promise((resolve, reject) => {
      const lint = spawn(process.execPath, [join(skill, 'scripts', 'sloplint.mjs'),
        'src/components/reports/expiring-leases.css', '--scope', 'app', '--render', '--url', base + route],
      { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chrome, HALLMARK_PUPPETEER: process.cwd() } });
      lint.once('error', reject);
      lint.once('exit', code => resolve(code ?? 1));
    });
  }
} finally {
  await browser?.close();
  server.close();
}
