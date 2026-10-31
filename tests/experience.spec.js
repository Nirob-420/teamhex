import { test, expect } from '@playwright/test';
import { createVisitorHandler } from '../netlify/functions/visits.mjs';

test('one WebGL context moves between hero, emblem, and scroll tunnel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#loader')).not.toBeVisible({ timeout: 10000 });
  await expect(page.locator('.hex-webgl-canvas')).toHaveCount(1);
  await expect(page.locator('.hero-art .hex-webgl-canvas')).toHaveCount(1);
  await page.evaluate(() => { const el = document.querySelector('#about'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100); });
  await expect(page.locator('.wolf-stage .hex-webgl-canvas')).toHaveCount(1);
  await expect(page.locator('.wolf-stage')).toHaveClass(/webgl-ready/);
  const canvas = page.locator('.hex-webgl-canvas');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => { const el = document.querySelector('#protocol'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 100); });
  await expect(page.locator('.protocol-stage .hex-webgl-canvas')).toHaveCount(1);
  await expect(page.locator('.hex-webgl-canvas')).toHaveCount(1);
});

test('pinned protocol advances through all three stages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#loader')).not.toBeVisible({ timeout: 10000 });
  const start = await page.evaluate(() => document.querySelector('#protocol').getBoundingClientRect().top + scrollY);
  await page.evaluate(y => window.scrollTo(0, y), start + 1050);
  await expect(page.locator('[data-protocol-step="1"]')).toHaveCSS('visibility', 'visible');
  await page.evaluate(y => window.scrollTo(0, y), start + 1850);
  await expect(page.locator('[data-protocol-step="2"]')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('[data-protocol-step="0"]')).toHaveCSS('visibility', 'hidden');
});

test('live counter animates a real API value and counts a session only once', async ({ page }) => {
  let posts = 0, gets = 0;
  await page.route('**/api/visits**', async route => {
    if (route.request().method() === 'POST') posts++; else gets++;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'X-Visitor-API': 'hex-v2', 'Cache-Control': 'no-store' }, body: JSON.stringify({ count: 128, mode: 'live' }) });
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#visitor-counter')).toHaveAttribute('data-mode', 'live');
  await expect(page.locator('#visitor-digits')).toHaveAttribute('data-count', '128');
  await expect(page.locator('#visitor-label')).toHaveText('TOTAL SITE VISITS');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#visitor-digits')).toHaveAttribute('data-count', '128');
  expect(posts).toBe(1); expect(gets).toBe(1);
});

test('static hosting fallback is explicitly labeled device-only', async ({ page }) => {
  await page.route('**/api/visits**', route => route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#visitor-counter')).toHaveAttribute('data-mode', 'device');
  await expect(page.locator('#visitor-label')).toHaveText('VISITS ON THIS DEVICE');
  await expect(page.locator('#visitor-note')).toContainText('only on your device');
  await expect(page.locator('#visitor-digits')).toHaveAttribute('data-count', '1');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#visitor-digits')).toHaveAttribute('data-count', '1');
});

test('Netlify counter handles concurrent visits without losing increments', async () => {
  let data = null, etag = null, version = 0, writes = 0;
  const store = {
    async get() { return data; },
    async getWithMetadata() { return data ? { data, etag } : { data: null, etag: null }; },
    async setJSON(key, value, condition) {
      writes++;
      if (condition.onlyIfNew && data) return { modified: false };
      if (condition.onlyIfMatch && condition.onlyIfMatch !== etag) return { modified: false };
      data = value; etag = `v${++version}`; return { modified: true, etag };
    },
  };
  const handler = createVisitorHandler(store);
  const request = () => new Request('https://teamhex.example/api/visits', { method: 'POST' });
  const responses = await Promise.all(Array.from({ length: 20 }, () => handler(request())));
  expect(responses.every(response => response.status === 200)).toBe(true);
  expect(data.count).toBe(20);
  expect(writes).toBeGreaterThanOrEqual(20);
  const read = await handler(new Request('https://teamhex.example/api/visits'));
  expect(await read.json()).toEqual({ count: 20, mode: 'live' });
  expect(data.count).toBe(20);
});

test('horizontal squad rail supports buttons, drag-friendly scrolling, and filter reset', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const rail = page.locator('#roster-grid');
  await expect(page.locator('.player-card')).toHaveCount(6);
  await expect(page.locator('#roster-prev')).toBeDisabled();
  await page.locator('#roster-next').click();
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  await page.locator('#roster-prev').click();
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeLessThan(10);
  await page.locator('#roster-next').click();
  await page.locator('[data-filter="support"]').click();
  await expect(page.locator('.player-card')).toHaveCount(2);
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBe(0);
});

test('gallery rail includes every original archive image and brand assets', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('#gallery-tab').click();
  const rail = page.locator('#gallery-grid');
  await expect(page.locator('.gallery-item')).toHaveCount(8);
  await expect(page.locator('#gallery-rail-prev')).toBeDisabled();
  await page.locator('#gallery-rail-next').click();
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  await rail.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
  const brand = page.locator('.gallery-item.is-brand img');
  await expect(brand).toHaveCount(2);
  for (const img of await brand.all()) await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.locator('[data-gallery="7"]').click();
  await expect(page.locator('#lightbox-caption')).toContainText('08 / 08');
  await expect(page.locator('#lightbox-caption')).toContainText('TEAM HEX Legacy Banner');
});

test('squad section turns vertical scroll into a pinned horizontal roster sequence', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#loader')).not.toBeVisible({ timeout: 10000 });
  await expect(page.locator('#squad')).toHaveClass(/has-scroll-sequence/);
  const rail = page.locator('#roster-grid');
  const { start, max } = await page.evaluate(() => {
    const section = document.querySelector('#squad');
    const rail = document.querySelector('#roster-grid');
    return { start: section.getBoundingClientRect().top + scrollY, max: rail.scrollWidth - rail.clientWidth };
  });
  expect(max).toBeGreaterThan(300);
  await page.evaluate(y => window.scrollTo(0, y), start + max * .6);
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(max * .3);
  await expect(page.locator('#squad-active')).not.toHaveText(/^01 /);
  await page.locator('.header-actions [data-motion-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('#squad')).not.toHaveClass(/has-scroll-sequence/);
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBe(0);
});
