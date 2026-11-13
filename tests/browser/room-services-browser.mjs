import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.ROOM_SERVICES_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/room-services');
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(),
  errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());
const waitText = (text) =>
  page.waitForFunction((text) => document.body.innerText.includes(text), {}, text);
const open = async (state = 'full') => {
  await page.goto(base + '/tests/fixtures/room-services-preview.html?state=' + state, {
    waitUntil: 'networkidle0',
  });
  await page.waitForSelector('#rs-title');
};
const ready = () => page.waitForSelector('.rs-table tbody th');
async function click(text) {
  await page.waitForFunction(
    (text) =>
      [...document.querySelectorAll('.rs-page button')].some(
        (button) => button.textContent.trim() === text && !button.disabled,
      ),
    {},
    text,
  );
  await page.evaluate(
    (text) =>
      [...document.querySelectorAll('.rs-page button')]
        .find((button) => button.textContent.trim() === text && !button.disabled)
        .click(),
    text,
  );
}
async function fill(selector, text) {
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (text) await page.type(selector, text);
}
const calls = () =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('uc36-preview-calls') || '[]'));
const writes = async () =>
  (await calls()).filter(
    (call) => /\/rooms\/.+\/services/.test(call.path) && call.method !== 'GET',
  );
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
};
async function check(name, run) {
  await run();
  checks.push(name);
  console.log('PASS ' + name);
}
async function layout() {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    targets: [
      ...document.querySelectorAll(
        '.rs-page button:not(:disabled), .rs-page select, .rs-page input:not([role="switch"]), .rs-toggle',
      ),
    ]
      .filter((node) => node.getClientRects().length)
      .map((node) => ({
        text: node.textContent?.trim(),
        height: node.getBoundingClientRect().height,
      })),
  }));
  assert.ok(result.scroll <= result.width, `Horizontal overflow ${result.scroll}/${result.width}`);
  assert.ok(
    result.targets.every((target) => target.height >= 44),
    JSON.stringify(result.targets),
  );
}
try {
  for (const width of [390, 768, 1440]) {
    await check(
      `Responsive ${width}px, labeled provenance, touch targets and no overflow`,
      async () => {
        await page.setViewport({ width, height: 900 });
        await open();
        await ready();
        await layout();
        assert.equal(
          await page.$$eval('.rs-table input[role="switch"]', (nodes) => nodes.length),
          1,
        );
        await shot(`full-${width}`);
        await page.click('[aria-label="Cập nhật giá riêng Internet"]');
        await page.waitForSelector('#rs-price');
        await layout();
        await shot(`price-${width}`);
        await click('Hủy');
      },
    );
  }
  await page.setViewport({ width: 1440, height: 900 });
  await check('Room detail entry and native Back/Forward preserve room and filters', async () => {
    await page.goto(base + '/tests/fixtures/room-services-preview.html?entry=room', {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.prop-drawer-footer');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent.trim() === 'Cấu hình dịch vụ',
      ),
    );
    await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent.trim() === 'Cấu hình dịch vụ')
        .click(),
    );
    await ready();
    assert.ok(page.url().includes('/services?returnTo='));
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.prop-drawer-footer');
    assert.equal(
      await page.$eval('input[placeholder="Tìm theo mã hoặc tên phòng..."]', (node) => node.value),
      '101',
    );
    assert.ok(page.url().includes('roomId=22222222-2222-4222-8222-222222222222'));
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await ready();
    await shot('room-entry');
  });
  await check(
    'Keyboard focus, inline price validation and exact 19-digit numeric request',
    async () => {
      await open('long');
      await ready();
      await page.click('[aria-label="Cập nhật giá riêng Internet"]');
      await fill('#rs-price', '-1');
      await click('Lưu giá riêng');
      await waitText('Vui lòng nhập đơn giá VND không âm và không có phần lẻ');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'rs-price');
      await shot('price-validation');
      await fill('#rs-price', '9999999999999999999');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await waitText('Cấu hình dịch vụ đã được lưu');
      assert.ok((await writes())[0].body.includes('"unitPrice":9999999999999999999'));
      assert.equal((await writes()).length, 1);
      await page.waitForSelector(
        '.rs-button:not(:disabled)[aria-label="Cập nhật giá riêng Internet"]',
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.getAttribute('aria-label')),
        'Cập nhật giá riêng Internet',
      );
      await layout();
      await shot('long-price-saved');
    },
  );
  await check(
    'Add disclosure, selection validation, cancel without writing and successful add',
    async () => {
      await open();
      await ready();
      await click('Thêm dịch vụ riêng');
      await page.waitForSelector('#rs-service');
      await click('Lưu dịch vụ');
      await waitText('Vui lòng chọn dịch vụ');
      await click('Hủy');
      assert.equal((await writes()).length, 0);
      await click('Thêm dịch vụ riêng');
      await page.waitForSelector('#rs-service');
      await page.select('#rs-service', '77777777-7777-4777-8777-777777777777');
      await shot('add-service');
      await click('Lưu dịch vụ');
      await waitText('Thêm dịch vụ riêng thành công');
      await waitText('Vệ sinh');
      assert.equal((await writes()).length, 1);
    },
  );
  await check('Private toggle retains configured price and service row', async () => {
    await open();
    await ready();
    await page.click('input[role="switch"]');
    await waitText('Cấu hình dịch vụ đã được lưu');
    await page.waitForFunction(() => document.querySelector('input[role="switch"]').checked);
    assert.ok(
      await page.$eval('[data-service-id="55555555-5555-4555-8555-555555555555"]', (node) =>
        node.innerText.includes('120.000'),
      ),
    );
    await shot('toggle-saved');
  });
  for (const state of ['loading', 'empty', 'error', 'choices-empty', 'choices-error'])
    await check(`Distinct ${state} state`, async () => {
      await open(state);
      if (state.startsWith('choices-')) {
        await ready();
        await click('Thêm dịch vụ riêng');
        await waitText(
          state === 'choices-empty'
            ? 'Không có dịch vụ phù hợp để thêm cho phòng'
            : 'Không thể tải cấu hình dịch vụ',
        );
      } else if (state === 'loading') await page.waitForSelector('.rs-skeleton');
      else
        await waitText(
          state === 'empty' ? 'Phòng chưa có dịch vụ' : 'Không thể tải cấu hình dịch vụ',
        );
      await shot(state);
      assert.equal((await writes()).length, 0);
    });
  for (const state of ['uncertain', 'saved-get-error', 'stale', 'history', 'save-error'])
    await check(
      `Write outcome ${state}, no automatic replay, drafts and GET recovery`,
      async () => {
        await open(state);
        await ready();
        await page.click('[aria-label="Cập nhật giá riêng Internet"]');
        await fill('#rs-price', '0');
        await click('Lưu giá riêng');
        await waitText(
          {
            uncertain: 'Chưa xác định được kết quả lưu',
            'saved-get-error': 'Cấu hình đã được lưu, nhưng chưa thể tải lại danh sách',
            stale: 'Dữ liệu đã thay đổi',
            history: 'Dữ liệu cấu hình chưa đầy đủ',
            'save-error': 'Không thể lưu cấu hình dịch vụ',
          }[state],
        );
        assert.equal((await writes()).length, 1);
        await shot(state);
        if (state === 'saved-get-error' || state === 'uncertain') {
          await page.evaluate(() => sessionStorage.setItem('uc36-preview-recovered', '1'));
          await click('Tải lại danh sách');
          await page.waitForSelector('.rs-header .rs-button:not(:disabled)');
          assert.equal((await writes()).length, 1);
          if (state === 'uncertain')
            assert.equal(await page.$eval('#rs-price', (node) => node.value), '0');
        }
      },
    );
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(output, 'verification.json'),
    JSON.stringify(
      { date: new Date().toISOString(), checks, browserErrors: errors, fixtureOnly: true },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
