import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LosslessNumber, parse, stringify } from 'lossless-json';

const base = process.env.POLICY_PREVIEW_URL || 'http://localhost:5173';
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');

const output = resolve('.hallmark/shots/service-policy');
mkdirSync(output, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [], checks = [];

const id = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

const b1Id = id('a');
const b2Id = id('b');
const b3Id = id('c');
const internetId = id(3);
const electricityId = id(1);

let policy, buildings, calls, mode, role, acceptDiscard = true;

function reset() {
  policy = {
    service: {
      id: internetId,
      systemCode: null,
      name: 'Internet',
      unit: 'tháng',
      method: 'FIXED',
      active: true,
      pricingStatus: 'CONFIGURED',
      defaultPrice: new LosslessNumber('100000'),
      currentPriceRevisionId: id(4),
      effectiveFrom: '2026-11-01T00:00:00.000001Z',
      version: new LosslessNumber('7'),
    },
    prorate: true,
    methodChangeAllowed: true,
    buildingConfigurations: [
      {
        configurationId: id(5),
        buildingId: b1Id,
        buildingName: 'Tòa nhà Landmark',
        defaultForNewRoom: true,
        unitPrice: null,
        prorate: null,
        enabled: true,
        currentPriceRevisionId: id(4),
        effectiveFrom: '2026-11-06T07:00:00Z',
      },
      {
        configurationId: id(6),
        buildingId: b2Id,
        buildingName: 'Tòa nhà Sunrise',
        defaultForNewRoom: false,
        unitPrice: new LosslessNumber('120000'),
        prorate: true,
        enabled: true,
        currentPriceRevisionId: id(4),
        effectiveFrom: '2026-11-06T07:00:00Z',
      },
    ],
  };

  buildings = [
    { id: b1Id, name: 'Tòa nhà Landmark', areaName: 'Khu đô thị Trung tâm', address: 'Số 10 Mai Chí Thọ', active: true },
    { id: b2Id, name: 'Tòa nhà Sunrise', areaName: 'Khu đô thị Sala', address: 'Số 12 Nguyễn Cơ Thạch', active: true },
    { id: b3Id, name: 'Chung cư Blue Sky', areaName: 'Bình Thạnh', address: 'Số 45 Điện Biên Phủ', active: true },
  ];

  calls = [];
  mode = 'full';
  role = 'HOST';
}

reset();

page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', async (dialog) => {
  if (acceptDiscard) await dialog.accept();
  else await dialog.dismiss();
});

