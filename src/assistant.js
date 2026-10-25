// The visitor chat assistant: a popup on every public page where visitors ask about the site (what's on, prices,
// times, how to get in touch) and Claude answers from the site's own content. The Claude API details (key, model,
// effort) come from the environment, so one image serves every site; each site's name, greeting, instructions and
// extra knowledge are set by its administrators under Admin > Chat assistant and kept in its own database.
// Conversations live in memory for an hour after their last message; each question and answer is also logged
// (Admin > Chat assistant) for 90 days so staff can see what visitors ask and tune the instructions.

import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { now } from './db.js';

const SETTINGS_KEY = 'assistant:settings';
const KEEP_FOR = 60 * 60e3;
const LOG_DAYS = 90;
const MAX_CONVERSATIONS = 2000;
const MAX_MESSAGE = 2000;
const MAX_DIGEST = 150_000;

export const DEFAULT_INSTRUCTIONS = `You are the chat assistant on this organisation's website. Visitors ask you about the organisation, what it
offers, when and where things happen, what they cost and how to get in touch.

How to work:
- Answer only from the website content and extra information given below. If the answer isn't there, say you
  don't know and suggest the contact page or the contact details on the site. Never make up times, prices, names,
  phone numbers or email addresses.
- When a page on the site covers the question, link to it with a Markdown link such as [Contact us](/contact).
- You can't book, buy, sign anyone up or pass messages on. Point visitors to the right page or button instead.
- Stay on the subject of this organisation and its website; politely decline anything else.
- Keep replies short, friendly and plain, in British English. Use short paragraphs or a short bulleted list; no
  tables.`;

// What each site can change. Blank text fields fall back to these when shown.
export function defaultSettings(siteName) {
  return {
    enabled: false,
    name: siteName,
    status: 'Questions about us and what we do',
    greeting: `Hello! Ask me anything about ${siteName}: what we offer, when and where, and how to get in touch.`,
    teaser: 'Hello. Got a question? Ask me.',
    suggestions: '',
    instructions: DEFAULT_INSTRUCTIONS,
    knowledge: '',
    siteContent: true,
    disclaimer: 'AI assistant, can make mistakes. Check important details with us.',
    accent: '',
  };
}

const LIMITS = { name: 60, status: 80, greeting: 500, teaser: 160, suggestions: 1000, instructions: 20000, knowledge: 50000, disclaimer: 300 };
const textOf = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

// Cleans a submitted settings form; returns { settings, error }.
export function cleanSettings(body, siteName) {
  const d = defaultSettings(siteName);
  const s = { ...d };
  for (const [key, max] of Object.entries(LIMITS)) s[key] = textOf(body[key], max);
  for (const key of ['name', 'status', 'teaser', 'disclaimer']) s[key] = s[key].replace(/\s+/g, ' ');
  s.enabled = body.enabled === '1' || body.enabled === 'on' || body.enabled === true;
  s.siteContent = body.siteContent === '1' || body.siteContent === 'on' || body.siteContent === true;
  s.accent = String(body.accent ?? '').trim();
  let error = null;
  if (s.accent && !/^#[0-9a-f]{6}$/i.test(s.accent)) {
    error = 'The colour must be written like #1f5fbf (a # and six letters or digits).';
    s.accent = '';
  }
  if (!s.instructions) s.instructions = d.instructions;
  return { settings: s, error };
}

// ---------- the site's own content, as plain text for the model ----------

const plain = (v) => String(v ?? '')
  .replace(/<\/(p|h2|h3|li)>|<br\s*\/?>/gi, '\n')
  .replace(/<li>/gi, '- ')
  .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\[([^\]]+)\]/g, '$1') // headline highlight brackets
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

const SKIP_TYPES = new Set(['image', 'bool']);

