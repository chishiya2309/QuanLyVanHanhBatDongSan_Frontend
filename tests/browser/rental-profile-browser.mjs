import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { loaded, roomFailure } from '../fixtures/rentalProfile.mjs';

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');

const route = '/portal/rental-profile';
const title = 'Xem hồ sơ và phòng đang thuê';
let response = loaded;
let calls = 0;
const server = await createServer({
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [react(), {
    name: 'uc23-browser-fixtures',
    configureServer(vite) {
      vite.middlewares.use((request, res, next) => {
        let data;
        if (request.url === '/api/v1/auth/me') {
          data = { accountId: 'fixture-tenant', role: 'CUSTOMER', loginName: 'minhan', hostId: 'host', customerId: 'customer' };
        } else if (request.url === '/api/v1/customers/me/rental-profile') {
          assert.equal(request.method, 'GET');
          calls++;
          data = response;
        } else return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 200, message: 'OK', data }));
      });
    },
  }],
});

try {
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.querySelector('.rp-page')?.innerText.includes('A101'));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base);
    const menu = await page.waitForSelector('.dash-sidebar', { visible: true });
    const button = await menu.waitForSelector(`::-p-text(${title})`);
    assert.equal(calls, 0);
    await button.click();
    await ready();
    assert.equal(new URL(page.url()).pathname, route);
    assert.equal(await page.$eval('.dash-sidebar [aria-current="page"]', (node) => node.textContent.trim()), title);
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('.rp-page'));
    await page.goForward();
    await ready();
    await page.reload();
    await ready();

    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const visible = (selector) => document.querySelector(selector).getClientRects().length > 0;
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          table: visible('.rp-table'), list: visible('.rp-room-list'), content: document.querySelector('.rp-page').innerText };
      });
      assert.equal(layout.overflow, false, `Page overflow at ${width}px`);
      assert.equal(layout.table, width === 1440);
      assert.equal(layout.list, width === 390);
      for (const value of ['A101', 'B202', 'Nguyễn Thị Minh Khai', '24,5 m²']) assert.ok(layout.content.includes(value));
    }

    response = roomFailure;
    await page.reload();
    await page.waitForSelector('.rp-retry', { visible: true });
    assert.match(await page.$eval('.rp-page', (node) => node.innerText), /Nguyễn Minh An/);
    for (let index = 0; index < 30; index++) {
      await page.keyboard.press('Tab');
      if (await page.$eval('.rp-retry', (node) => document.activeElement === node)) break;
    }
    assert.ok(await page.$eval('.rp-retry', (node) => document.activeElement === node && node.matches(':focus-visible')));
    response = loaded;
    await page.keyboard.press('Enter');
    await ready();
    assert.deepEqual(errors, []);
    console.log('UC23 browser checks passed at 1440px and 390px.');
  } finally {
    await browser.close();
  }
  if (process.env.HALLMARK_SLOPLINT) {
    const run = promisify(execFile);
    try {
      const result = await run(process.execPath, [
        process.env.HALLMARK_SLOPLINT, 'src/components/rentalProfile', '--scope', 'app',
        '--genre', 'modern-minimal', '--render', '--url', base + route,
      ], { env: { ...process.env, CHROME_PATH: executablePath } });
      process.stdout.write(result.stdout);
    } catch (error) {
      process.stdout.write(error.stdout ?? '');
      process.stderr.write(error.stderr ?? '');
      throw error;
    }
  }
} finally {
  await server.close();
}
