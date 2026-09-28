import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const coverage = JSON.parse(read('packages/ui-svelte/catalog-coverage.json'));
const pkg = JSON.parse(read('packages/ui-svelte/package.json'));
const bits = JSON.parse(read('node_modules/bits-ui/package.json'));
assert.equal(bits.version, coverage.bitsVersion);
const installed = read('node_modules/bits-ui/dist/bits/index.js');
const tests = read('scripts/verify-ui-catalog.mjs');
const counts = { 'styled and usable': 0, 'supported direct composition': 0, deferred: 0 };
assert.equal(coverage.families.length, 41);
for (const family of coverage.families) {
  assert.ok(
    new RegExp(`export \\{[^}]*\\b${family.name}\\b[^}]*\\}`).test(installed),
    `Installed family missing: ${family.name}`,
  );
  counts[family.status]++;
  if (family.status === 'deferred') {
    assert.ok(family.reason.length > 80);
    continue;
  }
  const exported = pkg.exports[`./catalog/${family.slug}`];
  assert.ok(exported, family.slug);
  assert.ok(existsSync(join(root, 'packages/ui-svelte', exported.svelte)));
  assert.ok(
    read(family.example).includes(`family="${family.slug}"`),
    `Example missing: ${family.slug}`,
  );
  assert.ok(tests.includes(`'${family.slug}:`), `Interaction check missing: ${family.slug}`);
}
assert.deepEqual(counts, {
  'styled and usable': 30,
  'supported direct composition': 8,
  deferred: 3,
});
console.log(JSON.stringify({ bitsVersion: bits.version, counts, implemented: 38 }, null, 2));
