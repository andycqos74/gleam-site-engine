// Admin screens (sign-in, messages, visitors, history, people, account). They use only the engine's stylesheet
// (/_engine/editor.css, scoped under .admin-page), so they look the same whatever theme a site runs.
import { html, raw, attrs, paragraphs } from './html.js';
import { RANGES } from './analytics.js';
import { fullName, MAX_LINKS, DEFAULT_ACCENT } from './cards.js';

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
    ${u.role === 'admin' ? html`<a href="/admin/cards">Business cards</a><a href="/admin/assistant">Chat assistant</a><a href="/admin/users">People</a>` : ''}
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
  ${ctx.user.role === 'admin' ? html`<div class="admin-card">
    <h2>Business cards</h2>
    <p>Digital business cards for your staff: a page each with a <strong>Save contact</strong> button, shared by QR code or link.</p>
    <a class="btn btn-outline" href="/admin/cards">Business cards</a>
  </div>` : ''}
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
  if (r.kind === 'card') {
    const d = r.after ?? r.before ?? {};
    return `Business card "${[d.givenName, d.familyName].filter(Boolean).join(' ')}"`;
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

// ---------- Business cards (src/cards.js) ----------

const fieldError = (errors, key) => (errors?.[key] ? html`<span class="field-error">${errors[key]}</span>` : '');
const bareUrl = (url) => url.replace(/^https?:\/\//i, '');

// A photo from the photo library: uploaded through /api/media by admin.js, kept in a hidden input.
function photoPicker({ name, value, label, help, logo = false }) {
  return html`<div class="${logo ? 'photo-pick is-logo' : 'photo-pick'}" data-photo-pick>
  <span class="photo-pick-label">${label}</span>
  <div class="photo-pick-row">
    <span class="photo-pick-preview">${value ? html`<img src="${value}" alt="" data-photo-preview>` : html`<img alt="" data-photo-preview hidden>`}</span>
    <input type="hidden" name="${name}" value="${value}" data-photo-value>
    <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file hidden>
    <button type="button" class="btn btn-outline btn-xs" data-photo-choose>Upload…</button>
    <button type="button" class="link-btn" data-photo-clear${attrs({ hidden: !value })}>Remove</button>
    <span class="muted" data-photo-status aria-live="polite"></span>
  </div>
  ${help ? html`<span class="muted photo-pick-help">${help}</span>` : ''}
</div>`;
}

export function cardsPage(ctx, { cards, org, base }) {
  const active = cards.filter((c) => c.active).length;
  return adminLayout(ctx, {
    title: 'Business cards',
    body: html`<h1 class="admin-h1">Business cards</h1>
<p>A digital business card for each member of staff: a page on this site with their details and a <strong>Save contact</strong> button that adds them to the phone's contacts. Share a card by its QR code (print it, or show it on screen) or its link.</p>
${org.enabled ? '' : html`<div class="admin-card notice"><p><strong>Business cards are turned off</strong>, so their links say "not found". You can set up cards first, then turn them on in <a href="/admin/cards/settings">Organisation settings</a>.</p></div>`}
<div class="row-actions">
  <a class="btn btn-navy" href="/admin/cards/new">New card</a>
  <a class="btn btn-outline" href="/admin/cards/settings">Organisation settings</a>
</div>
${cards.length ? html`<table class="admin-table cards-table">
<thead><tr><th>Name</th><th>Link</th><th>Views</th><th>Saved</th><th></th></tr></thead>
<tbody>
${cards.map((c) => html`<tr${attrs({ class: c.active ? null : 'muted' })}>
  <td><a class="card-who" href="/admin/cards/${c.id}">${c.data.photo ? html`<img src="${c.data.photo}" alt="">` : html`<span class="card-initials" aria-hidden="true">${[c.data.givenName, c.data.familyName].filter(Boolean).map((n) => n[0]).join('')}</span>`}<span><strong>${fullName(c.data)}</strong>${c.data.title ? html`<br><span class="muted">${c.data.title}</span>` : ''}</span></a></td>
  <td>${c.active ? html`<a href="/c/${c.code}" target="_blank" rel="noopener"><code>${bareUrl(base)}/c/${c.code}</code></a>` : html`<span class="tag tag-sky">Deactivated</span>`}</td>
  <td>${c.views}</td>
  <td>${c.saves}</td>
  <td><a class="btn btn-outline btn-xs" href="/admin/cards/${c.id}">Edit</a></td>
</tr>`)}
</tbody>
</table>
<p class="muted">${active} card${active === 1 ? '' : 's'} in use. <strong>Views</strong> counts visits to a card; <strong>Saved</strong> counts taps on <em>Save contact</em>. People signed in to this admin aren't counted.</p>` : html`<p class="muted">No cards yet.</p>`}`,
  });
}

export function cardEditPage(ctx, { card, data, errors, url, qr, flash }) {
  const d = data;
  // The card's links plus two empty rows for new ones.
  const links = [...d.links, { label: '', url: '' }, { label: '', url: '' }].slice(0, MAX_LINKS);
  const input = (name, label, attrsObj = {}) => html`<label>${label}<input name="${name}" value="${d[name]}"${attrs(attrsObj)}>${fieldError(errors, name)}</label>`;
  return adminLayout({ ...ctx, flash: flash ?? ctx.flash }, {
    title: card ? fullName(card.data) : 'New business card',
    body: html`<p><a href="/admin/cards">← All business cards</a></p>
<h1 class="admin-h1">${card ? fullName(card.data) : 'New business card'}</h1>
${card && !card.active ? html`<div class="admin-card notice"><p><strong>This card is deactivated.</strong> Its link and QR code show "This business card is no longer in use", without any of these details.</p></div>` : ''}
<div class="card-edit">
<form method="post" action="${card ? `/admin/cards/${card.id}` : '/admin/cards'}" class="admin-form admin-card wide">
  ${csrfInput(ctx)}
  ${Object.keys(errors ?? {}).length ? html`<p class="field-error">Please check the details marked below.</p>` : ''}
  <h2>Who</h2>
  <div class="form-pair">
    ${input('givenName', 'First name', { maxlength: 80, autocomplete: 'off' })}
    ${input('familyName', 'Last name', { maxlength: 80, autocomplete: 'off' })}
  </div>
  ${input('pronouns', 'Pronouns (optional, e.g. she/her)', { maxlength: 40 })}
  <div class="form-pair">
    ${input('title', 'Job title', { maxlength: 120 })}
    ${input('department', 'Department or team (optional)', { maxlength: 120 })}
  </div>
  ${photoPicker({ name: 'photo', value: d.photo, label: 'Photo', help: 'A head-and-shoulders photo works best; it\'s shown in a circle. It also goes into the contact when someone saves it.' })}
  ${fieldError(errors, 'photo')}

  <h2>Contact details</h2>
  ${input('email', 'Email', { type: 'email', maxlength: 200 })}
  <div class="form-pair">
    ${input('mobile', 'Mobile (optional)', { type: 'tel', maxlength: 30 })}
    ${input('phone', 'Work phone (blank: the organisation\'s number)', { type: 'tel', maxlength: 30 })}
  </div>
  ${input('website', 'Website (blank: the organisation\'s website)', { type: 'url', maxlength: 500, placeholder: 'https://' })}

  <h2>Links</h2>
  <p class="muted">LinkedIn, a booking page, a programme… Each shows as a button on the card. Up to ${MAX_LINKS}; leave rows blank to skip them.</p>
  ${fieldError(errors, 'links')}
  ${links.map((l) => html`<div class="form-pair link-row">
    <label>Label<input name="linkLabel" value="${l.label}" maxlength="40" placeholder="LinkedIn"></label>
    <label>Address<input name="linkUrl" value="${l.url}" maxlength="500" type="url" placeholder="https://"></label>
  </div>`)}

  <h2>About</h2>
  <label>A line or two about them (optional)<textarea name="bio" rows="3" maxlength="1000">${d.bio}</textarea></label>
  <p class="muted">Only include a mobile number, photo, pronouns or anything personal with the person's agreement. Anyone with the link or QR code can see the card.</p>
  <button class="btn btn-navy">${card ? 'Save changes' : 'Create card'}</button>
</form>
${card ? html`<aside class="card-share">
  <div class="admin-card">
    <h2>Share</h2>
    ${card.active ? html`<div class="share-qr">${raw(qr)}</div>
    <p class="share-url"><code>${url}</code></p>
    <div class="row-actions">
      <button type="button" class="btn btn-outline btn-xs" data-copy="${url}">Copy link</button>
      <a class="btn btn-outline btn-xs" href="${url}" target="_blank" rel="noopener">Open card</a>
    </div>
    <p><strong>QR code:</strong> <a href="/c/${card.code}/qr.svg?download=1">SVG for print</a> · <a href="/c/${card.code}/qr.png?download=1">PNG</a></p>
    <p class="muted">The link and QR code never change, even if you edit the card, so it's safe to print them.</p>` : html`<p class="muted">Reactivate the card to share it again. Its link and QR code stay the same.</p>`}
  </div>
  <div class="admin-card">
    <h2>In use</h2>
    <p>${card.views} view${card.views === 1 ? '' : 's'}, saved ${card.saves} time${card.saves === 1 ? '' : 's'}.</p>
    <form method="post" action="/admin/cards/${card.id}/active"${attrs({ 'data-confirm': card.active ? 'Deactivate this card? Its link and QR code will say it\'s no longer in use.' : null })}>${csrfInput(ctx)}<input type="hidden" name="active" value="${card.active ? '0' : '1'}"><button class="btn btn-outline btn-xs">${card.active ? 'Deactivate' : 'Reactivate'}</button></form>
    <p class="muted">Deactivate a card when someone leaves, or when a printed QR code should stop working.</p>
    <form method="post" action="/admin/cards/${card.id}/delete" data-confirm="Delete this card and its change history permanently? Its link and QR code will stop working.">${csrfInput(ctx)}<button class="link-btn danger">Delete permanently</button></form>
  </div>
</aside>` : ''}
</div>
<script src="/_engine/admin.js?v=${ctx.version}" defer></script>`,
  });
}

export function cardSettingsPage(ctx, { settings: s, errors, defaults, flash }) {
  const input = (name, label, attrsObj = {}) => html`<label>${label}<input name="${name}" value="${s[name]}"${attrs(attrsObj)}>${fieldError(errors, name)}</label>`;
  return adminLayout({ ...ctx, flash: flash ?? ctx.flash }, {
    title: 'Business card settings',
    body: html`<p><a href="/admin/cards">← All business cards</a></p>
<h1 class="admin-h1">Organisation settings</h1>
<p>What every business card shares: the organisation's name, logo, colour and contact details. Anything left blank uses the website's own.</p>
<form method="post" action="/admin/cards/settings" class="admin-form admin-card wide">
  ${csrfInput(ctx)}
  ${checkbox('enabled', s.enabled, 'Business cards are in use (turned off, every card link says "not found")')}
  ${input('orgName', `Organisation name (blank: ${defaults.orgName})`, { maxlength: 120 })}
  ${photoPicker({ name: 'logo', value: s.logo, label: 'Logo', logo: true, help: defaults.logo ? 'Blank: the logo used in this admin.' : '' })}
  ${fieldError(errors, 'logo')}
  <label>Card colour (blank for ${DEFAULT_ACCENT})<span class="colour-row"><input type="color" value="${s.accent || DEFAULT_ACCENT}" data-colour-for="accent" aria-label="Pick a colour"><input name="accent" value="${s.accent}" maxlength="7" placeholder="${DEFAULT_ACCENT}" pattern="#[0-9a-fA-F]{6}"></span>${fieldError(errors, 'accent')}</label>
  ${input('website', `Website${defaults.website ? ` (blank: ${defaults.website})` : ''}`, { type: 'url', maxlength: 500, placeholder: 'https://' })}
  ${input('phone', 'Main phone number (used on cards without a work phone)', { type: 'tel', maxlength: 30 })}
  <label>Address<textarea name="address" rows="3" maxlength="300">${s.address}</textarea>${fieldError(errors, 'address')}</label>
  <button class="btn btn-navy">Save</button>
</form>
<script src="/_engine/admin.js?v=${ctx.version}" defer></script>`,
  });
}
