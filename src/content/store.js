import sanitizeHtml from 'sanitize-html';
import { FIELDS, SEED } from './defaults.js';
import { COLLECTIONS, itemDefaults, isScheduled, todayInUK } from './schema.js';
import { now } from '../db.js';

export class ValidationError extends Error {}

// Revisions of the starting lists in defaults.js (SEED) to bring into sites that already have content. Add a new
// entry, with a new key, each time the starting content of existing lists changes. Text fields need no entry:
// unedited fields always show the current default.
export const CONTENT_UPDATES = [
  {
    key: 'update:2026-10-strategy',
    replace: ['journey', 'programmes', 'stories', 'timeline', 'pillars', 'team', 'funders', 'venues', 'gallery'],
    append: ['news'],
  },
];

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

export function createStore(db) {
  let fieldCache = null;

  const insertSeed = (coll, data, pos) => db.prepare('INSERT INTO items (coll, pos, data, updated_at) VALUES (?, ?, ?, ?)')
    .run(coll, pos, JSON.stringify({ ...itemDefaults(coll), ...data, ...(data.date === 'today' ? { date: todayInUK() } : {}) }), now());
  const metaDone = (key) => !!db.prepare('SELECT 1 FROM meta WHERE key = ?').get(key);
  const markDone = (key) => db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run(key, now());

  // First start: write each list's starting content once. A brand-new list counts as already having every update.
  const seed = db.transaction(() => {
    for (const [coll, items] of Object.entries(SEED)) {
      if (metaDone(`seeded:${coll}`)) continue;
      items.forEach((data, i) => insertSeed(coll, data, i + 1));
      markDone(`seeded:${coll}`);
      for (const u of CONTENT_UPDATES) markDone(`${u.key}:${coll}`);
    }
  });
  seed();

  // Later revisions of the starting content, for sites that are already running. "replace" lists are swapped for
  // the new SEED only if nobody has edited, added, moved or deleted anything in them (judged from the change
  // history), so editors' work is never overwritten. "append" lists get the new SEED items whose title isn't there.
  const applyUpdates = db.transaction(() => {
    for (const u of CONTENT_UPDATES) {
      for (const coll of u.replace ?? []) {
        if (metaDone(`${u.key}:${coll}`)) continue;
        const edited = db.prepare("SELECT 1 FROM revisions WHERE kind = 'item' AND ref LIKE ? LIMIT 1").get(`${coll}:%`);
        if (edited) {
          console.log(`Content update ${u.key}: kept "${coll}" as it is, because it has been edited on this site.`);
        } else {
          db.prepare('DELETE FROM items WHERE coll = ?').run(coll);
          SEED[coll].forEach((data, i) => insertSeed(coll, data, i + 1));
          console.log(`Content update ${u.key}: refreshed "${coll}".`);
        }
        markDone(`${u.key}:${coll}`);
      }
      for (const coll of u.append ?? []) {
        if (metaDone(`${u.key}:${coll}`)) continue;
        const titles = new Set(db.prepare('SELECT data FROM items WHERE coll = ?').all(coll).map((r) => JSON.parse(r.data).title));
        let { max } = db.prepare('SELECT COALESCE(MAX(pos), 0) AS max FROM items WHERE coll = ?').get(coll);
        const added = SEED[coll].filter((data) => !titles.has(data.title));
        added.forEach((data) => insertSeed(coll, data, ++max));
        if (added.length) console.log(`Content update ${u.key}: added ${added.length} item(s) to "${coll}".`);
        markDone(`${u.key}:${coll}`);
      }
    }
  });
  applyUpdates();

  const revision = (userId, kind, ref, action, before, after) =>
    db.prepare('INSERT INTO revisions (at, user_id, kind, ref, action, before, after) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(now(), userId ?? null, kind, ref, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));

  function fields() {
    if (!fieldCache) {
      fieldCache = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.value]));
      for (const row of db.prepare('SELECT key, value FROM fields').all()) {
        if (Object.hasOwn(FIELDS, row.key)) fieldCache[row.key] = row.value;
      }
    }
    return fieldCache;
  }

  const parseItem = (row) => {
    const defaults = itemDefaults(row.coll);
    const data = { ...defaults, ...JSON.parse(row.data) };
    return { id: row.id, coll: row.coll, pos: row.pos, ...data };
  };

  // Visitors don't see hidden items, or news dated in the future; editors (includeHidden) see everything.
  function items(coll, { includeHidden = false } = {}) {
    const rows = db.prepare('SELECT * FROM items WHERE coll = ? ORDER BY pos, id').all(coll).map(parseItem);
    if (COLLECTIONS[coll]?.sortBy === 'date') rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
    return includeHidden ? rows : rows.filter((i) => !i.hidden && !isScheduled(i));
  }

  function getItem(id) {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    return row ? parseItem(row) : null;
  }

  function cleanItemData(coll, data, existing = {}) {
    const schema = COLLECTIONS[coll];
    const out = { ...itemDefaults(coll), ...existing };
    delete out.id; delete out.coll; delete out.pos;
    for (const [k, v] of Object.entries(data ?? {})) {
      const field = schema.fields[k];
      if (!field) continue;
      try {
        out[k] = cleanValue(field, v);
      } catch (e) {
        if (e instanceof ValidationError) throw new ValidationError(`${field.label}: ${e.message}`);
        throw e;
      }
    }
    return out;
  }

  function setField(key, value, userId) {
    const def = FIELDS[key];
    if (!def) throw new ValidationError(`Unknown field ${key}`);
    const clean = cleanValue(def, value);
    const before = fields()[key];
    if (clean === before) return;
    db.prepare(`INSERT INTO fields (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .run(key, clean, now(), userId ?? null);
    revision(userId, 'field', key, 'update', before, clean);
    fieldCache = null;
  }

  function updateItem(id, data, userId) {
    const item = getItem(id);
    if (!item) throw new ValidationError('That item no longer exists.');
    const { id: _id, coll, pos, ...before } = item;
    const after = cleanItemData(coll, data, before);
    if (JSON.stringify(after) === JSON.stringify(before)) return item;
    db.prepare('UPDATE items SET data = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(JSON.stringify(after), now(), userId ?? null, id);
    revision(userId, 'item', `${coll}:${id}`, 'update', before, after);
    return getItem(id);
  }

  // One save from the in-page editor: { fields: { key: value }, items: { id: { field: value } } }
  const saveBatch = db.transaction(({ fields: f = {}, items: it = {} }, userId) => {
    for (const [key, value] of Object.entries(f)) setField(key, value, userId);
    for (const [id, data] of Object.entries(it)) updateItem(Number(id), data, userId);
  });

  const createItem = db.transaction((coll, data, userId) => {
    if (!COLLECTIONS[coll]) throw new ValidationError(`Unknown list ${coll}`);
    const clean = cleanItemData(coll, data);
    const { max } = db.prepare('SELECT COALESCE(MAX(pos), 0) AS max FROM items WHERE coll = ?').get(coll);
    const { lastInsertRowid } = db.prepare('INSERT INTO items (coll, pos, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)')
      .run(coll, max + 1, JSON.stringify(clean), now(), userId ?? null);
    revision(userId, 'item', `${coll}:${lastInsertRowid}`, 'create', null, clean);
    return Number(lastInsertRowid);
  });

  const deleteItem = db.transaction((id, userId) => {
    const item = getItem(id);
    if (!item) return;
    const { id: _id, coll, pos, ...before } = item;
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    revision(userId, 'item', `${coll}:${id}`, 'delete', before, null);
  });

  const moveItem = db.transaction((id, dir, userId) => {
    const item = getItem(id);
    if (!item) throw new ValidationError('That item no longer exists.');
    const list = db.prepare('SELECT id FROM items WHERE coll = ? ORDER BY pos, id').all(item.coll).map((r) => r.id);
    const from = list.indexOf(id);
    const to = from + (dir < 0 ? -1 : 1);
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    const upd = db.prepare('UPDATE items SET pos = ? WHERE id = ?');
    list.forEach((itemId, i) => upd.run(i + 1, itemId));
    revision(userId, 'item', `${item.coll}:${id}`, 'move', from + 1, to + 1);
  });

  function revisions(limit = 200) {
    return db.prepare(`SELECT r.*, u.name AS user_name FROM revisions r LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.id DESC LIMIT ?`).all(limit).map((r) => ({ ...r, before: r.before && JSON.parse(r.before), after: r.after && JSON.parse(r.after) }));
  }

  // Puts back what a change replaced. The restore is itself recorded, so it can be undone the same way.
  const restore = db.transaction((revId, userId) => {
    const r = db.prepare('SELECT * FROM revisions WHERE id = ?').get(revId);
    if (!r) throw new ValidationError('That change was not found.');
    const before = r.before && JSON.parse(r.before);
    if (r.kind === 'field') {
      setField(r.ref, before ?? FIELDS[r.ref]?.value ?? '', userId);
      return;
    }
    const [coll, idStr] = r.ref.split(':');
    const id = Number(idStr);
    if (r.action === 'update') {
      if (!getItem(id)) throw new ValidationError('That item has since been deleted. Restore the deletion first.');
      updateItem(id, before, userId);
    } else if (r.action === 'delete') {
      createItem(coll, before, userId);
    } else if (r.action === 'create') {
      deleteItem(id, userId);
    } else {
      throw new ValidationError('Moves cannot be restored; use the arrows on the page instead.');
    }
  });

  return { fields, items, getItem, setField, saveBatch, createItem, updateItem, deleteItem, moveItem, revisions, restore };
}
