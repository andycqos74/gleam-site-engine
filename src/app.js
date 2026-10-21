import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, now } from './db.js';
import { createStore, ValidationError } from './content/store.js';
import { COLLECTIONS, CONTACT_TOPICS, isScheduled } from './content/schema.js';
import { createAuth, hashPassword, verifyPassword, passwordProblem, randomPassword } from './auth.js';
import { createMedia } from './media.js';
import { createMailer } from './mail.js';
import { createKit } from './pages/kit.js';
import { layout } from './pages/layout.js';
import { home } from './pages/home.js';
import { about } from './pages/about.js';
import { programmes } from './pages/programmes.js';
import { shop } from './pages/shop.js';
import { gallery } from './pages/gallery.js';
import { contact } from './pages/contact.js';
import { privacy } from './pages/privacy.js';
import { newsPage, articlePage, articleUrl } from './pages/news.js';
import * as admin from './pages/admin.js';
import { raw } from './html.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = Date.now().toString(36);

const PAGES = {
  '/': ['home', home],
  '/about': ['about', about],
  '/programmes': ['programmes', programmes],
  '/shop': ['shop', shop],
  '/news': ['news', newsPage],
  '/gallery': ['gallery', gallery],
  '/contact': ['contact', contact],
  '/privacy': ['privacy', privacy],
};

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;

