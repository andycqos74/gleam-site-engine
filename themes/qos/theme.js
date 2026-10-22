// QoS Community Trust theme ("Winding Route" design). This manifest tells the engine everything about the site:
// its editable content, its pages, and its look. See README "Writing a theme".

import { FIELDS, SEED, CONTENT_UPDATES } from './content.js';
import { COLLECTIONS, COLOURS, CONTACT_TOPICS } from './collections.js';
import { layout, head, notFound } from './pages/layout.js';
import { home } from './pages/home.js';
import { about } from './pages/about.js';
import { programmes } from './pages/programmes.js';
import { shop } from './pages/shop.js';
import { gallery } from './pages/gallery.js';
import { contact } from './pages/contact.js';
import { privacy } from './pages/privacy.js';
import { newsPage, articlePage } from './pages/news.js';

// News articles get a page each at /news/<id>-<headline>.
COLLECTIONS.news.itemPage = {
  base: '/news',
  titleField: 'title',
  pageKey: 'news',
  render: articlePage,
  meta: (a, k) => ({ title: `${a.title} | ${k.value('site.name')}`, description: a.summary, image: a.image, bodyClass: 'article' }),
};

export default {
  name: 'QoS Community Trust',
  lang: 'en-GB',
  timeZone: 'Europe/London',

  // Content model
  fields: FIELDS,
  collections: COLLECTIONS,
  seed: SEED,
  contentUpdates: CONTENT_UPDATES,
  colours: COLOURS,

  // Pages: path -> key (used for meta.<key>.* fields, nav highlighting and body class) and render(k, extra)
  pages: {
    '/': { key: 'home', render: home },
    '/about': { key: 'about', render: about },
    '/programmes': { key: 'programmes', render: programmes },
    '/shop': { key: 'shop', render: shop },
    '/news': { key: 'news', render: newsPage },
    '/gallery': { key: 'gallery', render: gallery },
    '/contact': { key: 'contact', render: contact },
    '/privacy': { key: 'privacy', render: privacy },
  },
  layout,
  head,
  notFound,
  contact: { path: '/contact', topics: CONTACT_TOPICS },

  // Assets, served from this theme's public/ folder at the site root
  stylesheets: ['/css/site.css'],
  scripts: ['/js/site.js'],
  favicon: '/img/trust-logo.png',
  shareImage: '/img/trust-logo.png',
  adminLogo: '/img/trust-logo.png',
  csp: { frameSrc: ['https://www.openstreetmap.org'] },
};
