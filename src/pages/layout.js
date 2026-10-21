import { html, raw, attrs } from '../html.js';
import { COLLECTIONS } from '../content/schema.js';
import { FIELDS } from '../content/defaults.js';

const NAV = [
  ['About', '/about', 'about'],
  ['Programmes', '/programmes', 'programmes'],
  ['Journeys', '/#journeys', 'journeys'],
  ['Gallery', '/gallery', 'gallery'],
  ['Shop', '/shop', 'shop'],
  ['Contact', '/contact', 'contact'],
];

// JSON inside <script type="application/json"> must not be able to close the tag.
const safeJson = (v) => raw(JSON.stringify(v).replace(/</g, '\\u003c'));

export function layout(ctx, k, { page, body, bodyClass }) {
  const f = ctx.fields;
  const title = f[`meta.${page}.title`] ?? f['site.name'];
  const description = f[`meta.${page}.description`] ?? '';
  const canonical = ctx.baseUrl ? ctx.baseUrl + ctx.path : null;
  const pageFields = Object.keys(FIELDS).filter((key) => key.startsWith(`meta.${page}.`) || (page === 'contact' && key.startsWith('contact.map.')) || (page === 'programmes' && key === 'links.booking') || (page === 'gallery' && key.startsWith('links.')));

  return html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
${ctx.baseUrl ? html`<meta property="og:image" content="${ctx.baseUrl}/img/trust-logo.png">` : ''}
<link rel="icon" href="/img/trust-logo.png">
<link rel="preload" href="/fonts/bricolage-grotesque-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=${ctx.version}">
${ctx.user ? html`<link rel="stylesheet" href="/css/editor.css?v=${ctx.version}">` : ''}
</head>
<body${attrs({ class: [bodyClass, ctx.editing && 'is-editing'].filter(Boolean).join(' ') || null })}>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/">
    ${k.image('site.logo', { cls: 'brand-logo', sizes: '64px' })}
    <span class="brand-words">${k.text('site.name', { cls: 'brand-name' })}${k.text('site.tagline', { cls: 'brand-tag' })}</span>
  </a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span></button>
  <nav id="site-nav" class="site-nav" aria-label="Main">
    ${NAV.map(([label, href, key]) => html`<a${attrs({ href, 'aria-current': key === page ? 'page' : null })}>${label}</a>`)}
    ${k.link('nav.cta', { cls: 'nav-cta' })}
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="footer-left">
    <img src="/img/trust-logo.png" alt="" width="52" height="52">
    <div>${k.text('footer.legal')}<br>${k.text('footer.charity')} · <a href="/privacy">Privacy Policy</a></div>
  </div>
  <div class="footer-right">
    <a href="mailto:${f['contact.email']}">${k.text('contact.email')}</a> · <a href="tel:${f['contact.phone'].replace(/\s/g, '')}">${k.text('contact.phone')}</a><br>${k.text('contact.address')}
  </div>
</footer>
${ctx.user ? adminBar(ctx, page) : ''}
${ctx.editing ? html`<script type="application/json" id="edit-config">${safeJson({
    csrf: ctx.csrf,
    page,
    collections: COLLECTIONS,
    pageFields: pageFields.map((key) => ({ key, type: FIELDS[key].type, value: f[key], label: fieldLabel(key) })),
  })}</script>
<script src="/js/editor.js?v=${ctx.version}" defer></script>` : ''}
<script src="/js/site.js?v=${ctx.version}" defer></script>
</body>
</html>`;
}

function fieldLabel(key) {
  return {
    'links.booking': 'Default "Book Now" link for programmes (for example the online bookings site)',
    'links.facebook': 'Facebook page address',
    'links.instagram': 'Instagram page address',
    'contact.map.lat': 'Map latitude',
    'contact.map.lon': 'Map longitude',
  }[key] ?? (key.endsWith('.title') ? 'Browser tab and search result title' : key.endsWith('.description') ? 'Search result description' : key);
}

function adminBar(ctx, page) {
  return html`<div class="admin-bar" data-admin-bar>
  <span class="admin-who">Signed in as ${ctx.user.name}</span>
  ${ctx.editing
    ? html`<button type="button" class="ab-btn" data-ed-action="page-settings">Page settings</button>
      <button type="button" class="ab-btn ab-save" data-ed-action="save" disabled>Save changes</button>
      <button type="button" class="ab-btn" data-ed-action="discard" disabled>Discard</button>
      <button type="button" class="ab-btn" data-ed-action="exit">Finish editing</button>`
    : page === 'admin' ? '' : html`<form method="post" action="/admin/edit-mode" class="ab-inline"><input type="hidden" name="_csrf" value="${ctx.csrf}"><input type="hidden" name="on" value="1"><input type="hidden" name="next" value="${ctx.url}"><button class="ab-btn ab-save">Edit this page</button></form>`}
  <a class="ab-btn" href="/admin">Admin</a>
</div>`;
}
