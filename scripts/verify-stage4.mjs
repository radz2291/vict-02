#!/usr/bin/env node
/**
 * Stage 04 aggregate verification: capability and application authoring.
 *
 * This is an aggregation for convenience — it does NOT replace or skip the
 * individual evidence commands in the verification ladder:
 *   npm ci, format:check, lint, typecheck, build, test:unit,
 *   test:integration, npm test, verify:consumer, verify:stage2,
 *   verify:stage3, verify:stage4, example, bench, example:application
 *
 * Stage 04 additions proven here (not hidden by aggregation):
 *   - the full unit suite includes the Stage 04 authoring/pack/application
 *     suites and the Stage 03 LOW-finding closures;
 *   - the SvelteKit application proof builds and runs its DOM-level tests;
 *   - isolated PACKED-TARBALL consumers prove:
 *       1. author-only @vict/sdk usage WITHOUT @vict/runtime, svelte, zod;
 *       2. neutral Application Definition usage WITHOUT svelte or zod;
 *       3. the optional Zod adapter subpath with zod installed;
 *       4. emitted declarations are complete (strict tsc, skipLibCheck
 *          false) and contain no runtime/svelte/zod references.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    shell: process.platform === 'win32',
  });
  if (options.capture && result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
  }
  return result;
}

function step(label, command, args) {
  console.log(`\n=== verify:stage4 — ${label} ===`);
  const result = run(command, args);
  if (result.status !== 0) {
    console.error(`[FAIL] ${label} exited ${result.status}`);
    failures += 1;
  }
  return result;
}

function check(condition, label) {
  if (condition) {
    console.log(`  ok: ${label}`);
  } else {
    console.error(`  FAIL: ${label}`);
    failures += 1;
  }
}

/** Recursively collect *.d.ts files under a directory. */
function declarationFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...declarationFiles(full));
    else if (entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function assertDeclarationsClean(packageDir, forbidden, label) {
  const files = declarationFiles(join(packageDir, 'dist'));
  check(files.length > 0, `${label}: emitted declarations exist`);
  for (const file of files) {
    // Prose mentions in doc comments are not dependencies: strip comments
    // before scanning so only real type references fail the gate.
    const raw = readFileSync(file, 'utf8');
    const content = raw
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n')
      .map((line) => line.replace(/^\s*\/\/.*$/, ''))
      .join('\n');
    for (const needle of forbidden) {
      if (content.includes(needle)) {
        check(false, `${label}: ${file} contains forbidden reference '${needle}'`);
        return;
      }
    }
  }
  check(true, `${label}: declarations contain none of [${forbidden.join(', ')}]`);
}

// ---------------------------------------------------------------------------
// 1. Workspace build + suites + proof.
// ---------------------------------------------------------------------------
step('workspace build', 'npm', ['run', 'build']);
step('unit tests', 'npx', ['vitest', 'run', '--project', 'unit']);
step('integration tests', 'npx', ['vitest', 'run', '--project', 'integration']);
step('sveltekit application proof (build + DOM tests)', 'npm', ['run', 'example:application']);

// ---------------------------------------------------------------------------
// 2. Isolated packed-tarball consumers.
// ---------------------------------------------------------------------------
const work = await mkdtemp(join(tmpdir(), 'vict-stage4-'));
console.log(`\n=== verify:stage4 — isolated packed consumers in ${work} ===`);

for (const pkg of ['contracts', 'sdk', 'application']) {
  // The './' prefix is REQUIRED: bare 'packages/sdk' is ambiguous to npm
  // (interpreted as a git remote spec on some platforms).
  const result = run('npm', ['pack', '--pack-destination', work, `./packages/${pkg}`], {
    capture: true,
  });
  if (result.status !== 0) {
    check(false, `npm pack @vict/${pkg}`);
  }
}
const tarballs = readdirSync(work).filter((file) => file.endsWith('.tgz'));
check(tarballs.length === 3, `packed 3 tarballs (found ${tarballs.length})`);
const tarballPaths = tarballs.map((file) => join(work, file));

const sdkTarball = tarballPaths.find((file) => file.includes('vict-sdk'));
const appTarball = tarballPaths.find((file) => file.includes('vict-application'));
const contractsTarball = tarballPaths.find((file) => file.includes('vict-contracts'));
check(
  sdkTarball !== undefined && appTarball !== undefined && contractsTarball !== undefined,
  'tarball identities',
);

// --- Package metadata: the dependency direction is enforced structurally. ---
function packageJsonFromTarball(tarball) {
  // Run tar from the tarball's own directory with a RELATIVE filename:
  // GNU tar treats 'C:\...' absolute paths as remote-host specs.
  const dir = join(tarball, '..');
  const name = tarball.split(/[\\/]/).pop();
  const result = run('tar', ['-xzf', name, '-O', 'package/package.json'], {
    capture: true,
    cwd: dir,
  });
  if (result.status !== 0) {
    check(false, `tarball metadata readable: ${tarball}`);
    return {};
  }
  return JSON.parse(result.stdout);
}
const sdkPkgJson = packageJsonFromTarball(sdkTarball);
check(
  JSON.stringify(sdkPkgJson.dependencies ?? {}).indexOf('@vict/runtime') === -1 &&
    JSON.stringify(sdkPkgJson.dependencies ?? {}).indexOf('@vict/kernel') === -1,
  '@vict/sdk depends on @vict/contracts only (no runtime, no kernel)',
);
const appPkgJson = packageJsonFromTarball(appTarball);
check(
  JSON.stringify(appPkgJson.dependencies ?? {}).indexOf('@vict/runtime') === -1 &&
    Object.keys(appPkgJson.dependencies ?? {})
      .sort()
      .join(',') === '@vict/contracts,@vict/sdk',
  '@vict/application depends on @vict/contracts + @vict/sdk only',
);

// --- Consumer A: author-only SDK (NO runtime, NO svelte, NO zod). -----------
const authorDir = join(work, 'consumer-author');
mkdirSync(join(authorDir, 'src'), { recursive: true });
writeFileSync(
  join(authorDir, 'package.json'),
  JSON.stringify({ name: 'vict-consumer-author', private: true, type: 'module' }, null, 2),
);
run('npm', ['install', contractsTarball, sdkTarball], { cwd: authorDir });
writeFileSync(
  join(authorDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: false,
        rootDir: 'src',
        outDir: 'dist',
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
);
writeFileSync(
  join(authorDir, 'src', 'index.ts'),
  `import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  VICT_AUTHORING_COMPAT_VERSION,
  defineApplication,
  defineApplicationRelease,
  defineCapability,
  defineCapabilityPack,
  defineContract,
  defineGraph,
  defineResource,
  validateCapabilityPack,
} from '@vict/sdk';

// An author defines contracts, capabilities, graphs, packs, applications,
// resources and releases WITHOUT importing the runtime.
const Text = defineContract<{ title: string }>({
  id: 'author.text',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { title: string } }),
});

const capability = defineCapability({
  id: 'author.echo',
  revision: '1',
  effect: 'pure',
  input: Text,
  output: Text,
  invoke: (input) => input,
});

const graph = defineGraph({
  id: 'author.graph',
  entry: 'only',
  nodes: [{ id: 'only', capability: 'author.echo' }],
  edges: [],
});

const resource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'author.items',
  revision: '1',
  identity: { key: 'id' },
  fields: [{ name: 'id', type: 'string', required: true }],
});

const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA,
  id: 'author.app',
  revision: '1',
  routes: [{ id: 'home', path: '/', screenId: 's' }],
  screens: [
    { id: 's', title: 'Home', layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't', content: 'hi' }] }] },
  ],
  actions: [],
  resources: [{ resourceId: 'author.items', revision: '1' }],
});

const pack = defineCapabilityPack(
  {
    schema: 'vict.capability-pack@1',
    id: 'author.pack',
    version: '1.0.0',
    victCompatibility: '^' + VICT_AUTHORING_COMPAT_VERSION,
    capabilities: [{ id: 'author.echo', revision: '1', effect: 'pure' }],
  },
  { capabilities: [{ id: 'author.echo', revision: '1', invoke: capability.invoke }] },
);

const packResult = validateCapabilityPack(pack);
if (!packResult.ok) throw new Error('author pack should validate');

// Release authoring uses the canonical applicationVersion shape (opaque here;
// compilation/identity is the application package's responsibility).
void defineApplicationRelease;
void graph;
void application;
void resource;
console.log('AUTHOR_ONLY_CONSUMER_OK');
`,
);
{
  const tsc = run(
    'node',
    [join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', '.'],
    { cwd: authorDir, capture: true },
  );
  check(tsc.status === 0, 'author-only consumer typechecks strict (skipLibCheck false)');
  const node = run('node', ['dist/index.js'], { cwd: authorDir, capture: true });
  check(
    node.status === 0 && node.stdout.includes('AUTHOR_ONLY_CONSUMER_OK'),
    'author-only consumer runs',
  );
  // The consumer's node_modules has NO runtime/kernel/svelte/zod.
  const modules = existsSync(join(authorDir, 'node_modules', '@vict'))
    ? readdirSync(join(authorDir, 'node_modules', '@vict'))
    : [];
  check(
    !modules.includes('runtime') && !modules.includes('kernel'),
    'author consumer installed WITHOUT @vict/runtime or @vict/kernel',
  );
}
assertDeclarationsClean(
  join(repoRoot, 'packages', 'sdk'),
  ['@vict/runtime', '@vict/kernel', 'svelte', "from 'zod'", 'from "zod"'],
  'sdk declarations',
);

// --- Consumer B: neutral Application Definition (NO svelte, NO zod). --------
const appDir = join(work, 'consumer-app');
mkdirSync(join(appDir, 'src'), { recursive: true });
writeFileSync(
  join(appDir, 'package.json'),
  JSON.stringify({ name: 'vict-consumer-app', private: true, type: 'module' }, null, 2),
);
run('npm', ['install', ...tarballPaths], { cwd: appDir });
writeFileSync(
  join(appDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: false,
        rootDir: 'src',
        outDir: 'dist',
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
);
writeFileSync(
  join(appDir, 'src', 'index.ts'),
  `import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@vict/sdk';
import {
  compileApplication,
  compileApplicationRelease,
  computeApplicationVersion,
  createComponentRegistry,
  createInMemoryApplicationData,
} from '@vict/application';

const resource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'tasks',
  revision: '1',
  identity: { key: 'id' },
  fields: [{ name: 'id', type: 'string', required: true }],
});

const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA,
  id: 'consumer.app',
  revision: '1',
  routes: [{ id: 'home', path: '/', screenId: 's' }],
  screens: [
    {
      id: 's',
      title: 'Tasks',
      layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't', content: 'hello' }] }],
    },
  ],
  actions: [],
  resources: [{ resourceId: 'tasks', revision: '1' }],
});

const result = compileApplication({ application, resources: [resource] });
if (!result.ok) throw new Error('consumer application should compile');
const version = result.plan.applicationVersion;

// Identity: insertion-order independent, revision-sensitive.
const reordered = { ...application, screens: [...application.screens] };
if (computeApplicationVersion({ application: reordered, resources: [resource] }) !== version) {
  throw new Error('identity must be insertion-order independent');
}

// The data adapter reference implementation works without any runtime.
const data = createInMemoryApplicationData([resource]);
const rows = await data.query({ op: 'list', resourceId: 'tasks' }, { permissions: [], effect: 'read' });
if (!rows.ok || rows.total !== 0) throw new Error('reference adapter list failed');

// The component registry resolves by exact id/revision.
const registry = createComponentRegistry('registry.consumer', '1');
registry.register({ componentId: 'x', revision: '1', implementation: {} });
if (!registry.resolve({ componentId: 'x', revision: '1' }).ok) throw new Error('registry resolution failed');

// Release identity is distinct from the application identity.
const release = compileApplicationRelease(
  {
    schema: 'vict.application-release@1',
    applicationId: 'consumer.app',
    applicationRevision: '1',
    applicationVersion: version,
    renderer: { id: 'r', revision: '1' },
    dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    victCompatibility: '^0.1.0',
    activation: { kind: 'policy', selection: 'latest' },
  },
  result.plan,
);
if (!release.ok) throw new Error('release should compile');
if (release.release.releaseVersion === version) throw new Error('release identity must differ');

console.log('NEUTRAL_APPLICATION_CONSUMER_OK', version.slice(0, 10));
`,
);
{
  const tsc = run(
    'node',
    [join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', '.'],
    { cwd: appDir, capture: true },
  );
  check(tsc.status === 0, 'application consumer typechecks strict (skipLibCheck false)');
  const node = run('node', ['dist/index.js'], { cwd: appDir, capture: true });
  check(
    node.status === 0 && node.stdout.includes('NEUTRAL_APPLICATION_CONSUMER_OK'),
    'application consumer runs',
  );
}
assertDeclarationsClean(
  join(repoRoot, 'packages', 'application'),
  ['@vict/runtime', 'svelte', 'zod'],
  'application declarations',
);

// --- Consumer C: the optional Zod adapter subpath (zod installed). ----------
const zodDir = join(work, 'consumer-zod');
mkdirSync(join(zodDir, 'src'), { recursive: true });
run('npm', ['install', contractsTarball, sdkTarball, 'zod@3'], { cwd: zodDir });
writeFileSync(
  join(zodDir, 'src', 'index.ts'),
  `import { defineZodContract } from '@vict/sdk/zod';
import { z } from 'zod';

const User = defineZodContract('zc.user', '1', z.object({ name: z.string() }));
const parsed = User.parse({ name: 'ada' });
if (!parsed.ok) throw new Error('zod adapter parse failed');
const rejected = User.parse({ name: 42 });
if (rejected.ok) throw new Error('zod adapter should have rejected');
if (!Object.isFrozen(User)) throw new Error('zod adapter contract must be frozen');
console.log('ZOD_CONSUMER_OK');
`,
);
writeFileSync(
  join(zodDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: false,
        rootDir: 'src',
        outDir: 'dist',
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
);
{
  const tsc = run(
    'node',
    [join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', '.'],
    { cwd: zodDir, capture: true },
  );
  check(tsc.status === 0, 'zod consumer typechecks strict');
  const node = run('node', ['dist/index.js'], { cwd: zodDir, capture: true });
  check(node.status === 0 && node.stdout.includes('ZOD_CONSUMER_OK'), 'zod consumer runs');
}

rmSync(work, { recursive: true, force: true });

console.log('');
if (failures > 0) {
  console.error(`verify:stage4 FAILED with ${failures} failure(s)`);
  process.exit(1);
}
console.log('verify:stage4 PASSED');
