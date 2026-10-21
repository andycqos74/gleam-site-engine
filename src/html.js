// Tiny HTML templating: html`...` escapes every interpolated value unless it is already Safe (another html`` result
// or raw()). Arrays are joined, null/undefined/false render as nothing.

export class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
export const raw = (s) => new Safe(String(s ?? ''));

function render(v) {
  if (v == null || v === false) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += render(vals[i]) + strings[i + 1];
  return new Safe(out);
}

// Builds an attribute string from an object: { class: 'a', hidden: true, 'data-x': 1, skip: null }.
export function attrs(obj) {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === false) continue;
    out += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return raw(out);
}

// Plain text with blank-line paragraphs and single line breaks, for fields edited as plain text.
export function paragraphs(text) {
  return raw(String(text ?? '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''));
}
