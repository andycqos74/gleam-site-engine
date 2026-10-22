// Starter theme templates. Each page is render(k, extra) => html, where k is the engine's toolkit (src/kit.js):
// k.text / k.headline / k.rich / k.image / k.link for single fields, k.coll / k.item / k.F / k.FI for lists.

import { html, attrs } from '../../src/theme-api.js';
import { CONTACT_TOPICS } from './content.js';

const NAV = [['Home', '/', 'home'], ['About', '/about', 'about'], ['News', '/posts', 'posts'], ['Contact', '/contact', 'contact']];

export function layout(k, { page, body }) {
  return html`<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="logo" href="/">${k.image('site.logo', { cls: 'logo-img', sizes: '40px' })}<span>${k.text('site.name')}</span></a>
  <nav aria-label="Main">${NAV.map(([label, href, key]) => html`<a${attrs({ href, 'aria-current': key === page ? 'page' : null })}>${label}</a>`)}</nav>
</header>
<main id="main">${body}</main>
<footer class="bottom">
  <p>${k.text('footer.text')}</p>
  <p><a href="mailto:${k.value('contact.email')}">${k.text('contact.email')}</a></p>
</footer>`;
}

const postCards = (k, posts) => k.coll('posts', posts.map((p) => k.item(p, html`
  ${p.image || k.ed ? k.FI(p, 'image', { cls: 'card-img', altField: 'title', sizes: '(max-width: 700px) 100vw, 360px' }) : ''}
  <time datetime="${p.date}">${k.date(p.date)}</time>
  <h3><a href="${k.itemUrl(p)}"${k.ed ? html` data-f="title" data-type="text"` : ''}>${p.title}</a></h3>
  ${k.F(p, 'summary', { tag: 'p' })}
  ${k.status(p)}`, { tag: 'article', cls: 'card' })), { cls: 'cards' });

export function home(k) {
  return html`
<section class="hero">
  <div>
    ${k.headline('home.hero.title', { pills: ['accent'] })}
    ${k.text('home.hero.text', { tag: 'p', cls: 'lead' })}
    ${k.link('home.hero.cta', { cls: 'button' })}
  </div>
  ${k.image('home.hero.image', { cls: 'hero-img', sizes: '(max-width: 700px) 100vw, 480px' })}
</section>
<section class="block">
  ${k.text('home.features.title', { tag: 'h2' })}
  ${k.coll('features', k.items('features').map((it) => k.item(it, html`
    ${k.F(it, 'title', { tag: 'h3' })}
    ${k.F(it, 'text', { tag: 'p' })}`, { cls: 'feature' })), { cls: 'features' })}
</section>
<section class="block">
  ${k.text('home.posts.title', { tag: 'h2' })}
  ${postCards(k, k.items('posts').filter((p) => !p.hidden && !k.scheduled(p)).slice(0, 3))}
</section>`;
}

export function about(k) {
  return html`
<section class="block narrow">
  ${k.headline('about.title', { pills: ['accent'] })}
  ${k.image('about.image', { cls: 'wide-img', sizes: '(max-width: 700px) 100vw, 720px' })}
  ${k.rich('about.body', { cls: 'prose' })}
</section>
<section class="block">
  ${k.text('about.team.title', { tag: 'h2' })}
  ${k.coll('team', k.items('team').map((m) => k.item(m, html`
    ${k.FI(m, 'photo', { cls: 'avatar', altField: 'name', sizes: '120px' })}
    ${k.F(m, 'name', { tag: 'h3' })}
    ${k.F(m, 'role', { tag: 'p' })}`, { cls: 'person' })), { cls: 'people' })}
</section>`;
}

export function posts(k) {
  return html`
<section class="block">
  ${k.headline('posts.title', { pills: ['accent'] })}
  ${postCards(k, k.items('posts'))}
</section>`;
}

export function post(k, { item: p }) {
  return k.item(p, html`
<section class="block narrow">
  <p><a href="/posts">← All news</a></p>
  <time datetime="${p.date}">${k.date(p.date)}</time>
  ${k.F(p, 'title', { tag: 'h1' })}
  ${k.F(p, 'summary', { tag: 'p', cls: 'lead' })}
  ${k.status(p)}
  ${p.image || k.ed ? k.FI(p, 'image', { cls: 'wide-img', altField: 'title', sizes: '(max-width: 700px) 100vw, 720px' }) : ''}
  ${k.F(p, 'body', { tag: 'div', cls: 'prose' })}
</section>`, { tag: 'article', attrs: { 'data-after-delete': k.ed ? '/posts' : null } });
}

// Uses the engine's contact form handler (theme.contact): fields name, email, topic, message, and the "website"
// honeypot. extra = { form, errors, sent, topic }.
export function contact(k, { form = {}, errors = {}, sent = false, topic } = {}) {
  const err = (n) => (errors[n] ? html`<span class="error">${errors[n]}</span>` : '');
  return html`
<section class="block narrow">
  ${k.headline('contact.title', { pills: ['accent'] })}
  ${k.text('contact.text', { tag: 'p', cls: 'lead' })}
  ${sent || k.ed ? k.text('contact.success', { tag: 'p', cls: 'notice' }) : ''}
  ${sent ? '' : html`<form method="post" action="/contact" class="form">
    <label>Name <input name="name" required value="${form.name ?? ''}">${err('name')}</label>
    <label>Email <input name="email" type="email" required value="${form.email ?? ''}">${err('email')}</label>
    <label>Topic <select name="topic">${CONTACT_TOPICS.map((t) => html`<option${attrs({ selected: t === (form.topic || topic) })}>${t}</option>`)}</select></label>
    <label>Message <textarea name="message" rows="6" required>${form.message ?? ''}</textarea>${err('message')}</label>
    <label class="hp" aria-hidden="true">Leave empty <input name="website" tabindex="-1" autocomplete="off"></label>
    ${errors.form ? html`<p class="error">${errors.form}</p>` : ''}
    <button class="button">Send</button>
  </form>`}
</section>`;
}

export function notFound() {
  return html`<section class="block narrow"><h1>Page not found</h1><p><a class="button" href="/">Go home</a></p></section>`;
}
