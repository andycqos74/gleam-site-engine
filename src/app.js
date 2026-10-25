import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { openDb, now } from './db.js';
import { createStore, ValidationError } from './content/store.js';
import { createAuth, hashPassword, verifyPassword, passwordProblem, randomPassword } from './auth.js';
import { createMedia } from './media.js';
import { createMailer } from './mail.js';
import { createAssistant, cleanSettings } from './assistant.js';
import { createKit } from './kit.js';
import { renderDocument } from './document.js';
import { createAnalytics, RANGES, DEFAULT_RANGE, AnalyticsError } from './analytics.js';
import { loadTheme, ROOT } from './theme.js';
import * as admin from './admin-pages.js';
import { html } from './html.js';

const VERSION = Date.now().toString(36);
const EDIT_COOKIE = 'site_edit';
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

// Loads the theme named in config (THEME / THEME_DIR) and builds the site.
export async function createSite(config) {
  const theme = config.themeObject ?? await loadTheme({ theme: config.theme });
  return createApp({ ...config, themeObject: theme });
}

// config.themeObject is a prepared theme (see theme.js); everything site-specific comes from it.
export function createApp(config) {
  const theme = config.themeObject;
  if (!theme) throw new Error('createApp needs a theme: use createSite(config), or pass themeObject from loadTheme().');
  const db = openDb(config.dataDir);
  const store = createStore(db, theme);
  const auth = createAuth(db, config);
  const mediaDir = config.mediaDir ?? path.join(config.dataDir, 'media');
  const media = createMedia(db, mediaDir);
  const mailer = createMailer(config);
  const siteName = () => store.fields()['site.name'] ?? theme.name;
  const assistant = createAssistant({
    db, store, theme, config, siteName,
    digestKit: () => createKit({ theme, editing: false, fields: store.fields(), items: (c) => store.items(c), scheduled: store.scheduled }),
  });
  const analytics = createAnalytics(config, { timeZone: theme.timeZone });
  auth.ensureAdmin();
  auth.pruneSessions();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? 'loopback, linklocal, uniquelocal');

  // Themes can allow extra sources, e.g. csp: { frameSrc: ['https://www.openstreetmap.org'], fontSrc: [...] }.
  // The Umami server (if set up) may serve its tracking script and receive page views.
  const src = (base, extra = []) => [base, ...extra].join(' ');
  const counter = analytics ? [analytics.origin] : [];
  const csp = [
    "default-src 'self'",
    `img-src ${src("'self' data: blob:", theme.csp.imgSrc)}`,
    `style-src ${src("'self' 'unsafe-inline'", theme.csp.styleSrc)}`,
    `script-src ${src("'self'", [...counter, ...(theme.csp.scriptSrc ?? [])])}`,
    `connect-src ${src("'self'", [...counter, ...(theme.csp.connectSrc ?? [])])}`,
    `font-src ${src("'self'", theme.csp.fontSrc)}`,
    `frame-src ${theme.csp.frameSrc?.length ? theme.csp.frameSrc.join(' ') : "'none'"}`,
    "form-action 'self'", "frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'",
  ].join('; ');
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    next();
  });

  app.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.type('text').send('Healthy');
  });

  // Engine assets (the editor) under /_engine; the theme's public/ folder at the site root (/css, /img, ...).
  // Plain HTML pages there are served without .html too (public/b-ook/terms.html at /b-ook/terms).
  const statics = { maxAge: '7d', index: false };
  app.use('/_engine', express.static(path.join(ROOT, 'public'), statics));
  app.use('/media', express.static(mediaDir, { ...statics, maxAge: '365d', immutable: true }));
  app.use(express.static(theme.publicDir, { ...statics, extensions: ['html'] }));

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => { req.body ??= {}; next(); });
  app.use(auth.middleware);

  // ---------- public pages ----------
  function context(req) {
    const editing = !!req.user && !req.user.mustChange && req.cookies[EDIT_COOKIE] === '1';
    return {
      theme,
      user: req.user,
      csrf: req.csrf,
      editing,
      fields: store.fields(),
      items: (coll) => store.items(coll, { includeHidden: editing }),
      scheduled: store.scheduled,
      path: req.path,
      url: req.originalUrl,
      query: req.query,
      baseUrl: config.baseUrl,
      version: VERSION,
      // The chat popup stays out of the way while someone is editing.
      chat: editing ? null : assistant.widget(),
      // Signed-in editors aren't counted as visitors.
      tracker: req.user ? null : analytics?.tracker,
    };
  }

  function send(req, res, ctx, k, doc) {
    res.set('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=0, must-revalidate');
    res.type('html').send(String(renderDocument(ctx, k, doc)));
  }

  function renderPage(req, res, route, extra) {
    const page = theme.pages[route];
    const ctx = context(req);
    const k = createKit(ctx);
    send(req, res, ctx, k, { page: page.key, body: page.render(k, extra ?? {}) });
  }

  const contactPath = theme.contact?.path;
  for (const route of Object.keys(theme.pages)) {
    app.get(route, (req, res) => renderPage(req, res, route, route === contactPath ? { sent: req.query.sent === '1', topic: req.query.topic } : {}));
  }

  // Lists with itemPage get a page per item at <base>/<id>-<slug>. Hidden or scheduled items are only visible to
  // signed-in editors; an out-of-date slug redirects to the current one.
  const itemPages = Object.entries(theme.collections).filter(([, c]) => c.itemPage);
  for (const [name, c] of itemPages) {
    app.get(`${c.itemPage.base}/:slug`, (req, res, next) => {
      const id = Number.parseInt(req.params.slug, 10);
      const it = Number.isFinite(id) ? store.getItem(id) : null;
      if (!it || it.coll !== name || (!req.user && (it.hidden || store.scheduled(it)))) return next();
      const ctx = context(req);
      const k = createKit(ctx);
      const url = k.itemUrl(it);
      if (req.path !== url) return res.redirect(301, url);
      const meta = c.itemPage.meta ? c.itemPage.meta(it, k) : {};
      send(req, res, ctx, k, { page: c.itemPage.pageKey ?? name, body: c.itemPage.render(k, { item: it }), meta: { type: 'article', ...meta } });
    });
  }

  // Contact form (theme.contact): works as a normal form post, and as fetch() with Accept: application/json.
  // Fields: name, email, topic (one of theme.contact.topics), message; "website" is a honeypot.
  const contactHits = new Map();
  if (contactPath) app.post(contactPath, async (req, res) => {
    const wantsJson = req.accepts(['html', 'json']) === 'json';
    const form = {
      name: String(req.body.name ?? '').trim().slice(0, 200),
      email: String(req.body.email ?? '').trim().slice(0, 200),
      topic: theme.contact.topics.includes(req.body.topic) ? req.body.topic : '',
      message: String(req.body.message ?? '').trim().slice(0, 5000),
    };
    const errors = {};
    if (!form.name) errors.name = 'Please tell us your name.';
    if (!EMAIL_RE.test(form.email)) errors.email = 'Please enter a valid email address.';
    if (!form.message) errors.message = 'Please write a message.';

    const ip = req.ip;
    const hits = (contactHits.get(ip) ?? []).filter((t) => t > Date.now() - 3600e3);
    if (hits.length >= 10) errors.form = 'You have sent a lot of messages in the last hour. Please email or phone us instead.';

    if (Object.keys(errors).length) {
      if (wantsJson) return res.status(422).json({ errors });
      return renderPage(req, res.status(422), contactPath, { form, errors });
    }
    // Bots fill the hidden "website" field; pretend it worked.
    if (!req.body.website) {
      hits.push(Date.now());
      contactHits.set(ip, hits);
      const { lastInsertRowid } = db.prepare('INSERT INTO messages (at, name, email, topic, message) VALUES (?, ?, ?, ?, ?)')
        .run(now(), form.name, form.email, form.topic, form.message);
      if (mailer) {
        mailer.sendContact(form, siteName())
          .then(() => db.prepare('UPDATE messages SET emailed = 1 WHERE id = ?').run(lastInsertRowid))
          .catch((e) => console.error('Contact email failed:', e.message));
      }
    }
    if (wantsJson) return res.json({ ok: true });
    res.redirect(303, `${contactPath}?sent=1`);
  });

  // Chat assistant (src/assistant.js): JSON in ({ conversationId, message }), JSON out ({ conversationId, text } or
  // { error }). Same-site only, and at most 30 questions an hour from one address.
  const chatHits = new Map();
  app.post('/_chat', async (req, res) => {
    if (!assistant.widget()) return res.status(404).json({ error: 'The chat assistant is turned off.' });
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}` && origin !== config.baseUrl) return res.status(403).json({ error: 'Not allowed.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Send JSON.' });
    const hits = (chatHits.get(req.ip) ?? []).filter((t) => t > Date.now() - 3600e3);
    if (hits.length >= 30) return res.status(429).json({ error: 'You have asked a lot of questions in the last hour. Please try again later, or get in touch with us directly.' });
    hits.push(Date.now());
    chatHits.set(req.ip, hits);
    if (chatHits.size > 10000) chatHits.clear();
    const reply = await assistant.send(req.body.conversationId, req.body.message);
    res.set('Cache-Control', 'no-store').status(reply.error && !reply.conversationId ? 400 : 200).json(reply);
  });

  // Phone messages from the AI voice agent, stored alongside contact form messages (Admin > Messages) and emailed the
  // same way. Off unless VOICE_API_TOKEN is set; the agent sends it as "Authorization: Bearer <token>". "ref" is the
  // agent's own ID for the message, so a delivery it retries isn't stored twice.
  const voiceToken = config.voiceApiToken ? sha256(config.voiceApiToken) : null;
  const voiceFailures = new Map();
  app.post('/api/inbound/voice-message', (req, res) => {
    if (!voiceToken) return res.status(404).json({ error: 'Not found' });
    const ip = req.ip;
    const failed = (voiceFailures.get(ip) ?? []).filter((t) => t > Date.now() - 15 * 60e3);
    if (failed.length >= 20) return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    const sent = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1];
    if (!sent || !crypto.timingSafeEqual(sha256(sent), voiceToken)) {
      voiceFailures.set(ip, [...failed, Date.now()]);
      return res.status(401).json({ error: 'Wrong or missing token.' });
    }

    const b = req.body;
    const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const msg = {
      ref: text(b.ref, 100),
      name: text(b.name, 200) ?? 'Unknown caller',
      phone: text(b.phone, 30),
      topic: text(b.topic, 100),
      message: text(b.message, 5000),
      urgency: b.urgency ?? 'normal',
      preferredTime: text(b.preferred_time, 200),
      needsReview: b.needs_review === true,
      transcriptUrl: text(b.transcript_url, 500),
      at: b.at == null ? now() : new Date(b.at),
    };
    const errors = {};
    if (!msg.ref || !/^[\w.:#-]+$/.test(msg.ref)) errors.ref = 'Give a reference of letters, numbers and . : # _ - only.';
    if (!msg.message) errors.message = 'The message is empty.';
    if (msg.phone && !/^\+?[\d ()-]{3,30}$/.test(msg.phone)) errors.phone = 'That isn\'t a phone number.';
    if (!['low', 'normal', 'urgent'].includes(msg.urgency)) errors.urgency = 'Urgency must be low, normal or urgent.';
    if (msg.transcriptUrl && !/^https?:\/\//i.test(msg.transcriptUrl)) errors.transcript_url = 'The transcript link must start with https://.';
    if (msg.at instanceof Date) {
      if (Number.isNaN(msg.at.getTime())) errors.at = 'That isn\'t a date and time.';
      else msg.at = msg.at.toISOString();
    }
    if (Object.keys(errors).length) return res.status(422).json({ errors });

    const { changes, lastInsertRowid } = db.prepare(`INSERT INTO messages
      (at, name, email, topic, message, source, phone, urgency, preferred_time, ref, transcript_url, needs_review)
      VALUES (?, ?, '', ?, ?, 'phone', ?, ?, ?, ?, ?, ?) ON CONFLICT (ref) DO NOTHING`)
      .run(msg.at, msg.name, msg.topic, msg.message, msg.phone, msg.urgency, msg.preferredTime, msg.ref, msg.transcriptUrl, msg.needsReview ? 1 : 0);
    if (!changes) {
      const { id } = db.prepare('SELECT id FROM messages WHERE ref = ?').get(msg.ref);
      return res.json({ ok: true, id, duplicate: true });
    }
    if (mailer) {
      mailer.sendPhone(msg, siteName())
        .then(() => db.prepare('UPDATE messages SET emailed = 1 WHERE id = ?').run(lastInsertRowid))
        .catch((e) => console.error('Phone message email failed:', e.message));
    }
    res.status(201).json({ ok: true, id: Number(lastInsertRowid) });
  });

  app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /_chat\n${config.baseUrl ? `Sitemap: ${config.baseUrl}/sitemap.xml\n` : ''}`));
  app.get('/sitemap.xml', (req, res) => {
    const base = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    const k = createKit({ theme, editing: false, fields: store.fields(), items: (c) => store.items(c), scheduled: store.scheduled });
    const urls = [...Object.keys(theme.pages), ...itemPages.flatMap(([name]) => store.items(name).map(k.itemUrl))];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
  });

  // ---------- admin ----------
  const adminCtx = (req, flash) => ({ user: req.user, csrf: req.csrf, version: VERSION, flash, siteName: siteName(), logo: theme.adminLogo ?? theme.favicon, theme, analytics: !!analytics });
  const sendHtml = (res, page) => res.set('Cache-Control', 'no-store').type('html').send(String(page));
  const safeNext = (n) => (typeof n === 'string' && /^\/(?![/\\])/.test(n) ? n : '/admin');

  app.get('/admin/login', (req, res) => {
    if (req.user) return res.redirect(safeNext(req.query.next));
    sendHtml(res, admin.loginPage(adminCtx(req), { next: req.query.next }));
  });

  app.post('/admin/login', (req, res) => {
    const { email, password, next } = req.body;
    const result = auth.login(req, res, email, password);
    if (result.error) return sendHtml(res.status(401), admin.loginPage(adminCtx(req), { error: result.error, email, next }));
    res.redirect(303, result.user.must_change ? '/admin/account' : safeNext(next));
  });

  const adminRouter = express.Router();
  adminRouter.use(auth.requireUser);
  // Someone on a temporary password must choose their own before doing anything else.
  adminRouter.use((req, res, next) => {
    if (req.user.mustChange && !['/account', '/logout'].includes(req.path)) return res.redirect('/admin/account');
    next();
  });

  adminRouter.post('/logout', (req, res) => {
    auth.endSession(req, res);
    res.clearCookie(EDIT_COOKIE, { path: '/' });
    res.redirect(303, '/');
  });

  adminRouter.post('/edit-mode', (req, res) => {
    if (req.body.on === '1') res.cookie(EDIT_COOKIE, '1', { path: '/', sameSite: 'lax', httpOnly: true, secure: config.cookieSecure ?? req.secure });
    else res.clearCookie(EDIT_COOKIE, { path: '/' });
    res.redirect(303, safeNext(req.body.next));
  });

  adminRouter.get('/', (req, res) => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE handled = 0').get();
    sendHtml(res, admin.dashboard(adminCtx(req), { unread: n }));
  });

  adminRouter.get('/visitors', async (req, res) => {
    const range = Object.hasOwn(RANGES, req.query.range) ? req.query.range : DEFAULT_RANGE;
    let report = null; let error = null;
    if (analytics) {
      try {
        report = await analytics.report(range);
      } catch (e) {
        if (!(e instanceof AnalyticsError)) throw e;
        console.error('Visitor statistics:', e.message);
        error = e.message;
      }
    }
    sendHtml(res, admin.visitorsPage(adminCtx(req), { analytics, range, report, error }));
  });

  // ?show=form or ?show=phone narrows the list to website or phone messages; the buttons keep that view.
  const messagesView = (show) => (['form', 'phone'].includes(show) ? show : '');
  const messagesUrl = (show) => `/admin/messages${messagesView(show) ? `?show=${show}` : ''}`;
  adminRouter.get('/messages', (req, res) => {
    const show = messagesView(req.query.show);
    const messages = db.prepare(`SELECT * FROM messages ${show ? 'WHERE source = ?' : ''} ORDER BY handled, id DESC LIMIT 500`)
      .all(...(show ? [show] : []));
    sendHtml(res, admin.messagesPage(adminCtx(req), { messages, show }));
  });
  adminRouter.post('/messages/:id', (req, res) => {
    db.prepare('UPDATE messages SET handled = ? WHERE id = ?').run(req.body.handled === '1' ? 1 : 0, Number(req.params.id));
    res.redirect(303, messagesUrl(req.body.show));
  });
  adminRouter.post('/messages/:id/delete', (req, res) => {
    db.prepare('DELETE FROM messages WHERE id = ?').run(Number(req.params.id));
    res.redirect(303, messagesUrl(req.body.show));
  });

  adminRouter.get('/history', (req, res) => sendHtml(res, admin.historyPage(adminCtx(req), { revisions: store.revisions() })));
  adminRouter.post('/history/:id/restore', (req, res) => {
    try {
      store.restore(Number(req.params.id), req.user.id);
      sendHtml(res, admin.historyPage(adminCtx(req, 'Done: the earlier version is back.'), { revisions: store.revisions() }));
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      sendHtml(res.status(400), admin.historyPage(adminCtx(req, e.message), { revisions: store.revisions() }));
    }
  });

  adminRouter.get('/account', (req, res) => sendHtml(res, admin.accountPage(adminCtx(req), { forced: req.user.mustChange })));
  adminRouter.post('/account', (req, res) => {
    const { current, password, confirm } = req.body;
    const row = db.prepare('SELECT hash FROM users WHERE id = ?').get(req.user.id);
    let error = null;
    if (!verifyPassword(String(current ?? ''), row.hash)) error = 'Your current password is not right.';
    else if (password !== confirm) error = 'The two new passwords are different.';
    else if (password === current) error = 'Choose a password different from the current one.';
    else error = passwordProblem(password);
    if (error) return sendHtml(res.status(400), admin.accountPage(adminCtx(req), { error, forced: req.user.mustChange }));
    db.prepare('UPDATE users SET hash = ?, must_change = 0 WHERE id = ?').run(hashPassword(password), req.user.id);
    // Sign out other devices, keep this one.
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND csrf <> ?').run(req.user.id, req.csrf);
    req.user.mustChange = false;
    sendHtml(res, admin.dashboard(adminCtx(req, 'Your password has been changed.'), { unread: 0 }));
  });

  const usersList = () => db.prepare('SELECT id, email, name, role, active, last_login FROM users ORDER BY active DESC, name').all();
  adminRouter.get('/users', auth.requireAdmin, (req, res) => sendHtml(res, admin.usersPage(adminCtx(req), { users: usersList() })));
  adminRouter.post('/users', auth.requireAdmin, (req, res) => {
    const name = String(req.body.name ?? '').trim().slice(0, 100);
    const email = String(req.body.email ?? '').trim().slice(0, 200);
    const role = req.body.role === 'admin' ? 'admin' : 'editor';
    if (!name || !EMAIL_RE.test(email)) return sendHtml(res.status(400), admin.usersPage(adminCtx(req, 'Enter a name and a valid email address.'), { users: usersList() }));
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return sendHtml(res.status(400), admin.usersPage(adminCtx(req, 'Someone with that email already has an account. Use "Restore access" or "Reset password" instead.'), { users: usersList() }));
    const password = randomPassword();
    db.prepare('INSERT INTO users (email, name, role, hash, must_change, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(email, name, role, hashPassword(password), now());
    sendHtml(res, admin.usersPage(adminCtx(req), { users: usersList(), created: { email, password } }));
  });
  adminRouter.post('/users/:id', auth.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user || id === req.user.id) return res.redirect(303, '/admin/users');
    const activeAdmins = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
    switch (req.body.action) {
      case 'reset': {
        const password = randomPassword();
        db.prepare('UPDATE users SET hash = ?, must_change = 1 WHERE id = ?').run(hashPassword(password), id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        return sendHtml(res, admin.usersPage(adminCtx(req), { users: usersList(), created: { email: user.email, password } }));
      }
      case 'role':
        if (user.role === 'admin' && activeAdmins() <= 1) break;
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role === 'admin' ? 'admin' : 'editor', id);
        break;
      case 'deactivate':
        if (user.role === 'admin' && activeAdmins() <= 1) break;
        db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        break;
      case 'activate':
        db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(id);
        break;
      default:
    }
    res.redirect(303, '/admin/users');
  });

  const assistantPage = (req, res, { flash, settings, status = 200 } = {}) => sendHtml(res.status(status), admin.assistantPage(adminCtx(req, flash), {
    settings: settings ?? assistant.settings(),
    hasKey: assistant.hasKey,
    model: assistant.model,
    effort: assistant.effort,
    digestSize: assistant.digest().length,
    chats: assistant.recent(),
  }));
  adminRouter.get('/assistant', auth.requireAdmin, (req, res) => assistantPage(req, res));
  adminRouter.post('/assistant', auth.requireAdmin, (req, res) => {
    const { settings, error } = cleanSettings(req.body, siteName());
    if (error) return assistantPage(req, res, { flash: error, settings, status: 400 });
    assistant.saveSettings(settings);
    assistantPage(req, res, { flash: settings.enabled && !assistant.hasKey ? 'Saved. The assistant will appear once the server has an API key (see below).' : 'Saved.' });
  });
  adminRouter.post('/assistant/clear', auth.requireAdmin, (req, res) => {
    assistant.clearLog();
    assistantPage(req, res, { flash: 'The conversation log has been cleared.' });
  });

  app.use('/admin', adminRouter);

  // ---------- editing API (used by public/js/editor.js) ----------
  const api = express.Router();
  api.use(auth.requireUser);
  api.use((req, res, next) => (req.user.mustChange ? res.status(403).json({ error: 'Choose a new password first (Admin > My account).' }) : next()));

  api.post('/save', (req, res) => {
    store.saveBatch({ fields: req.body.fields, items: req.body.items }, req.user.id);
    res.json({ ok: true });
  });

  api.post('/items', (req, res) => {
    const { coll, data } = req.body;
    if (!theme.collections[coll]) return res.status(400).json({ error: 'Unknown list.' });
    const id = store.createItem(coll, data ?? {}, req.user.id);
    res.json({ ok: true, id });
  });
  api.put('/items/:id', (req, res) => {
    const item = store.updateItem(Number(req.params.id), req.body.data ?? {}, req.user.id);
    res.json({ ok: true, item });
  });
  api.delete('/items/:id', (req, res) => {
    store.deleteItem(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  });
  api.post('/items/:id/move', (req, res) => {
    store.moveItem(Number(req.params.id), Number(req.body.dir), req.user.id);
    res.json({ ok: true });
  });
  api.get('/items/:id', (req, res) => {
    const item = store.getItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'That item no longer exists.' });
    res.json({ item });
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
  api.post('/media', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a photo to upload.' });
    const saved = await media.save(req.file.buffer, req.file.originalname, req.user.id);
    res.json({ ok: true, ...saved });
  });
  // The editor's photo library: everything uploaded, then the photos that ship with the theme (public/img).
  const bundled = () => {
    const dir = path.join(theme.publicDir, 'img');
    if (!fs.existsSync(dir)) return [];
    const walk = (d, prefix) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory()
      ? walk(path.join(d, e.name), `${prefix}${e.name}/`)
      : /\.(jpe?g|png|webp)$/i.test(e.name) ? [{ url: `/img/${prefix}${e.name}`, name: e.name }] : []));
    return walk(dir, '').sort((a, b) => b.url.split('/').length - a.url.split('/').length || a.url.localeCompare(b.url));
  };
  api.get('/media', (req, res) => res.json({ media: [...media.list(), ...bundled()] }));

  app.use('/api', api);

  // ---------- errors ----------
  app.use((req, res) => {
    res.status(404);
    if (req.path.startsWith('/api/')) return res.json({ error: 'Not found' });
    const ctx = context(req);
    const k = createKit(ctx);
    res.type('html').send(String(renderDocument(ctx, k, {
      page: 'notfound',
      body: theme.notFound ? theme.notFound(k) : html`<main><h1>Page not found</h1><p><a href="/">Go to the homepage</a></p></main>`,
    })));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err instanceof ValidationError ? 400 : err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status ?? 500;
    const message = err instanceof ValidationError ? err.message
      : err.code === 'LIMIT_FILE_SIZE' ? 'That photo is too large (25 MB maximum).'
        : status < 500 ? err.message : 'Something went wrong. Please try again.';
    if (status >= 500) console.error(err);
    if (req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json') return res.status(status).json({ error: message });
    res.status(status).type('text').send(message);
  });

  app.locals.db = db;
  app.locals.store = store;
  app.locals.theme = theme;
  app.locals.analytics = analytics;
  return app;
}
