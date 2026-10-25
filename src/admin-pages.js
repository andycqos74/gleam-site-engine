// Admin screens (sign-in, messages, history, people, account). They use only the engine's stylesheet
// (/_engine/editor.css, scoped under .admin-page), so they look the same whatever theme a site runs.
import { html, raw, attrs, paragraphs } from './html.js';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }) : '');
const csrfInput = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf}">`;

export function adminLayout(ctx, { title, body, nav = true }) {
  const u = ctx.user;
  return html`<!doctype html>
<html lang="${ctx.theme?.lang ?? 'en-GB'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} | Site admin</title>
${ctx.logo ? html`<link rel="icon" href="${ctx.logo}">` : ''}
<link rel="stylesheet" href="/_engine/editor.css?v=${ctx.version}">
</head>
<body class="admin-page">
<header class="admin-header">
  <a class="brand" href="/">${ctx.logo ? html`<img class="brand-logo" src="${ctx.logo}" alt="">` : ''}<span class="brand-words"><span class="brand-name">Site admin</span><span class="brand-tag">${ctx.siteName}</span></span></a>
  ${nav && u ? html`<nav class="admin-nav">
    <a href="/admin">Home</a>
    <a href="/admin/messages">Messages</a>
    <a href="/admin/history">Change history</a>
    ${u.role === 'admin' ? html`<a href="/admin/assistant">Chat assistant</a><a href="/admin/users">People</a>` : ''}
    <a href="/admin/account">My account</a>
    <form method="post" action="/admin/logout">${csrfInput(ctx)}<button class="link-btn">Sign out</button></form>
  </nav>` : ''}
</header>
<main class="admin-main">
${ctx.flash ? html`<p class="flash">${ctx.flash}</p>` : ''}
${body}
</main>
</body>
</html>`;
}

export function loginPage(ctx, { error, email = '', next = '' } = {}) {
  return adminLayout(ctx, {
    title: 'Sign in',
    nav: false,
    body: html`<div class="admin-card narrow">
  <h1 class="admin-h1">Sign in to edit the site</h1>
  ${error ? html`<p class="field-error">${error}</p>` : ''}
  <form method="post" action="/admin/login" class="admin-form">
    <input type="hidden" name="next" value="${next}">
    <label>Email<input name="email" type="email" autocomplete="username" required value="${email}" autofocus></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn btn-navy">Sign in</button>
  </form>
  <p class="muted">Forgotten your password? Ask a site administrator to reset it.</p>
</div>`,
  });
}

export function dashboard(ctx, { unread }) {
  return adminLayout(ctx, {
    title: 'Admin',
    body: html`<h1 class="admin-h1">Hello ${ctx.user.name}</h1>
<div class="admin-tiles">
  <div class="admin-card">
    <h2>Edit the website</h2>
    <p>Go to any page and press <strong>Edit this page</strong> in the bar at the bottom of the screen. Then click any words to change them, or click a photo to replace it. Press <strong>Save changes</strong> when you're done.</p>
    <p>Lists, such as cards, people and photos, have a small toolbar when you point at an item: ✎ for all the details, arrows to reorder, 👁 to hide, and 🗑 to delete. Use the <strong>+ Add</strong> button under a list to add something new.</p>
    <form method="post" action="/admin/edit-mode">${csrfInput(ctx)}<input type="hidden" name="on" value="1"><input type="hidden" name="next" value="/"><button class="btn btn-navy">Start editing the homepage</button></form>
  </div>
  <div class="admin-card">
    <h2>Messages</h2>
    <p>${unread ? `${unread} message${unread === 1 ? '' : 's'} not yet marked as dealt with.` : 'No new messages.'}</p>
    <a class="btn btn-outline" href="/admin/messages">View messages</a>
  </div>
  ${ctx.user.role === 'admin' ? html`<div class="admin-card">
    <h2>Chat assistant</h2>
    <p>The AI chat popup that answers visitors' questions about the site. Turn it on, name it, and write its instructions.</p>
    <a class="btn btn-outline" href="/admin/assistant">Chat assistant settings</a>
  </div>` : ''}
  <div class="admin-card">
    <h2>Made a mistake?</h2>
    <p>Every change is recorded. Use the change history to put back what was there before.</p>
    <a class="btn btn-outline" href="/admin/history">Change history</a>
  </div>
</div>`,
  });
}

