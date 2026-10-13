import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

mkdirSync(resolve(dist, 'icons'), { recursive: true });
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
for (const name of ['icon16.png', 'icon48.png', 'icon128.png']) {
  copyFileSync(resolve(root, 'icons', name), resolve(dist, 'icons', name));
}
