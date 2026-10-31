/**
 * Single source of truth for every SEO-facing value on the site.
 *
 * Canonical URL, social profiles, brand strings and locale live here so that
 * `index.html`, the generated JSON-LD, `sitemap.xml`, `robots.txt` and the web
 * app manifest can never drift apart.
 *
 * Changing domain? Set `VITE_SITE_URL` at build time (Netlify: Site settings →
 * Environment variables) or edit `siteUrl` below. Nothing else needs to change.
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const nodeEnv = (typeof process !== 'undefined' && process.env) || {};

/** Absolute origin of the published site, without a trailing slash. */
export const siteUrl = String(
  env.VITE_SITE_URL || nodeEnv.VITE_SITE_URL || nodeEnv.URL || 'https://teamhex.netlify.app'
).replace(/\/+$/, '');

export const site = {
  url: siteUrl,
  name: 'TEAM HEX',
  legalName: 'TEAM HEX — Elite Firepower Unit',
  alternateName: 'Elite Firepower Unit',
  slogan: 'Fearless in Battle. United in Victory.',
  description:
    'TEAM HEX is a competitive Free Fire esports team from Bangladesh. Meet the six-player roster, watch match films, and see if you qualify to join the unit.',
  /** Long-form version used for Open Graph and Twitter cards. */
  socialDescription:
    'Fearless in battle. United in victory. Meet the six operators of TEAM HEX, watch the match films, and enter the world of Free Fire esports in Bangladesh.',
  /** Used for og:title / twitter:title. */
  socialTitle: 'TEAM HEX — Elite Free Fire Esports Unit from Bangladesh',
  /** Used for <title>; 49 characters, inside the ~60 character SERP window. */
  title: 'TEAM HEX — Free Fire Esports Team from Bangladesh',
  locale: 'en_US',
  language: 'en',
  /** Used by <meta name="theme-color"> and the manifest background. */
  themeColor: '#05070c',
  email: 'teamhexboys@gmail.com',
  author: 'NIROB',
  authorUrl: 'https://nirob120.netlify.app/',
  sport: 'Free Fire esports',
  region: 'Bangladesh',
  /**
   * Free Fire clan id, surfaced on the page and in structured data so the
   * entity is unambiguous to crawlers.
   */
  clanId: '3062659192',
  /** Recruitment thresholds — kept honest and identical to the join section. */
  requirements: { level: 'above 45', experience: 'over 2 years' },
};

/** Social / external profiles. Order is preserved in `sameAs`. */
export const profiles = {
  facebook: 'https://www.facebook.com/share/1BRqtJMLAs/',
  youtube: 'https://www.youtube.com/channel/UCRlWiSG-A6Y_pMNMLVYPLgQ',
  whatsappCommunity: 'https://chat.whatsapp.com/D52wjmfS7jS84aGA6bVN0v',
  whatsapp: 'https://wa.me/8801870516299',
  clan:
    'https://ffshare.garena.com/?region=BD&lang=en&action=locate_clan&clan_id=3062659192&version=OB53',
};

/** Every URL that should appear in `sameAs` for entity disambiguation. */
export const sameAs = [
  profiles.facebook,
  profiles.youtube,
  profiles.whatsappCommunity,
  profiles.whatsapp,
  profiles.clan,
];

/** Absolute asset URLs derived from `siteUrl` — crawlers cannot resolve relative OG images. */
export const assets = {
  socialCard: `${siteUrl}/images/social-card.jpg`,
  logo: `${siteUrl}/images/hex-wolf.webp`,
  crest: `${siteUrl}/images/hex-crest.webp`,
  banner: `${siteUrl}/images/hex-banner.webp`,
  manifest: `${siteUrl}/manifest.webmanifest`,
  favicon: `${siteUrl}/favicon.png`,
};

/** Dimensions of the shipped Open Graph card (verified against the real file). */
export const socialCard = { width: 1200, height: 630 };

/** Join the site origin to a path, tolerating a leading slash on either side. */
export const absolute = (path = '/') =>
  `${siteUrl}${String(path).startsWith('/') ? '' : '/'}${path}`;
