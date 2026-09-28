import assert from 'node:assert/strict';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  configFile: false,
  logLevel: 'warn',
  plugins: [svelte({ configFile: false })],
  build: {
    write: false,
    minify: 'esbuild',
    target: 'es2022',
    lib: {
      entry: join(root, 'packages/ui-svelte/test/bundle-fixture.svelte'),
      formats: ['es'],
      fileName: 'minimal-control',
    },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((result) => result.output);
const chunks = outputs.filter((output) => output.type === 'chunk');
const modules = chunks.flatMap((chunk) =>
  Object.entries(chunk.modules)
    .filter(([, info]) => info.renderedLength > 0)
    .map(([name]) => name.replaceAll('\\', '/')),
);
const primitives = modules
  .filter((name) => name.includes('/bits-ui/dist/bits/'))
  .map((name) => name.split('/bits-ui/dist/')[1])
  .sort();
assert.ok(primitives.some((name) => name.includes('/checkbox/')));
for (const unused of [
  'calendar',
  'range-calendar',
  'command',
  'menu',
  'select',
  'date-picker',
  'dialog',
])
  assert.ok(
    !primitives.some((name) => name.includes('/' + unused + '/')),
    `Unused ${unused} was bundled`,
  );
const report = {
  entry:
    'Checkbox + ControlScope; production ESM including Svelte runtime; optional CSS measured separately',
  bytes: chunks.reduce((n, chunk) => n + Buffer.byteLength(chunk.code), 0),
  gzip: chunks.reduce((n, chunk) => n + gzipSync(chunk.code).length, 0),
  renderedBitsModules: primitives,
  unusedFamiliesExcluded: true,
};
mkdirSync(join(root, 'qa-artifacts/foundation-catalog'), { recursive: true });
writeFileSync(
  join(root, 'qa-artifacts/foundation-catalog/minimal-import.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
