/**
 * BANGLADESH — HYPER DECK
 * A ten-slide, GSAP-driven cinematic presentation engine.
 *
 * Design rules:
 *  - All visible content lives in bangladesh.html. If JS fails, the first
 *    slide is still a complete, readable page.
 *  - Nothing is hidden in CSS by default, so "motion off" needs no cleanup
 *    beyond GSAP tweens: the slide simply renders in its final state.
 *  - Every animation is opt-out via the Motion toggle / reduced-motion query.
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

const slides = [...document.querySelectorAll('.slide')];
const stage = document.getElementById('stage');
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

const SLIDE_MS = 9000;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let motion = !prefersReduced;
let current = 0;
let locked = false;
let autoplay = false;
let slideStart = performance.now();
let kenTweens = [];
let rafId = 0;
let wheelLock = false;

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

/* --------------------------------------------------------------- animation */

function killKen() {
  kenTweens.forEach(tween => tween.kill());
  kenTweens = [];
}

function startKen(slide) {
  if (!motion) return;
  slide.querySelectorAll('.ken').forEach((img, i) => {
    kenTweens.push(gsap.fromTo(img,
      { scale: 1.02, xPercent: 0 },
      { scale: 1.14, xPercent: -1.2, duration: 15 + i, ease: 'none', yoyo: true, repeat: -1, delay: i * .18 }
    ));
  });
}

function settleStatic(slide) {
  // Final states for everything GSAP would otherwise animate in.
  slide.querySelectorAll('[data-count]').forEach(node => {
    const target = Number(node.dataset.count);
    node.textContent = target.toLocaleString('en-US');
  });
  slide.querySelectorAll('[data-bar]').forEach(node => gsap.set(node, { scaleX: Number(node.dataset.bar) }));
  slide.querySelectorAll('.map__river, .map__land, .map__coast').forEach(path => gsap.set(path, { strokeDashoffset: 0, opacity: 1 }));
  const fill = slide.querySelector('.timeline__fill');
  if (fill) gsap.set(fill, { scaleY: 1 });
  slide.querySelectorAll('.river__line').forEach(line => gsap.set(line, { scaleX: 1 }));
  const flag = slide.querySelector('.future__flag span');
  if (flag) gsap.set(flag, { scale: 1 });
  slide.querySelectorAll('.ken').forEach(img => gsap.set(img, { scale: 1.04 }));
  slide.querySelectorAll('[data-anim]').forEach(node => gsap.set(node, { clearProps: 'all' }));
}

function animateIn(slide, dir) {
  const items = slide.querySelectorAll('[data-anim]');
  gsap.set(items, { opacity: 0, y: 28 * dir, rotateX: -7, filter: 'blur(7px)' });
  gsap.to(items, {
    opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)',
    duration: .85, ease: 'power3.out', stagger: .055, delay: .14,
    clearProps: 'filter,transform',
  });

  // Number counters -------------------------------------------------------
  slide.querySelectorAll('[data-count]').forEach(node => {
    const target = Number(node.dataset.count);
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: target, duration: 1.5, ease: 'power2.out', delay: .35,
      onUpdate: () => { node.textContent = Math.round(proxy.v).toLocaleString('en-US'); },
      onComplete: () => { node.textContent = target.toLocaleString('en-US'); },
    });
  });

  // Bars & linear reveals -------------------------------------------------
  const bars = slide.querySelectorAll('[data-bar]');
  if (bars.length) {
    gsap.fromTo(bars, { scaleX: 0 }, { scaleX: i => Number(bars[i].dataset.bar), duration: 1.25, ease: 'power3.out', delay: .45, stagger: .1 });
  }
  const riverLines = slide.querySelectorAll('.river__line');
  if (riverLines.length) gsap.fromTo(riverLines, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.out', delay: .5, stagger: .14 });

  // SVG map draw-on -------------------------------------------------------
  const paths = slide.querySelectorAll('.map__river, .map__land, .map__coast');
  paths.forEach((path, i) => {
    let length = 1000;
    try { length = path.getTotalLength(); } catch { /* SVG not measurable. */ }
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length, opacity: 1 });
    gsap.to(path, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', delay: .35 + i * .12 });
  });

  // Timeline spine --------------------------------------------------------
  const fill = slide.querySelector('.timeline__fill');
  if (fill) gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: 1.6, ease: 'power2.inOut', delay: .4 });

  // Flag disc -------------------------------------------------------------
  const flag = slide.querySelector('.future__flag span');
  if (flag) gsap.fromTo(flag, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: 'back.out(1.9)', delay: .6 });
}

function goTo(target, dirHint) {
  const next = ((target % slides.length) + slides.length) % slides.length;
  if (next === current || locked) return;
  locked = true;
  const dir = dirHint ?? (next > current ? 1 : -1);
  const prev = slides[current];
  const incoming = slides[next];

  killKen();
  gsap.killTweensOf([prev, incoming]);
  incoming.classList.add('is-active');
  incoming.setAttribute('aria-hidden', 'false');
  prev.setAttribute('aria-hidden', 'true');

  if (motion) {
    gsap.set(prev, { opacity: 1, xPercent: 0 });
    gsap.set(incoming, { opacity: 0, xPercent: 7 * dir });
    gsap.to(prev, { opacity: 0, xPercent: -6 * dir, duration: .55, ease: 'power2.inOut' });
    gsap.to(incoming, { opacity: 1, xPercent: 0, duration: .72, ease: 'power3.out' });
    gsap.fromTo(warp,
      { opacity: 0, scaleX: .35 },
      { opacity: .75, scaleX: 1, duration: .22, ease: 'power1.out', yoyo: true, repeat: 1 }
    );
    animateIn(incoming, dir);
    startKen(incoming);
  } else {
    gsap.set(prev, { opacity: 0, xPercent: 0 });
    gsap.set(incoming, { opacity: 1, xPercent: 0 });
    settleStatic(incoming);
  }

  current = next;
  slideStart = performance.now();
  syncChrome(current);

  const finish = () => {
    prev.classList.remove('is-active');
    gsap.set(prev, { clearProps: 'all' });
    gsap.set(prev.querySelectorAll('[data-anim]'), { clearProps: 'all' });
    gsap.set(prev.querySelectorAll('.ken'), { clearProps: 'transform' });
    locked = false;
  };
  if (motion) gsap.delayedCall(.62, finish);
  else finish();
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

/* -------------------------------------------------------- interactions */

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

function toggleMotion() {
  motion = !motion;
  document.documentElement.dataset.motion = motion ? 'on' : 'off';
  motionBtn.innerHTML = `Motion <b>${motion ? 'ON' : 'OFF'}</b>`;
  motionBtn.setAttribute('aria-pressed', String(motion));
  liveLabel.innerHTML = `<i></i> MOTION: ${motion ? 'ON' : 'OFF'}`;

  const active = slides[current];
  gsap.killTweensOf(active.querySelectorAll('[data-anim]'));
  killKen();
  if (motion) {
    animateIn(active, 1);
    startKen(active);
    startParticles();
  } else {
    cancelAnimationFrame(particleRaf);
    active.querySelectorAll('[data-anim]').forEach(node => gsap.set(node, { clearProps: 'all' }));
    settleStatic(active);
  }
}

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
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
  setTimeout(() => { wheelLock = false; }, 850);
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
if (motion) {
  animateIn(slides[0], 1);
  startKen(slides[0]);
  startParticles();
} else {
  settleStatic(slides[0]);
}