export function messagesPage(ctx, { messages, show = '' }) {
  const tabs = [['', 'All'], ['form', 'Website'], ['phone', 'Phone']];
  const keep = show ? html`<input type="hidden" name="show" value="${show}">` : '';
  return adminLayout(ctx, {
    title: 'Messages',
    body: html`<h1 class="admin-h1">Messages</h1>
<nav class="message-tabs" aria-label="Which messages">
${tabs.map(([key, label]) => html`<a href="/admin/messages${key ? `?show=${key}` : ''}"${attrs({ 'aria-current': key === show ? 'page' : null })}>${label}</a>`)}
</nav>
${messages.length ? '' : html`<p>No messages yet.</p>`}
<div class="message-list">
${messages.map((m) => html`<article class="admin-card message${m.handled ? ' is-handled' : ''}">
  ${m.source === 'phone' ? phoneHeader(m) : html`<header><strong>${m.name}</strong> · <a href="mailto:${m.email}?subject=${encodeURIComponent(`Re: your message to ${ctx.siteName}`)}">${m.email}</a> · <span class="tag tag-sky">${m.topic || 'General'}</span> <span class="muted">${when(m.at)}</span></header>`}
  <div class="message-text">${paragraphs(m.message)}</div>
  ${m.source === 'phone' && (m.preferred_time || m.transcript_url) ? html`<p class="message-extra">${m.preferred_time ? html`<span><strong>Preferred time:</strong> ${m.preferred_time}</span>` : ''}${m.transcript_url ? html`<a href="${m.transcript_url}" target="_blank" rel="noopener noreferrer">Read the transcript</a>` : ''}</p>` : ''}
  <footer>
    <form method="post" action="/admin/messages/${m.id}">${csrfInput(ctx)}${keep}<input type="hidden" name="handled" value="${m.handled ? '0' : '1'}"><button class="btn btn-outline btn-xs">${m.handled ? 'Mark as not dealt with' : 'Mark as dealt with'}</button></form>
    <form method="post" action="/admin/messages/${m.id}/delete" data-confirm="Delete this message permanently?">${csrfInput(ctx)}${keep}<button class="link-btn danger">Delete</button></form>
  </footer>
</article>`)}
</div>
<script src="/_engine/admin.js?v=${ctx.version}" defer></script>`,
  });
}

// A message taken by the AI voice agent: a number to ring back instead of an email address.
function phoneHeader(m) {
  return html`<header><span class="tag tag-phone">☎ Phone</span> <strong>${m.name}</strong> · ${m.phone ? html`<a href="tel:${m.phone.replace(/[^\d+]/g, '')}">${m.phone}</a>` : html`<span class="muted">Number withheld</span>`} · <span class="tag tag-sky">${m.topic || 'General'}</span>${m.urgency === 'urgent' ? html` <span class="tag tag-urgent">Urgent</span>` : ''}${m.needs_review ? html` <span class="tag tag-check">Please check</span>` : ''} <span class="muted">${when(m.at)}</span></header>`;
}

function describe(theme, r) {
  if (r.kind === 'field') {
    const key = r.ref;
    const page = key.split('.')[0];
    return `${theme.fields[key]?.type === 'image' ? 'Photo' : 'Text'} "${key}" (${page})`;
  }
  const [coll] = r.ref.split(':');
  const label = theme.collections[coll]?.label ?? coll;
  const data = r.after ?? r.before ?? {};
  const name = typeof data === 'object' ? (data.name || data.title || data.stage || data.year || data.caption || '') : '';
  return `${label}${name ? ` "${name}"` : ''}`;
}

const preview = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return '';
  const s = String(v).replace(/<[^>]+>/g, ' ');
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

export function historyPage(ctx, { revisions }) {
  const verb = { update: 'Changed', create: 'Added', delete: 'Deleted', move: 'Moved' };
  return adminLayout(ctx, {
    title: 'Change history',
    body: html`<h1 class="admin-h1">Change history</h1>
<p>The latest 200 changes. <strong>Put back</strong> undoes a change (for a deletion, it adds the item back at the end of its list).</p>
<table class="admin-table">
<thead><tr><th>When</th><th>Who</th><th>What</th><th>Before</th><th></th></tr></thead>
<tbody>
${revisions.map((r) => html`<tr>
  <td>${when(r.at)}</td>
  <td>${r.user_name ?? '—'}</td>
  <td>${verb[r.action] ?? r.action} ${describe(ctx.theme, r)}</td>
  <td class="muted">${preview(r.before)}</td>
  <td>${r.action === 'move' ? '' : html`<form method="post" action="/admin/history/${r.id}/restore">${csrfInput(ctx)}<button class="btn btn-outline btn-xs">Put back</button></form>`}</td>
</tr>`)}
</tbody>
</table>`,
  });
}

