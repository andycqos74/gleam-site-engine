// Admin screens (sign-in, messages, visitors, history, people, account). They use only the engine's stylesheet
// (/_engine/editor.css, scoped under .admin-page), so they look the same whatever theme a site runs.
import { html, raw, attrs, paragraphs } from './html.js';
import { RANGES } from './analytics.js';

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
    ${ctx.analytics ? html`<a href="/admin/visitors">Visitors</a>` : ''}
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
    <p>Lists, such as cards, people and photos, have a small toolbar when you point at an item: ✎ for all the details, arrows to reorder, 👁 to hide, and 🗑 to delete. Use the <strong>+ Add</strong> button under a list to add something new.</p>
    <form method="post" action="/admin/edit-mode">${csrfInput(ctx)}<input type="hidden" name="on" value="1"><input type="hidden" name="next" value="/"><button class="btn btn-navy">Start editing the homepage</button></form>
  </div>
  <div class="admin-card">
    <h2>Messages</h2>
    <p>${unread ? `${unread} contact form message${unread === 1 ? '' : 's'} not yet marked as dealt with.` : 'No new contact form messages.'}</p>
    <a class="btn btn-outline" href="/admin/messages">View messages</a>
  </div>
  ${ctx.analytics ? html`<div class="admin-card">
    <h2>Visitors</h2>
    <p>How many people visit the site, which pages they read and how they found it. Counted without cookies.</p>
    <a class="btn btn-outline" href="/admin/visitors">See visitor figures</a>
  </div>` : ''}
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
<script src="/_engine/admin.js?v=${ctx.version}" defer></script>`,
  });
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

const count = (n) => Math.round(n).toLocaleString('en-GB');
const percent = (r) => `${Math.round(r * 100)}%`;
const duration = (s) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`);
const previousLabel = { '24h': 'the 24 hours before', '7d': 'the 7 days before', '30d': 'the 30 days before', '12m': 'the 12 months before' };

// Visitors and page views per hour, day or month, as an SVG bar chart: page views behind, visitors in front.
function visitorsChart(series) {
  const W = 1000; const H = 260; const top = 16; const bottom = 34; const left = 44;
  const max = Math.max(1, ...series.map((b) => b.pageviews), ...series.map((b) => b.visitors));
  const step = 10 ** Math.floor(Math.log10(max)); const ceil = Math.ceil(max / step) * step;
  const y = (v) => top + (H - top - bottom) * (1 - v / ceil);
  const slot = (W - left) / series.length;
  const every = Math.ceil(series.length / 12);
  const bars = series.map((b, i) => {
    const x = left + i * slot;
    return `<g><title>${b.label}: ${count(b.visitors)} visitor${b.visitors === 1 ? '' : 's'}, ${count(b.pageviews)} page view${b.pageviews === 1 ? '' : 's'}</title>`
      + `<rect class="chart-views" x="${(x + slot * 0.1).toFixed(1)}" y="${y(b.pageviews).toFixed(1)}" width="${(slot * 0.8).toFixed(1)}" height="${(y(0) - y(b.pageviews)).toFixed(1)}" rx="3"/>`
      + `<rect class="chart-visitors" x="${(x + slot * 0.25).toFixed(1)}" y="${y(b.visitors).toFixed(1)}" width="${(slot * 0.5).toFixed(1)}" height="${(y(0) - y(b.visitors)).toFixed(1)}" rx="3"/>`
      + `<rect x="${x.toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${H - top - bottom}" fill="transparent"/>`
      + (i % every === 0 ? `<text class="chart-label" x="${(x + slot / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle">${b.label}</text>` : '')
      + '</g>';
  }).join('');
  const grid = [0, ceil / 2, ceil].map((v) => `<line class="chart-grid" x1="${left}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="chart-label" x="${left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${count(v)}</text>`).join('');
  return raw(`<svg class="visitors-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitors and page views over the period">${grid}${bars}</svg>`);
}

function topList(title, list, empty = 'Nothing yet.') {
  const max = Math.max(1, ...list.map((r) => r.count));
  return html`<div class="admin-card top-list">
  <h2>${title}</h2>
  ${list.length ? html`<ol>${list.map((r) => html`<li><span class="top-bar" style="width:${(r.count / max * 100).toFixed(1)}%"></span><span class="top-name">${r.name}</span><span class="top-count">${count(r.count)}</span></li>`)}</ol>` : html`<p class="muted">${empty}</p>`}
</div>`;
}

export function visitorsPage(ctx, { analytics, range, report, error }) {
  const tabs = html`<nav class="range-tabs" aria-label="Period">${Object.entries(RANGES).map(([key, r]) => html`<a href="/admin/visitors?range=${key}"${attrs({ 'aria-current': key === range ? 'page' : null })}>${r.label}</a>`)}</nav>`;
  let body;
  if (!analytics) {
    body = html`<div class="admin-card narrow">
  <h2>Visitor figures aren't set up</h2>
  <p>This site can count visits with <a href="https://umami.is">Umami</a>, a privacy-friendly statistics server that doesn't use cookies. Once a server is running, ask whoever looks after the site to set <code>UMAMI_URL</code> and <code>UMAMI_WEBSITE_ID</code>, plus <code>UMAMI_USERNAME</code> and <code>UMAMI_PASSWORD</code> (or <code>UMAMI_API_KEY</code>) so the figures show here.</p>
</div>`;
  } else if (error) {
    body = html`${tabs}<div class="admin-card notice">
  <h2>The figures can't be shown right now</h2>
  <p>${error}</p>
  <p class="muted">Visits are still being counted${analytics.canReport ? '; try again in a few minutes' : ''}.</p>
  <a class="btn btn-outline" href="${analytics.dashboardUrl}">Open the Umami dashboard</a>
</div>`;
  } else {
    const t = report.totals; const p = report.previous; const was = previousLabel[range];
    const tile = (label, value, before) => html`<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span><span class="stat-was">${was}: ${before}</span></div>`;
    body = html`${tabs}
<div class="admin-card stats-card">
  ${report.active != null ? html`<p class="live"><span class="live-dot"></span>${count(report.active)} ${report.active === 1 ? 'person' : 'people'} on the site in the last 5 minutes</p>` : ''}
  <div class="stats">
    ${tile('Visitors', count(t.visitors), count(p.visitors))}
    ${tile('Page views', count(t.pageviews), count(p.pageviews))}
    ${tile('Visits', count(t.visits), count(p.visits))}
    ${tile('Left after one page', percent(t.bounceRate), percent(p.bounceRate))}
    ${tile('Average visit', duration(t.avgVisit), duration(p.avgVisit))}
  </div>
  <div class="chart-wrap">${visitorsChart(report.series)}</div>
  <p class="chart-key"><span class="key key-visitors"></span>Visitors <span class="key key-views"></span>Page views</p>
</div>
<div class="admin-tiles">
  ${topList('Pages', report.pages)}
  ${topList('Where visitors came from', report.referrers)}
  ${topList('Countries', report.countries)}
  ${topList('Devices', report.devices)}
  ${topList('Browsers', report.browsers)}
</div>`;
  }
  return adminLayout(ctx, {
    title: 'Visitors',
    body: html`<h1 class="admin-h1">Visitors</h1>
${body}
${analytics && !error ? html`<p class="muted">Counted by Umami without cookies or storing anyone's IP address, and updated every few minutes. Visits by people signed in to edit the site aren't counted. <a href="${analytics.dashboardUrl}">Open the full Umami dashboard</a>.</p>` : ''}`,
  });
}
