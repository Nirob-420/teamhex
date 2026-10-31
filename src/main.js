import './style.css';
import './experience.css';
import './studio.css';
import './nightops.css';
import './hyper.css';
import './pro.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { initVisitorCounter } from './visitors.js';
import Lenis from 'lenis';
import {
  createIcons, Activity, ArrowUpRight, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  Play, Crosshair, MousePointer2, ShieldCheck, Shield, ShieldPlus, Users, Flame,
  Clapperboard, Images, Radio, Youtube, ScanSearch, ChevronsUp, Gamepad2,
  Fingerprint, LockKeyhole, MessageCircle, Facebook, Mail, ExternalLink,
  Search, Bookmark, BookmarkCheck, Share2, Link2, Check, Keyboard, Pause, Download, WifiOff, Wifi, Trash2,
  MailCheck, X, Minus, Plus, RotateCcw, ScanLine, Bomb, Zap, ScanEye, Orbit, Move3d, Layers3
} from 'lucide';
import { players, videos, gallery, links } from './data.js';
import { savedOperators, drafts } from './store.js';
import { initPro, toast, shareOrCopy } from './pro.js';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);
const icons = { Activity, ArrowUpRight, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Play, Crosshair, MousePointer2, ShieldCheck, Shield, ShieldPlus, Users, Flame, Clapperboard, Images, Radio, Youtube, ScanSearch, ChevronsUp, Gamepad2, Fingerprint, LockKeyhole, MessageCircle, Facebook, Mail, ExternalLink, MailCheck, X, Minus, Plus, RotateCcw, ScanLine, Bomb, Zap, ScanEye, Orbit, Move3d, Layers3, Search, Bookmark, BookmarkCheck, Share2, Link2, Check, Keyboard, Pause, Download, WifiOff, Wifi, Trash2 };
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pad = n => String(n).padStart(2, '0');
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing is supported. */ } }
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let motionEnabled = storage.get('hex-motion') === 'off' ? false : !reducedMotion.matches;
let lenis = null;
let motionContext = null;
let introTimeline = null;
let cursorX, cursorY;
let world = null;
let motionMedia = null;
let textSplits = [];
let rosterTriggers = [];
let squadScrollTrigger = null;
let squadScrollTween = null;
const marqueeState = { speed: 1 };
let scrollVelocity = 0, velocityTimer = 0;
const ticker = time => lenis?.raf(time * 1000);

/* Real roster, real match films, original team photography. */
let rosterFilter = 'all';
function updateSavedCount() {
  const counter = $('#saved-count');
  if (counter) counter.textContent = pad(savedOperators.count());
}
function syncSavedBadges() {
  $$('.player-card').forEach(card => {
    const isSaved = savedOperators.has(card.dataset.player);
    const badge = $('.card-saved', card);
    if (isSaved && !badge) {
      const mark = document.createElement('span');
      mark.className = 'card-saved';
      mark.innerHTML = '<i data-lucide="bookmark-check"></i>SAVED';
      card.append(mark);
    } else if (!isSaved && badge) badge.remove();
  });
  refreshIcons();
}
function renderRoster(filter = 'all', animate = false) {
  rosterFilter = filter;
  const visible = filter === 'saved'
    ? players.filter(player => savedOperators.has(player.id))
    : players.filter(player => filter === 'all' || player.group === filter);
  updateSavedCount();
  const grid = $('#roster-grid');
  grid.setAttribute('aria-busy', 'true');
  gsap.killTweensOf('.player-card');
  grid.innerHTML = visible.length ? visible.map(player => `
    <button class="player-card" data-cursor="VIEW" data-player="${player.id}" aria-label="View ${player.name}, ${player.ign}, ${player.role}">
      <span class="player-card-top"><span class="role-badge"><i data-lucide="${player.icon}"></i>${player.role}</span><span class="card-number">/${player.number}</span></span>
      <img src="/images/${player.id}.webp" alt="${player.name} in the TEAM HEX jersey" width="725" height="1150" loading="lazy" decoding="async" />
      <span class="card-holo" aria-hidden="true"></span><span class="player-card-shade"></span><span class="card-view">VIEW OPERATOR PROFILE</span>${savedOperators.has(player.id) ? '<span class="card-saved"><i data-lucide="bookmark-check"></i>SAVED</span>' : ''}
      <span class="player-card-content"><span><span class="player-card-ign">${player.ign}</span><span class="player-card-name">${player.name}</span></span><span class="card-arrow"><i data-lucide="arrow-up-right"></i></span></span>
    </button>`).join('') : '<p class="roster-empty">NO SAVED OPERATORS YET.<br />Open any player profile and choose SAVE OPERATOR. Saved players stay on this device only — nothing is uploaded.</p>';
  grid.setAttribute('aria-busy', 'false');
  $('#roster-status').textContent = `${visible.length} ${visible.length === 1 ? 'player' : 'players'} shown.`;
  refreshIcons();
  rosterTriggers.forEach(trigger => trigger.kill()); rosterTriggers = [];
  if (motionEnabled && animate) gsap.fromTo(grid.children, { opacity: 0, y: 28, scale: .985 }, { opacity: 1, y: 0, scale: 1, duration: .55, stagger: .055, ease: 'power3.out', clearProps: 'transform,opacity' });
  requestAnimationFrame(syncRosterRail);
  ScrollTrigger.refresh();
}