// Words, links and list items visitors can see, grouped by page, with each page's address. Hidden and scheduled
// items are left out; so are photos and settings that only steer the layout.
export function siteDigest({ theme, fields, items, scheduled, itemUrl }) {
  const pageKeys = new Map(Object.entries(theme.pages).map(([route, p]) => [p.key, route]));
  const groups = new Map();
  const add = (group, line) => { if (!groups.has(group)) groups.set(group, []); groups.get(group).push(line); };

  for (const [key, def] of Object.entries(theme.fields)) {
    if (SKIP_TYPES.has(def.type) || (key.startsWith('meta.') && !key.endsWith('.description'))) continue;
    const value = plain(fields[key]);
    if (!value) continue;
    const [first, second] = key.split('.');
    const page = key.startsWith('meta.') ? second : first;
    const group = pageKeys.has(page) ? `Page ${pageKeys.get(page)}` : 'Whole site';
    add(group, def.type === 'url' ? `${key}: link to ${value}` : value);
  }

  for (const [name, c] of Object.entries(theme.collections)) {
    const visible = items(name).filter((it) => !it.hidden && !scheduled(it));
    if (!visible.length) continue;
    const lines = visible.map((it) => {
      const parts = Object.entries(c.fields)
        .filter(([f, def]) => !SKIP_TYPES.has(def.type) && f !== 'hidden' && plain(it[f]))
        .map(([f, def]) => `${def.label ?? f}: ${plain(it[f])}`);
      if (c.itemPage) parts.push(`Page: ${itemUrl(it)}`);
      return `- ${parts.join(' | ')}`;
    });
    add(`List: ${c.label}`, lines.join('\n'));
  }

  let out = [...groups].map(([group, lines]) => `## ${group}\n${lines.join('\n')}`).join('\n\n');
  if (out.length > MAX_DIGEST) out = `${out.slice(0, MAX_DIGEST)}\n[The rest of the site's content was left out because it is too long.]`;
  return out;
}

// ---------- the model ----------

// Claude through the Messages API: adaptive thinking (always on for this model) with effort from configuration,
// the stable system prompt cached, and refusals falling back server-side to the model Anthropic recommends.
// Returns the assistant content to keep in the history unchanged, the text to show, and whether it declined.
export function claudeModel(config) {
  let client;
  return async ({ system, messages }) => {
    client ??= new Anthropic({ apiKey: config.assistantApiKey, timeout: 120e3, maxRetries: 2 });
    const response = await client.beta.messages.create({
      model: config.assistantModel,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: config.assistantEffort },
      cache_control: { type: 'ephemeral' },
      system,
      messages,
    });
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n');
    return { content: response.content, text, refused: response.stop_reason === 'refusal' };
  };
}

// ---------- the assistant for one site ----------

