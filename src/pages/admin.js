import { html, attrs, paragraphs } from '../html.js';
import { FIELDS } from '../content/defaults.js';
import { COLLECTIONS } from '../content/schema.js';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }) : '');
const csrfInput = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf}">`;

export function adminLayout(ctx, { title, body, nav = true }) {
  const u = ctx.user;
  return html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} | Site admin</title>
<link rel="icon" href="/img/trust-logo.png">
<link rel="stylesheet" href="/css/site.css?v=${ctx.version}">
<link rel="stylesheet" href="/css/editor.css?v=${ctx.version}">
</head>
<body class="admin-page">
<header class="admin-header">
  <a class="brand" href="/"><img class="brand-logo" src="/img/trust-logo.png" alt=""><span class="brand-words"><span class="brand-name">Site admin</span><span class="brand-tag">QoS Community Trust</span></span></a>
  ${nav && u ? html`<nav class="admin-nav">
    <a href="/admin">Home</a>
    <a href="/admin/messages">Messages</a>
    <a href="/admin/history">Change history</a>
    ${u.role === 'admin' ? html`<a href="/admin/users">People</a>` : ''}
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
    <p>Lists such as programmes, team members and gallery photos have a small toolbar when you point at them: ✎ for all the details, arrows to reorder, 👁 to hide, and 🗑 to delete. Use the <strong>+ Add</strong> button under a list to add something new.</p>
    <form method="post" action="/admin/edit-mode">${csrfInput(ctx)}<input type="hidden" name="on" value="1"><input type="hidden" name="next" value="/"><button class="btn btn-navy">Start editing the homepage</button></form>
  </div>
  <div class="admin-card">
    <h2>Messages</h2>
    <p>${unread ? `${unread} contact form message${unread === 1 ? '' : 's'} not yet marked as dealt with.` : 'No new contact form messages.'}</p>
    <a class="btn btn-outline" href="/admin/messages">View messages</a>
  </div>
  <div class="admin-card">
    <h2>Made a mistake?</h2>
    <p>Every change is recorded. Use the change history to put back what was there before.</p>
    <a class="btn btn-outline" href="/admin/history">Change history</a>
  </div>
</div>`,
  });
}

export function messagesPage(ctx, { messages }) {
  return adminLayout(ctx, {
    title: 'Messages',
    body: html`<h1 class="admin-h1">Contact form messages</h1>
${messages.length ? '' : html`<p>No messages yet.</p>`}
<div class="message-list">
${messages.map((m) => html`<article class="admin-card message${m.handled ? ' is-handled' : ''}">
  <header><strong>${m.name}</strong> · <a href="mailto:${m.email}?subject=${encodeURIComponent(`Re: your message to QoS Community Trust`)}">${m.email}</a> · <span class="tag tag-sky">${m.topic || 'General'}</span> <span class="muted">${when(m.at)}</span></header>
  <div class="message-text">${paragraphs(m.message)}</div>
  <footer>
    <form method="post" action="/admin/messages/${m.id}">${csrfInput(ctx)}<input type="hidden" name="handled" value="${m.handled ? '0' : '1'}"><button class="btn btn-outline btn-xs">${m.handled ? 'Mark as not dealt with' : 'Mark as dealt with'}</button></form>
    <form method="post" action="/admin/messages/${m.id}/delete" data-confirm="Delete this message permanently?">${csrfInput(ctx)}<button class="link-btn danger">Delete</button></form>
  </footer>
</article>`)}
</div>
<script src="/js/admin.js?v=${ctx.version}" defer></script>`,
  });
}

function describe(r) {
  if (r.kind === 'field') {
    const key = r.ref;
    const page = key.split('.')[0];
    return `${FIELDS[key]?.type === 'image' ? 'Photo' : 'Text'} "${key}" (${page})`;
  }
  const [coll] = r.ref.split(':');
  const label = COLLECTIONS[coll]?.label ?? coll;
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
  <td>${verb[r.action] ?? r.action} ${describe(r)}</td>
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
<script src="/js/admin.js?v=${ctx.version}" defer></script>`,
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