function syncRosterRail() {
  const rail = $('#roster-grid');
  const max = rail.scrollWidth - rail.clientWidth;
  const progress = max > 0 ? rail.scrollLeft / max : 0;
  $('#roster-progress').style.transform = `scaleX(${Math.max(.04, progress)})`;
  $('#roster-prev').disabled = rail.scrollLeft <= 4;
  $('#roster-next').disabled = rail.scrollLeft >= max - 4;
  if (squadScrollTrigger) updateSquadFocus();
}
function updateSquadFocus() {
  const rail = $('#roster-grid');
  const cards = $$('.player-card', rail);
  if (!cards.length) return;
  const railRect = rail.getBoundingClientRect();
  const center = railRect.left + railRect.width / 2;
  let best = 0, bestDist = Infinity;
  cards.forEach((card, i) => {
    const rect = card.getBoundingClientRect();
    const dist = Math.abs(rect.left + rect.width / 2 - center);
    const focus = gsap.utils.clamp(0, 1, 1 - dist / (railRect.width * .75));
    card.style.setProperty('--squad-focus', focus.toFixed(3));
    card.style.setProperty('--squad-lift', `${((1 - focus) * 14).toFixed(2)}px`);
    card.style.setProperty('--squad-scale', (0.96 + focus * 0.06).toFixed(3));
    card.style.setProperty('--squad-sat', (0.7 + focus * 0.4).toFixed(3));
    card.classList.toggle('is-squad-focus', focus > .55);
    if (dist < bestDist) { bestDist = dist; best = i; }
  });
  const max = rail.scrollWidth - rail.clientWidth;
  const progress = max > 0 ? rail.scrollLeft / max : 0;
  const hudIndex = Math.round(progress * (cards.length - 1));
  const player = players.find(item => item.id === cards[hudIndex].dataset.player);
  const hud = $('#squad-active');
  if (hud && player) hud.textContent = `${pad(hudIndex + 1)} / ${pad(cards.length)} — ${player.ign}`;
}
function scrollRoster(direction) {
  const rail = $('#roster-grid');
  const card = rail.querySelector('.player-card');
  const amount = card ? card.getBoundingClientRect().width + 24 : rail.clientWidth * .8;
  if (squadScrollTrigger && motionEnabled) {
    const max = rail.scrollWidth - rail.clientWidth;
    const target = gsap.utils.clamp(0, max, rail.scrollLeft + direction * amount);
    const progress = max > 0 ? target / max : 0;
    const y = squadScrollTrigger.start + progress * (squadScrollTrigger.end - squadScrollTrigger.start);
    if (lenis) lenis.scrollTo(y, { duration: .6 }); else window.scrollTo({ top: y, behavior: 'smooth' });
    return;
  }
  rail.scrollBy({ left: direction * amount, behavior: motionEnabled ? 'smooth' : 'auto' });
}
$('#roster-prev').addEventListener('click', () => scrollRoster(-1));
$('#roster-next').addEventListener('click', () => scrollRoster(1));
$('#roster-grid').addEventListener('scroll', syncRosterRail, { passive: true });
new ResizeObserver(syncRosterRail).observe($('#roster-grid'));
let rosterDrag = null;
$('#roster-grid').addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  rosterDrag = { x: event.clientX, left: $('#roster-grid').scrollLeft, moved: false, pinned: Boolean(squadScrollTrigger && motionEnabled), scrollY: window.scrollY };
});
addEventListener('pointermove', event => {
  if (!rosterDrag) return;
  const dx = event.clientX - rosterDrag.x;
  if (Math.abs(dx) > 6) rosterDrag.moved = true;
  if (rosterDrag.pinned && squadScrollTrigger) {
    const rail = $('#roster-grid');
    const max = rail.scrollWidth - rail.clientWidth;
    if (max <= 0) return;
    const distance = squadScrollTrigger.end - squadScrollTrigger.start;
    const y = rosterDrag.scrollY - dx * (distance / max);
    if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    return;
  }
  $('#roster-grid').scrollLeft = rosterDrag.left - dx;
});
addEventListener('pointerup', () => { setTimeout(() => { rosterDrag = null; }, 0); });
$('#roster-grid').addEventListener('click', event => { if (rosterDrag?.moved) { event.preventDefault(); event.stopPropagation(); } }, true);
$('#roster-grid').addEventListener('focusin', event => {
  const card = event.target.closest('.player-card');
  if (!card || !squadScrollTrigger || !motionEnabled) return;
  const rail = $('#roster-grid');
  const max = rail.scrollWidth - rail.clientWidth;
  if (max <= 0) return;
  const railRect = rail.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const target = gsap.utils.clamp(0, max, rail.scrollLeft + cardRect.left - railRect.left - (railRect.width - cardRect.width) / 2);
  const y = squadScrollTrigger.start + (target / max) * (squadScrollTrigger.end - squadScrollTrigger.start);
  if (lenis) lenis.scrollTo(y, { duration: .45 }); else window.scrollTo({ top: y, behavior: 'smooth' });
});

function renderPlaylist() {
  $('#video-playlist').innerHTML = videos.map((video, i) => `
    <button class="playlist-item ${i === 0 ? 'is-active' : ''}" data-select-video="${video.id}" aria-pressed="${i === 0}" aria-label="Select ${video.title}">
      <span class="playlist-number">${pad(i + 1)}</span><img src="/images/${video.id}.webp" alt="" width="160" height="90" loading="lazy" />
      <span><span class="playlist-category">${video.category}</span><span class="playlist-title">${video.title}</span></span>
    </button>`).join('');
}

function renderGallery() {
  $('#gallery-grid').innerHTML = gallery.map((image, i) => `
    <button class="gallery-item ${image.fit === 'contain' ? 'is-brand' : ''}" data-cursor="OPEN" data-gallery="${i}" aria-label="Open ${image.title}">
      <img src="/images/${image.src}.webp" alt="${image.title} — TEAM HEX Free Fire archive" width="1440" height="648" loading="lazy" />
      <span class="gallery-index" aria-hidden="true">${pad(i + 1)}</span>
      <span class="gallery-caption"><small>${image.subtitle}</small><strong>${image.title}</strong><i data-lucide="scan-search"></i></span>
    </button>`).join('');
}
function syncGalleryRail() {
  const rail = $('#gallery-grid');
  const max = rail.scrollWidth - rail.clientWidth;
  const progress = max > 0 ? rail.scrollLeft / max : 0;
  $('#gallery-progress').style.transform = `scaleX(${Math.max(.04, progress)})`;
  $('#gallery-rail-prev').disabled = rail.scrollLeft <= 4;
  $('#gallery-rail-next').disabled = rail.scrollLeft >= max - 4;
}
function scrollGalleryRail(direction) {
  const rail = $('#gallery-grid');
  const card = rail.querySelector('.gallery-item');
  const amount = card ? card.getBoundingClientRect().width + 20 : rail.clientWidth * .8;
  rail.scrollBy({ left: direction * amount, behavior: motionEnabled ? 'smooth' : 'auto' });
}
$('#gallery-rail-prev').addEventListener('click', () => scrollGalleryRail(-1));
$('#gallery-rail-next').addEventListener('click', () => scrollGalleryRail(1));
$('#gallery-grid').addEventListener('scroll', syncGalleryRail, { passive: true });
new ResizeObserver(syncGalleryRail).observe($('#gallery-grid'));
let galleryDrag = null;
$('#gallery-grid').addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  galleryDrag = { x: event.clientX, left: $('#gallery-grid').scrollLeft, moved: false };
});
addEventListener('pointermove', event => {
  if (!galleryDrag) return;
  const dx = event.clientX - galleryDrag.x;
  if (Math.abs(dx) > 6) galleryDrag.moved = true;
  $('#gallery-grid').scrollLeft = galleryDrag.left - dx;
});
addEventListener('pointerup', () => { setTimeout(() => { galleryDrag = null; }, 0); });
$('#gallery-grid').addEventListener('click', event => { if (galleryDrag?.moved) { event.preventDefault(); event.stopPropagation(); } }, true);

renderRoster();
renderPlaylist();
renderGallery();
requestAnimationFrame(syncGalleryRail);
refreshIcons();
$('#current-year').textContent = new Date().getFullYear();

/* Native dialogs provide focus trapping, Escape support, and focus restoration. */
function syncDialogLock() {
  const anyOpen = $$('dialog[open]').length > 0;
  document.body.classList.toggle('modal-open', anyOpen);
  if (anyOpen) lenis?.stop(); else lenis?.start();
}
function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  syncDialogLock();
}
function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
  syncDialogLock();
}
$$('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (dialog.id === 'video-dialog') $('#video-frame').replaceChildren();
    if (dialog.id === 'gallery-dialog') setSlideshow(false);
    if (dialog.id === 'mobile-menu') $('#menu-toggle').setAttribute('aria-expanded', 'false');
    syncDialogLock();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  });
});
$('#menu-toggle').addEventListener('click', () => {
  $('#menu-toggle').setAttribute('aria-expanded', 'true');
  openDialog($('#mobile-menu'));
});

function goToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  $$('dialog[open]').forEach(closeDialog);
  if (lenis && motionEnabled) lenis.scrollTo(target, { offset: -84, duration: 1.15 });
  else target.scrollIntoView({ behavior: 'auto', block: 'start' });
  try { history.replaceState(null, '', `#${id}`); } catch { /* Sandboxed previews may disallow history updates. */ }
}

function selectVideo(id) {
  const index = videos.findIndex(video => video.id === id);
  if (index < 0) return;
  const video = videos[index];
  $('#feature-video').dataset.video = id;
  $('#feature-video').setAttribute('aria-label', `Play ${video.fullTitle}`);
  $('#feature-thumbnail').src = `/images/${id}.webp`;
  $('#feature-thumbnail').alt = `${video.title} match thumbnail`;
  $('#feature-title').innerHTML = video.display;
  $('.feature-video-caption>small').textContent = `TEAM HEX / MATCH FILM ${pad(index + 1)}`;
  $$('.playlist-item').forEach(button => {
    const active = button.dataset.selectVideo === id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (motionEnabled) gsap.fromTo('#feature-thumbnail', { opacity: .45, scale: 1.035 }, { opacity: 1, scale: 1, duration: .5, ease: 'power2.out' });
}

function openVideo(id) {
  const video = videos.find(item => item.id === id);
  if (!video) return;
  $('#video-dialog-title').textContent = video.title;
  $('#video-external').href = `https://www.youtube.com/watch?v=${id}`;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  iframe.title = video.fullTitle;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  $('#video-frame').replaceChildren(iframe);
  openDialog($('#video-dialog'));
}

let currentPlayer = 0;
function showPlayer(id) {
  const index = players.findIndex(player => player.id === id);
  if (index < 0) return;
  currentPlayer = index;
  const player = players[index];
  $('#player-dialog-content').innerHTML = `<div class="player-detail">
    <div class="player-detail-visual"><span class="player-detail-back" aria-hidden="true">${player.name}</span><img src="/images/${player.id}.webp" alt="${player.name}, ${player.role}" /><span class="role-badge"><i data-lucide="${player.icon}"></i>${player.role}</span></div>
    <div class="player-detail-info"><p class="eyebrow">OPERATOR ${player.number} / TEAM HEX</p><h2 id="player-dialog-name" tabindex="-1">${player.name}</h2><p class="player-detail-ign">${player.ign}</p><p class="player-detail-tagline">${player.tagline}</p>${player.bio.map(paragraph => `<p class="player-detail-bio">${paragraph}</p>`).join('')}
    <div class="player-detail-actions"><button class="pro-button" data-save-player="${player.id}" aria-pressed="${savedOperators.has(player.id)}"><i data-lucide="${savedOperators.has(player.id) ? 'bookmark-check' : 'bookmark'}"></i> ${savedOperators.has(player.id) ? 'SAVED ON THIS DEVICE' : 'SAVE OPERATOR'}</button><button class="pro-button" data-share-player="${player.id}"><i data-lucide="share-2"></i> SHARE PROFILE</button></div>
    <div class="player-detail-nav"><button data-player-direction="-1" aria-label="Previous player"><i data-lucide="arrow-left"></i> PREVIOUS</button><span>${player.number} / 06</span><button data-player-direction="1" aria-label="Next player">NEXT <i data-lucide="arrow-right"></i></button></div></div></div>`;
  refreshIcons();
  openDialog($('#player-dialog'));
  if (motionEnabled) gsap.fromTo('.player-detail-info', { opacity: 0, x: 15 }, { opacity: 1, x: 0, duration: .4, ease: 'power2.out' });
  else $('#player-dialog-name').focus({ preventScroll: true });
}

/* Gallery: keyboard navigation, zoom, reset, and drag-to-pan. */
let galleryIndex = 0, zoom = 1, panX = 0, panY = 0, drag = null;
const galleryDialog = $('#gallery-dialog');
const lightboxStage = $('#lightbox-stage');
const lightboxImage = $('#lightbox-image');
function updateZoom() {
  const maxX = Math.max(0, lightboxImage.clientWidth * (zoom - 1) / 2);
  const maxY = Math.max(0, lightboxImage.clientHeight * (zoom - 1) / 2);
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
  lightboxImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  $('#zoom-level').value = `${Math.round(zoom * 100)}%`;
  $('#zoom-out').disabled = zoom <= 1;
  $('#zoom-in').disabled = zoom >= 3;
  lightboxStage.classList.toggle('is-zoomed', zoom > 1);
}
function resetZoom() { zoom = 1; panX = 0; panY = 0; updateZoom(); }
function showGalleryImage(index) {
  galleryIndex = (index + gallery.length) % gallery.length;
  const image = gallery[galleryIndex];
  lightboxImage.src = `/images/${image.src}.webp`;
  lightboxImage.alt = `${image.title} — TEAM HEX Free Fire archive`;
  $('#lightbox-caption').textContent = `${pad(galleryIndex + 1)} / ${pad(gallery.length)} — ${image.title}`;
  const download = $('#lightbox-download');
  download.href = `/images/${image.src}.webp`;
  download.download = `team-hex-${image.src}.webp`;
  download.setAttribute('aria-label', `Download ${image.title}`);
  resetZoom();
}
function openGallery(index) {
  showGalleryImage(index);
  openDialog(galleryDialog);
  requestAnimationFrame(updateZoom);
}
$('#gallery-prev').addEventListener('click', () => showGalleryImage(galleryIndex - 1));
$('#gallery-next').addEventListener('click', () => showGalleryImage(galleryIndex + 1));
$('#zoom-in').addEventListener('click', () => { zoom = Math.min(3, zoom + .25); updateZoom(); });
$('#zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom - .25); updateZoom(); });
$('#zoom-reset').addEventListener('click', resetZoom);
let slideshowTimer = null;
function setSlideshow(on) {
  const button = $('#slideshow-toggle');
  if (on && !slideshowTimer) {
    slideshowTimer = setInterval(() => showGalleryImage(galleryIndex + 1), 3000);
    button.innerHTML = '<i data-lucide="pause"></i>';
    toast('Archive slideshow started.', 'play');
  } else if (!on && slideshowTimer) {
    clearInterval(slideshowTimer); slideshowTimer = null;
    button.innerHTML = '<i data-lucide="play"></i>';
  } else return;
  button.setAttribute('aria-pressed', String(Boolean(slideshowTimer)));
  button.setAttribute('aria-label', slideshowTimer ? 'Pause archive slideshow' : 'Play archive slideshow');
  refreshIcons();
}
$('#slideshow-toggle').addEventListener('click', () => setSlideshow(!slideshowTimer));
document.addEventListener('visibilitychange', () => { if (document.hidden) setSlideshow(false); });
lightboxImage.addEventListener('load', updateZoom);
lightboxStage.addEventListener('pointerdown', event => {
  if (zoom <= 1) return;
  drag = { x: event.clientX, y: event.clientY, panX, panY };
  lightboxStage.setPointerCapture(event.pointerId);
  lightboxStage.classList.add('is-dragging');
});
lightboxStage.addEventListener('pointermove', event => {
  if (!drag) return;
  panX = drag.panX + event.clientX - drag.x;
  panY = drag.panY + event.clientY - drag.y;
  updateZoom();
});
function endDrag() { drag = null; lightboxStage.classList.remove('is-dragging'); }
lightboxStage.addEventListener('pointerup', endDrag);
lightboxStage.addEventListener('pointercancel', endDrag);
galleryDialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); showGalleryImage(galleryIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showGalleryImage(galleryIndex + 1); }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom = Math.min(3, zoom + .25); updateZoom(); }
  if (event.key === '-') { event.preventDefault(); zoom = Math.max(1, zoom - .25); updateZoom(); }
  if (event.key === '0') { event.preventDefault(); resetZoom(); }
});

