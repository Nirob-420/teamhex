/**
 * Shared markup templates.
 *
 * These functions are the SINGLE source of truth for the roster, match-film
 * playlist and gallery markup. They are consumed twice:
 *
 *   1. At build/dev time by the SEO plugin, which prerenders them into
 *      `index.html` so crawlers that do not execute JavaScript still see every
 *      player, film and archive image.
 *   2. At runtime by `src/main.js`, which re-renders the same strings when the
 *      visitor filters the roster or interacts with the archive.
 *
 * Because both paths share this module, the prerendered HTML and the hydrated
 * HTML are byte-identical — no flash of missing content and no duplicated
 * template strings to keep in sync.
 */

/** Zero-pads a number to two digits (`4` → `"04"`). */
export const pad = n => String(n).padStart(2, '0');

/**
 * One operator card in the squad rail.
 *
 * @param {object} player  Entry from `src/data.js`.
 * @param {boolean} [saved=false]  Whether the operator is bookmarked on this
 *   device. Prerendering always passes `false` because saved state lives in
 *   `localStorage` and is unknown until the page runs.
 */
export function playerCard(player, saved = false) {
  return `
    <button class="player-card" data-cursor="VIEW" data-player="${player.id}" aria-label="View ${player.name}, ${player.ign}, ${player.role}">
      <span class="player-card-top"><span class="role-badge"><i data-lucide="${player.icon}"></i>${player.role}</span><span class="card-number">/${player.number}</span></span>
      <img src="/images/${player.id}.webp" alt="${player.name}, ${player.ign} — ${player.role} for TEAM HEX, in the TEAM HEX jersey" width="725" height="1150" loading="lazy" decoding="async" />
      <span class="card-holo" aria-hidden="true"></span><span class="player-card-shade"></span><span class="card-view">VIEW OPERATOR PROFILE</span>${saved ? '<span class="card-saved"><i data-lucide="bookmark-check"></i>SAVED</span>' : ''}
      <span class="player-card-content"><span><span class="player-card-ign">${player.ign}</span><span class="player-card-name">${player.name}</span></span><span class="card-arrow"><i data-lucide="arrow-up-right"></i></span></span>
    </button>`;
}

/** Message shown when a filter (currently only SAVED) matches no operators. */
export const rosterEmpty =
  '<p class="roster-empty">NO SAVED OPERATORS YET.<br />Open any player profile and choose SAVE OPERATOR. Saved players stay on this device only — nothing is uploaded.</p>';

/** The full squad rail, as prerendered on first paint. */
export const renderRosterMarkup = (visible, isSaved = () => false) =>
  visible.length
    ? visible.map(player => playerCard(player, isSaved(player.id))).join('')
    : rosterEmpty;

/**
 * One match-film entry in the watchlist.
 *
 * The thumbnail keeps `alt=""` on purpose: the film title sits immediately
 * beside it, so a duplicate alt string would be read twice by screen readers.
 * Image discovery for these thumbnails is handled by the `VideoObject`
 * entries in the structured data instead.
 */
export function playlistItem(video, i) {
  return `
    <button class="playlist-item ${i === 0 ? 'is-active' : ''}" data-select-video="${video.id}" aria-pressed="${i === 0}" aria-label="Select ${video.title}">
      <span class="playlist-number">${pad(i + 1)}</span><img src="/images/${video.id}.webp" alt="" width="160" height="90" loading="lazy" decoding="async" />
      <span><span class="playlist-category">${video.category}</span><span class="playlist-title">${video.title}</span></span>
    </button>`;
}

/** The full watchlist. */
export const renderPlaylistMarkup = items => items.map(playlistItem).join('');

/** One archive image in the gallery rail. */
export function galleryItem(image, i) {
  return `
    <button class="gallery-item ${image.fit === 'contain' ? 'is-brand' : ''}" data-cursor="OPEN" data-gallery="${i}" aria-label="Open ${image.title}">
      <img src="/images/${image.src}.webp" alt="${image.title} — ${image.subtitle} — TEAM HEX Free Fire archive" width="1440" height="648" loading="lazy" decoding="async" />
      <span class="gallery-index" aria-hidden="true">${pad(i + 1)}</span>
      <span class="gallery-caption"><small>${image.subtitle}</small><strong>${image.title}</strong><i data-lucide="scan-search"></i></span>
    </button>`;
}

/** The full archive gallery. */
export const renderGalleryMarkup = items => items.map(galleryItem).join('');
