# TEAM HEX — Pro Edition 06

A cinematic Free Fire esports website built from the public content and original photography at https://teamhex.netlify.app.

## What’s new in 6.1 — Search engine optimisation

The site is a single page, so its ranking depends almost entirely on what a
crawler can read *without* running JavaScript, and on how clearly the entity is
described. Both were weak before: the roster, watchlist and gallery were empty
containers filled at runtime, and there was no `robots.txt`, no sitemap, no
canonical and a relative `og:image` (which produces no social preview at all).

- **Prerendered content.** `build/seo-plugin.js` renders the squad rail, match-film
  watchlist and archive gallery into `index.html` at build *and* dev time, using
  the same templates in `src/templates.js` that `src/main.js` hydrates with. All
  six operators, all four films and all eight archive images — names, in-game
  names, roles, captions and alt text — are now in the raw HTML. The prerendered
  and hydrated markup are byte-identical, so there is no flash of empty content
  and no duplicated template strings to keep in sync.
- **One rich JSON-LD graph** generated from `src/data.js`, so it cannot drift
  from the page: a top-level `SportsTeam` node plus `Organization`, `WebSite`,
  `WebPage`, six `Person`, four `VideoObject`, an `ImageGallery` and a `FAQPage`.
  Operator biographies travel here rather than as hidden page text.
- **Complete head metadata**: `rel="canonical"`, `meta robots` with
  `max-image-preview:large`, `og:url` / `og:site_name` / `og:locale`, absolute
  `og:image` with type/width/height/alt, and matching `twitter:` title,
  description and image alt.
- **`robots.txt` and `sitemap.xml`** generated from the same site config, plus a
  branded `404.html` served with a real 404 status and `noindex, follow` so bad
  URLs never become soft 404s.
- **Keyword-led title and description** — 49 and 153 characters, both inside the
  SERP display window, replacing the previous slogan-only title.
- **Resource hints**: `dns-prefetch` for the YouTube hosts used on demand, and a
  `fetchpriority="high"` preload for the largest-contentful-paint hero image.
- **Crawler-safe caching** in `netlify.toml`, plus HSTS and a `Permissions-Policy`.
  `/assets/*` stays immutable (content-hashed) while `/images/*` revalidates,
  because those files are *not* hashed and a swapped social card must propagate.
- **One origin, defined once.** `src/site.js` is the single source of truth;
  `%SITE_URL%` in `index.html` is substituted at build time, so the canonical
  origin, JSON-LD, sitemap and robots.txt can never disagree.

### Changing the canonical domain

Set `VITE_SITE_URL` at build time (Netlify: Site settings → Environment
variables), or edit `siteUrl` in `src/site.js`. Nothing else needs updating —
the canonical tag, Open Graph/Twitter URLs, JSON-LD, `sitemap.xml` and
`robots.txt` all derive from it.

### Real section URLs

The homepage stays the full cinematic one-page experience. On top of it, four
read-only sections now have real, independently indexable URLs:

| URL | Page | Prerendered into the HTML |
| --- | --- | --- |
| `/` | Full one-page experience | all sections |
| `/squad` | The roster | 6 operators + 6 `Person` entities |
| `/about` | The story | the HEX DNA prose |
| `/protocol` | Prepare, unite, dominate | the three-stage sequence |
| `/highlights` | Combat archive | 4 films + 8 archive images, 4 `VideoObject` and an `ImageGallery` |

Each route page gets its own `<title>`, meta description, self-referencing
canonical, Open Graph/Twitter tags, and JSON-LD (`WebPage` + `BreadcrumbList` +
a defined `SportsTeam`, plus the entities that section actually contains).

**There is still only one copy of the markup.** `index.html` remains the single
source of truth: the four `*.html` files in the project root are thin shells
that `build/seo-plugin.js` expands at build *and* dev time by extracting the
shared header, that route's `<section>`, and the shared footer out of the
prepared homepage HTML. Editing a section on the homepage edits it everywhere.

