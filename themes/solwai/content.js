// SolwAI content model: the single editable fields, the lists, and the content a new site starts with.
// Home page copy is below; the six app pages' fields and lists are generated from apps.js.

import { f } from '../../src/theme-api.js';
import { APPS, listsOf } from './apps.js';

const ACCENTS = { solwai: 'SolwAI blue', organiser: 'Organiser teal', luggage: 'Luggage green', navy: 'Navy' };

const HOME_FIELDS = {
  'site.name': f.text('SolwAI'),
  'contact.email': f.text('[EMAIL]'),
  'contact.phone': f.text('[PHONE]'),
  'footer.text': f.text('© 2026 SolwAI · Solway Firth, Scotland'),
  'nav.cta': f.text('Book a free AI review'),
  'nav.cta.url': f.url('/#contact'),

  'meta.home.title': f.text('SolwAI · AI for small and medium businesses'),
  'meta.home.description': f.text('We help small and medium businesses in Dumfries & Galloway and across the UK turn AI into time saved and work done.'),

  'home.hero.label': f.text('AI for small and medium businesses · Solway Firth, Scotland'),
  'home.hero.title': f.text('Make AI pay its way in your business.'),
  'home.hero.text': f.textarea('We help small and medium businesses turn AI into time saved and work done. We find the right tools, fit them into the way you already work, and build apps with AI inside. From reading invoices to answering the phone, we handle sourcing, setup and support.'),
  'home.hero.cta': f.text('Book a free AI review'),
  'home.hero.cta.url': f.url('#contact'),
  'home.hero.cta2': f.text('See what AI can do'),
  'home.hero.cta2.url': f.url('#ai-services'),
  'home.hero.note': f.text('Based in Dumfries & Galloway. Working across the UK.'),
  'home.hero.image': f.image('/img/hero-solway.jpg'),
  'home.hero.image.alt': f.text(''),

  'home.why.label': f.text('Why now'),
  'home.why.title': f.text('Most businesses have tried AI. Few are getting value from it.'),
  'home.why.text': f.textarea('AI use has tripled in under three years, yet most firms use one or two tools lightly. The gains go to businesses that build AI into real work. Here\'s the picture locally and across the UK.'),
  'home.local.title': f.text('Dumfries & Galloway'),
  'home.local.badge': f.text('Local'),
  'home.national.title': f.text('United Kingdom'),
  'home.national.badge': f.text('National'),
  'home.callout.figure': f.text('64%'),
  'home.callout.text': f.textarea('of Scottish firms used AI in the last three months, but most only lightly. Access isn\'t the problem. Knowing where AI pays off is. UK firms name finding the right use, cost and lack of expertise as their top barriers.'),
  'home.callout.source': f.text('[5] Fraser of Allander, Q2 2026 · [4] ONS'),

  'home.services.label': f.text('AI services'),
  'home.services.title': f.text('From one quick win to a connected system, we make AI deliver.'),
  'home.services.text': f.textarea('We\'re independent, so we recommend what works. If an off-the-shelf tool fits, we set it up and train your team. If nothing fits, we build it. Start small and scale what proves its worth.'),

  'home.how.label': f.text('How we work'),
  'home.how.title': f.text('Four steps, no jargon.'),

  'home.apps.label': f.text('Apps with AI built in'),
  'home.apps.title': f.text('Ready-made apps, hosted for you.'),
  'home.apps.text': f.textarea('Proven in real day-to-day operations. We host them, so there\'s nothing to install or maintain. Prefer your own server? That works too.'),

  'home.offers.label': f.text('Services'),
  'home.offers.title': f.text('Additional services'),

  'home.contact.title': f.text('Find out where AI will save you time.'),
  'home.contact.text': f.textarea('Book a free 30-minute AI review. We\'ll look at how you work and suggest two or three ideas worth trying. No obligation.'),
  'home.contact.cta': f.text('Book a free AI review'),
  'home.contact.cta.url': f.url('mailto:[EMAIL]'),

  'home.sources.title': f.text('Sources'),
};

