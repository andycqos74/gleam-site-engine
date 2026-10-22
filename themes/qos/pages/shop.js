import { html } from '../../../src/theme-api.js';
import { SHOP_CATEGORIES } from '../collections.js';
import { filterChips } from './programmes.js';

export function shop(k) {
  const products = k.items('products');
  const cats = Object.fromEntries(Object.entries(SHOP_CATEGORIES).map(([key, c]) => [key, c.label]));

  return html`
<section class="panel panel-navy shop-hero">
  <div>
    ${k.headline('shop.hero.title', { cls: 'h-hero h-72', pills: ['gold'] })}
    ${k.text('shop.hero.sub', { tag: 'p', cls: 'on-dark-muted lede-left' })}
  </div>
  ${k.image('shop.hero.img', { cls: 'shop-arch shape-arch-lg tilt-r2 border-gold ph-navy', sizes: '(max-width: 900px) 100vw, 480px' })}
</section>

<section class="toolbar">
  ${filterChips('cat', { all: 'All', ...cats }, { label: 'Filter by category' })}
</section>

<section class="section-grid">
  ${k.coll('products', products.map((p) => {
    const cat = SHOP_CATEGORIES[p.category];
    return k.item(p, html`
      <div class="product-photo">
        ${k.FI(p, 'image', { cls: 'product-img', sizes: '(max-width: 900px) 50vw, 300px', altField: 'name' })}
        <span class="tag tag-${cat.colour} product-cat">${cat.label}</span>
      </div>
      <div class="product-body">
        ${k.F(p, 'name', { tag: 'h2', cls: 'product-name' })}
        ${k.F(p, 'note', { tag: 'p', cls: 'product-note' })}
      </div>
      <div class="product-foot">
        ${k.F(p, 'price', { cls: 'product-price' })}
        ${k.FL(p, 'actionLabel', 'url', { cls: 'btn btn-navy btn-xs', label: p.actionLabel || cat.action, fallbackUrl: '/contact?topic=Bookings' })}
      </div>`, { cls: 'chunky product', attrs: { 'data-cat': p.category } });
  }), { cls: 'product-grid', attrs: { 'data-filter-target': 'cat' } })}
  <p class="filter-empty" hidden>Nothing in this category just now.</p>
</section>

<section class="band band-gold party">
  <div>
    ${k.text('shop.party.title', { tag: 'h2', cls: 'h-band' })}
    ${k.text('shop.party.text', { tag: 'p', cls: 'band-text' })}
  </div>
  ${k.link('shop.party.cta', { cls: 'btn btn-navy' })}
</section>`;
}
