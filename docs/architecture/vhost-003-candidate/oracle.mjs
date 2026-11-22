import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const frameworkCommit = '1b11d4a5f4298310c7ab16e0808b8bfbed551ee5';
const c12Source = 'a22615b014aa69f7501dc1504da5f9daad639786';
const consumerCommit = '8f8ec2d24180e4a9520be0689aa6afb711553fc9';
const lake = {
  'store-postgres': ['victframework-store-postgres-0.4.0-rc.1.tgz', '74f4681ee0d86d487f7fd304ae88cf181aa6e6dff92a0f3bb01ad6dbe84129cb'],
  hosted: ['victframework-hosted-0.4.0-rc.1.tgz', '4aa6581aa7d26f067ddb3ec28dc8f7fd67bb34467e08132132972ed25c880de4'],
  runtime: ['runtime-0.4.0-rc.1-memory-e94ee682d7f5.tgz', 'e94ee682d7f57efbbc9722818f2ab6059ad6a9bb3f9c8229e73c24197b0abb3f'],
  mastra: ['mastra-0.4.0-rc.1-memory-2d136123705f.tgz', '2d136123705f92e88a15e7e2b80e1732218ca00018c9cc55165a69a7774a84d3']
};

export const digest = (value) => createHash('sha256').update(value).digest('hex');

