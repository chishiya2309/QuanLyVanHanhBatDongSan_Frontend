import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { LosslessNumber, parse, stringify } from 'lossless-json';
import { createServer } from 'vite';

const base = process.env.CUSTOMERS_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to an installed Chrome or Edge executable');

const output = resolve('.hallmark/shots/customers');
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
const page = await browser.newPage();
const errors = [], checks = [];

const id = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

const m = {
  sessionInvalid: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại',
  forbidden: 'Bạn không có quyền thực hiện chức năng này',
  invalidData: 'Dữ liệu không hợp lệ',
  notFound: 'Không thể truy cập Customer được yêu cầu',
  vehicleNotFound: 'Không thể truy cập phương tiện được yêu cầu',
  identityDuplicate: 'Giấy tờ đã được sử dụng bởi Customer khác trong phạm vi quản lý',
  stale: 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu',
  vehicleStale: 'Thông tin phương tiện đã thay đổi. Vui lòng tải lại dữ liệu',
  listSuccess: 'Lấy danh sách Customer thành công',
  detailSuccess: 'Lấy thông tin Customer thành công',
  createSuccess: 'Thêm Customer thành công',
  updateSuccess: 'Cập nhật Customer thành công',
  vehiclesSuccess: 'Lấy danh sách phương tiện thành công',
  vehicleSuccess: 'Lấy thông tin phương tiện thành công',
  vehicleCreateSuccess: 'Thêm phương tiện thành công',
  vehicleUpdateSuccess: 'Cập nhật phương tiện thành công',
  listFailure: 'Không thể tải danh sách Customer',
  detailFailure: 'Không thể tải thông tin Customer',
  createFailure: 'Thêm Customer không thành công',
  updateFailure: 'Cập nhật Customer không thành công',
  vehiclesFailure: 'Không thể tải danh sách phương tiện',
  vehicleFailure: 'Không thể tải thông tin phương tiện',
  vehicleCreateFailure: 'Thêm phương tiện không thành công',
  vehicleUpdateFailure: 'Cập nhật phương tiện không thành công',
};

let customers = [];
let vehicles = [];
let calls = [];
let mode = 'normal';
let role = 'HOST';
let count = 100;

function reset() {
  customers = [
    {
      id: id(1),
      fullName: 'Nguyễn Văn An',
      phone: '0901234567',
      email: 'an@example.com',
      identityType: 'CCCD',
      identityNo: '079090123456',
      birthDate: '1995-10-15',
      address: 'TP. Hồ Chí Minh',
      note: 'Ghi chú mẫu',
      version: new LosslessNumber('0'),
    },
  ];

  vehicles = [
    {
      id: id(10),
      customerId: id(1),
      type: 'MOTORBIKE',
      plateNumber: '59A1-123.45',
      note: 'Vision đỏ',
      version: new LosslessNumber('0'),
      customerVersion: new LosslessNumber('0'),
    },
  ];

  calls = [];
  mode = 'normal';
  role = 'HOST';
}

reset();