/* One delegated click layer keeps dynamically rendered controls working. */
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { closeDialog(close.closest('dialog')); return; }
  const player = event.target.closest('[data-player]');
  if (player) { showPlayer(player.dataset.player); return; }
  const saveButton = event.target.closest('[data-save-player]');
  if (saveButton) {
    const id = saveButton.dataset.savePlayer;
    const isSaved = savedOperators.toggle(id);
    const operator = players.find(item => item.id === id);
    saveButton.setAttribute('aria-pressed', String(isSaved));
    saveButton.innerHTML = `<i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}"></i> ${isSaved ? 'SAVED ON THIS DEVICE' : 'SAVE OPERATOR'}`;
    refreshIcons();
    toast(isSaved ? `${operator.name} saved on this device.` : `${operator.name} removed from saved.`, isSaved ? 'bookmark-check' : 'bookmark');
    return;
  }
  const shareButton = event.target.closest('[data-share-player]');
  if (shareButton) {
    const operator = players.find(item => item.id === shareButton.dataset.sharePlayer);
    shareOrCopy({ title: `${operator.name} — TEAM HEX`, text: `${operator.name} (${operator.ign}) — ${operator.role} of TEAM HEX.`, url: `${location.origin}${location.pathname}?player=${operator.id}#squad` });
    return;
  }
  const discardButton = event.target.closest('[data-discard-draft]');
  if (discardButton) { clearDraft(discardButton.dataset.discardDraft); toast('Draft discarded from this device.', 'trash-2'); return; }
  const playerDirection = event.target.closest('[data-player-direction]');
  if (playerDirection) {
    showPlayer(players[(currentPlayer + Number(playerDirection.dataset.playerDirection) + players.length) % players.length].id);
    $('#player-dialog-name').focus({ preventScroll: true });
    return;
  }
  const video = event.target.closest('[data-video]');
  if (video) { openVideo(video.dataset.video); return; }
  const selected = event.target.closest('[data-select-video]');
  if (selected) { selectVideo(selected.dataset.selectVideo); return; }
  const galleryButton = event.target.closest('[data-gallery]');
  if (galleryButton) { openGallery(Number(galleryButton.dataset.gallery)); return; }
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    const id = anchor.getAttribute('href').slice(1);
    if (document.getElementById(id)) { event.preventDefault(); goToSection(id); }
  }
});
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  $$('[data-filter]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  $('#roster-grid').scrollLeft = 0;
  renderRoster(button.dataset.filter, true);
}));
function switchMediaTab(button) {
  $$('[data-media-tab]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const films = button.dataset.mediaTab === 'films';
  $('#films-panel').hidden = !films;
  $('#gallery-panel').hidden = films;
  if (!films) requestAnimationFrame(syncGalleryRail);
  if (motionEnabled) gsap.fromTo(films ? '#films-panel' : '#gallery-panel', { opacity: 0, y: 28, rotationY: -5, transformPerspective: 1200 }, { opacity: 1, y: 0, rotationY: 0, duration: .65, clearProps: 'transform,opacity' });
  ScrollTrigger.refresh();
}
$$('[data-media-tab]').forEach((button, index, tabs) => {
  button.addEventListener('click', () => switchMediaTab(button));
  button.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = tabs[1 - index];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (next) { event.preventDefault(); switchMediaTab(next); next.focus(); }
  });
});

/* Recruitment follows the original thresholds, without pretending to submit data. */
const joinForm = $('#join-form');
joinForm.addEventListener('input', event => {
  if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  $('#join-result').hidden = true;
});
joinForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#join-name').value.trim();
  $('#join-name').setCustomValidity(name.length >= 2 ? '' : 'Please enter your name or call sign.');
  if (!joinForm.reportValidity()) return;
  const level = Number($('#join-level').value);
  const years = Number($('#join-years').value);
  if (!Number.isFinite(level) || !Number.isInteger(level) || level < 1 || !Number.isFinite(years) || years < 0) return;
  const eligible = level > 45 && years > 2;
  const result = $('#join-result');
  result.className = `join-result ${eligible ? 'success' : ''}`;
  result.innerHTML = eligible
    ? `<h4>YOU MEET THE REQUIREMENTS.</h4><p>Your level and experience meet the original direct-entry criteria. Open our Free Fire clan page to take the next step.</p><a class="button button-blue" href="${links.clan}" target="_blank" rel="noopener noreferrer">OPEN FREE FIRE CLAN <i data-lucide="arrow-up-right"></i></a><p class="result-note">This is an eligibility check, not a roster confirmation. No application has been sent or stored.</p>`
    : `<h4>KEEP BUILDING. STAY CONNECTED.</h4><p>Direct entry requires a level above 45 and more than 2 years of experience. You can still meet the squad and ask about opportunities in our community.</p><a class="button button-blue" href="${links.community}" target="_blank" rel="noopener noreferrer">JOIN THE WHATSAPP COMMUNITY <i data-lucide="arrow-up-right"></i></a><p class="result-note">This check only runs on your device. No application has been sent or stored.</p>`;
  result.hidden = false;
  result.tabIndex = -1;
  refreshIcons();
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'nearest' });
  if (motionEnabled) gsap.fromTo(result, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 });
});

