/** Explicit local tarball installation. Does not build/publish or modify another consumer. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const fixture = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(fixture, '../..');
const args = Object.fromEntries(process.argv.slice(2).map(item => { const at = item.indexOf('='); return [item.slice(0, at), item.slice(at + 1)]; }));
const source = args['--source'];
if (!source || !args['--directory'] || !args['--evidence']) throw Error('Required --source=<full SHA> --directory=<new absolute directory> --evidence=<absolute evidence directory>');
const target = path.resolve(args['--directory']);
const evidence = path.resolve(args['--evidence']);
const upgrade = args['--upgrade'] === 'true';
if (fs.existsSync(target) && !upgrade) throw Error('Use a fresh disposable directory; existing consumers are preserved. Explicit --upgrade=true is required to update an existing isolated install.');
const previous = upgrade ? JSON.parse(fs.readFileSync(path.join(target, 'installation.json'), 'utf8')) : undefined;
if (previous && (previous.workspaceLinks || previous.aliases.length || path.resolve(previous.directory) !== target)) throw Error('Upgrade requires the existing independent consumer installation report.');
const npm = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].find(item => item && fs.existsSync(item));
if (!npm) throw Error('Cannot locate the installed npm CLI.');
const run = (command, argv, cwd) => { const result = spawnSync(command, argv, { cwd, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, windowsHide: true }); if (result.status !== 0) throw Error(`${command} ${argv.join(' ')}\n${result.stdout}\n${result.stderr}`); return result.stdout; };
const packageDirs = ['contracts', 'ui', 'sdk', 'application', 'ui-svelte', 'ui-editor', 'ui-ai-svelte', 'ui-flow-svelte'];
run('git', ['rev-parse', '--verify', `${source}^{commit}`], repo);
run('git', ['diff', '--exit-code', source, '--', ...packageDirs.map(item => `packages/${item}`)], repo);
const artifactFolder = upgrade ? `artifacts-${source.slice(0, 8)}` : 'artifacts';
let preservedPrevious;
if (previous) {
  preservedPrevious = path.join(target, 'proof-history', `${previous.sourceCandidate.slice(0, 8)}-before-${source.slice(0, 8)}`);
  if (fs.existsSync(preservedPrevious)) throw Error('Previous proof snapshot already exists; do not overwrite it.');
  fs.mkdirSync(preservedPrevious, { recursive: true });
  for (const name of ['package.json', 'package-lock.json', 'installation.json', 'index.html', 'main.ts', 'vite.config.ts', 'App.svelte', 'proof.ts', 'capture.html', 'capture-main.ts', 'CaptureProbe.svelte', 'capture-source.json', 'dist']) {
    if (fs.existsSync(path.join(target, name))) fs.cpSync(path.join(target, name), path.join(preservedPrevious, name), { recursive: true });
  }
  for (const pkg of previous.packages) {
    const installed = path.join(target, 'node_modules', ...pkg.name.split('/'));
    if (fs.lstatSync(installed).isSymbolicLink()) throw Error(`Cannot preserve a linked framework package: ${pkg.name}`);
    fs.cpSync(installed, path.join(preservedPrevious, 'framework-packages', pkg.name.split('/')[1]), { recursive: true });
  }
}
fs.mkdirSync(path.join(target, artifactFolder), { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(upgrade ? target : fixture, 'package.json'), 'utf8'));
const packages = [];
for (const directory of packageDirs) {
  const packed = JSON.parse(run(process.execPath, [npm, 'pack', `./packages/${directory}`, '--json', '--pack-destination', path.join(target, artifactFolder)], repo))[0];
  const tarball = path.join(target, artifactFolder, packed.filename);
  const sha256 = createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
  const changed = !previous || previous.packages.find(item => item.name === packed.name)?.sha256 !== sha256;
  if (changed) manifest.dependencies[packed.name] = `file:${artifactFolder}/${packed.filename}`;
  packages.push({ name: packed.name, version: packed.version, tarball, integrity: packed.integrity, shasum: packed.shasum, sha256, files: packed.files.length, unpackedSize: packed.unpackedSize, updatedByThisInstall: changed, installedSpecification: manifest.dependencies[packed.name] });
}
run('git', ['diff', '--exit-code', source, '--', ...packageDirs.map(item => `packages/${item}`)], repo);
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
const installLog = run(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], target);
fs.writeFileSync(path.join(evidence, 'install.log'), installLog);
for (const name of ['index.html', 'main.ts', 'vite.config.ts', 'App.svelte', 'proof.ts', 'capture.html', 'capture-main.ts', 'CaptureProbe.svelte', 'capture-source.json']) fs.copyFileSync(path.join(fixture, name), path.join(target, name));
for (const pkg of packages) {
  const installed = path.join(target, 'node_modules', ...pkg.name.split('/'));
  if (fs.lstatSync(installed).isSymbolicLink()) throw Error(`Workspace/symlink is not permitted: ${pkg.name}`);
  pkg.installedPath = fs.realpathSync(installed);
  if (!pkg.installedPath.startsWith(path.join(target, 'node_modules') + path.sep)) throw Error(`Installed path escaped isolated consumer: ${pkg.name}`);
  const installedManifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  if (installedManifest.version !== pkg.version) throw Error(`Installed version differs: ${pkg.name}`);
}
const lock = fs.readFileSync(path.join(target, 'package-lock.json'));
fs.copyFileSync(path.join(target, 'package-lock.json'), path.join(evidence, 'consumer-package-lock.json'));
const lockPaths = Object.keys(JSON.parse(lock).packages).filter(Boolean);
const report = { sourceCandidate: source, installationKind: upgrade ? 'normal npm upgrade of changed tarballs in an existing independent install' : 'fresh independent npm install', previousCandidate: previous?.sourceCandidate, preservedPrevious, createdAt: new Date().toISOString(), directory: target, npmVersion: run(process.execPath, [npm, '--version'], target).trim(), nodeVersion: process.version, packages, packageCount: packages.length, lockSha256: createHash('sha256').update(lock).digest('hex'), lockPackageCount: lockPaths.length, installedPackageCount: lockPaths.filter(item => fs.existsSync(path.join(target, item, 'package.json'))).length, aliases: [], workspaceLinks: false, fixture: 'examples/studio-core-consumer', limitation: 'Builder installation evidence. Browser outcomes and independent gate verdict are recorded separately.' };
fs.writeFileSync(path.join(evidence, 'installation.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(target, 'installation.json'), JSON.stringify(report, null, 2) + '\n');
fs.mkdirSync(path.join(target, 'public'), { recursive: true });
fs.copyFileSync(path.join(target, 'installation.json'), path.join(target, 'public', 'installation.json'));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
