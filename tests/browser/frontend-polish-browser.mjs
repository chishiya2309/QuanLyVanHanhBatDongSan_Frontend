import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.POLISH_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/frontend-polish');
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [], checks = [];
let guest = false, writeGate = null;
const area = { id: 'a1', name: 'Khu A', description: 'Khu vực kiểm thử', active: true, createdAt: '', updatedAt: '' };
const building = { id: 'b1', areaId: 'a1', areaName: area.name, name: 'Tòa A', address: 'Địa chỉ kiểm thử', active: true, createdAt: '', updatedAt: '' };
const floor = { id: 'f1', buildingId: 'b1', name: 'Tầng trệt', level: 0, roomCount: 3, createdAt: '', updatedAt: '' };
const rooms = ['VACANT', 'OCCUPIED', 'MAINTENANCE'].map((status, index) => ({ id: 'r' + (index + 1), code: 'P10' + (index + 1), name: 'Phòng ' + (index + 1), status, isMaintenance: status === 'MAINTENANCE', maintenance: status === 'MAINTENANCE', buildingId: 'b1', floorId: 'f1', area: 28, defaultRent: 0, defaultDeposit: 0 }));
page.on('pageerror', (error) => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', async (request) => {
  const path = new URL(request.url()).pathname;
  if (!path.startsWith('/api/')) return request.continue();
  let status = 200, data = null;
  if (path.endsWith('/auth/me')) {
    if (guest) status = 401;
    else data = { accountId: 'polish-host', loginName: 'Chủ nhà', role: 'HOST', hostId: 'h1', customerId: null };
  } else if (path.endsWith('/auth/refresh')) status = 401;
  else if (path.endsWith('/auth/csrf')) data = { token: 'polish-fixture', headerName: 'X-CSRF-TOKEN' };
  else if (path.endsWith('/google/onboarding')) data = { flowId: 'polish-flow', purpose: 'REGISTER_HOST', email: 'host@example.test', suggestedName: 'Chủ nhà', expiresAt: new Date(Date.now() + 600000).toISOString() };
  else if (path.endsWith('/areas') && request.method() === 'POST') { if (writeGate) await writeGate; data = area; }
  else if (path.endsWith('/areas') || path.endsWith('/active-areas')) data = [area];
  else if (path.endsWith('/buildings')) data = [building];
  else if (path.endsWith('/floors')) data = [floor];
  else if (path.endsWith('/overview')) data = { buildingId: 'b1', buildingName: building.name, address: building.address, floors: [{ floorId: 'f1', floorName: floor.name, floorLevel: 0, rooms }] };
  else if (path.endsWith('/detail') || /\/rooms\/r\d$/.test(path)) data = { ...rooms[1], canEditBasicInfo: false, hasActiveContractOrReservation: true };
  else if (path.endsWith('/history')) data = { roomId: 'r2', roomCode: 'P102', tenancyHistory: [], stateHistory: [] };
  else status = 404;
  return request.respond({ status, contentType: 'application/json', body: JSON.stringify({ status, message: status === 200 ? 'OK' : 'Test fixture', data }) });
});
async function visit(path, width = 1280) {
  await page.setViewport({ width, height: width < 600 ? 812 : 900 });
  await page.goto(base + path, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
}
async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
async function shot(name) { await page.screenshot({ path: resolve(output, name + '.png'), fullPage: !/menu|modal|drawer/.test(name) }); }
async function clickText(label, parent = 'body') {
  const handle = await page.evaluateHandle((label, parent) => [...document.querySelector(parent).querySelectorAll('button,a')].find((e) => e.textContent.trim() === label && e.getClientRects().length), label, parent);
  assert.ok(handle.asElement(), 'Missing visible action: ' + label);
  await handle.asElement().click(); await handle.dispose();
}
try {
  await check('Mobile login prioritizes the form and keeps its action in the first screen', async () => {
    guest = true;
    for (const width of [320, 375, 834, 1280]) {
      await visit('/', width); await page.waitForSelector('.form-panel');
      assert.ok(await page.$eval('#submitBtn', (e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 375 || width === 1280) await shot('login-' + width);
    }
  });
  await check('Assets retain a visible primary hover and compact rows', async () => {
    guest = false; await visit('/tests/fixtures/assets-preview.html', 1440);
    await page.hover('[data-create-asset]');
    assert.notEqual(await page.$eval('[data-create-asset]', (e) => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
    const heights = await page.$$eval('.asset-table tbody tr', (rows) => rows.map((e) => e.getBoundingClientRect().height));
    assert.ok(Math.max(...heights) < 180, JSON.stringify(heights));
    await shot('assets-desktop');
  });
  await check('Asset actions use a keyboard-accessible popover with Escape and light dismissal', async () => {
    const trigger = '.asset-table button[popovertarget]';
    await page.focus(trigger); await page.keyboard.press('Enter');
    await page.waitForSelector('.asset-action-menu:popover-open');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.querySelector('.asset-action-menu:popover-open').contains(document.activeElement)));
    await shot('asset-menu'); await page.keyboard.press('Escape');
    assert.ok(await page.$eval(trigger, (e) => e === document.activeElement));
    assert.equal(await page.$('.asset-action-menu:popover-open'), null);
    await page.click(trigger); await page.waitForSelector('.asset-action-menu:popover-open');
    await page.mouse.click(600, 300); assert.equal(await page.$('.asset-action-menu:popover-open'), null);
    await visit('/tests/fixtures/assets-preview.html', 375);
    await page.click('.asset-mobile-records button[popovertarget]'); await page.waitForSelector('.asset-action-menu:popover-open');
    assert.ok(await page.$eval('.asset-action-menu:popover-open', (e) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; }));
    await shot('assets-mobile-menu');
  });
  await check('Property records expose every action without horizontal scrolling on phones', async () => {
    for (const width of [320, 375, 768, 1280, 1920]) {
      await visit('/properties?tab=buildings', width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width <= 768) assert.ok(await page.$$eval('.prop-table td:last-child button', (buttons) => buttons.every((e) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; })));
      if (width === 375 || width === 1280) await shot('properties-' + width);
    }
  });
  await check('Property dialogs trap focus, close with Escape/backdrop, restore focus and block dismissal while saving', async () => {
    await visit('/properties?tab=areas', 375);
    const trigger = '.prop-page-heading .prop-btn--primary';
    await page.click(trigger); await page.waitForSelector('dialog:modal');
    for (let index = 0; index < 18; index++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.querySelector('dialog:modal').contains(document.activeElement)));
    }
    await page.keyboard.press('Escape'); assert.equal(await page.$('dialog[open]'), null);
    assert.ok(await page.$eval(trigger, (e) => e === document.activeElement));
    await page.click(trigger); await page.mouse.click(3, 3); assert.equal(await page.$('dialog[open]'), null);
    await page.click(trigger); await page.type('#area-name', 'Khu vực mới');
    let release; writeGate = new Promise((done) => { release = done; });
    await page.click('dialog button[type="submit"]'); await page.waitForSelector('#area-name:disabled');
    await page.keyboard.press('Escape'); await page.mouse.click(3, 3);
    assert.ok(await page.$('dialog:modal')); await shot('property-modal-mobile');
    release(); writeGate = null; await page.waitForSelector('dialog', { hidden: true });
    assert.ok(await page.$eval(trigger, (e) => e === document.activeElement));
  });
  await check('Nested floor dialog returns focus to the room form and room drawer uses a modal', async () => {
    await visit('/rooms?view=matrix&buildingId=b1', 375);
    await page.click('.prop-page-heading .prop-btn--primary'); await page.waitForSelector('dialog:modal');
    await clickText('+ Thêm tầng mới', 'dialog'); await page.waitForSelector('dialog[aria-labelledby="floor-modal-title"]:modal');
    await page.keyboard.press('Escape');
    assert.equal(await page.$('dialog[aria-labelledby="floor-modal-title"]'), null);
    assert.ok(await page.$('dialog[aria-labelledby="room-modal-title"]:modal'));
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), '+ Thêm tầng mới');
    await page.keyboard.press('Escape');
    await clickText('Chi tiết', '.room-card:nth-child(2)'); await page.waitForSelector('.prop-drawer:modal');
    await page.waitForFunction(() => document.querySelector('#room-detail-title')?.textContent.includes('P102'));
    await shot('room-drawer-mobile'); await page.keyboard.press('Escape'); assert.equal(await page.$('dialog[open]'), null);
  });
  await check('Google onboarding inherits the coral controls and reduced-motion support', async () => {
    guest = true;
    for (const width of [375, 1280]) {
      await visit('/auth/onboarding', width); await page.waitForSelector('#google-fullName');
      assert.ok(await page.$eval('.google-onboarding-primary', (e) => getComputedStyle(e).backgroundColor === getComputedStyle(document.querySelector('.brand-dot')).color));
      assert.ok(await page.$eval('.google-onboarding-identity', (e) => e.scrollWidth <= e.clientWidth));
      await shot('google-' + width);
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    assert.ok(await page.$eval('.google-onboarding-primary', (e) => parseFloat(getComputedStyle(e).transitionDuration) <= 0.00001));
  });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
