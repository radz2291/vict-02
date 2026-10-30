/** Read-only installed artifact/source comparison; records actual build files when present. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const args = Object.fromEntries(process.argv.slice(2).map(item => { const at = item.indexOf('='); return [item.slice(0, at), item.slice(at + 1)]; }));
const target = path.resolve(args['--directory']), evidence = path.resolve(args['--evidence']);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const install = JSON.parse(fs.readFileSync(path.join(target, 'installation.json'), 'utf8'));
const sha = args['--source'] ?? install.sourceCandidate;
const packageScopes = install.packages.map(item => `packages/${item.name.split('/')[1]}`);
execFileSync('git', ['diff', '--exit-code', sha, '--', ...packageScopes], { cwd: repo, windowsHide: true });
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const walk = directory => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const file = path.join(directory, item.name);
  if (item.isSymbolicLink()) throw Error(`Linked dependency is forbidden: ${file}`);
  return item.isDirectory() ? walk(file) : [file];
}) : [];
const dependencyFiles = walk(path.join(target, 'node_modules'));
const results = install.packages.map(pkg => {
  const installed = path.join(target, 'node_modules', ...pkg.name.split('/'));
  if (fs.realpathSync(installed) !== installed) throw Error(`Installed package path differs: ${pkg.name}`);
  const source = path.join(repo, 'packages', pkg.name.split('/')[1]);
  const files = ['src', 'dist'].flatMap(folder => walk(path.join(installed, folder))).map(destination => {
    const relative = path.relative(installed, destination), file = path.join(source, relative);
    const sourceSha256 = hash(file), installedSha256 = hash(destination);
    if (sourceSha256 !== installedSha256) throw Error(`Installed byte mismatch: ${pkg.name}/${relative}`);
    return { path: relative.replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sourceSha256 };
  });
  if (hash(pkg.tarball) !== pkg.sha256) throw Error(`Tarball changed: ${pkg.name}`);
  if (hash(path.join(source, 'package.json')) !== hash(path.join(installed, 'package.json'))) throw Error(`Manifest mismatch: ${pkg.name}`);
  return { name: pkg.name, installedPath: installed, tarballSha256: pkg.sha256, matchedFiles: files.length, files };
});
const fixtureFiles = ['index.html', 'main.ts', 'vite.config.ts', 'App.svelte', 'proof.ts', 'capture.html', 'capture-main.ts', 'CaptureProbe.svelte', 'capture-source.json'].map(name => ({ path: name, sha256: hash(path.join(target, name)) }));
const comparison = { checkedAt: new Date().toISOString(), sourceCandidate: sha, installationCandidate: install.sourceCandidate, fixtureFiles, aliases: [], dependencyLinks: 0, scannedDependencyFiles: dependencyFiles.length, frameworkPackages: results.length, matchedFiles: results.reduce((count, pkg) => count + pkg.matchedFiles, 0), packages: results };
fs.writeFileSync(path.join(evidence, 'installed-byte-comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
if (fs.existsSync(path.join(target, 'dist'))) {
  const files = walk(path.join(target, 'dist')).map(file => ({ path: path.relative(path.join(target, 'dist'), file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: hash(file) }));
  fs.writeFileSync(path.join(evidence, 'production-output-hashes.json'), JSON.stringify({ sourceCandidate: sha, checkedAt: new Date().toISOString(), files }, null, 2) + '\n');
}
process.stdout.write(JSON.stringify({ sourceCandidate: sha, frameworkPackages: results.length, matchedFiles: comparison.matchedFiles, dependencyLinks: 0, scannedDependencyFiles: dependencyFiles.length }) + '\n');
