/**
 * BANGLADESH — HYPER DECK / cinematic motion engine
 * ==========================================================================
 * This is the "professional motion" pass. Instead of one generic stagger used
 * on every slide, the deck now has:
 *
 *   1. Nine distinct slide transitions (3D cube, flip, shutter, mosaic, iris,
 *      dolly zoom, parallax push, diagonal slice, warp streak). AUTO assigns a
 *      different one to each slide; the picker can force any of them.
 *   2. Per-slide choreography — kinetic word-split headlines, 3D card flips,
 *      SVG path drawing, clip-path reveals, elastic chips, counters and bars.
 *   3. Layered depth: media layers move at a different rate than content,
 *      depth vignettes, scan sweep, glint lines and chromatic split.
 *   4. One master GSAP timeline per navigation, so transition + reveal overlap
 *      instead of running back-to-back.
 *
 * Everything degrades to a complete, readable static slide when motion is off
 * or `prefers-reduced-motion` is set: no content is hidden by CSS by default.
 */

import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import './bangladesh.css';
import gsap from 'gsap';

// Full-slide blur/3D effects can drop a frame on weaker GPUs. GSAP's default
// lag smoothing would then stretch a 1s transition into many seconds, so use
// real elapsed time instead. A setTimeout failsafe below guarantees the deck
// can never lock up even if rAF is throttled or suspended entirely.
gsap.ticker.lagSmoothing(0);

/* ------------------------------------------------------------------ refs */

const slides = [...document.querySelectorAll('.slide')];
const stage = document.getElementById('stage');
const fxLayer = document.getElementById('fx-layer');
const fxFlash = document.getElementById('fx-flash');
const fxSelect = document.getElementById('fx-select');
const fxReadout = document.getElementById('fx-readout');
const dotsWrap = document.getElementById('dots');
const counterEl = document.getElementById('counter');
const titleEl = document.getElementById('slide-title');
const progressFill = document.getElementById('progress-fill');
const warp = document.querySelector('.deck-warp');
const cursor = document.querySelector('.deck-cursor');
const canvas = document.querySelector('.deck-particles');
const motionBtn = document.querySelector('[data-action="motion"]');
const liveLabel = document.querySelector('.deck-live');
const playBtn = document.querySelector('[data-action="autoplay"]');

const SLIDE_MS = 9500;
const REVEAL_AT = 0.36;

const FX_LABELS = {
  warp: 'WARP STREAK', cube: 'CUBE 3D', shutter: 'SHUTTER', mosaic: 'MOSAIC',
  iris: 'IRIS', dolly: 'DOLLY ZOOM', parallax: 'PARALLAX PUSH',
  slice: 'DIAGONAL SLICE', flip: 'FLIP',
};
/** AUTO gives every slide a different cinematic transition. */
const AUTO_SEQUENCE = ['dolly', 'slice', 'iris', 'cube', 'warp', 'parallax', 'mosaic', 'shutter', 'flip', 'dolly'];

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let motion = !prefersReduced;
let current = 0;
let locked = false;
let autoplay = false;
let slideStart = performance.now();
let masterTl = null;
let kenTweens = [];
let rafId = 0;
let wheelLock = false;

/* ------------------------------------------------- kinetic type splitting */

/** Wrap each word in a clipping span so headlines can rise word by word. */
function splitWords(root) {
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        text.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          outer.className = 'kw';
          const inner = document.createElement('span');
          inner.className = 'kw-in';
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR' && !child.classList.contains('kw')) {
        walk(child);
      }
    });
  };
  walk(root);
}
document.querySelectorAll('.display').forEach(splitWords);

/* ------------------------------------------------------------------ chrome */

slides.forEach((slide, i) => {
  const dot = document.createElement('button');
  dot.className = `dot${i === 0 ? ' is-active' : ''}`;
  dot.type = 'button';
  dot.setAttribute('aria-label', `Go to slide ${i + 1}: ${slide.dataset.title}`);
  dot.addEventListener('click', () => { stopAutoplay(); goTo(i); });
  dotsWrap.appendChild(dot);
});
const dots = [...dotsWrap.children];

function syncChrome(index) {
  counterEl.textContent = String(index + 1).padStart(2, '0');
  titleEl.textContent = slides[index].dataset.title;
  dots.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === index);
    dot.setAttribute('aria-current', i === index ? 'true' : 'false');
  });
  if (!autoplay) gsap.set(progressFill, { scaleX: (index + 1) / slides.length });
}

/* ------------------------------------------------------------- FX builders */

