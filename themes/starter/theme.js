// Starter theme: a small, plain site to copy when building a new design on the engine.
// The manifest below is everything the engine needs; see README "Writing a theme".

import { FIELDS, COLLECTIONS, SEED, CONTACT_TOPICS } from './content.js';
import { layout, home, about, posts, post, contact, notFound } from './pages.js';

COLLECTIONS.posts.itemPage = {
  base: '/posts',
  titleField: 'title',
  render: post,
  meta: (p, k) => ({ title: `${p.title} | ${k.value('site.name')}`, description: p.summary, image: p.image }),
};

export default {
  name: 'Riverside Community Hub',
  lang: 'en-GB',
  timeZone: 'Europe/London',

  fields: FIELDS,
  collections: COLLECTIONS,
  seed: SEED,
  contentUpdates: [],

  pages: {
    '/': { key: 'home', render: home },
    '/about': { key: 'about', render: about },
    '/posts': { key: 'posts', render: posts },
    '/contact': { key: 'contact', render: contact },
  },
  layout,
  notFound,
  contact: { path: '/contact', topics: CONTACT_TOPICS },

  stylesheets: ['/css/starter.css'],
  scripts: [],
  favicon: '/img/logo.svg',
  adminLogo: '/img/logo.svg',
};