/* Contact opens a real, prefilled email draft. Nothing is silently sent. */
const contactForm = $('#contact-form');
contactForm.addEventListener('input', event => {
  if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  $('#contact-result').hidden = true;
});
contactForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#contact-name').value.trim();
  const email = $('#contact-email').value.trim();
  const subject = $('#contact-subject').value.trim();
  const message = $('#contact-message').value.trim();
  $('#contact-name').setCustomValidity(name ? '' : 'Please enter your name.');
  $('#contact-subject').setCustomValidity(subject ? '' : 'Please enter a subject.');
  $('#contact-message').setCustomValidity(message.length >= 10 ? '' : 'Please write at least 10 characters.');
  if (!contactForm.reportValidity()) return;
  const fullSubject = `[TEAM HEX CONTACT] ${subject}`;
  const body = `TEAM HEX CONTACT MESSAGE\n\nFull name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMESSAGE\n${message}\n\nPrepared via the TEAM HEX website.`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(links.email)}&su=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:${links.email}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(body)}`;
  $('#gmail-draft-link').href = gmail;
  $('#mailto-draft-link').href = mailto;
  $('#contact-result').hidden = false;
  window.open(gmail, '_blank', 'noopener,noreferrer');
});

/* Lightweight ambient particles. Suspended off-screen and in reduced-motion mode. */
const canvas = $('#hero-particles');
const context = canvas.getContext('2d');
let particles = [], canvasWidth = 0, canvasHeight = 0, particleFrame = 0, heroVisible = true;
function resizeCanvas() {
  const rect = $('#home').getBoundingClientRect();
  canvasWidth = rect.width; canvasHeight = rect.height;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(canvasWidth * dpr); canvas.height = Math.round(canvasHeight * dpr);
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  particles = Array.from({ length: canvasWidth < 680 ? 34 : 72 }, () => ({ x: Math.random() * canvasWidth, y: Math.random() * canvasHeight, vx: .06 + Math.random() * .22, vy: -.05 - Math.random() * .2, r: .5 + Math.random() * 1.1, a: .15 + Math.random() * .45 }));
}
function drawParticles() {
  particleFrame = 0;
  if (!context || !motionEnabled || !heroVisible || document.hidden) return;
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  particles.forEach((particle, i) => {
    particle.x += particle.vx; particle.y += particle.vy;
    if (particle.x > canvasWidth + 5) particle.x = -5;
    if (particle.y < -5) particle.y = canvasHeight + 5;
    context.beginPath(); context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    context.fillStyle = `rgba(125,211,252,${particle.a})`; context.fill();
    const warp = Math.min(Math.abs(scrollVelocity) / 2200, 1);
    if (warp > .12) { context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(particle.x - particle.vx * 26 * warp, particle.y - particle.vy * 26 * warp); context.strokeStyle = `rgba(34,211,238,${particle.a * warp * .7})`; context.lineWidth = particle.r * .8; context.stroke(); }
    for (let j = i + 1; j < particles.length; j++) {
      const other = particles[j], distance = Math.hypot(particle.x - other.x, particle.y - other.y);
      if (distance < 110) {
        context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(other.x, other.y);
        context.strokeStyle = `rgba(53,116,204,${(1 - distance / 110) * .1})`; context.lineWidth = .6; context.stroke();
      }
    }
  });
  particleFrame = requestAnimationFrame(drawParticles);
}
function syncParticles() {
  if (particleFrame) cancelAnimationFrame(particleFrame);
  particleFrame = 0;
  if (motionEnabled && heroVisible && !document.hidden) drawParticles();
  else context?.clearRect(0, 0, canvasWidth, canvasHeight);
}
resizeCanvas();
new ResizeObserver(() => { resizeCanvas(); }).observe($('#home'));
new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; syncParticles(); }).observe($('#home'));
document.addEventListener('visibilitychange', syncParticles);

/* Scroll progression and active section indicators. */
const sectionIds = ['home', 'squad', 'about', 'protocol', 'highlights', 'join', 'contact'];
let scrollQueued = false;
function updateScrollUI() {
  scrollQueued = false;
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  const progress = max > 0 ? Math.min(1, y / max) : 0;
  $('#page-progress').style.transform = `scaleX(${progress})`;
  $('#scroll-percent').textContent = `${String(Math.round(progress * 100)).padStart(3, '0')}%`;
  $('#site-header').classList.toggle('scrolled', y > 25);
  let active = 'home';
  sectionIds.forEach(id => { if (document.getElementById(id).getBoundingClientRect().top <= 180) active = id; });
  $$('.scroll-rail a').forEach(link => { const selected = link.dataset.rail === active; link.classList.toggle('is-active', selected); if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  $$('.desktop-nav .nav-link').forEach(link => {
    const selected = link.getAttribute('href') === `#${active}`;
    link.classList.toggle('is-active', selected);
    if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
}
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScrollUI); } }, { passive: true });
addEventListener('resize', updateScrollUI, { passive: true });
updateScrollUI();