export async function loadOracle(consumer, source, scratch, candidateRepo) {
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { windowsHide: true });
  const sourceFile = (path) => git(source, 'show', frameworkCommit + ':' + path);
  const lock = git(consumer, 'show', consumerCommit + ':package-lock.json');
  const lockSHA256 = digest(lock);
  assert.equal(git(consumer, 'rev-parse', 'HEAD').toString().trim(), consumerCommit);
  assert.equal(lockSHA256, '8b821ffabf5d8f184f69862deb9cab7495a63a37a51641e6e074ba342de3d4dc');
  const manifestSHA256 = digest(git(source, 'show', '0761e1865258b23e2f04652f4301736155be06c5:docs/hosted-vercel/evidence/packed-f4/manifest.json'));
  assert.equal(manifestSHA256, '33b544b6be657144560fb6a471d5ad756c72406163524af711027a0ce1b8d99f');
  const installedRoot = await realpath(join(consumer, 'node_modules'));
  const require = createRequire(join(consumer, 'package.json'));
  const records = {};
  const auditedFiles = [
    'packages/store-postgres/src/adapter.ts', 'packages/store-postgres/src/driver.ts',
    'packages/store-postgres/src/coordination.ts', 'packages/runtime/src/control-in-memory.ts',
    'packages/runtime/src/control-types.ts', 'packages/runtime/src/store-snapshot.ts',
    'packages/server/src/commands.ts',
    'packages/mastra/src/postgres-storage.ts'
  ];
  for (const path of auditedFiles) {
    const bytes = sourceFile(path);
    const c12Bytes = git(source, 'show', c12Source + ':' + path);
    if (!path.includes('/mastra/')) assert(bytes.equals(c12Bytes), path);
    else records[c12Source + ':' + path] = digest(c12Bytes);
    records[path] = digest(bytes);
  }
  const tree = 'packages/store-sqlite';
  const sqliteTree = git(source, 'rev-parse', frameworkCommit + ':' + tree).toString().trim();
  assert.equal(sqliteTree, '3cd52c2bc0187ce1c03e1f22e26190845bf6b189');
  assert.equal(sqliteTree, git(source, 'rev-parse', '6b420a3e9eada6f694cc2550debda7753316b5b3:' + tree).toString().trim());
  const archives = {};
  for (const [name, [filename, expected]] of Object.entries(lake)) {
    const bytes = await readFile(join(consumer, 'packs', filename));
    const sha256 = digest(bytes);
    assert.equal(sha256, expected, name);
    const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    assert.equal(JSON.parse(lock).packages['node_modules/@victframework/' + name].integrity, integrity);
    archives[name] = { filename, sha256, integrity };
  }

  // SQLite is a separate independent reference. Execute the pinned Git sources
  // with the consumer-pinned TypeScript and Runtime, using Node's SQLite.
  const ts = require('typescript');
  const sqliteFixture = join(scratch, 'sqlite-oracle');
  await mkdir(sqliteFixture);
  await writeFile(join(sqliteFixture, 'package.json'), '{"type":"module"}');
  await symlink(installedRoot, join(sqliteFixture, 'node_modules'), 'junction');
  for (const file of ['agent-control-adapter', 'driver', 'migrations']) {
    const path = tree + '/src/' + file + '.ts';
    const bytes = sourceFile(path);
    records[path] = digest(bytes);
    const { outputText, diagnostics } = ts.transpileModule(bytes.toString(), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      reportDiagnostics: true,
      fileName: file + '.ts'
    });
    assert.equal(diagnostics.length, 0, path);
    await writeFile(join(sqliteFixture, file + '.js'), outputText);
  }

  async function installed(name, child) {
    const entry = await realpath(require.resolve(name));
    const path = await realpath(child ? join(dirname(entry), child) : entry);
    assert(!relative(installedRoot, path).startsWith('..'), basename(path));
    return import(pathToFileURL(path));
  }

  // The consumer has no server package. Compile the exact shared dispatcher
  // separately against the same pinned Runtime to exercise service policy.
  const dispatcherPath = 'packages/server/src/commands.ts';
  const commandSource = sourceFile(dispatcherPath);
  const dispatcherCommit = '8f23c02c4b8a91e3315f4b73bf64a4ca6a89fc2c';
  const reviewedParent = 'f0f2133c6b57d2b610ace0864a812eb31200ac1c';
  assert.equal(git(candidateRepo, 'merge-base', 'HEAD', dispatcherCommit).toString().trim(), dispatcherCommit);
  assert.equal(git(candidateRepo, 'rev-parse', dispatcherCommit + '^').toString().trim(), reviewedParent);
  assert(git(candidateRepo, 'show', reviewedParent + ':' + dispatcherPath).equals(commandSource));
  const dispatcherBytes = git(candidateRepo, 'show', dispatcherCommit + ':' + dispatcherPath);
  assert(git(candidateRepo, 'show', 'HEAD:' + dispatcherPath).equals(dispatcherBytes));
  assert.equal(git(candidateRepo, 'rev-parse', dispatcherCommit + ':' + dispatcherPath).toString().trim(),
    '03fd3207ca761fc43b051bbcfccecbcfaf3cf792');

  async function dispatcher(bytes, filename) {
    const build = ts.transpileModule(bytes.toString(), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      reportDiagnostics: true,
      fileName: 'commands.ts'
    });
    assert.equal(build.diagnostics.length, 0);
    const fixture = join(sqliteFixture, filename);
    await writeFile(fixture, build.outputText);
    return (await import(pathToFileURL(fixture))).VictCommandService;
  }
  const VictCommandService = await dispatcher(commandSource, 'commands-reference.js');
  const RepairedCommandService = await dispatcher(dispatcherBytes, 'commands-candidate.js');
  const authPath = 'packages/server/src/auth.ts';
  const authSource = sourceFile(authPath);
  assert(git(candidateRepo, 'show', dispatcherCommit + ':' + authPath).equals(authSource));
  const typecheckPath = join(sqliteFixture, 'commands.ts');
  await writeFile(typecheckPath, dispatcherBytes);
  await writeFile(join(sqliteFixture, 'auth.ts'), authSource);
  const { compilerOptions } = JSON.parse(git(candidateRepo, 'show', dispatcherCommit + ':tsconfig.base.json'));
  const { options: strictOptions, errors } = ts.convertCompilerOptionsFromJson(compilerOptions, sqliteFixture);
  assert.equal(errors.length, 0);
  const program = ts.createProgram([typecheckPath], { ...strictOptions, noEmit: true,
    typeRoots: [join(installedRoot, '@types')] });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0,
    diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));

  const runtime = await installed('@victframework/runtime');
  const snapshot = await installed('@victframework/runtime', 'store-snapshot.js');
  const { createPostgresMastraStore } = await installed('@victframework/mastra', 'postgres-storage.js');
  const { PostgresDatabase: Driver } = await installed('@victframework/store-postgres', 'driver.js');
  const { PostgresCoordinationStore: Coordination } = await installed('@victframework/store-postgres', 'coordination.js');
  const { createPostgresStores } = await installed('@victframework/store-postgres');
  const { default: { Client } } = await installed('pg');
  const { createSqliteAgentControlStores } = await import(pathToFileURL(join(sqliteFixture, 'agent-control-adapter.js')));

  return {
    runtime, snapshot, VictCommandService, RepairedCommandService, Driver, Coordination, Client, createPostgresStores, createSqliteAgentControlStores, createPostgresMastraStore,
    provenance: {
      frameworkCommit, c12Source, consumerCommit, lockSHA256, manifestSHA256, sqliteTree,
      dispatcherCommit, reviewedParent, dispatcherSHA256: digest(dispatcherBytes), dispatcherTypecheckDiagnostics: 0,
      typescriptVersion: ts.version, pgDriver: require('pg/package.json').version, archives, sourceSHA256: records
    }
  };
}