function makeEl(className, style = {}) {
  const el = document.createElement('div');
  el.className = className;
  Object.assign(el.style, style);
  fxLayer.appendChild(el);
  return el;
}
function clearFx() {
  fxLayer.replaceChildren();
}
function buildBands(count = 9) {
  return Array.from({ length: count }, (_, i) => makeEl('fx-band', {
    top: `${(100 / count) * i}%`, height: `${100 / count + 0.15}%`,
  }));
}
function buildTiles(cols = 7, rows = 4) {
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(makeEl('fx-tile', {
        left: `${(100 / cols) * c}%`, top: `${(100 / rows) * r}%`,
        width: `${100 / cols + 0.1}%`, height: `${100 / rows + 0.1}%`,
      }));
    }
  }
  return tiles;
}

/* ------------------------------------------------------------- transitions */

/** Every builder receives the master timeline and adds tweens starting at 0. */
const TRANSITIONS = {
  warp(tl, out, incoming, dir) {
    document.body.classList.add('is-warping');
    gsap.set(incoming, { opacity: 0, xPercent: 9 * dir, filter: 'blur(15px)' });
    tl.to(out, { opacity: 0, xPercent: -8 * dir, filter: 'blur(10px)', duration: .6, ease: 'power2.in' }, 0)
      .to(incoming, { opacity: 1, xPercent: 0, filter: 'blur(0px)', duration: .95, ease: 'expo.out' }, .05)
      .fromTo(warp, { opacity: 0, scaleX: .3 }, { opacity: .85, scaleX: 1, duration: .2, ease: 'power1.out' }, 0)
      .to(warp, { opacity: 0, duration: .35 }, .22);
  },

  cube(tl, out, incoming, dir) {
    gsap.set([out, incoming], { transformPerspective: 1500, transformOrigin: '50% 50%' });
    gsap.set(out, { rotationY: 0, xPercent: 0, opacity: 1 });
    gsap.set(incoming, { rotationY: -90 * dir, xPercent: 55 * dir, opacity: 1 });
    const vignette = makeEl('fx-vignette');
    tl.to(out, { rotationY: 90 * dir, xPercent: -55 * dir, opacity: .22, duration: 1.05, ease: 'power3.inOut' }, 0)
      .to(incoming, { rotationY: 0, xPercent: 0, opacity: 1, duration: 1.05, ease: 'power3.inOut' }, 0)
      .fromTo(vignette, { opacity: 0 }, { opacity: .8, duration: .45, ease: 'power1.inOut' }, .25)
      .to(vignette, { opacity: 0, duration: .5 }, .6);
  },

  shutter(tl, out, incoming) {
    gsap.set(incoming, { opacity: 1 });
    const bands = buildBands(9);
    const glint = makeEl('fx-glint');
    gsap.set(bands, { scaleY: 1 });
    gsap.set(glint, { opacity: 0, scaleX: .15 });
    tl.to(bands, { scaleY: 0, duration: .72, ease: 'power3.inOut', stagger: { each: .045, from: 'center' } }, .06)
      .to(glint, { opacity: .9, scaleX: 1, duration: .3, ease: 'power2.out' }, .08)
      .to(glint, { opacity: 0, duration: .4 }, .42)
      .set(out, { opacity: 0 }, .82);
  },

  mosaic(tl, out, incoming) {
    gsap.set(incoming, { opacity: 1 });
    const tiles = buildTiles(7, 4);
    gsap.set(tiles, { scale: 1 });
    tl.to(tiles, {
      scale: 0, duration: .58, ease: 'power3.in',
      stagger: { each: .022, grid: [4, 7], from: 'random' },
    }, .04).set(out, { opacity: 0 }, .78);
  },

  iris(tl, out, incoming) {
    gsap.set(incoming, { opacity: 1 });
    const iris = makeEl('fx-iris');
    gsap.set(iris, { clipPath: 'circle(150% at 50% 50%)' });
    tl.to(iris, { clipPath: 'circle(0% at 50% 50%)', duration: 1, ease: 'power3.inOut' }, .02)
      .set(out, { opacity: 0 }, .9);
  },

  dolly(tl, out, incoming) {
    gsap.set(incoming, { opacity: 0, scale: 1.26, filter: 'blur(18px)' });
    gsap.set(out, { scale: 1, opacity: 1 });
    const vignette = makeEl('fx-vignette');
    tl.to(out, { opacity: 0, scale: .84, filter: 'blur(12px)', duration: .78, ease: 'power2.inOut' }, 0)
      .to(incoming, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out' }, .04)
      .fromTo(vignette, { opacity: 0 }, { opacity: .6, duration: .4 }, .1)
      .to(vignette, { opacity: 0, duration: .55 }, .5);
  },

  parallax(tl, out, incoming, dir) {
    gsap.set(out, { opacity: 1, xPercent: 0 });
    gsap.set(incoming, { opacity: 1, xPercent: 112 * dir });
    const outMedia = out.querySelector('.slide__media');
    const inMedia = incoming.querySelector('.slide__media');
    const outInner = out.querySelector('.slide__inner');
    const inInner = incoming.querySelector('.slide__inner');
    if (inMedia) gsap.set(inMedia, { xPercent: 28 * dir });
    if (inInner) gsap.set(inInner, { opacity: 0, xPercent: 14 * dir });
    tl.to(out, { xPercent: -48 * dir, opacity: .3, duration: 1, ease: 'power3.inOut' }, 0)
      .to(incoming, { xPercent: 0, duration: 1, ease: 'power3.inOut' }, 0);
    if (outMedia) tl.to(outMedia, { xPercent: -18 * dir, duration: 1.05, ease: 'power2.out' }, 0);
    if (inMedia) tl.to(inMedia, { xPercent: 0, duration: 1.15, ease: 'power2.out' }, 0);
    if (outInner) tl.to(outInner, { xPercent: -9 * dir, opacity: .35, duration: .7, ease: 'power2.in' }, 0);
    if (inInner) tl.to(inInner, { xPercent: 0, opacity: 1, duration: .85, ease: 'expo.out' }, .16);
  },

  slice(tl, out, incoming, dir) {
    gsap.set(out, { opacity: 1, clipPath: 'inset(0 0 0 0)' });
    gsap.set(incoming, { opacity: 1, clipPath: 'inset(0 100% 0 0)' });
    const slices = [0, 1, 2].map(i => {
      const el = makeEl('fx-slice', { left: `${-38 + i * 17}%` });
      gsap.set(el, { xPercent: -240 * dir, opacity: .85 });
      return el;
    });
    tl.to(out, { clipPath: 'inset(0 0 0 100%)', duration: .9, ease: 'expo.inOut' }, 0)
      .to(incoming, { clipPath: 'inset(0 0% 0 0)', duration: .9, ease: 'expo.inOut' }, 0)
      .to(slices, { xPercent: 430 * dir, duration: .95, ease: 'power2.inOut', stagger: .07 }, 0);
  },

  flip(tl, out, incoming, dir) {
    gsap.set([out, incoming], { transformPerspective: 1500 });
    gsap.set(out, { rotationX: 0, transformOrigin: '50% 0%', opacity: 1 });
    gsap.set(incoming, { rotationX: -90 * dir, transformOrigin: '50% 100%', opacity: 1 });
    const vignette = makeEl('fx-vignette');
    tl.to(out, { rotationX: 90 * dir, opacity: .25, duration: .95, ease: 'power3.inOut' }, 0)
      .to(incoming, { rotationX: 0, duration: .95, ease: 'power3.inOut' }, 0)
      .fromTo(vignette, { opacity: 0 }, { opacity: .55, duration: .4 }, .25)
      .to(vignette, { opacity: 0, duration: .45 }, .6);
  },
};

function resolveFx(index) {
  const choice = fxSelect.value;
  return choice === 'auto' ? AUTO_SEQUENCE[index % AUTO_SEQUENCE.length] : choice;
}

/* ---------------------------------------------------------- choreography */

function choreograph(tl, slide, index, dir, at = REVEAL_AT) {
  const items = [...slide.querySelectorAll('[data-anim]')];
  const used = new Set();
  const take = selector => {
    const list = [...slide.querySelectorAll(selector)];
    list.forEach(el => used.add(el));
    return list;
  };
  const keepVisible = selector => {
    const el = slide.querySelector(selector);
    if (!el) return;
    gsap.set(el, { opacity: 1 });
    used.add(el);
  };
  /** Elements with bespoke tweens must be excluded from the generic rise. */
  const mark = selector => slide.querySelectorAll(selector).forEach(el => used.add(el));

  gsap.set(items, { opacity: 0 });

  // Kinetic headlines: words rise out of their clipping spans.
  const heads = [...slide.querySelectorAll('.display')];
  gsap.set(heads, { opacity: 1 });
  heads.forEach(el => used.add(el));
  const words = slide.querySelectorAll('.kw-in');
  if (words.length) {
    gsap.set(words, { yPercent: 115, rotationX: -55, opacity: 0 });
    tl.to(words, {
      yPercent: 0, rotationX: 0, opacity: 1, duration: .9, ease: 'expo.out',
      stagger: .028, clearProps: 'transform,opacity',
    }, at);
  }

  // Number counters (shared by every slide that has them).
  slide.querySelectorAll('[data-count]').forEach(node => {
    const target = Number(node.dataset.count);
    const proxy = { v: 0 };
    tl.to(proxy, {
      v: target, duration: 1.45, ease: 'power2.out',
      onUpdate: () => { node.textContent = Math.round(proxy.v).toLocaleString('en-US'); },
      onComplete: () => { node.textContent = target.toLocaleString('en-US'); },
    }, at + .35);
  });

  // Data bars (shared).
  const bars = slide.querySelectorAll('[data-bar]');
  if (bars.length) {
    gsap.set(bars, { scaleX: 0 });
    tl.to(bars, {
      scaleX: i => Number(bars[i].dataset.bar), duration: 1.3, ease: 'expo.out', stagger: .09,
    }, at + .45);
  }

  switch (index) {
    case 0: { // COVER — elastic chips, flag seal, wipes
      const bn = take('.bn-line');
      tl.fromTo(bn, { opacity: 0, x: -26 }, { opacity: 1, x: 0, duration: .75, ease: 'expo.out' }, at + .04);
      const sub = take('.cover__sub');
      tl.fromTo(sub, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: .85, ease: 'expo.out' }, at + .12);
      const rule = take('.hairline');
      gsap.set(rule, { opacity: 1 });
      tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: .8, ease: 'expo.out' }, at + .2);
      keepVisible('.cover__chips');
      const chips = slide.querySelectorAll('.cover__chips .chip');
      gsap.set(chips, { opacity: 0, y: 26, rotationX: -70 });
      tl.to(chips, { opacity: 1, y: 0, rotationX: 0, duration: .8, ease: 'back.out(1.5)', stagger: .07, clearProps: 'transform,opacity' }, at + .28);
      const foot = take('.cover__foot');
      tl.fromTo(foot, { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: .8, ease: 'power2.out' }, at + .5);
      const seal = take('.cover__seal');
      tl.fromTo(seal, { opacity: 0, scale: .5, rotation: -150 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.15, ease: 'elastic.out(1,.7)' }, at + .22);
      break;
    }
    case 1: { // DELTA — river lines, 3D stats, drawn SVG map
      keepVisible('.rivers');
      keepVisible('.geo__stats');
      mark('.river');
      const rivers = slide.querySelectorAll('.river');
      gsap.set(rivers, { opacity: 0, x: -34 });
      tl.to(rivers, { opacity: 1, x: 0, duration: .72, ease: 'expo.out', stagger: .1 }, at + .12);
      const lines = slide.querySelectorAll('.river__line');
      gsap.set(lines, { scaleX: 0 });
      tl.to(lines, { scaleX: 1, duration: .95, ease: 'expo.out', stagger: .1 }, at + .2);
      const cards = take('.stat-card');
      gsap.set(cards, { opacity: 0, rotationY: -70, scale: .9 });
      tl.to(cards, { opacity: 1, rotationY: 0, scale: 1, duration: .9, ease: 'back.out(1.35)', stagger: .09, clearProps: 'transform,opacity' }, at + .3);
      const map = take('.map-panel');
      tl.fromTo(map, { opacity: 0, scale: .9, rotation: -2 }, { opacity: 1, scale: 1, rotation: 0, duration: 1, ease: 'expo.out' }, at + .1);
      const paths = slide.querySelectorAll('.map__river, .map__land, .map__coast');
      paths.forEach((path, i) => {
        let length = 1000;
        try { length = path.getTotalLength(); } catch { /* not measurable */ }
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        tl.to(path, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, at + .35 + i * .08);
      });
      const pins = slide.querySelectorAll('.map__cities circle, .map__cities text');
      gsap.set(pins, { opacity: 0 });
      tl.to(pins, { opacity: 1, duration: .55, stagger: .04 }, at + .85);
      break;
    }
    case 2: { // HISTORY — spine draw, alternating timeline nodes
      keepVisible('.timeline');
      const nodes = slide.querySelectorAll('.tl-item__node');
      gsap.set(nodes, { scale: 0 });
      tl.to(nodes, { scale: 1, duration: .55, ease: 'back.out(2.4)', stagger: .12 }, at + .2);
      const fill = slide.querySelector('.timeline__fill');
      if (fill) {
        gsap.set(fill, { scaleY: 0, transformOrigin: '50% 0%' });
        tl.to(fill, { scaleY: 1, duration: 1.2, ease: 'power2.inOut' }, at);
      }
      mark('.tl-item');
      const entries = slide.querySelectorAll('.tl-item');
      gsap.set(entries, { opacity: 0, x: i => (i % 2 ? 34 : -34) });
      tl.to(entries, { opacity: 1, x: 0, duration: .78, ease: 'expo.out', stagger: .12, clearProps: 'transform,opacity' }, at + .15);
      const quote = take('.history__quote');
      tl.fromTo(quote, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: .9, ease: 'expo.out' }, at + .55);
      break;
    }
    case 3: { // PEOPLE — flip cards, drifting Bangla watermark
      const big = take('.people__big');
      tl.fromTo(big, { opacity: 0, scale: .9, rotationY: -14 }, { opacity: 1, scale: 1, rotationY: 0, duration: 1, ease: 'expo.out' }, at + .05);
      const cards = take('.info-card');
      gsap.set(cards, { opacity: 0, rotationX: -65, y: 32 });
      tl.to(cards, { opacity: 1, rotationX: 0, y: 0, duration: .85, ease: 'back.out(1.3)', stagger: .1, clearProps: 'transform,opacity' }, at + .25);
      const watermark = slide.querySelector('.bn-watermark');
      if (watermark) {
        gsap.set(watermark, { xPercent: 7, opacity: 0 });
        tl.to(watermark, { xPercent: 0, opacity: 1, duration: 1.8, ease: 'power2.out' }, at);
      }
      const foot = take('.people__foot');
      tl.fromTo(foot, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .8, ease: 'power2.out' }, at + .6);
      break;
    }
    case 4: { // CULTURE — 3D card flip grid, spring stamp
      mark('.culture-list li');
      const cards = slide.querySelectorAll('.culture-list li');
      gsap.set(cards, { opacity: 0, rotationY: -80, transformPerspective: 850 });
      tl.to(cards, {
        opacity: 1, rotationY: 0, duration: .9, ease: 'back.out(1.3)',
        stagger: { each: .08, grid: [2, 2], from: 'start' }, clearProps: 'transform,opacity',
      }, at + .15);
      const stamp = take('.culture__stamp');
      tl.fromTo(stamp, { opacity: 0, scale: .55, y: 34 }, { opacity: 1, scale: 1, y: 0, duration: 1.05, ease: 'elastic.out(1,.75)' }, at + .55);
      break;
    }
    case 5: { // ECONOMY — KPI rise, row stagger, growing bars
      keepVisible('.chart-card');
      mark('.kpi, .bar-row');
      const kpis = slide.querySelectorAll('.kpi');
      gsap.set(kpis, { opacity: 0, y: 36, scale: .93 });
      tl.to(kpis, { opacity: 1, y: 0, scale: 1, duration: .85, ease: 'expo.out', stagger: .08 }, at + .05);
      const rows = slide.querySelectorAll('.bar-row');
      gsap.set(rows, { opacity: 0, x: -30 });
      tl.to(rows, { opacity: 1, x: 0, duration: .72, ease: 'expo.out', stagger: .09 }, at + .28);
      break;
    }
    case 6: { // NATURE — diagonal clip reveal + camera pull-back on tiles
      mark('.tile');
      const tiles = slide.querySelectorAll('.tile');
      gsap.set(tiles, { clipPath: 'inset(0 0 100% 0)', opacity: 1 });
      tl.to(tiles, {
        clipPath: 'inset(0 0 0% 0)', duration: .95, ease: 'expo.out',
        stagger: { each: .09, grid: [2, 2], from: 'start' }, clearProps: 'clipPath',
      }, at + .05);
      const photos = slide.querySelectorAll('.tile .ken');
      gsap.set(photos, { scale: 1.24 });
      tl.to(photos, { scale: 1, duration: 1.5, ease: 'power2.out', stagger: .09 }, at + .1);
      const captions = slide.querySelectorAll('.tile figcaption');
      gsap.set(captions, { opacity: 0, y: 22 });
      tl.to(captions, { opacity: 1, y: 0, duration: .75, ease: 'expo.out', stagger: .09, clearProps: 'transform,opacity' }, at + .5);
      break;
    }
    case 7: { // FOOD — circular photo reveal, dish rows slide in
      const photo = take('.food__photo');
      gsap.set(photo, { opacity: 1, clipPath: 'circle(0% at 50% 50%)' });
      tl.to(photo, { clipPath: 'circle(82% at 50% 50%)', duration: 1.15, ease: 'expo.out', clearProps: 'clipPath' }, at);
      mark('.dish-list li');
      const dishes = slide.querySelectorAll('.dish-list li');
      gsap.set(dishes, { opacity: 0, x: -34 });
      tl.to(dishes, { opacity: 1, x: 0, duration: .75, ease: 'expo.out', stagger: .08, clearProps: 'transform,opacity' }, at + .28);
      break;
    }
    case 8: { // RESILIENCE — elastic risk tags, panels slide, red sweep
      keepVisible('.risk-card');
      mark('.risk-tags span');
      const tags = slide.querySelectorAll('.risk-tags span');
      gsap.set(tags, { opacity: 0, scale: .55 });
      tl.to(tags, { opacity: 1, scale: 1, duration: .65, ease: 'elastic.out(1,.6)', stagger: .05, clearProps: 'transform,opacity' }, at + .12);
      const pulse = take('.pulse-panel');
      tl.fromTo(pulse, { opacity: 0, x: 44 }, { opacity: 1, x: 0, duration: .9, ease: 'expo.out' }, at + .24);
      const bridge = take('.bridge-panel');
      tl.fromTo(bridge, { opacity: 0, x: 44 }, { opacity: 1, x: 0, duration: .9, ease: 'expo.out' }, at + .34);
      const foot = take('.resilience__foot');
      tl.fromTo(foot, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .8, ease: 'power2.out' }, at + .65);
      break;
    }
    case 9: { // FUTURE — spring flag disc, rising pillars
      keepVisible('.future__flag');
      mark('.pillar');
      const disc = slide.querySelector('.future__flag span');
      if (disc) {
        gsap.set(disc, { scale: 0 });
        tl.to(disc, { scale: 1, duration: 1.05, ease: 'elastic.out(1,.55)' }, at + .1);
      }
      const pillars = slide.querySelectorAll('.pillar');
      gsap.set(pillars, { opacity: 0, y: 44, rotationX: -45 });
      tl.to(pillars, { opacity: 1, y: 0, rotationX: 0, duration: .9, ease: 'back.out(1.4)', stagger: .08, clearProps: 'transform,opacity' }, at + .32);
      const thanks = take('.future__thanks');
      tl.fromTo(thanks, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .85, ease: 'expo.out' }, at + .6);
      const sources = take('.future__sources');
      tl.fromTo(sources, { opacity: 0 }, { opacity: 1, duration: .9 }, at + .85);
      break;
    }
  }

  // Anything not given a bespoke treatment gets a clean staggered rise.
  const rest = items.filter(el => !used.has(el));
  if (rest.length) {
    tl.fromTo(rest,
      { opacity: 0, y: 28 * dir, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: .85, ease: 'expo.out', stagger: .05, clearProps: 'transform,filter,opacity' },
      at + .05);
  }
}

