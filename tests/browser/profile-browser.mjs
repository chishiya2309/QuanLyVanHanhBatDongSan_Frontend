import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.PROFILE_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to an installed Chrome or Edge executable');
const output = resolve('.hallmark/shots/profile');
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
const scriptErrors = [];
page.on('pageerror', (error) => scriptErrors.push(error.message));
const checks = [];
const group = process.argv[2];
async function check(name, action) { if (group && !name.includes(group)) return; await action(); checks.push(name); }
async function visit(query = '', width = 1280) {
  await page.setViewport({ width, height: width === 375 ? 812 : width === 834 ? 1112 : 800 });
  await page.goto(`${base}/tests/fixtures/profile-preview.html?${query}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('dialog[open]');
  if (!query.includes('state=loading')) await page.waitForFunction(() => !document.querySelector('.profile-loading'));
}
async function clickText(text) {
  await page.evaluate((label) => {
    const match = [...document.querySelectorAll('dialog button')].find((el) => el.textContent.trim() === label);
    if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button ${label}`);
    match.click();
  }, text);
}
async function shot(name) {
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  const fits = await page.evaluate(() => {
    const dialog = document.querySelector('dialog');
    const box = dialog.getBoundingClientRect();
    const footer = dialog.querySelector('footer').getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight + 1
      && footer.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
  });
  assert.ok(fits, `Modal and actions must fit at ${name}`);
}

