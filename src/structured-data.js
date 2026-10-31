/**
 * Builds the JSON-LD structured data for TEAM HEX.
 *
 * Everything is derived from `src/data.js` and `src/site.js`, so the roster,
 * match films and brand links in the structured data can never disagree with
 * what is actually rendered on the page.
 *
 * Shape: one top-level `SportsTeam` node plus an `@graph` of supporting
 * entities (WebSite, WebPage, Organization, six Person nodes, one VideoObject
 * per match film, ImageObject and a FAQPage). Keeping it in a single
 * `<script type="application/ld+json">` block matches the existing test
 * contract in `tests/pro.spec.js` and avoids duplicate-entity ambiguity.
 */

import { players, videos, gallery, links } from './data.js';
import { site, profiles, sameAs, assets, socialCard } from './site.js';

const teamId = `${site.url}/#team`;
const websiteId = `${site.url}/#website`;
const webpageId = `${site.url}/#webpage`;
const organizationId = `${site.url}/#organization`;

const personId = id => `${site.url}/#operator-${id}`;
const videoId = id => `${site.url}/#film-${id}`;

/** Absolute URL of a locally hosted archive image. */
const imageUrl = name => `${site.url}/images/${name}.webp`;

/**
 * One `Person` node per operator. The full biography travels here rather than
 * as hidden page text, which is the honest way to hand that copy to crawlers.
 */
function personNodes() {
  return players.map(player => ({
    '@type': 'Person',
    '@id': personId(player.id),
    name: player.name,
    alternateName: player.ign,
    jobTitle: player.role,
    description: player.summary,
    knowsAbout: ['Free Fire', `${player.role} role`, 'esports teamwork'],
    image: {
      '@type': 'ImageObject',
      url: imageUrl(player.id),
      contentUrl: imageUrl(player.id),
      caption: `${player.name} (${player.ign}), ${player.role} for TEAM HEX`,
    },
    memberOf: { '@id': teamId },
    // The deep link the share/copy-link action already produces.
    url: `${site.url}/?player=${player.id}#squad`,
  }));
}

/**
 * One `VideoObject` per match film.
 *
 * `uploadDate` is deliberately omitted: Google requires it for video rich
 * results and inventing a date would be worse than earning no rich result.
 * Add `published: 'YYYY-MM-DD'` to an entry in `src/data.js` and it is picked
 * up automatically.
 */
function videoNodes() {
  return videos.map(video => ({
    '@type': 'VideoObject',
    '@id': videoId(video.id),
    name: video.title,
    description: `${video.fullTitle || video.title} — ${video.category} match film from the TEAM HEX archive.`,
    thumbnailUrl: imageUrl(video.id),
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.id}`,
    publisher: { '@id': organizationId },
    inLanguage: site.language,
    isFamilyFriendly: true,
    // Present only when the real upload date is known (see note above).
    ...(video.published ? { uploadDate: video.published } : {}),
  }));
}

/** Real questions the page genuinely answers in the join/contact sections. */
function faqNode() {
  const roles = [...new Set(players.map(player => player.role))].join(', ');
  return {
    '@type': 'FAQPage',
    '@id': `${site.url}/#faq`,
    inLanguage: site.language,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are the requirements to join TEAM HEX?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `TEAM HEX recruits Free Fire players from the BD region with a player level ${site.requirements.level} and experience ${site.requirements.experience}. Eligibility is checked on the site; recruitment contact is ${site.email}.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How many players are on TEAM HEX?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `TEAM HEX fields six operators across five combat roles: ${roles}. The roster is ${players.map(p => `${p.name} (${p.ign})`).join(', ')}.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Which game and region does TEAM HEX compete in?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${site.sport} in the ${site.region} (BD) region, Free Fire clan ID ${site.clanId}.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How can I contact TEAM HEX?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Email ${site.email}, message the WhatsApp community, or reach the team through Facebook and the HEX-CL4W YouTube channel.`,
        },
      },
    ],
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.dateModified]  ISO date for `WebPage.dateModified`.
 * @returns {object} A JSON-LD object ready to serialize into one script tag.
 */
export function buildStructuredData({ dateModified } = {}) {
  const logo = {
    '@type': 'ImageObject',
    url: assets.logo,
    contentUrl: assets.logo,
    caption: `${site.name} blue wolf emblem`,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': teamId,
    name: site.name,
    alternateName: site.alternateName,
    url: site.url,
    logo,
    image: {
      '@type': 'ImageObject',
      url: assets.socialCard,
      contentUrl: assets.socialCard,
      width: socialCard.width,
      height: socialCard.height,
      caption: `${site.name} — ${site.slogan}`,
    },
    sport: site.sport,
    description: site.description,
    slogan: site.slogan,
    email: `mailto:${site.email}`,
    foundingLocation: {
      '@type': 'Place',
      name: site.region,
      address: { '@type': 'PostalAddress', addressCountry: 'BD' },
    },
    areaServed: { '@type': 'Country', name: site.region },
    sameAs,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'recruitment',
      email: site.email,
      availableLanguage: ['en', 'bn'],
      areaServed: 'BD',
    },
    memberOf: { '@id': organizationId },
    athlete: players.map(player => ({ '@id': personId(player.id) })),
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: site.name,
        alternateName: site.alternateName,
        url: site.url,
        logo,
        email: `mailto:${site.email}`,
        description: site.description,
        sameAs,
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: site.url,
        name: site.legalName,
        alternateName: site.alternateName,
        description: site.description,
        inLanguage: site.language,
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'WebPage',
        '@id': webpageId,
        url: site.url,
        name: `${site.name} — ${site.slogan}`,
        description: site.description,
        inLanguage: site.language,
        isPartOf: { '@id': websiteId },
        about: { '@id': teamId },
        primaryImageOfPage: { '@type': 'ImageObject', url: assets.socialCard },
        ...(dateModified ? { dateModified } : {}),
      },
      ...personNodes(),
      ...videoNodes(),
      {
        '@type': 'ImageGallery',
        '@id': `${site.url}/#gallery`,
        name: 'TEAM HEX tactical archive',
        description:
          'In-game archive photography and original TEAM HEX brand assets from the Free Fire BD region.',
        url: `${site.url}/#highlights`,
        isPartOf: { '@id': webpageId },
        associatedMedia: gallery.map(image => ({
          '@type': 'ImageObject',
          name: image.title,
          description: `${image.subtitle} — ${image.title}`,
          contentUrl: imageUrl(image.src),
          url: imageUrl(image.src),
        })),
      },
      faqNode(),
    ],
  };
}

