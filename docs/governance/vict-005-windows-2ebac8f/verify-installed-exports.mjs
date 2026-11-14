import assert from 'node:assert/strict';
import { readFile, realpath, lstat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const expected = new Map([
  ['contracts', ['validateAgentStreamEvent']],
  ['ui', []],
  ['sdk', []],
  ['kernel', []],
  ['runtime', ['AgentProfileRegistry', 'AgentStreamHub', 'validateAgentExchangeReceipt']],
  ['control', ['AgentTurnService']],
  ['store-sqlite', ['createSqliteAgentControlStores', 'createSqliteAgentExchangeStore']],
  ['mastra', [
    'AGENT_EXCHANGE_ASK_CAPABILITY', 'composeMastraTurnExecutor',
    'createDedicatedMastraStore', 'createDeterministicOfflineModel',
    'createMastraAgentExchange', 'MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY',
    'MastraThreadCoordinator',
  ]],
]);
const installed = await realpath(join(root, 'node_modules', '@victframework'));

for (const [name, publicNames] of expected) {
  const specifier = '@victframework/' + name;
  const directory = join(installed, name);
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const entry = await realpath(fileURLToPath(import.meta.resolve(specifier)));
  assert.ok(entry.startsWith(directory + sep), specifier);
  assert.equal((await lstat(directory)).isSymbolicLink(), false);
  assert.equal(manifest.name, specifier);
  assert.equal(manifest.version, '0.4.0-rc.1');
  for (const [subpath, definition] of Object.entries(manifest.exports)) {
    assert.ok(subpath === '.' || subpath.startsWith('./'));
    const publicPath = subpath === '.' ? specifier : specifier + subpath.slice(1);
    const resolved = await realpath(fileURLToPath(import.meta.resolve(publicPath)));
    assert.equal(resolved, await realpath(join(directory, definition.default)));
    assert.ok(resolved.startsWith(directory + sep), publicPath);
    const types = await realpath(join(directory, definition.types));
    assert.ok(types.startsWith(directory + sep), publicPath);
    const namespace = await import(publicPath);
    if (subpath === '.') {
      for (const exported of publicNames) assert.ok(Object.hasOwn(namespace, exported), exported);
    }
  }
  console.log(JSON.stringify({
    publicPackage: specifier,
    version: manifest.version,
    loadedEntry: relative(root, entry),
    exports: manifest.exports,
    verifiedNames: publicNames,
  }));
}
const core = JSON.parse(await readFile(join(root, 'node_modules', '@mastra', 'core', 'package.json')));
assert.equal(core.version, '1.64.0');
console.log(JSON.stringify({ mastraCore: core.version, packageCount: expected.size, result: 'PASS' }));