/* --------------------------------------------------------- state helpers */

function resetSlide(slide) {
  gsap.set(slide, { clearProps: 'transform,filter,opacity,clipPath,zIndex' });
  gsap.set(slide.querySelectorAll('.slide__media, .slide__inner, .tile, .food__photo, .cover__seal, .map-panel'), { clearProps: 'transform,filter,opacity,clipPath' });
  gsap.set(slide.querySelectorAll('.kw-in'), { clearProps: 'transform,opacity' });
  gsap.set(slide.querySelectorAll('[data-anim]'), { clearProps: 'transform,filter,opacity,clipPath' });
  gsap.set(slide.querySelectorAll('.tile .ken, .slide__media .ken'), { clearProps: 'transform' });
  gsap.set(slide.querySelectorAll('[data-bar]'), { clearProps: 'transform' });
  gsap.set(slide.querySelectorAll('.map__river, .map__land, .map__coast'), { clearProps: 'strokeDasharray,strokeDashoffset,opacity' });
  const fill = slide.querySelector('.timeline__fill');
  if (fill) gsap.set(fill, { clearProps: 'transform' });
}

function settleStatic(slide) {
  resetSlide(slide);
  slide.querySelectorAll('[data-count]').forEach(node => { node.textContent = Number(node.dataset.count).toLocaleString('en-US'); });
  slide.querySelectorAll('[data-bar]').forEach(node => gsap.set(node, { scaleX: Number(node.dataset.bar) }));
  slide.querySelectorAll('.tile .ken, .slide__media .ken').forEach(img => gsap.set(img, { scale: 1.04 }));
  const fill = slide.querySelector('.timeline__fill');
  if (fill) gsap.set(fill, { scaleY: 1 });
  slide.querySelectorAll('.river__line').forEach(line => gsap.set(line, { scaleX: 1 }));
  const disc = slide.querySelector('.future__flag span');
  if (disc) gsap.set(disc, { scale: 1 });
  clearFx();
}

