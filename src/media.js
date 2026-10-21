import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { now } from './db.js';
import { ValidationError } from './content/store.js';

// Each upload is saved as two WebP files: <name>-1600.webp for large screens and <name>-800.webp for cards
// and phones. The field stores the 1600 URL; srcFor() works out the smaller one.
const SIZES = [800, 1600];

export function srcset(url) {
  const m = /^\/media\/([\w-]+)-1600\.webp$/.exec(url ?? '');
  return m ? `/media/${m[1]}-800.webp 800w, ${url} 1600w` : null;
}

export function createMedia(db, mediaDir) {
  fs.mkdirSync(mediaDir, { recursive: true });

  async function save(buffer, originalName, userId) {
    let image;
    try {
      image = sharp(buffer, { failOn: 'error', limitInputPixels: 80e6 }).rotate();
      const meta = await image.metadata();
      if (!meta.width) throw new Error('no size');
    } catch {
      throw new ValidationError('That file is not an image we can use. Try a JPEG, PNG or WebP photo.');
    }
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
    let width = 0; let height = 0;
    for (const size of SIZES) {
      const info = await image.clone()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(mediaDir, `${name}-${size}.webp`));
      ({ width, height } = info);
    }
    const url = `/media/${name}-1600.webp`;
    const label = path.basename(String(originalName ?? 'photo')).slice(0, 200);
    db.prepare('INSERT INTO media (name, url, width, height, at, user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(label, url, width, height, now(), userId ?? null);
    return { url, width, height, name: label };
  }

  const list = (limit = 200) => db.prepare('SELECT id, name, url, width, height, at FROM media ORDER BY id DESC LIMIT ?').all(limit);

  return { save, list };
}
