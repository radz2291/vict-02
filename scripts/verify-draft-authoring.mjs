import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run npm run verify:draft-authoring from the VICT checkout.');

function run(command, args, cwd, stdio = 'inherit') {
  return execFileSync(command, args, { cwd, stdio, encoding: 'utf8' });
}

const temp = mkdtempSync(join(tmpdir(), 'vict-draft-authoring-'));
const consumer = join(temp, 'consumer');
const tarballs = join(temp, 'tarballs');
mkdirSync(consumer);
mkdirSync(tarballs);
console.log(`Isolated consumer and tarballs in ${temp}`);

const build = ['contracts', 'ui', 'sdk', 'kernel', 'runtime', 'control', 'mastra', 'application'];
for (const name of build) {
  run(process.execPath, [npm, 'run', 'build', '-w', `@victframework/${name}`], root);
}
// These packages expose source entry points. Only Flow's nonvisual model is loaded.
const pack = [...build, 'ui-svelte', 'ui-media-svelte', 'ui-flow-svelte'];
const artifacts = new Map();
for (const name of pack) {
  const result = run(
    process.execPath,
    [npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', tarballs],
    join(root, 'packages', name),
    'pipe',
  );
  const [info] = JSON.parse(result);
  artifacts.set(info.name, info);
}

const localLock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const pinnedVersion = (name) => localLock.packages[`node_modules/${name}`].version;
const dependencies = Object.fromEntries(
  [...artifacts].map(([name, { filename }]) => [name, `file:../tarballs/${filename}`]),
);
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({
    name: 'vict-draft-authoring-proof',
    private: true,
    type: 'module',
    dependencies: { ...dependencies, svelte: pinnedVersion('svelte') },
    devDependencies: {
      esbuild: pinnedVersion('esbuild'),
      tsx: pinnedVersion('tsx'),
      typescript: pinnedVersion('typescript'),
    },
  }),
);
run(
  process.execPath,
  [npm, 'install', '--prefer-offline', '--no-audit', '--no-fund', '--ignore-scripts'],
  consumer,
);

const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8'));
for (const [name, info] of artifacts) {
  const installedPath = `node_modules/${name}`;
  const entry = lock.packages[installedPath];
  assert.equal(entry.version, info.version, name);
  assert.equal(entry.integrity, info.integrity, name);
  assert.equal(entry.resolved, dependencies[name], name);
  assert.equal(
    relative(realpathSync(consumer), realpathSync(resolve(consumer, installedPath))),
    join('node_modules', name),
    name,
  );
}
const control = artifacts.get('@victframework/control');
for (const extension of ['js', 'd.ts']) {
  assert.ok(control.files.some(({ path }) => path === `dist/draft-authoring.${extension}`));
}

writeFileSync(
  join(consumer, 'public-types.mts'),
  `import { commitDraftEdit, createDraftAuthoring, type DraftAuthoringHost,
    type DraftAuthoringJournal, type DraftEditReceipt } from '@victframework/control/draft-authoring';
declare const journal: DraftAuthoringJournal;
const host: DraftAuthoringHost = {
  resolveDraft: journal.resolveDraft,
  readReceipt: journal.readReceipt,
  commit(proposal, signal) { commitDraftEdit(proposal, signal, journal); }
};
const authoring = createDraftAuthoring(host);
declare const receipt: DraftEditReceipt;
const observed: DraftEditReceipt | undefined = await authoring.observe(receipt);
void observed;
`,
);
run(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--strict',
    '--noEmit',
    'public-types.mts',
  ],
  consumer,
);
writeFileSync(
  join(consumer, 'browser-entry.mjs'),
  "export { commitDraftEdit, createDraftAuthoring } from '@victframework/control/draft-authoring';\n",
);
run(
  process.execPath,
  [
    npm,
    'exec',
    '--offline',
    '--',
    'esbuild',
    'browser-entry.mjs',
    '--bundle',
    '--platform=browser',
    '--format=esm',
    '--outfile=browser-draft-authoring.mjs',
  ],
  consumer,
);
copyFileSync(
  join(root, 'scripts/fixtures/draft-authoring.test.mjs'),
  join(consumer, 'draft-authoring.test.mjs'),
);
run(process.execPath, ['--import', 'tsx', '--test', 'draft-authoring.test.mjs'], consumer);

console.log(
  JSON.stringify(
    {
      commit: run('git', ['rev-parse', 'HEAD'], root, 'pipe').trim(),
      workingTree: run('git', ['status', '--porcelain'], root, 'pipe').trim() || 'clean',
      node: process.version,
      artifacts: [...artifacts.values()].map(({ name, filename, integrity }) => ({
        name,
        filename,
        integrity,
      })),
    },
    null,
    2,
  ),
);