function killKen() {
  kenTweens.forEach(tween => tween.kill());
  kenTweens = [];
}
function startKen(slide) {
  if (!motion) return;
  slide.querySelectorAll('.ken').forEach((img, i) => {
    kenTweens.push(gsap.fromTo(img,
      { scale: 1, xPercent: 0 },
      { scale: 1.13, xPercent: -1.1, duration: 15 + i, ease: 'none', yoyo: true, repeat: -1, delay: i * .18 }
    ));
  });
}

/* ------------------------------------------------------------- navigation */

function goTo(target, dirHint) {
  const next = ((target % slides.length) + slides.length) % slides.length;
  if (next === current || locked) return;
  locked = true;

  const dir = dirHint ?? (next > current ? 1 : -1);
  const out = slides[current];
  const incoming = slides[next];
  const fxName = resolveFx(next);

  if (masterTl) masterTl.kill();
  killKen();
  clearFx();
  resetSlide(out);
  resetSlide(incoming);
  document.body.classList.remove('is-warping');

  incoming.classList.add('is-active');
  incoming.setAttribute('aria-hidden', 'false');
  out.setAttribute('aria-hidden', 'true');
  gsap.set(out, { opacity: 1, zIndex: 3 });
  gsap.set(incoming, { zIndex: 4 });

  fxFlash.textContent = `TRANSITION · ${FX_LABELS[fxName]}`;
  fxReadout.textContent = fxSelect.value === 'auto' ? `AUTO · ${fxName.toUpperCase()}` : fxName.toUpperCase();

  let finished = false;
  let failsafe = 0;
  const finish = (forced = false) => {
    if (finished) return;
    finished = true;
    clearTimeout(failsafe);
    if (forced) {
      if (masterTl) masterTl.kill();
      settleStatic(incoming);
    }
    out.classList.remove('is-active');
    resetSlide(out);
    clearFx();
    document.body.classList.remove('is-warping');
    gsap.set(fxFlash, { opacity: 0 });
    if (motion) startKen(incoming);
    locked = false;
  };
  // Real-time safety net: never leave the deck in a half-finished transition.
  failsafe = setTimeout(() => finish(true), 3400);

  current = next;
  slideStart = performance.now();
  syncChrome(current);

  if (!motion) {
    gsap.set(out, { opacity: 0 });
    gsap.set(incoming, { opacity: 1 });
    settleStatic(incoming);
    finish();
    return;
  }

  masterTl = gsap.timeline({ onComplete: finish });
  TRANSITIONS[fxName](masterTl, out, incoming, dir);
  choreograph(masterTl, incoming, next, dir, REVEAL_AT);
  masterTl.fromTo(fxFlash, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: .3, ease: 'power2.out' }, .06)
    .to(fxFlash, { opacity: 0, duration: .4 }, 1.05);
}

