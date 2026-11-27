import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.env.INVOICE_PREVIEW_URL || 'http://127.0.0.1:5179';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH.');
const browser = await puppeteer.launch({executablePath,headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const click = async label => {
    await page.waitForFunction(name => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === name && !x.disabled), {}, label);
    await page.evaluate(name => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === name && !x.disabled).click(), label);
  };

  await page.setViewport({width:1280,height:800});
  await page.goto(base + '/tests/fixtures/invoice-drafts-preview.html?view=schedule');
  await page.waitForSelector('tbody input[type=checkbox]');
  await page.click('tbody input[type=checkbox]');
  await click('Xem trước lập hàng loạt');
  await click('Xác nhận lập hàng loạt');
  await page.waitForFunction(() => document.body.innerText.includes('Cần xử lý (1)'));
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.matches(':focus-visible')), true);

  await page.setViewport({width:390,height:844});
  await page.goto(base + '/tests/fixtures/invoice-drafts-preview.html');
  await page.waitForFunction(() => document.body.innerText.includes('Tổng tạm tính'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Phát hành hóa đơn')).disabled), true);
  await click('Xem trước tính lại');
  await click('Hủy xem trước');
  assert.equal(await page.$('[aria-label="Kết quả dự kiến sau tính lại"]'), null);
  assert.deepEqual(errors, []);
  console.log('PASS lịch và tạo lô, focus bàn phím, nháp thiếu dữ liệu, xem trước/hủy và bố cục 390px (API fixture).');
} finally {
  await browser.close();
}
