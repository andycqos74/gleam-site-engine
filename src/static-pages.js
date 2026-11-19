// Static HTML pages (Admin > Pages): terms and conditions, privacy notices, cookie policies and the like, written
// elsewhere and uploaded as an .html file, or pasted and edited here. Each page has its own address on the site
// (/terms, /legal/cookies, …) and shows either inside the site's design (header and footer, with the HTML cleaned to
// plain content) or exactly as the file is (its own <head> and styles; scripts never run). Unpublished pages are only
// visible to signed-in users. Every change is in the change history.

import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { now } from './db.js';
import { ValidationError } from './content/store.js';

export const LAYOUTS = { site: 'Inside the site\'s design', standalone: 'Exactly as the file is' };
export const MAX_HTML = 1024 * 1024;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
// First parts of an address the engine itself uses.
const RESERVED = new Set(['admin', 'api', 'media', 'c', 'health', 'sitemap', 'robots']);

const SCHEMA = `CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'site',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER
)`;

// What may appear in a page shown inside the site's design: ordinary document content, no scripts, styles or forms.
const CONTENT_OPTIONS = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags.filter((t) => t !== 'main'), 'img', 'details', 'summary'],
  allowedAttributes: {
    '*': ['id', 'class', 'title', 'lang', 'dir'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    td: ['colspan', 'rowspan', 'scope'],
    th: ['colspan', 'rowspan', 'scope'],
    ol: ['start', 'type', 'reversed'],
    time: ['datetime'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    // The theme's layout already has the page's <main>.
    main: 'div',
    a: (tag, attribs) => (attribs.target === '_blank' ? { tagName: 'a', attribs: { ...attribs, rel: 'noopener noreferrer' } } : { tagName: tag, attribs }),
  },
};

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) => s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return ENTITY[e.toLowerCase()] ?? m;
});
const oneLine = (s) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export const isDocument = (source) => /^\s*(<!--[\s\S]*?-->\s*)*<(!doctype|html)\b/i.test(source);
export const titleOf = (source) => oneLine(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1]) || oneLine(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(source)?.[1]);
const descriptionOf = (source) => decode(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(source)?.[1] ?? '').trim();
const bodyOf = (source) => /<body[^>]*>([\s\S]*)<\/body>/i.exec(source)?.[1] ?? source.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<\/?(html|!doctype)[^>]*>/gi, '');

// The page's HTML cleaned for showing inside the site's design.
export const contentHtml = (source) => sanitizeHtml(bodyOf(source), CONTENT_OPTIONS).trim();
export const hasHeading = (content) => /<h1[\s>]/i.test(content);

