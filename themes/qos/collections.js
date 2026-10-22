// The QoS theme's editable lists ("collections") such as programmes and gallery photos, and the fixed choices
// their dropdowns offer. Single fields are in content.js.

export const COLOURS = {
  gold: { label: 'Gold', bg: '#f6c635', ink: '#14173a' },
  blue: { label: 'Poster Blue', bg: '#1f5fbf', ink: '#ffffff' },
  orange: { label: 'Orange', bg: '#f26b3a', ink: '#14173a' },
  green: { label: 'Pitch Green', bg: '#2e9e5b', ink: '#ffffff' },
  navy: { label: 'Navy', bg: '#1e2252', ink: '#ffffff' },
  sky: { label: 'Sky', bg: '#dce7f6', ink: '#1e2252' },
};

export const STAGES = {
  under5: 'Under 5s',
  primary: 'Primary school',
  teens: 'Teens & young adults',
  adults: 'Adults & 50+',
};

export const SHOP_CATEGORIES = {
  book: { label: 'Camps & Clubs', colour: 'gold', action: 'Book' },
  party: { label: 'Parties', colour: 'orange', action: 'Enquire' },
  kit: { label: 'Kit', colour: 'blue', action: 'Add' },
  gift: { label: 'Gifts', colour: 'green', action: 'Add' },
};

export const GALLERY_CATEGORIES = {
  saturday: { label: 'Saturday Club', colour: 'gold' },
  camps: { label: 'Camps & Clubs', colour: 'orange' },
  girls: { label: "Girls' Football", colour: 'blue' },
  matchday: { label: 'Matchday', colour: 'navy' },
  tennis: { label: 'Tennis & KGV', colour: 'green' },
  schools: { label: 'In Schools', colour: 'sky' },
  community: { label: 'Community', colour: 'orange' },
};

export const GALLERY_SIZES = { s: 'Small (1×1)', wide: 'Wide (2×1)', tall: 'Tall (1×2)', l: 'Large (2×2)' };
export const GALLERY_SHAPES = { rect: 'Rounded rectangle', circle: 'Circle', archTop: 'Arch (top)', archBottom: 'Arch (bottom)' };

export const CONTACT_TOPICS = ['Programmes', 'Bookings', 'Parties', 'Volunteering', 'Partnerships'];

const colourOptions = (keys) => Object.fromEntries(keys.map((k) => [k, COLOURS[k].label]));
const mapOptions = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v : v.label]));

