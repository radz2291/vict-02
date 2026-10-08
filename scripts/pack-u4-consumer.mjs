#!/usr/bin/env node
/**
 * U4-B1 packed-artifact isolation (handoff §6 / U4-01):
 *
 * 1. Pack the declared dependency closure (`npm pack`) into vendor tarballs.
 * 2. Copy the consumer example to an ISOLATED location OUTSIDE the
 *    repository's workspace-link graph.
 * 3. Rewrite its dependencies to `file:vendor/<tarball>` and install there.
 * 4. Verify: no workspace links (every @victframework module resolves
 *    INSIDE the isolated directory), no repository source paths in the
 *    built bundles, tests pass from packed artifacts only.
 * 5. Emit a machine-readable manifest (tarball hashes + sizes).
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(
  new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
);
const consumerSource = path.join(repoRoot, 'examples', 'u4-consumer');
const isolatedRoot =
  process.env.U4_ISOLATED_ROOT ?? path.resolve(repoRoot, '..', 'u4-consumer-isolated');
const PACKAGES = ['ui', 'ui-svelte', 'application', 'contracts', 'kernel', 'runtime', 'control'];

function sh(command, options = {}) {
  return execSync(command, {
    stdio: ['pipe', 'pipe', 'inherit'],
    encoding: 'utf8',
    shell: true,
    ...options,
  });
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

console.log('== 1. pack the closure ==');
const vendorDir = path.join(isolatedRoot, 'vendor');
fs.rmSync(isolatedRoot, { recursive: true, force: true });
fs.mkdirSync(vendorDir, { recursive: true });
const manifest = { packedAt: new Date().toISOString(), tarballs: {} };
for (const name of PACKAGES) {
  const packageDir = path.join(repoRoot, 'packages', name);
  const stdout = sh('npm pack --json', { cwd: packageDir });
  const packed = JSON.parse(stdout)[0];
  const tarball = path.resolve(
    packed.filename.startsWith('/') || /^[A-Za-z]:/.test(packed.filename)
      ? packed.filename
      : path.join(packageDir, packed.filename),
  );
  const target = path.join(vendorDir, path.basename(tarball));
  fs.copyFileSync(tarball, target);
  manifest.tarballs[`@victframework/${name}`] = {
    tarball: path.basename(target),
    sha256: sha256(target),
    bytes: fs.statSync(target).size,
    integrity: packed.integrity,
  };
  console.log(`  packed @victframework/${name} -> ${path.basename(target)}`);
}

console.log('== 2. isolate the consumer ==');
const isolatedConsumer = path.join(isolatedRoot, 'u4-consumer');
fs.cpSync(consumerSource, isolatedConsumer, {
  recursive: true,
  filter: (source) =>
    !source.includes(`${path.sep}node_modules`) && !source.includes(`${path.sep}dist`),
});

console.log('== 3. rewrite deps to vendor tarballs + install ==');
const packageJsonPath = path.join(isolatedConsumer, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
for (const name of PACKAGES) {
  const entry = manifest.tarballs[`@victframework/${name}`];
  packageJson.dependencies[`@victframework/${name}`] = `file:vendor/${entry.tarball}`;
}
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
sh('npm install --no-audit --no-fund --ignore-scripts=false', {
  cwd: isolatedConsumer,
  stdio: 'inherit',
});

console.log('== 4. verify isolation ==');
const violations = [];
for (const name of PACKAGES) {
  const link = path.join(isolatedConsumer, 'node_modules', '@victframework', name);
  if (!fs.existsSync(link)) violations.push(`missing: @victframework/${name}`);
  else {
    const real = fs.realpathSync(link);
    if (!real.startsWith(isolatedRoot)) {
      violations.push(`workspace link: @victframework/${name} -> ${real}`);
    }
  }
}
const builtAssets = path.join(isolatedConsumer, 'dist', 'assets');
const builtFiles = fs.existsSync(builtAssets) ? fs.readdirSync(builtAssets) : [];
for (const file of builtFiles) {
  const content = fs.readFileSync(path.join(builtAssets, file), 'utf8');
  if (content.includes('vict-02-u4-b1') || content.includes('vict-02-u4-handoff')) {
    violations.push(`repo source path leaked into ${file}`);
  }
}
// The dist must contain BOTH entries.
if (!fs.existsSync(path.join(isolatedConsumer, 'dist', 'app.html')))
  violations.push('missing dist/app.html');
if (!fs.existsSync(path.join(isolatedConsumer, 'dist', 'index.html')))
  violations.push('missing dist/index.html');

console.log('== 5. tests from packed artifacts ==');
sh('npx vitest run', { cwd: isolatedConsumer, stdio: 'inherit' });

manifest.isolation = {
  root: isolatedRoot,
  workspaceLinkViolations: violations,
  builtAssets: builtFiles,
  verifiedAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(isolatedConsumer, 'pack-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(repoRoot, 'examples', 'u4-consumer', 'pack-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);

if (violations.length > 0) {
  console.error('ISOLATION VIOLATIONS:');
  for (const violation of violations) console.error(' -', violation);
  process.exit(1);
}
console.log('\nISOLATED PACKED-ARTIFACT VERIFICATION: OK');
console.log(`  isolated root: ${isolatedRoot}`);
console.log(`  tarballs: ${Object.keys(manifest.tarballs).length}`);
console.log(`  built assets: ${builtFiles.length}`);