/** Compact single-line JSON-LD, safe to embed inside a `<script>` tag. */
export function structuredDataScript({ dateModified } = {}) {
  const json = JSON.stringify(buildStructuredData({ dateModified }))
    // Never allow the payload to terminate the script element early.
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * JSON-LD for one section route page.
 *
 * Each route is a real URL, so it gets its own `WebPage` node, a
 * `BreadcrumbList` back to the homepage, and — where the section actually
 * contains them — the same `Person` / `VideoObject` / `ImageGallery` entities
 * the homepage declares. Reusing those builders is what keeps a player's
 * description identical on `/` and `/squad`.
 *
 * @param {object} route  Entry from `src/routes.js`.
 * @param {object} [options]
 * @param {string} [options.dateModified]
 */
export function buildRouteStructuredData(route, { dateModified } = {}) {
  const pageUrl = `${site.url}${route.path}`;
  const pageId = `${pageUrl}#webpage`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;

  const logo = {
    '@type': 'ImageObject',
    url: assets.logo,
    contentUrl: assets.logo,
    caption: `${site.name} blue wolf emblem`,
  };

  const trail = [
    { name: 'Home', url: `${site.url}/` },
    { name: route.crumb, url: pageUrl },
  ];

  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: site.name,
      alternateName: site.alternateName,
      url: site.url,
      logo,
      email: `mailto:${site.email}`,
      description: site.description,
      sameAs,
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      url: site.url,
      name: site.legalName,
      inLanguage: site.language,
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: trail.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    },
    // A compact definition of the team entity. A bare `{ '@id': teamId }`
    // reference would leave the `about` pointer above resolving to nothing
    // self-describing on this page.
    {
      '@type': 'SportsTeam',
      '@id': teamId,
      name: site.name,
      alternateName: site.alternateName,
      url: site.url,
      sport: site.sport,
      slogan: site.slogan,
      logo,
      sameAs,
    },
  ];

  if (route.id === 'squad') graph.push(...personNodes());

  if (route.id === 'highlights') {
    graph.push(...videoNodes());
    graph.push({
      '@type': 'ImageGallery',
      '@id': `${pageUrl}#gallery`,
      name: 'TEAM HEX tactical archive',
      description:
        'In-game archive photography and original TEAM HEX brand assets from the Free Fire BD region.',
      url: pageUrl,
      isPartOf: { '@id': pageId },
      associatedMedia: gallery.map(image => ({
        '@type': 'ImageObject',
        name: image.title,
        description: `${image.subtitle} — ${image.title}`,
        contentUrl: imageUrl(image.src),
        url: imageUrl(image.src),
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': pageId,
    url: pageUrl,
    name: route.title,
    description: route.description,
    inLanguage: site.language,
    isPartOf: { '@id': websiteId },
    about: { '@id': teamId },
    breadcrumb: { '@id': breadcrumbId },
    primaryImageOfPage: { '@type': 'ImageObject', url: assets.socialCard },
    ...(dateModified ? { dateModified } : {}),
    '@graph': graph,
  };
}

/** Serialized `<script>` wrapper for a route page's JSON-LD. */
export function routeStructuredDataScript(route, { dateModified } = {}) {
  const json = JSON.stringify(buildRouteStructuredData(route, { dateModified }))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}

/** Convenience re-export so the sitemap generator shares the same data. */
export { players, videos, gallery, links, profiles };
