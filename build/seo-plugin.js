/**
 * TEAM HEX SEO plugin for Vite.
 *
 * A single-page site is only as crawlable as its raw HTML, so this plugin does
 * three things at build time *and* in the dev/preview servers:
 *
 *   1. Prerenders the squad rail, match-film watchlist and archive gallery into
 *      their empty containers, using the exact same templates `src/main.js`
 *      hydrates with. Crawlers that never run JavaScript — and the first pass
 *      of crawlers that do — see every player, film and image.
 *   2. Injects one JSON-LD block generated from `src/data.js` and `src/site.js`.
 *   3. Emits `robots.txt` and `sitemap.xml` built from the same site config, so
 *      the canonical origin can never disagree between the two.
 *
 * `lastmod` comes from the newest git commit rather than the clock, which keeps
 * builds reproducible and avoids telling crawlers the page changed when only
 * the build ran.
 */

import { execSync } from 'node:child_process';
import { structuredDataScript } from '../src/structured-data.js';
import {
  renderRosterMarkup,
  renderPlaylistMarkup,
  renderGalleryMarkup,
} from '../src/templates.js';
import { players, videos, gallery } from '../src/data.js';
import { site } from '../src/site.js';

/** ISO date of the most recent commit; falls back to the current time. */
function lastModifiedDate() {
  try {
    const iso = execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
    if (iso) return new Date(iso).toISOString();
  } catch {
    /* No git available (e.g. a zip export) — fall through to the build clock. */
  }
  return new Date().toISOString();
}

/** `robots.txt` content, derived from the canonical origin. */
export function buildRobotsTxt() {
  return [
    '# TEAM HEX — everything on this site is public team content.',
    'User-agent: *',
    'Allow: /',
    '',
    '# The visit-counter API is not a page and must not be crawled or indexed.',
    'Disallow: /api/',
    'Disallow: /.netlify/',
    '',
    `Sitemap: ${site.url}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * `sitemap.xml` content.
 *
 * This is intentionally a one-URL sitemap. The site is a single page whose
 * sections are hash anchors (`#squad`, `#about`, …); hash fragments are not
 * separate indexable URLs, and the `?player=` deep links are parameterized
 * views of this same page. Listing those would create duplicate-content URLs,
 * which hurts more than a short sitemap does. Section and operator discovery is
 * handled by the prerendered HTML and the JSON-LD entity graph instead.
 */
export function buildSitemapXml(lastmod = lastModifiedDate()) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${site.url}/</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}

/** Replace a marker exactly once, treating the payload as a literal string. */
function substitute(html, marker, payload) {
  if (!html.includes(marker)) return html;
  // A function replacement stops `$&`, `$'` and friends inside the payload
  // from being interpreted as replacement patterns.
  return html.replace(marker, () => payload);
}

export function teamHexSeo() {
  let lastmod = lastModifiedDate();

  /** Middleware so `robots.txt` and `sitemap.xml` resolve in dev and preview too. */
  const middleware = (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (path === '/robots.txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(buildRobotsTxt());
      return;
    }
    if (path === '/sitemap.xml') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(buildSitemapXml(lastmod));
      return;
    }
    next();
  };

  return {
    name: 'team-hex-seo',
    buildStart() {
      lastmod = lastModifiedDate();
    },
    transformIndexHtml: {
      // Run after other plugins so the markers are still present.
      order: 'pre',
      handler(html) {
        let out = substitute(html, '<!--@structured-data-->', structuredDataScript({ dateModified: lastmod }));
        out = substitute(out, '<!--@prerender:roster-->', renderRosterMarkup(players));
        out = substitute(out, '<!--@prerender:playlist-->', renderPlaylistMarkup(videos));
        out = substitute(out, '<!--@prerender:gallery-->', renderGalleryMarkup(gallery));
        // `index.html` writes absolute crawler-facing URLs as %SITE_URL%/… so
        // the canonical origin is only ever defined once, in src/site.js.
        out = out.replaceAll('%SITE_URL%', site.url);
        return out;
      },
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: buildRobotsTxt(),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: buildSitemapXml(lastmod),
      });
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
