import { html } from '../html.js';
import { STAGES } from '../content/schema.js';

const TAG_CYCLE = ['gold', 'blue', 'orange', 'green'];

export function filterChips(name, options, { label }) {
  return html`<div class="filters" role="radiogroup" aria-label="${label}" data-filter="${name}">
    ${Object.entries(options).map(([value, text], i) => html`<button type="button" class="filter-chip" role="radio" data-value="${value}" aria-checked="${i === 0 ? 'true' : 'false'}">${text}</button>`)}
  </div>`;
}

export function programmes(k) {
  const progs = k.items('programmes');
  const venues = k.items('venues');
  const bookDefault = k.value('links.booking');

  return html`
<section class="hero hero-center">
  ${k.headline('programmes.hero.title', { cls: 'h-hero h-80' })}
  ${k.text('programmes.hero.sub', { tag: 'p', cls: 'lede' })}
  ${filterChips('age', { all: 'All ages', ...STAGES }, { label: 'Filter by age' })}
</section>

<section class="section-list">
  ${k.coll('programmes', progs.map((p, i) => {
    const tag = TAG_CYCLE[i % TAG_CYCLE.length];
    return k.item(p, html`
      ${k.FI(p, 'image', { cls: 'pr-photo', sizes: '(max-width: 900px) 100vw, 340px', altField: 'name' })}
      <div class="pr-info">
        <div class="chips">${k.F(p, 'typeTag', { cls: `tag tag-${tag}` })}<span class="tag tag-sky">${STAGES[p.stage]}</span></div>
        ${k.F(p, 'name', { tag: 'h2', cls: 'pr-name' })}
        ${k.F(p, 'blurb', { tag: 'p', cls: 'pr-blurb' })}
        <div class="pr-when"><span>When: ${k.F(p, 'when', { keepEmpty: true })}</span><span>Where: ${k.F(p, 'where', { keepEmpty: true })}</span></div>
      </div>
      <div class="pr-actions">
        ${k.F(p, 'price', { cls: 'pr-price' })}
        ${k.FL(p, 'bookLabel', 'bookUrl', { cls: 'btn btn-navy btn-block', fallbackUrl: bookDefault })}
        ${k.FL(p, null, 'moreUrl', { cls: 'btn btn-outline btn-block', label: 'Find Out More', fallbackUrl: '/contact?topic=Programmes' })}
      </div>`, { cls: 'chunky chunky-lg prog-row', attrs: { id: `p-${p.id}`, 'data-age': p.stage } });
  }), { cls: 'prog-list', attrs: { 'data-filter-target': 'age' } })}
  <p class="filter-empty" hidden>Nothing for this age group just now. <a href="/contact?topic=Programmes">Ask us what's coming up.</a></p>
</section>

<section class="band band-blue camp">
  <div class="camp-copy">
    ${k.text('programmes.camp.eyebrow', { cls: 'eyebrow eyebrow-gold' })}
    ${k.text('programmes.camp.title', { tag: 'h2', cls: 'h-section h-64' })}
    <div class="chips chips-lg">${k.text('programmes.camp.venue', { cls: 'tag-lg tag-gold' })}${k.text('programmes.camp.time', { cls: 'tag-lg tag-white' })}</div>
    ${k.text('programmes.camp.text', { tag: 'p', cls: 'sub-on-blue' })}
    <div>${k.link('programmes.camp.cta', { cls: 'btn btn-gold' })}</div>
  </div>
  <div class="camp-photos">
    ${k.image('programmes.camp.img1', { cls: 'camp-photo tilt-l2 border-white', sizes: '(max-width: 900px) 50vw, 300px' })}
    ${k.image('programmes.camp.img2', { cls: 'camp-photo shape-arch tilt-r2 border-white ph-gold', sizes: '(max-width: 900px) 50vw, 300px' })}
  </div>
</section>

<section class="section">
  ${k.text('programmes.venues.title', { tag: 'h2', cls: 'h-section' })}
  ${k.coll('venues', venues.map((v) => k.item(v, html`
    ${k.F(v, 'name', { tag: 'h3', cls: 'venue-name' })}
    ${k.F(v, 'what', { tag: 'p', cls: 'venue-text' })}
    ${v.mapUrl ? html`<a class="venue-map" href="${v.mapUrl}" rel="noopener">Map</a>` : ''}`,
  { cls: 'venue-card', attrs: { style: `--c:${k.colour(v.colour).bg}` } })), { cls: 'venue-grid' })}
</section>`;
}

