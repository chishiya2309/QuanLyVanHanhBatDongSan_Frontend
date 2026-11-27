import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const root = process.env.FINANCE_PREVIEW_URL || 'http://127.0.0.1:5179';
const path = '/reports/expense-breakdown';
const fixture = root + '/tests/fixtures/finance-preview.html';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await puppeteer.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const open = (route, role = 'HOST') => page.goto(fixture + '?' + new URLSearchParams({ route, role }), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const waitText = value => page.waitForFunction(text => document.body.innerText.includes(text), {}, value);
  const click = async selector => { await page.waitForSelector(selector); await page.$eval(selector, item => item.click()); };
  const button = text => page.evaluate(label => {
    const element = [...document.querySelectorAll('main button')].find(item => item.textContent.trim() === label);
    if (!element) throw new Error('Missing button: ' + label);
    element.click();
  }, text);
  const query = key => new URL(page.url()).searchParams.get(key);
  await page.setViewport({ width: 1440, height: 900 });
  await open('/reports/profit-loss');
  await waitText('Phân tích cơ cấu chi phí');
  await button('Phân tích cơ cấu chi phí');
  await waitText('Tỷ trọng theo chi phí trước giảm trừ');
  assert.equal(query('fromDate'), '2025-12-01');
  assert.equal(query('toDate'), '2026-11-24');
  await page.$eval('.expense-slice a circle', circle => {
    circle.scrollIntoView({ block: 'center' });
  });
  const slice = await page.$eval('.expense-slice a circle', circle => {
    const bounds = circle.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + 2 };
  });
  await page.mouse.click(slice.x, slice.y);
  await waitText('Chi phí trước giảm trừ trên toàn bộ kết quả');
  assert.equal(query('expenseMetric'), 'gross');
  await click('a[href^="/reports/expense-breakdown"]');
  await waitText('Tỷ trọng theo chi phí trước giảm trừ');
  await button('So sánh hai kỳ');
  await waitText('đường dọc tại 0');
  await click('button[aria-label="Sắp xếp theo Chi phí thuần"]');
  await page.waitForSelector('th[aria-sort="ascending"]');
  const original = page.url();
  await click('a[aria-label="Xem chi tiết Bảo trì kỳ đối chiếu"]');
  await waitText('Chi phí thuần trên toàn bộ kết quả');
  assert.equal(query('fromDate'), '2026-10-01');
  assert.equal(query('financialCategoryCode'), 'MAINTENANCE');
  await button('Trang sau');
  await waitText('Trang 2/2');
  assert.equal(query('financialImpact'), 'OPERATING_EXPENSE');
  const detailUrl = new URL(page.url());
  await open(detailUrl.pathname + detailUrl.search);
  await waitText('Trang 2/2');
  await click('a[href^="/reports/expense-breakdown"]');
  await waitText('đường dọc tại 0');
  assert.equal(page.url(), original);
  await page.goBack();
  await waitText('Trang 2/2');
  await page.goForward();
  await waitText('đường dọc tại 0');

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await open(path + '?areaId=negative&view=net');
  await waitText('đường dọc tại 0');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.$eval('.expense-bars rect', rect => Number(rect.getAttribute('width')) > 0));
  await open(path + '?areaId=empty');
  await waitText('Kỳ phân tích chưa có giao dịch');
  await waitText('Không còn phát sinh');
  await open(path + '?areaId=zero');
  await waitText('Không đủ điều kiện hiển thị tỷ trọng');
  assert.ok(!(await page.evaluate(() => document.body.innerText.includes('Kỳ phân tích chưa có giao dịch'))));
  await open(path + '?areaId=retry');
  await waitText('Không thể tải báo cáo cơ cấu chi phí');
  await button('Thử lại');
  await waitText('Tỷ trọng theo chi phí trước giảm trừ');
  await open(path + '?areaId=foreign');
  await waitText('Khu vực ngoài phạm vi quản lý.');
  await open(path + '?areaId=slow');
  await page.waitForFunction(() => window.financeCalls.some(url => url.includes('areaId=slow')));
  await button('Khôi phục mặc định');
  await waitText('12.000.000');
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.ok(!(await page.evaluate(() => document.body.innerText.includes('88.888.888'))));

  await page.select('select:has(option[value="QUARTER"])', 'QUARTER');
  await button('Áp dụng');
  await page.waitForFunction(() => window.financeCalls.some(url => url.includes('periodType=QUARTER')));
  await page.waitForSelector('select:has(option[value="00000000-0000-4000-8000-000000000092"])');
  await page.select('select:has(option[value="00000000-0000-4000-8000-000000000092"])', '00000000-0000-4000-8000-000000000092');
  await page.waitForSelector('select:has(option[value="00000000-0000-4000-8000-000000000093"])');
  await page.select('select:has(option[value="00000000-0000-4000-8000-000000000093"])', '00000000-0000-4000-8000-000000000093');
  await page.select('select:has(option[value="00000000-0000-4000-8000-000000000092"])', '');
  assert.equal(await page.$eval('label:has(select[disabled]) select', field => field.value), '');
  await open(path, 'CUSTOMER');
  await page.waitForFunction(() => !document.querySelector('.expense-breakdown-page') && !window.financeCalls.some(url => url.includes(path)));
  assert.deepEqual(errors, []);
  console.log('UC75 browser flows passed on desktop and mobile with a fixture.');
} finally {
  await browser.close();
}
