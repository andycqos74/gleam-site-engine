import { html, attrs } from '../../../src/theme-api.js';
import { CONTACT_TOPICS } from '../collections.js';

export function contact(k, { form = {}, errors = {}, sent = false, topic } = {}) {
  const f = k.value;
  const lat = Number(f('contact.map.lat')) || 55.0714;
  const lon = Number(f('contact.map.lon')) || -3.6231;
  const bbox = [lon - 0.012, lat - 0.006, lon + 0.012, lat + 0.006].map((n) => n.toFixed(5)).join(',');
  const chosen = CONTACT_TOPICS.includes(form.topic) ? form.topic : CONTACT_TOPICS.includes(topic) ? topic : CONTACT_TOPICS[0];
  const err = (name) => (errors[name] ? html`<span class="field-error" id="err-${name}">${errors[name]}</span>` : '');

  return html`
<section class="hero hero-left">
  ${k.headline('contact.hero.title', { cls: 'h-hero h-80' })}
  ${k.text('contact.hero.sub', { tag: 'p', cls: 'lede lede-left' })}
</section>

<section class="contact-grid">
  <div class="chunky chunky-lg contact-card">
    ${k.text('contact.form.title', { tag: 'h2', cls: 'card-title' })}
    <div class="form-success"${attrs({ hidden: !sent && !k.ed })} role="status">
      ${k.text('contact.form.success', { tag: 'p' })}
    </div>
    ${sent ? '' : html`<form class="contact-form" method="post" action="/contact" novalidate>
      <div class="form-row">
        <label>Name<input name="name" autocomplete="name" placeholder="Your name" maxlength="200" required value="${form.name ?? ''}"${attrs({ 'aria-invalid': errors.name ? 'true' : null, 'aria-describedby': errors.name ? 'err-name' : null })}>${err('name')}</label>
        <label>Email<input name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="200" required value="${form.email ?? ''}"${attrs({ 'aria-invalid': errors.email ? 'true' : null, 'aria-describedby': errors.email ? 'err-email' : null })}>${err('email')}</label>
      </div>
      <fieldset class="topics">
        <legend>What's it about?</legend>
        <div class="chips">${CONTACT_TOPICS.map((t) => html`<label class="topic-chip"><input type="radio" name="topic" value="${t}"${attrs({ checked: t === chosen })}><span>${t}</span></label>`)}</div>
      </fieldset>
      <label>Message<textarea name="message" placeholder="How can we help?" maxlength="5000" required${attrs({ 'aria-invalid': errors.message ? 'true' : null, 'aria-describedby': errors.message ? 'err-message' : null })}>${form.message ?? ''}</textarea>${err('message')}</label>
      <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
      ${errors.form ? html`<p class="field-error">${errors.form}</p>` : ''}
      <div><button class="btn btn-navy" type="submit">Send Message</button></div>
    </form>`}
  </div>

  <div class="contact-side">
    <div class="details-card">
      ${k.text('contact.details.eyebrow', { cls: 'eyebrow eyebrow-gold' })}
      <div class="detail"><span class="detail-label">Email</span><a class="detail-big" href="mailto:${f('contact.email')}">${k.text('contact.email')}</a></div>
      <div class="detail"><span class="detail-label">Phone</span><a class="detail-big" href="tel:${f('contact.phone').replace(/\s/g, '')}">${k.text('contact.phone')}</a></div>
      <div class="detail"><span class="detail-label">Office</span>${k.text('contact.address', { cls: 'detail-address' })}</div>
    </div>
    <div class="map">
      <iframe title="Map of Palmerston Park" loading="lazy" referrerpolicy="no-referrer"
        src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${lat},${lon}"></iframe>
      <a class="map-link" href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=16/${lat}/${lon}" rel="noopener">Open larger map</a>
    </div>
  </div>
</section>

<section class="band band-gold">
  ${k.text('contact.venues.title', { tag: 'h2', cls: 'h-section h-52' })}
  ${k.coll('venues', k.items('venues').map((v, i) => {
    const c = k.colour(v.colour);
    return k.item(v, html`
      <div class="venue-num" style="--c:${c.bg};--ink:${c.ink}">${i + 1}</div>
      ${k.F(v, 'name', { tag: 'h3', cls: 'venue-name' })}
      ${k.F(v, 'short', { tag: 'p', cls: 'venue-text' })}
      ${v.mapUrl ? html`<a class="venue-map" href="${v.mapUrl}" rel="noopener">Map</a>` : ''}`, { cls: 'venue-card venue-card-boxed' });
  }), { cls: 'venue-grid' })}
</section>`;
}
