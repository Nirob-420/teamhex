/**
 * Entry point for the section route pages (/squad, /about, /protocol,
 * /highlights).
 *
 * These pages carry one section each, so they deliberately do NOT load the
 * homepage stack: no Three.js, no GSAP ScrollTrigger choreography, no Lenis.
 * That keeps them far lighter than `/` and, more importantly, means none of the
 * homepage code runs against sections that are not on the page.
 *
 * The look is identical because this module imports the exact same stylesheets
 * as `src/main.js`, and the header/footer/section markup is extracted verbatim
 * from `index.html` at build time by `build/seo-plugin.js`.
 *
 * Content is visible without any of this JavaScript: the reveal animations on
 * the homepage use `gsap.from()`, so the natural state of every element is
 * fully opaque. This file only adds behaviour.
 */

import './style.css';
import './experience.css';
import './studio.css';
import './nightops.css';
import './hyper.css';
import './pro.css';
import './page.css';
import { refreshIcons } from './icons.js';
import { initPro, toast } from './pro.js';
import { initVisitorCounter } from './visitors.js';
import { players, videos } from './data.js';
import { routes } from './routes.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing is supported. */ } },
};

/** Which route this document is, from `<html data-route="…">`. */
const routeId = document.documentElement.dataset.route || '';
const route = routes.find(item => item.id === routeId);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled = storage.get('hex-motion') === 'off' ? false : !reducedMotion.matches;

function applyMotion(enabled) {
  motionEnabled = enabled;
  // Mirrors src/main.js so the FX preference means the same thing on every page.
  document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  $$('[data-motion-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', `Turn animations ${enabled ? 'off' : 'on'}`);
    const label = $('span', button);
    if (label) label.textContent = enabled ? 'FX ON' : 'FX OFF';
  });
}

function openDialog(dialog) { if (dialog && typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal(); }
function closeDialog(dialog) { if (dialog && dialog.open) dialog.close(); }

/**
 * Sections are not all present here, so navigation that the homepage would
 * smooth-scroll to becomes a real navigation instead. Deep links reuse the
 * homepage's existing query parameters rather than inventing new ones.
 */
function goToSection(id) {
  $$('dialog[open]').forEach(closeDialog);
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'start' });
  else window.location.assign(`/#${id}`);
}

/* --- Header chrome ------------------------------------------------------ */

applyMotion(motionEnabled);
$$('[data-motion-toggle]').forEach(button => button.addEventListener('click', () => {
  storage.set('hex-motion', motionEnabled ? 'off' : 'on');
  applyMotion(!motionEnabled);
  toast(motionEnabled ? 'Animations enabled.' : 'Animations disabled.', 'activity');
}));
reducedMotion.addEventListener?.('change', event => {
  if (storage.get('hex-motion') === null) applyMotion(!event.matches);
});

$('#menu-toggle')?.addEventListener('click', () => {
  $('#menu-toggle').setAttribute('aria-expanded', 'true');
  openDialog($('#mobile-menu'));
});

// Mark this page's own nav entry as current, replacing the scroll-spy used on `/`.
$$('.desktop-nav .nav-link, .scroll-rail a, #mobile-menu nav a').forEach(link => {
  const section = link.dataset.section || link.dataset.rail;
  if (!section || section !== routeId) return;
  link.classList.add('is-active');
  link.setAttribute('aria-current', 'page');
});

const year = $('#current-year');
if (year) year.textContent = String(new Date().getFullYear());

let headerQueued = false;
function updateHeader() {
  headerQueued = false;
  $('#site-header')?.classList.toggle('scrolled', window.scrollY > 25);
}
addEventListener('scroll', () => { if (!headerQueued) { headerQueued = true; requestAnimationFrame(updateHeader); } }, { passive: true });
updateHeader();

/* --- Section interactions ---------------------------------------------- */
/*
 * The prerendered markup is byte-identical to the homepage, so the same
 * data attributes are present. Here they navigate to where the full interaction
 * lives instead of opening a dialog that this page does not ship.
 */

document.addEventListener('click', event => {
  const card = event.target.closest('[data-player]');
  if (card) {
    event.preventDefault();
    window.location.assign(`/?player=${card.dataset.player}#squad`);
    return;
  }

  const film = event.target.closest('[data-select-video]');
  if (film) {
    event.preventDefault();
    // A real outbound link is better here than a dialog: it is crawlable and
    // it is what the visitor actually wants on a lightweight page.
    window.open(`https://www.youtube.com/watch?v=${film.dataset.selectVideo}`, '_blank', 'noopener,noreferrer');
    return;
  }

  const shot = event.target.closest('[data-gallery]');
  if (shot) {
    event.preventDefault();
    window.location.assign('/#highlights');
    return;
  }

  // The feature video button on /highlights.
  const feature = event.target.closest('[data-video]');
  if (feature) {
    event.preventDefault();
    window.open(`https://www.youtube.com/watch?v=${feature.dataset.video}`, '_blank', 'noopener,noreferrer');
    return;
  }
});

// Media tabs on /highlights: the panels are both in the markup, so the plain
// show/hide behaviour can stay without any of the homepage animation stack.
$$('[data-media-tab]').forEach(tab => tab.addEventListener('click', () => {
  const isFilms = tab.dataset.mediaTab === 'films';
  $$('[data-media-tab]').forEach(other => {
    const active = other === tab;
    other.classList.toggle('is-active', active);
    other.setAttribute('aria-selected', String(active));
    other.tabIndex = active ? 0 : -1;
  });
  const films = $('#films-panel');
  const galleryPanel = $('#gallery-panel');
  if (films) films.hidden = !isFilms;
  if (galleryPanel) galleryPanel.hidden = isFilms;
}));

/* --- Command menu, shortcuts and toasts -------------------------------- */
/*
 * `pro.js` is reused as-is. Its handlers navigate rather than animate, which is
 * why the search palette still works on these pages without duplicating any of
 * its logic.
 */
initPro({
  goToSection,
  showPlayer: id => { window.location.assign(`/?player=${id}#squad`); },
  openVideo: id => { window.open(`https://www.youtube.com/watch?v=${id}`, '_blank', 'noopener,noreferrer'); },
  openGallery: () => { window.location.assign('/#highlights'); },
  openDialog,
  closeDialog,
  refreshIcons,
  toggleMotion() {
    storage.set('hex-motion', motionEnabled ? 'off' : 'on');
    applyMotion(!motionEnabled);
    toast(motionEnabled ? 'Animations enabled.' : 'Animations disabled.', 'activity');
  },
  showSaved() { window.location.assign('/#squad'); },
  startSlideshow() { window.location.assign('/#highlights'); },
});

refreshIcons();
initVisitorCounter();

// Guard against a route shell being emitted without a matching definition.
if (!route) console.warn(`[team-hex] unknown route "${routeId}"`);
export { players, videos };
