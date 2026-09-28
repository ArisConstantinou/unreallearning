import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
let html = await readFile(join(root, 'src', 'shell.html'), 'utf8');

for (const [token, file] of [
  ['STYLE', 'style.css'],
  ['CORE', 'core.js'],
  ['CONTENT', 'content.js'],
  ['SCENE', 'scene.js'],
  ['APP', 'app.js'],
]) {
  const marker = `/*${token}*/`;
  if (html.split(marker).length !== 2) {
    throw new Error(`Expected one ${marker} marker in KINÉ shell`);
  }
  html = html.replace(marker, await readFile(join(root, 'src', file), 'utf8'));
}

await writeFile(join(root, 'index.html'), html, 'utf8');
console.log(`Built kine/index.html (${Buffer.byteLength(html)} bytes)`);
