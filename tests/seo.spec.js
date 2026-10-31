import { test, expect } from '@playwright/test';
import { players, videos, gallery } from '../src/data.js';
import { site } from '../src/site.js';
import { routes } from '../src/routes.js';

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

    // Homepage plus every section that has its own prerendered page.
    expect(locs).toHaveLength(routes.length + 1);
    for (const route of routes) expect(locs).toContain(`${ORIGIN}${route.path}`);

    // /join and /contact are redirects to homepage anchors. A redirect must
    // never appear in a sitemap.
    expect(locs.some(loc => loc.endsWith('/join'))).toBe(false);
    expect(locs.some(loc => loc.endsWith('/contact'))).toBe(false);

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

/** Decodes the handful of entities the generator escapes in text nodes. */
const decodeEntities = value =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const metaContent = (html, pattern) => html.match(pattern)?.[1];
const titleOf = html => decodeEntities(metaContent(html, /<title>([\s\S]*?)<\/title>/) ?? '');
const jsonLdOf = html => JSON.parse(extractJsonLd(html)[0]);

/** Sections expected to be prerendered on a given route. */
const PRERENDER_COUNTS = {
  squad: { cards: players.length, films: 0, gallery: 0 },
  about: { cards: 0, films: 0, gallery: 0 },
  protocol: { cards: 0, films: 0, gallery: 0 },
  highlights: { cards: 0, films: videos.length, gallery: gallery.length },
};

