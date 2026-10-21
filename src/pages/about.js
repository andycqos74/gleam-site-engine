import { html } from '../html.js';
import { timeline } from './home.js';

const RINGS = ['gold', 'blue', 'green', 'orange'];

export function about(k) {
  const vacancies = k.items('vacancies');
  const funders = k.items('funders');

  return html`
<section class="hero hero-split">
  <div class="hero-copy">
    ${k.text('about.hero.eyebrow', { cls: 'eyebrow eyebrow-blue' })}
    ${k.headline('about.hero.title', { cls: 'h-hero h-76' })}
    ${k.text('about.hero.text', { tag: 'p', cls: 'lede lede-left' })}
  </div>
  <div class="about-photos">
    ${k.image('about.hero.img', { cls: 'about-main', sizes: '(max-width: 900px) 100vw, 560px' })}
    ${k.image('about.hero.img2', { cls: 'about-circle shape-circle tilt-r4', sizes: '200px' })}
  </div>
</section>

${k.coll('pillars', k.items('pillars').map((p) => k.item(p, html`
  ${k.F(p, 'tag', { cls: `tag tag-${p.colour}` })}
  ${k.F(p, 'title', { tag: 'h2', cls: 'card-title' })}
  ${k.F(p, 'body', { tag: 'p', cls: 'card-text' })}`, { cls: 'chunky pillar' })), { tag: 'section', cls: 'section-tight pillars' })}

<section class="band band-blue" id="story">
  <div class="section-head center">
    ${k.text('about.story.eyebrow', { cls: 'eyebrow eyebrow-gold' })}
    ${k.text('about.story.title', { tag: 'h2', cls: 'h-section' })}
  </div>
  ${timeline(k, { variant: 'route' })}
</section>

<section class="section" id="team">
  <div class="section-head split">
    ${k.text('about.team.title', { tag: 'h2', cls: 'h-section' })}
    ${k.link('about.team.link', { cls: 'more-link' })}
  </div>
  ${k.coll('team', k.items('team').map((m, i) => k.item(m, html`
    ${k.FI(m, 'image', { cls: 'headshot', sizes: '200px', altField: 'name' })}
    ${k.F(m, 'name', { tag: 'h3', cls: 'team-name' })}
    ${k.F(m, 'role', { cls: 'chip chip-sky' })}`, { cls: 'team-member', attrs: { style: `--ring:${k.colour(RINGS[i % RINGS.length]).bg}` } })), { cls: 'team-grid' })}
</section>

${vacancies.some((v) => !v.hidden) || k.ed ? html`<section class="band band-gold join" id="join">
  <div>
    ${k.text('about.join.eyebrow', { cls: 'eyebrow' })}
    ${k.text('about.join.title', { tag: 'h2', cls: 'h-section' })}
    ${k.text('about.join.text', { tag: 'p', cls: 'band-text' })}
  </div>
  <div class="vacancies">
    ${k.coll('vacancies', vacancies.map((v) => k.item(v, html`
      <div class="chips"><span class="tag tag-blue">Vacancy</span>${k.F(v, 'hours', { cls: 'tag tag-sky' })}</div>
      ${k.F(v, 'title', { tag: 'h3', cls: 'card-title' })}
      ${k.F(v, 'summary', { tag: 'p', cls: 'card-text' })}
      <div class="vacancy-foot">
        ${v.closing || k.ed ? html`<span class="closing">Closing date: ${k.F(v, 'closing')}</span>` : html`<span></span>`}
        ${k.FL(v, 'applyLabel', 'applyUrl', { cls: 'btn btn-navy btn-sm' })}
      </div>`, { cls: 'chunky chunky-lg vacancy' })), { cls: 'vacancy-list' })}
    ${k.ed && !vacancies.some((v) => !v.hidden) ? html`<p class="ed-note">No vacancies are showing, so visitors don't see this section. Add one, or untick "Hide from visitors" on an existing one.</p>` : ''}
  </div>
</section>` : ''}

${funders.length || k.ed ? html`<section class="section section-funders">
  ${k.text('about.funders.title', { tag: 'h2', cls: 'h-panel h-navy' })}
  ${k.coll('funders', funders.map((f) => k.item(f, html`
    ${f.url && !k.ed ? html`<a href="${f.url}" rel="noopener" class="funder-link" aria-label="${f.name}"></a>` : ''}
    ${k.FI(f, 'logo', { cls: 'funder-logo', sizes: '200px', altField: 'name' })}
    ${f.logo ? '' : k.F(f, 'name', { cls: 'funder-name' })}`, { cls: 'funder' })), { cls: 'funder-grid' })}
</section>` : ''}

<section class="panel panel-navy cta-strip">
  ${k.text('about.cta.title', { tag: 'h2', cls: 'h-strip' })}
  ${k.link('about.cta.button', { cls: 'btn btn-gold' })}
</section>`;
}
