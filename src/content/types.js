// Field types every theme can use, how submitted values are cleaned, and the date helpers behind scheduled items.
// Types: text (one line), textarea (plain text, line breaks kept), headline (text where [square brackets] mark
// highlighted words), rich (bold, italic, links, lists, headings), url, image, select (options), bool,
// list (comma-separated words), date (YYYY-MM-DD).
import sanitizeHtml from 'sanitize-html';

export class ValidationError extends Error {}

const RICH_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: { b: 'strong', i: 'em', div: 'p' },
};

const oneLine = (v, max = 500) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function cleanUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s) || (s.startsWith('/') && !s.startsWith('//')) || s.startsWith('#')) {
    if (/[\s<>"]/.test(s.replace(/ /g, '%20'))) throw new ValidationError(`"${s}" is not a valid link.`);
    return s.replace(/ /g, '%20').slice(0, 2000);
  }
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`.slice(0, 2000);
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  throw new ValidationError(`"${s}" is not a valid link. Use a web address, an email address or a page such as /contact.`);
}

export function cleanValue(field, v) {
  switch (field.type) {
    case 'text': case 'headline': case 'list': return oneLine(v);
    case 'textarea': return String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 5000);
    case 'rich': return sanitizeHtml(String(v ?? ''), RICH_OPTIONS).trim().slice(0, 50000);
    case 'url': return cleanUrl(v);
    case 'image': {
      const s = String(v ?? '').trim();
      if (s && !/^\/(media|img)\/([\w-]+\/)?[\w.-]+$/.test(s)) throw new ValidationError('That image is not one uploaded to this site.');
      return s;
    }
    case 'select': return Object.hasOwn(field.options, v) ? v : field.default;
    case 'bool': return v === true || v === 'true' || v === 'on' || v === 1;
    case 'date': {
      const d = String(v ?? '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) {
        throw new ValidationError('Enter a date such as 2026-11-05.');
      }
      return d;
    }
    default: throw new ValidationError(`Unknown field type ${field.type}`);
  }
}

// "Today" in the site's time zone, as YYYY-MM-DD.
export function today(timeZone = 'Europe/London', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const formatDate = (iso, locale = 'en-GB') => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

export const slugify = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

// A collection with publishDate: '<date field>' hides each item from visitors until that day.
export const isScheduled = (item, collection, todayIso) => {
  const field = collection?.publishDate;
  return !!field && !!item[field] && item[field] > todayIso;
};

// Starting values for a new item. A date field whose default is 'today' gets today's date.
export function itemDefaults(collection, todayIso) {
  return Object.fromEntries(Object.entries(collection.fields).map(([k, f]) => [k, f.type === 'date' && f.default === 'today' ? todayIso : f.default]));
}
