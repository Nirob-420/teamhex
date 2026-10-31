/* TEAM HEX Pro: command menu, notifications, shortcuts, sharing, offline awareness. */
import { players, videos, gallery, links } from './data.js';
import { recents } from './store.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let api = null;
let installPrompt = null;

/* Notifications ------------------------------------------------------------ */
export function toast(message, icon = 'check') {
  const region = $('#toast-region');
  if (!region) return;
  const item = document.createElement('div');
  item.className = 'toast';
  item.innerHTML = `<span class="toast-icon"><i data-lucide="${icon}"></i></span><span>${message}</span>`;
  region.append(item);
  api?.refreshIcons();
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(() => {
    item.classList.add('is-leaving');
    setTimeout(() => item.remove(), 320);
  }, 4200);
}

/* Sharing ------------------------------------------------------------------ */
export async function shareOrCopy({ title, text, url }) {
  const target = url || location.href;
  if (navigator.share) {
    try { await navigator.share({ title, text, url: target }); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(target);
    toast('Link copied to your clipboard.', 'link-2');
  } catch {
    toast(`Copy this link: ${target}`, 'link-2');
  }
}

/* Command catalogue -------------------------------------------------------- */
const sections = [
  { id: 'home', label: 'Home', hint: 'BROADCAST', keywords: 'start hero top' },
  { id: 'squad', label: 'The squad', hint: 'SIX OPERATORS', keywords: 'members players roster team' },
  { id: 'about', label: 'Our story', hint: 'THE HEX DNA', keywords: 'about story emblem wolf' },
  { id: 'protocol', label: 'The HEX protocol', hint: 'MINDSET', keywords: 'prepare unite dominate' },
  { id: 'highlights', label: 'Highlights & gallery', hint: 'COMBAT ARCHIVE', keywords: 'videos films gallery pictures images' },
  { id: 'join', label: 'Join the unit', hint: 'RECRUITMENT', keywords: 'recruit apply clan eligibility level' },
  { id: 'contact', label: 'Contact', hint: 'COMMS', keywords: 'email whatsapp facebook message scrim' }
];

function buildCommands() {
  const commands = [
    ...sections.map(section => ({
      id: `section-${section.id}`, group: 'NAVIGATE', label: section.label, hint: section.hint,
      icon: 'arrow-up-right', keywords: section.keywords, run: () => api.goToSection(section.id)
    })),
    ...players.map(player => ({
      id: `player-${player.id}`, group: 'OPERATORS', label: `${player.name} — ${player.ign}`, hint: player.role,
      icon: player.icon, keywords: `${player.role} ${player.group} ${player.tagline}`, run: () => api.showPlayer(player.id)
    })),
    ...videos.map(video => ({
      id: `film-${video.id}`, group: 'MATCH FILMS', label: video.title, hint: video.category,
      icon: 'play', keywords: 'youtube match video tournament', run: () => { api.goToSection('highlights'); api.openVideo(video.id); }
    })),
    ...gallery.map((image, index) => ({
      id: `image-${image.src}`, group: 'ARCHIVE', label: image.title, hint: 'GALLERY',
      icon: 'images', keywords: 'picture photo image archive', run: () => api.openGallery(index)
    })),
    { id: 'action-saved', group: 'ACTIONS', label: 'Saved operators', hint: 'ON THIS DEVICE', icon: 'bookmark', keywords: 'favourite favorite saved squad', run: () => api.showSaved() },
    { id: 'action-slideshow', group: 'ACTIONS', label: 'Play archive slideshow', hint: 'GALLERY', icon: 'play', keywords: 'slideshow autoplay pictures', run: () => api.startSlideshow() },
    { id: 'action-motion', group: 'ACTIONS', label: 'Toggle animations (FX)', hint: 'SHORTCUT: F', icon: 'activity', keywords: 'motion animation effects reduce', run: () => api.toggleMotion() },
    { id: 'action-share', group: 'ACTIONS', label: 'Share this site', hint: 'COPY LINK', icon: 'share-2', keywords: 'share copy link', run: () => shareOrCopy({ title: 'TEAM HEX', text: 'TEAM HEX — Fearless in battle. United in victory.' }) },
    { id: 'action-shortcuts', group: 'ACTIONS', label: 'Keyboard shortcuts', hint: 'SHORTCUT: ?', icon: 'keyboard', keywords: 'help keys shortcuts', run: () => api.openDialog($('#shortcuts-dialog')) },
    { id: 'link-youtube', group: 'CHANNELS', label: 'HEX-CL4W on YouTube', hint: 'EXTERNAL', icon: 'youtube', keywords: 'youtube channel video', run: () => window.open(links.youtube, '_blank', 'noopener,noreferrer') },
    { id: 'link-facebook', group: 'CHANNELS', label: 'TEAM HEX on Facebook', hint: 'EXTERNAL', icon: 'facebook', keywords: 'facebook page social', run: () => window.open(links.facebook, '_blank', 'noopener,noreferrer') },
    { id: 'link-community', group: 'CHANNELS', label: 'Join the WhatsApp community', hint: 'EXTERNAL', icon: 'users', keywords: 'whatsapp group community', run: () => window.open(links.community, '_blank', 'noopener,noreferrer') },
    { id: 'link-clan', group: 'CHANNELS', label: 'Open the Free Fire clan', hint: 'CLAN 3062659192', icon: 'gamepad-2', keywords: 'clan free fire join guild', run: () => window.open(links.clan, '_blank', 'noopener,noreferrer') },
    { id: 'link-email', group: 'CHANNELS', label: 'Email TEAM HEX', hint: links.email, icon: 'mail', keywords: 'email contact mail', run: () => { location.href = `mailto:${links.email}`; } }
  ];
  return commands;
}

function score(command, query) {
  if (!query) return 1;
  const haystack = `${command.label} ${command.hint} ${command.keywords || ''} ${command.group}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const term of terms) {
    const index = haystack.indexOf(term);
    if (index === -1) return 0;
    total += command.label.toLowerCase().startsWith(term) ? 3 : index < 24 ? 2 : 1;
  }
  return total;
}

let commands = [];
let visibleCommands = [];

function renderCommands(query = '') {
  const list = $('#command-list');
  const counter = $('#command-count');
  if (!list) return;
  const available = installPrompt
    ? [...commands, { id: 'action-install', group: 'ACTIONS', label: 'Install TEAM HEX as an app', hint: 'THIS DEVICE', icon: 'download', keywords: 'install app pwa offline', run: () => installPrompt.prompt() }]
    : commands;

  let matched;
  if (query.trim()) {
    matched = available.map(command => ({ command, value: score(command, query.trim()) }))
      .filter(entry => entry.value > 0).sort((a, b) => b.value - a.value).slice(0, 14).map(entry => entry.command);
  } else {
    const recent = recents.list().map(id => available.find(command => command.id === id)).filter(Boolean);
    matched = [...recent.map(command => ({ ...command, group: 'RECENT' })), ...available.filter(command => command.group === 'NAVIGATE' || command.group === 'ACTIONS')].slice(0, 14);
  }
  visibleCommands = matched;

  if (!matched.length) {
    list.innerHTML = '<li class="command-empty">No matches. Try a player name, “gallery”, “clan”, or “contact”.</li>';
    counter.textContent = 'No results';
    return;
  }
  let group = '';
  list.innerHTML = matched.map(command => {
    const heading = command.group !== group ? `<li class="command-group" aria-hidden="true">${command.group}</li>` : '';
    group = command.group;
    return `${heading}<li><button type="button" class="command-item" data-command="${command.id}"><span class="command-icon"><i data-lucide="${command.icon}"></i></span><span class="command-text"><strong>${command.label}</strong><small>${command.hint}</small></span><span class="command-key" aria-hidden="true">↵</span></button></li>`;
  }).join('');
  counter.textContent = `${matched.length} ${matched.length === 1 ? 'result' : 'results'}`;
  api.refreshIcons();
}

function runCommand(id) {
  const command = visibleCommands.find(item => item.id === id) || commands.find(item => item.id === id);
  if (!command) return;
  recents.push(command.id);
  api.closeDialog($('#command-dialog'));
  requestAnimationFrame(() => command.run());
}

export function openCommandMenu() {
  const dialog = $('#command-dialog');
  if (!dialog) return;
  const input = $('#command-input');
  input.value = '';
  renderCommands('');
  api.openDialog(dialog);
  requestAnimationFrame(() => input.focus());
}

/* Connection awareness ----------------------------------------------------- */
function syncConnection(announce = false) {
  const badge = $('#connection-badge');
  const offline = !navigator.onLine;
  if (badge) badge.hidden = !offline;
  document.documentElement.dataset.connection = offline ? 'offline' : 'online';
  if (announce) toast(offline ? 'You are offline. Cached pages still work.' : 'Back online.', offline ? 'wifi-off' : 'wifi');
}

export function initPro(handlers) {
  api = handlers;
  commands = buildCommands();

  $('#command-trigger')?.addEventListener('click', openCommandMenu);
  $$('[data-open-command]').forEach(button => button.addEventListener('click', openCommandMenu));
  $('#command-input')?.addEventListener('input', event => renderCommands(event.target.value));
  $('#command-list')?.addEventListener('click', event => {
    const item = event.target.closest('[data-command]');
    if (item) runCommand(item.dataset.command);
  });

  const dialog = $('#command-dialog');
  dialog?.addEventListener('keydown', event => {
    const items = $$('.command-item', dialog);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[current === -1 ? 0 : (current + 1) % items.length].focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (current <= 0) $('#command-input').focus(); else items[current - 1].focus(); }
    if (event.key === 'Enter' && document.activeElement === $('#command-input')) { event.preventDefault(); items[0].click(); }
  });

  document.addEventListener('keydown', event => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog?.open) api.closeDialog(dialog); else openCommandMenu();
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if ($$('dialog[open]').length) return;
    if (event.key === '/') { event.preventDefault(); openCommandMenu(); }
    if (event.key === '?') { event.preventDefault(); api.openDialog($('#shortcuts-dialog')); }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); api.toggleMotion(); }
    if (event.key.toLowerCase() === 't') { event.preventDefault(); api.goToSection('home'); }
  });

  addEventListener('online', () => syncConnection(true));
  addEventListener('offline', () => syncConnection(true));
  syncConnection();

  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    document.documentElement.dataset.installable = 'true';
  });
  addEventListener('appinstalled', () => { installPrompt = null; toast('TEAM HEX was installed on this device.', 'download'); });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          const urls = performance.getEntriesByType('resource').map(entry => entry.name)
            .filter(url => url.startsWith(location.origin) && /\/(assets|images|icons)\//.test(url));
          navigator.serviceWorker.controller?.postMessage({ type: 'precache', urls: [...new Set(urls)] });
        })
        .catch(() => { /* Offline support is optional. */ });
    });
  }
}