// An uploaded file as text: UTF-8 unless the file says otherwise (Word saves as windows-1252), with the charset
// note changed to match, because the page is always sent as UTF-8.
export function decodeUpload(buffer) {
  const head = buffer.subarray(0, 4096).toString('latin1');
  const declared = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  let text;
  try {
    text = new TextDecoder(declared && declared !== 'utf-8' ? declared : 'utf-8').decode(buffer);
  } catch {
    text = new TextDecoder('utf-8').decode(buffer);
  }
  return text.replace(/^﻿/, '').replace(/(<meta[^>]+charset=["']?)[\w-]+/i, '$1utf-8');
}

const slugFromName = (name) => String(name ?? '').toLowerCase().replace(/\.html?$/i, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9/]+/g, '-').replace(/-*\/-*/g, '/').replace(/\/{2,}/g, '/').replace(/^[-/]+|[-/]+$/g, '').slice(0, 100);

export function createStaticPages(db, { theme }) {
  db.exec(SCHEMA);

  const row = (r) => r && { ...r, published: !!r.published };
  const snapshot = (p) => ({ slug: p.slug, title: p.title, description: p.description, html: p.html, layout: p.layout, published: p.published });
  const revision = (userId, id, action, before, after) =>
    db.prepare('INSERT INTO revisions (at, user_id, kind, ref, action, before, after) VALUES (?, ?, \'page\', ?, ?, ?, ?)')
      .run(now(), userId ?? null, `page:${id}`, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));

  const list = () => db.prepare('SELECT id, slug, title, layout, published, updated_at, length(html) AS size FROM pages ORDER BY slug').all().map(row);
  const get = (id) => row(db.prepare('SELECT * FROM pages WHERE id = ?').get(id));
  const bySlug = (slug) => (SLUG_RE.test(slug) ? row(db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug)) : null);

  // Why a page can't have this address, or null if it can.
  function slugProblem(slug, id) {
    if (!slug) return 'Give the page an address, such as terms.';
    if (slug.length > 100 || !SLUG_RE.test(slug)) return 'Use lower-case letters, numbers and hyphens, with / between parts (e.g. legal/terms).';
    const url = `/${slug}`;
    if (RESERVED.has(slug.split('/')[0])) return `/${slug.split('/')[0]} is used by the site itself. Choose another address.`;
    if (theme.pages[url]) return `${url} is already one of the site's pages.`;
    for (const c of Object.values(theme.collections)) {
      if (c.itemPage && (url === c.itemPage.base || url.startsWith(`${c.itemPage.base}/`))) return `Addresses under ${c.itemPage.base} belong to ${c.label}.`;
    }
    const file = path.join(theme.publicDir, slug);
    if (fs.existsSync(file) || fs.existsSync(`${file}.html`)) return `${url} is already a file that comes with the site's design.`;
    const other = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
    if (other && other.id !== id) return `Another page already uses ${url}.`;
    return null;
  }

  // A page from the admin form, with an uploaded file (multer's req.file) replacing the HTML box if there is one.
  // Returns { data, errors }; errors is empty when the page can be saved.
  function clean(body, file, { id, existing } = {}) {
    const errors = {};
    let source = String(body.html ?? '').replace(/\r\n/g, '\n');
    if (file) {
      if (!/\.html?$/i.test(file.originalname) && !/html/.test(file.mimetype)) errors.file = 'Choose an .html file.';
      else source = decodeUpload(file.buffer);
    }
    const data = {
      title: String(body.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
      slug: String(body.slug ?? '').trim().toLowerCase().replace(/^\/+|\/+$/g, ''),
      description: String(body.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
      layout: Object.hasOwn(LAYOUTS, body.layout) ? body.layout : 'site',
      published: body.published === '1',
      html: source,
    };
    // Blanks on a new page are filled in from the file: its <title> (or first heading) and its name.
    if (!data.title) data.title = titleOf(source).slice(0, 200) || existing?.title || '';
    if (!data.description && file && !existing) data.description = descriptionOf(source).slice(0, 300);
    if (!data.slug) data.slug = existing?.slug ?? (slugFromName(file?.originalname) || slugFromName(data.title.replace(/\//g, ' ')));
    if (!data.title) errors.title = 'Give the page a title.';
    const slugError = slugProblem(data.slug, id);
    if (slugError) errors.slug = slugError;
    if (!source.trim()) errors.html = errors.file ?? 'Upload an HTML file or type the page\'s HTML.';
    else if (Buffer.byteLength(source) > MAX_HTML) errors.html = 'That HTML is too large (1 MB at most).';
    else if (data.layout === 'site' && !contentHtml(source).replace(/<[^>]*>/g, '').trim()) errors.html = 'There are no words in this HTML to show.';
    return { data, errors };
  }

  const create = db.transaction((data, userId) => {
    const at = now();
    const { lastInsertRowid } = db.prepare('INSERT INTO pages (slug, title, description, html, layout, published, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(data.slug, data.title, data.description ?? '', data.html, data.layout, data.published ? 1 : 0, at, at, userId ?? null);
    const id = Number(lastInsertRowid);
    revision(userId, id, 'create', null, snapshot(data));
    return id;
  });

  const update = db.transaction((id, data, userId) => {
    const before = get(id);
    if (!before) throw new ValidationError('That page no longer exists.');
    const after = { ...before, ...data };
    db.prepare('UPDATE pages SET slug = ?, title = ?, description = ?, html = ?, layout = ?, published = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .run(after.slug, after.title, after.description ?? '', after.html, after.layout, after.published ? 1 : 0, now(), userId ?? null, id);
    revision(userId, id, 'update', snapshot(before), snapshot(after));
  });

  // Kept in the change history, so "Put back" can bring a deleted page back.
  const remove = db.transaction((id, userId) => {
    const before = get(id);
    if (!before) return;
    db.prepare('DELETE FROM pages WHERE id = ?').run(id);
    revision(userId, id, 'delete', snapshot(before), null);
  });

  // Change history's "Put back" for a page. Returns false for revisions that aren't about pages.
  function restore(revId, userId) {
    const r = db.prepare('SELECT * FROM revisions WHERE id = ?').get(revId);
    if (r?.kind !== 'page') return false;
    const id = Number(r.ref.split(':')[1]);
    const before = r.before == null ? null : JSON.parse(r.before);
    if (r.action === 'delete') {
      const problem = slugProblem(before.slug);
      if (problem) throw new ValidationError(`The page can't come back at /${before.slug}: ${problem}`);
      create(before, userId);
    } else if (!get(id)) {
      throw new ValidationError('That page has since been deleted. Put back its deletion first.');
    } else if (r.action === 'create') {
      update(id, { published: false }, userId);
    } else {
      const problem = slugProblem(before.slug, id);
      if (problem) throw new ValidationError(problem);
      update(id, before, userId);
    }
    return true;
  }

  // The HTML cleaned for showing inside the site's design, worked out once per saved version.
  const cache = new Map();
  function content(page) {
    const key = `${page.id}:${page.updated_at}`;
    if (!cache.has(key)) {
      if (cache.size > 200) cache.clear();
      cache.set(key, contentHtml(page.html));
    }
    return cache.get(key);
  }

  // The whole document for a page shown exactly as its file is. A fragment gets a plain document around it.
  function standalone(page, lang) {
    if (isDocument(page.html)) return page.html;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    return `<!doctype html>\n<html lang="${esc(lang)}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(page.title)}</title>\n${page.description ? `<meta name="description" content="${esc(page.description)}">\n` : ''}</head>\n<body>\n${page.html}\n</body>\n</html>\n`;
  }

  return { list, get, bySlug, clean, create, update, remove, restore, content, standalone, slugProblem };
}
