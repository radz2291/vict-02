import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const client = path.join(root, 'apps/studio/.svelte-kit/output/client');
const manifest = JSON.parse(fs.readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
const generated = fs.readFileSync(
  'apps/studio/.svelte-kit/generated/client-optimized/app.js',
  'utf8',
);
assert.match(generated, /"\/run-screen": \[7\]/);
const node = (id) => `.svelte-kit/generated/client-optimized/nodes/${id}.js`;
function closure(entry) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    assert.ok(manifest[key], key);
    seen.add(key);
    for (const dependency of manifest[key].imports ?? []) visit(dependency);
  }
  visit(entry);
  return [...seen].map((key) => manifest[key].file);
}
const replay = closure(node(7));
// Vite also flags every lazy route node isEntry. Only these two entries boot
// every page; counting all isEntry nodes would eagerly include every route.
const bootKeys = [
  '../../node_modules/@sveltejs/kit/src/runtime/client/entry.js',
  '.svelte-kit/generated/client-optimized/app.js',
];
const loadedStaticClosure = [
  ...new Set([...replay, ...closure(node(0)), ...closure(node(1)), ...bootKeys.flatMap(closure)]),
];
const designer = closure(node(4));
const read = (files) =>
  files.map((file) => fs.readFileSync(path.join(client, file), 'utf8')).join('\n');
const runText = read(loadedStaticClosure);
const designText = read(designer);
const markers = [
  'Floating selection tools',
  'uv-inspector',
  'studio.screen-preview',
  'Apply canonical source',
];
for (const marker of markers) {
  assert.ok(designText.includes(marker), `Positive control missing: ${marker}`);
  assert.ok(!runText.includes(marker), `Replay includes editor/preview marker: ${marker}`);
}
assert.ok(!replay.includes(manifest[node(4)].file));
assert.ok(!loadedStaticClosure.includes(manifest[node(4)].file));
const result = {
  candidate: '9010c5aff2afb1fb792bf1a1cb15ddf9a92cae55',
  replay,
  loadedStaticClosure,
  designerEntry: manifest[node(4)].file,
  markers,
  verdict: 'PASS',
  limit:
    'Static closure includes replay, root layout/error and all boot entries. Router dynamic authoring references remain lazy; no browser network trace was captured.',
};
console.log(JSON.stringify(result, null, 2));

