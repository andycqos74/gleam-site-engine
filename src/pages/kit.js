// Building blocks for page templates. Each helper renders plain HTML for visitors; when an approved user is in
// edit mode it adds data-* markers that public/js/editor.js turns into in-place editors.
//   data-k="key"      a single field (see content/defaults.js)
//   data-f="field"    a field of the list item it sits in (data-item / data-id), see content/schema.js
//   data-type         how it is edited: text, textarea, headline, rich, image
//   data-coll         a container whose children are list items, so the editor can add to it

import { FIELDS } from '../content/defaults.js';
import { COLLECTIONS, COLOURS } from '../content/schema.js';
import { html, raw, attrs, esc } from '../html.js';
import { srcset } from '../media.js';

const lines = (s) => raw(esc(s).replace(/\n/g, '<br>'));

export function pillsHtml(value, colours) {
  let n = 0;
  return raw(esc(value).replace(/\[([^\]]+)\]/g, (_, word) => {
    const c = colours[n % colours.length];
    return `<span class="pill pill-${c} pill-${n++ % 2 ? 'b' : 'a'}">${word}</span>`;
  }));
}

export function colour(name) {
  return COLOURS[name] ?? COLOURS.gold;
}

export function createKit(ctx) {
  const ed = ctx.editing;
  const f = ctx.fields;
  const tagOf = (t) => raw(/^[a-z][a-z0-9]*$/.test(t) ? t : 'span');

  const value = (key) => {
    if (!Object.hasOwn(FIELDS, key)) throw new Error(`Template uses unknown field ${key}`);
    return f[key];
  };

  function text(key, { tag = 'span', cls, attrs: extra = {} } = {}) {
    const v = value(key);
    const type = FIELDS[key].type;
    const T = tagOf(tag);
    return html`<${T}${attrs({ class: cls, 'data-k': ed && key, 'data-type': ed && type, ...extra })}>${type === 'textarea' ? lines(v) : v}</${T}>`;
  }

  function headline(key, { tag = 'h1', cls, pills = ['gold', 'blue'] } = {}) {
    const v = value(key);
    const T = tagOf(tag);
    return html`<${T}${attrs({ class: cls, 'data-k': ed && key, 'data-type': ed && 'headline', 'data-pills': ed && pills.join(',') })}>${pillsHtml(v, pills)}</${T}>`;
  }

  function rich(key, { tag = 'div', cls } = {}) {
    const T = tagOf(tag);
    return html`<${T}${attrs({ class: cls, 'data-k': ed && key, 'data-type': ed && 'rich' })}>${raw(value(key))}</${T}>`;
  }

  // A link whose words and address are both editable: the address lives in "<key>.url".
  function link(key, { cls, hideEmpty = false, attrs: extra = {} } = {}) {
    const url = value(`${key}.url`);
    if (hideEmpty && !url && !ed) return '';
    const external = /^https?:/i.test(url);
    return html`<a${attrs({ href: url || '#', class: cls, rel: external ? 'noopener' : null, 'data-k': ed && key, 'data-type': ed && 'text', 'data-link-k': ed && `${key}.url`, ...extra })}>${value(key)}</a>`;
  }

  function img({ src, alt, cls, sizes, edAttrs, label }) {
    if (src) {
      const set = srcset(src);
      return html`<img${attrs({ src, srcset: set, sizes: set ? (sizes ?? '(max-width: 900px) 100vw, 50vw') : null, alt: alt ?? '', class: cls, loading: 'lazy', decoding: 'async', ...edAttrs })}>`;
    }
    return html`<div${attrs({ class: `ph ${cls ?? ''}`, role: ed ? null : 'presentation', ...edAttrs })}>${ed ? html`<span class="ph-label">Add photo${label ? `: ${label}` : ''}</span>` : ''}</div>`;
  }

  function image(key, { cls, sizes } = {}) {
    const altKey = Object.hasOwn(FIELDS, `${key}.alt`) ? `${key}.alt` : null;
    return img({
      src: value(key), alt: altKey ? value(altKey) : '', cls, sizes, label: altKey ? value(altKey) : '',
      edAttrs: ed ? { 'data-k': key, 'data-type': 'image', 'data-alt-k': altKey } : {},
    });
  }

  // ---- list items ----
  function coll(name, inner, { tag = 'div', cls, attrs: extra = {} } = {}) {
    const T = tagOf(tag);
    return html`<${T}${attrs({ class: cls, 'data-coll': ed && name, 'data-coll-label': ed && COLLECTIONS[name].label, ...extra })}>${inner}</${T}>`;
  }

  function item(it, inner, { tag = 'div', cls, attrs: extra = {} } = {}) {
    const T = tagOf(tag);
    const hiddenCls = ed && it.hidden ? ' ed-hidden' : '';
    return html`<${T}${attrs({ class: `${cls ?? ''}${hiddenCls}`.trim() || null, 'data-item': ed && it.coll, 'data-id': ed && it.id, ...extra })}>${inner}</${T}>`;
  }

  function F(it, field, { tag = 'span', cls, keepEmpty = false, attrs: extra = {} } = {}) {
    const type = COLLECTIONS[it.coll].fields[field].type;
    const v = it[field];
    if (!v && !ed && !keepEmpty) return '';
    const T = tagOf(tag);
    const editType = type === 'textarea' || type === 'rich' ? type : 'text';
    const content = type === 'rich' ? raw(v) : type === 'textarea' ? lines(v) : v;
    return html`<${T}${attrs({ class: cls, 'data-f': ed && field, 'data-type': ed && editType, 'data-placeholder': ed && COLLECTIONS[it.coll].fields[field].label, ...extra })}>${content}</${T}>`;
  }

  function FI(it, field, { cls, sizes, altField } = {}) {
    const label = COLLECTIONS[it.coll].fields[field].label;
    return img({
      src: it[field], alt: altField ? it[altField] : '', cls, sizes, label: altField ? it[altField] || label : label,
      edAttrs: ed ? { 'data-f': field, 'data-type': 'image', 'data-alt-f': altField } : {},
    });
  }

  function FL(it, labelField, urlField, { cls, fallbackUrl = '#', label } = {}) {
    const url = it[urlField] || fallbackUrl;
    const words = label ?? it[labelField];
    return html`<a${attrs({ href: url, class: cls, rel: /^https?:/i.test(url) ? 'noopener' : null, 'data-f': ed && labelField, 'data-type': ed && labelField && 'text', 'data-link-f': ed && urlField })}>${words}</a>`;
  }

  return { ed, value, text, headline, rich, link, image, img, coll, item, F, FI, FL, items: ctx.items, colour };
}