Route pages load `src/page.js` instead of `src/main.js`. They deliberately skip
Three.js (567 kB) and the GSAP/Lenis animation chunk (153 kB), so a deep link
into `/squad` is far lighter than the homepage. The design is identical because
`src/page.js` imports the exact same stylesheets. Content needs no JavaScript at
all — the reveal animations use `gsap.from()`, so every element's natural state
is fully visible.

**Why `/join` and `/contact` are redirects.** Those two sections contain working
forms (client-side eligibility check, prefilled Gmail draft, device-local draft
autosave). Rather than duplicate or refactor that logic onto separate pages —
which risks silently breaking a working form — both URLs 302 to the homepage
anchor where the forms already live. They are excluded from `sitemap.xml`,
because a redirect must never be listed there. 302 rather than 301 so browsers
do not cache it permanently: these are the most likely sections to become real
pages later.

On the homepage, nav links are now real URLs (`href="/squad"`) so crawlers can
follow them, but a click still smooth-scrolls exactly as before — `src/main.js`
intercepts the click only when the target section is present on the current
page. If JavaScript is unavailable, the link simply navigates.

### Known limits, stated honestly

- **The sitemap lists five URLs** — the homepage plus the four route pages.
  Hash anchors are still absent because fragments are not separately indexable,
  and `?player=` deep links stay out because they are parameterized views of a
  page that is already indexed.
- **`VideoObject.uploadDate` is omitted.** Google requires it for video rich
  results, and inventing a date would be worse than earning no rich result. Add
  `published: 'YYYY-MM-DD'` to an entry in `src/data.js` and it is picked up
  automatically.
- The archive gallery lives inside a hidden tab panel, so its prerendered markup
  may be weighted lower than visible text. The `ImageGallery` JSON-LD carries the
  same image data for crawlers that do use it.
- No `Content-Security-Policy` was added: the page relies on inline styles set by
  the animation layer and on YouTube iframes, so a CSP needs its own testing pass.

## What’s new in Pro Edition 06

- **Command menu (`Ctrl/⌘ + K` or `/`):** one searchable palette for every section, operator, match film, archive image, action, and official channel. Recent commands are remembered on your device, and the whole menu is keyboard- and screen-reader-friendly.
- **Saved operators:** bookmark any player from their profile, then use the new **SAVED** roster filter. Selections live in `localStorage` on the visitor’s device only — nothing is uploaded.
- **Shareable profiles:** each operator has a share/copy-link action that produces a deep link such as `?player=rian#squad`, which opens that profile on arrival.
- **Local form drafts:** the recruitment and contact forms autosave to the device, restore after a reload, show an explicit “restored from this device” banner, and can be discarded in one click. Drafts are cleared once a check runs or an email draft is prepared.
- **Archive upgrades:** a play/pause slideshow in the lightbox and a download button for every original image.
- **Keyboard shortcuts panel (`?`)** plus `F` for FX and `T` for the top of the page.
- **Toast notifications** for saves, shares, drafts, slideshow, and connectivity, announced through a polite live region.
- **Installable PWA:** web app manifest, generated maskable icons, and a production-only service worker that caches the shell and media for offline reading. The visitor API is never cached, and an offline badge states clearly when a cached copy is shown.

## What’s new in Hyper Edition 05.1

- **Team member scroll sequence:** on desktop with FX enabled, the squad section pins and vertical scrolling drives the roster horizontally. The active operator HUD, focus glow, image depth, and progress bar update as you scroll. Drag, arrow buttons, and keyboard focus still move through the sequence. With FX off or reduced motion, the roster returns to a normal accessible rail.

## What’s new in Hyper Edition 05

