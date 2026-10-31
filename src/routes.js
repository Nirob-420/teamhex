/**
 * Route table for the section pages.
 *
 * The homepage stays the full cinematic one-page experience. These routes give
 * the four read-only content sections real, independently indexable URLs with
 * their own title, description, canonical and JSON-LD, plus genuine internal
 * links between them.
 *
 * `join` and `contact` are deliberately NOT prerendered pages: they contain
 * working forms (client-side eligibility check, prefilled Gmail draft,
 * device-local draft autosave). Duplicating that logic would risk silent
 * breakage, so those URLs redirect to the homepage anchors where the forms
 * already work. They stay in `sections` so breadcrumbs and prev/next links are
 * complete, and they are excluded from the sitemap.
 */

import { site } from './site.js';

/** Every section, in on-page order, with the URL that reaches it. */
export const sections = [
  { id: 'home', path: '/', label: 'Home', crumb: 'Home' },
  { id: 'squad', path: '/squad', label: 'The squad', crumb: 'The squad' },
  { id: 'about', path: '/about', label: 'Our story', crumb: 'Our story' },
  { id: 'protocol', path: '/protocol', label: 'The HEX protocol', crumb: 'The protocol' },
  { id: 'highlights', path: '/highlights', label: 'Highlights', crumb: 'Highlights' },
  { id: 'join', path: '/join', label: 'Join the unit', crumb: 'Join the unit' },
  { id: 'contact', path: '/contact', label: 'Contact', crumb: 'Contact' },
];

/** Sections that become real prerendered pages (and therefore sitemap entries). */
export const routes = [
  {
    id: 'squad',
    path: '/squad',
    file: 'squad.html',
    navLabel: 'The squad',
    crumb: 'The squad',
    title: 'The Squad — Six Free Fire Operators | TEAM HEX',
    description:
      'Meet the six operators behind TEAM HEX: Niloy, Nirob, Alif, Rian, Muhit and Tasir. Assault, support and precision roles in the Free Fire BD region.',
    ogTitle: 'The TEAM HEX Squad — Six Operators, Five Combat Roles',
  },
  {
    id: 'about',
    path: '/about',
    file: 'about.html',
    navLabel: 'Our story',
    crumb: 'Our story',
    title: 'Our Story — Built on Trust, Driven by Fire | TEAM HEX',
    description:
      'TEAM HEX is a competitive Free Fire esports organization from Bangladesh, driven by passion, discipline and the pursuit of excellence. Read the HEX DNA.',
    ogTitle: 'The TEAM HEX Story — Built on Trust. Driven by Fire.',
  },
  {
    id: 'protocol',
    path: '/protocol',
    file: 'protocol.html',
    navLabel: 'The HEX protocol',
    crumb: 'The protocol',
    title: 'The HEX Protocol — Prepare, Unite, Dominate | TEAM HEX',
    description:
      'The three-stage HEX protocol: lock in discipline before the drop, move as one across six players, and leave a mark. The mindset behind TEAM HEX.',
    ogTitle: 'The HEX Protocol — Prepare. Unite. Dominate.',
  },
  {
    id: 'highlights',
    path: '/highlights',
    file: 'highlights.html',
    navLabel: 'Highlights',
    crumb: 'Highlights',
    title: 'Highlights — Match Films & Archive | TEAM HEX',
    description:
      'Watch four TEAM HEX Free Fire match films and browse eight archive images: Zero Gravity ESP, Team System, Team 4X and the last-zone tournament battle.',
    ogTitle: 'TEAM HEX Highlights — Match Films and Archive',
  },
];

/** Sections served by a redirect rather than their own page. */
export const redirects = [
  { id: 'join', path: '/join', anchor: '/#join' },
  { id: 'contact', path: '/contact', anchor: '/#contact' },
];

/** True when a section id has its own prerendered page. */
export const hasPage = id => routes.some(route => route.id === id);

/** The route definition for a section id, or undefined. */
export const routeFor = id => routes.find(route => route.id === id);

/** Previous/next sections for the pager on a route page. */
export function neighbours(id) {
  const index = sections.findIndex(section => section.id === id);
  return {
    prev: index > 0 ? sections[index - 1] : null,
    next: index >= 0 && index < sections.length - 1 ? sections[index + 1] : null,
  };
}

/** Absolute URL for a section path. */
export const sectionUrl = path => `${site.url}${path === '/' ? '/' : path}`;
