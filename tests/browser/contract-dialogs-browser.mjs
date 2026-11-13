import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to an installed Chrome or Edge');
const base = process.env.CONTRACT_DIALOGS_PREVIEW_URL || 'http://127.0.0.1:5173';
const output = resolve('.hallmark/contracts-polish-20261113/geometry');
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const results = [];
const errors = [];

async function measure(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('.contract-modal');
    const body = modal.querySelector('.contract-modal-body');
    const footer = modal.querySelector('.contract-modal-footer');
    const rectangle = element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      modal: rectangle(modal), body: rectangle(body), footer: rectangle(footer),
      bodyScrolls: body.scrollHeight > body.clientHeight,
      buttons: Array.from(footer.querySelectorAll('button'), button => ({ text: button.textContent.trim(), ...rectangle(button) })),
      fields: Array.from(body.querySelectorAll('input,select,textarea'), rectangle),
    };
  });
}

function check(result, label) {
  const { viewport, modal, body, footer, buttons, fields } = result;
  assert.ok(modal.top >= 0 && modal.bottom <= viewport.height + 1, `${label}: modal leaves the viewport`);
  assert.ok(modal.left >= 0 && modal.right <= viewport.width + 1, `${label}: modal overflows horizontally`);
  assert.ok(body.height > 0 && body.bottom <= footer.top + 1, `${label}: content covers footer`);
  for (const button of buttons) {
    assert.ok(button.height >= 44 && button.top >= footer.top - 1 && button.bottom <= footer.bottom + 1, `${label}: clipped or undersized button ${button.text}`);
    assert.ok(button.left >= modal.left && button.right <= modal.right + 1, `${label}: button overflows horizontally`);
  }
  for (const field of fields) assert.ok(field.left >= modal.left && field.right <= modal.right + 1, `${label}: form field overflows horizontally`);
}

try {
  for (const dialog of ['convert', 'create', 'cancel']) {
    for (const [width, height] of [[1366, 604], [1280, 720], [375, 667], [320, 568], [667, 375]]) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width, height });
      await page.goto(`${base}/tests/fixtures/contract-dialogs-preview.html?dialog=${dialog}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.contract-modal-footer button');
      const before = await measure(page);
      const label = `${dialog} ${width}x${height}`;
      check(before, label);
      await page.$eval('.contract-modal-body', body => { body.scrollTop = body.scrollHeight; });
      const after = await measure(page);
      check(after, label);
      assert.ok(Math.abs(before.footer.top - after.footer.top) < 1, `${label}: footer moves when content scrolls`);
      if (dialog === 'convert') {
        for (let index = 0; index < 14; index++) {
          await page.keyboard.press('Tab');
          assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), `${label}: keyboard focus left the modal`);
        }
        await page.click('.contract-modal-footer button[type="submit"]');
        await page.waitForFunction(() => document.body.textContent.includes('Giá thuê phòng hàng tháng phải lớn hơn 0'));
        check(await measure(page), `${label} with validation error`);
        if (width === 1366 || width === 375) {
          await page.$eval('.contract-modal-body', body => { body.scrollTop = 0; });
          await page.click('#convert-deposit-title');
          await page.screenshot({ path: resolve(output, `${dialog}-${width}x${height}.png`) });
        }
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.contract-modal'));
      } else if (width === 1366 || width === 375) {
        await page.$eval('.contract-modal-body', body => { body.scrollTop = 0; });
        await page.screenshot({ path: resolve(output, `${dialog}-${width}x${height}.png`) });
      }
      results.push({ dialog, width, height, bodyScrolls: before.bodyScrolls, footerVisible: true, fieldsFit: true });
      await page.close();
    }
  }
  assert.deepEqual(errors, [], 'Browser reported application errors');
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks: results, errors }, null, 2));
  console.log(`PASS: ${results.length} dialog/viewport checks, including scrolling, validation, focus containment and Escape.`);
} finally {
  await browser.close();
}
