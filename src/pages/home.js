import { html, attrs } from '../html.js';

// Colour-block programme cards on the homepage cycle through this sequence (from the design).
const CARD_STYLES = [
  ['blue', 'gold', '0deg'], ['gold', 'navy', '-1.5deg'], ['green', 'gold', '0deg'], ['white', 'blue', '1.5deg'],
  ['white', 'green', '-1deg'], ['blue', 'gold', '1deg'], ['orange', 'navy', '0deg'], ['green', 'gold', '-1.5deg'],
];

export function journeyStops(k) {
  const stops = k.items('journey');
  return k.coll('journey', stops.map((j, i) => {
    const c = k.colour(j.colour);
    const chips = j.chips.split(',').map((s) => s.trim()).filter(Boolean);
    return k.item(j, html`
      <div class="stop-card">
        ${k.F(j, 'ages', { cls: 'stop-ages' })}
        ${k.F(j, 'stage', { tag: 'h3', cls: 'stop-stage' })}
        ${k.F(j, 'blurb', { tag: 'p', cls: 'stop-blurb' })}
        ${k.F(j, 'short', { tag: 'p', cls: 'stop-short' })}
        ${chips.length || k.ed ? html`<div class="chips">${chips.map((chip) => html`<a class="chip chip-sky" href="${j.link || '/programmes'}">${chip}</a>`)}${k.ed && !chips.length ? html`<span class="chip chip-sky">Add programmes in ✎ details</span>` : ''}</div>` : ''}
      </div>
      <div class="stop-num" style="--c:${c.bg};--ink:${c.ink}">${i + 1}</div>`,
    { cls: `stop ${i % 2 ? 'stop-right' : 'stop-left'}` });
  }), { cls: 'route' });
}

export function timeline(k, { variant }) {
  const C = ['gold', 'orange', 'green', 'sky', 'gold'];
  const list = k.items('timeline');
  return k.coll('timeline', list.map((t, i) => k.item(t, variant === 'route'
    ? html`<div class="stop-card">${k.F(t, 'year', { tag: 'h3', cls: 'tl-year' })}${k.F(t, 'text', { tag: 'p', cls: 'tl-text' })}</div>
        <div class="stop-num" style="--c:${k.colour(C[i % C.length]).bg}"></div>`
    : html`<div class="tl-dot"></div>${k.F(t, 'year', { tag: 'h3', cls: 'tl-year' })}${k.F(t, 'text', { tag: 'p', cls: 'tl-text' })}`,
  { cls: variant === 'route' ? `stop ${i % 2 ? 'stop-right' : 'stop-left'}` : 'tl-item' })),
  { cls: variant === 'route' ? 'route' : 'timeline' });
}

export function home(k) {
  const featured = k.items('programmes').filter((p) => p.featured);
  const stories = k.items('stories');

  return html`
<section class="hero hero-center">
  ${k.headline('home.hero.title', { cls: 'h-hero' })}
  ${k.text('home.hero.sub', { tag: 'p', cls: 'lede' })}
  <div class="btn-row">${k.link('home.hero.cta1', { cls: 'btn btn-navy' })}${k.link('home.hero.cta2', { cls: 'btn btn-outline' })}</div>
</section>

<section class="photo-row" aria-label="Photos">
  ${k.image('home.hero.img1', { cls: 'shape-circle tilt-l photo-side', sizes: '260px' })}
  ${k.image('home.hero.img2', { cls: 'photo-wide', sizes: '(max-width: 900px) 100vw, 720px' })}
  ${k.image('home.hero.img3', { cls: 'shape-arch tilt-r photo-side ph-gold', sizes: '260px' })}
</section>

<section class="band band-blue" id="journeys">
  <div class="section-head center">
    ${k.text('home.journeys.eyebrow', { cls: 'eyebrow eyebrow-gold' })}
    ${k.text('home.journeys.title', { tag: 'h2', cls: 'h-section' })}
    ${k.text('home.journeys.sub', { tag: 'p', cls: 'sub-on-blue' })}
  </div>
  ${journeyStops(k)}
</section>

<section class="section">
  <div class="section-head split">
    ${k.text('home.programmes.title', { tag: 'h2', cls: 'h-section' })}
    ${k.link('home.programmes.link', { cls: 'more-link' })}
  </div>
  ${k.coll('programmes', featured.map((p, i) => {
    const [bg, tag, tilt] = CARD_STYLES[i % CARD_STYLES.length];
    return k.item(p, html`
      ${k.FI(p, 'image', { cls: 'pc-photo', sizes: '(max-width: 900px) 50vw, 300px', altField: 'name' })}
      <div class="pc-body">
        ${k.F(p, 'homeTag', { cls: `tag tag-${tag}` })}
        <h3 class="pc-name"><a class="stretch" href="/programmes?age=${p.stage}#p-${p.id}"${attrs({ 'data-f': k.ed && 'name', 'data-type': k.ed && 'text' })}>${p.name}</a></h3>
        ${k.F(p, 'blurb', { tag: 'p', cls: 'pc-blurb' })}
      </div>`, { cls: `prog-card card-${bg}`, attrs: { style: `--tilt:${tilt}` } });
  }), { cls: 'prog-grid', attrs: { 'data-coll-defaults': k.ed ? JSON.stringify({ featured: true }) : null } })}
</section>

${stories.length || k.ed ? html`<section class="band band-gold">
  <div class="section-head split">
    <div>${k.text('home.stories.eyebrow', { cls: 'eyebrow' })}${k.text('home.stories.title', { tag: 'h2', cls: 'h-section' })}</div>
    ${k.link('home.stories.link', { cls: 'more-link more-link-navy' })}
  </div>
  ${k.coll('stories', stories.map((s) => k.item(s, html`
    ${k.FI(s, 'image', { cls: 'story-photo', sizes: '(max-width: 900px) 100vw, 400px', altField: 'name' })}
    <div class="story-body">
      <div class="from-to">${k.F(s, 'from', { cls: 'chip chip-sky' })}<span aria-hidden="true">→</span>${k.F(s, 'to', { cls: 'chip chip-navy' })}</div>
      ${k.F(s, 'name', { tag: 'h3', cls: 'story-name' })}
      ${k.F(s, 'quote', { tag: 'blockquote', cls: 'story-quote' })}
    </div>`, { cls: 'story-card' })), { cls: 'story-grid' })}
</section>` : ''}

<section class="section">
  <div class="section-head">
    ${k.text('home.timeline.eyebrow', { cls: 'eyebrow eyebrow-muted' })}
    ${k.text('home.timeline.title', { tag: 'h2', cls: 'h-section' })}
  </div>
  ${timeline(k, { variant: 'line' })}
</section>

<section class="panel panel-navy funders-panel">
  <div>
    ${k.text('home.funders.eyebrow', { cls: 'eyebrow eyebrow-gold' })}
    ${k.text('home.funders.title', { tag: 'h2', cls: 'h-panel' })}
    ${k.text('home.funders.text', { tag: 'p', cls: 'on-dark-muted' })}
  </div>
  <div class="btn-stack">${k.link('home.funders.cta1', { cls: 'btn btn-gold' })}${k.link('home.funders.cta2', { cls: 'btn btn-outline-light' })}</div>
</section>`;
}
