// SolwAI theme: the SolwAI marketing site (an AI services home page plus a page per app), from the SolwAI design
// handover. See README "Writing a theme" for what each key means.

import { FIELDS, COLLECTIONS, SEED, CONTACT_TOPICS } from './content.js';
import { APPS } from './apps.js';
import { layout, head, notFound, staticPage } from './pages/layout.js';
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
  staticPage,
  // The contact form is in the home page's contact panel; messages go to Admin > Messages.
  contact: { path: '/', topics: CONTACT_TOPICS },

  stylesheets: ['/css/solwai.css'],
  scripts: ['/js/solwai.js'],
  favicon: '/img/solwai-mark.svg',
  shareImage: '/img/hero-solway.jpg',
  // The home page hero's network map plays as a live animation (see the engine's src/anim): the cities sparkle
  // and flare, pulses run out from the hub, stars twinkle and the map drifts with a little parallax. The light
  // positions in img/anim/hero-solway.json were found automatically. Editors can change or remove it with the
  // photo's "Animate" option; a replacement photo starts still.
  animations: {
    '/img/hero-solway.jpg': {
      analysis: '/img/anim/hero-solway.json',
      config: {
        version: 1, loopSeconds: 8, speed: 0.8, intensity: 0.6, pauseButton: true,
        effects: [
          { type: 'drift', zoom: 0.02, panX: 14, panY: 8 },
          { type: 'parallax', strength: 1, pointer: true, autoSway: true },
          { type: 'twinkle', source: 'stars', density: 0.5, depth: 0.7 },
          { type: 'sparkle', source: 'nodes', flare: true, depth: 1 },
          { type: 'pulses', from: 'hub', to: 'nodes', minArea: 40, depth: 1 },
        ],
      },
    },
  },
  adminLogo: '/img/solwai-mark.svg',
};
