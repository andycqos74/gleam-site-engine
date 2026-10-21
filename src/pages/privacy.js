import { html } from '../html.js';

export function privacy(k) {
  return html`
<section class="hero hero-left prose-page">
  ${k.text('privacy.title', { tag: 'h1', cls: 'h-hero h-72' })}
  ${k.rich('privacy.body', { cls: 'prose' })}
</section>`;
}
