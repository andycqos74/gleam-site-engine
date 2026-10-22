// Starter theme content model: the single editable fields, the lists, and the content a new site starts with.
// Copy this theme to begin a new site, then rename fields, lists and pages to suit.

import { f } from '../../src/theme-api.js';

export const FIELDS = {
  'site.name': f.text('Riverside Community Hub'),
  'site.tagline': f.text('People, places and things to do'),
  'site.logo': f.image('/img/logo.svg'),
  'site.logo.alt': f.text(''),
  'contact.email': f.text('hello@example.org'),
  'footer.text': f.text('Riverside Community Hub is a registered charity.'),

  'meta.home.title': f.text('Riverside Community Hub'),
  'meta.home.description': f.text('A friendly place to meet, learn and get involved.'),
  'home.hero.title': f.headline('A [friendly] place to meet, learn and get involved'),
  'home.hero.text': f.textarea('Classes, clubs and events for everyone in the neighbourhood. Drop in, say hello, and find something you love.'),
  'home.hero.cta': f.text('What’s on'),
  'home.hero.cta.url': f.url('/posts'),
  'home.hero.image': f.image(''),
  'home.hero.image.alt': f.text('People at the hub'),
  'home.features.title': f.text('What we do'),
  'home.posts.title': f.text('Latest news'),

  'meta.about.title': f.text('About us | Riverside Community Hub'),
  'meta.about.description': f.text('Who we are and how we work.'),
  'about.title': f.headline('About [us]'),
  'about.body': f.rich('<p>We are a volunteer-led community hub. Everything here can be edited in place by approved staff: sign in at <a href="/admin">/admin</a> and press <strong>Edit this page</strong>.</p>'),
  'about.image': f.image(''),
  'about.image.alt': f.text('Our building'),
  'about.team.title': f.text('The team'),

  'meta.posts.title': f.text('News | Riverside Community Hub'),
  'meta.posts.description': f.text('News and events from the hub.'),
  'posts.title': f.headline('News & [events]'),

  'meta.contact.title': f.text('Contact | Riverside Community Hub'),
  'meta.contact.description': f.text('Get in touch with the hub.'),
  'contact.title': f.headline('Get in [touch]'),
  'contact.text': f.textarea('Questions, ideas or want to volunteer? Send us a message.'),
  'contact.success': f.textarea('Thank you. We’ll be in touch soon.'),
};

export const CONTACT_TOPICS = ['General', 'Volunteering', 'Room hire'];

export const COLLECTIONS = {
  features: {
    label: 'Feature',
    fields: {
      title: { type: 'text', label: 'Title', default: 'New feature' },
      text: { type: 'textarea', label: 'Text', default: '' },
    },
  },
  posts: {
    label: 'Post',
    sortBy: 'date',
    publishDate: 'date',
    fields: {
      title: { type: 'text', label: 'Title', default: 'New post' },
      date: { type: 'date', label: 'Publish date (a future date keeps it hidden until then)', default: 'today' },
      summary: { type: 'textarea', label: 'Summary', default: '' },
      image: { type: 'image', label: 'Photo', default: '' },
      body: { type: 'rich', label: 'Text', default: '<p>Write the post here.</p>' },
    },
  },
  team: {
    label: 'Team member',
    fields: {
      name: { type: 'text', label: 'Name', default: 'Name' },
      role: { type: 'text', label: 'Role', default: 'Role' },
      photo: { type: 'image', label: 'Photo', default: '' },
    },
  },
};

export const SEED = {
  features: [
    { title: 'Classes', text: 'Weekly classes for all ages, from art to yoga.' },
    { title: 'Clubs', text: 'Book clubs, walking groups and a Saturday repair café.' },
    { title: 'Space to hire', text: 'Rooms for meetings, parties and community events.' },
  ],
  posts: [
    { title: 'Welcome to the new website', date: 'today', summary: 'Everything about the hub, in one place.', body: '<p>This is a sample post from the starter theme. Edit it, or add your own from the News page.</p>' },
  ],
  team: [
    { name: 'Alex Morgan', role: 'Hub manager' },
    { name: 'Sam Patel', role: 'Volunteer co-ordinator' },
  ],
};