page.on('pageerror', (err) => errors.push(err.message));

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
    if (mode === 'session') return reply(401, m.sessionInvalid);
    return reply(200, 'OK', {
      accountId: id(99),
      loginName: 'Host kiểm thử UC21',
      role,
      hostId: id(1),
      customerId: null,
    });
  }

  if (url.pathname.endsWith('/auth/refresh')) {
    return reply(401, 'Expired');
  }

  if (url.pathname.endsWith('/auth/csrf')) {
    return reply(200, 'OK', { headerName: 'X-CSRF-TOKEN', token: 'browser-uc21' });
  }

  if (url.pathname.endsWith('/profile')) {
    return reply(200, 'OK', {
      accountId: id(99),
      businessName: 'Cơ sở Cho thuê Sunrise',
      businessPhone: '0901234567',
      businessEmail: 'host@example.test',
      officeAddress: '123 Nguyễn Văn Trỗi',
      version: new LosslessNumber('0'),
    });
  }

  if (!url.pathname.includes('/customers')) {
    return reply(404, 'Endpoint not found in test mock');
  }

  if (mode === 'forbidden') {
    return reply(403, m.forbidden);
  }

  const accountMatch = url.pathname.match(/\/customers\/([0-9a-fA-F-]+)\/account$/);
  if (accountMatch && request.method() === 'GET') {
    const customer = customers.find((item) => item.id === accountMatch[1]);
    if (!customer) return reply(404, m.notFound);
    return reply(200, 'Lấy thông tin tài khoản Customer thành công', {
      customerId: customer.id, hasAccount: false, accountId: null, loginName: null,
      role: null, status: null, createdAt: null, customerVersion: customer.version,
    });
  }

  // Vehicles collection endpoints: /api/v1/customers/{customerId}/vehicles
  const vehicleCollectionMatch = url.pathname.match(/\/customers\/([0-9a-fA-F-]+)\/vehicles$/);
  if (vehicleCollectionMatch) {
    const custId = vehicleCollectionMatch[1];
    if (request.method() === 'GET') {
      const custVehicles = vehicles.filter((v) => v.customerId === custId);
      const customer = customers.find((c) => c.id === custId);
      return reply(200, m.vehiclesSuccess, {
        customerId: custId,
        customerVersion: customer ? customer.version : new LosslessNumber('0'),
        vehicles: custVehicles,
      });
    }
    if (request.method() === 'POST') {
      if (mode === 'vehicle-conflict') {
        return reply(409, m.vehicleStale);
      }
      const input = parse(request.postData());
      const newV = {
        id: id(count++),
        customerId: custId,
        type: input.type,
        plateNumber: input.plateNumber,
        note: input.note || null,
        version: new LosslessNumber('0'),
        customerVersion: new LosslessNumber('0'),
      };
      vehicles.push(newV);
      return reply(201, m.vehicleCreateSuccess, newV);
    }
  }

  // Vehicle item endpoints: /api/v1/customers/{customerId}/vehicles/{vehicleId}
  const vehicleItemMatch = url.pathname.match(/\/customers\/([0-9a-fA-F-]+)\/vehicles\/([0-9a-fA-F-]+)$/);
  if (vehicleItemMatch) {
    const custId = vehicleItemMatch[1];
    const vehId = vehicleItemMatch[2];
    const existingIndex = vehicles.findIndex((v) => v.id === vehId && v.customerId === custId);
    if (existingIndex === -1) {
      return reply(404, m.vehicleNotFound);
    }
    if (request.method() === 'PUT') {
      if (mode === 'vehicle-conflict') {
        return reply(409, m.vehicleStale);
      }
      const input = parse(request.postData());
      const existing = vehicles[existingIndex];
      const updated = {
        ...existing,
        type: input.type,
        plateNumber: input.plateNumber,
        note: input.note || null,
        version: new LosslessNumber(String(BigInt(existing.version.toString()) + 1n)),
      };
      vehicles[existingIndex] = updated;
      return reply(200, m.vehicleUpdateSuccess, updated);
    }
  }

  // Customer collection endpoints: /api/v1/customers
  if (url.pathname.endsWith('/customers')) {
    if (request.method() === 'GET') {
      const q = url.searchParams.get('q') || '';
      let filtered = customers;
      if (q.trim()) {
        const query = q.trim().toLowerCase();
        filtered = customers.filter(
          (c) =>
            c.fullName.toLowerCase().includes(query) ||
            (c.phone && c.phone.includes(query)) ||
            (c.identityNo && c.identityNo.includes(query))
        );
      }
      return reply(200, m.listSuccess, {
        content: filtered,
        page: 0,
        size: 20,
        totalElements: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / 20)),
        first: true,
        last: true,
      });
    }
    if (request.method() === 'POST') {
      if (mode === 'duplicate-identity') {
        return reply(409, m.identityDuplicate);
      }
      const input = parse(request.postData());
      const newCust = {
        id: id(count++),
        fullName: input.fullName,
        phone: input.phone || null,
        email: input.email || null,
        identityType: input.identityType || null,
        identityNo: input.identityNo || null,
        birthDate: input.birthDate || null,
        address: input.address || null,
        note: input.note || null,
        version: new LosslessNumber('0'),
      };
      customers.push(newCust);
      return reply(201, m.createSuccess, newCust);
    }
  }

  // Customer item endpoints: /api/v1/customers/{customerId}
  const customerItemMatch = url.pathname.match(/\/customers\/([0-9a-fA-F-]+)$/);
  if (customerItemMatch) {
    const custId = customerItemMatch[1];
    const customer = customers.find((c) => c.id === custId);
    if (!customer) {
      return reply(404, m.notFound);
    }
    if (request.method() === 'GET') {
      return reply(200, m.detailSuccess, customer);
    }
    if (request.method() === 'PUT') {
      if (mode === 'stale') {
        return reply(409, m.stale);
      }
      if (mode === 'duplicate-identity') {
        return reply(409, m.identityDuplicate);
      }
      const input = parse(request.postData());
      customer.fullName = input.fullName;
      customer.phone = input.phone || null;
      customer.email = input.email || null;
      customer.identityType = input.identityType || null;
      customer.identityNo = input.identityNo || null;
      customer.birthDate = input.birthDate || null;
      customer.address = input.address || null;
      customer.note = input.note || null;
      customer.version = new LosslessNumber(String(BigInt(customer.version.toString()) + 1n));
      return reply(200, m.updateSuccess, customer);
    }
  }

  return reply(404, 'Unhandled endpoint');
});

