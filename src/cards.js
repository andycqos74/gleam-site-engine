// Digital business cards (Admin > Business cards). An administrator makes a card for each member of staff; it's a
// small page at /c/<code> with a "Save contact" button (a vCard) and a QR code, all on the site's own domain. The
// code is random and never changes, so printed QR codes keep working whatever is edited. Off until an administrator
// turns it on; see docs/business-cards/README.md.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { now } from './db.js';
import { ValidationError } from './content/store.js';

const SETTINGS_KEY = 'cards.settings';
export const DEFAULT_ACCENT = '#1e2252';
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+?[\d ()-]{3,30}$/;
const URL_RE = /^https?:\/\/[^\s<>"]+$/i;
// Photos come from the photo library: an upload (/media/...) or one that ships with the theme (/img/...).
const PHOTO_RE = /^\/(media|img)\/[\w./-]+\.(webp|jpe?g|png|svg)$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;
export const MAX_LINKS = 8;

// No lookalike characters, lower case for tidy addresses: 31^8 (about 850 billion) codes, so cards can't be guessed.
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const CODE_RE = /^[a-z2-9]{8}$/;

const SCHEMA = `CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  views INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER
)`;

export const fullName = (d) => [d.givenName, d.familyName].filter(Boolean).join(' ');

// Text for a phone link: digits and a leading + only.
export const telHref = (n) => `tel:${String(n).replace(/[^\d+]/g, '')}`;

// White or dark words on the accent colour, whichever is easier to read.
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14173a' : '#ffffff';
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const many = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// A card from the admin form. Returns { data, errors }; errors is empty when the card can be saved.
export function cleanCard(body) {
  const data = {
    givenName: str(body.givenName, 80),
    familyName: str(body.familyName, 80),
    pronouns: str(body.pronouns, 40),
    title: str(body.title, 120),
    department: str(body.department, 120),
    email: str(body.email, 200),
    mobile: str(body.mobile, 30),
    phone: str(body.phone, 30),
    website: str(body.website, 500),
    photo: str(body.photo, 300),
    bio: str(body.bio, 1000).replace(/\r\n/g, '\n'),
    links: [],
  };
  const errors = {};
  if (!data.givenName && !data.familyName) errors.givenName = 'Enter the person\'s name.';
  if (data.email && !EMAIL_RE.test(data.email)) errors.email = 'That email address doesn\'t look right.';
  if (data.mobile && !PHONE_RE.test(data.mobile)) errors.mobile = 'That mobile number doesn\'t look right.';
  if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = 'That phone number doesn\'t look right.';
  if (data.website && !URL_RE.test(data.website)) errors.website = 'Website addresses start with https://';
  if (data.photo && (!PHOTO_RE.test(data.photo) || data.photo.includes('..'))) errors.photo = 'Choose the photo again.';

  const labels = many(body.linkLabel); const urls = many(body.linkUrl);
  for (let i = 0; i < Math.max(labels.length, urls.length); i++) {
    const label = str(labels[i], 40); const url = str(urls[i], 500);
    if (!label && !url) continue;
    if (!URL_RE.test(url)) errors.links = 'Each link needs an address starting with https://';
    data.links.push({ label: label || url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0], url });
  }
  if (data.links.length > MAX_LINKS) errors.links = `Up to ${MAX_LINKS} links.`;
  return { data, errors };
}

export function cleanSettings(body) {
  const s = {
    enabled: body.enabled === '1',
    orgName: str(body.orgName, 120),
    logo: str(body.logo, 300),
    accent: str(body.accent, 7),
    website: str(body.website, 500),
    phone: str(body.phone, 30),
    address: str(body.address, 300).replace(/\r\n/g, '\n'),
  };
  const errors = {};
  if (s.logo && (!PHOTO_RE.test(s.logo) || s.logo.includes('..'))) errors.logo = 'Choose the logo again.';
  if (s.accent && !HEX_RE.test(s.accent)) errors.accent = 'Colours look like #1e2252.';
  if (s.website && !URL_RE.test(s.website)) errors.website = 'Website addresses start with https://';
  if (s.phone && !PHONE_RE.test(s.phone)) errors.phone = 'That phone number doesn\'t look right.';
  return { settings: s, errors };
}