test.describe('section route pages', () => {
  for (const route of routes) {
    test.describe(route.path, () => {
      test('serves unique, self-referencing metadata', async ({ request }) => {
        const res = await request.get(route.path);
        expect(res.ok(), `${route.path} returned ${res.status()}`).toBe(true);
        const html = await res.text();

        expect(titleOf(html)).toBe(route.title);
        // Titles must stay inside the ~60 character SERP window.
        expect(route.title.length).toBeLessThanOrEqual(60);

        const description = metaContent(html, /name="description" content="([^"]+)"/);
        expect(decodeEntities(description)).toBe(route.description);
        expect(route.description.length).toBeGreaterThanOrEqual(120);
        expect(route.description.length).toBeLessThanOrEqual(160);

        expect(metaContent(html, /rel="canonical" href="([^"]+)"/)).toBe(`${ORIGIN}${route.path}`);
        expect(metaContent(html, /property="og:url" content="([^"]+)"/)).toBe(`${ORIGIN}${route.path}`);
        expect(metaContent(html, /name="robots" content="([^"]+)"/)).toContain('index, follow');

        // Social images must be absolute or no preview is generated.
        expect(metaContent(html, /property="og:image" content="([^"]+)"/)).toBe(`${ORIGIN}/images/social-card.jpg`);
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
        // og:title is read by scrapers that do not decode entities.
        expect(metaContent(html, /property="og:title" content="([^"]+)"/)).not.toContain('&amp;');

        expect(html).toContain(`data-route="${route.id}"`);
      });

      test('contains only its own section — no duplicated content', async ({ request }) => {
        const html = await (await request.get(route.path)).text();

        expect(html).toMatch(new RegExp(`<section\\b[^>]*\\bid="${route.id}"`));
        for (const other of routes) {
          if (other.id === route.id) continue;
          expect(html, `${other.id} leaked into ${route.path}`).not.toMatch(
            new RegExp(`<section\\b[^>]*\\bid="${other.id}"`)
          );
        }
        // The homepage-only sections must not appear either.
        expect(html).not.toMatch(/<section\b[^>]*\bid="home"/);
        expect(html).not.toMatch(/<section\b[^>]*\bid="join"/);
        expect(html).not.toMatch(/<section\b[^>]*\bid="contact"/);
      });

      test('keeps the shared header, footer, breadcrumb and pager', async ({ request }) => {
        const html = await (await request.get(route.path)).text();

        expect(html).toContain('<header');
        expect(html).toContain('<footer');
        expect(html).toContain('class="route-breadcrumb"');
        expect(html).toContain('aria-label="Breadcrumb"');
        expect(html).toContain('class="route-pager"');
        // Chrome the header depends on.
        expect(html).toContain('id="mobile-menu"');
        expect(html).toContain('id="command-dialog"');
        expect(html).toContain('id="toast-region"');
        expect(html).toContain('id="main"');
        expect(html).toContain('class="skip-link"');
      });

      test('declares WebPage + BreadcrumbList and defines the team entity', async ({ request }) => {
        const html = await (await request.get(route.path)).text();
        const blocks = extractJsonLd(html);
        expect(blocks).toHaveLength(1);

        const data = jsonLdOf(html);
        expect(data['@type']).toBe('WebPage');
        expect(data.url).toBe(`${ORIGIN}${route.path}`);
        expect(data.inLanguage).toBe(site.language);

        const graph = data['@graph'];
        const types = graph.map(node => node['@type']);
        expect(types).toContain('BreadcrumbList');
        expect(types).toContain('Organization');
        expect(types).toContain('WebSite');
        // `about` points at the team, so the team must actually be defined here.
        expect(types).toContain('SportsTeam');
        expect(data.about['@id']).toBe(`${ORIGIN}/#team`);

        const crumb = graph.find(node => node['@type'] === 'BreadcrumbList');
        expect(crumb.itemListElement).toHaveLength(2);
        expect(crumb.itemListElement[0].item).toBe(`${ORIGIN}/`);
        expect(crumb.itemListElement[1].item).toBe(`${ORIGIN}${route.path}`);
        expect(crumb.itemListElement.map(item => item.position)).toEqual([1, 2]);
      });

      test('prerenders its own content and stays off the heavy homepage bundle', async ({ request }) => {
        const html = await (await request.get(route.path)).text();
        const expected = PRERENDER_COUNTS[route.id];

        expect(html.match(/class="player-card"/g) ?? []).toHaveLength(expected.cards);
        expect(html.match(/class="playlist-item/g) ?? []).toHaveLength(expected.films);
        expect(html.match(/class="gallery-item/g) ?? []).toHaveLength(expected.gallery);

        // Route pages use the lightweight entry; loading main.js here would
        // throw on the sections that are deliberately absent. Both the dev path
        // (/src/page.js) and the built path (/assets/page-*.js) are accepted so
        // the suite can run against either server.
        const usesPageEntry =
          html.includes('/src/page.js') || /\/assets\/page-[\w-]+\.js/.test(html);
        expect(usesPageEntry, 'route page should load the lightweight page entry').toBe(true);

        const loadsHomepageEntry =
          html.includes('/src/main.js') || /\/assets\/index-[\w-]+\.js/.test(html);
        expect(loadsHomepageEntry, 'route page must not load the homepage entry').toBe(false);

        // three.js is by far the heaviest chunk and is homepage-only. Match the
        // asset path, not the bare word — "three-stage" appears in real copy.
        expect(/\/assets\/three-[\w-]+\.js/.test(html)).toBe(false);

        if (route.id === 'squad') {
          for (const player of players) expect(html).toContain(player.ign);
          const types = jsonLdOf(html)['@graph'].map(node => node['@type']);
          expect(types.filter(t => t === 'Person')).toHaveLength(players.length);
        }
        if (route.id === 'highlights') {
          for (const video of videos) expect(html).toContain(video.id);
          const types = jsonLdOf(html)['@graph'].map(node => node['@type']);
          expect(types.filter(t => t === 'VideoObject')).toHaveLength(videos.length);
          expect(types).toContain('ImageGallery');
        }
      });

      test('has alt text on every image and no build artefacts', async ({ request }) => {
        const html = await (await request.get(route.path)).text();

        for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
          expect(tag, `missing alt: ${tag.slice(0, 90)}`).toMatch(/\balt="/);
        }
        expect(html).not.toContain('%SITE_URL%');
        expect(html).not.toContain('<!--@route');
        expect(html).not.toContain('<!--@prerender');
      });
    });
  }

  test('form-bearing sections redirect to the homepage anchor', async ({ request }) => {
    for (const path of ['/join', '/contact']) {
      const res = await request.get(path, { maxRedirects: 0 });
      // 302, not 301: these are the most likely sections to become real pages.
      expect(res.status(), `${path} should redirect`).toBe(302);
      expect(res.headers().location).toBe(`/#${path.slice(1)}`);
    }
  });

  test('homepage links to the route pages with real crawlable URLs', async ({ request }) => {
    const html = await (await request.get('/')).text();
    for (const route of routes) {
      expect(html, `no internal link to ${route.path}`).toContain(`href="${route.path}"`);
    }
    // Hash links to sections would not be followed as separate URLs.
    for (const route of routes) {
      expect(html).not.toContain(`href="#${route.id}"`);
    }
    // The skip link is an in-page anchor and must stay one.
    expect(html).toContain('href="#main"');
  });
});