/** Intro / re-entry animation without a slide transition. */
function playIntro(slide, index) {
  if (!motion) { settleStatic(slide); return; }
  if (masterTl) masterTl.kill();
  clearFx();
  resetSlide(slide);
  gsap.set(slide, { opacity: 1 });
  masterTl = gsap.timeline({ onComplete: () => { if (motion) startKen(slide); } });
  choreograph(masterTl, slide, index, 1, 0.06);
}

const nextSlide = () => { stopAutoplay(); goTo(current + 1, 1); };
const prevSlide = () => { stopAutoplay(); goTo(current - 1, -1); };

/* --------------------------------------------------------------- autoplay */

function tick(now) {
  if (!autoplay) return;
  const fraction = Math.min(1, (now - slideStart) / SLIDE_MS);
  gsap.set(progressFill, { scaleX: (current + fraction) / slides.length });
  if (fraction >= 1) {
    const target = current + 1;
    slideStart = now;
    if (target >= slides.length) { stopAutoplay(); goTo(0, 1); }
    else goTo(target, 1);
  }
  rafId = requestAnimationFrame(tick);
}
function startAutoplay() {
  if (autoplay) return;
  autoplay = true;
  slideStart = performance.now();
  playBtn.textContent = '❚❚';
  playBtn.setAttribute('aria-pressed', 'true');
  playBtn.setAttribute('aria-label', 'Pause autoplay');
  rafId = requestAnimationFrame(tick);
}
function stopAutoplay() {
  if (!autoplay) return;
  autoplay = false;
  cancelAnimationFrame(rafId);
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.setAttribute('aria-label', 'Start autoplay');
  gsap.set(progressFill, { scaleX: (current + 1) / slides.length });
}
function toggleAutoplay() { autoplay ? stopAutoplay() : startAutoplay(); }