// ---------- vCard 3.0 (RFC 2426) ----------
// 3.0 rather than 4.0: iPhone Contacts reads it most reliably. Lines end in CRLF and are folded at 75 bytes.

const escapeText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let start = 0; let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Don't split a multi-byte character: back up to the start of one.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end; limit = 74; // continuation lines start with a space
  }
  return parts.join('\r\n ');
}

// card: { data }, org: the organisation settings with defaults filled in, url: the card's address,
// photo: base64 JPEG or null.
export function vcard(card, org, { url, photo } = {}) {
  const d = card.data;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeText(d.familyName)};${escapeText(d.givenName)};;;`,
    `FN:${escapeText(fullName(d))}`,
  ];
  if (org.orgName || d.department) lines.push(`ORG:${escapeText(org.orgName)}${d.department ? `;${escapeText(d.department)}` : ''}`);
  if (d.title) lines.push(`TITLE:${escapeText(d.title)}`);
  if (d.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeText(d.email)}`);
  if (d.mobile) lines.push(`TEL;TYPE=CELL,VOICE:${escapeText(d.mobile)}`);
  if (d.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeText(d.phone)}`);
  else if (org.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeText(org.phone)}`);
  if (org.address) lines.push(`ADR;TYPE=WORK:;;${escapeText(org.address)};;;;`);
  const website = d.website || org.website;
  if (website) lines.push(`URL;TYPE=WORK:${escapeText(website)}`);
  // Apple's item grouping gives each link its own label in Contacts; other apps just see the address.
  [{ label: 'Business card', url }, ...d.links].filter((l) => l.url).forEach((l, i) => {
    lines.push(`item${i + 1}.URL:${escapeText(l.url)}`, `item${i + 1}.X-ABLabel:${escapeText(l.label)}`);
  });
  if (d.pronouns) lines.push(`X-PRONOUNS:${escapeText(d.pronouns)}`);
  if (d.bio) lines.push(`NOTE:${escapeText(d.bio)}`);
  if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`);
  lines.push(`REV:${new Date(card.updated_at ?? Date.now()).toISOString().replace(/\.\d+/, '')}`, 'END:VCARD');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

// A file name for the download: the person's name, with anything awkward in file names taken out.
export const vcardFileName = (d) => `${(fullName(d).replace(/[^\p{L}\p{N} .'-]/gu, '').trim() || 'contact')}.vcf`;

export function qrSvg(text) {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } });
}
export function qrPng(text) {
  return QRCode.toBuffer(text, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 1024 });
}