// Each app page: hero, section headings and texts, closing call to action, and its search-engine title.
function appFields(app) {
  const { key, hero, cta } = app;
  const fields = {
    [`meta.${key}.title`]: f.text(app.title),
    [`meta.${key}.description`]: f.text(hero.lead),
    [`${key}.hero.title`]: f.text(hero.title),
    [`${key}.hero.lead`]: f.textarea(hero.lead),
    [`${key}.hero.cta`]: f.text(hero.cta[0]),
    [`${key}.hero.cta.url`]: f.url(hero.cta[1]),
    [`${key}.hero.cta2`]: f.text(hero.cta2[0]),
    [`${key}.hero.cta2.url`]: f.url(hero.cta2[1]),
    [`${key}.cta.title`]: f.text(cta.title),
    [`${key}.cta.text`]: f.textarea(cta.text),
    [`${key}.cta.button`]: f.text(cta.button[0]),
    [`${key}.cta.button.url`]: f.url(cta.button[1]),
  };
  (app.legal ?? []).forEach(([words, url], i) => {
    fields[`${key}.legal.${i + 1}`] = f.text(words);
    fields[`${key}.legal.${i + 1}.url`] = f.url(url);
  });
  for (const s of app.sections) {
    if (s.title !== undefined) fields[`${key}.${s.type}.title`] = f.text(s.title);
    if (s.body !== undefined) fields[`${key}.${s.type}.body`] = f.rich(s.body);
    if (s.text !== undefined) fields[`${key}.${s.type}.text`] = f.textarea(s.text);
  }
  return fields;
}

export const FIELDS = { ...HOME_FIELDS, ...Object.assign({}, ...APPS.map(appFields)) };

const HOME_COLLECTIONS = {
  stats: {
    label: 'Figure',
    fields: {
      region: { type: 'select', label: 'Panel', options: { local: 'Dumfries & Galloway', national: 'United Kingdom' }, default: 'local' },
      figure: { type: 'text', label: 'Figure', default: '0%' },
      text: { type: 'textarea', label: 'What it means', default: 'Describe the figure.' },
      source: { type: 'text', label: 'Source (e.g. [1] ONS, 2024)', default: '' },
    },
  },
  services: {
    label: 'AI service',
    fields: {
      accent: { type: 'select', label: 'Accent colour', options: ACCENTS, default: 'solwai' },
      label: { type: 'text', label: 'Label', default: 'Label' },
      title: { type: 'text', label: 'Title', default: 'New service' },
      text: { type: 'textarea', label: 'Text', default: '' },
      tags: { type: 'list', label: 'Tags (comma-separated)', default: '' },
    },
  },
  steps: {
    label: 'Step',
    fields: {
      title: { type: 'text', label: 'Title', default: 'New step' },
      text: { type: 'textarea', label: 'Text', default: '' },
    },
  },
  apps: {
    label: 'App',
    fields: {
      name: { type: 'text', label: 'Name (a hyphen is set in a lighter font)', default: 'New app' },
      mark: { type: 'select', label: 'Mark', options: { drum: 'Drum', organiser: 'This-Organiser', patrician: 'Unseen', luggage: 'Luggage', book: 'B-ook', gleam: 'Gleam', solwai: 'SolwAI' }, default: 'solwai' },
      label: { type: 'text', label: 'Label', default: '' },
      text: { type: 'textarea', label: 'Text', default: '' },
      more: { type: 'text', label: 'Link words', default: 'Read more →' },
      url: { type: 'url', label: 'Link address', default: '' },
    },
  },
  offers: {
    label: 'Service',
    fields: {
      accent: { type: 'select', label: 'Accent colour', options: ACCENTS, default: 'solwai' },
      label: { type: 'text', label: 'Label', default: 'Label' },
      title: { type: 'text', label: 'Title', default: 'New service' },
      text: { type: 'textarea', label: 'Text', default: '' },
      tags: { type: 'list', label: 'Tags (comma-separated)', default: '' },
    },
  },
  sources: {
    label: 'Source',
    fields: { text: { type: 'textarea', label: 'Citation', default: 'Publisher, title, date.' } },
  },
};