/* ----------------------------------------------------------- interactions */

document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  switch (trigger.dataset.action) {
    case 'next': nextSlide(); break;
    case 'prev': prevSlide(); break;
    case 'autoplay': toggleAutoplay(); break;
    case 'replay': stopAutoplay(); goTo(0, -1); break;
    case 'motion': toggleMotion(); break;
    case 'fullscreen':
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
      break;
  }
});

fxSelect.addEventListener('change', () => {
  fxReadout.textContent = fxSelect.value === 'auto' ? 'AUTO' : fxSelect.value.toUpperCase();
  gsap.fromTo(fxReadout, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' });
});

function toggleMotion() {
  motion = !motion;
  document.documentElement.dataset.motion = motion ? 'on' : 'off';
  motionBtn.innerHTML = `Motion <b>${motion ? 'ON' : 'OFF'}</b>`;
  motionBtn.setAttribute('aria-pressed', String(motion));
  liveLabel.innerHTML = `<i></i> MOTION: ${motion ? 'ON' : 'OFF'}`;
  if (masterTl) masterTl.kill();
  killKen();
  clearFx();
  document.body.classList.remove('is-warping');
  const active = slides[current];
  if (motion) playIntro(active, current);
  else { stopAutoplay(); settleStatic(active); gsap.set(fxFlash, { opacity: 0 }); }
}

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLSelectElement) return;
  switch (event.key) {
    case 'ArrowRight': case 'PageDown': case ' ': case 'Enter':
      event.preventDefault(); nextSlide(); break;
    case 'ArrowLeft': case 'PageUp':
      event.preventDefault(); prevSlide(); break;
    case 'Home': event.preventDefault(); stopAutoplay(); goTo(0, -1); break;
    case 'End': event.preventDefault(); stopAutoplay(); goTo(slides.length - 1, 1); break;
    case 'p': case 'P': toggleAutoplay(); break;
    case 'm': case 'M': toggleMotion(); break;
    case 'f': case 'F': document.documentElement.requestFullscreen?.(); break;
  }
});

