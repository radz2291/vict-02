import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { launchPreview, root } from './lib/ui-browser.mjs';

// Count unique JS/CSS responses actually fetched by a cold production navigation.
// Gzip is computed deterministically from response bytes, not dev-server sizes.
const label = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(label)) throw Error('Expected before or after.');
const app = await launchPreview();
const routes = {};
try {
  for (const route of ['/requests', '/workspace']) {
    const page = await app.browser.newPage();
    await page.setCacheEnabled(false);
    const files = new Map();
    const pending = [];
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (!/\.(js|css)$/.test(path)) return;
      pending.push(
        response.buffer().then((buffer) =>
          files.set(path, {
            path,
            kind: path.endsWith('.js') ? 'js' : 'css',
            bytes: buffer.length,
            gzip: gzipSync(buffer).length,
          }),
        ),
      );
    });
    const response = await page.goto(app.base + route, { waitUntil: 'networkidle0' });
    if (response.status() !== 200) throw Error('Preview failed: ' + route);
    await Promise.all(pending);
    const assets = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
    const totals = Object.fromEntries(
      ['js', 'css'].map((kind) => [
        kind,
        assets
          .filter((f) => f.kind === kind)
          .reduce((sum, f) => ({ bytes: sum.bytes + f.bytes, gzip: sum.gzip + f.gzip }), {
            bytes: 0,
            gzip: 0,
          }),
      ]),
    );
    routes[route] = { totals, assets };
    await page.close();
  }
  const dir = join(root, 'qa-artifacts/foundation-catalog');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'bundle-' + label + '.json'),
    JSON.stringify(
      { label, mode: 'cold production navigation; summed per-asset gzip', routes },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify(
      Object.fromEntries(Object.entries(routes).map(([key, value]) => [key, value.totals])),
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