// The lists an app page can have, named <key>Steps, <key>Features, <key>Points and <key>Panels.
const APP_LISTS = {
  Steps: { label: 'Step', fields: { title: { type: 'text', label: 'Title', default: 'New step' }, text: { type: 'rich', label: 'Text', default: '<p>Describe the step.</p>' } } },
  Features: {
    label: 'Feature',
    fields: {
      title: { type: 'text', label: 'Title', default: 'New feature' },
      text: { type: 'rich', label: 'Text', default: '<p>Describe the feature.</p>' },
      wide: { type: 'bool', label: 'Full width', default: false },
    },
  },
  Points: { label: 'Point', fields: { title: { type: 'text', label: 'Lead words', default: 'New point' }, text: { type: 'rich', label: 'Text', default: '' } } },
  Panels: {
    label: 'Panel',
    fields: {
      label: { type: 'text', label: 'Label (optional)', default: '' },
      title: { type: 'text', label: 'Title', default: 'New panel' },
      text: { type: 'textarea', label: 'Text', default: '' },
    },
  },
};

const appLists = (app) => Object.fromEntries(listsOf(app).map((list) => [`${app.key}${list}`, structuredClone(APP_LISTS[list])]));

export const COLLECTIONS = { ...HOME_COLLECTIONS, ...Object.assign({}, ...APPS.map(appLists)) };

const p = (s) => (s && !s.startsWith('<') ? `<p>${s}</p>` : s);