- **All available original site imagery:** the six player portraits, blue wolf emblem, six in-game archive images, and the two previously missing original brand assets (`link.png` crimson wolf crest and `logo.png` legacy TEAM HEX banner) are included. The original `assets/teamhex-logo.png` URL returns 404 and is not available.
- **Horizontal archive rail:** the gallery is now a draggable/scrollable filmstrip with snap points, progress bar, and previous/next controls.
- **Hyper motion pass:** glitch headline layers, scroll-velocity warp streaks, faster energy particles with motion trails, reactive glow, and deeper hover tilt.
- **Eight-image lightbox:** archive navigation and counts now include the original brand assets.

## What’s new in Night Ops Edition 04

- **New broadcast-inspired direction:** carbon-dark surfaces, ice-blue/signal-cyan accents, live-roster framing, and a more immersive esports atmosphere.
- **Horizontal squad showcase:** draggable/scrollable player rail with snap points, progress bar, and previous/next controls.
- **More motion:** scramble-in telemetry labels, velocity-reactive marquee with skew, cursor action labels, clip-path reveals, and deeper scroll parallax.
- **Unified dark UI:** roster, archive, contact, forms, dialogs, and footer now share the Night Ops visual system.

## What’s new in Studio Edition 03

- **Refined art direction:** editorial esports layout with bone-paper light sections, deep-ink dark sections, and electric cobalt accents.
- **New typography system:** Barlow Condensed for display headlines and Inter for interface/body text.
- **Cleaner hero:** stronger hierarchy, match-day meta chip, motto-led subhead, signature line, and oversized unit index.
- **Professional roster cards:** light trading-card surfaces, clearer role badges, sharper hover states, and calmer 3D tilt.
- **Polished motion:** masked headline reveals, scroll-scrubbed media/form entrances, restrained parallax, magnetic CTA, and the pinned HEX protocol sequence.
- **Consistent components:** unified buttons, tabs, forms, dialogs, footer counter, and focus states across dark and light surfaces.

## What’s new in Experience 02

- **Real Three.js / WebGL 3D:** an orbital hero scene, a draggable metallic wolf emblem, and a hexagonal scroll tunnel.
- **One shared GPU context:** the canvas moves between visible scenes instead of creating three separate WebGL contexts. Rendering is capped at 30fps, pixel density is limited, and GPU work stops when off-screen, hidden, or switched off.
- **Scroll choreography in every section:** masked character reveals, 3D roster entrances, scroll-scrubbed media/form perspective, animated section scans, parallax numerals, a journey rail, and a three-stage pinned HEX protocol sequence.
- **Reactive surfaces:** deeper holographic card tilt, magnetic CTA, pointer ripples, animated signals, and 3D gallery hover.
- **Footer visitor odometer:** rolling digits backed by a real counter, not a random number.
- **Accessible fallbacks:** FX switch, system reduced-motion support, static readable protocol content when motion is off, keyboard rotation for the 3D emblem, and original-image fallback if WebGL is unavailable.

All original roster details, match films, gallery images, contact links, clan criteria, and creator credit are preserved.

## Run locally

Node.js 22 is recommended. Node.js 20.19+ also works with Vite 6.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The Vite development/preview server includes a persistent **local-preview** visitor API. Its count is stored in `.data/visitor-count.json` and is explicitly labeled `PREVIEW VISITS` in the footer. It is not the live website’s count.

## Production build

```bash
npm run build
npm run preview
```

The static site is generated in `dist/`. The shared production visitor counter additionally requires the included Netlify Function.

## Deploy the full experience to Netlify

### Git-based deployment — recommended

1. Push this project to a Git repository.
2. Import the repository into Netlify.
3. The included `netlify.toml` configures:
   - build command: `npm run build`
   - publish directory: `dist`
   - functions directory: `netlify/functions`
   - Node.js 22
   - `/api/visits` routing
4. Deploy. Netlify provisions Blobs automatically; no API key or database setup is needed.

### Netlify CLI

From the project directory:

```bash
npm install
npm run build
npx netlify-cli login
npx netlify-cli init
npx netlify-cli deploy --prod
```

Link to your existing TEAM HEX site only when you intentionally want to replace it. This project has **not** modified or published over the existing site.

### Static-only hosting

