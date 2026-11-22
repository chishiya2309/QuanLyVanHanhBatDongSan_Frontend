import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(path => path && existsSync(path));
assert.ok(chrome, 'Set CHROME_PATH for the browser test');

const area = { id: 'north', name: 'Khu Bắc', active: true };
const building = { id: 'building-a', name: 'Tòa A', areaId: area.id, areaName: area.name, active: true };
const rooms = Array.from({ length: 22 }, (_, index) => ({
  roomId: 'room-' + (index + 1), code: 'A' + (101 + index), name: 'Phòng A' + (101 + index),
  buildingId: building.id, buildingName: building.name, areaId: area.id, areaName: area.name,
  area: 28, defaultRent: index === 1 ? null : 3000000, daysVacant: index === 1 ? null : 40 - index,
}));
const requests = [];
const exports = [];

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  if (path === '/api/v1/reports/export') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const criteria = JSON.parse(body);
      exports.push({ criteria, csrf: request.headers['x-csrf-token'] });
      response.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="bao-cao-test.pdf"',
      });
      response.end('%PDF-1.7');
    });
    return;
  }
  if (path.startsWith('/api/v1/')) {
    let data;
    switch (path.slice('/api/v1'.length)) {
      case '/auth/me':
        data = { accountId: 'test-host', loginName: 'Chủ nhà', role: 'HOST', hostId: 'host' };
        break;
      case '/auth/csrf': data = { token: 'test-csrf', headerName: 'X-CSRF-TOKEN' }; break;
      case '/areas': data = [area]; break;
      case '/buildings': data = [building]; break;
      case '/rental-contracts':
        data = { content: [], pageNumber: 0, pageSize: 15, totalElements: 0, totalPages: 0, last: true };
        break;
      case '/rental-contracts/available-customers': data = []; break;
      case '/rental-contracts/available-rooms': data = [{ ...rooms[0], id: rooms[0].roomId, status: 'VACANT' }]; break;
      case '/reports/occupancy': {
        requests.push(url.searchParams);
        const page = Number(url.searchParams.get('page'));
        data = {
          generatedAt: '2026-11-21T01:00:00Z', totalRooms: 30, occupiedRooms: 6,
          availableVacantRooms: rooms.length, unavailableRooms: 2, vacancyRate: 78.57, vacantRentPotential: 63000000,
          byBuilding: [{ buildingId: building.id, buildingName: building.name, availableVacantRooms: rooms.length, vacantRentPotential: 63000000 }],
          availableRooms: { page, size: 20, totalElements: rooms.length, totalPages: 2, items: rooms.slice(page * 20, page * 20 + 20) },
          warnings: [{ code: 'INVALID_DEFAULT_RENT', count: 1 }, { code: 'UNKNOWN_VACANT_SINCE', count: 1 }],
        };
        break;
      }
      default: break;
    }
    const status = data === undefined ? 404 : 200;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    return response.end(JSON.stringify({ status, data, message: 'Browser test fixture' }));
  }
  const asset = /^\/assets\/[\w.-]+\.(js|css)$/.exec(path);
  const file = asset || path === '/favicon.svg' ? path.slice(1) : 'index.html';
  const type = asset?.[1] === 'js' ? 'text/javascript' : asset ? 'text/css' : path === '/favicon.svg' ? 'image/svg+xml' : 'text/html';
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
const downloads = mkdtempSync(join(tmpdir(), 'uc72-downloads-'));
try {
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, timeout: 15000 });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const devtools = await page.createCDPSession();
  await devtools.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  for (const width of [390, 834, 1440]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(base + '/reports/occupancy', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.occupancy-table-scroll tbody tr');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow at ' + width);
    if (width === 390) {
      assert.ok(await page.$eval('.occupancy-table-scroll', element => {
        const firstColumn = element.querySelector('th');
        const left = firstColumn.getBoundingClientRect().left;
        element.scrollLeft = 150;
        const pinned = element.scrollLeft > 0 && Math.abs(firstColumn.getBoundingClientRect().left - left) < 1;
        element.scrollLeft = 0;
        return pinned;
      }), 'Room code must remain visible while scrolling the table');
    }
    await page.focus('.occupancy-toolbar select');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement.matches('.occupancy-toolbar select:focus-visible')));
    console.log('PASS responsive layout and keyboard focus at ' + width + 'px');
  }
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 900 });
    await page.focus('.report-export-trigger');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.report-export-dialog[open]');
    assert.ok(await page.$eval('.report-export-dialog', dialog => {
      const { left, right } = dialog.getBoundingClientRect();
      return left >= 0 && right <= innerWidth && dialog.scrollWidth <= dialog.clientWidth + 1
        && document.activeElement === dialog.querySelector('select');
    }), 'Dialog bounds and initial focus at ' + width + 'px');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.report-export-dialog', { hidden: true });
    assert.ok(await page.evaluate(() => document.activeElement.matches('.report-export-trigger')));
  }
  await page.click('.report-export-trigger');
  await page.waitForSelector('.report-export-dialog[open]');
  await page.select('.report-export-dialog select', 'PDF');
  await page.click('.report-export-primary');
  await page.waitForSelector('.report-export-dialog a[download]');
  await page.waitForFunction(() => document.querySelector('.report-export-success')?.textContent.includes('Tệp đã sẵn sàng'));
  assert.equal(await page.$eval('.report-export-dialog a[download]', element => element.download), 'bao-cao-test.pdf');
  for (let attempt = 0; attempt < 30 && !readdirSync(downloads).includes('bao-cao-test.pdf'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(readFileSync(join(downloads, 'bao-cao-test.pdf'), 'utf8'), '%PDF-1.7');
  await page.click('.report-export-dialog a[download]');
  assert.deepEqual(exports, [{ criteria: { format: 'PDF' }, csrf: 'test-csrf' }]);
  await page.keyboard.press('Escape');
  console.log('PASS UC72 desktop and mobile keyboard flow, download and manual retry');
  await page.select('.occupancy-toolbar select', area.id);
  console.log('Checking updated filter and browser history');
  await page.waitForFunction(() => location.search.includes('areaId=north') && document.querySelector('.occupancy-table-scroll tbody tr'));
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => !location.search && document.querySelector('.occupancy-table-scroll tbody tr'));
  await page.evaluate(() => history.forward());
  await page.waitForFunction(() => location.search.includes('areaId=north') && document.querySelector('.occupancy-table-scroll tbody tr'));
  console.log('Checking report refresh');
  const countBeforeRefresh = requests.length;
  await page.click('.occupancy-primary');
  await page.waitForSelector('.occupancy-table-scroll tbody tr');
  assert.ok(requests.length > countBeforeRefresh);
  assert.equal(requests.at(-1).get('areaId'), area.id);
  console.log('Checking room details and rental navigation');
  await page.click('button[aria-label="Xem chi tiết phòng A101"]');
  await page.waitForFunction(() => location.pathname === '/rooms' && location.search.includes('roomId=room-1') && location.search.includes('action=detail'));
  await page.evaluate(() => history.back());
  await page.waitForSelector('button[aria-label="Lập hợp đồng phòng A101"]');
  await page.click('button[aria-label="Lập hợp đồng phòng A101"]');
  await page.waitForFunction(id => [...document.querySelectorAll('select')].some(select => select.value === id), {}, rooms[0].roomId);
  assert.match(page.url(), /\/rental-contracts\?create=true&roomId=room-1$/);
  assert.deepEqual(pageErrors, []);
  console.log('PASS deep link, browser history, refresh and contract preselection');
  if (process.argv.includes('--hallmark')) {
    const skill = process.env.HALLMARK_DIR || join(homedir(), '.agents', 'skills', 'hallmark');
    const result = await new Promise((resolve, reject) => {
      const lint = spawn(process.execPath, [join(skill, 'scripts', 'sloplint.mjs'),
        'src/components/reports', '--scope', 'app', '--render', '--url', base + '/reports/occupancy'],
      { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chrome, HALLMARK_PUPPETEER: process.cwd() } });
      lint.once('error', reject);
      lint.once('exit', resolve);
    });
    process.exitCode = result ?? 1;
  }
} finally {
  await browser?.close();
  server.close();
  rmSync(downloads, { recursive: true, force: true });
}