const HOME_SEED = {
  stats: [
    { region: 'local', figure: '7,175', text: 'private sector businesses in the region, the backbone of the local economy', source: '[1] ONS via D&G Council, 2024' },
    { region: 'local', figure: '83%', text: 'of South of Scotland businesses sit in the lower half of the digital maturity index (72% across Scotland)', source: '[2] SOSE Digital Economy Business Survey, 2021' },
    { region: 'local', figure: '81%', text: 'of South of Scotland businesses have no plan for how they use digital technology (73% across Scotland)', source: '[2] SOSE Digital Economy Business Survey, 2021' },
    { region: 'local', figure: '−9.8%', text: 'projected fall in the region\'s working-age population by 2033. Fewer people means work has to get smarter.', source: '[1] NRS projections via D&G Council' },
    { region: 'national', figure: '99.85%', text: 'of the UK\'s 5.7 million private businesses are SMEs, providing 60% of private sector jobs', source: '[3] DBT Business Population Estimates, 2025' },
    { region: 'national', figure: '12% → 35%', text: 'of businesses with 10+ staff using AI, from late 2023 to June 2026. 28% for firms under 10.', source: '[4] ONS, AI in UK businesses, 2026' },
    { region: 'national', figure: '10%', text: 'of businesses using AI use it extensively. Most stop at one or two tools.', source: '[4] ONS, AI in UK businesses, 2026' },
    { region: 'national', figure: '55% vs 35%', text: 'of workers use AI at work, but only 35% of businesses have formally adopted it', source: '[4] ONS, AI in UK businesses, 2026' },
  ],
  services: [
    { accent: 'solwai', label: 'Start here', title: 'Document processing', text: 'Invoices, receipts, delivery notes, forms and emails read, checked and filed automatically. Less typing, fewer errors.', tags: 'Invoices, Forms, Inbox' },
    { accent: 'organiser', label: 'Everyday work', title: 'AI in your workflow', text: 'The right AI assistants, set up safely and taught to your team. Templates for your weekly jobs and a clear policy on what\'s allowed.', tags: 'Setup, Training, Policy' },
    { accent: 'luggage', label: 'Customer-facing', title: 'Phones, bookings and enquiries', text: 'An AI receptionist that answers calls around the clock, takes bookings, handles common questions and passes the rest to you.', tags: 'Phone, Bookings, Web chat' },
    { accent: 'navy', label: 'Advanced', title: 'Connected systems', text: 'AI linked to your tills, stock, CRM and spreadsheets, producing reports, forecasts and alerts automatically.', tags: 'EPOS, Reporting, Automation' },
  ],
  steps: [
    { title: 'Review', text: 'A free conversation about where your time goes and which jobs AI can take off your plate.' },
    { title: 'Source', text: 'We compare off-the-shelf tools and our own apps, and recommend what fits your budget.' },
    { title: 'Implement', text: 'We set it up, connect it to your systems and data, and make it secure and UK GDPR-ready.' },
    { title: 'Support', text: 'We train your team, measure the results and adjust as you grow. You always deal with a real person.' },
  ],
  apps: [
    { name: 'Drum', mark: 'drum', label: 'Café loyalty · No app', text: 'A digital stamp card for independent cafés. Customers scan a QR code to join, staff stamp from any phone, and your dashboard shows who keeps coming back.', url: '/drum' },
    { name: 'This-Organiser', mark: 'organiser', label: 'Tasks · AI planning', text: 'Tells you when to start each task, not just when it\'s due. Capture tasks in a line and let AI plan a realistic day.', url: '/this-organiser' },
    { name: 'Unseen', mark: 'patrician', label: 'Backup', text: 'Back up Windows, Linux and Docker machines from one web dashboard, no VPN needed. Restore files in a few clicks.', url: '/unseen' },
    { name: 'Luggage', mark: 'luggage', label: 'Storage', text: 'Turns local disks, OneDrive and Google Drive into one drive with one file tree, and gives every file a permanent shareable link.', url: '/luggage' },
    { name: 'B-ook', mark: 'book', label: 'Bookings · Payments', text: 'Online booking for pitches, rooms and other resources. Customers find a slot, book and pay online, staff run everything from one calendar, and an AI assistant answers booking questions.', url: '/b-ook' },
    { name: 'Gleam', mark: 'gleam', label: 'Websites · Edit in place', text: 'A website your staff edit right on the page. Click any text or photo to change it, and every change is recorded, so anything can be put back.', url: '/gleam' },
  ],
  offers: [
    { accent: 'solwai', label: 'Consultancy', title: 'Business process, systems and AI', text: 'A clear view of how your business runs, where your systems hold you back and where AI will pay off.', tags: 'Business process, Systems, AI' },
    { accent: 'luggage', label: 'Hosting', title: 'Web, files, email and domains', text: 'Websites, file storage, email and domains, hosted and managed by us with one point of contact.', tags: 'Web, Files, Email, Domains' },
  ],
  sources: [
    { text: 'Dumfries & Galloway Council, Local Employability and Skills Partnership briefing, April 2025 (ONS business counts 2024; NRS population projections).' },
    { text: 'South of Scotland Enterprise, Digital Economy Business Survey 2021 (Ipsos MORI, 610 South of Scotland businesses).' },
    { text: 'Department for Business and Trade, Business population estimates for the UK and regions 2025.' },
    { text: 'Office for National Statistics, Artificial intelligence in UK businesses: 2023 to 2026 (July 2026).' },
    { text: 'Fraser of Allander Institute, Scottish Business Monitor Q2 2026 (July 2026).' },
  ],
};

function appSeed(app) {
  const seed = {};
  const lists = listsOf(app);
  if (lists.includes('Steps')) seed[`${app.key}Steps`] = app.steps.map(([title, text]) => ({ title, text: p(text) }));
  if (lists.includes('Features')) seed[`${app.key}Features`] = app.features.map(([title, text, opts]) => ({ title, text: p(text), wide: !!opts?.wide }));
  if (lists.includes('Points')) seed[`${app.key}Points`] = app.points.map(([title, text]) => ({ title, text: p(text) }));
  if (lists.includes('Panels')) seed[`${app.key}Panels`] = app.panels.map(([label, title, text]) => ({ label, title, text }));
  return seed;
}

export const SEED = { ...HOME_SEED, ...Object.assign({}, ...APPS.map(appSeed)) };