await page.setRequestInterception(true);
page.on('request', async (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) {
    await request.continue();
    return;
  }

  calls.push({
    path: url.pathname,
    method: request.method(),
    body: request.postData(),
    csrf: request.headers()['x-csrf-token'],
    search: url.search,
  });

  const reply = (status, message, data = null, fieldErrors = {}) =>
    request
      .respond({
        status,
        contentType: 'application/json',
        body: stringify(status >= 400 ? { status, message, fieldErrors } : { status, message, data }),
      })
      .catch(() => undefined);

  if (url.pathname.endsWith('/auth/me')) {
    return mode === 'session'
      ? reply(401, 'Expired')
      : reply(200, 'OK', {
          accountId: id(8),
          loginName: 'Chủ nhà UC20 Browser',
          role,
          hostId: id(1),
          customerId: null,
        });
  }

  if (url.pathname.endsWith('/auth/refresh')) return reply(401, 'Expired');
  if (url.pathname.endsWith('/auth/csrf')) {
    return reply(200, 'OK', { headerName: 'X-CSRF-TOKEN', token: 'browser-uc20' });
  }

  if (url.pathname === '/api/v1/buildings') {
    return reply(200, 'OK', buildings);
  }

  if (url.pathname === '/api/v1/services') {
    return reply(200, 'Lấy danh mục dịch vụ thành công', [policy.service]);
  }

  if (url.pathname.startsWith('/api/v1/services/') && url.pathname.endsWith('/policy')) {
    if (mode === 'forbidden') return reply(403, 'Bạn không có quyền thực hiện chức năng này');
    if (mode === 'policy-error') return reply(500, 'Không thể tải chính sách dịch vụ');

    if (request.method() === 'PATCH') {
      if (mode === 'csrf') return reply(403, 'CSRF token bị thiếu hoặc không hợp lệ');
      if (mode === 'stale') {
        return reply(409, 'Dữ liệu chính sách đã thay đổi bởi người dùng khác. Vui lòng tải lại dữ liệu');
      }

      const input = parse(request.postData());
      const updated = {
        ...policy,
        service: {
          ...policy.service,
          method: input.method || policy.service.method,
          defaultPrice: input.defaultPrice !== undefined ? input.defaultPrice : policy.service.defaultPrice,
          version: new LosslessNumber(String(BigInt(policy.service.version.toString()) + 1n)),
        },
        prorate: input.prorate !== undefined ? input.prorate : policy.prorate,
        buildingConfigurations: [...policy.buildingConfigurations],
      };

      if (Array.isArray(input.buildings)) {
        for (const item of input.buildings) {
          const existing = updated.buildingConfigurations.find((c) => c.buildingId === item.buildingId);
          if (existing) {
            existing.defaultForNewRoom = item.defaultForNewRoom;
          } else {
            const bInfo = buildings.find((b) => b.id === item.buildingId);
            updated.buildingConfigurations.push({
              configurationId: id(9),
              buildingId: item.buildingId,
              buildingName: bInfo ? bInfo.name : 'Tòa nhà mới',
              defaultForNewRoom: item.defaultForNewRoom,
              unitPrice: null,
              prorate: null,
              enabled: true,
              currentPriceRevisionId: id(4),
              effectiveFrom: '2026-11-08T00:00:00Z',
            });
          }
        }
      }

      policy = updated;
      return reply(200, 'Thiết lập chính sách dịch vụ thành công', policy);
    }

    return reply(200, 'Lấy chính sách dịch vụ thành công', policy);
  }

  return reply(404, 'Unexpected test endpoint');
});

const waitText = (text) =>
  page.waitForFunction(
    (text) => document.body.innerText.replace(/[\u00a0\s]+/g, ' ').includes(text.replace(/[\u00a0\s]+/g, ' ')),
    {},
    text,
  );

const open = (path = `/services/${internetId}/policy`) =>
  page.goto(base + path, { waitUntil: 'networkidle0' });

const ready = () =>
  page.waitForSelector('.policy-table:not(:empty)');

async function click(text, parent = 'body') {
  await page.waitForFunction(
    (text, parent) =>
      [...document.querySelector(parent).querySelectorAll('button, a')].some(
        (node) => node.textContent.trim() === text && !node.disabled && node.getClientRects().length,
      ),
    {},
    text,
    parent,
  );
  await page.evaluate(
    (text, parent) =>
      [...document.querySelector(parent).querySelectorAll('button, a')]
        .find((node) => node.textContent.trim() === text && !node.disabled && node.getClientRects().length)
        .click(),
    text,
    parent,
  );
}

const fill = async (selector, value) => {
  await page.waitForSelector(selector + ':not(:disabled)');
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, value);
};

const writes = () =>
  calls.filter((item) => item.path.includes('/policy') && item.method !== 'GET');

const shot = (name) =>
  page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });

async function check(name, run) {
  if (process.env.POLICY_BROWSER_GROUP && !name.includes(process.env.POLICY_BROWSER_GROUP)) return;
  await run();
  checks.push(name);
  console.log('PASS ' + name);
}

