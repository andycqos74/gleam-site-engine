// The public business card at /c/<code> (see cards.js). The engine draws it, not the theme: it's a phone-sized card
// rather than a page of the website, so it looks the same on every site, in the organisation's logo and colour.

import { html, raw, attrs, paragraphs } from './html.js';
import { fullName, telHref } from './cards.js';

const icon = (d) => raw(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
const ICONS = {
  save: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
  phone: icon('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  mobile: icon('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'),
  email: icon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  web: icon('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
  place: icon('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  link: icon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  qr: icon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'),
};

const initials = (d) => [d.givenName, d.familyName].filter(Boolean).map((n) => n[0]).join('').toUpperCase();
const bare = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

function cardDocument(ctx, { title, description, image, body, org }) {
  return html`<!doctype html>
<html lang="${ctx.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="profile">
${image ? html`<meta property="og:image" content="${image}">` : ''}
<meta name="theme-color" content="${org.accent}">
${ctx.favicon ? html`<link rel="icon" href="${ctx.favicon}">` : ''}
<link rel="stylesheet" href="/_engine/card.css?v=${ctx.version}">
${ctx.tracker ? html`<script defer${attrs({ src: ctx.tracker.src, 'data-website-id': ctx.tracker.websiteId, 'data-domains': ctx.tracker.domains, 'data-exclude-search': 'true', 'data-do-not-track': 'true' })}></script>` : ''}
</head>
<body class="bcard-page" style="${`--bc-accent:${org.accent};--bc-on-accent:${org.ink}`}">
${body}
</body>
</html>`;
}

// ctx: { lang, version, favicon, tracker, baseUrl }; card from cards.js; org = cards.org(); qr = the QR code SVG.
export function cardPage(ctx, { card, org, url, qr }) {
  const d = card.data;
  const name = fullName(d);
  const role = [d.title, d.department].filter(Boolean).join(' · ');
  const phone = d.phone || org.phone;
  const website = d.website || org.website;
  const rows = [
    d.mobile && { icon: ICONS.mobile, label: 'Mobile', text: d.mobile, href: telHref(d.mobile) },
    phone && { icon: ICONS.phone, label: d.phone ? 'Phone' : 'Office', text: phone, href: telHref(phone) },
    d.email && { icon: ICONS.email, label: 'Email', text: d.email, href: `mailto:${d.email}` },
    website && { icon: ICONS.web, label: 'Website', text: bare(website), href: website },
    org.address && { icon: ICONS.place, label: 'Address', text: org.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${org.orgName}, ${org.address}`)}` },
  ].filter(Boolean);
  const call = d.mobile || phone;
  const image = d.photo && ctx.baseUrl && !/\.svg$/i.test(d.photo) ? ctx.baseUrl + d.photo : null;

  return cardDocument(ctx, {
    title: `${name} | ${org.orgName}`,
    description: [role, org.orgName].filter(Boolean).join(', '),
    image,
    org,
    body: html`<main class="bcard">
  <header class="bc-band">
    ${org.logo ? html`<img class="bc-logo" src="${org.logo}" alt="${org.orgName}">` : html`<span class="bc-org-name">${org.orgName}</span>`}
  </header>
  <section class="bc-who">
    ${d.photo ? html`<img class="bc-photo" src="${d.photo}" alt="" width="132" height="132">` : html`<span class="bc-photo bc-initials" aria-hidden="true">${initials(d)}</span>`}
    <h1 class="bc-name">${name}${d.pronouns ? html` <span class="bc-pronouns">(${d.pronouns})</span>` : ''}</h1>
    ${role ? html`<p class="bc-role">${role}</p>` : ''}
    <p class="bc-org">${org.orgName}</p>
  </section>
  <nav class="bc-actions" aria-label="Contact">
    <a class="bc-save" href="/c/${card.code}.vcf" data-umami-event="card-save">${ICONS.save}<span>Save contact</span></a>
    ${call ? html`<a class="bc-round" href="${telHref(call)}" aria-label="${`Call ${name}`}">${ICONS.phone}</a>` : ''}
    ${d.email ? html`<a class="bc-round" href="mailto:${d.email}" aria-label="${`Email ${name}`}">${ICONS.email}</a>` : ''}
  </nav>
  ${rows.length ? html`<ul class="bc-rows">${rows.map((r) => html`<li><a href="${r.href}"${attrs(/^https?:/.test(r.href) ? { target: '_blank', rel: 'noopener' } : {})}><span class="bc-icon">${r.icon}</span><span class="bc-text"><span class="bc-label">${r.label}</span><span class="bc-value">${r.label === 'Address' ? paragraphs(r.text) : r.text}</span></span></a></li>`)}</ul>` : ''}
  ${d.links.length ? html`<ul class="bc-links">${d.links.map((l) => html`<li><a href="${l.url}" target="_blank" rel="noopener">${ICONS.link}<span>${l.label}</span></a></li>`)}</ul>` : ''}
  ${d.bio ? html`<section class="bc-bio">${paragraphs(d.bio)}</section>` : ''}
  <details class="bc-qr">
    <summary>${ICONS.qr}<span>Show QR code</span></summary>
    <div class="bc-qr-box">${raw(qr)}<p>Scan to open this card on another phone.</p><p class="bc-url">${bare(url)}</p></div>
  </details>
</main>`,
  });
}

// A card that's been deactivated (the person has moved on, or it was replaced). Nothing about them is shown.
export function retiredCardPage(ctx, { org }) {
  return cardDocument(ctx, {
    title: `Business card | ${org.orgName}`,
    description: org.orgName,
    org,
    body: html`<main class="bcard">
  <header class="bc-band">
    ${org.logo ? html`<img class="bc-logo" src="${org.logo}" alt="${org.orgName}">` : html`<span class="bc-org-name">${org.orgName}</span>`}
  </header>
  <section class="bc-who bc-retired">
    <h1 class="bc-name">This business card is no longer in use</h1>
    <p class="bc-role">To get in touch with ${org.orgName}, visit our website.</p>
    <a class="bc-save" href="${org.website || '/'}">${ICONS.web}<span>${org.website ? bare(org.website) : 'Go to the website'}</span></a>
  </section>
</main>`,
  });
}