export function usersPage(ctx, { users, created }) {
  return adminLayout(ctx, {
    title: 'People',
    body: html`<h1 class="admin-h1">People who can edit the site</h1>
${created ? html`<div class="admin-card notice">
  <p><strong>${created.email}</strong> can now sign in at <code>/admin/login</code> with this temporary password:</p>
  <p class="temp-password"><code>${created.password}</code></p>
  <p>Send it to them privately. They'll be asked to choose their own password the first time they sign in. This password won't be shown again.</p>
</div>` : ''}
<table class="admin-table">
<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last signed in</th><th></th></tr></thead>
<tbody>
${users.map((u) => html`<tr${attrs({ class: u.active ? null : 'muted' })}>
  <td>${u.name}${u.active ? '' : ' (removed)'}</td>
  <td>${u.email}</td>
  <td>${u.role === 'admin' ? 'Administrator' : 'Editor'}</td>
  <td>${when(u.last_login) || 'Never'}</td>
  <td class="row-actions">${u.id === ctx.user.id ? html`<span class="muted">You</span>` : html`
    <form method="post" action="/admin/users/${u.id}">${csrfInput(ctx)}<input type="hidden" name="action" value="reset"><button class="btn btn-outline btn-xs">Reset password</button></form>
    <form method="post" action="/admin/users/${u.id}">${csrfInput(ctx)}<input type="hidden" name="action" value="role"><input type="hidden" name="role" value="${u.role === 'admin' ? 'editor' : 'admin'}"><button class="btn btn-outline btn-xs">${u.role === 'admin' ? 'Make editor' : 'Make administrator'}</button></form>
    <form method="post" action="/admin/users/${u.id}"${attrs({ 'data-confirm': u.active ? `Stop ${u.name} from signing in?` : null })}>${csrfInput(ctx)}<input type="hidden" name="action" value="${u.active ? 'deactivate' : 'activate'}"><button class="link-btn${u.active ? ' danger' : ''}">${u.active ? 'Remove access' : 'Restore access'}</button></form>`}
  </td>
</tr>`)}
</tbody>
</table>
<div class="admin-card narrow">
  <h2>Add someone</h2>
  <p><strong>Editors</strong> can change words and photos and read messages. <strong>Administrators</strong> can also add and remove people.</p>
  <form method="post" action="/admin/users" class="admin-form">
    ${csrfInput(ctx)}
    <label>Name<input name="name" required maxlength="100"></label>
    <label>Email<input name="email" type="email" required maxlength="200"></label>
    <label>Role<select name="role"><option value="editor">Editor</option><option value="admin">Administrator</option></select></label>
    <button class="btn btn-navy">Add person</button>
  </form>
</div>
<script src="/_engine/admin.js?v=${ctx.version}" defer></script>`,
  });
}

export function accountPage(ctx, { error, forced } = {}) {
  return adminLayout(ctx, {
    title: 'My account',
    nav: !forced,
    body: html`<div class="admin-card narrow">
  <h1 class="admin-h1">${forced ? 'Choose your own password' : 'Change your password'}</h1>
  ${forced ? html`<p>You signed in with a temporary password. Choose a new one to carry on.</p>` : ''}
  ${error ? html`<p class="field-error">${error}</p>` : ''}
  <form method="post" action="/admin/account" class="admin-form">
    ${csrfInput(ctx)}
    <input type="text" name="username" autocomplete="username" value="${ctx.user.email}" hidden>
    <label>Current password<input name="current" type="password" autocomplete="current-password" required></label>
    <label>New password (at least 10 characters)<input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
    <label>New password again<input name="confirm" type="password" autocomplete="new-password" minlength="10" required></label>
    <button class="btn btn-navy">Save password</button>
  </form>
  ${forced ? html`<form method="post" action="/admin/logout">${csrfInput(ctx)}<button class="link-btn">Sign out</button></form>` : ''}
</div>`,
  });
}

