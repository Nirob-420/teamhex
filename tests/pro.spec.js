import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('command menu searches the whole site and stays accessible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Control+k');
  const dialog = page.locator('#command-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#command-input')).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.locator('#command-input').fill('rian');
  await expect(page.locator('#command-count')).toHaveText('1 result');
  await page.keyboard.press('Enter');
  await expect(page.locator('#player-dialog-name')).toHaveText('RIAN');
  await expect(dialog).not.toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.command-group').first()).toHaveText('RECENT');
});

test('saved operators persist on the device and drive the saved filter', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('[data-filter="saved"]').click();
  await expect(page.locator('.roster-empty')).toBeVisible();
  await page.locator('[data-filter="all"]').click();
  await page.locator('.player-card[data-player="nirob"]').click();
  await page.locator('[data-save-player="nirob"]').click();
  await expect(page.locator('[data-save-player="nirob"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.toast')).toContainText('NIROB saved on this device');
  await page.keyboard.press('Escape');
  await expect(page.locator('#saved-count')).toHaveText('01');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#saved-count')).toHaveText('01');
  await page.locator('[data-filter="saved"]').click();
  await expect(page.locator('.player-card')).toHaveCount(1);
  await expect(page.locator('.card-saved')).toBeVisible();
  await page.locator('.player-card[data-player="nirob"]').click();
  await page.locator('[data-save-player="nirob"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.player-card')).toHaveCount(0);
  await expect(page.locator('#saved-count')).toHaveText('00');
});

test('contact drafts are restored locally and can be discarded', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('#contact-name').fill('Draft Operator');
  await page.locator('#contact-message').fill('Saving this draft on my device only.');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hex-draft-contact'))).toContain('Draft Operator');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#contact-name')).toHaveValue('Draft Operator');
  await expect(page.locator('#contact-draft')).toBeVisible();
  await expect(page.locator('#contact-draft')).toContainText('NOTHING WAS SENT');
  await page.locator('[data-discard-draft="contact"]').click();
  await expect(page.locator('#contact-name')).toHaveValue('');
  await expect(page.locator('#contact-draft')).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hex-draft-contact'))).toBeNull();
});

test('archive slideshow advances and every image can be downloaded', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('#gallery-tab').click();
  await page.locator('[data-gallery="0"]').click();
  await expect(page.locator('#lightbox-download')).toHaveAttribute('href', '/images/claw.webp');
  await expect(page.locator('#lightbox-download')).toHaveAttribute('download', 'team-hex-claw.webp');
  await page.locator('#slideshow-toggle').click();
  await expect(page.locator('#slideshow-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lightbox-caption')).toContainText('02 / 08', { timeout: 6000 });
  await page.locator('#slideshow-toggle').click();
  await expect(page.locator('#slideshow-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('#slideshow-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('keyboard shortcuts panel documents the real controls', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('?');
  await expect(page.locator('#shortcuts-dialog')).toBeVisible();
  await expect(page.locator('.shortcuts-grid > div')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.keyboard.press('f');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  await page.keyboard.press('f');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
});

test('installable app metadata and icons are served correctly', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toContain('TEAM HEX');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const structured = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(structured)['@type']).toBe('SportsTeam');
});