export function createApp(config) {
  const db = openDb(config.dataDir);
  const store = createStore(db);
  const auth = createAuth(db, config);
  const mediaDir = config.mediaDir ?? path.join(config.dataDir, 'media');
  const media = createMedia(db, mediaDir);
  const mailer = createMailer(config);
  auth.ensureAdmin();
  auth.pruneSessions();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? 'loopback, linklocal, uniquelocal');

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src https://www.openstreetmap.org; font-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
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

  const statics = { maxAge: '7d', index: false };
  app.use('/css', express.static(path.join(ROOT, 'public/css'), statics));
  app.use('/js', express.static(path.join(ROOT, 'public/js'), statics));
  app.use('/img', express.static(path.join(ROOT, 'public/img'), statics));
  app.use('/fonts', express.static(path.join(ROOT, 'public/fonts'), { ...statics, maxAge: '365d', immutable: true }));
  app.use('/media', express.static(mediaDir, { ...statics, maxAge: '365d', immutable: true }));

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => { req.body ??= {}; next(); });
  app.use(auth.middleware);

  // ---------- public pages ----------
  function context(req) {
    const editing = !!req.user && !req.user.mustChange && req.cookies.qos_edit === '1';
    return {
      user: req.user,
      csrf: req.csrf,
      editing,
      fields: store.fields(),
      items: (coll) => store.items(coll, { includeHidden: editing }),
      path: req.path,
      url: req.originalUrl,
      baseUrl: config.baseUrl,
      version: VERSION,
    };
  }

  function renderPage(req, res, route, extra) {
    const [page, render] = PAGES[route];
    const ctx = context(req);
    const k = createKit(ctx);
    const body = render(k, extra);
    res.set('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=0, must-revalidate');
    res.type('html').send(String(layout(ctx, k, { page, body, bodyClass: `page-${page}` })));
  }

  for (const route of Object.keys(PAGES)) {
    if (route === '/contact') continue;
    app.get(route, (req, res) => renderPage(req, res, route));
  }

  app.get('/contact', (req, res) => renderPage(req, res, '/contact', { sent: req.query.sent === '1', topic: req.query.topic }));

  // One news article: /news/<id>-<slug>. Hidden or future-dated articles are only visible to signed-in editors.
  app.get('/news/:slug', (req, res, next) => {
    const id = Number.parseInt(req.params.slug, 10);
    const article = Number.isFinite(id) ? store.getItem(id) : null;
    const ctx = context(req);
    if (!article || article.coll !== 'news' || (!ctx.user && (article.hidden || isScheduled(article)))) return next();
    const url = articleUrl(article);
    if (req.path !== url) return res.redirect(301, url);
    const k = createKit(ctx);
    res.set('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=0, must-revalidate');
    res.type('html').send(String(layout(ctx, k, {
      page: 'news',
      body: articlePage(k, { article }),
      bodyClass: 'page-article',
      meta: { title: `${article.title} | ${ctx.fields['site.name']}`, description: article.summary, image: article.image, type: 'article' },
    })));
  });

  // Contact form: works as a normal form post, and as fetch() from site.js (Accept: application/json).
  const contactHits = new Map();
  app.post('/contact', async (req, res) => {
    const wantsJson = req.accepts(['html', 'json']) === 'json';
    const form = {
      name: String(req.body.name ?? '').trim().slice(0, 200),
      email: String(req.body.email ?? '').trim().slice(0, 200),
      topic: CONTACT_TOPICS.includes(req.body.topic) ? req.body.topic : '',
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
      return renderPage(req, res.status(422), '/contact', { form, errors });
    }
    // Bots fill the hidden "website" field; pretend it worked.
    if (!req.body.website) {
      hits.push(Date.now());
      contactHits.set(ip, hits);
      const { lastInsertRowid } = db.prepare('INSERT INTO messages (at, name, email, topic, message) VALUES (?, ?, ?, ?, ?)')
        .run(now(), form.name, form.email, form.topic, form.message);
      if (mailer) {
        mailer.sendContact(form)
          .then(() => db.prepare('UPDATE messages SET emailed = 1 WHERE id = ?').run(lastInsertRowid))
          .catch((e) => console.error('Contact email failed:', e.message));
      }
    }
    if (wantsJson) return res.json({ ok: true });
    res.redirect(303, '/contact?sent=1');
  });

  app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /api\n${config.baseUrl ? `Sitemap: ${config.baseUrl}/sitemap.xml\n` : ''}`));
  app.get('/sitemap.xml', (req, res) => {
    const base = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    const urls = [...Object.keys(PAGES), ...store.items('news').map(articleUrl)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
  });

  // ---------- admin ----------
  const adminCtx = (req, flash) => ({ user: req.user, csrf: req.csrf, version: VERSION, flash });
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
    res.clearCookie('qos_edit', { path: '/' });
    res.redirect(303, '/');
  });

  adminRouter.post('/edit-mode', (req, res) => {
    if (req.body.on === '1') res.cookie('qos_edit', '1', { path: '/', sameSite: 'lax', httpOnly: true, secure: config.cookieSecure ?? req.secure });
    else res.clearCookie('qos_edit', { path: '/' });
    res.redirect(303, safeNext(req.body.next));
  });

  adminRouter.get('/', (req, res) => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE handled = 0').get();
    sendHtml(res, admin.dashboard(adminCtx(req), { unread: n }));
  });

  adminRouter.get('/messages', (req, res) => {
    const messages = db.prepare('SELECT * FROM messages ORDER BY handled, id DESC LIMIT 500').all();
    sendHtml(res, admin.messagesPage(adminCtx(req), { messages }));
  });
  adminRouter.post('/messages/:id', (req, res) => {
    db.prepare('UPDATE messages SET handled = ? WHERE id = ?').run(req.body.handled === '1' ? 1 : 0, Number(req.params.id));
    res.redirect(303, '/admin/messages');
  });
  adminRouter.post('/messages/:id/delete', (req, res) => {
    db.prepare('DELETE FROM messages WHERE id = ?').run(Number(req.params.id));
    res.redirect(303, '/admin/messages');
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
    if (!COLLECTIONS[coll]) return res.status(400).json({ error: 'Unknown list.' });
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
  // The editor's photo library: everything uploaded, then the photos that ship with the site (public/img).
  const bundled = () => {
    const dir = path.join(ROOT, 'public/img');
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
    res.type('html').send(String(layout(ctx, k, {
      page: 'notfound',
      body: notFound(),
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
  return app;
}

function notFound() {
  return raw(`<section class="hero hero-center"><h1 class="h-hero h-80">Page not <span class="pill pill-gold pill-a">found</span></h1><p class="lede">That page has moved or never existed.</p><div class="btn-row"><a class="btn btn-navy" href="/">Go to the homepage</a></div></section>`);
}
