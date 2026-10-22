import { html } from '../../../src/theme-api.js';

const TAG_CYCLE = ['gold', 'blue', 'orange', 'green'];

// News cards, newest first. Used on the homepage (latest few) and the News page (all).
export function newsCards(k, articles, { cls = 'news-grid', addable = true } = {}) {
  const cards = articles.map((a, i) => k.item(a, html`
    ${a.image || k.ed ? html`<div class="news-photo">
      ${k.FI(a, 'image', { cls: 'news-img', sizes: '(max-width: 900px) 100vw, 400px', altField: 'title' })}
    </div>` : ''}
    <div class="news-body">
      <div class="chips">${k.F(a, 'tag', { cls: `tag tag-${TAG_CYCLE[i % TAG_CYCLE.length]}` })}<time class="news-date" datetime="${a.date}">${k.date(a.date)}</time></div>
      <h3 class="news-title"><a class="stretch" href="${k.itemUrl(a)}"${k.ed ? html` data-f="title" data-type="text"` : ''}>${a.title}</a></h3>
      ${k.F(a, 'summary', { tag: 'p', cls: 'news-summary' })}
      ${k.status(a)}
    </div>`, { cls: 'chunky news-card' }));
  return addable ? k.coll('news', cards, { cls }) : html`<div class="${cls}">${cards}</div>`;
}

export function newsPage(k) {
  const articles = k.items('news');
  return html`
<section class="hero hero-center">
  ${k.headline('news.hero.title', { cls: 'h-hero h-80' })}
  ${k.text('news.hero.sub', { tag: 'p', cls: 'lede' })}
</section>
<section class="section-grid">
  ${newsCards(k, articles)}
  ${articles.length ? '' : k.text('news.empty', { tag: 'p', cls: 'filter-empty' })}
</section>`;
}

export function articlePage(k, { item: a }) {
  const more = k.items('news').filter((n) => n.id !== a.id && !n.hidden && !k.scheduled(n)).slice(0, 3);
  return html`
${k.item(a, html`
  <header class="hero hero-left article-head">
    <a class="back-link" href="/news">← All news</a>
    <div class="chips">${k.F(a, 'tag', { cls: 'tag tag-gold' })}<time class="news-date" datetime="${a.date}">${k.date(a.date)}</time></div>
    ${k.F(a, 'title', { tag: 'h1', cls: 'h-hero h-article' })}
    ${k.F(a, 'summary', { tag: 'p', cls: 'lede lede-left' })}
    ${k.status(a)}
  </header>
  ${a.image || k.ed ? html`<div class="article-photo-wrap">${k.FI(a, 'image', { cls: 'article-photo', sizes: '(max-width: 900px) 100vw, 1180px', altField: 'title' })}</div>` : ''}
  ${k.F(a, 'body', { tag: 'div', cls: 'prose article-body' })}`,
  { tag: 'article', cls: 'article', attrs: { 'data-after-delete': k.ed ? '/news' : null } })}
${more.length ? html`<section class="section more-news">
  <div class="section-head split"><h2 class="h-section">More news</h2><a class="more-link" href="/news">All News →</a></div>
  ${newsCards(k, more, { addable: false })}
</section>` : ''}`;
}
