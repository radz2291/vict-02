import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const client = path.resolve('apps/studio/.svelte-kit/output/client');
const manifest = JSON.parse(fs.readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
const generated = fs.readFileSync(
  'apps/studio/.svelte-kit/generated/client-optimized/app.js',
  'utf8',
);
function routeNode(route) {
  const match = generated.match(new RegExp(`"${route}":\\s*\\[(\\d+)\\]`));
  assert.ok(match, `Missing route ${route}`);
  return `.svelte-kit/generated/client-optimized/nodes/${match[1]}.js`;
}
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
const node = (id) => `.svelte-kit/generated/client-optimized/nodes/${id}.js`;
const boot = [
  '../../node_modules/@sveltejs/kit/src/runtime/client/entry.js',
  '.svelte-kit/generated/client-optimized/app.js',
];
const replay = [
  ...new Set([
    ...closure(routeNode('/run-screen')),
    ...closure(node(0)),
    ...closure(node(1)),
    ...boot.flatMap(closure),
  ]),
];
const designer = closure(routeNode('/design'));
const read = (files) =>
  files.map((file) => fs.readFileSync(path.join(client, file), 'utf8')).join('\n');
const replayText = read(replay);
const designText = read(designer);
const authoringMarkers = [
  'Floating selection tools',
  'uv-inspector',
  'studio.screen-preview',
  'Apply canonical source',
  'Message Studio agent',
];
for (const marker of authoringMarkers) {
  assert.ok(designText.includes(marker), `Designer positive control missing: ${marker}`);
  assert.ok(!replayText.includes(marker), `Saved replay imports authoring: ${marker}`);
}
function filesUnder(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
}
const allClientFiles = filesUnder(client);
const allClient = allClientFiles
  .map((file) => fs.readFileSync(file))
  .reduce((all, bytes) => Buffer.concat([all, bytes]), Buffer.alloc(0));
const serverMarkers = [
  'MastraProductAgent',
  'createDedicatedMastraStore',
  'ZAI_API_KEY',
  'OPENAI_API_KEY',
  'quietWriteApprovals',
];
for (const marker of serverMarkers)
  assert.ok(
    !allClient.includes(Buffer.from(marker)),
    `Client includes server composition: ${marker}`,
  );
let credentialChecked = false;
if (process.env.STUDIO_AGENT_AUTH_FILE) {
  const auth = JSON.parse(fs.readFileSync(process.env.STUDIO_AGENT_AUTH_FILE, 'utf8'));
  const key = auth.zai?.key;
  assert.equal(typeof key, 'string');
  assert.ok(key.length > 8);
  assert.ok(!allClient.includes(Buffer.from(key)), 'Provider credential found in client artifacts');
  const diff = execFileSync('git', ['diff', 'd7401bef6e48330796c74ec00c86db9622d48cdf', 'HEAD'], {
    encoding: 'utf8',
    maxBuffer: 20_000_000,
  });
  assert.ok(!diff.includes(key), 'Provider credential found in committed diff');
  credentialChecked = true;
}
console.log(
  JSON.stringify(
    {
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      replayFiles: replay.length,
      designerFiles: designer.length,
      allClientFiles: allClientFiles.length,
      authoringMarkers,
      serverMarkers,
      credentialChecked,
      verdict: 'PASS',
      limit:
        'Static dependency/byte scan; lazy router references remain. This is not a browser network trace.',
    },
    null,
    2,
  ),
);
