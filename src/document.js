// The HTML document around every public page. The engine owns <head> (title, description, social tags, the
// theme's stylesheets) and the editing tools; the theme's layout() supplies everything inside <body>.

import { html, raw, attrs } from './html.js';

// JSON inside <script type="application/json"> must not be able to close the tag.
const safeJson = (v) => raw(JSON.stringify(v).replace(/</g, '\\u003c'));

const asset = (ctx, url) => (/^https?:/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}v=${ctx.version}`);

// Fields shown in the editor's "Page settings" panel for a page: its meta.<page>.title/description, plus any
// field whose definition lists the page (or '*') in settings: [...].
function pageSettingFields(theme, page) {
  return Object.entries(theme.fields)
    .filter(([key, f]) => key.startsWith(`meta.${page}.`) || f.settings?.includes(page) || f.settings?.includes('*'))
    .map(([key, f]) => [key, f.label ?? (key.endsWith('.title') ? 'Browser tab and search result title' : key.endsWith('.description') ? 'Search result description' : key)]);
}

// meta (optional) overrides the page's title, description, share image and type, e.g. for an item page.
export function renderDocument(ctx, k, { page, body, meta = {} }) {
  const { theme } = ctx;
  const f = ctx.fields;
  const title = meta.title ?? f[`meta.${page}.title`] ?? f['site.name'] ?? theme.name;
  const description = meta.description ?? f[`meta.${page}.description`] ?? '';
  const shareImage = meta.image || theme.shareImage;
  const canonical = ctx.baseUrl ? ctx.baseUrl + ctx.path : null;

  const editConfig = ctx.editing && {
    csrf: ctx.csrf,
    page,
    collections: Object.fromEntries(Object.entries(theme.collections).map(([name, c]) => [name, {
      label: c.label,
      fields: c.fields,
      sortBy: c.sortBy ?? null,
      itemBase: c.itemPage?.base ?? null,
    }])),
    pageFields: pageSettingFields(theme, page).map(([key, label]) => ({ key, type: theme.fields[key].type, value: f[key], label })),
  };

  return html`<!doctype html>
<html lang="${theme.lang}"${attrs({ class: ctx.editing ? 'is-editing' : null })}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="${meta.type ?? 'website'}">
${ctx.baseUrl && shareImage ? html`<meta property="og:image" content="${ctx.baseUrl}${shareImage}">` : ''}
${theme.favicon ? html`<link rel="icon" href="${theme.favicon}">` : ''}
${theme.stylesheets.map((href) => html`<link rel="stylesheet" href="${asset(ctx, href)}">`)}
${theme.head ? theme.head(k, { page, version: ctx.version }) : ''}
${ctx.user ? html`<link rel="stylesheet" href="/_engine/editor.css?v=${ctx.version}">` : ''}
${ctx.chat ? html`<link rel="stylesheet" href="/_engine/chat.css?v=${ctx.version}">` : ''}
</head>
<body${attrs({ class: [`page-${meta.bodyClass ?? page}`, ctx.editing && 'is-editing'].filter(Boolean).join(' ') })}>
${theme.layout(k, { page, body })}
${ctx.user ? adminBar(ctx) : ''}
${editConfig ? html`<script type="application/json" id="edit-config">${safeJson(editConfig)}</script>
<script src="/_engine/editor.js?v=${ctx.version}" defer></script>` : ''}
${theme.scripts.map((src) => html`<script src="${asset(ctx, src)}" defer></script>`)}
${ctx.chat ? chatWidget(ctx) : ''}
</body>
</html>`;
}

function adminBar(ctx) {
  return html`<div class="admin-bar" data-admin-bar>
  <span class="admin-who">Signed in as ${ctx.user.name}</span>
  ${ctx.editing
    ? html`<button type="button" class="ab-btn" data-ed-action="page-settings">Page settings</button>
      <button type="button" class="ab-btn ab-save" data-ed-action="save" disabled>Save changes</button>
      <button type="button" class="ab-btn" data-ed-action="discard" disabled>Discard</button>
      <button type="button" class="ab-btn" data-ed-action="exit">Finish editing</button>`
    : html`<form method="post" action="/admin/edit-mode" class="ab-inline"><input type="hidden" name="_csrf" value="${ctx.csrf}"><input type="hidden" name="on" value="1"><input type="hidden" name="next" value="${ctx.url}"><button class="ab-btn ab-save">Edit this page</button></form>`}
  <a class="ab-btn" href="/admin">Admin</a>
</div>`;
}

const ICON_CHAT = raw('<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>');
const ICON_DOWN = raw('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
const ICON_X = raw('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>');
const ICON_NEW = raw('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>');
const ICON_SEND = raw('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');

// The chat assistant popup (src/assistant.js), driven by /_engine/chat.js. The greeting and suggested questions
// travel as data so the script can redraw them for a new conversation.
function chatWidget(ctx) {
  const c = ctx.chat;
  return html`<div class="gchat"${attrs({ 'data-gchat': '', 'data-name': c.name, style: c.accent ? `--gchat-accent:${c.accent}` : null })}>
  <script type="application/json" data-gchat-config>${safeJson({ greeting: c.greeting, suggestions: c.suggestions })}</script>
  <section id="gchat-panel" class="gchat-panel" role="dialog" aria-label="${`Chat with ${c.name}`}" hidden>
    <header class="gchat-head">
      <div class="gchat-head-text">
        <div class="gchat-title">Ask ${c.name}</div>
        ${c.status ? html`<div class="gchat-status">${c.status}</div>` : ''}
      </div>
      <button class="gchat-icon" type="button" data-gchat-new aria-label="Start a new conversation" title="New conversation">${ICON_NEW}</button>
      <button class="gchat-icon" type="button" data-gchat-close aria-label="Close chat">${ICON_X}</button>
    </header>
    <div class="gchat-log" data-gchat-log aria-live="polite"></div>
    <form class="gchat-form" data-gchat-form>
      <div class="gchat-compose">
        <label class="gchat-sr" for="gchat-input">Your question</label>
        <textarea id="gchat-input" rows="2" maxlength="2000" placeholder="Type your question" autocomplete="off" enterkeyhint="send"></textarea>
        <button class="gchat-send" type="submit" aria-label="Send">${ICON_SEND}</button>
      </div>
    </form>
    ${c.disclaimer ? html`<p class="gchat-note">${c.disclaimer}</p>` : ''}
  </section>
  ${c.teaser ? html`<div class="gchat-teaser" data-gchat-teaser hidden>
    <button class="gchat-teaser-body" type="button" data-gchat-open><strong>Ask ${c.name}</strong>${c.teaser}</button>
    <button class="gchat-teaser-x" type="button" data-gchat-teaser-x aria-label="Dismiss">${ICON_X}</button>
  </div>` : ''}
  <button class="gchat-launcher" type="button" data-gchat-toggle aria-controls="gchat-panel" aria-expanded="false" aria-label="Open chat">
    <span class="i-open">${ICON_CHAT}</span><span class="i-close">${ICON_DOWN}</span>
    <span class="gchat-count" data-gchat-count hidden></span>
  </button>
</div>
<script src="/_engine/chat.js?v=${ctx.version}" defer></script>`;
}
