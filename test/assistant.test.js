// The visitor chat assistant, with a fake model in place of Claude: per-site settings, the popup, the /_chat
// endpoint, what the model is given, and the conversation log.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadTheme } from '../src/theme.js';
import { cleanSettings, DEFAULT_INSTRUCTIONS } from '../src/assistant.js';

const starter = await loadTheme({ theme: 'starter' });
const calls = [];
let reply = { text: 'We are open **every day**. See [Contact](/contact).', refused: false };
const assistantCall = async ({ system, messages }) => {
  calls.push({ system, messages: structuredClone(messages) });
  return { content: [{ type: 'text', text: reply.text }], text: reply.text, refused: reply.refused };
};

const servers = [];
async function start(config) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-test-'));
  const app = createApp({ themeObject: starter, dataDir, adminEmail: 'admin@example.com', adminPassword: 'CorrectHorse99', cookieSecure: false, ...config });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  servers.push({ server, dataDir });
  return `http://127.0.0.1:${server.address().port}`;
}
let base; let noKeyBase;
before(async () => {
  base = await start({ assistantCall });
  noKeyBase = await start({});
});
after(() => servers.forEach(({ server, dataDir }) => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }));

function client(root) {
  const jar = {};
  return async (url, opts = {}) => {
    const res = await fetch(root + url, { redirect: 'manual', ...opts, headers: { ...(opts.headers ?? {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (v) jar[k] = v; else delete jar[k];
    }
    return res;
  };
}
const form = (obj) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(obj).toString() });
async function admin(root) {
  const c = client(root);
  await c('/admin/login', form({ email: 'admin@example.com', password: 'CorrectHorse99' }));
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await c('/admin')).text())[1];
  return { c, csrf };
}
const ask = (root, body, headers = {}) => fetch(`${root}/_chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const settingsForm = (csrf, extra = {}) => form({
  _csrf: csrf, enabled: '1', siteContent: '1', name: 'Riverside helper', status: 'Ask about the hub', greeting: 'Hi there!',
  teaser: 'Questions?', suggestions: 'When are you open?\nWhere are you?', disclaimer: 'AI, may be wrong.', accent: '#2a7d4f',
  knowledge: 'Parking is free behind the hall.', instructions: 'Be a helpful hub assistant.', ...extra,
});

test('the assistant is off until an administrator turns it on', async () => {
  const page = await (await fetch(`${base}/`)).text();
  assert.doesNotMatch(page, /data-gchat|chat\.js/);
  assert.equal((await ask(base, { message: 'Hello' })).status, 404);
  assert.equal(calls.length, 0);
});

test('administrators set each site\'s own name, greeting and instructions; visitors then see the popup', async () => {
  const { c, csrf } = await admin(base);
  const settingsPage = await (await c('/admin/assistant')).text();
  assert.match(settingsPage, /Status: off: turned off below/);
  assert.match(settingsPage, /claude-opus-5-5/);
  assert.equal((await c('/admin/assistant', settingsForm(csrf, { accent: 'green' }))).status, 400, 'colours are checked');
  const saved = await c('/admin/assistant', settingsForm(csrf));
  assert.equal(saved.status, 200);
  assert.match(await saved.text(), /Status: on, visitors can see it/);

  const page = await (await fetch(`${base}/about`)).text();
  assert.match(page, /data-gchat/);
  assert.match(page, /Ask Riverside helper/);
  assert.match(page, /--gchat-accent:#2a7d4f/);
  assert.match(page, /"greeting":"Hi there!"/);
  assert.match(page, /"suggestions":\["When are you open\?","Where are you\?"\]/);
  assert.match(page, /\/_engine\/chat\.js/);
  assert.equal((await fetch(`${base}/_engine/chat.css`)).status, 200);

  // Not while someone is editing the page.
  await c('/admin/edit-mode', form({ _csrf: csrf, on: '1', next: '/' }));
  assert.doesNotMatch(await (await c('/')).text(), /data-gchat/);
});

test('questions go to the model with the instructions, extra information and the site\'s words; conversations carry on', async () => {
  const first = await ask(base, { message: 'When are you open?' });
  assert.equal(first.status, 200);
  const one = await first.json();
  assert.match(one.text, /every day/);
  assert.ok(one.conversationId);

  const call = calls.at(-1);
  assert.equal(call.system[0].text, 'Be a helpful hub assistant.');
  assert.match(call.system[1].text, /Parking is free behind the hall/);
  assert.match(call.system[1].text, /Riverside Community Hub/, 'the site\'s own words are included');
  assert.match(call.system[1].text, /## Page \/about/);
  assert.deepEqual(call.messages, [{ role: 'user', content: 'When are you open?' }]);

  const two = await (await ask(base, { conversationId: one.conversationId, message: 'And parking?' })).json();
  assert.equal(two.conversationId, one.conversationId);
  assert.equal(calls.at(-1).messages.length, 3, 'question, answer, follow-up');
  assert.equal(calls.at(-1).messages[1].role, 'assistant');

  const fresh = await (await ask(base, { conversationId: 'made-up', message: 'Hi' })).json();
  assert.notEqual(fresh.conversationId, one.conversationId, 'unknown conversations start afresh');

  reply = { text: '', refused: true };
  const refused = await (await ask(base, { message: 'Something off-limits' })).json();
  assert.match(refused.text, /can't help with that/);
  reply = { text: 'OK', refused: false };

  const { c } = await admin(base);
  const log = await (await c('/admin/assistant')).text();
  assert.match(log, /When are you open\?/);
  assert.match(log, /And parking\?/);
});

test('/_chat refuses other sites, non-JSON posts and empty questions', async () => {
  assert.equal((await ask(base, { message: 'Hi' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(`${base}/_chat`, form({ message: 'Hi' }))).status, 415);
  assert.equal((await ask(base, { message: '   ' })).status, 400);
});

test('without an API key the popup stays hidden even when turned on', async () => {
  const { c, csrf } = await admin(noKeyBase);
  const saved = await (await c('/admin/assistant', settingsForm(csrf))).text();
  assert.match(saved, /once the server has an API key/);
  assert.match(saved, /Status: off: the server has no API key/);
  assert.doesNotMatch(await (await fetch(`${noKeyBase}/`)).text(), /data-gchat/);
});

test('settings are cleaned: blank instructions go back to the standard ones', () => {
  const { settings, error } = cleanSettings({ name: '  Hub  ', instructions: '  ', enabled: '1', accent: '#ABCDEF' }, 'Site');
  assert.equal(error, null);
  assert.equal(settings.name, 'Hub');
  assert.equal(settings.instructions, DEFAULT_INSTRUCTIONS);
  assert.equal(settings.enabled, true);
  assert.equal(settings.siteContent, false);
});
