import { html } from '../../../src/theme-api.js';
import { GALLERY_CATEGORIES } from '../collections.js';
import { filterChips } from './programmes.js';

export function gallery(k) {
  // Visitors only see tiles that have a photo; editors also see the empty slots so they can fill them.
  const tiles = k.items('gallery').filter((g) => g.image || k.ed);
  const cats = Object.fromEntries(Object.entries(GALLERY_CATEGORIES).map(([key, c]) => [key, c.label]));

  return html`
<section class="hero hero-center">
  ${k.headline('gallery.hero.title', { cls: 'h-hero h-80', pills: ['green'] })}
  ${filterChips('gcat', { all: 'All', ...cats }, { label: 'Filter photos' })}
</section>

<section class="section-grid">
  ${k.coll('gallery', tiles.map((g) => {
    const cat = GALLERY_CATEGORIES[g.category];
    return k.item(g, html`
      ${k.ed ? '' : html`<button type="button" class="tile-open" data-lightbox="${g.image}" data-caption="${g.caption || cat.label}" aria-label="View photo${g.caption ? `: ${g.caption}` : ''}"></button>`}
      ${k.FI(g, 'image', { cls: 'tile-img', sizes: g.size === 'l' || g.size === 'wide' ? '(max-width: 900px) 100vw, 600px' : '(max-width: 900px) 50vw, 300px', altField: 'caption' })}
      <span class="tag tag-${cat.colour} tile-tag">${cat.label}</span>`,
    { cls: `tile tile-${g.size} tile-${g.shape}`, attrs: { 'data-gcat': g.category } });
  }), { cls: 'gallery-grid', attrs: { 'data-filter-target': 'gcat' } })}
  <p class="filter-empty" hidden>No photos in this category yet.</p>
</section>

<section class="panel panel-blue share">
  <div>
    ${k.text('gallery.share.title', { tag: 'h2', cls: 'h-panel' })}
    ${k.text('gallery.share.text', { tag: 'p', cls: 'sub-on-blue' })}
  </div>
  <div class="btn-row">
    ${k.value('links.facebook') || k.ed ? html`<a class="btn btn-gold" href="${k.value('links.facebook') || '#'}" rel="noopener"${k.ed ? html` data-k="gallery.share.facebook" data-type="text" data-link-k="links.facebook"` : ''}>${k.value('gallery.share.facebook')}</a>` : ''}
    ${k.value('links.instagram') || k.ed ? html`<a class="btn btn-white" href="${k.value('links.instagram') || '#'}" rel="noopener"${k.ed ? html` data-k="gallery.share.instagram" data-type="text" data-link-k="links.instagram"` : ''}>${k.value('gallery.share.instagram')}</a>` : ''}
  </div>
</section>

<dialog class="lightbox" aria-label="Photo">
  <img alt="">
  <p class="lightbox-caption"></p>
  <button type="button" class="lb-btn lb-prev" aria-label="Previous photo">‹</button>
  <button type="button" class="lb-btn lb-next" aria-label="Next photo">›</button>
  <button type="button" class="lb-btn lb-close" aria-label="Close">×</button>
</dialog>`;
}
