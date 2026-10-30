/** Read-only artifact/hash and pure helper-graph challenge. No install or build. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const [reportPath, outputPath] = process.argv.slice(2);
const helperCommit = 'dd88007dff27cfef34eca34efbb31aa3698cd3b9';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reportBytes = readFileSync(reportPath),
  report = JSON.parse(reportBytes);
assert.equal(report.sourceCandidate, '72b7e09b1e6cbd5269578f3c3b1ccdf120a22c3b');
assert.ok(report.status.startsWith('PASS:'));
const result = {
  sourceCandidate: report.sourceCandidate,
  helperCommit,
  reportPath,
  reportSha256: hash(reportBytes),
  scope:
    'Read-only artifact recomputation and pure extracted helper logic; no consumer/install/build/browser/native/device/owner pass.',
  packs: [],
  fixtureFiles: 0,
  outputFiles: 0,
};
for (const pack of report.packs) {
  assert.equal(hash(readFileSync(pack.path)), pack.sha256, `tarball ${pack.name}`);
  const installed = report.installedByteComparison.find((value) => value.name === pack.name);
  let filesMatched = 0;
  for (const file of pack.files) {
    if (file.path === 'package.json') continue;
    assert.equal(
      hash(readFileSync(join(installed.installed, file.path))),
      file.sha256,
      `${pack.name}/${file.path}`,
    );
    filesMatched++;
  }
  assert.equal(filesMatched, installed.filesMatched);
  result.packs.push({
    name: pack.name,
    tarballSha256: pack.sha256,
    installedNonmanifestFilesMatched: filesMatched,
  });
}
for (const file of report.fixtureFiles) {
  assert.equal(hash(readFileSync(join(report.consumer, file.path))), file.sha256, file.path);
  result.fixtureFiles++;
}
for (const file of report.outputFiles) {
  assert.equal(
    hash(readFileSync(join(report.consumer, 'dist/assets', file.name))),
    file.sha256,
    file.name,
  );
  result.outputFiles++;
}
const helper = execFileSync(
  'git',
  ['show', `${helperCommit}:scripts/verify-architecture-realignment-consumer.mjs`],
  { encoding: 'utf8' },
);
const graphBlock = helper.slice(
  helper.indexOf('  const dependencyKinds ='),
  helper.indexOf('  // Compiled JS packages'),
);
assert.ok(graphBlock.includes('Cyclic internal build dependency graph'));
const graphLogic = new Function(
  'root',
  'names',
  'readFileSync',
  'join',
  'report',
  `${graphBlock};return {dependencyGraph,buildOrder};`,
);
const dependencyLine = helper
  .split('\n')
  .find((line) => line.trim().startsWith('const dependencyRebuilds ='));
const dependenciesFresh = new Function(
  'dependencyGraph',
  'name',
  'report',
  `${dependencyLine};return dependencyRebuilds;`,
);
const names = [
  'contracts',
  'ui',
  'sdk',
  'application',
  'ui-svelte',
  'ui-media-svelte',
  'ui-flow-svelte',
];
const graphReport = {};
const { dependencyGraph, buildOrder } = graphLogic(
  process.cwd(),
  names,
  readFileSync,
  join,
  graphReport,
);
const propagate = (graph, order, seed) => {
  const proof = { packageBuilds: [] };
  for (const name of order) {
    const fresh =
      seed.has(`@victframework/${name}`) || dependenciesFresh(graph, name, proof).length > 0;
    proof.packageBuilds.push({
      name: `@victframework/${name}`,
      mode: fresh ? 'fresh-build-check' : 'reused-earlier-successful-build',
    });
  }
  return proof.packageBuilds
    .filter((value) => value.mode === 'fresh-build-check')
    .map((value) => value.name);
};
const actualFresh = propagate(dependencyGraph, buildOrder, new Set(['@victframework/ui-svelte']));
assert.deepEqual(
  new Set(actualFresh),
  new Set([
    '@victframework/ui-svelte',
    '@victframework/ui-media-svelte',
    '@victframework/ui-flow-svelte',
  ]),
);
// Test the exact extracted graph block against synthetic in-memory manifests.
const manifests = {
  a: { name: '@victframework/a' },
  b: { name: '@victframework/b', peerDependencies: { '@victframework/a': '1' } },
  c: { name: '@victframework/c', optionalDependencies: { '@victframework/b': '1' } },
};
const syntheticRead = (path) => {
  const pieces = path.replaceAll('\\', '/').split('/');
  return JSON.stringify(manifests[pieces.at(-2)]);
};
const synthetic = graphLogic('/probe', ['c', 'b', 'a'], syntheticRead, join, {});
assert.deepEqual(synthetic.buildOrder, ['a', 'b', 'c']);
assert.deepEqual(
  propagate(synthetic.dependencyGraph, synthetic.buildOrder, new Set(['@victframework/a'])),
  ['@victframework/a', '@victframework/b', '@victframework/c'],
);
manifests.a.dependencies = { '@victframework/c': '1' };
assert.throws(
  () => graphLogic('/probe', ['c', 'b', 'a'], syntheticRead, join, {}),
  /Cyclic internal build dependency graph/,
);
delete manifests.a.dependencies;
const staleRead = (path) =>
  path.replaceAll('\\', '/').includes('/node_modules/') &&
  path.replaceAll('\\', '/').includes('/b/')
    ? JSON.stringify({ name: '@victframework/b', peerDependencies: { '@victframework/a': '2' } })
    : syntheticRead(path);
assert.throws(
  () => graphLogic('/probe', ['c', 'b', 'a'], staleRead, join, {}),
  /Installed dependency graph differs/,
);
result.helper = {
  sourceSha256: hash(helper),
  internalDependencyGraph: graphReport.internalDependencyGraph,
  buildOrder,
  freshFromRenderer: actualFresh,
  syntheticChecks: [
    'peer+optional transitive propagation',
    'dependency-first order',
    'cycle refusal',
    'stale installed manifest refusal',
  ],
};
result.totalInstalledNonmanifestFilesMatched = result.packs.reduce(
  (count, pack) => count + pack.installedNonmanifestFilesMatched,
  0,
);
result.status =
  'PASS: seven tarball hashes, installed nonmanifest bytes, fixture/output hashes and extracted helper graph challenges';
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(
  JSON.stringify({
    status: result.status,
    tarballs: result.packs.length,
    installedFiles: result.totalInstalledNonmanifestFilesMatched,
    fixtureFiles: result.fixtureFiles,
    outputFiles: result.outputFiles,
    helperChecks: result.helper.syntheticChecks.length,
  }) + '\n',
);
