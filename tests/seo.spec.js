import { test, expect } from '@playwright/test';
import { players, videos, gallery } from '../src/data.js';
import { site } from '../src/site.js';

/**
 * SEO regression suite.
 *
 * The most important test here is the first one: it fetches the raw HTML over
 * HTTP and never executes JavaScript, which is exactly how a non-rendering
 * crawler sees the site. If content only appears after hydration, this fails.
 */

const ORIGIN = site.url;

/** Pulls the single JSON-LD block out of raw HTML. */
function extractJsonLd(html) {
  const open = '<script type="application/ld+json">';
  const blocks = [];
  let i = html.indexOf(open);
  while (i !== -1) {
    const start = i + open.length;
    const end = html.indexOf('</script>', start);
    blocks.push(html.slice(start, end));
    i = html.indexOf(open, end);
  }
  return blocks;
}

/** Reads width/height out of a JPEG without any image library. */
function jpegSize(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) break;
    const marker = buffer[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return null;
}

test.describe('crawlable HTML without JavaScript', () => {
  test('raw HTML exposes the full roster, films and archive', async ({ request }) => {
    const html = await (await request.get('/')).text();

    // Every operator, by in-game name — these were previously JS-only.
    for (const player of players) {
      expect(html, `${player.ign} missing from raw HTML`).toContain(player.ign);
      expect(html).toContain(`data-player="${player.id}"`);
    }

    // Every match film — three of four were previously JS-only.
    for (const video of videos) {
      expect(html, `${video.id} missing from raw HTML`).toContain(video.id);
      expect(html).toContain(video.title);
    }

    // Every archive image and its caption.
    for (const image of gallery) {
      expect(html).toContain(`/images/${image.src}.webp`);
      expect(html).toContain(image.title);
    }

    expect(html.match(/class="player-card"/g)).toHaveLength(players.length);
    expect(html.match(/class="playlist-item/g)).toHaveLength(videos.length);
    expect(html.match(/class="gallery-item/g)).toHaveLength(gallery.length);
  });

  test('no build markers or URL tokens leak into the output', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).not.toContain('%SITE_URL%');
    expect(html).not.toContain('<!--@prerender');
    expect(html).not.toContain('<!--@structured-data-->');
  });

  test('every image in the raw HTML declares alt text', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const tags = html.match(/<img\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      // An empty alt="" is correct for decorative images; a missing alt is not.
      expect(tag, `missing alt: ${tag.slice(0, 90)}`).toMatch(/\balt="/);
    }
  });

  test('every prerendered image path actually resolves', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const srcs = [...new Set([...html.matchAll(/<img[^>]+src="(\/images\/[^"]+)"/g)].map(m => m[1]))];
    expect(srcs.length).toBeGreaterThan(10);
    for (const src of srcs) {
      const res = await request.get(src);
      expect(res.ok(), `${src} returned ${res.status()}`).toBe(true);
    }
  });
});

test.describe('head metadata', () => {
  test('exactly one JSON-LD block, SportsTeam on top, rich entity graph', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const blocks = extractJsonLd(html);
    expect(blocks).toHaveLength(1);

    const data = JSON.parse(blocks[0]);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('SportsTeam');
    expect(data.url).toBe(ORIGIN);
    expect(data.athlete).toHaveLength(players.length);
    expect(data.sameAs.length).toBeGreaterThanOrEqual(3);

    const graph = data['@graph'];
    const types = graph.map(node => node['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('WebPage');
    expect(types).toContain('Organization');
    expect(types).toContain('FAQPage');
    expect(types).toContain('ImageGallery');
    expect(types.filter(t => t === 'Person')).toHaveLength(players.length);
    expect(types.filter(t => t === 'VideoObject')).toHaveLength(videos.length);

    // Bios travel as structured data rather than as hidden page text.
    for (const person of graph.filter(n => n['@type'] === 'Person')) {
      expect(person.description.length).toBeGreaterThan(40);
      expect(person.url).toContain(`${ORIGIN}/?player=`);
    }

    // Video nodes must point at real, absolute playback and thumbnail URLs.
    for (const video of graph.filter(n => n['@type'] === 'VideoObject')) {
      expect(video.thumbnailUrl.startsWith(ORIGIN)).toBe(true);
      expect(video.embedUrl).toContain('youtube-nocookie.com/embed/');
      expect(video.contentUrl).toContain('youtube.com/watch?v=');
    }
  });

  test('canonical, robots and Open Graph are absolute and agree', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`${ORIGIN}/`);

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('index');
    expect(robots).toContain('follow');
    expect(robots).toContain('max-image-preview:large');

    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe(canonical);

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBe(`${ORIGIN}/images/social-card.jpg`);
    expect(ogImage.startsWith('http')).toBe(true);

    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content');
    expect(twitterImage).toBe(ogImage);

    expect(await page.locator('meta[property="og:site_name"]').getAttribute('content')).toBe(site.name);
    expect(await page.locator('meta[property="og:locale"]').getAttribute('content')).toBe(site.locale);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image');
  });

  test('title and description sit inside SERP display limits', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    expect(title).toContain('TEAM HEX');
    expect(title).toContain('Free Fire');
    // ~60 characters is where Google truncates; leave headroom.
    expect(title.length).toBeGreaterThan(20);
    expect(title.length).toBeLessThanOrEqual(60);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);

    // Exactly one h1 keeps the heading outline unambiguous.
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('the Open Graph card is a real 1200x630 image', async ({ request }) => {
    const res = await request.get('/images/social-card.jpg');
    expect(res.ok()).toBe(true);
    const size = jpegSize(await res.body());
    expect(size).not.toBeNull();
    expect(size.width).toBe(1200);
    expect(size.height).toBe(630);
  });

  test('manifest description never drifts from the meta description', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.description).toBe(description);
    expect(manifest.lang).toBe('en');
    expect(manifest.start_url).toBe('/');
  });
});

test.describe('crawler infrastructure', () => {
  test('robots.txt allows crawling and advertises the sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('text/plain');

    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    // The counter API is not a page and must stay out of the index.
    expect(body).toContain('Disallow: /api/');
  });

  test('sitemap.xml is well formed and points at the canonical origin', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('xml');

    const body = await res.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');

    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    expect(locs).toContain(`${ORIGIN}/`);
    for (const loc of locs) expect(loc.startsWith('https://')).toBe(true);

    // lastmod must be a real ISO timestamp, not a placeholder.
    const lastmod = body.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    expect(lastmod).toBeTruthy();
    expect(Number.isNaN(Date.parse(lastmod))).toBe(false);
  });

  test('unknown URLs get a branded 404 that stays out of the index', async ({ request }) => {
    const res = await request.get('/404.html');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain('noindex');
    expect(body).toContain('TEAM HEX');
    // Must not leak the token that index.html relies on the plugin to replace.
    expect(body).not.toContain('%SITE_URL%');
  });
});