You can upload `dist/` to any static host. The website and animations work, but without `/api/visits` the footer honestly switches to **VISITS ON THIS DEVICE**. A static-only upload does not provide a shared cross-device count.

## How the visitor counter works

- `POST /api/visits` increments the count once per browser session.
- `GET /api/visits` reads the count without incrementing it.
- The client remembers the session in `sessionStorage`, so normal reloads do not add another visit.
- Production uses a site-scoped Netlify Blob store with strong consistency and atomic compare-and-swap writes. Concurrent visits retry instead of overwriting one another.
- The count survives new deploys and is shared across visitors/devices on the same Netlify site.
- Only the aggregate count and last-updated timestamp are stored. No IP address, name, email, or tracking identifier is stored by this counter.
- This is a **visit counter**, not a unique-person analytics system. Clearing browser storage, private browsing, or a new session can produce another visit.
- If the shared API is unavailable, the UI explicitly labels any device-local fallback. It never presents a local count as a global count.

The implementation follows Netlify’s documented conditional-write API: https://docs.netlify.com/build/data-and-storage/netlify-blobs/

## Original content included

- Niloy / HEX-N1L — Supporter
- Nirob / HEX-CL4W — Rifler
- Alif / HEX-M4CE — Bomber
- Rian / HEX-SPE4R — Rusher
- Muhit / HEX-HUNTER — Sniper
- Tasir / HEX-BROK — Supporter
- Four original YouTube match films, six original gallery images, and two original brand assets
- Original WhatsApp, WhatsApp community, Facebook, email, and Free Fire clan links
- Recruitment criteria: level **greater than 45** and experience **greater than 2 years**
- Motto: “Fearless in Battle. United in Victory.”
- Original site creator credit: [NIROB](https://nirob120.netlify.app/)

## Forms remain honest

- Recruitment is a client-side eligibility check. It does not pretend to submit or approve an application.
- Contact opens a prefilled Gmail draft, with Gmail and `mailto:` fallbacks. The visitor sends the email from their own client.
- The original domain-specific OneSignal integration is not copied. Configure notifications for your final domain separately if needed.

## Edit the experience

- `src/data.js`: players, biographies, videos, gallery, links
- `src/site.js`: canonical origin, brand copy, social profiles, recruitment thresholds — the single source of truth for every SEO value
- `src/templates.js`: shared roster/film/gallery markup, used by both the prerender and runtime hydration
- `src/structured-data.js`: the JSON-LD entity graph, generated from `src/data.js`
- `src/routes.js`: the route table — paths, titles, descriptions, breadcrumb labels
- `src/page.js`: lightweight entry for the route pages (no Three.js, no GSAP/Lenis)
- `src/page.css`: breadcrumb and section-pager styling for the route pages
- `src/icons.js`: the lucide icon set, shared by both entries
- `squad.html`, `about.html`, `protocol.html`, `highlights.html`: thin route shells, expanded from `index.html` at build time — do not edit them directly
- `build/seo-plugin.js`: Vite plugin that prerenders content, injects JSON-LD, substitutes `%SITE_URL%`, expands the route shells, serves pretty URLs, and emits `robots.txt` + `sitemap.xml`
- `public/404.html`: self-contained branded 404 (`noindex, follow`)
- `index.html`: content, sections, head SEO tags, `<!--@structured-data-->` and `<!--@prerender:*-->` markers, protocol sequence, footer counter
- `src/style.css`: original responsive design system
- `src/experience.css`: 3D/scroll experience styling and counter odometer
- `src/studio.css`: Studio Edition art direction, typography, light/dark sections, and component polish
- `src/nightops.css`: Night Ops broadcast theme, horizontal roster rail, cursor labels, and signal accents
- `src/hyper.css`: glitch type, warp streaks, horizontal archive rail, and reactive surface polish
- `src/pro.css`: command menu, shortcuts, toasts, saved operators, drafts, and offline badge
- `src/pro.js`: command palette, notifications, sharing, shortcuts, connectivity, PWA registration
- `src/store.js`: device-local saved operators, form drafts, and recent commands
- `public/sw.js`: production service worker (offline shell and media cache)
- `public/manifest.webmanifest` and `public/icons/`: installable app metadata and icons
- `src/main.js`: GSAP/SplitText choreography, interactions, forms, motion preferences
- `src/world.js`: shared Three.js renderer and three 3D scenes
- `src/visitors.js`: session deduplication, counter API client, rolling digits, honest fallback
- `netlify/functions/visits.mjs`: production counter API
- `vite.config.js`: local-preview counter API and build configuration
- `public/images/`: optimized original team assets

Before publishing, set the canonical origin once — either the `VITE_SITE_URL`
build variable or `siteUrl` in `src/site.js`. The absolute `og:image`,
`twitter:image`, canonical tag, JSON-LD, `sitemap.xml` and `robots.txt` all
derive from it, so there is no longer a per-tag URL to edit by hand.

## Verification

```bash
npx playwright install chromium
npm test
```

On minimal Linux installations:

```bash
npx playwright install-deps chromium
```

The 60 automated tests cover:

- Shared WebGL context and scene switching
- Horizontal squad rail controls and filter reset
- Complete original archive/brand gallery and rail controls
- Pinned squad scroll sequence and motion-off fallback
- Command menu search, recents, and accessibility
- Saved operators, persistence, and the saved filter
- Local draft restore and discard
- Archive slideshow and image downloads
- Keyboard shortcuts panel and FX shortcut
- Installable manifest, icons, and structured data
- **Crawlable HTML with JavaScript disabled** — the raw HTTP response must contain every operator in-game name, all four match films and all eight archive images
- **JSON-LD integrity** — exactly one block, `SportsTeam` on top, six `Person` and four `VideoObject` nodes with absolute thumbnail and playback URLs
- **Head metadata** — canonical equals `og:url`, both absolute; `og:image` matches `twitter:image`; title ≤ 60 and description 120–160 characters; exactly one `h1`
- **No build leakage** — no `%SITE_URL%` token or prerender marker survives into the output
- **Alt text on every `<img>`** and a 200 response for every prerendered image path
- **`robots.txt` and `sitemap.xml`** — correct content types, absolute sitemap URL, real ISO `lastmod`, `/api/` disallowed
- **Social card integrity** — `/images/social-card.jpg` is genuinely 1200×630
- **Manifest/meta description parity** — the two strings must not drift apart
- **Every route page** — unique title within 60 characters, description within
  120–160, self-referencing canonical and `og:url`, absolute `og:image`
- **No duplicated content** — each route contains its own `<section>` and none of
  the others, which is what makes them separately indexable rather than
  near-identical copies of the homepage
- **Route JSON-LD** — `WebPage` on top, a two-item `BreadcrumbList` from the
  homepage to the page itself, and a *defined* `SportsTeam` rather than a bare
  `@id` reference
- **Route pages stay light** — they load `page.js` and must not load `main.js` or
  the `three.js` chunk
- **Redirects** — `/join` and `/contact` answer 302 with the homepage anchor
- **Real internal links** — the homepage links to every route with a crawlable
  URL and keeps no hash links to them, while the skip link stays an in-page anchor
- Keyboard interaction with the 3D emblem
- Pinned protocol stage progression
- Session-deduplicated live counter and explicit device-only fallback
- Concurrent server-side counter increments
- Roster filters and profiles
- Video selection and cleanup
- Gallery zoom, pan, reset, and keyboard navigation
- Recruitment threshold boundaries
- Contact draft generation
- Mobile navigation and 320–1440px overflow checks
- Persistent motion preferences
- Automated WCAG A/AA checks on desktop and mobile

Automated checks complement manual accessibility testing. YouTube playback requires internet access and the original videos remaining available.

## Content credit

Team content, photographs, emblem, and match footage belong to their respective TEAM HEX owners and are reused at the site owner’s request.
