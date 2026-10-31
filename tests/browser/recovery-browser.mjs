import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const base = process.env.RECOVERY_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/recovery'); mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage(); const errors = []; const checks = [];
const group = process.argv[2];
page.on('pageerror', (error) => errors.push(error.message));
async function check(name, action) { if (group && !name.includes(group)) return; await action(); checks.push(name); }
async function visit(screen = 'forgot', state = 'success', width = 1280, height = 900, token = 'preview-only-token') {
  await page.setViewport({ width, height });
  await page.goto(`${base}/tests/fixtures/recovery-preview.html?screen=${screen}&state=${state}${screen === 'reset' && token ? '#token=' + token : ''}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('.recovery-content');
  assert.equal(new URL(page.url()).hash, '');
  if (screen === 'reset' && !['checking', 'invalid', 'verify-error'].includes(state) && token) await page.waitForSelector('#reset-newPassword');
}
async function fillReset() { for (const id of ['newPassword', 'confirmPassword']) await page.type(`#reset-${id}`, ' newPassword123 '); }
async function submit() { await page.click('.recovery-button--primary'); }
async function shot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} has no horizontal scroll`);
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
}
try {
  await check('two-column and mobile layouts for both screens', async () => {
    for (const screen of ['forgot', 'reset']) for (const width of [375, 834, 1280]) {
      await visit(screen, 'success', width); await shot(`${screen}-${width}`);
      const targets = await page.$$eval('.recovery-content button, .recovery-content input, .recovery-content a', (elements) => elements.every((el) => { const r = el.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; }));
      assert.ok(targets);
    }
  });
  await check('email validation, acknowledgement and explicit resubmission', async () => {
    await visit(); await submit();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'recovery-email');
    await page.type('#recovery-email', ' USER@EXAMPLE.COM '); await submit();
    await page.waitForSelector('.recovery-accepted'); await shot('request-accepted');
    assert.ok(await page.$eval('.recovery-accepted', (el) => el.textContent.includes('Nếu tài khoản đủ điều kiện')));
    await page.click('.recovery-button'); await page.waitForSelector('#recovery-email');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.forgotRequests), '1');
  });
  await check('StrictMode token handshake, checking, missing and invalid states', async () => {
    await visit('reset');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.validateRequests), '1');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.recoveryAuthBootstrap), undefined);
    assert.equal(await page.evaluate(() => history.state), null);
    await visit('reset', 'checking'); assert.equal(await page.$('#reset-newPassword'), null); await shot('checking');
    await visit('reset', 'invalid'); await page.waitForSelector('.recovery-error'); assert.equal(await page.$('#reset-newPassword'), null); await shot('invalid-link');
    await visit('reset', 'success', 1280, 900, ''); assert.equal(await page.$('#reset-newPassword'), null);
  });
  await check('verification failure is retryable and is not an invalid-link assertion', async () => {
    await visit('reset', 'verify-error'); await page.waitForSelector('.recovery-error');
    assert.equal(await page.$('#reset-newPassword'), null);
    await page.click('.recovery-button'); await page.waitForSelector('#reset-newPassword');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.validateRequests), '2');
  });
  await check('reset required fields, visibility, focus and UTF-8 validation', async () => {
    await visit('reset', 'success', 375); await submit();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-newPassword');
    await page.type('#reset-newPassword', 'á'.repeat(37)); await page.type('#reset-confirmPassword', 'á'.repeat(37)); await submit();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.resetRequests), undefined);
    assert.ok(await page.$eval('#reset-newPassword-help', (el) => el.textContent.includes('72 byte')));
    await page.click('#reset-newPassword + button');
    assert.equal(await page.$eval('#reset-newPassword', (el) => el.type), 'text');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-newPassword'); await shot('utf8-error-375');
  });
  await check('CSRF, server/network/field errors and token expiry remain distinct', async () => {
    for (const state of ['csrf', 'error', 'network', 'field-error', 'expired']) {
      await visit('reset', state); await fillReset(); await submit();
      await page.waitForFunction(() => document.querySelector('.recovery-error') || document.querySelector('.recovery-help--error'));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.resetRequests), '1');
      if (state === 'expired') assert.equal(await page.$('#reset-newPassword'), null);
      else assert.equal(await page.$eval('#reset-newPassword', (input) => input.value), ' newPassword123 ');
      await shot(state);
    }
  });
  await check('pending submits cannot duplicate and reduced motion is supported', async () => {
    await visit('reset', 'loading'); await fillReset();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await submit();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.resetRequests), '1');
    assert.equal(await page.$eval('.recovery-spinner', (el) => getComputedStyle(el).animationName), 'none');
    assert.ok(await page.$$eval('.recovery-form input, .recovery-form button', (els) => els.every((el) => el.disabled)));
    await shot('submitting'); await page.emulateMediaFeatures([]);
  });
  await check('success returns to login without auth mutation requests; Back/reload cannot reuse saved token', async () => {
    const forbiddenRequests = [];
    const listener = (request) => { if (/\/(login|logout|refresh)$/.test(request.url())) forbiddenRequests.push(request.url()); };
    page.on('request', listener);
    await visit('reset'); await fillReset(); await submit(); await page.waitForSelector('.auth-notice.alert-success');
    assert.equal(new URL(page.url()).pathname, '/'); assert.equal(await page.$eval('#password', (el) => el.value), ''); await shot('login-success');
    assert.deepEqual(forbiddenRequests, []); page.off('request', listener);
    await visit('forgot'); await page.click('.recovery-back'); await page.waitForSelector('#loginName');
    await page.goBack({ waitUntil: 'networkidle0' }); await page.waitForSelector('#recovery-email');
    await page.goForward({ waitUntil: 'networkidle0' }); await page.waitForSelector('#loginName');
    await visit('reset'); await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('.recovery-error'); assert.equal(await page.$('#reset-newPassword'), null);
  });
  await check('large text and 200% reflow preserve every field and action', async () => {
    await visit('reset', 'success', 640, 400); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const selector of ['#reset-newPassword', '#reset-confirmPassword', '.recovery-button--primary']) {
      assert.ok(await page.$eval(selector, (el) => { el.focus(); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }));
    }
    await shot('zoom-200');
  });
  await check('production email renderer preview: desktop/mobile, no CSS block and simulated dark preference', async () => {
    const email = resolve('../quan_ly_van_hanh_bat_dong_san_backend/target/password-reset-email-preview/password-reset.html');
    assert.ok(existsSync(email), 'Run PasswordResetEmailRendererTest first');
    for (const width of [375, 834, 1280]) {
      await page.setViewport({ width, height: 1100 }); await page.goto(pathToFileURL(email).href); await shot(`email-${width}`);
      assert.ok(await page.$eval('h1', (heading) => {
        const text = heading.firstChild;
        const line = (word) => { const start = text.textContent.indexOf(word); const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + word.length); return range.getBoundingClientRect().top; };
        return Math.abs(line('của') - line('bạn')) < 1;
      }), 'Email heading keeps the final phrase together');
    }
    await page.setViewport({ width: 375, height: 1100 }); await page.goto(pathToFileURL(email).href);
    await page.$$eval('style', (styles) => styles.forEach((el) => el.remove())); await shot('email-without-style-block');
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); await page.goto(pathToFileURL(email).href); await shot('email-dark-preference');
    assert.ok(readFileSync(email.replace('.html', '.txt'), 'utf8').includes('30 phút'));
  });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, group ? `results-${group}.json` : 'results.json'), JSON.stringify({ checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, output }, null, 2));
} finally { await browser.close(); }
