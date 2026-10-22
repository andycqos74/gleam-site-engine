// SolwAI theme: the SolwAI marketing site (an AI services home page plus a page per app), from the SolwAI design
// handover. See README "Writing a theme" for what each key means.

import { FIELDS, COLLECTIONS, SEED } from './content.js';
import { APPS } from './apps.js';
import { layout, head, notFound } from './pages/layout.js';
import { home } from './pages/home.js';
import { appPage } from './pages/app.js';

export default {
  name: 'SolwAI',
  lang: 'en-GB',
  timeZone: 'Europe/London',

  fields: FIELDS,
  collections: COLLECTIONS,
  seed: SEED,
  contentUpdates: [],

  pages: {
    '/': { key: 'home', render: home },
    ...Object.fromEntries(APPS.map((app) => [app.path, { key: app.key, render: appPage(app) }])),
  },
  layout,
  head,
  notFound,

  stylesheets: ['/css/solwai.css'],
  scripts: ['/js/solwai.js'],
  favicon: '/img/solwai-mark.svg',
  shareImage: '/img/hero-solway.jpg',
  adminLogo: '/img/solwai-mark.svg',
};
