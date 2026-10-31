/**
 * TEAM HEX SEO plugin for Vite.
 *
 * A single-page site is only as crawlable as its raw HTML, so this plugin does
 * four things at build time *and* in the dev/preview servers:
 *
 *   1. Prerenders the squad rail, match-film watchlist and archive gallery into
 *      their empty containers, using the exact same templates `src/main.js`
 *      hydrates with. Crawlers that never run JavaScript — and the first pass
 *      of crawlers that do — see every player, film and image.
 *   2. Injects one JSON-LD block generated from `src/data.js` and `src/site.js`.
 *   3. Emits `robots.txt` and `sitemap.xml` built from the same site config, so
 *      the canonical origin can never disagree between the two.
 *   4. Expands the section route shells (`squad.html`, `about.html`, …) into
 *      real pages: route-specific head metadata, the shared header and footer,
 *      and that route's section extracted verbatim from `index.html`.
 *
 * `index.html` stays the single source of truth for page structure. The route
 * pages are generated from it, so a section edited on the homepage is edited
 * everywhere and there is no second copy of the markup to fall out of sync.
 *
 * `lastmod` comes from the newest git commit rather than the clock, which keeps
 * builds reproducible and avoids telling crawlers the page changed when only
 * the build ran.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { structuredDataScript, routeStructuredDataScript } from '../src/structured-data.js';
import {
  renderRosterMarkup,
  renderPlaylistMarkup,
  renderGalleryMarkup,
} from '../src/templates.js';
import { players, videos, gallery } from '../src/data.js';
import { site } from '../src/site.js';
import { routes, neighbours } from '../src/routes.js';

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

/** Attribute-safe escaping for generated markup. */
const esc = value =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
 * Lists the homepage plus every section that has its own prerendered page.
 * `/join` and `/contact` are excluded on purpose: they are redirects to
 * homepage anchors, and a redirect must not appear in a sitemap. Hash anchors
 * are likewise absent because fragments are not separately indexable URLs.
 */
