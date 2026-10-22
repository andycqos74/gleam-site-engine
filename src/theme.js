// Loads the theme a site runs with. A theme is a folder in themes/ with a theme.js manifest (default export) and a
// public/ folder of assets; see README "Writing a theme". THEME picks the folder (default "qos"). Themes import
// engine helpers relatively (../../src/theme-api.js), so a custom theme is mounted at /app/themes/<name>.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function themeDir({ theme, themeDir } = {}) {
  if (themeDir) return path.resolve(themeDir);
  const name = theme || 'qos';
  if (!/^[\w-]+$/.test(name)) throw new Error(`THEME "${name}" is not a valid theme name.`);
  return path.join(ROOT, 'themes', name);
}

export async function loadTheme(options = {}) {
  const dir = themeDir(options);
  const file = path.join(dir, 'theme.js');
  if (!fs.existsSync(file)) throw new Error(`No theme found at ${file}. Set THEME to a folder in themes/ or THEME_DIR to a theme folder.`);
  const { default: manifest } = await import(pathToFileURL(file).href);
  return prepareTheme(manifest, dir);
}

// Checks a manifest and fills in the optional parts, so the rest of the engine can rely on them.
export function prepareTheme(manifest, dir) {
  const t = { ...manifest };
  const problems = [];
  if (!t.name) problems.push('name');
  if (!t.fields || typeof t.fields !== 'object') problems.push('fields');
  if (!t.collections || typeof t.collections !== 'object') problems.push('collections');
  if (!t.pages || typeof t.pages !== 'object' || !Object.keys(t.pages).length) problems.push('pages');
  if (typeof t.layout !== 'function') problems.push('layout');
  if (problems.length) throw new Error(`Theme in ${dir} is missing: ${problems.join(', ')}`);

  t.dir = dir;
  t.publicDir = path.join(dir, 'public');
  t.lang ??= 'en-GB';
  t.timeZone ??= 'Europe/London';
  t.seed ??= {};
  t.contentUpdates ??= [];
  t.stylesheets ??= [];
  t.scripts ??= [];
  t.colours ??= {};
  t.csp ??= {};

  for (const [route, page] of Object.entries(t.pages)) {
    if (!route.startsWith('/') || typeof page.render !== 'function' || !page.key) throw new Error(`Theme page "${route}" needs a path starting with /, a key and a render function.`);
  }
  for (const [name, c] of Object.entries(t.collections)) {
    if (!/^[a-z][\w]*$/i.test(name) || !c.label || !c.fields) throw new Error(`Theme collection "${name}" needs a label and fields.`);
    // Every item can be hidden from visitors without deleting it.
    c.fields.hidden ??= { type: 'bool', label: 'Hide from visitors', default: false };
    if (c.itemPage && (!c.itemPage.base?.startsWith('/') || typeof c.itemPage.render !== 'function')) {
      throw new Error(`Theme collection "${name}" has an itemPage without a base path or render function.`);
    }
  }
  for (const [key, f] of Object.entries(t.fields)) {
    if (!f || !f.type || !('value' in f)) throw new Error(`Theme field "${key}" needs a type and a value.`);
  }
  if (t.contact) {
    t.contact.topics ??= [];
    if (!t.pages[t.contact.path]) throw new Error(`Theme contact.path "${t.contact.path}" is not one of its pages.`);
  }
  return t;
}
