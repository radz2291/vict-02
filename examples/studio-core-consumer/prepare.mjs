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
if (fs.existsSync(target)) throw Error('Use a fresh disposable directory; existing consumers are preserved.');
const npm = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].find(item => item && fs.existsSync(item));
if (!npm) throw Error('Cannot locate the installed npm CLI.');
const run = (command, argv, cwd) => { const result = spawnSync(command, argv, { cwd, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, windowsHide: true }); if (result.status !== 0) throw Error(`${command} ${argv.join(' ')}\n${result.stdout}\n${result.stderr}`); return result.stdout; };
const packageDirs = ['contracts', 'ui', 'sdk', 'application', 'ui-svelte', 'ui-editor', 'ui-ai-svelte', 'ui-flow-svelte'];
run('git', ['rev-parse', '--verify', `${source}^{commit}`], repo);
run('git', ['diff', '--exit-code', source, '--', ...packageDirs.map(item => `packages/${item}`)], repo);
fs.mkdirSync(path.join(target, 'artifacts'), { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, 'package.json'), 'utf8'));
const packages = [];
for (const directory of packageDirs) {
  const packed = JSON.parse(run(process.execPath, [npm, 'pack', `./packages/${directory}`, '--json', '--pack-destination', path.join(target, 'artifacts')], repo))[0];
  const tarball = path.join(target, 'artifacts', packed.filename);
  manifest.dependencies[packed.name] = `file:artifacts/${packed.filename}`;
  packages.push({ name: packed.name, version: packed.version, tarball, integrity: packed.integrity, shasum: packed.shasum, sha256: createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'), files: packed.files.length, unpackedSize: packed.unpackedSize });
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
const report = { sourceCandidate: source, createdAt: new Date().toISOString(), directory: target, npmVersion: run(process.execPath, [npm, '--version'], target).trim(), nodeVersion: process.version, packages, packageCount: packages.length, lockSha256: createHash('sha256').update(lock).digest('hex'), lockPackageCount: lockPaths.length, installedPackageCount: lockPaths.filter(item => fs.existsSync(path.join(target, item, 'package.json'))).length, aliases: [], workspaceLinks: false, fixture: 'examples/studio-core-consumer', limitation: 'Builder installation evidence. Browser outcomes and independent gate verdict are recorded separately.' };
fs.writeFileSync(path.join(evidence, 'installation.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(target, 'installation.json'), JSON.stringify(report, null, 2) + '\n');
fs.mkdirSync(path.join(target, 'public'), { recursive: true });
fs.copyFileSync(path.join(target, 'installation.json'), path.join(target, 'public', 'installation.json'));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