export function buildSitemapXml(lastmod = lastModifiedDate()) {
  const entries = [{ path: '/', priority: '1.0' }, ...routes.map(route => ({ path: route.path, priority: '0.8' }))];
  const urls = entries
    .map(entry => [
      '  <url>',
      `    <loc>${site.url}${entry.path === '/' ? '/' : entry.path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      `    <priority>${entry.priority}</priority>`,
      '  </url>',
    ].join('\n'))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
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

/**
 * Extracts a balanced element from `html`.
 *
 * Only used for tags that do not nest inside themselves in this document
 * (`section`, `header`, `footer`, `dialog`), which was verified rather than
 * assumed — a naive "up to the next close tag" slice would truncate a nested
 * element and silently drop content.
 */
function extractBlock(html, tag, predicate) {
  const openPattern = new RegExp(`<${tag}\\b[^>]*>`, 'g');
  let match;
  while ((match = openPattern.exec(html))) {
    if (!predicate(match[0])) continue;
    let depth = 0;
    const scan = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
    scan.lastIndex = match.index;
    let step;
    while ((step = scan.exec(html))) {
      depth += step[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return html.slice(match.index, step.index + step[0].length);
    }
    return null;
  }
  return null;
}

const extractSection = (html, id) =>
  extractBlock(html, 'section', tag => new RegExp(`\\bid="${id}"`).test(tag));
const extractHeader = html => extractBlock(html, 'header', () => true);
const extractFooter = html => extractBlock(html, 'footer', () => true);
const extractDialog = (html, id) =>
  extractBlock(html, 'dialog', tag => tag.includes(`id="${id}"`));
const extractById = (html, tag, id) =>
  extractBlock(html, tag, open => open.includes(`id="${id}"`));

/** Breadcrumb + previous/next navigation for a route page. */
function routeChrome(route) {
  const { prev, next } = neighbours(route.id);

  const breadcrumb = `
    <nav class="route-breadcrumb" aria-label="Breadcrumb">
      <div class="container">
        <ol>
          <li><a href="/">HOME</a></li>
          <li aria-hidden="true" class="crumb-sep">/</li>
          <li><a href="${route.path}" aria-current="page">${esc(route.crumb.toUpperCase())}</a></li>
        </ol>
        <span class="crumb-kicker small-label"><span class="status-dot"></span> TEAM HEX / BD REGION</span>
      </div>
    </nav>`;

  const pagerLink = (section, direction) => {
    if (!section) return '';
    const href = section.path;
    const arrow = direction === 'prev' ? 'arrow-left' : 'arrow-up-right';
    const klass = direction === 'prev' ? 'pager-prev' : 'pager-next';
    const label = direction === 'prev' ? 'PREVIOUS' : 'NEXT';
    return `<a class="${klass}" href="${href}"><span class="pager-direction"><i data-lucide="${arrow}"></i> ${label}</span><span class="pager-label">${esc(section.label.toUpperCase())}</span></a>`;
  };

  const pager = `
    <nav class="route-pager" aria-label="Section navigation">
      <div class="container">
        ${pagerLink(prev, 'prev')}
        ${pagerLink(next, 'next')}
      </div>
    </nav>`;

  return { breadcrumb, pager };
}

/** Full `<head>` contents for a route page. */
function routeHead(route, lastmod) {
  const pageUrl = `${site.url}${route.path}`;
  return `
    <title>${esc(route.title)}</title>
    <meta name="description" content="${esc(route.description)}" />
    <link rel="canonical" href="${pageUrl}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="author" content="${esc(site.author)}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:locale" content="${site.locale}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${esc(route.ogTitle || route.title)}" />
    <meta property="og:description" content="${esc(route.description)}" />
    <meta property="og:image" content="${site.url}/images/social-card.jpg" />
    <meta property="og:image:secure_url" content="${site.url}/images/social-card.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(site.name)} — ${esc(site.slogan)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(route.ogTitle || route.title)}" />
    <meta name="twitter:description" content="${esc(route.description)}" />
    <meta name="twitter:image" content="${site.url}/images/social-card.jpg" />
    <meta name="twitter:image:alt" content="${esc(site.name)} — ${esc(site.slogan)}" />

    <meta name="theme-color" content="${site.themeColor}" />
    <meta name="color-scheme" content="dark" />
    <meta name="application-name" content="${esc(site.name)}" />
    <meta name="apple-mobile-web-app-title" content="${esc(site.name)}" />
    <link rel="manifest" href="/manifest.webmanifest" />

    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

    <link rel="dns-prefetch" href="//www.youtube-nocookie.com" />
    <link rel="dns-prefetch" href="//www.youtube.com" />

    <!-- Search Console ownership token. Paste the value from Search Console
         (Settings → Ownership verification → HTML tag) between the quotes.
         It is harmless to leave empty, but the page cannot be verified until
         it is filled in. -->
    <meta name="google-site-verification" content="" />

    ${routeStructuredDataScript(route, { dateModified: lastmod })}`;
}

/** Full `<body>` contents for a route page, assembled from `index.html`. */
function routeBody(route, indexHtml) {
  const section = extractSection(indexHtml, route.id);
  if (!section) {
    // Fail loudly at build time rather than shipping an empty page.
    throw new Error(`[team-hex-seo] could not find <section id="${route.id}"> in index.html`);
  }

  const header = extractHeader(indexHtml) ?? '';
  const footer = extractFooter(indexHtml) ?? '';
  const mobileMenu = extractDialog(indexHtml, 'mobile-menu') ?? '';
  const commandDialog = extractDialog(indexHtml, 'command-dialog') ?? '';
  const shortcutsDialog = extractDialog(indexHtml, 'shortcuts-dialog') ?? '';
  const toastRegion = extractById(indexHtml, 'div', 'toast-region') ?? '';
  const connectionBadge = extractById(indexHtml, 'p', 'connection-badge') ?? '';
  const { breadcrumb, pager } = routeChrome(route);

  return `
    <a href="#main" class="skip-link">Skip to content</a>

    ${header}

    <main id="main">
      ${breadcrumb}
      ${section}
      ${pager}
    </main>

    ${footer}

    ${mobileMenu}
    ${commandDialog}
    ${shortcutsDialog}
    ${toastRegion}
    ${connectionBadge}
    <noscript><div class="noscript-note">This page needs JavaScript for the command menu and media controls. The content above is complete without it. Contact us at <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>, or open the <a href="/">full TEAM HEX experience</a>.</div></noscript>`;
}

export function teamHexSeo() {
  let lastmod = lastModifiedDate();
  let root = process.cwd();
  let indexCache = null;

  /**
   * The fully prepared homepage HTML: structured data injected, containers
   * prerendered, URL tokens substituted. Route pages are extracted from this,
   * so they inherit the prerendered roster, films and gallery.
   */
  function prepareIndex(raw) {
    let out = substitute(raw, '<!--@structured-data-->', structuredDataScript({ dateModified: lastmod }));
    out = substitute(out, '<!--@prerender:roster-->', renderRosterMarkup(players));
    out = substitute(out, '<!--@prerender:playlist-->', renderPlaylistMarkup(videos));
    out = substitute(out, '<!--@prerender:gallery-->', renderGalleryMarkup(gallery));
    return out.replaceAll('%SITE_URL%', site.url);
  }

  /** Cached copy read from disk, used as the extraction source for route pages. */
  function preparedIndex() {
    if (!indexCache) indexCache = prepareIndex(readFileSync(resolve(root, 'index.html'), 'utf8'));
    return indexCache;
  }

  /** Mirrors Netlify's pretty URLs and redirects so dev behaves like production. */
  const middleware = (req, res, next) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0];

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

    // Form-bearing sections redirect to the homepage anchor where their
    // JavaScript actually lives. This must match netlify.toml exactly — 302,
    // not 301, because browsers cache 301s hard and these two are the most
    // likely sections to become real pages later.
    if (path === '/join' || path === '/contact') {
      res.statusCode = 302;
      res.setHeader('Location', `/#${path.slice(1)}`);
      res.end();
      return;
    }

    // Pretty URL: /squad serves squad.html.
    const route = routes.find(item => path === item.path || path === `${item.path}/`);
    if (route) {
      const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
      req.url = `/${route.file}${query}`;
    }
    next();
  };

  return {
    name: 'team-hex-seo',
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      lastmod = lastModifiedDate();
      indexCache = null;
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    transformIndexHtml: {
      // Run before Vite's own HTML processing so markers and tokens are gone.
      order: 'pre',
      handler(html, ctx) {
        const filename = String(ctx?.filename ?? '').replace(/\\/g, '/');

        // Route shells: expand into a full page assembled from index.html.
        const route = routes.find(item => filename.endsWith(`/${item.file}`));
        if (route) {
          let out = substitute(html, `<!--@route-head:${route.id}-->`, routeHead(route, lastmod));
          out = substitute(out, `<!--@route-body:${route.id}-->`, routeBody(route, preparedIndex()));
          return out;
        }

        // The homepage entry itself.
        return prepareIndex(html);
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt() });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemapXml(lastmod) });
    },
  };
}
