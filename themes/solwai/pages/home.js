import { html, attrs } from '../../../src/theme-api.js';
import { appMark, wordmark } from '../marks.js';
import { CONTACT_TOPICS } from '../content.js';

const tags = (list) => {
  const words = String(list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return words.length ? html`<div class="tags">${words.map((w) => html`<span class="tag">${w}</span>`)}</div>` : '';
};
const shown = (items) => items.filter((it) => !it.hidden).length;

// Section intro: mono label (optionally "· <count>"), accent dash, heading and text.
function intro(k, prefix, { count, text = true, narrow = true } = {}) {
  return html`<div class="${narrow ? 'intro intro-narrow' : 'intro'}" data-reveal>
    <span class="mono">${k.text(`${prefix}.label`)}${count != null ? ` · ${count}` : ''}</span>
    <span class="dash dash-36"></span>
    ${k.text(`${prefix}.title`, { tag: 'h2', cls: 'h2' })}
    ${text ? k.text(`${prefix}.text`, { tag: 'p', cls: 'p17' }) : ''}
  </div>`;
}

function statPanel(k, region, stats) {
  return html`<div class="panel" data-reveal>
    <div class="panel-head">
      ${k.text(`home.${region}.title`, { tag: 'h3', cls: 'h3-panel' })}
      ${k.text(`home.${region}.badge`, { cls: `badge badge-${region === 'local' ? 'info' : 'neutral'}` })}
    </div>
    ${k.coll('stats', stats.filter((s) => s.region === region).map((s) => k.item(s, html`
      ${k.F(s, 'figure', { cls: 'figure', attrs: { 'data-count': '' } })}
      ${k.F(s, 'text', { tag: 'p' })}
      ${k.F(s, 'source', { cls: 'source' })}`, { cls: 'stat' })), { cls: 'stat-grid', attrs: { 'data-coll-defaults': k.ed ? JSON.stringify({ region }) : null } })}
  </div>`;
}

const serviceCard = (k, it, cls) => k.item(it, html`
  <span class="dash dash-28 accent-${it.accent}"></span>
  ${k.F(it, 'label', { cls: 'mono' })}
  ${k.F(it, 'title', { tag: 'h3', cls: 'h3' })}
  ${k.F(it, 'text', { tag: 'p' })}
  ${tags(it.tags)}`, { tag: 'article', cls });

// The contact panel's form. It posts to the home page (theme.contact), which stores the message for Admin > Messages
// and emails it if SMTP is set up. Without JavaScript the page reloads at #contact with its errors or thanks.
function contactForm(k, { form = {}, errors = {}, sent = false, topic } = {}) {
  const chosen = CONTACT_TOPICS.includes(form.topic) ? form.topic : CONTACT_TOPICS.includes(topic) ? topic : CONTACT_TOPICS[0];
  const invalid = (name) => attrs({ 'aria-invalid': errors[name] ? 'true' : null, 'aria-describedby': errors[name] ? `err-${name}` : null });
  const err = (name) => (errors[name] ? html`<span class="field-error" id="err-${name}">${errors[name]}</span>` : '');
  const phone = k.value('contact.phone');
  return html`<div class="contact-actions">
      <div class="form-success"${attrs({ hidden: !sent && !k.ed })} role="status">
        ${k.text('home.contact.success', { tag: 'p' })}
      </div>
      ${sent ? '' : html`<form class="contact-form" method="post" action="/#contact" novalidate>
        <label>Name<input name="name" autocomplete="name" maxlength="200" required value="${form.name ?? ''}"${invalid('name')}>${err('name')}</label>
        <label>Email<input name="email" type="email" autocomplete="email" maxlength="200" required value="${form.email ?? ''}"${invalid('email')}>${err('email')}</label>
        <label>What's it about?<select name="topic">${CONTACT_TOPICS.map((t) => html`<option${attrs({ selected: t === chosen })}>${t}</option>`)}</select></label>
        <label>Message<textarea name="message" rows="4" maxlength="5000" required${invalid('message')}>${form.message ?? ''}</textarea>${err('message')}</label>
        <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
        ${errors.form ? html`<p class="field-error">${errors.form}</p>` : ''}
        <button class="btn btn-accent btn-lg btn-full" type="${k.ed ? 'button' : 'submit'}">${k.text('home.contact.cta')}</button>
      </form>`}
      ${phone || k.ed ? html`<p>Or call <a href="tel:${phone.replace(/[^\d+]/g, '')}">${k.text('contact.phone')}</a></p>` : ''}
    </div>`;
}

export function home(k, extra = {}) {
  const stats = k.items('stats');
  const apps = k.items('apps');
  const offers = k.items('offers');
  return html`
<div id="top" class="hero-band hero-band-home">
  <section class="hero-home">
    ${k.image('home.hero.image', { cls: 'hero-photo', sizes: '100vw' })}
    <div class="wrap hero-home-in">
      ${k.text('home.hero.label', { cls: 'mono on-navy', attrs: { 'data-enter': '' } })}
      ${k.text('home.hero.title', { tag: 'h1', cls: 'h1-home', attrs: { 'data-enter': '' } })}
      <span class="tide-dash" data-enter><span></span><span></span></span>
      ${k.text('home.hero.text', { tag: 'p', cls: 'hero-lead', attrs: { 'data-enter': '' } })}
      <div class="btn-row" data-enter>
        ${k.link('home.hero.cta', { cls: 'btn btn-accent btn-lg' })}
        ${k.link('home.hero.cta2', { cls: 'btn btn-secondary btn-lg' })}
      </div>
      ${k.text('home.hero.note', { tag: 'p', cls: 'hero-note', attrs: { 'data-enter': '' } })}
    </div>
  </section>
</div>

<section id="why-now" class="wrap section section-why">
  ${intro(k, 'home.why')}
  <div class="panels">
    ${statPanel(k, 'local', stats)}
    ${statPanel(k, 'national', stats)}
  </div>
  <div class="callout" data-reveal>
    ${k.text('home.callout.figure', { cls: 'callout-figure', attrs: { 'data-count': '' } })}
    ${k.text('home.callout.text', { tag: 'p' })}
    ${k.text('home.callout.source', { cls: 'source on-navy' })}
  </div>
</section>

<section id="ai-services" class="wrap section section-services">
  ${intro(k, 'home.services')}
  ${k.coll('services', k.items('services').map((it) => serviceCard(k, it, 'card service-card')), { cls: 'grid grid-250', attrs: { 'data-stagger': '' } })}
</section>

<section id="how" class="wrap section section-how">
  ${intro(k, 'home.how', { text: false, narrow: false })}
  ${k.coll('steps', k.items('steps').map((it, i) => k.item(it, html`
    <span class="step-num"><span class="dash dash-24"></span><span class="mono">${String(i + 1).padStart(2, '0')}</span></span>
    ${k.F(it, 'title', { tag: 'h3', cls: 'h3' })}
    ${k.F(it, 'text', { tag: 'p' })}`, { tag: 'li', cls: 'step' })), { tag: 'ol', cls: 'steps', attrs: { 'data-stagger': '' } })}
</section>

<section id="apps" class="apps-band">
  <div class="wrap section">
    ${intro(k, 'home.apps', { count: shown(apps) })}
    ${k.coll('apps', apps.map((it) => k.item(it, html`
      <div class="app-card-head">
        <div class="app-card-name">
          ${appMark(it.mark, 48)}
          <h3 class="wordmark wm-27">${k.ed ? k.F(it, 'name') : wordmark(it.name)}</h3>
        </div>
        ${k.F(it, 'label', { cls: 'mono' })}
      </div>
      ${k.F(it, 'text', { tag: 'p', cls: 'p16' })}
      ${k.FL(it, 'more', 'url', { cls: 'more' })}`, { tag: 'article', cls: 'card app-card' })), { cls: 'grid grid-480', attrs: { 'data-stagger': '' } })}
  </div>
</section>

<section id="services" class="wrap section section-offers">
  ${intro(k, 'home.offers', { count: shown(offers), text: false })}
  ${k.coll('offers', offers.map((it) => serviceCard(k, it, 'card offer-card')), { cls: 'grid grid-420', attrs: { 'data-stagger': '' } })}
</section>

<section id="contact" class="wrap section section-contact">
  <div class="contact-panel" data-reveal>
    <div class="contact-copy">
      <span class="dash dash-36 on-navy"></span>
      ${k.text('home.contact.title', { tag: 'h2', cls: 'h2' })}
      ${k.text('home.contact.text', { tag: 'p', cls: 'p17' })}
    </div>
    ${contactForm(k, extra)}
  </div>
</section>

<section class="wrap sources" aria-label="Sources">
  ${k.text('home.sources.title', { tag: 'h2', cls: 'mono sources-title' })}
  ${k.coll('sources', k.items('sources').map((it) => k.item(it, k.F(it, 'text'), { tag: 'li' })), { tag: 'ol' })}
</section>`;
}