export function createCards(db, { mediaDir, publicDir, siteName, theme, baseUrl }) {
  db.exec(SCHEMA);

  const row = (r) => r && { ...r, data: JSON.parse(r.data), active: !!r.active };
  const revision = (userId, ref, action, before, after) =>
    db.prepare('INSERT INTO revisions (at, user_id, kind, ref, action, before, after) VALUES (?, ?, \'card\', ?, ?, ?, ?)')
      .run(now(), userId ?? null, ref, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));
  // What a revision keeps: the card's details and whether it's in use.
  const snapshot = (c) => ({ ...c.data, active: c.active });

  const list = () => db.prepare('SELECT * FROM cards ORDER BY active DESC, json_extract(data, \'$.givenName\') COLLATE NOCASE, id').all().map(row);
  const get = (id) => row(db.prepare('SELECT * FROM cards WHERE id = ?').get(id));
  const byCode = (code) => (CODE_RE.test(code) ? row(db.prepare('SELECT * FROM cards WHERE code = ?').get(code)) : null);

  const create = db.transaction((data, userId) => {
    let code;
    do code = newCode(); while (db.prepare('SELECT 1 FROM cards WHERE code = ?').get(code));
    const at = now();
    const { lastInsertRowid } = db.prepare('INSERT INTO cards (code, data, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)')
      .run(code, JSON.stringify(data), at, at, userId ?? null);
    const id = Number(lastInsertRowid);
    revision(userId, `card:${id}`, 'create', null, { ...data, active: true });
    return id;
  });

  const update = db.transaction((id, data, userId, active) => {
    const before = get(id);
    if (!before) throw new ValidationError('That card no longer exists.');
    const after = { ...before, data: data ?? before.data, active: active ?? before.active };
    db.prepare('UPDATE cards SET data = ?, active = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .run(JSON.stringify(after.data), after.active ? 1 : 0, now(), userId ?? null, id);
    revision(userId, `card:${id}`, 'update', snapshot(before), snapshot(after));
  });

  // Deleting erases the card and its change history, so the person's details don't live on anywhere.
  const remove = db.transaction((id) => {
    db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    db.prepare('DELETE FROM revisions WHERE kind = \'card\' AND ref = ?').run(`card:${id}`);
  });

  // Change history's "Put back" for a card. Returns false for revisions that aren't about cards.
  function restore(revId, userId) {
    const r = db.prepare('SELECT * FROM revisions WHERE id = ?').get(revId);
    if (r?.kind !== 'card') return false;
    const id = Number(r.ref.split(':')[1]);
    if (!get(id)) throw new ValidationError('That card has since been deleted.');
    if (r.action === 'create') update(id, null, userId, false);
    else {
      const { active, ...data } = JSON.parse(r.before);
      update(id, data, userId, active);
    }
    return true;
  }

  // Visits to the card page and "Save contact" downloads.
  const countView = (id) => db.prepare('UPDATE cards SET views = views + 1 WHERE id = ?').run(id);
  const countSave = (id) => db.prepare('UPDATE cards SET saves = saves + 1 WHERE id = ?').run(id);

  function savedSettings() {
    const r = db.prepare('SELECT value FROM meta WHERE key = ?').get(SETTINGS_KEY);
    try { return r ? JSON.parse(r.value) : {}; } catch { return {}; }
  }
  // As saved, for the settings form.
  const settings = () => ({ enabled: false, orgName: '', logo: '', accent: '', website: '', phone: '', address: '', ...savedSettings() });
  const saveSettings = (s) => db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(SETTINGS_KEY, JSON.stringify(s));
  // With the site's own name, logo and address standing in for anything left blank, for the cards themselves.
  function org() {
    const s = settings();
    const accent = s.accent || DEFAULT_ACCENT;
    return {
      ...s,
      orgName: s.orgName || siteName(),
      logo: s.logo || theme.adminLogo || theme.favicon || '',
      accent,
      ink: inkOn(accent),
      website: s.website || baseUrl || '',
    };
  }

  // The card's photo as a small square JPEG for the vCard, made once per photo and kept in memory.
  const photos = new Map();
  async function vcardPhoto(url) {
    if (!url || /\.svg$/i.test(url)) return null;
    if (photos.has(url)) return photos.get(url);
    const upload = url.startsWith('/media/');
    const root = path.resolve(upload ? mediaDir : publicDir);
    const file = upload ? path.join(root, path.basename(url).replace(/-1600\.webp$/, '-800.webp')) : path.join(root, url);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return null;
    try {
      const jpeg = await sharp(file).rotate().resize(400, 400, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78 }).toBuffer();
      const b64 = jpeg.toString('base64');
      if (photos.size > 500) photos.clear();
      photos.set(url, b64);
      return b64;
    } catch (e) {
      console.error(`Business card photo ${url}:`, e.message);
      return null;
    }
  }

  return { list, get, byCode, create, update, remove, restore, countView, countSave, settings, saveSettings, org, vcardPhoto };
}
