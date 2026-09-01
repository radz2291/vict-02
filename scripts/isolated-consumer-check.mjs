#!/usr/bin/env node
/**
 * Isolated consumer / package check for Vict Stage 02.
 *
 * Proves, against PACKED TARBALLS (not workspace sources, no hoisting):
 *   1. A neutral consumer can install @vict/{contracts,kernel,runtime,store-sqlite,sdk}
 *      WITHOUT zod, author contracts through the neutral API, persist an
 *      activation and run in a real SQLite database file, close, reopen,
 *      restore the activation, and read the identical run — all type-checked
 *      under strict TypeScript (skipLibCheck: false) against emitted
 *      declarations.
 *   2. A consumer that installs zod can use the optional @vict/sdk/zod
 *      adapter subpath (and its contract is frozen).
 *   3. Base emitted declarations contain no Zod type/module references.
 *
 * Usage: node scripts/isolated-consumer-check.mjs   (run `npm run build` first)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const packages = ['contracts', 'kernel', 'runtime', 'store-sqlite', 'sdk'];
let failures = 0;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`\n[FAIL] ${command} ${args.join(' ')} exited ${result.status}`);
    if (options.capture) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
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

const work = await mkdtemp(join(tmpdir(), 'vict-consumer-'));
console.log(`Isolated consumer check in ${work}\n`);

// 1. Pack every package into the temp dir.
for (const name of packages) {
  const result = run('npm', ['pack', join('packages', name), '--pack-destination', work], {
    capture: true,
  });
  if (result.status !== 0) {
    throw new Error(`npm pack failed for ${name}`);
  }
}
const tarballs = readdirSync(work).filter((file) => file.endsWith('.tgz'));
check(
  tarballs.length === packages.length,
  `packed ${tarballs.length} tarballs (five public packages)`,
);

// 2. Neutral consumer: installs the five tarballs and NOTHING else.
const neutralDir = join(work, 'consumer-neutral');
mkdirSync(join(neutralDir, 'src'), { recursive: true });
writeFileSync(
  join(neutralDir, 'package.json'),
  JSON.stringify({ name: 'vict-consumer-neutral', private: true, type: 'module' }, null, 2),
);
// @types/node is consumer-side dev tooling for the Node runtime platform
// (process, node:sqlite declaration checking) — not a Vict dependency.
run('npm', ['install', '--save-dev', '@types/node@22'], { cwd: neutralDir });
run('npm', ['install', ...tarballs.map((file) => join(work, file))], { cwd: neutralDir });
check(
  !existsSync(join(neutralDir, 'node_modules', 'zod')),
  'neutral consumer has NO zod installed',
);

writeFileSync(
  join(neutralDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: false,
        noEmit: true,
        types: ['node'],
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
);
writeFileSync(
  join(neutralDir, 'src', 'index.ts'),
  `import { createRuntime, defineCapability, defineContract, defineGraph } from '@vict/sdk';
import { createSqliteStores } from '@vict/store-sqlite';
import type { Contract } from '@vict/sdk';

// Neutral contract authoring: no schema library involved anywhere.
const Message: Contract<{ text: string }> = defineContract<{ text: string }>({
  id: 'consumer.message',
  revision: '2',
  expected: 'a message with non-empty text',
  parse: (input) => {
    const text = (input as { text?: unknown } | null)?.text;
    if (typeof text === 'string' && text.length > 0) {
      return { ok: true, value: { text } };
    }
    return {
      ok: false,
      issues: [
        {
          code: 'invalid_type',
          path: 'text',
          message: "Expected a non-empty string at 'text'.",
          expected: 'string',
          received: 'missing',
        },
      ],
    };
  },
});

const echo = defineCapability({
  id: 'c.echo',
  revision: '1',
  effect: 'pure',
  input: Message,
  output: Message,
  invoke: (input) => ({ text: input.text.toUpperCase() }),
});

// Durable SQLite stores from the packed adapter (built-in node:sqlite).
const dbPath = process.argv[2] ?? 'consumer.db';
const reopen = process.argv[3] === 'reopen';

if (reopen) {
  // Reopen phase: restore the exact activation and read the run back.
  const stores = createSqliteStores({ path: dbPath });
  const runtime = createRuntime({ stores });
  runtime.registerCapability(echo);
  const restored = await runtime.restoreActivation(
    defineGraph({
      id: 'consumer-graph',
      entry: 'e',
      nodes: [{ id: 'e', capability: 'c.echo' }],
      edges: [],
    }),
  );
  if (!restored.ok) {
    throw new Error('reopen: restoration failed: ' + restored.code);
  }
  const record = await runtime.getRun(process.argv[4] ?? '');
  if (!record || record.status !== 'completed') {
    throw new Error('reopen: run record missing or not completed');
  }
  if (!record.trace || record.trace.length === 0) {
    throw new Error('reopen: trace missing');
  }
  await stores.dispose();
  console.log(
    'NEUTRAL_CONSUMER_REOPEN_OK',
    restored.activationVersion.slice(0, 14),
    String(record.trace.length),
  );
} else {
  const stores = createSqliteStores({ path: dbPath });
  const runtime = createRuntime({ stores });
  runtime.registerCapability(echo);
  const activation = await runtime.activate(
    defineGraph({
      id: 'consumer-graph',
      entry: 'e',
      nodes: [{ id: 'e', capability: 'c.echo' }],
      edges: [],
    }),
  );
  if (!activation.ok) {
    throw new Error('activation failed');
  }
  const result = await runtime.run<{ text: string }>({ text: 'isolated consumer' });
  if (result.status !== 'completed' || result.output?.text !== 'ISOLATED CONSUMER') {
    throw new Error('unexpected run outcome: ' + result.status);
  }
  await stores.dispose();
  console.log(
    'NEUTRAL_CONSUMER_OK',
    activation.graphVersion.slice(0, 14),
    activation.activationVersion.slice(0, 14),
    result.runId,
  );
}
`,
);

console.log('\n[neutral consumer] strict type-check against packed declarations');
run('npx', ['tsc', '-p', join(neutralDir, 'tsconfig.json')]);
console.log('[neutral consumer] execute packed artifacts (SQLite publish/activate/run/close)');
const neutralRun = run('npx', ['tsx', join(neutralDir, 'src', 'index.ts'), dbPathFor(neutralDir)], {
  capture: true,
  cwd: neutralDir,
});
check(
  neutralRun.status === 0 && neutralRun.stdout?.includes('NEUTRAL_CONSUMER_OK'),
  'neutral consumer ran end to end with SQLite stores',
);
const runId = (neutralRun.stdout ?? '').trim().split(/\r?\n/).at(-1)?.split(' ').at(-1) ?? '';
check(runId.startsWith('run_'), 'run id captured from neutral consumer output');

function dbPathFor(dir) {
  return join(dir, 'consumer.db');
}

console.log('[neutral consumer] REOPEN the same SQLite database in a fresh process');
const reopenRun = run(
  'npx',
  ['tsx', join(neutralDir, 'src', 'index.ts'), dbPathFor(neutralDir), 'reopen', runId],
  {
    capture: true,
    cwd: neutralDir,
  },
);
check(
  reopenRun.status === 0 && reopenRun.stdout?.includes('NEUTRAL_CONSUMER_REOPEN_OK'),
  'activation restored and run/events read back after real close/reopen',
);

// 3. Zod consumer: same tarballs plus zod, using the optional adapter subpath.
const zodDir = join(work, 'consumer-zod');
mkdirSync(join(zodDir, 'src'), { recursive: true });
writeFileSync(
  join(zodDir, 'package.json'),
  JSON.stringify({ name: 'vict-consumer-zod', private: true, type: 'module' }, null, 2),
);
run('npm', ['install', ...tarballs.map((file) => join(work, file)), 'zod@3'], { cwd: zodDir });
writeFileSync(
  join(zodDir, 'src', 'index.mts'),
  `import { defineZodContract } from '@vict/sdk/zod';
import { z } from 'zod';

const User = defineZodContract('zc.user', '1', z.object({ name: z.string() }));
const parsed = User.parse({ name: 'ada' });
if (!parsed.ok) {
  throw new Error('zod adapter parse failed');
}
const rejected = User.parse({ name: 42 });
if (rejected.ok) {
  throw new Error('zod adapter should have rejected');
}
const issue = rejected.issues[0];
if (!issue || issue.path !== 'name' || !issue.message.includes('name')) {
  throw new Error('zod issues were not mapped to neutral safe issues');
}
if (!Object.isFrozen(User)) {
  throw new Error('the zod adapter contract must be frozen');
}
console.log('ZOD_CONSUMER_OK', issue.message);
`,
);
console.log('\n[zod consumer] execute optional adapter subpath');
const zodRun = run('npx', ['tsx', join(zodDir, 'src', 'index.mts')], {
  capture: true,
  cwd: zodDir,
});
check(
  zodRun.status === 0 && zodRun.stdout?.includes('ZOD_CONSUMER_OK'),
  'zod adapter subpath works when zod is installed',
);

// 4. Base emitted declarations must not reference zod types or modules.
console.log('\n[declarations] scanning base dist for zod type/module references');
let zodTypeReferences = 0;
const scan = (base) => {
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const full = join(base, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'zod') continue; // optional adapter subpath may mention zod
      scan(full);
      continue;
    }
    if (!/\.(d\.ts|js)$/.test(entry.name)) continue;
    const content = readFileSync(full, 'utf8');
    if (/ZodType|ZodError|from\s+['"]zod|import\s*\(\s*['"]zod|require\(\s*['"]zod/.test(content)) {
      console.error(`  FAIL: ${full} references zod types/modules`);
      zodTypeReferences += 1;
    }
  }
};
scan(join(repoRoot, 'packages', 'contracts', 'dist'));
scan(join(repoRoot, 'packages', 'kernel', 'dist'));
scan(join(repoRoot, 'packages', 'runtime', 'dist'));
scan(join(repoRoot, 'packages', 'store-sqlite', 'dist'));
scan(join(repoRoot, 'packages', 'sdk', 'dist'));
check(zodTypeReferences === 0, 'no zod type/module references in base emitted artifacts');

console.log('');
if (failures > 0) {
  console.error(
    `ISOLATED CONSUMER CHECK FAILED with ${failures} failure(s). Artifacts kept at ${work}`,
  );
  process.exit(1);
}
console.log(`ISOLATED CONSUMER CHECK PASSED. Cleaning ${work}`);
rmSync(work, { recursive: true, force: true });