stage.addEventListener('wheel', event => {
  if (Math.abs(event.deltaY) < 18 || wheelLock) return;
  event.preventDefault();
  wheelLock = true;
  event.deltaY > 0 ? nextSlide() : prevSlide();
  setTimeout(() => { wheelLock = false; }, 950);
}, { passive: false });

let touchX = 0, touchY = 0;
stage.addEventListener('touchstart', event => {
  touchX = event.changedTouches[0].clientX;
  touchY = event.changedTouches[0].clientY;
}, { passive: true });
stage.addEventListener('touchend', event => {
  const dx = event.changedTouches[0].clientX - touchX;
  const dy = event.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? nextSlide() : prevSlide();
}, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && autoplay) slideStart = performance.now();
});

/* 3D tilt, magnetic controls and cursor halo ------------------------------ */
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const toX = gsap.quickTo(cursor, 'x', { duration: .45, ease: 'power3.out' });
  const toY = gsap.quickTo(cursor, 'y', { duration: .45, ease: 'power3.out' });
  gsap.set(cursor, { xPercent: -50, yPercent: -50 });
  window.addEventListener('pointermove', event => {
    toX(event.clientX); toY(event.clientY);
    if (motion) gsap.to(cursor, { opacity: .9, duration: .4 });
  });
  document.querySelectorAll('.tilt').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!motion || !card.closest('.slide')?.classList.contains('is-active')) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - .5;
      const py = (event.clientY - rect.top) / rect.height - .5;
      gsap.to(card, { rotateY: px * 8, rotateX: -py * 8, scale: 1.012, duration: .5, ease: 'power2.out', transformPerspective: 900, overwrite: 'auto' });
    });
    card.addEventListener('pointerleave', () => gsap.to(card, { rotateY: 0, rotateX: 0, scale: 1, duration: .6, ease: 'power2.out', overwrite: 'auto' }));
  });
  document.querySelectorAll('.hud-btn, .ghost-btn, .replay-btn').forEach(btn => {
    btn.addEventListener('pointermove', event => {
      if (!motion) return;
      const rect = btn.getBoundingClientRect();
      gsap.to(btn, { x: (event.clientX - rect.left - rect.width / 2) * .18, y: (event.clientY - rect.top - rect.height / 2) * .18, duration: .3, overwrite: 'auto' });
    });
    btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: .4, overwrite: 'auto' }));
  });
}

