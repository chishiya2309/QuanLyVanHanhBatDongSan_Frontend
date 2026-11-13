import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.SPLASH_PREVIEW_URL || 'http://127.0.0.1:5173';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((path) => path && existsSync(path));
assert.ok(executablePath, 'Set CHROME_PATH to Chrome or Edge');
const output = resolve('.hallmark/shots/session-splash');
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [], checks = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  for (const [width, height] of [[320, 667], [375, 812], [640, 800], [768, 1024], [1024, 768], [1280, 800], [1366, 604], [1920, 1080]]) {
    await page.setViewport({ width, height });
    await page.goto(base + '/tests/fixtures/session-splash-preview.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.session-splash-icon');
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const brand = document.querySelector('.session-splash-brand').getBoundingClientRect();
      const icon = document.querySelector('.session-splash-icon').getBoundingClientRect();
      const wordmark = document.querySelector('.session-splash-wordmark').getBoundingClientRect();
      const status = document.querySelector('[role="status"]');
      const statusBox = status.getBoundingClientRect();
      return {
        x: brand.x + brand.width / 2, y: brand.y + brand.height / 2,
        iconWidth: icon.width, iconHeight: icon.height, gap: wordmark.top - icon.bottom,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        verticalOverflow: document.documentElement.scrollHeight > innerHeight,
        statusText: status.textContent, statusWidth: statusBox.width, statusHeight: statusBox.height,
        statusClip: getComputedStyle(status).clipPath,
        animation: getComputedStyle(document.querySelector('.session-splash-icon')).animationName,
      };
    });
    assert.ok(Math.abs(geometry.x - width / 2) < 1, 'Horizontal centering');
    assert.ok(Math.abs(geometry.y - height / 2) < 1, 'Vertical centering');
    assert.equal(geometry.iconWidth, width <= 640 ? 104 : 128);
    assert.equal(geometry.iconHeight, geometry.iconWidth);
    assert.equal(geometry.gap, 16);
    assert.equal(geometry.horizontalOverflow, false);
    assert.equal(geometry.verticalOverflow, false);
    assert.equal(geometry.statusText, 'Đang kiểm tra phiên đăng nhập');
    assert.equal(geometry.statusWidth, 1);
    assert.equal(geometry.statusHeight, 1);
    assert.equal(geometry.statusClip, 'inset(50%)');
    assert.equal(geometry.animation, 'none');
    await page.screenshot({ path: resolve(output, `${width}x${height}.png`) });
    checks.push({ width, height, ...geometry });
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.$eval('.session-splash-icon', (icon) => getComputedStyle(icon).animationName), 'none');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(`PASS ${checks.length} viewport checks, accessible status, reduced motion and no page errors`);
} finally {
  await browser.close();
}
