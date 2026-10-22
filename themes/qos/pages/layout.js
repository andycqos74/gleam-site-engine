import { html, attrs } from '../../../src/theme-api.js';

const NAV = [
  ['About', '/about', 'about'],
  ['Programmes', '/programmes', 'programmes'],
  ['Journeys', '/#journeys', 'journeys'],
  ['News', '/news', 'news'],
  ['Gallery', '/gallery', 'gallery'],
  ['Shop', '/shop', 'shop'],
  ['Contact', '/contact', 'contact'],
];

// Extra <head> content: preload the two fonts the first screen uses. The engine adds title, description, social
// tags, the stylesheet (theme.stylesheets) and the editing tools.
export function head(k, { version }) {
  return html`<link rel="preload" href="/fonts/bricolage-grotesque-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<script src="/js/anim-init.js?v=${version}"></script>`;
}

// Everything inside <body>: header, the page, footer.
export function layout(k, { page, body }) {
  const email = k.value('contact.email');
  const phone = k.value('contact.phone');
  return html`<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/">
    ${k.image('site.logo', { cls: 'brand-logo', sizes: '64px' })}
    <span class="brand-words">${k.text('site.name', { cls: 'brand-name' })}${k.text('site.tagline', { cls: 'brand-tag' })}</span>
  </a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span></button>
  <nav id="site-nav" class="site-nav" aria-label="Main">
    ${NAV.map(([label, href, key]) => html`<a${attrs({ href, 'aria-current': key === page ? 'page' : null })}>${label}</a>`)}
    ${k.link('nav.cta', { cls: 'nav-cta' })}
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="footer-left">
    <img src="/img/trust-logo.png" alt="" width="52" height="52">
    <div>${k.text('footer.legal')}<br>${k.text('footer.charity')} · <a href="/privacy">Privacy Policy</a></div>
  </div>
  <div class="footer-right">
    <a href="mailto:${email}">${k.text('contact.email')}</a> · <a href="tel:${phone.replace(/\s/g, '')}">${k.text('contact.phone')}</a><br>${k.text('contact.address')}
  </div>
</footer>
<div class="powered-by">
  <div class="powered-inner">
    <span class="pb-text">Powered by</span>
    <a href="https://solwai.co.uk/gleam" aria-label="Gleam"><img class="gl-mark" src="/img/gleam-mark-on-navy.svg" alt="" width="23" height="16"><span class="gl-name">GLEAM</span></a>
    <span class="pb-text">from</span>
    <a href="https://solwai.co.uk"><img class="sw-mark" src="/img/solwai-mark-on-navy.svg" alt="" width="23" height="16"><span class="sw-name">SOLW<span class="ai">AI</span></span></a>
  </div>
</div>`;
}

export function notFound() {
  return html`<section class="hero hero-center"><h1 class="h-hero h-80">Page not <span class="pill pill-gold pill-a">found</span></h1><p class="lede">That page has moved or never existed.</p><div class="btn-row"><a class="btn btn-navy" href="/">Go to the homepage</a></div></section>`;
}