const checkbox = (name, on, label) => html`<label class="admin-check"><input type="checkbox" name="${name}" value="1"${on ? raw(' checked') : ''}> ${label}</label>`;

export function assistantPage(ctx, { settings: s, hasKey, model, effort, digestSize, chats }) {
  const live = hasKey && s.enabled;
  return adminLayout(ctx, {
    title: 'Chat assistant',
    body: html`<h1 class="admin-h1">Chat assistant</h1>
<p>A chat popup in the bottom corner of every page, where visitors ask questions about ${ctx.siteName} and an AI assistant (Claude, by Anthropic) answers from the words on this website and anything you add below. These settings belong to this site only.</p>
<div class="admin-card notice">
  <p><strong>Status: ${live ? 'on, visitors can see it.' : !hasKey ? 'off: the server has no API key.' : 'off: turned off below.'}</strong></p>
  ${hasKey
    ? html`<p class="muted">Model <code>${model}</code>, effort <code>${effort}</code>. These and the API key are set on the server (<code>ANTHROPIC_API_KEY</code>, <code>ASSISTANT_MODEL</code>, <code>ASSISTANT_EFFORT</code> in the site's stack).</p>`
    : html`<p>Ask whoever runs the server to add <code>ANTHROPIC_API_KEY</code> to this site's stack and redeploy. You can get everything ready here first.</p>`}
</div>
<form method="post" action="/admin/assistant" class="admin-form admin-card wide">
  ${csrfInput(ctx)}
  <h2>How it looks</h2>
  ${checkbox('enabled', s.enabled, 'Show the chat assistant to visitors')}
  <label>Name (shown as "Ask …")<input name="name" maxlength="60" value="${s.name}" required></label>
  <label>Line under the name<input name="status" maxlength="80" value="${s.status}"></label>
  <label>Greeting (the first message in the chat)<textarea name="greeting" rows="3" maxlength="500">${s.greeting}</textarea></label>
  <label>Pop-up teaser (shown once next to the chat button; leave blank for none)<input name="teaser" maxlength="160" value="${s.teaser}"></label>
  <label>Suggested questions (one per line, up to four; shown as buttons before the first question)<textarea name="suggestions" rows="4" maxlength="1000">${s.suggestions}</textarea></label>
  <label>Note under the message box<input name="disclaimer" maxlength="300" value="${s.disclaimer}"></label>
  <label>Button colour (blank for the standard dark blue; e.g. #1f5fbf)<input name="accent" maxlength="7" value="${s.accent}" placeholder="#1e2252" pattern="#[0-9a-fA-F]{6}"></label>

  <h2>What it knows and how it answers</h2>
  ${checkbox('siteContent', s.siteContent, html`Use the words on this website as its knowledge (currently about ${Math.round(digestSize / 1000)}k characters; it updates as soon as the site is edited)`)}
  <label>Extra information (facts that aren't on the site: opening hours, parking, FAQs, prices, who to contact for what)<textarea name="knowledge" rows="10" maxlength="50000">${s.knowledge}</textarea></label>
  <label>Instructions (who the assistant is, what it should and shouldn't do, its tone). Clear the box and save to go back to the standard instructions.<textarea name="instructions" rows="16" maxlength="20000">${s.instructions}</textarea></label>
  <button class="btn btn-navy">Save</button>
</form>

<h2 class="admin-h2">Recent questions</h2>
<p>The latest 100 questions visitors asked and the answers they got, to help you improve the instructions and extra information. Kept for 90 days.</p>
${chats.length ? html`<table class="admin-table">
<thead><tr><th>When</th><th>Question</th><th>Answer</th></tr></thead>
<tbody>
${chats.map((c) => html`<tr><td>${when(c.at)}</td><td>${paragraphs(c.question)}</td><td class="muted">${paragraphs(c.answer)}</td></tr>`)}
</tbody>
</table>
<form method="post" action="/admin/assistant/clear" data-confirm="Delete every logged question and answer?">${csrfInput(ctx)}<button class="link-btn danger">Clear the log</button></form>` : html`<p class="muted">No questions yet.</p>`}
<script src="/_engine/admin.js?v=${ctx.version}" defer></script>`,
  });
}