try {
  await check('three roles and responsive records', async () => {
    for (const role of ['ADMIN', 'HOST', 'CUSTOMER']) {
      for (const width of [375, 834, 1280]) {
        await visit(`role=${role}`, width);
        await shot(`${role.toLowerCase()}-view-${width}`);
        const editable = await page.evaluate(() => [...document.querySelectorAll('dialog button')].some((el) => el.textContent.includes('Chỉnh sửa hồ sơ')));
        assert.equal(editable, role !== 'CUSTOMER');
      }
    }
    for (const role of ['ADMIN', 'HOST']) for (const width of [375, 1280]) {
      await visit(`role=${role}&mode=edit`, width);
      await page.waitForSelector('#profile-email');
      assert.equal(await page.$eval('#profile-email', (el) => el.disabled), true);
      await shot(`${role.toLowerCase()}-edit-${width}`);
    }
  });
  await check('loading, missing, saving, error, inline error and success states', async () => {
    for (const state of ['loading', 'empty', 'saving', 'error', 'field-error', 'success']) {
      await visit(`role=HOST&mode=edit&state=${state}`, state === 'field-error' ? 375 : 1280);
      if (state === 'success') await page.waitForSelector('.profile-alert--success');
      if (state === 'error') await page.waitForSelector('.profile-alert--error');
      if (state === 'field-error') await page.waitForSelector('[aria-invalid="true"]');
      if (state === 'saving') {
        await page.waitForSelector('[aria-busy="true"]');
        await page.keyboard.press('Escape');
        assert.ok(await page.$('dialog[open]'), 'Saving must prevent dismissal');
      }
      await shot(`host-${state}`);
    }
  });
  await check('native focus trap, unsaved close, Escape, backdrop and focus restoration', async () => {
    await visit('role=HOST&mode=edit', 1280);
    await page.type('#profile-businessName', ' bản nháp');
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
    }
    await page.keyboard.down('Shift');
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
    }
    await page.keyboard.up('Shift');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#profile-title').textContent === 'Bỏ thay đổi chưa lưu?');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Tiếp tục chỉnh sửa');
    await shot('host-discard-confirmation');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#profile-businessName');
    assert.ok(await page.$eval('#profile-businessName', (el) => el.value.endsWith(' bản nháp')));
    await page.mouse.click(8, 8);
    await page.waitForFunction(() => document.querySelector('#profile-title').textContent === 'Bỏ thay đổi chưa lưu?');
    await clickText('Bỏ thay đổi');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    // A native dialog restores the previously focused trigger when the real entry opens it.
    await page.click('main > button');
    await page.waitForSelector('dialog[open]');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Mở hồ sơ');
  });
  await check('long values stay readable and reduced motion stops the spinner', async () => {
    for (const width of [375, 1280]) { await visit('role=HOST&long=1', width); await shot(`host-long-${width}`); }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await visit('role=HOST&mode=edit&state=saving');
    assert.equal(await page.$eval('.profile-spinner', (el) => getComputedStyle(el).animationName), 'none');
  });
  await check('real App entry opens from mobile Topbar and synchronizes after PATCH', async () => {
    const app = await browser.newPage();
    let record = { role: 'HOST', businessName: 'RentOps Real Estate Corp', phoneNumber: '+84987654321', email: 'host@rentops.vn', officeAddress: '123 Võ Văn Ngân, TP. Thủ Đức, TP.HCM', logoUrl: null };
    const requests = [];
    await app.setRequestInterception(true);
    app.on('request', async (request) => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith('/api/v1/')) { await request.continue(); return; }
      let data;
      if (path.endsWith('/auth/me')) data = { accountId: 'browser-fixture', loginName: 'profile-user', role: 'HOST', hostId: null, customerId: null };
      else if (path.endsWith('/auth/csrf')) data = { token: 'browser-csrf', headerName: 'X-CSRF-TOKEN' };
      else if (path.endsWith('/profile')) {
        if (request.method() === 'PATCH') {
          requests.push({ headers: request.headers(), body: JSON.parse(request.postData()) });
          record = { ...record, ...JSON.parse(request.postData()) };
        }
        data = record;
      }
      await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 200, message: 'OK', data }) });
    });
    try {
      await app.setViewport({ width: 375, height: 812 });
      await app.goto(base, { waitUntil: 'networkidle0' });
      await app.waitForFunction(() => document.querySelector('.user-name')?.textContent === 'RentOps Real Estate Corp');
      assert.equal(await app.$eval('.user-profile-badge', (el) => { const box = el.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; }), true);
      await app.click('.user-profile-badge');
      await app.waitForSelector('dialog[open] .profile-details-grid');
      await app.screenshot({ path: resolve(output, 'app-host-mobile.png') });
      await app.evaluate(() => [...document.querySelectorAll('dialog button')].find((el) => el.textContent.trim() === 'Chỉnh sửa hồ sơ').click());
      await app.waitForSelector('#profile-businessName');
      await app.$eval('#profile-businessName', (el) => { el.select(); });
      await app.keyboard.type('Đơn vị An Gia');
      await app.click('dialog button[type="submit"]');
      await app.waitForSelector('.profile-alert--success');
      assert.equal(await app.$eval('.user-name', (el) => el.textContent), 'Đơn vị An Gia');
      assert.equal(requests.length, 1);
      assert.deepEqual(Object.keys(requests[0].body).sort(), ['businessName', 'officeAddress', 'phoneNumber', 'removeLogo'].sort());
      assert.equal(requests[0].headers['x-csrf-token'], 'browser-csrf');
      assert.equal(requests[0].headers['cache-control'], 'no-store');
    } finally { await app.close(); }
  });
  assert.deepEqual(scriptErrors, [], 'No browser script errors');
  writeFileSync(resolve('.hallmark/browser-results.json'), JSON.stringify({ passed: checks, scriptErrors, screenshots: output }, null, 2));
  console.log(`Passed ${checks.length} browser scenario groups. Screenshots: ${output}`);
} catch (error) {
  await page.screenshot({ path: resolve(output, 'browser-failure.png') }).catch(() => undefined);
  console.error(await page.evaluate(() => ({ title: document.querySelector('#profile-title')?.textContent,
    open: document.querySelector('dialog')?.open, active: document.activeElement?.tagName,
    dialog: document.querySelector('dialog')?.getBoundingClientRect().toJSON() })));
  throw error;
} finally {
  await browser.close();
}
