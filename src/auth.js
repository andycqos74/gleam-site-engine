import crypto from 'node:crypto';
import { now } from './db.js';

const SESSION_DAYS = 14;
const COOKIE = 'qos_sid';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, key] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

export const passwordProblem = (pw) => (String(pw ?? '').length < 10 ? 'Passwords need at least 10 characters.' : null);

export function randomPassword() {
  // Readable temporary password: no lookalike characters.
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(14), (b) => chars[b % chars.length]).join('');
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createAuth(db, config) {
  const cookieOpts = (req) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure ?? req.secure,
    path: '/',
  });

  // Creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD. With ADMIN_RESET=true it also puts that
  // account's password back to ADMIN_PASSWORD (and re-enables it) on every start, for when the password is lost.
  function ensureAdmin() {
    const { adminEmail: email, adminPassword: password } = config;
    if (!email || !password) return;
    const len = `(password is ${password.length} characters long)`;
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
    if (n === 0) {
      db.prepare('INSERT INTO users (email, name, role, hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(email, 'Administrator', 'admin', hashPassword(password), now());
      console.log(`Created first administrator ${email} ${len}`);
    } else if (config.adminReset) {
      if (existing) {
        db.prepare("UPDATE users SET hash = ?, role = 'admin', active = 1, must_change = 0 WHERE id = ?").run(hashPassword(password), existing.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO users (email, name, role, hash, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(email, 'Administrator', 'admin', hashPassword(password), now());
      }
      console.log(`ADMIN_RESET: ${email} can sign in with ADMIN_PASSWORD ${len}. Set ADMIN_RESET=false once you're in.`);
    }
    if (password.length < 10) console.warn('Warning: ADMIN_PASSWORD is shorter than 10 characters. If it contains a $ sign, Docker Compose cut it short there: write $$ instead of $, or avoid $.');
  }

  function startSession(res, req, user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    db.prepare('INSERT INTO sessions (token_hash, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(sha(token), user.id, crypto.randomBytes(24).toString('base64url'), now(), expires.toISOString());
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now(), user.id);
    res.cookie(COOKIE, token, { ...cookieOpts(req), expires });
  }

  function endSession(req, res) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
    res.clearCookie(COOKIE, cookieOpts(req));
  }

  // Attaches req.user and req.csrf for signed-in users; everyone else is anonymous.
  function middleware(req, res, next) {
    req.cookies = parseCookies(req.headers.cookie);
    const token = req.cookies[COOKIE];
    if (token) {
      const row = db.prepare(`SELECT s.csrf, s.expires_at, u.id, u.email, u.name, u.role, u.active, u.must_change
        FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(token));
      if (row && row.active && row.expires_at > now()) {
        req.user = { id: row.id, email: row.email, name: row.name, role: row.role, mustChange: !!row.must_change };
        req.csrf = row.csrf;
      }
    }
    next();
  }

  const checkCsrf = (req) => {
    const sent = req.get('x-csrf-token') || req.body?._csrf;
    return req.csrf && typeof sent === 'string' && sent.length === req.csrf.length &&
      crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.csrf));
  };

  // Guards for routes: signed in (any role), admin only, and CSRF on anything that changes data.
  const requireUser = (req, res, next) => {
    if (!req.user) {
      if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in again.' });
      return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && !checkCsrf(req)) {
      const error = 'Your session has expired. Reload the page and try again.';
      return req.originalUrl.startsWith('/api/') ? res.status(403).json({ error }) : res.status(403).type('text').send(error);
    }
    next();
  };
  const requireAdmin = (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(403).send('Administrators only.'));

  // Simple in-memory brake on password guessing: 8 failures per email or IP per 15 minutes.
  const failures = new Map();
  const tooMany = (keys) => keys.some((k) => {
    const f = failures.get(k);
    return f && f.until > Date.now() && f.count >= 8;
  });
  const fail = (keys) => keys.forEach((k) => {
    const f = failures.get(k);
    if (!f || f.until < Date.now()) failures.set(k, { count: 1, until: Date.now() + 15 * 60e3 });
    else f.count++;
  });

  function login(req, res, email, password) {
    const keys = [`ip:${req.ip}`, `email:${String(email).toLowerCase()}`];
    if (tooMany(keys)) return { error: 'Too many attempts. Wait 15 minutes and try again.' };
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email ?? '').trim());
    if (!user || !user.active || !verifyPassword(String(password ?? ''), user.hash)) {
      fail(keys);
      return { error: 'That email and password do not match an active account.' };
    }
    keys.forEach((k) => failures.delete(k));
    startSession(res, req, user);
    return { user };
  }

  function pruneSessions() {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  }

  return { ensureAdmin, middleware, requireUser, requireAdmin, login, endSession, pruneSessions, checkCsrf };
}
