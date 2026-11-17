import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const base = process.env.ROOM_PAYMENT_POLICY_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');

const output = resolve('.hallmark/shots/room-payment-policy');
mkdirSync(output, { recursive: true });

let viteServer = null;
try {
  await fetch(base);
} catch {
  viteServer = await createServer({
    server: { port: 5173, host: '127.0.0.1' },
  });
  await viteServer.listen();
}

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(),
  errors = [],
  checks = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());

const waitText = (text) =>
  page.waitForFunction((text) => document.body.innerText.includes(text), {}, text);

const open = async (state = 'default') => {
  await page.goto(base + '/tests/fixtures/room-payment-policy-preview.html?state=' + state, {
    waitUntil: 'networkidle0',
  });
  await page.waitForSelector('#rpp-title');
};

async function click(selector) {
  await page.waitForSelector(selector);
  await page.click(selector);
}

async function clickButtonText(text) {
  await page.waitForFunction(
    (text) =>
      [...document.querySelectorAll('.rpp-page button, .rpp-page .rpp-button')].some(
        (button) => button.textContent.trim() === text && !button.disabled
      ),
    {},
    text
  );
  await page.evaluate(
    (text) =>
      [...document.querySelectorAll('.rpp-page button, .rpp-page .rpp-button')]
        .find((button) => button.textContent.trim() === text && !button.disabled)
        .click(),
    text
  );
}

const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
};

async function check(name, run) {
  await run();
  checks.push(name);
  console.log('PASS ' + name);
}

try {
  await page.setViewport({ width: 1280, height: 800 });

  await check('1. Desktop unconfigured baseline renders title and empty state', async () => {
    await open('default');
    await waitText('Phòng 101 — Phòng 101');
    await waitText('Chưa cấu hình');
    await waitText('Phòng chưa có cấu hình thanh toán.');
    await shot('01-desktop-unconfigured');
  });

  await check('2. Mobile layout has no horizontal overflow', async () => {
    await page.setViewport({ width: 375, height: 667 });
    await open('default');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    assert.ok(scrollWidth <= innerWidth + 1, `Horizontal overflow detected: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`);
    await shot('02-mobile-unconfigured');
  });

  await page.setViewport({ width: 1280, height: 800 });

  await check('3. Configure both methods and save', async () => {
    await open('default');
    await click('#rpp-allowCash');
    await click('#rpp-allowTransfer');
    await page.select('#rpp-cashDefaultId', '00000000-0000-0000-0000-000000000301');
    await page.select('#rpp-bankDefaultId', '00000000-0000-0000-0000-000000000302');
    await shot('03-desktop-filling');
    await clickButtonText('Lưu cấu hình');
    await waitText('Lưu cấu hình thanh toán thành công.');
    await waitText('Đã cấu hình');
    await shot('04-desktop-saved');
  });

  await check('4. Inactive funding source renders warning badge', async () => {
    await open('inactive');
    await waitText('Ngừng hoạt động');
    await shot('05-desktop-inactive');
  });

  await check('5. Batch application renders targets and opens confirmation dialog', async () => {
    await open('configured');
    await clickButtonText('Áp dụng cho các phòng khác trong tòa nhà');
    await waitText('Áp dụng trong cùng tòa nhà');
    await waitText('Phòng 102');
    await shot('06-desktop-batch-table');

    // Click confirm without selecting triggers error
    await clickButtonText('Xác nhận áp dụng');
    await waitText('Vui lòng chọn ít nhất một phòng');

    // Select room 102
    await page.click('input[aria-label="Chọn phòng 102"]');
    await clickButtonText('Xác nhận áp dụng');

    // Modal dialog appears
    await page.waitForSelector('.rpp-confirm');
    await waitText('Thao tác sẽ ghi đè cấu hình thanh toán của các phòng đã chọn');
    await shot('07-desktop-confirmation-modal');

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForSelector('.rpp-confirm', { hidden: true });
    await shot('08-desktop-modal-cancelled');
  });

  console.log(`\nAll ${checks.length} browser test checks passed successfully!`);
} catch (err) {
  console.error('Browser test failed:', err);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (viteServer) {
    await viteServer.close();
  }
}
