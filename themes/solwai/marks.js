// SolwAI brand marks, drawn server-side as inline SVG (the design system's TideMark and Logo components).
// TideMark: three rows of round-capped strokes on a 48 x 33 grid; colours come from CSS custom properties so the
// same mark works on light and navy backgrounds.

import { html, raw } from '../../src/theme-api.js';

const Y = [4.5, 16.5, 28.5];
const INK = 'var(--mark-ink, var(--navy))';
const ROWS = {
  solwai: [[[11, 41], 'ink'], [[3, 45], 'var(--solwai-accent)'], [[17, 35], 'ink']],
  organiser: [[[11, 19], 'ink', [29, 37]], [[3, 45], 'var(--organiser-accent)'], [[17, 35], 'ink']],
  luggage: [[[6, 42], 'ink'], [[14, 34], 'var(--luggage-accent)'], [[23, 25], 'ink']],
  patrician: [[[17, 31], 'ink'], [[3, 45], 'var(--patrician-gold)'], [[3, 45], 'var(--patrician-purple)']],
  // Drum is not a TideMark product: three beats over a long accent stroke (from Drum.dc.html).
  drum: [[[8, 9], 'ink', [23.5, 24.5], [39, 40]], [[3, 45], 'var(--drum-accent)'], [[11, 37], 'ink']],
};

// The mark as SVG. Strokes are 5 wide, or 6 at 26px and below, as in the design system.
export function tideMark(product, width, { cls } = {}) {
  const rows = ROWS[product] ?? ROWS.solwai;
  const paths = rows.flatMap(([first, colour, ...more], i) => [first, ...more]
    .map(([a, b]) => `<path d="M${a} ${Y[i]}H${b}" stroke="${colour === 'ink' ? INK : colour}" pathLength="1"/>`));
  const h = Math.round((width * 33) / 48);
  return raw(`<svg class="${['mark', cls].filter(Boolean).join(' ')}" viewBox="0 0 48 33" width="${width}" height="${h}" fill="none" stroke-width="${width <= 26 ? 6 : 5}" stroke-linecap="round" aria-hidden="true">${paths.join('')}</svg>`);
}

// Marks that are pictures rather than strokes, with their natural size.
const PICTURES = {
  book: { src: '/img/b-ook-mark.png', w: 572, h: 356 },
  gleam: { src: '/img/gleam-mark.png', w: 640, h: 440 },
};

// Any app's mark at a given width: a TideMark product or one of the picture marks.
export function appMark(mark, width, { cls } = {}) {
  const p = PICTURES[mark];
  if (!p) return tideMark(mark, width, { cls });
  return html`<img class="${['mark', cls].filter(Boolean).join(' ')}" src="${p.src}" alt="" width="${width}" height="${Math.round((width * p.h) / p.w)}" decoding="async">`;
}

export const MARKS = { drum: 'Drum', organiser: 'This-Organiser', patrician: 'Unseen', luggage: 'Luggage', book: 'B-ook', gleam: 'Gleam', solwai: 'SolwAI' };

// Product wordmark: Quadrillion Light (This-Organiser, B-ook).
export const wordmark = (name) => html`${String(name)}`;

// The SolwAI logo lockup: mark plus SOLW<span>AI</span>. size scales it like the design system's Logo.
export function logo(size) {
  return html`<span class="logo" style="--logo:${size}" role="img" aria-label="SolwAI">${tideMark('solwai', Math.round(72 * size))}<span class="logo-word" aria-hidden="true">SOLW<span>AI</span></span></span>`;
}
