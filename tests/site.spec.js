import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(5, 7, 12)');
});

test('roster filters, complete profiles, and keyboard dismissal', async ({ page }) => {
  await expect(page.locator('.player-card')).toHaveCount(6);
  await page.locator('[data-filter="support"]').click();
  await expect(page.locator('.player-card')).toHaveCount(2);
  await page.locator('[data-filter="assault"]').click();
  await expect(page.locator('.player-card')).toHaveCount(3);
  await page.locator('[data-filter="precision"]').click();
  await expect(page.locator('.player-card')).toHaveCount(1);
  await page.locator('.player-card').click();
  await expect(page.locator('#player-dialog-name')).toHaveText('MUHIT');
  await page.locator('[data-player-direction="1"]').click();
  await expect(page.locator('#player-dialog-name')).toHaveText('TASIR');
  await page.keyboard.press('Escape');
  await expect(page.locator('#player-dialog')).not.toBeVisible();
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('.player-card')).toHaveCount(6);
});

test('match selection, accessible tabs, and video cleanup', async ({ page }) => {
  await page.locator('[data-select-video="t4qYxypiWiQ"]').click();
  await expect(page.locator('#feature-video')).toHaveAttribute('data-video', 't4qYxypiWiQ');
  await page.locator('#feature-video').click();
  await expect(page.locator('#video-frame iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/t4qYxypiWiQ/);
  await expect(page.locator('#video-external')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=t4qYxypiWiQ');
  await page.keyboard.press('Escape');
  await expect(page.locator('#video-frame iframe')).toHaveCount(0);
  await page.locator('#films-tab').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#gallery-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#gallery-panel')).toBeVisible();
  await expect(page.locator('.gallery-item')).toHaveCount(8);
});

test('gallery navigation, zoom, pan, and reset', async ({ page }) => {
  await page.locator('#gallery-tab').click();
  await page.locator('[data-gallery="0"]').click();
  await expect(page.locator('#lightbox-caption')).toContainText('Squad Formation');
  await page.locator('#zoom-in').click();
  await expect(page.locator('#zoom-level')).toHaveText('125%');
  const rect = await page.locator('#lightbox-stage').boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 20, rect.y + rect.height / 2 + 10);
  await page.mouse.up();
  await expect(page.locator('#lightbox-image')).toHaveAttribute('style', /translate\(20px, 10px\)/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lightbox-caption')).toContainText('Operator Profile');
  await expect(page.locator('#zoom-level')).toHaveText('100%');
  await page.locator('#zoom-in').click();
  await page.locator('#zoom-reset').click();
  await expect(page.locator('#zoom-level')).toHaveText('100%');
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery-dialog')).not.toBeVisible();
});

test('recruitment preserves strict original thresholds and real links', async ({ page }) => {
  await page.locator('#join-name').fill('Test Operator');
  await page.locator('#join-uid').fill('123456789');
  await page.locator('#join-level').fill('46');
  await page.locator('#join-years').fill('3');
  await page.locator('#join-form button[type="submit"]').click();
  await expect(page.locator('#join-result')).toContainText('YOU MEET THE REQUIREMENTS');
  await expect(page.locator('#join-result a')).toHaveAttribute('href', /clan_id=3062659192/);
  for (const [level, years] of [['45', '3'], ['46', '2']]) {
    await page.locator('#join-level').fill(level);
    await page.locator('#join-years').fill(years);
    await page.locator('#join-form button[type="submit"]').click();
    await expect(page.locator('#join-result')).toContainText('KEEP BUILDING');
    await expect(page.locator('#join-result a')).toHaveAttribute('href', 'https://chat.whatsapp.com/D52wjmfS7jS84aGA6bVN0v');
  }
  await expect(page.locator('#join-result')).toContainText('No application has been sent or stored');
});

test('contact creates a real draft without claiming to send it', async ({ page }) => {
  await page.evaluate(() => { window.__draft = null; window.open = url => { window.__draft = url; return null; }; });
  await page.locator('#contact-name').fill('Test Visitor');
  await page.locator('#contact-email').fill('visitor@example.com');
  await page.locator('#contact-subject').fill('Scrim request');
  await page.locator('#contact-message').fill('We would like to arrange a friendly scrim with TEAM HEX.');
  await page.locator('#contact-form button[type="submit"]').click();
  await expect(page.locator('#contact-result')).toBeVisible();
  await expect(page.locator('#contact-result')).toContainText('Your message has not been sent yet');
  const draft = await page.evaluate(() => window.__draft);
  expect(draft).toContain('to=teamhexboys%40gmail.com');
  expect(decodeURIComponent(draft)).toContain('visitor@example.com');
  await expect(page.locator('#mailto-draft-link')).toHaveAttribute('href', /^mailto:teamhexboys@gmail.com\?/);
});

test('mobile navigation and layouts from 320px to 1440px', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#menu-toggle').click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.locator('#mobile-menu a[href="#squad"]').click();
  await expect(page.locator('#mobile-menu')).not.toBeVisible();
  await expect(page).toHaveURL(/#squad$/);
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('motion preference is respected and the control persists', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.locator('.header-actions [data-motion-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  await page.locator('.header-actions [data-motion-toggle]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('#loader')).not.toBeVisible();
});

test('automated WCAG A/AA checks on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});