/* ---------------------------------------------------------- particle field */
const ctx = canvas.getContext('2d');
let particles = [];
let particleRaf = 0;
let particleLast = 0;

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  particles = Array.from({ length: Math.min(90, Math.round(innerWidth / 18)) }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 1.6 + .4,
    vx: (Math.random() - .5) * .18,
    vy: -(Math.random() * .22 + .05),
    a: Math.random() * .5 + .12,
    tint: Math.random() > .82 ? '#f5c451' : (Math.random() > .5 ? '#22d3ee' : '#17c47c'),
  }));
}
function drawParticles(now) {
  particleRaf = requestAnimationFrame(drawParticles);
  if (now - particleLast < 33) return;
  particleLast = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.y < -10) { p.y = innerHeight + 10; p.x = Math.random() * innerWidth; }
    if (p.x < -10) p.x = innerWidth + 10;
    if (p.x > innerWidth + 10) p.x = -10;
    ctx.globalAlpha = p.a;
    ctx.fillStyle = p.tint;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function startParticles() {
  if (!motion || particleRaf) return;
  resizeCanvas();
  particleRaf = requestAnimationFrame(drawParticles);
}
window.addEventListener('resize', () => { if (motion) resizeCanvas(); });

/* -------------------------------------------------------------------- boot */
document.documentElement.dataset.motion = motion ? 'on' : 'off';
motionBtn.innerHTML = `Motion <b>${motion ? 'ON' : 'OFF'}</b>`;
motionBtn.setAttribute('aria-pressed', String(motion));
liveLabel.innerHTML = `<i></i> MOTION: ${motion ? 'ON' : 'OFF'}`;
syncChrome(0);
if (motion) { playIntro(slides[0], 0); startParticles(); }
else settleStatic(slides[0]);
