import { html, attrs } from '../../../src/theme-api.js';
import { APPS } from '../apps.js';
import { logo } from '../marks.js';

const HOME_NAV = [['AI services', '#ai-services'], ['Apps', '#apps'], ['Why now', '#why-now'], ['How we work', '#how'], ['Services', '#services']];

// Extra <head> content: preload the fonts the first screen uses, and switch on the entrance animations early.
export function head(k, { page, version }) {
  const heading = page === 'home' ? '/fonts/C64Keyboard-Regular.otf' : '/fonts/red-hat-display-latin-700-normal.woff2';
  return html`<link rel="preload" href="/fonts/figtree-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${heading}" as="font" type="${heading.endsWith('.otf') ? 'font/otf' : 'font/woff2'}" crossorigin>
<script src="/js/anim-init.js?v=${version}"></script>`;
}

// Everything inside <body>. The home page's nav jumps to its sections; every other page lists the six apps.
export function layout(k, { page, body }) {
  const home = page === 'home';
  const app = APPS.find((a) => a.key === page);
  return html`<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-in">
    <a class="logo-link" href="${home ? '#top' : '/'}">${logo(0.6)}</a>
    <nav aria-label="Main" class="${home ? 'nav nav-home' : 'nav nav-apps'}">
      ${home
        ? html`${HOME_NAV.map(([label, href]) => html`<a href="${href}">${label}</a>`)}${k.link('nav.cta', { cls: 'btn btn-primary' })}`
        : APPS.map((a) => html`<a${attrs({ href: a.path, 'aria-current': a === app ? 'page' : null })}>${a.name}</a>`)}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-in">
    <a class="logo-link" href="/">${logo(0.45)}</a>
    ${k.text('footer.text', { cls: 'mono' })}
  </div>
</footer>`;
}

export function notFound() {
  return html`<section class="hero-band"><div class="hero-white"><div class="wrap app-hero-in notfound">
  <div class="hero-copy">
    <h1 class="app-h1">Page not found</h1>
    <p class="lead">That page has moved or never existed.</p>
    <div class="btn-row"><a class="btn btn-primary btn-lg" href="/">Go to the homepage</a></div>
  </div>
</div></div></section>`;
}
