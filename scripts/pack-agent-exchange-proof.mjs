/**
 * Local verification of an isolated consumer of the candidate tarballs.
 * Seed non-VICT dependencies from this checkout's pinned npm ci. Every VICT
 * module is then installed from its new archive, never a workspace link.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const npm =
  process.platform === 'win32'
    ? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : realpath(execFileSync('which', ['npm'], { encoding: 'utf8' }).trim());
const npmPath = await npm;
const invoke = (args, cwd) =>
  execFileSync(process.execPath, [npmPath, ...args], { cwd, encoding: 'utf8' });
const destination = resolve(
  process.argv[2] ?? (await mkdtemp(join(tmpdir(), 'vict-exchange-pack-'))),
);
const archives = join(destination, 'archives');
const consumer = join(destination, 'consumer');
const packages = [
  'contracts',
  'ui',
  'sdk',
  'kernel',
  'runtime',
  'control',
  'store-sqlite',
  'mastra',
];
await mkdir(archives, { recursive: true });
await mkdir(consumer);
const manifest = {
  node: process.version,
  candidate: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  files: [],
};
const artifacts = new Map();
for (const name of packages) {
  const [pack] = JSON.parse(
    invoke(['pack', '--json', '--pack-destination', archives, './packages/' + name], root),
  );
  const artifact = join(archives, pack.filename);
  artifacts.set(name, artifact);
  manifest.files.push({
    name: pack.filename,
    sha512: createHash('sha512')
      .update(await readFile(artifact))
      .digest('hex'),
  });
}
await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
const dependencies = join(consumer, 'node_modules');
await mkdir(dependencies);
for (const entry of await readdir(join(root, 'node_modules'))) {
  if (entry.startsWith('.') || entry === '@victframework') continue;
  const source = join(root, 'node_modules', entry);
  if ((await lstat(source)).isSymbolicLink()) continue;
  await cp(source, join(dependencies, entry), { recursive: true, verbatimSymlinks: true });
}
// Extract the npm archives directly. No registry resolution or workspace links
// participate in this isolated consumer. Windows includes tar.exe.
await mkdir(join(dependencies, '@victframework'));
for (const [name, archive] of artifacts) {
  const packagePath = join(dependencies, '@victframework', name);
  await mkdir(packagePath);
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', packagePath]);
}
const packageRoot = await realpath(consumer);
for (const name of packages) {
  const installed = join(dependencies, '@victframework', name);
  assert.equal((await lstat(installed)).isSymbolicLink(), false);
  assert.ok((await realpath(installed)).startsWith(packageRoot + sep));
}
const core = JSON.parse(
  await readFile(join(dependencies, '@mastra', 'core', 'package.json'), 'utf8'),
);
assert.equal(core.version, '1.64.0');
await cp(join(root, 'scripts', 'verify-agent-exchange.mjs'), join(consumer, 'verify.mjs'));
await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
execFileSync(process.execPath, ['verify.mjs'], { cwd: consumer, stdio: 'inherit' });
console.log(
  JSON.stringify({ ...manifest, packageConsumer: 'isolated installed tarballs', destination }),
);
