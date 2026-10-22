// The app page template ("Red Hat" design), shared by all six apps. apps.js lists each app's sections.

import { html } from '../../../src/theme-api.js';
import { appMark, wordmark } from '../marks.js';

const dash = (cls = 'dash-36') => html`<span class="pdash ${cls}"></span>`;

// A card with a cut top-right corner, an accent bar along the top and an accent diagonal on the cut.
const cut = (inner, { cls = '', sunken = false } = {}) => html`<div class="cut-in${sunken ? ' cut-sunken' : ''}${cls ? ` ${cls}` : ''}">${inner}</div>`;

// Section heading with its accent dash. reveal: the heading animates in on its own (it isn't inside a block that does).
function heading(k, key, s, { reveal = false } = {}) {
  return html`<h2 class="app-h2"${reveal ? html` data-reveal` : ''}>${s.dash === false ? '' : dash()}${k.text(`${key}.${s.type}.title`)}</h2>`;
}

function panels(k, key) {
  return k.items(`${key}Panels`).map((it) => k.item(it, cut(html`
    ${k.F(it, 'label', { cls: 'mono' })}
    ${k.F(it, 'title', { tag: 'h2', cls: 'app-h2 h2-22' })}
    ${k.F(it, 'text', { tag: 'p' })}`, { sunken: true }), { cls: 'cut' }));
}

const SECTIONS = {
  intro: (k, key, s) => html`<section class="app-sec two-col" data-reveal>
    ${heading(k, key, s)}
    ${k.rich(`${key}.intro.body`, { cls: 'rt p17' })}
  </section>`,

  how: (k, key, s) => html`<section id="how" class="app-sec stack">
    ${heading(k, key, s, { reveal: true })}
    ${k.coll(`${key}Steps`, k.items(`${key}Steps`).map((it, i) => k.item(it, html`
      ${dash('dash-56')}
      <span class="mono step-label">Step ${String(i + 1).padStart(2, '0')}</span>
      ${k.F(it, 'title', { tag: 'h3', cls: 'app-h3' })}
      ${k.F(it, 'text', { tag: 'div', cls: 'rt' })}`, { cls: 'app-step' })), { cls: 'grid grid-260 gap-36', attrs: { 'data-stagger': '' } })}
  </section>`,

  features: (k, key, s) => html`<section${s.id ? html` id="${s.id}"` : ''} class="app-sec stack">
    ${heading(k, key, s, { reveal: true })}
    ${k.coll(`${key}Features`, k.items(`${key}Features`).map((it) => k.item(it, cut(html`
      ${k.F(it, 'title', { cls: 'card-title' })}
      ${k.F(it, 'text', { tag: 'div', cls: 'rt' })}`), { cls: it.wide ? 'cut cut-wide' : 'cut' })), { cls: 'grid grid-300', attrs: { 'data-stagger': '' } })}
  </section>`,

  list: (k, key, s) => html`<section class="app-sec two-col gap-36">
    <div class="stack-18" data-reveal>
      ${heading(k, key, s)}
      ${k.text(`${key}.list.text`, { tag: 'p', cls: 'p17' })}
    </div>
    ${k.coll(`${key}Points`, k.items(`${key}Points`).map((it) => k.item(it, html`${k.F(it, 'title', { tag: 'strong' })} ${k.F(it, 'text', { tag: 'div', cls: 'rt-inline' })}`, { tag: 'li' })), { tag: 'ul', cls: 'rule-list', attrs: { 'data-stagger': '' } })}
  </section>`,

  platforms: (k, key, s) => html`<section class="app-sec two-col gap-36">
    <div class="stack-18" data-reveal>
      <h2 class="app-h2 h2-22">${k.text(`${key}.platforms.title`)}</h2>
      ${k.coll(`${key}Points`, k.items(`${key}Points`).map((it) => k.item(it, html`${k.F(it, 'title')} ${k.F(it, 'text', { tag: 'div', cls: 'rt-inline plain' })}`, { tag: 'li' })), { tag: 'ul', cls: 'rule-list rule-list-strong', attrs: { 'data-stagger': '' } })}
    </div>
    ${k.coll(`${key}Panels`, panels(k, key), { cls: 'panel-stack', attrs: { 'data-stagger': '' } })}
  </section>`,

  reasons: (k, key, s) => html`<section class="app-sec stack">
    ${heading(k, key, s, { reveal: true })}
    ${k.coll(`${key}Points`, k.items(`${key}Points`).map((it) => k.item(it, html`
      ${k.F(it, 'title', { tag: 'h3', cls: 'app-h3' })}
      ${k.F(it, 'text', { tag: 'div', cls: 'rt' })}`, { cls: 'reason' })), { cls: 'grid grid-220 gap-36 reasons', attrs: { 'data-stagger': '' } })}
  </section>`,

  panels: (k, key) => html`<section class="app-sec">
    ${k.coll(`${key}Panels`, panels(k, key), { cls: 'grid grid-320', attrs: { 'data-stagger': '' } })}
  </section>`,

  closing: (k, key, s) => html`<section class="app-sec two-col" data-reveal>
    ${heading(k, key, s)}
    ${k.text(`${key}.closing.text`, { tag: 'p', cls: 'p17' })}
  </section>`,
};

export function appPage(app) {
  const { key } = app;
  return (k) => {
    const cta2Text = app.hero.cta2Style === 'text';
    return html`
<div class="hero-band">
  <section class="hero-white">
    <div class="wrap app-hero-in">
      <div class="hero-copy">
        <div class="app-brand" data-enter>${appMark(app.mark, 44)}<span class="wordmark wm-24">${wordmark(app.name)}</span></div>
        ${k.text(`${key}.hero.title`, { tag: 'h1', cls: 'app-h1', attrs: { 'data-enter': '' } })}
        ${k.text(`${key}.hero.lead`, { tag: 'p', cls: 'lead', attrs: { 'data-enter': '' } })}
        <div class="${cta2Text ? 'btn-row btn-row-text' : 'btn-row'}" data-enter>
          ${k.link(`${key}.hero.cta`, { cls: 'btn btn-primary btn-lg' })}
          ${k.link(`${key}.hero.cta2`, { cls: cta2Text ? 'text-link' : 'btn btn-secondary btn-lg', hideEmpty: true })}
        </div>
      </div>
      <div class="hero-mark" aria-hidden="true">${appMark(app.mark, 320, { cls: 'mark-big' })}</div>
    </div>
  </section>
</div>

<div class="wrap app-main">
${app.sections.map((s) => SECTIONS[s.type](k, key, s))}
</div>

<div class="cta-band">
  <section class="cta-navy">
    <div class="wrap cta-in" data-reveal>
      <span class="cta-dashes">${dash('dash-80')}${app.mark === 'patrician' ? dash('dash-80 dash-second') : ''}</span>
      ${k.text(`${key}.cta.title`, { tag: 'h2', cls: 'cta-h2' })}
      ${k.value(`${key}.cta.text`) || k.ed ? k.text(`${key}.cta.text`, { tag: 'p', cls: 'p17 cta-text' }) : ''}
      ${k.link(`${key}.cta.button`, { cls: 'btn btn-secondary btn-lg' })}
    </div>
  </section>
</div>`;
  };
}
