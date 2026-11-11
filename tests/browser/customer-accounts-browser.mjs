import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { LosslessNumber, parse, stringify } from 'lossless-json';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const base = process.env.CUSTOMER_ACCOUNTS_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to an installed Chrome or Edge executable');
const output = resolve('.hallmark/shots/customer-accounts');
mkdirSync(output, { recursive: true });
let server;
try { await fetch(base); } catch {
  const url = new URL(base);
  server = await createServer({ server: { host: url.hostname, port: Number(url.port), strictPort: true } });
  await server.listen();
}
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(12000);
page.setDefaultNavigationTimeout(60000);
const id = '11111111-1111-4111-8111-111111111111';
const hostId = '33333333-3333-4333-8333-333333333333';
const accountId = '22222222-2222-4222-8222-222222222222';
const customerTemplate = { id, fullName: 'Nguyễn Văn An', phone: '0901234567', email: 'contact@example.test', identityType: 'CCCD', identityNo: '079090123456',
  birthDate: '1995-10-15', address: 'TP. Hồ Chí Minh', note: null, version: new LosslessNumber('0') };
const absent = () => ({ customerId: id, hasAccount: false, accountId: null, loginName: null, role: null, status: null, createdAt: null, customerVersion: new LosslessNumber('0') });
const present = (status = 'ACTIVE') => ({ ...absent(), hasAccount: true, accountId, loginName: 'login@example.test', role: 'CUSTOMER', status,
  createdAt: '2026-11-09T01:00:00Z', customerVersion: new LosslessNumber('1') });