/* Pointer response is subtle and entirely optional. */
const cursor = $('#cursor-dot');
document.addEventListener('pointermove', event => {
  if (!motionEnabled || !finePointer.matches) return;
  if (!cursorX) {
    gsap.set(cursor, { xPercent: -50, yPercent: -50, x: event.clientX, y: event.clientY });
    cursorX = gsap.quickTo(cursor, 'x', { duration: .18, ease: 'power3.out' });
    cursorY = gsap.quickTo(cursor, 'y', { duration: .18, ease: 'power3.out' });
  }
  cursorX(event.clientX); cursorY(event.clientY); cursor.style.opacity = '1';
}, { passive: true });
document.addEventListener('pointerover', event => {
  const labelled = event.target.closest('[data-cursor]');
  const interactive = !!event.target.closest('a,button,input,textarea');
  cursor.classList.toggle('is-hovering', interactive);
  cursor.classList.toggle('is-labelled', !!labelled);
  $('#cursor-label').textContent = labelled ? labelled.dataset.cursor : '';
});
document.documentElement.addEventListener('pointerleave', () => { cursor.style.opacity = '0'; });
$('.hero-art').addEventListener('pointermove', event => {
  if (!motionEnabled || !finePointer.matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - .5;
  const y = (event.clientY - rect.top) / rect.height - .5;
  world?.setPointer(x * 2, y * 2);
  $$('.hero-player').forEach(player => {
    const depth = Number(player.dataset.depth);
    gsap.to(player, { x: x * depth, y: y * depth * .55, duration: .8, overwrite: 'auto', ease: 'power2.out' });
  });
}, { passive: true });
$('.hero-art').addEventListener('pointerleave', () => {
  if (motionEnabled) gsap.to('.hero-player', { x: 0, y: 0, duration: 1, overwrite: 'auto', ease: 'power3.out' });
});
$('#gallery-grid').addEventListener('pointermove', event => {
  if (!motionEnabled || !finePointer.matches) return;
  const card = event.target.closest('.gallery-item');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width, py = (event.clientY - rect.top) / rect.height;
  gsap.to(card, { rotationY: (px - .5) * 8, rotationX: -(py - .5) * 7, transformPerspective: 900, duration: .45, overwrite: 'auto', ease: 'power2.out' });
}, { passive: true });
$('#gallery-grid').addEventListener('pointerout', event => {
  const card = event.target.closest('.gallery-item');
  if (card && !card.contains(event.relatedTarget) && motionEnabled) gsap.to(card, { rotationX: 0, rotationY: 0, duration: .6, overwrite: 'auto', ease: 'power3.out' });
});
$('#roster-grid').addEventListener('pointermove', event => {
  if (!motionEnabled || !finePointer.matches) return;
  const card = event.target.closest('.player-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width, py = (event.clientY - rect.top) / rect.height;
  card.style.setProperty('--pointer-x', `${px * 100}%`); card.style.setProperty('--pointer-y', `${py * 100}%`);
  gsap.to(card, { rotationY: (px - .5) * 7, rotationX: -(py - .5) * 6, z: 8, transformPerspective: 1000, duration: .5, overwrite: 'auto', ease: 'power2.out' });
}, { passive: true });
$('#roster-grid').addEventListener('pointerout', event => {
  const card = event.target.closest('.player-card');
  if (card && !card.contains(event.relatedTarget) && motionEnabled) gsap.to(card, { rotationX: 0, rotationY: 0, z: 0, duration: .7, overwrite: 'auto', ease: 'elastic.out(1,.65)' });
});
document.addEventListener('pointerdown', event => {
  if (!motionEnabled || !finePointer.matches || event.target.closest('input,textarea,dialog')) return;
  const ripple = document.createElement('span'); ripple.className = 'click-ripple'; ripple.setAttribute('aria-hidden', 'true');
  ripple.style.left = `${event.clientX}px`; ripple.style.top = `${event.clientY}px`; document.body.append(ripple);
  gsap.fromTo(ripple, { scale: .3, opacity: .8 }, { scale: 3.5, opacity: 0, duration: .7, ease: 'power2.out', onComplete: () => ripple.remove() });
});
$$('.magnetic').forEach(button => {
  button.addEventListener('pointermove', event => {
    if (!motionEnabled || !finePointer.matches) return;
    const rect = button.getBoundingClientRect();
    gsap.to(button, { x: (event.clientX - rect.left - rect.width / 2) * .07, y: (event.clientY - rect.top - rect.height / 2) * .13, duration: .35, overwrite: 'auto' });
  });
  button.addEventListener('pointerleave', () => { if (motionEnabled) gsap.to(button, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1,.5)' }); });
});

function playIntro() {
  const loader = $('#loader');
  loader.hidden = false;
  const counter = { value: 0 };
  gsap.set('.title-line>span', { yPercent: 110 });
  gsap.set('.hero-enter', { opacity: 0, y: 22 });
  gsap.set('.hero-player', { opacity: 0, y: 70 });
  gsap.set('.player-float,.art-coordinate', { opacity: 0, y: 15 });
  gsap.set('.hero-stat', { opacity: 0, y: 15 });
  introTimeline = gsap.timeline({ onComplete: () => { loader.hidden = true; introTimeline = null; } });
  introTimeline.to(counter, { value: 100, duration: .7, ease: 'power2.inOut', onUpdate: () => { $('#loader-count').textContent = pad(Math.round(counter.value)); } })
    .to('.loader-track i', { scaleX: 1, duration: .7, ease: 'power2.inOut' }, 0)
    .to(loader, { yPercent: -100, duration: .6, ease: 'power4.inOut' }, .78)
    .to('.hero-meta', { opacity: 1, y: 0, duration: .6 }, .95)
    .to('.title-line>span', { yPercent: 0, duration: 1, stagger: .12, ease: 'power4.out' }, 1)
    .to('.hero-player', { opacity: 1, y: 0, duration: 1.2, stagger: .12, ease: 'power3.out' }, 1)
    .to('.hero-enter', { opacity: 1, y: 0, duration: .7, stagger: .09, ease: 'power3.out' }, 1.25)
    .to('.player-float,.art-coordinate', { opacity: 1, y: 0, duration: .7, stagger: .1 }, 1.65)
    .to('.hero-stat', { opacity: 1, y: 0, duration: .7, stagger: .1 }, 1.5);
}

function decorateSections() {
  $$('.section, .join-section').forEach((section, index) => {
    const line = document.createElement('div'); line.className = 'section-scan'; line.setAttribute('aria-hidden', 'true');
    const ghost = document.createElement('span'); ghost.className = 'section-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.textContent = pad(index + 1);
    section.prepend(line, ghost);
  });
}
decorateSections();

function buildMotion(withIntro = false) {
  motionContext = gsap.context(() => {
    if (withIntro) playIntro();
    $$('[data-reveal]').forEach(element => {
      gsap.from(element, { y: 38, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 94%', once: true } });
    });

    $$('[data-scramble]').forEach(element => {
      const original = element.textContent;
      gsap.fromTo(element, { opacity: .35 }, { opacity: 1, duration: .9, scrambleText: { text: original, chars: 'HEX0123456789/—', speed: .4 }, scrollTrigger: { trigger: element, start: 'top 94%', once: true } });
    });

    // Real text masks, not a fade-only page. SplitText keeps an accessible label.
    $$('.section-heading h2, .about-copy h2, .join-copy h2').forEach(heading => {
      const split = SplitText.create(heading, { type: 'words,chars', charsClass: 'hex-char', wordsClass: 'hex-word', aria: 'auto' });
      textSplits.push(split);
      gsap.from(split.chars, { yPercent: 112, opacity: 0, stagger: .012, duration: .8, ease: 'power4.out', scrollTrigger: { trigger: heading, start: 'top 91%', once: true } });
    });

    $$('.section-scan').forEach(line => gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: line.parentElement, start: 'top 90%', end: 'top 25%', scrub: .6 } }));
    $$('.section-ghost').forEach(ghost => gsap.fromTo(ghost, { yPercent: 20, xPercent: 5 }, { yPercent: -20, xPercent: -5, ease: 'none', scrollTrigger: { trigger: ghost.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1.2 } }));

    gsap.to('.hero-copy', { y: -95, opacity: .15, scale: .96, ease: 'none', scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1 } });
    gsap.to('.hero-art', { y: 125, scale: 1.06, ease: 'none', scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1 } });
    gsap.to('.hero-back-type', { x: -90, rotationY: 20, ease: 'none', scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1.5 } });
    gsap.fromTo('.hero-ambient-word', { xPercent: 8 }, { xPercent: -12, ease: 'none', scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1 } });
    const marqueeTween = gsap.to('.marquee-track', { xPercent: -50, repeat: -1, duration: 32, ease: 'none' });
    ScrollTrigger.create({ onUpdate: self => {
      scrollVelocity = self.getVelocity();
      const velocity = gsap.utils.clamp(-1, 1, scrollVelocity / 2600);
      document.documentElement.style.setProperty('--hex-velocity', velocity.toFixed(3));
      document.body.classList.toggle('is-warping', Math.abs(scrollVelocity) > 1800);
      clearTimeout(velocityTimer);
      velocityTimer = setTimeout(() => { document.body.classList.remove('is-warping'); document.documentElement.style.setProperty('--hex-velocity', '0'); }, 160);
      const boost = Math.min(Math.abs(self.getVelocity()) / 1400, 3.5);
      gsap.to(marqueeTween, { timeScale: 1 + boost, duration: .25, overwrite: true });
      gsap.to('.marquee-track', { skewX: gsap.utils.clamp(-6, 6, self.getVelocity() / 900), duration: .25, overwrite: true });
    }});

    $$('.hero-stat strong').forEach((stat, index) => {
      const target = [6, 5, 1][index], value = { n: 0 };
      const text = stat.firstChild;
      gsap.to(value, { n: target, duration: 1.5, ease: 'power3.out', onUpdate: () => { text.textContent = pad(Math.round(value.n)); }, scrollTrigger: { trigger: '.hero-bottom', start: 'top 98%', once: true } });
    });

    rosterTriggers.forEach(trigger => trigger.kill()); rosterTriggers = [];
    $$('.player-card').forEach((card, index) => {
      const tween = gsap.from(card, { y: 56, opacity: 0, scale: .985, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 94%', once: true } });
      rosterTriggers.push(tween.scrollTrigger);
    });
    gsap.from('.roster-footer', { y: 20, opacity: 0, scrollTrigger: { trigger: '.roster-footer', start: 'top 96%', once: true } });

    motionMedia = gsap.matchMedia();
    motionMedia.add('(min-width: 951px)', () => {
      const section = $('#squad');
      const rail = $('#roster-grid');
      const getMax = () => Math.max(0, rail.scrollWidth - rail.clientWidth);
      const state = { x: 0 };
      section.classList.add('has-scroll-sequence');
      rail.scrollLeft = 0;
      squadScrollTween = gsap.to(state, {
        x: () => getMax(),
        ease: 'none',
        onUpdate: () => { rail.scrollLeft = state.x; syncRosterRail(); },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.max(1, getMax())}`,
          pin: true,
          scrub: .8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => { state.x = Math.min(state.x, getMax()); rail.scrollLeft = state.x; syncRosterRail(); }
        }
      });
      squadScrollTrigger = squadScrollTween.scrollTrigger;
      requestAnimationFrame(updateSquadFocus);
      return () => {
        squadScrollTween?.kill(); squadScrollTrigger?.kill();
        squadScrollTween = null; squadScrollTrigger = null;
        section.classList.remove('has-scroll-sequence');
        rail.scrollLeft = 0;
        $$('.player-card', rail).forEach(card => {
          card.classList.remove('is-squad-focus');
          card.style.removeProperty('--squad-focus');
          card.style.removeProperty('--squad-lift');
          card.style.removeProperty('--squad-scale');
          card.style.removeProperty('--squad-sat');
        });
        const hud = $('#squad-active');
        if (hud) hud.textContent = '01 / 06 — HEX-CL4W';
        syncRosterRail();
      };
    });

    gsap.fromTo('.about-visual', { clipPath: 'inset(10% 8% 10% 8% round 4px)' }, { clipPath: 'inset(0% 0% 0% 0% round 4px)', ease: 'none', scrollTrigger: { trigger: '.about-visual', start: 'top 92%', end: 'top 35%', scrub: .8 } });
    gsap.fromTo('.gallery-item', { clipPath: 'inset(14% 6% 14% 6% round 3px)', opacity: .4 }, { clipPath: 'inset(0% 0% 0% 0% round 3px)', opacity: 1, stagger: .08, ease: 'none', scrollTrigger: { trigger: '#gallery-panel', start: 'top 90%', end: 'top 40%', scrub: .8 } });
    gsap.from('.about-body p', { x: 35, opacity: 0, stagger: .14, duration: .8, scrollTrigger: { trigger: '.about-body', start: 'top 88%', once: true } });
    gsap.from('.values-list>div', { y: 30, rotationX: -35, opacity: 0, stagger: .13, duration: .8, ease: 'back.out(1.4)', scrollTrigger: { trigger: '.values-list', start: 'top 94%', once: true } });
    gsap.to('.about-motto', { x: 14, ease: 'none', scrollTrigger: { trigger: '.about-visual', start: 'top bottom', end: 'bottom top', scrub: 1 } });

    motionMedia.add('(min-width: 681px)', () => {
      const steps = $$('.protocol-step');
      gsap.set(steps.slice(1), { autoAlpha: 0, y: 85, rotationX: -20 });
      const sequence = gsap.timeline({ scrollTrigger: { trigger: '.protocol-section', start: 'top top', end: '+=1900', pin: '.protocol-stage', scrub: .8, anticipatePin: 1, invalidateOnRefresh: true } });
      sequence.to('.protocol-progress>span', { scaleX: 1, duration: 3, ease: 'none' }, 0)
        .to(steps[0], { autoAlpha: 0, y: -70, rotationX: 15, duration: .55 }, .55)
        .to(steps[1], { autoAlpha: 1, y: 0, rotationX: 0, duration: .6 }, .95)
        .to(steps[1], { autoAlpha: 0, y: -70, rotationX: 15, duration: .55 }, 1.7)
        .to(steps[2], { autoAlpha: 1, y: 0, rotationX: 0, duration: .6 }, 2.15)
        .to({}, { duration: .55 });
      return () => { gsap.set(steps, { clearProps: 'all' }); };
    });
    motionMedia.add('(max-width: 680px)', () => {
      $$('.protocol-step').forEach(step => gsap.from(step, { y: 45, opacity: 0, rotationX: -8, duration: .9, scrollTrigger: { trigger: step, start: 'top 88%', once: true } }));
      gsap.fromTo('.protocol-progress>span', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.protocol-section', start: 'top top', end: 'bottom bottom', scrub: 1 } });
    });

    gsap.fromTo('.feature-video-wrap', { y: 64, scale: .965, clipPath: 'inset(8% 4% 8% 4% round 3px)' }, { y: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 3px)', ease: 'none', scrollTrigger: { trigger: '.feature-video-wrap', start: 'top 95%', end: 'top 38%', scrub: .8 } });
    gsap.from('.playlist-item', { x: 55, opacity: 0, stagger: .12, duration: .8, scrollTrigger: { trigger: '.playlist', start: 'top 90%', once: true } });
    gsap.fromTo('#feature-thumbnail', { yPercent: -4, scale: 1.1 }, { yPercent: 4, scale: 1.1, ease: 'none', scrollTrigger: { trigger: '.feature-video', start: 'top bottom', end: 'bottom top', scrub: 1 } });

    gsap.fromTo('.join-copy', { x: -45 }, { x: 0, ease: 'none', scrollTrigger: { trigger: '#join', start: 'top 85%', end: 'top 20%', scrub: 1 } });
    gsap.fromTo('.join-form-card', { y: 64 }, { y: 0, ease: 'none', scrollTrigger: { trigger: '.join-form-card', start: 'top 95%', end: 'top 38%', scrub: .8 } });
    gsap.from('.join-requirements>div', { y: 25, opacity: 0, stagger: .18, duration: .7, scrollTrigger: { trigger: '.join-requirements', start: 'top 95%', once: true } });
    gsap.from('.join-form-card .field', { y: 20, opacity: 0, stagger: .09, duration: .6, scrollTrigger: { trigger: '.join-form-card', start: 'top 75%', once: true } });
    gsap.fromTo('.join-floor', { backgroundPositionY: 0 }, { backgroundPositionY: 160, ease: 'none', scrollTrigger: { trigger: '#join', start: 'top bottom', end: 'bottom top', scrub: 1 } });

    gsap.from('.contact-link', { x: -45, opacity: 0, stagger: .12, duration: .8, scrollTrigger: { trigger: '.contact-links', start: 'top 90%', once: true } });
    gsap.fromTo('.contact-form-wrap', { y: 58 }, { y: 0, ease: 'none', scrollTrigger: { trigger: '.contact-form-wrap', start: 'top 95%', end: 'top 40%', scrub: .8 } });
    gsap.from('.footer-top', { y: 35, opacity: 0, duration: .9, scrollTrigger: { trigger: '.site-footer', start: 'top 90%', once: true } });
    const footerSplit = SplitText.create('.footer-wordmark', { type: 'chars', charsClass: 'footer-char', aria: 'auto' }); textSplits.push(footerSplit);
    gsap.from(footerSplit.chars, { yPercent: 45, rotationX: -65, opacity: .25, stagger: .045, ease: 'none', scrollTrigger: { trigger: '.footer-wordmark', start: 'top 98%', end: 'top 55%', scrub: 1 } });
    gsap.to('.footer-wordmark', { color: '#657c9b', ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: 1 } });
    gsap.from('.visitor-counter', { y: 44, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.visitor-counter', start: 'top 94%', once: true } });
    gsap.from('.footer-socials a', { y: 18, opacity: 0, stagger: .08, scrollTrigger: { trigger: '.footer-bottom', start: 'top 98%', once: true } });
  });
}
function applyMotion(enabled, withIntro = false) {
  motionEnabled = enabled;
  document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  $$('[data-motion-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', `Turn animations ${enabled ? 'off' : 'on'}`);
    $('span', button).textContent = enabled ? 'FX ON' : 'FX OFF';
  });
  if (enabled) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, anchors: false, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(ticker);
    buildMotion(withIntro);
    world?.setMotion(true);
    syncDialogLock();
  } else {
    introTimeline?.kill(); introTimeline = null;
    $('#loader').hidden = true;
    motionMedia?.revert(); motionMedia = null;
    motionContext?.revert(); motionContext = null;
    textSplits.forEach(split => split.revert()); textSplits = [];
    rosterTriggers = [];
    world?.setMotion(false);
    $$('.hero-stat strong').forEach((stat, i) => { stat.firstChild.textContent = pad([6, 5, 1][i]); });
    gsap.killTweensOf('.hero-player,.player-card,.magnetic');
    gsap.set('.hero-player,.player-card,.magnetic', { clearProps: 'transform,opacity' });
    gsap.ticker.remove(ticker); lenis?.destroy(); lenis = null;
    cursor.style.opacity = '0';
    clearTimeout(velocityTimer);
    document.body.classList.remove('is-warping');
    document.documentElement.style.setProperty('--hex-velocity', '0');
  }
  syncParticles();
  ScrollTrigger.refresh();
  if (!enabled) {
    const rail = $('#roster-grid');
    rail.scrollLeft = 0;
    requestAnimationFrame(() => { rail.scrollLeft = 0; syncRosterRail(); });
  }
}
$$('[data-motion-toggle]').forEach(button => button.addEventListener('click', () => {
  storage.set('hex-motion', motionEnabled ? 'off' : 'on');
  applyMotion(!motionEnabled);
}));
reducedMotion.addEventListener('change', event => {
  if (storage.get('hex-motion') === null) applyMotion(!event.matches);
});
let introSeen = false;
try { introSeen = sessionStorage.getItem('hex-intro') === 'seen'; sessionStorage.setItem('hex-intro', 'seen'); } catch { /* Session storage is optional. */ }
applyMotion(motionEnabled, motionEnabled && !introSeen && (!location.hash || location.hash === '#home'));
document.fonts.ready.then(() => ScrollTrigger.refresh());
/* Drafts stay on the visitor's device until they discard or send them. */
const draftFields = {
  join: ['join-name', 'join-uid', 'join-level', 'join-years'],
  contact: ['contact-name', 'contact-email', 'contact-subject', 'contact-message']
};
const draftTimers = {};
function saveDraft(key) {
  const data = {};
  draftFields[key].forEach(id => { data[id] = document.getElementById(id).value; });
  if (Object.values(data).every(value => !value.trim())) { drafts.clear(key); return; }
  drafts.save(key, data);
}
function clearDraft(key) {
  drafts.clear(key);
  draftFields[key].forEach(id => { document.getElementById(id).value = ''; });
  $(`#${key}-draft`).hidden = true;
}
function restoreDraft(key) {
  const data = drafts.load(key);
  if (!data) return;
  let restored = false;
  draftFields[key].forEach(id => {
    if (typeof data[id] === 'string' && data[id]) { document.getElementById(id).value = data[id]; restored = true; }
  });
  if (restored) $(`#${key}-draft`).hidden = false;
}
Object.keys(draftFields).forEach(key => {
  restoreDraft(key);
  $(`#${key}-form`).addEventListener('input', () => {
    clearTimeout(draftTimers[key]);
    draftTimers[key] = setTimeout(() => saveDraft(key), 400);
  });
});
contactForm.addEventListener('submit', () => {
  if ($('#contact-result').hidden) return;
  drafts.clear('contact');
  $('#contact-draft').hidden = true;
  toast('Gmail draft prepared. Nothing has been sent yet.', 'mail-check');
});
joinForm.addEventListener('submit', () => {
  if ($('#join-result').hidden) return;
  drafts.clear('join');
  $('#join-draft').hidden = true;
});

savedOperators.subscribe(() => {
  updateSavedCount();
  if (rosterFilter === 'saved') renderRoster('saved'); else syncSavedBadges();
});
updateSavedCount();

initPro({
  goToSection, showPlayer, openVideo, openGallery, openDialog, closeDialog, refreshIcons,
  toggleMotion() {
    storage.set('hex-motion', motionEnabled ? 'off' : 'on');
    applyMotion(!motionEnabled);
    toast(motionEnabled ? 'Animations enabled.' : 'Animations disabled.', 'activity');
  },
  showSaved() {
    const tab = $$('[data-filter]').find(button => button.dataset.filter === 'saved');
    tab?.click();
    goToSection('squad');
    if (!savedOperators.count()) toast('No saved operators yet. Save one from any profile.', 'bookmark');
  },
  startSlideshow() {
    switchMediaTab($('#gallery-tab'));
    goToSection('highlights');
    openGallery(0);
    setSlideshow(true);
  }
});

const linkedPlayer = new URLSearchParams(location.search).get('player');
if (linkedPlayer && players.some(player => player.id === linkedPlayer)) setTimeout(() => showPlayer(linkedPlayer), 900);

initVisitorCounter();
// Defer GPU setup until the readable page and original photography are ready.
const startWorld = () => import('./world.js').then(({ createWorld }) => { world = createWorld(); world.setMotion(motionEnabled); }).catch(() => { document.documentElement.classList.add('webgl-fallback'); });
if ('requestIdleCallback' in window) requestIdleCallback(startWorld, { timeout: 1200 }); else setTimeout(startWorld, 350);
if (import.meta.hot) import.meta.hot.dispose(() => world?.dispose());