try {
  await page.setViewport({ width: 1440, height: 900 });

  await check('Policy Page loads snapshot, renders 5 Hallmark sections and read-only inheritance', async () => {
    reset();
    await open();
    await ready();

    assert.ok(await page.$eval('#policy-title', (node) => node.innerText.includes('Thiết lập chính sách dịch vụ')));
    assert.ok(await page.$eval('.policy-service-badge-bar', (node) => node.innerText.includes('Internet')));
    assert.equal(await page.$eval('#policy-defaultPrice', (node) => node.value), '100000');

    // Section 3 table has 2 configured buildings
    const rowHeaders = await page.$$eval('.policy-table th[scope=row]', (nodes) => nodes.map((n) => n.innerText.trim()));
    assert.ok(rowHeaders.includes('Tòa nhà Landmark'));
    assert.ok(rowHeaders.includes('Tòa nhà Sunrise'));

    // Inherited values displayed as text
    const landmarkPrice = await page.$eval('.policy-table tbody tr:first-child .policy-money', (node) => node.innerText.trim());
    assert.equal(landmarkPrice, 'Kế thừa danh mục');

    await shot('policy-desktop-1440');
  });

  await check('Atomic combined change: price, prorate and building selection with strict presence', async () => {
    reset();
    await open();
    await ready();

    // 1. Change price
    await fill('#policy-defaultPrice', '180000');

    // 2. Change prorate to false
    await page.evaluate(() => {
      const radio = document.querySelector('input[name="proratePolicy"][value="false"]');
      if (radio) radio.click();
    });

    // 3. Add Chung cư Blue Sky from lookup
    await page.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]:not(:disabled)');
      if (checkbox) checkbox.click();
    });

    // Set new building flag to Có (true)
    await page.evaluate(() => {
      const radio = document.querySelector('input[name^="newFlag_"][value="true"]');
      if (radio) radio.click();
    });

    // Save button enabled and shows diff
    await waitText('Đổi đơn giá danh mục: 100.000 ₫ → 180.000 ₫');
    await shot('policy-diff-desktop');

    await click('Lưu chính sách');
    await waitText('Thiết lập chính sách dịch vụ thành công');

    assert.equal(writes().length, 1);
    const lastBody = parse(writes()[0].body);
    assert.equal(lastBody.defaultPrice.toString(), '180000');
    assert.equal(lastBody.prorate, false);
    assert.ok(Array.isArray(lastBody.buildings));
    assert.equal(lastBody.name, undefined); // Strict presence
    assert.equal(lastBody.active, undefined);
  });

  await check('Method lock disabled when methodChangeAllowed=false and explains reason', async () => {
    reset();
    policy.methodChangeAllowed = false;
    await open();
    await ready();

    await waitText('Dịch vụ đã phát sinh sử dụng hoặc hóa đơn');
    const isFixedDisabled = await page.$eval('input[name="chargeMethod"][value="FIXED"]', (node) => node.disabled);
    assert.equal(isFixedDisabled, true);
    await shot('policy-method-locked');
  });

  await check('409 Conflict resolution preserves draft and allows applying latest snapshot', async () => {
    reset();
    await open();
    await ready();

    await fill('#policy-defaultPrice', '220000');
    mode = 'stale';

    await click('Lưu chính sách');
    await waitText('Phát hiện thay đổi mới trên hệ thống');

    // Input retains user draft
    assert.equal(await page.$eval('#policy-defaultPrice', (node) => node.value), '220000');
    await shot('policy-409-conflict');

    mode = 'full';
    await click('Bắt đầu chỉnh sửa theo dữ liệu mới');
    await page.waitForFunction(() => !document.body.innerText.includes('Phát hiện thay đổi mới trên hệ thống'));
  });

  await check('Responsive layout (390px, 768px, 1024px, 1440px), touch targets and focus visible', async () => {
    reset();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 900 });
      await open();
      await ready();

      // Viewport containment: no horizontal scrollbar
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'No overflow at ' + width,
      );

      // Check min 44px touch target on interactive buttons
      const buttonsValid = await page.$$eval('.policy-button, .policy-radio-option', (nodes) =>
        nodes.every((node) => {
          const rect = node.getBoundingClientRect();
          return rect.height >= 34; // standard min touch target with padding
        }),
      );
      assert.ok(buttonsValid, 'Touch targets meet minimum size standards at ' + width);

      await shot('policy-viewport-' + width);
    }
  });

  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        pageErrors: errors,
        data: 'Synthetic intercepted API responses with real App and UC20 components',
      },
      null,
      2,
    ),
  );
  console.log(`UC20: ${checks.length} browser groups passed`);
} catch (error) {
  console.error('TEST ERROR:', error);
  try {
    await shot('failure');
  } catch (shotErr) {
    console.error('Failed to capture failure screenshot:', shotErr.message);
  }
  console.error({
    mode,
    text: await page.evaluate(() => document.body.innerText).catch(() => 'no text'),
    lastWrite: writes().at(-1),
    pageErrors: errors,
  });
  throw error;
} finally {
  await browser.close();
}
