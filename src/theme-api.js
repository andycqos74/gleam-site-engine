// Everything a theme may import from the engine. Themes live in themes/<name>/ (or are mounted there), so they
// import this file relatively, e.g. from themes/<name>/theme.js:  import { html } from '../../src/theme-api.js';
// Templates receive the rest of the toolkit at render time as "k" (see src/kit.js).

export { html, raw, attrs, esc, paragraphs } from './html.js';
export { formatDate, slugify, today } from './content/types.js';

// Field definition helpers for theme.fields: f.text('Hello'), f.image('/img/x.jpg'), ...
// Options: settings: ['<page key>' | '*'] puts the field in that page's "Page settings" panel, with label.
const field = (type) => (value = '', options = {}) => ({ type, value, ...options });
export const f = {
  text: field('text'),          // one line of plain text
  textarea: field('textarea'),  // plain text, line breaks kept
  rich: field('rich'),          // bold, italic, headings, lists, links
  headline: field('headline'),  // [square brackets] mark highlighted words
  url: field('url'),
  image: field('image'),
};
