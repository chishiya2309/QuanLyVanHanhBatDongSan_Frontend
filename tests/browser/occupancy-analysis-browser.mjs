import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(path => path && existsSync(path));
assert.ok(chrome, 'Set CHROME_PATH for the browser test');

const analysis = JSON.parse(readFileSync(new URL('../fixtures/occupancy-analysis.json', import.meta.url), 'utf8'));
const north = { id: 'north', name: 'Khu Bắc', active: true };
const buildings = analysis.byBuilding.map(building => ({ id: building.buildingId, name: building.buildingName, areaId: north.id, active: true }));
const reportPath = '/reports/occupancy-analysis';
const requests = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/v1/')) {
    let data;
    switch (url.pathname.slice('/api/v1'.length)) {
      case '/auth/me':
        data = { accountId: 'host-account', loginName: 'Chủ nhà', role: 'HOST', hostId: 'host' };
        break;
      case '/areas': data = [north]; break;
      case '/buildings': data = buildings; break;
      case '/reports/occupancy':
        requests.push(url.searchParams);
        data = { occupancyAnalysis: analysis };
        break;
    }
    const status = data === undefined ? 404 : 200;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status, data, message: 'Browser test fixture' }));
    return;
  }
  const asset = /^\/assets\/[\w.-]+\.(js|css)$/.exec(url.pathname);
  const type = asset?.[1] === 'js' ? 'text/javascript' : asset ? 'text/css' : 'text/html';
  try {
    const content = readFileSync(join('dist', asset ? url.pathname.slice(1) : 'index.html'));
    response.writeHead(200, { 'Content-Type': type });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const output = process.env.UC71_RENDER_DIR;
if (output) mkdirSync(output, { recursive: true });

let browser;
try {
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true });
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  for (const width of [390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(base + reportPath, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.oa-point');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow at ' + width);
    if (width === 390) {
      assert.ok(await page.$eval('.oa-comparison .oa-scroll', element => element.scrollWidth > element.clientWidth));
      assert.ok(await page.$eval('.oa-ranking', region => {
        const name = region.querySelector('tbody th');
        region.scrollLeft = 180;
        const position = name.getBoundingClientRect().left;
        region.scrollLeft = 280;
        const pinned = region.scrollLeft > 180 && Math.abs(name.getBoundingClientRect().left - position) < 1;
        region.scrollLeft = 0;
        return pinned;
      }), 'Building link must stay visible as ranking columns scroll');
    }
    assert.equal((await page.$$('[data-series-segment]')).length, 1);
    if (output) await page.screenshot({ path: join(output, 'uc71-' + width + '.png'), fullPage: true });
    console.log('PASS UC71 responsive layout at ' + width + 'px');
  }

  await page.select('.oa-filter select', north.id);
  await page.waitForFunction(() => location.search.includes('areaId=north') && document.querySelector('.oa-point'));
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => !location.search && document.querySelector('.oa-point'));
  await page.evaluate(() => history.forward());
  await page.waitForFunction(() => location.search.includes('areaId=north') && document.querySelector('.oa-point'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.oa-point');
  assert.equal(requests.at(-1).get('areaId'), north.id);
  assert.equal(await page.$eval('.oa-filter select', select => select.value), north.id);

  const before = requests.length;
  await page.click('.oa-header button');
  await page.waitForSelector('.oa-point');
  assert.ok(requests.length > before);
  const firstBuilding = '.oa-bars a';
  await page.focus(firstBuilding);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.pathname === '/rooms' && location.search.includes('buildingId=b2'));
  await page.evaluate(() => history.back());
  await page.waitForSelector('.occupancy-analysis tbody a');
  await page.click('.occupancy-analysis tbody a');
  await page.waitForFunction(() => location.pathname === '/rooms' && location.search.includes('buildingId=b2'));
  assert.deepEqual(failures, []);
  console.log('PASS UC71 deep link, reload, history, refresh and room links');

  if (process.argv.includes('--hallmark')) {
    const skill = process.env.HALLMARK_DIR || join(homedir(), '.agents', 'skills', 'hallmark');
    const result = await new Promise((resolve, reject) => {
      const lint = spawn(process.execPath, [join(skill, 'scripts', 'sloplint.mjs'),
        'src/components/reports/OccupancyAnalysisPage.tsx', 'src/components/reports/occupancy-analysis.css',
        '--scope', 'app', '--render', '--url', base + reportPath],
      { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chrome, HALLMARK_PUPPETEER: process.cwd() } });
      lint.once('error', reject);
      lint.once('exit', resolve);
    });
    process.exitCode = result ?? 1;
  }
} finally {
  await browser?.close();
  server.close();
}
