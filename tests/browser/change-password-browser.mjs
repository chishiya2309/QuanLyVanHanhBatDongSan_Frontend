import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.PASSWORD_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to an installed Chrome or Edge');
const output = resolve('.hallmark/shots/change-password');
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.message));
async function visit(query = '', width = 1280, height = 800) {
  await page.setViewport({ width, height });
  await page.goto(`${base}/tests/fixtures/change-password-preview.html?${query}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('.user-profile-badge');
  await page.click('.user-profile-badge');
  await page.waitForSelector('#profile-change-password');
  await page.click('#profile-change-password');
  await page.waitForSelector('.change-dialog[open]');
  assert.equal(await page.$$eval('dialog[open]', (dialogs) => dialogs.length), 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'change-currentPassword');
}
async function fill() {
  for (const [id, value] of [['currentPassword', 'oldPassword'], ['newPassword', ' newPassword123 '], ['confirmPassword', ' newPassword123 ']]) await page.type(`#change-${id}`, value);
}
async function submit() { await page.click('.change-button--primary'); }
async function shot(name) {
  const fits = await page.evaluate(() => {
    const dialog = document.querySelector('.change-dialog');
    const box = dialog.getBoundingClientRect();
    const footer = dialog.querySelector('footer').getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1
      && footer.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth;
  });
  assert.ok(fits, `Dialog/actions fit at ${name}`);
  await page.screenshot({ path: resolve(output, `${name}.png`) });
}
async function check(name, action) { await action(); checks.push(name); }

try {
  await check('all roles and responsive form', async () => {
    for (const role of ['ADMIN', 'HOST', 'CUSTOMER']) for (const width of [375, 834, 1280]) {
      await visit(`role=${role}`, width, width === 375 ? 812 : 800);
      await shot(`${role.toLowerCase()}-${width}`);
      const targets = await page.$$eval('.change-dialog button, .change-dialog input', (controls) => controls.every((control) => {
        const box = control.getBoundingClientRect(); return box.height >= 44 && box.width >= 44;
      }));
      assert.ok(targets, 'Controls have 44px hit targets');
    }
  });
  await check('keyboard trap, independent visibility, Escape, backdrop, reset and focus restoration', async () => {
    await visit();
    for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.querySelector('.change-dialog').contains(document.activeElement))); }
    await page.keyboard.down('Shift');
    for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.querySelector('.change-dialog').contains(document.activeElement))); }
    await page.keyboard.up('Shift');
    await fill();
    await page.click('#change-newPassword + button');
    assert.equal(await page.$eval('#change-newPassword', (input) => input.type), 'text');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'change-newPassword');
    assert.equal(await page.$eval('#change-currentPassword', (input) => input.type), 'password');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.profile-dialog[open]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'profile-change-password');
    await page.click('#profile-change-password');
    assert.ok(await page.$$eval('.change-dialog input', (inputs) => inputs.every((input) => input.value === '' && input.type === 'password')));
    await page.mouse.click(2, 2);
    await page.waitForSelector('.profile-dialog[open]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'profile-change-password');
  });
  await check('required fields, focus, UTF-8 boundary and unchanged values', async () => {
    await visit('', 375, 812); await submit();
    assert.equal(await page.$$eval('[aria-invalid="true"]', (inputs) => inputs.length), 3);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'change-currentPassword');
    await shot('required-errors-375');
    await page.type('#change-currentPassword', 'oldPassword');
    await page.type('#change-newPassword', 'á'.repeat(37));
    await page.type('#change-confirmPassword', 'á'.repeat(37)); await submit();
    assert.equal(await page.$eval('#change-newPassword-help', (helper) => helper.textContent), 'Mật khẩu không được vượt quá 72 byte UTF-8');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.passwordRequests), undefined);
    await shot('utf8-error-375');
  });
  await check('loading locks duplicate POST and dismissal; reduced motion', async () => {
    await visit('state=loading'); await fill();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await submit();
    await page.waitForSelector('.change-spinner');
    await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await page.mouse.click(2, 2);
    assert.ok(await page.$('.change-dialog[open]'));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.passwordRequests), '1');
    assert.ok(await page.$$eval('.change-dialog button, .change-dialog input', (controls) => controls.every((control) => control.disabled)));
    assert.equal(await page.$eval('.change-spinner', (spinner) => getComputedStyle(spinner).animationName), 'none');
    await shot('submitting'); await page.emulateMediaFeatures([]);
  });
  await check('field/system/network/CSRF/forbidden errors and manual CSRF retry', async () => {
    for (const state of ['field-error', 'error', 'network', 'csrf', 'forbidden']) {
      await visit(`state=${state}`, 375, 812); await fill(); await submit();
      await page.waitForFunction(() => document.querySelector('.change-help--error') || document.querySelector('.change-alert'));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.passwordRequests), '1');
      if (state === 'forbidden') assert.equal(await page.$('.change-dialog input'), null);
      else assert.equal(await page.$eval('#change-newPassword', (input) => input.value), ' newPassword123 ');
      await shot(`${state}-375`);
      if (state === 'csrf') {
        await submit(); await page.waitForSelector('.auth-notice.alert-success');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.passwordRequests), '2');
      }
    }
  });
  await check('success and expired session navigate to typed login notices without logout or refresh', async () => {
    const extraRequests = [];
    const listener = (request) => { if (/\/(logout|refresh)$/.test(request.url())) extraRequests.push(request.url()); };
    page.on('request', listener);
    for (const state of ['success', 'expired']) {
      await visit(`state=${state}`); await fill(); await submit();
      await page.waitForSelector(state === 'success' ? '.auth-notice.alert-success' : '.auth-notice.alert-error');
      assert.equal(await page.$('dialog[open]'), null);
      assert.equal(await page.$eval('#password', (input) => input.value), '');
      await page.screenshot({ path: resolve(output, `login-${state}.png`) });
      await page.type('#password', 'a');
      assert.equal(await page.$('.auth-notice'), null);
    }
    page.off('request', listener);
    assert.deepEqual(extraRequests, []);
  });
  await check('200% zoom equivalent reflow and large text keep footer reachable', async () => {
    await visit('', 640, 400);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const field of ['currentPassword', 'newPassword', 'confirmPassword']) {
      const visible = await page.$eval(`#change-${field}`, (input) => {
        input.focus(); input.scrollIntoView({ block: 'center' });
        const box = input.getBoundingClientRect();
        const dialog = input.closest('dialog').getBoundingClientRect();
        const body = input.closest('.change-body').getBoundingClientRect();
        const footer = input.closest('form').querySelector('footer').getBoundingClientRect();
        return document.activeElement === input && box.top >= Math.max(0, dialog.top, body.top)
          && box.bottom <= Math.min(innerHeight, dialog.bottom, body.bottom, footer.top);
      });
      assert.ok(visible, `${field} stays fully visible inside the dialog without footer overlap`);
      await page.screenshot({ path: resolve(output, `zoom-200-${field}.png`) });
    }
    await page.$eval('.change-footer', (footer) => footer.scrollIntoView({ block: 'end' }));
    await shot('zoom-200-reflow');
  });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, screenshots: output, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, screenshots: output }, null, 2));
} finally { await browser.close(); }