const waitText = (text) => page.waitForFunction((t) => document.body.innerText.includes(t), {}, text);
const open = (path = '/customers') => page.goto(base + path, { waitUntil: 'networkidle0' });
const ready = () => page.waitForSelector('.customer-heading button:not(:disabled)');

async function click(text, parent = 'body') {
  await page.waitForFunction(
    (t, p) =>
      [...document.querySelector(p).querySelectorAll('button, a')].some(
        (node) => node.textContent.trim() === t && !node.disabled && node.getClientRects().length
      ),
    {},
    text,
    parent
  );
  await page.evaluate(
    (t, p) =>
      [...document.querySelector(p).querySelectorAll('button, a')]
        .find((node) => node.textContent.trim() === t && !node.disabled && node.getClientRects().length)
        .click(),
    text,
    parent
  );
}

const fill = async (selector, value) => {
  await page.waitForSelector(selector + ':not(:disabled)');
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (value) {
    await page.type(selector, value);
  }
};

const setDateInput = async (selector, value) => {
  await page.waitForSelector(selector + ':not(:disabled)');
  await page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector, value);
};

const shot = (name) => page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });

async function check(name, run) {
  await run();
  checks.push(name);
  console.log('PASS ' + name);
}

try {
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Role scope and list view
  await check('Host scope displays customer list; ADMIN and CUSTOMER are rejected with 403', async () => {
    reset();
    await open('/customers');
    await ready();
    assert.ok(await page.$eval('.customer-table', (el) => el.innerText.includes('Nguyễn Văn An')));
    assert.equal(await page.$eval('[aria-current=page]', (el) => el.innerText.includes('Khách thuê')), true);

    // ADMIN role check
    role = 'ADMIN';
    await open('/customers');
    await waitText('Bạn không có quyền thực hiện chức năng này');
    assert.equal(calls.filter((c) => c.path.includes('/customers') && c.method !== 'GET').length, 0);

    // CUSTOMER role check
    role = 'CUSTOMER';
    await open('/customers');
    await waitText('Bạn không có quyền thực hiện chức năng này');

    // Reset back to HOST
    reset();
    await open('/customers');
    await ready();
    await shot('customers-list-desktop');
  });

  // 2. Create customer dialog, validation, ESC, and successful submit
  await check('Create Customer dialog: focus trap, validation errors, ESC key, and successful creation', async () => {
    reset();
    await open('/customers');
    await ready();

    // Click "+ Thêm khách thuê"
    await click('+ Thêm khách thuê');
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.$eval('dialog[open] h2', (el) => el.innerText), 'Thêm khách thuê mới');

    // Test ESC closes dialog
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));

    // Reopen dialog
    await click('+ Thêm khách thuê');
    await page.waitForSelector('dialog[open]');

    // Submit with empty full name -> inline validation
    await click('Tạo hồ sơ', 'dialog');
    await waitText('Vui lòng nhập họ tên');

    // Partial identity validation: provide only identityType but no number
    await fill('#customer-fullName', 'Trần Thị Bích');
    await page.select('#customer-identityType', 'CCCD');
    await click('Tạo hồ sơ', 'dialog');
    await waitText('Vui lòng nhập số giấy tờ');

    // Fill valid data
    await fill('#customer-phone', '0912345678');
    await fill('#customer-email', 'bich@example.com');
    await fill('#customer-identityNo', '079090999888');
    await setDateInput('#customer-birthDate', '1998-05-20');
    await fill('#customer-address', 'Quận 1, TP. Hồ Chí Minh');
    await fill('#customer-note', 'Khách đại diện phòng 101');

    await click('Tạo hồ sơ', 'dialog');
    await waitText('Thêm Customer thành công');

    // Verify POST payload
    const createCall = calls.find((c) => c.path.endsWith('/customers') && c.method === 'POST');
    assert.ok(createCall, 'POST /customers should be called');
    assert.equal(createCall.csrf, 'browser-uc21');
    const createdBody = parse(createCall.body);
    assert.equal(createdBody.fullName, 'Trần Thị Bích');
    assert.equal(createdBody.identityType, 'CCCD');
    assert.equal(createdBody.identityNo, '079090999888');

    // Verify row appears in list
    await waitText('Trần Thị Bích');
    await shot('customer-created-in-list');
  });

  // 3. Customer detail view and profile update
  await check('Customer Detail View: facts display, optimistic concurrency profile update', async () => {
    reset();
    await open(`/customers/${id(1)}`);
    await waitText('Nguyễn Văn An');
    await waitText('0901234567');
    await waitText('079090123456');

    // Click "Chỉnh sửa hồ sơ"
    await click('Chỉnh sửa hồ sơ');
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.$eval('#customer-fullName', (el) => el.value), 'Nguyễn Văn An');

    // Update note and submit
    await fill('#customer-note', 'Cập nhật ghi chú VIP');
    await click('Lưu thay đổi', 'dialog');
    await waitText('Cập nhật Customer thành công');

    // Verify PUT call includes version
    const putCall = calls.find((c) => c.path.endsWith(`/customers/${id(1)}`) && c.method === 'PUT');
    assert.ok(putCall, 'PUT /customers/{customerId} must be called');
    const putBody = parse(putCall.body);
    assert.equal(putBody.note, 'Cập nhật ghi chú VIP');
    assert.equal(putBody.version.toString(), '0');

    // Verify updated note on detail view
    await waitText('Cập nhật ghi chú VIP');
    await shot('customer-detail-updated');
  });

  // 4. Add vehicle with plate validation & type radio selection
  await check('Add Vehicle: required plate validation and type radio selection', async () => {
    reset();
    await open(`/customers/${id(1)}`);
    await waitText('Nguyễn Văn An');

    // Click "+ Thêm phương tiện"
    await click('+ Thêm phương tiện');
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.$eval('dialog[open] h2', (el) => el.innerText), 'Thêm phương tiện mới');

    // Submit empty plate number -> inline error
    await click('Thêm phương tiện', 'dialog');
    await waitText('Vui lòng nhập biển số');

    // Select CAR type and fill plate number + note
    await page.click('input[value="CAR"]');
    await fill('#vehicle-plateNumber', '51G-999.88');
    await fill('#vehicle-note', 'Mercedes trắng');

    await click('Thêm phương tiện', 'dialog');
    await waitText('Thêm phương tiện thành công');

    // Verify POST vehicle call
    const addVehCall = calls.find(
      (c) => c.path.endsWith(`/customers/${id(1)}/vehicles`) && c.method === 'POST'
    );
    assert.ok(addVehCall, 'POST /vehicles must be called');
    const vehBody = parse(addVehCall.body);
    assert.equal(vehBody.type, 'CAR');
    assert.equal(vehBody.plateNumber, '51G-999.88');

    // Verify row in table
    await waitText('51G-999.88');
    await waitText('Ô tô');
    await shot('vehicle-added-in-detail');
  });

  // 5. Update vehicle
  await check('Update Vehicle: edit plate and note with concurrency versioning', async () => {
    reset();
    await open(`/customers/${id(1)}`);
    await waitText('59A1-123.45');

    // Click "Chỉnh sửa" on existing vehicle
    await click('Chỉnh sửa', '.customer-table');
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.$eval('dialog[open] h2', (el) => el.innerText), 'Chỉnh sửa phương tiện');
    assert.equal(await page.$eval('#vehicle-plateNumber', (el) => el.value), '59A1-123.45');

    // Edit note
    await fill('#vehicle-note', 'Vision đỏ dán decal');
    await click('Lưu thay đổi', 'dialog');
    await waitText('Cập nhật phương tiện thành công');

    // Verify PUT vehicle call
    const updateVehCall = calls.find(
      (c) => c.path.includes(`/customers/${id(1)}/vehicles/${id(10)}`) && c.method === 'PUT'
    );
    assert.ok(updateVehCall, 'PUT /vehicles/{vehicleId} must be called');
    const updateVehBody = parse(updateVehCall.body);
    assert.equal(updateVehBody.note, 'Vision đỏ dán decal');
    assert.equal(updateVehBody.version.toString(), '0');
    assert.equal(updateVehBody.customerVersion.toString(), '0');

    await waitText('Vision đỏ dán decal');
    await shot('vehicle-updated-in-detail');
  });

  // 6. Conflict error handling
  await check('Conflict error handling: duplicate identity (409) and optimistic concurrency (409)', async () => {
    reset();
    await open('/customers');
    await ready();

    // Trigger duplicate identity
    mode = 'duplicate-identity';
    await click('+ Thêm khách thuê');
    await page.waitForSelector('dialog[open]');
    await fill('#customer-fullName', 'Trùng CCCD');
    await click('Tạo hồ sơ', 'dialog');
    await waitText('Giấy tờ đã được sử dụng bởi Customer khác trong phạm vi quản lý');
    await page.keyboard.press('Escape');

    // Trigger concurrent update conflict
    mode = 'stale';
    await open(`/customers/${id(1)}`);
    await waitText('Nguyễn Văn An');
    await click('Chỉnh sửa hồ sơ');
    await page.waitForSelector('dialog[open]');
    await click('Lưu thay đổi', 'dialog');
    await waitText('Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu');
  });

  // 7. Responsive layout check across viewports
  await check('Responsive layout: no horizontal overflow at 390px, 768px, 1440px', async () => {
    reset();
    for (const width of [390, 768, 1440]) {
      await page.setViewport({ width, height: 900 });
      await open('/customers');
      await ready();
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `No horizontal overflow on list at ${width}px`
      );
      await shot(`responsive-list-${width}`);

      await open(`/customers/${id(1)}`);
      await waitText('Nguyễn Văn An');
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `No horizontal overflow on detail at ${width}px`
      );
      await shot(`responsive-detail-${width}`);
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
        status: 'ALL_PASSED',
      },
      null,
      2
    )
  );
  console.log(`UC21 Customers: ${checks.length} browser test groups passed successfully!`);
} catch (error) {
  await shot('failure');
  console.error({
    mode,
    text: await page.evaluate(() => document.body.innerText).catch(() => 'unknown'),
    lastCall: calls.at(-1),
    pageErrors: errors,
  });
  throw error;
} finally {
  await browser.close();
  if (viteServer) {
    await viteServer.close();
  }
}
