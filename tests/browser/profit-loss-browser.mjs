import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

// Uses synthetic UC74 responses from the shared finance preview fixture.
const root = process.env.FINANCE_PREVIEW_URL || 'http://127.0.0.1:5179';
const fixture = root + '/tests/fixtures/finance-preview.html';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const waitText = value => page.waitForFunction(text => document.body.innerText.includes(text), {}, value);
  const click = value => page.evaluate(label => {
    const controls = document.querySelectorAll('button, a');
    const control = [...controls].find(element => element.textContent.trim() === label);
    if (!control) throw new Error('Missing control ' + label);
    control.click();
  }, value);
  const open = (query = '', role = 'HOST') => page.goto(fixture + '?' + new URLSearchParams({
    route: '/reports/profit-loss' + query, role,
  }));

  await page.setViewport({ width: 1440, height: 900 });
  await open();
  await waitText('Kết quả kinh doanh tạm tính');
  assert.ok(await page.evaluate(() => window.financeCalls.includes('/api/v1/reports/profit-loss')));
  assert.match(await page.$eval('.finance-period', node => node.textContent), /1\/12\/25.*24\/11\/26/);
  assert.equal(await page.$$('.finance-filters select').then(rows => rows.length), 3);
  const before = await page.$eval('.profit-loss-stats', node => node.innerText);
  await click('Tòa nhà A');
  await waitText('Chi phí chung 8.000.000');
  await page.$eval('nav[aria-label="Trang phòng"]', node => [...node.querySelectorAll('button')].at(-1).click());
  await waitText('A102');
  assert.equal(await page.$eval('.profit-loss-stats', node => node.innerText), before);
  await click('Bỏ chọn tòa nhà');
  await waitText('A101');
  await page.$eval('button[aria-label="Sắp xếp theo Tỷ suất lợi nhuận"]', node => node.click());
  await waitText('Tỷ suất lợi nhuận (giảm)');
  await page.$eval('button[aria-label="Sắp xếp theo Tỷ suất lợi nhuận"]', node => node.click());
  await waitText('Tỷ suất lợi nhuận (tăng)');
  await click('Xem giao dịch chưa xác định');
  await waitText('Mở sổ thu chi');
  await page.$eval('nav[aria-label="Trang giao dịch đối chiếu"]', node => [...node.querySelectorAll('button')].at(-1).click());
  await waitText('Trang 2 / 2');
  const reportUrl = page.url();
  await click('Mở sổ thu chi');
  await waitText('Hoàn cọc thực tế');
  assert.equal(new URL(page.url()).searchParams.get('entryId'), 'refund');
  await click('Quay lại báo cáo');
  await waitText('Mở sổ thu chi');
  assert.equal(page.url(), reportUrl);

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await open('?fromDate=2026-11-01&toDate=2026-12-01');
  await waitText('Xu hướng kinh doanh');
  assert.equal(await page.$eval('.profit-loss-page select[aria-invalid="true"]', () => true).catch(() => false), false);
  assert.equal(await page.$eval('.finance-inspection', node => node.textContent.includes('kết quả')), true);
  await page.select('.profit-loss-page select:has(option[value="2026-11-01"])', '2026-11-01');
  await click('Xem giao dịch trong kỳ');
  await waitText('Mở sổ thu chi');
  const detail = new URLSearchParams(new URL(page.url()).searchParams.get('detail'));
  assert.equal(detail.get('fromDate'), '2026-11-01');
  assert.equal(detail.get('toDate'), '2026-11-01');
  await open('?fromDate=2026-11-01&toDate=2026-12-02');
  await waitText('Kỳ chỉ bao gồm một phần của tháng');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await open('?roomId=00000000-0000-4000-8000-000000000093');
  await waitText('N/A – Không xác định');
  await waitText('Chênh lệch thu chi trực tiếp');
  await open('?areaId=foreign');
  await waitText('Khu vực ngoài phạm vi quản lý.');
  await open('?areaId=retry');
  await waitText('Không thể tải báo cáo doanh thu và lời lỗ');
  await click('Thử lại');
  await waitText('Kết quả kinh doanh tạm tính');
  assert.equal(await page.evaluate(() => window.financeCalls.filter(url => url.includes('areaId=retry')).length), 2);
  await open('?areaId=slow');
  await page.waitForFunction(() => window.financeCalls.some(url => url.includes('areaId=slow')));
  await click('Đặt lại');
  await waitText('108.000.000');
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(await page.evaluate(() => document.body.innerText.includes('88.888.888')), false);
  await open('?areaId=empty');
  await waitText('Chưa có dữ liệu doanh thu và chi phí');
  await open('', 'CUSTOMER');
  await page.waitForFunction(() => !document.querySelector('.profit-loss-page') && !document.body.innerText.includes('Đang tải'));
  assert.deepEqual(errors, []);
  console.log('PASS UC74 desktop/mobile, scope, pagination, sorting, exact UC56 return, date buckets, partial state, null margin and retry');
} finally {
  await browser.close();
}