let customer, account, mode, role, calls, release;
let accountReads = 0;
const errors = [], checks = [];
const reset = () => { customer = { ...customerTemplate }; account = absent(); mode = 'normal'; role = 'HOST'; calls = []; release = null; accountReads = 0; };
reset();
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());
await page.setRequestInterception(true);
page.on('request', async (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) return request.continue();
  const method = request.method();
  const body = request.postData() ? parse(request.postData()) : null;
  calls.push({ path: url.pathname, method, csrf: request.headers()['x-csrf-token'], version: body?.customerVersion?.toString() });
  const reply = (status, message, data = null, fieldErrors = {}) => request.respond({ status, contentType: 'application/json',
    body: stringify(status >= 400 ? { status, message, fieldErrors } : { status, message, data }) }).catch(() => undefined);
  if (url.pathname.endsWith('/auth/me')) return reply(200, 'OK', { accountId: hostId, loginName: 'host@example.test', role, hostId: role === 'HOST' ? hostId : null, customerId: role === 'CUSTOMER' ? id : null });
  if (url.pathname.endsWith('/auth/csrf')) return reply(200, 'OK', { token: 'browser-uc08', headerName: 'X-CSRF-TOKEN' });
  if (url.pathname.endsWith('/profile')) return reply(200, 'OK', { accountId: hostId, businessName: 'Nhà trọ kiểm thử UC08', businessEmail: 'host@example.test', businessPhone: null, officeAddress: null, version: new LosslessNumber('0') });
  if (url.pathname.includes('/account')) {
    if (method === 'GET') {
      accountReads++;
      if (mode === 'load-error') return reply(500, 'Không thể tải thông tin tài khoản Customer');
      return reply(200, 'Lấy thông tin tài khoản Customer thành công', account);
    }
    if (mode === 'delayed') await new Promise((resolve) => { release = resolve; });
    if (mode === 'duplicate') return reply(409, 'Email đăng nhập đã tồn tại', null, { email: 'Email đăng nhập đã tồn tại' });
    if (mode === 'stale') return reply(409, 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu', null, { customerVersion: 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu' });
    if (mode === 'already-locked') { account = present('LOCKED'); return reply(409, 'Tài khoản Customer đã bị khóa'); }
    if (mode === 'failure') return reply(500, 'Server failure');
    assert.equal(request.headers()['x-csrf-token'], 'browser-uc08');
    if (method === 'POST') {
      assert.deepEqual(Object.keys(body).sort(), ['confirmPassword', 'customerVersion', 'email', 'password']);
      assert.equal(body.password, body.confirmPassword);
      assert.equal(body.customerVersion.toString(), account.customerVersion.toString());
      customer = { ...customer, version: new LosslessNumber(String(BigInt(customer.version.toString()) + 1n)) };
      account = { ...present(), loginName: body.email, customerVersion: customer.version };
      return reply(201, 'Cấp tài khoản Customer thành công', account);
    }
    assert.equal(request.postData(), undefined);
    const unlock = url.pathname.endsWith('/unlock'); account = { ...account, status: unlock ? 'ACTIVE' : 'LOCKED' };
    return reply(200, unlock ? 'Mở khóa tài khoản Customer thành công' : 'Khóa tài khoản Customer thành công', account);
  }
  if (url.pathname.endsWith('/vehicles')) return reply(200, 'Lấy danh sách phương tiện thành công', { customerId: id, customerVersion: customer.version, vehicles: [] });
  if (url.pathname.endsWith(`/customers/${id}`)) {
    if (method === 'PUT') { assert.equal(body.version.toString(), customer.version.toString()); customer = { ...customer, ...body }; }
    return reply(200, method === 'PUT' ? 'Cập nhật Customer thành công' : 'Lấy thông tin Customer thành công', customer);
  }
  if (url.pathname.endsWith('/customers')) return reply(200, 'Lấy danh sách Customer thành công', { content: [customer], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true });
  return reply(404, 'Unhandled test endpoint');
});
const open = (path = `/customers/${id}`) => page.goto(base + path, { waitUntil: 'domcontentloaded' });
const waitText = (text) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, text);
const mutations = () => calls.filter((call) => call.path.includes('/account') && call.method !== 'GET');
async function click(label, parent = 'body') {
  const selector = await page.waitForFunction((text, root) => [...document.querySelector(root).querySelectorAll('button, a')]
    .find((node) => node.textContent.trim() === text && !node.disabled && node.getClientRects().length), {}, label, parent);
  await selector.asElement().click(); await selector.dispose();
}
async function fill(selector, value) {
  await page.waitForSelector(selector + ':not(:disabled)'); await page.focus(selector);
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace'); await page.type(selector, value);
}
const password = async () => {
  await fill('.customer-account-dialog [name=password]', 'Password123');
  await fill('.customer-account-dialog [name=confirmPassword]', 'Password123');
};
const shot = async (name) => {
  assert.equal(await page.$$eval('.customer-account-dialog [name=password][type=text], .customer-account-dialog [name=confirmPassword][type=text]', (nodes) => nodes.length), 0);
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
};
const snapshot = async (name) => {
  const html = await page.evaluate(() => {
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll('script').forEach((node) => node.remove());
    copy.querySelectorAll('input[name=password], input[name=confirmPassword]').forEach((node) => { node.setAttribute('value', ''); node.setAttribute('type', 'password'); });
    const dialog = copy.querySelector('dialog');
    if (dialog) {
      dialog.removeAttribute('open');
      const script = document.createElement('script'); script.textContent = 'document.querySelector("dialog").showModal();'; copy.querySelector('body').append(script);
    }
    copy.querySelector('title').textContent = 'UC08 captured application fixture (mocked API)';
    return '<!doctype html>\n' + copy.outerHTML;
  });
  writeFileSync(resolve(output, `${name}.html`), html);
};
async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await check('Host list has no account N+1 requests; detail exposes the selected account only', async () => {
    await open('/customers?q=An'); assert.equal(accountReads, 0);
    await click('Chi tiết & Phương tiện'); await waitText('Customer chưa được cấp tài khoản');
    assert.equal(await page.$('.property-switcher-container'), null);
    assert.equal(accountReads, 1); await shot('desktop-unprovisioned');
  });
  await check('Provision modal validates, toggles each password and retains secrets on duplicate email', async () => {
    await click('Cấp tài khoản'); await page.waitForSelector('.customer-account-dialog [name=email]');
    assert.equal(await page.$eval('.customer-account-dialog [name=email]', (node) => node.value), customer.email);
    assert.equal(await page.$eval('.customer-account-dialog [name=password]', (node) => node.autocomplete), 'new-password');
    await click('Cấp tài khoản', 'dialog'); await waitText('Vui lòng nhập mật khẩu ban đầu');
    assert.equal(mutations().length, 0); await shot('desktop-validation');
    await password(); await page.click('button[aria-label="Hiện mật khẩu ban đầu"]');
    assert.equal(await page.$eval('[name=password]', (node) => node.type), 'text');
    assert.equal(await page.$eval('[name=confirmPassword]', (node) => node.type), 'password');
    await page.click('button[aria-label="Ẩn mật khẩu ban đầu"]');
    mode = 'duplicate'; await click('Cấp tài khoản', 'dialog'); await waitText('Email đăng nhập đã tồn tại');
    assert.equal(await page.$eval('[name=password]', (node) => node.value), 'Password123');
    assert.equal(await page.$eval('[name=confirmPassword]', (node) => node.value), 'Password123');
    await shot('desktop-duplicate-email');
  });
  await check('Successful provision updates the account and full UC21 version without changing contact email', async () => {
    mode = 'normal'; await fill('[name=email]', 'separate@example.test'); await click('Cấp tài khoản', 'dialog');
    await waitText('Cấp tài khoản Customer thành công'); await page.waitForFunction(() => !document.querySelector('dialog'));
    await page.waitForSelector('.customer-detail-header button:not(:disabled).customer-button--primary');
    assert.equal(customer.email, 'contact@example.test'); assert.equal(account.loginName, 'separate@example.test');
    await shot('desktop-active');
    await click('Chỉnh sửa hồ sơ'); await page.waitForSelector('dialog [name=fullName]');
    await click('Lưu thay đổi', 'dialog'); await waitText('Cập nhật Customer thành công');
  });
  await check('Lock and unlock require explicit confirmation; cancellation never writes', async () => {
    const before = mutations().length;
    await click('Khóa tài khoản'); await waitText('Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Hủy'); await shot('desktop-lock-confirmation');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog'));
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Khóa tài khoản'); assert.equal(mutations().length, before);
    await click('Khóa tài khoản'); await waitText('Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức');
    await click('Khóa tài khoản', 'dialog'); await waitText('Khóa tài khoản Customer thành công'); await shot('desktop-locked');
    await click('Mở khóa tài khoản'); await waitText('Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay');
    await shot('desktop-unlock-confirmation'); await click('Hủy', 'dialog'); assert.equal(mutations().length, before + 1);
    await click('Mở khóa tài khoản'); await waitText('Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay');
    await click('Mở khóa tài khoản', 'dialog'); await waitText('Mở khóa tài khoản Customer thành công');
  });
  await check('Stale version preserves the form and requires explicit reload and a new submit', async () => {
    reset(); await open(`/customers/${id}?accountAction=provision`); await page.waitForSelector('[name=email]'); await password();
    mode = 'stale'; await click('Cấp tài khoản', 'dialog'); await waitText('Hồ sơ vừa được thay đổi, vui lòng tải lại');
    const before = mutations().length; account.customerVersion = new LosslessNumber('9007199254740993'); customer.version = account.customerVersion;
    mode = 'normal'; await click('Tải lại', 'dialog'); await page.waitForSelector('.customer-account-dialog button[type=submit]:not(:disabled)');
    assert.equal(await page.$eval('[name=password]', (node) => node.value), 'Password123'); assert.equal(mutations().length, before);
    await click('Cấp tài khoản', 'dialog'); await waitText('Cấp tài khoản Customer thành công');
    assert.equal(mutations().at(-1).version, '9007199254740993');
  });
  await check('Rapid submit, pending Escape and concurrent state changes never produce duplicate writes', async () => {
    reset(); await open(`/customers/${id}?accountAction=provision`); await page.waitForSelector('[name=email]'); await password(); mode = 'delayed';
    await page.$eval('dialog form', (form) => { form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => document.querySelector('dialog button[type=submit]').disabled);
    assert.equal(mutations().length, 1); await page.keyboard.press('Escape'); assert.ok(await page.$('dialog[open]'));
    assert.ok(release); release(); await waitText('Cấp tài khoản Customer thành công');
    await click('Khóa tài khoản'); await waitText('Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức'); mode = 'already-locked';
    await click('Khóa tài khoản', 'dialog'); await waitText('Tài khoản Customer đã bị khóa');
    await page.waitForFunction(() => !document.querySelector('dialog')); assert.equal(account.status, 'LOCKED');
  });
  await check('Responsive account states, modal focus trap and zoom-equivalent reflow', async () => {
    for (const width of [390, 768, 1024, 1440, 720]) {
      await page.setViewport({ width, height: width === 720 ? 500 : 1000 }); reset(); await open(); await waitText('Customer chưa được cấp tài khoản');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Page overflow at ${width}`);
      if (width === 390) await shot('mobile-unprovisioned');
      await click('Cấp tài khoản'); await page.waitForSelector('dialog [name=email]');
      assert.equal(await page.$eval('dialog', (node) => node.scrollWidth <= node.clientWidth), true, `Modal overflow at ${width}`);
      assert.equal(await page.$$eval('.customer-account-section button, .customer-account-dialog input, .customer-account-dialog button',
        (nodes) => nodes.every((node) => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1; })), true, `Clipped account control at ${width}`);
      if (width < 960) assert.equal(await page.$$eval('.dash-mobile-shortcuts a[aria-current=page]', (nodes) => nodes.length), 1);
      await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
      assert.equal(await page.evaluate(() => document.activeElement?.closest('dialog') !== null), true);
      if (width === 390) { await shot('mobile-provision'); await click('Cấp tài khoản', 'dialog'); await waitText('Vui lòng nhập mật khẩu ban đầu'); await shot('mobile-validation'); }
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog'));
      if (width === 390) {
        account = present(); await open(); await waitText('Đang hoạt động'); await shot('mobile-active');
        await click('Khóa tài khoản'); await waitText('Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức'); await shot('mobile-lock-confirmation');
        await click('Khóa tài khoản', 'dialog'); await waitText('Khóa tài khoản Customer thành công'); await shot('mobile-locked');
        await click('Mở khóa tài khoản'); await waitText('Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay'); await shot('mobile-unlock-confirmation');
        await page.keyboard.press('Escape');
      }
    }
  });
  await check('History, guarded drafts, invalid routes and role restrictions preserve the customer context', async () => {
    reset(); await open(`/customers/${id}?q=An&page=2&size=50`); await waitText('Customer chưa được cấp tài khoản');
    await click('Cấp tài khoản'); await page.waitForSelector('[name=email]');
    await page.goBack(); await page.waitForFunction(() => !document.querySelector('dialog')); await page.goForward();
    await page.waitForSelector('[name=email]'); await password();
    await page.goBack(); await page.waitForFunction(() => !document.querySelector('dialog'));
    await click('Cấp tài khoản'); await page.waitForSelector('[name=password]'); assert.equal(await page.$eval('[name=password]', (node) => node.value), '');
    await page.keyboard.press('Escape');
    await open(`/customers/${id}?accountAction=lock&action=edit&q=An&page=2&size=50`);
    await waitText('Đường dẫn khách thuê không hợp lệ. Vui lòng chọn lại thao tác.'); assert.ok(!await page.$('dialog'));
    assert.equal(new URL(page.url()).search, '?q=An&page=2&size=50');
    for (const otherRole of ['ADMIN', 'CUSTOMER']) {
      role = otherRole; calls = []; await open(`/customers/${id}?accountAction=provision`);
      await waitText('Bạn không có quyền thực hiện chức năng này'); assert.equal(calls.some((call) => call.path.includes('/customers')), false);
    }
  });
  reset(); account = present(); await page.setViewport({ width: 1440, height: 1000 }); await open(); await waitText('Đang hoạt động');
  await snapshot('review-active');
  reset(); await open(`/customers/${id}?accountAction=provision`); await page.waitForSelector('dialog [name=email]');
  await snapshot('review-provision');
  if (process.env.UC08_HALLMARK_RENDER === '1') {
    const checker = process.env.HALLMARK_CHECKER || 'C:/Users/lequa/.agents/skills/hallmark/scripts/sloplint.mjs';
    const args = [checker, 'src/components/customers/CustomerAccountSection.tsx', 'src/components/customers/CustomerAccountDialog.tsx',
      'src/components/customers/customer-accounts.css', '--scope', 'app', '--genre', 'modern-minimal', '--render', '--json',
      '--url', `${base}/.hallmark/shots/customer-accounts/review-active.html`, '--url', `${base}/.hallmark/shots/customer-accounts/review-provision.html`];
    try {
      const { stdout } = await promisify(execFile)(process.execPath, args, { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 });
      writeFileSync(resolve(output, 'hallmark.json'), stdout); console.log('Hallmark render ' + JSON.stringify(JSON.parse(stdout).summary));
    } catch (error) {
      if (typeof error.stdout === 'string') writeFileSync(resolve(output, 'hallmark.json'), error.stdout);
      throw new Error('Hallmark render failed; see customer-accounts/hallmark.json', { cause: error });
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ backend: 'mocked API; real Chrome/Edge and React application', checks, errors,
    reflow: '390/768/1024/1440px; 720x500 models the CSS viewport of 1440x1000 at 200% zoom', sessionRevocation: 'not verified by this harness' }, null, 2));
  console.log(`Completed ${checks.length} browser scenarios. Evidence: ${output}`);
} finally { await browser.close(); await server?.close(); }
