import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const root = process.env.FINANCE_PREVIEW_URL || 'http://127.0.0.1:5179';
const previewUrl = root + '/tests/fixtures/finance-preview.html';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && existsSync(file));
const browser = await puppeteer.launch({ executablePath, headless: true });
const preview = await (await fetch(previewUrl)).text();
const page = await browser.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', request => {
  const url = new URL(request.url());
  if (request.isNavigationRequest() && url.origin === root && ['/reports/finance', '/cash-ledger'].includes(url.pathname)) {
    void request.respond({ status: 200, contentType: 'text/html', body: preview });
  } else void request.continue();
});
const waitText = text => page.waitForFunction(text => document.querySelector('.finance-page')?.innerText.includes(text), {}, text);
const goto = async (route, role) => {
  await page.goto(previewUrl + '?' + new URLSearchParams({ route, role: role ?? 'HOST' }));
};
try {
  await page.setViewport({ width: 1440, height: 900 });
  await goto('/reports/finance');
  await waitText('Xu hướng dòng tiền');
  assert.ok(await page.evaluate(() => window.financeCalls.includes('/api/v1/reports/finance')));
  assert.match(await page.$eval('.dash-sidebar [aria-current=page]', link => link.textContent), /Thu chi & Dòng tiền/);
  assert.match(await page.$eval('.finance-period', element => element.textContent), /1\/12\/(20)?25.*30\/11\/(20)?26/);
  await page.click('.finance-trend-data summary');
  await page.focus('.finance-trend-data a');
  await page.keyboard.press('Enter');
  await waitText('Hoàn cọc thực tế');
  const query = new URL(page.url()).searchParams;
  assert.equal(query.get('fromDate'), '2026-11-01');
  assert.equal(query.get('toDate'), '2026-11-30');
  await page.click('.finance-trace summary');
  await waitText('QTOAN-01');
  const contributions = () => page.$$eval('.finance-trace dl', rows => rows.map(row => {
    const value = row.lastElementChild.textContent;
    return { direction: value.startsWith('Thu') ? 'in' : 'out', amount: Number(value.replace(/[^-\d]/g, '')) };
  }));
  const firstPage = await contributions();
  await page.evaluate(() => [...document.querySelectorAll('.finance-pagination button')].find(button => button.textContent === 'Trang sau').click());
  await waitText('Điều chỉnh hoàn cọc');
  await page.click('.finance-trace summary');
  await waitText('-20');
  const total = [...firstPage, ...await contributions()].reduce((sum, value) => {
    sum[value.direction] += value.amount;
    return sum;
  }, { in: 0, out: 0 });
  assert.deepEqual(total, { in: 200, out: 55 });
  await page.reload();
  await waitText('Điều chỉnh hoàn cọc');
  await page.click('.finance-heading a');
  await waitText('Xu hướng dòng tiền');
  assert.equal(new URL(page.url()).search, '');
  console.log('PASS desktop, keyboard drill-down, pagination, correction trace and refresh');

  await goto('/reports/finance?fromDate=2026-11-01&toDate=2026-12-01&transactionCategory=RENT&transactionCategory=SERVICE');
  await waitText('Dữ liệu theo ngày');
  await page.evaluate(() => {
    const input = document.querySelectorAll('.finance-filters input[type=date]')[1];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2026-12-02');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('.finance-primary');
  await waitText('Dữ liệu theo tháng');
  assert.deepEqual(new URL(page.url()).searchParams.getAll('transactionCategory'), ['RENT', 'SERVICE']);
  await page.goBack();
  await waitText('Dữ liệu theo ngày');
  await page.goForward();
  await waitText('Dữ liệu theo tháng');
  console.log('PASS 31/32 days, repeated filters, Back/Forward');

  const option = suffix => '00000000-0000-4000-8000-0000000000' + suffix;
  await page.waitForSelector('.finance-filter-grid select option[value="' + option(91) + '"]');
  const selects = await page.$$('.finance-filter-grid select');
  await selects[0].select(option(91));
  await selects[1].select(option(92));
  await page.waitForSelector('.finance-filter-grid select option[value="' + option(93) + '"]');
  await selects[2].select(option(93));
  await selects[3].select(option(94));
  await page.click('.finance-primary');
  await waitText('Nguồn tiền');
  const scoped = new URL(page.url()).searchParams;
  assert.equal(scoped.get('roomId'), option(93));
  assert.equal(scoped.get('sourceId'), option(94));
  await waitText('Xu hướng dòng tiền');
  await page.evaluate(() => [...document.querySelectorAll('.finance-table-scroll a')].find(link => link.textContent === 'Dòng tiền đặt cọc').click());
  await waitText('Hoàn cọc thực tế');
  const grouped = new URL(page.url()).searchParams;
  assert.equal(grouped.get('composition'), null);
  assert.equal(grouped.get('dimension'), 'composition');
  assert.equal(grouped.get('groupKey'), 'DEPOSIT');
  assert.equal(grouped.get('roomId'), option(93));
  assert.equal(grouped.get('sourceId'), option(94));
  console.log('PASS cascading property filters and source in a grouped drill-down');

  await goto('/reports/finance?sourceId=retry');
  await waitText('Không thể tải báo cáo thu chi');
  await page.click('.finance-error button');
  await waitText('Xu hướng dòng tiền');
  await goto('/reports/finance?sourceId=foreign');
  await waitText('Nguồn tiền ngoài phạm vi quản lý.');
  assert.equal(await page.$('.finance-stats'), null);
  await goto('/reports/finance?fromDate=2026-11-31');
  await waitText('Khoảng thời gian trong bộ lọc không hợp lệ.');
  assert.equal(await page.evaluate(() => window.financeCalls.length), 0);
  await goto('/reports/finance?sourceId=slow');
  await waitText('Đang tải báo cáo');
  await page.waitForFunction(() => window.financeCalls.some(url => url.includes('sourceId=slow')));
  await page.evaluate(() => document.querySelector('.finance-toolbar button[type=button]').click());
  await waitText('Xu hướng dòng tiền');
  await new Promise(resolve => setTimeout(resolve, 1300));
  assert.doesNotMatch(await page.$eval('.finance-stats', element => element.innerText), /88[. ]888/);
  console.log('PASS retry, denied scope, invalid dates and stale request');

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await goto('/reports/finance?sourceId=empty');
  await waitText('Chưa có giao dịch thu chi');
  assert.equal(await page.$('.finance-graph svg'), null);
  assert.equal(await page.$$eval('.finance-stats dd', items => items.filter(item => item.textContent.trim().startsWith('0')).length), 3);
  await goto('/reports/finance');
  await waitText('Xu hướng dòng tiền');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => [...document.querySelectorAll('.finance-table-scroll a')].find(link => link.textContent === 'Chưa phân bổ').click());
  await waitText('Sổ thu chi');
  assert.equal(new URL(page.url()).searchParams.get('groupKey'), '~');
  await waitText('Hoàn cọc thực tế');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log('PASS mobile, empty state and unassigned group drill-down');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}