export function createAssistant({ db, store, theme, config: given, siteName, digestKit }) {
  const config = {
    ...given,
    assistantModel: given.assistantModel || 'claude-opus-5-5',
    assistantEffort: given.assistantEffort || 'medium',
    assistantMaxMessages: given.assistantMaxMessages || 30,
  };
  db.exec(`CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    conversation TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL
  )`);
  const model = config.assistantCall ?? claudeModel(config);
  const conversations = new Map();
  const hasKey = !!config.assistantApiKey || !!config.assistantCall;

  function settings() {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(SETTINGS_KEY);
    const d = defaultSettings(siteName());
    if (!row) return d;
    try { return { ...d, ...JSON.parse(row.value) }; } catch { return d; }
  }
  function saveSettings(s) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(SETTINGS_KEY, JSON.stringify(s));
  }

  const live = () => hasKey && settings().enabled;

  // What the popup shows. Null when the assistant is off.
  function widget() {
    if (!live()) return null;
    const s = settings();
    const d = defaultSettings(siteName());
    return {
      name: s.name || d.name,
      status: s.status,
      greeting: s.greeting || d.greeting,
      teaser: s.teaser,
      suggestions: s.suggestions.split('\n').map((q) => q.trim()).filter(Boolean).slice(0, 4),
      disclaimer: s.disclaimer,
      accent: s.accent,
    };
  }

  function digest() {
    const k = digestKit();
    return siteDigest({ theme, fields: store.fields(), items: (c) => store.items(c), scheduled: store.scheduled, itemUrl: k.itemUrl });
  }

  // Instructions first (they rarely change), then the site's knowledge; the cache breakpoint covers both.
  // Today's date only (not the time), so the cached prefix holds all day.
  function system() {
    const s = settings();
    const name = siteName();
    const blocks = [{ type: 'text', text: s.instructions || DEFAULT_INSTRUCTIONS }];
    const facts = [`Website: ${name}${config.baseUrl ? ` (${config.baseUrl})` : ''}. Your name in the chat: ${s.name || name}.`,
      `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: theme.timeZone })}.`];
    if (s.knowledge) facts.push(`# Extra information from the site's staff\n${s.knowledge}`);
    if (s.siteContent) facts.push(`# The website's content\nPage addresses are relative to the site, e.g. /contact.\n\n${digest()}`);
    blocks.push({ type: 'text', text: facts.join('\n\n') });
    return blocks;
  }

  function prune() {
    const cutoff = Date.now() - KEEP_FOR;
    for (const [id, c] of conversations) if (c.last < cutoff) conversations.delete(id);
    while (conversations.size > MAX_CONVERSATIONS) conversations.delete(conversations.keys().next().value);
  }
  setInterval(prune, 10 * 60e3).unref();
  const pruneLog = () => db.prepare('DELETE FROM chats WHERE at < ?').run(new Date(Date.now() - LOG_DAYS * 864e5).toISOString());
  pruneLog();
  setInterval(pruneLog, 864e5).unref();

  // One visitor message in, one reply out: { conversationId, text } or { error }.
  async function send(conversationId, message) {
    message = String(message ?? '').trim().slice(0, MAX_MESSAGE);
    if (!message) return { error: 'Type a question first.' };
    let c = typeof conversationId === 'string' ? conversations.get(conversationId) : null;
    if (!c) {
      prune();
      c = { id: crypto.randomBytes(16).toString('hex'), history: [], count: 0, last: Date.now(), busy: false };
      conversations.set(c.id, c);
    }
    if (c.busy) return { conversationId: c.id, error: 'Wait for the answer to your last question first.' };
    if (c.count >= config.assistantMaxMessages) {
      return { conversationId: c.id, text: 'This conversation is getting long. Please start a new one to carry on.' };
    }
    c.busy = true;
    try {
      const messages = [...c.history, { role: 'user', content: message }];
      const turn = await model({ system: system(), messages });
      const text = turn.refused || !turn.text.trim()
        ? "Sorry, I can't help with that here. Please get in touch with us directly."
        : turn.text.trim();
      // Append-only: the visitor's message and the model's reply exactly as returned (thinking blocks included).
      // A refusal's partial turn is dropped so the next question starts clean.
      if (!turn.refused) c.history.push(messages.at(-1), { role: 'assistant', content: turn.content });
      c.count++;
      c.last = Date.now();
      db.prepare('INSERT INTO chats (at, conversation, question, answer) VALUES (?, ?, ?, ?)').run(now(), c.id, message, text);
      return { conversationId: c.id, text };
    } catch (e) {
      console.error('Chat assistant failed:', e.status ?? '', e.message);
      return { conversationId: c.id, error: 'Sorry, the assistant is not available right now. Please try again in a minute.' };
    } finally {
      c.busy = false;
    }
  }

  const recent = (limit = 100) => db.prepare('SELECT * FROM chats ORDER BY id DESC LIMIT ?').all(limit);
  const clearLog = () => db.prepare('DELETE FROM chats').run();

  return { hasKey, settings, saveSettings, widget, digest, send, recent, clearLog, model: config.assistantModel, effort: config.assistantEffort };
}