// Each list: label, fields ({ type, label, default, options }) and optionally
//   sortBy: '<field>'      newest first by that field, instead of the order editors arrange
//   publishDate: '<field>' items are hidden from visitors until that date
//   itemPage               a page per item (set in theme.js)
// Field types are listed in src/content/types.js. Every list also gets a "Hide from visitors" switch.
export const COLLECTIONS = {
  news: {
    label: 'News article',
    sortBy: 'date',
    publishDate: 'date',
    fields: {
      title: { type: 'text', label: 'Headline', default: 'New article' },
      date: { type: 'date', label: 'Publish date (visitors see it from this day; a future date keeps it hidden until then)', default: 'today' },
      tag: { type: 'text', label: 'Tag (e.g. News, Camps, Matchday)', default: 'News' },
      summary: { type: 'textarea', label: 'Summary (shown on the cards)', default: '' },
      image: { type: 'image', label: 'Photo', default: '' },
      body: { type: 'rich', label: 'Article text', default: '<p>Write the article here.</p>' },
    },
  },
  journey: {
    label: 'Journey stop',
    fields: {
      stage: { type: 'text', label: 'Stage name', default: 'New stage' },
      ages: { type: 'text', label: 'Ages', default: 'Ages' },
      blurb: { type: 'textarea', label: 'Description', default: '' },
      short: { type: 'text', label: 'Short description (phones)', default: '' },
      chips: { type: 'list', label: 'Programmes (comma-separated)', default: '' },
      colour: { type: 'select', label: 'Circle colour', options: colourOptions(['gold', 'orange', 'sky', 'green', 'blue']), default: 'gold' },
      link: { type: 'url', label: 'Link for the programme chips', default: '/programmes' },
    },
  },
  programmes: {
    label: 'Programme',
    fields: {
      name: { type: 'text', label: 'Name', default: 'New programme' },
      typeTag: { type: 'text', label: 'Tag', default: 'New' },
      stage: { type: 'select', label: 'Age group (for the filter)', options: STAGES, default: 'primary' },
      blurb: { type: 'textarea', label: 'Description', default: '' },
      when: { type: 'text', label: 'When', default: 'TBC' },
      where: { type: 'text', label: 'Where', default: 'TBC' },
      price: { type: 'text', label: 'Price', default: 'TBC' },
      image: { type: 'image', label: 'Photo', default: '' },
      bookLabel: { type: 'text', label: 'Book button text', default: 'Book Now' },
      bookUrl: { type: 'url', label: 'Book button link (blank = default booking link)', default: '' },
      moreUrl: { type: 'url', label: '"Find Out More" link', default: '/contact?topic=Programmes' },
      featured: { type: 'bool', label: 'Show on the homepage', default: false },
      homeTag: { type: 'text', label: 'Homepage card tag', default: '' },
    },
  },
  stories: {
    label: 'Story',
    fields: {
      name: { type: 'text', label: 'Name', default: 'Participant name' },
      from: { type: 'text', label: 'Started at', default: '' },
      to: { type: 'text', label: 'Now', default: '' },
      quote: { type: 'textarea', label: 'Quote', default: '' },
      image: { type: 'image', label: 'Photo', default: '' },
    },
  },
  timeline: {
    label: 'Milestone',
    fields: {
      year: { type: 'text', label: 'Year', default: '20XX' },
      text: { type: 'textarea', label: 'What happened', default: '' },
    },
  },
  pillars: {
    label: 'Pillar',
    fields: {
      tag: { type: 'text', label: 'Tag', default: 'Tag' },
      colour: { type: 'select', label: 'Tag colour', options: colourOptions(['gold', 'green', 'orange', 'blue']), default: 'gold' },
      title: { type: 'text', label: 'Title', default: 'Title' },
      body: { type: 'textarea', label: 'Text', default: '' },
    },
  },
  team: {
    label: 'Team member',
    fields: {
      name: { type: 'text', label: 'Name', default: 'Staff name' },
      role: { type: 'text', label: 'Role', default: 'Role' },
      image: { type: 'image', label: 'Headshot', default: '' },
    },
  },
  vacancies: {
    label: 'Vacancy',
    fields: {
      title: { type: 'text', label: 'Job title', default: 'Job title' },
      hours: { type: 'text', label: 'Hours', default: '' },
      summary: { type: 'textarea', label: 'Summary', default: '' },
      closing: { type: 'text', label: 'Closing date', default: '' },
      applyLabel: { type: 'text', label: 'Button text', default: 'Apply by Email' },
      applyUrl: { type: 'url', label: 'Button link', default: 'mailto:community@qosfc.com' },
    },
  },
  funders: {
    label: 'Funder or partner',
    fields: {
      name: { type: 'text', label: 'Name', default: 'Funder' },
      logo: { type: 'image', label: 'Logo', default: '' },
      url: { type: 'url', label: 'Website', default: '' },
    },
  },
  venues: {
    label: 'Venue',
    fields: {
      name: { type: 'text', label: 'Name', default: 'Venue' },
      what: { type: 'text', label: 'Description (Programmes page)', default: '' },
      short: { type: 'text', label: 'Description (Contact page)', default: '' },
      colour: { type: 'select', label: 'Colour', options: colourOptions(['navy', 'gold', 'green', 'orange', 'blue']), default: 'navy' },
      mapUrl: { type: 'url', label: 'Map link', default: '' },
      image: { type: 'image', label: 'Photo (Programmes page)', default: '' },
    },
  },
  stats: {
    label: 'Impact figure',
    fields: {
      value: { type: 'text', label: 'Figure (e.g. 35, 4,300+ or £982,999)', default: '0' },
      label: { type: 'text', label: 'What it counts', default: 'Label' },
    },
  },
  principles: {
    label: 'Principle',
    fields: {
      title: { type: 'text', label: 'Title', default: 'Principle' },
      body: { type: 'textarea', label: 'Text', default: '' },
      colour: { type: 'select', label: 'Colour', options: colourOptions(['gold', 'blue', 'green', 'orange']), default: 'gold' },
    },
  },
  products: {
    label: 'Product',
    fields: {
      name: { type: 'text', label: 'Name', default: 'New product' },
      category: { type: 'select', label: 'Category', options: mapOptions(SHOP_CATEGORIES), default: 'book' },
      note: { type: 'text', label: 'Note', default: '' },
      price: { type: 'text', label: 'Price', default: '£XX' },
      image: { type: 'image', label: 'Photo', default: '' },
      actionLabel: { type: 'text', label: 'Button text (blank = category default)', default: '' },
      url: { type: 'url', label: 'Button link', default: '/contact?topic=Bookings' },
    },
  },
  gallery: {
    label: 'Photo',
    fields: {
      image: { type: 'image', label: 'Photo', default: '' },
      caption: { type: 'text', label: 'Description (for screen readers and the lightbox)', default: '' },
      category: { type: 'select', label: 'Category', options: mapOptions(GALLERY_CATEGORIES), default: 'saturday' },
      size: { type: 'select', label: 'Tile size', options: GALLERY_SIZES, default: 's' },
      shape: { type: 'select', label: 'Tile shape', options: GALLERY_SHAPES, default: 'rect' },
    },
  },
};
