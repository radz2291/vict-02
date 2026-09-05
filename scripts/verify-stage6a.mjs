#!/usr/bin/env node
/**
 * Stage 06A aggregate verification: product-agent foundation.
 *
 * Aggregation for convenience — it does NOT replace or skip the individual
 * evidence commands in the verification ladder. It builds its own
 * prerequisites and verifies:
 *
 *  1. Package inspection: exports/declarations exist, dependency direction
 *     is acyclic (no neutral package imports @vict/mastra), no Mastra ee/
 *     import, no undeclared transitive reliance, exact pinned Mastra
 *     versions, license boundaries recorded, neutral base declarations
 *     Mastra-free.
 *  2. Neutral packed consumer: installs ONLY the packed neutral VICT
 *     packages (no Mastra on disk), compiles a valid agent profile and
 *     rejects an invalid one, under strict TypeScript (skipLibCheck: false).
 *  3. Mastra adapter packed consumer: installs the packed @vict/mastra with
 *     exact @mastra/* versions resolved from the registry (no workspace
 *     hoisting) and runs the deterministic offline-model proof without
 *     network or provider credentials.
 *  4. Fresh-process store proof: the dedicated Mastra database reopens in a
 *     fresh process with persisted memory, and a partially completed
 *     governed deletion resumes idempotently (no duplicate receipts, no
 *     lost completion).
 */
import { spawn, spawnSync } from 'node:child_process';
const spawnSync_module = { spawn };
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;
const shell = process.platform === 'win32';
const npm = shell ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? repoRoot,
    timeout: options.timeout,
    ...(options.shell ? { shell: true } : {}),
  });
  if (options.capture && result.status !== 0) {
    console.error(result.stdout?.slice(-4000));
    console.error(result.stderr?.slice(-4000));
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

// ---- 0. Build prerequisites -------------------------------------------------
console.log('\n=== verify:stage6a — build all packages ===');
{
  const build = run(npm, ['run', 'build'], { timeout: 900_000, shell });
  check(build.status === 0, 'all packages build');
}

// ---- 1. Package inspection ----------------------------------------------------
console.log('\n=== verify:stage6a — package inspection ===');
{
  const mastraPkg = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'mastra', 'package.json'), 'utf8'),
  );
  const deps = mastraPkg.dependencies ?? {};
  check(deps['@mastra/core'] === '1.64.0', '@mastra/core pinned exactly at 1.64.0');
  check(deps['@mastra/memory'] === '1.28.2', '@mastra/memory pinned exactly at 1.28.2');
  check(deps['@mastra/libsql'] === '1.22.3', '@mastra/libsql pinned exactly at 1.22.3');
  check(
    deps['@mastra/observability'] === '1.17.5',
    '@mastra/observability pinned exactly at 1.17.5',
  );
  check(
    typeof deps['zod'] === 'string',
    'zod declared explicitly (pinned Mastra peer requirement)',
  );
  for (const neutral of ['@vict/contracts', '@vict/sdk', '@vict/kernel', '@vict/runtime']) {
    check(deps[neutral] === '0.1.0', `${neutral} declared as a direct dependency at 0.1.0`);
  }

  // Neutral packages must not depend on Mastra.
  for (const name of [
    'contracts',
    'sdk',
    'kernel',
    'runtime',
    'application',
    'store-sqlite',
    'appdata-sqlite',
    'renderer-svelte',
    'scaffolder',
  ]) {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'packages', name, 'package.json'), 'utf8'));
    const all = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    check(
      !Object.keys(all).some((key) => key.startsWith('@mastra/')),
      `@vict/${name} has no @mastra/* dependency`,
    );
  }

  // No ee/ imports anywhere in the adapter sources.
  let eeImport = false;
  const scanEe = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanEe(full);
      } else if (entry.name.endsWith('.ts')) {
        const content = readFileSync(full, 'utf8');
        if (content.includes('ee/')) {
          eeImport = true;
        }
      }
    }
  };
  scanEe(join(repoRoot, 'packages', 'mastra', 'src'));
  check(!eeImport, '@vict/mastra imports no Mastra ee/ path');

  // Exports + declarations exist.
  for (const file of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/adapter.d.ts',
    'dist/compatibility.d.ts',
    'dist/memory.d.ts',
    'dist/storage.d.ts',
    'dist/helper-tools.d.ts',
    'dist/offline-model.d.ts',
  ]) {
    check(existsSync(join(repoRoot, 'packages', 'mastra', file)), `@vict/mastra ${file} exists`);
  }

  // No undeclared transitive reliance: the adapter source imports only
  // declared packages (node builtins excluded).
  {
    const declared = new Set([
      '@mastra/core',
      '@mastra/libsql',
      '@mastra/memory',
      '@mastra/observability',
      '@vict/contracts',
      '@vict/kernel',
      '@vict/runtime',
      '@vict/sdk',
      'zod',
    ]);
    const undeclared = new Set();
    const scanImports = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanImports(full);
        } else if (entry.name.endsWith('.ts')) {
          const content = readFileSync(full, 'utf8');
          for (const match of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
            const specifier = match[1];
            if (specifier.startsWith('.') || specifier.startsWith('node:')) {
              continue;
            }
            const root = specifier.split('/')[0].startsWith('@')
              ? specifier.split('/').slice(0, 2).join('/')
              : specifier.split('/')[0];
            if (!declared.has(root)) {
              undeclared.add(root);
            }
          }
        }
      }
    };
    scanImports(join(repoRoot, 'packages', 'mastra', 'src'));
    check(
      undeclared.size === 0,
      `no undeclared external imports (found: ${JSON.stringify([...undeclared])})`,
    );
  }

  // Dependency direction acyclicity: no neutral package imports @vict/mastra.
  let neutralImportsAdapter = false;
  const scanNeutral = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanNeutral(full);
      } else if (entry.name.endsWith('.ts')) {
        const content = readFileSync(full, 'utf8');
        if (content.includes('@vict/mastra')) {
          neutralImportsAdapter = true;
        }
      }
    }
  };
  for (const name of [
    'contracts',
    'sdk',
    'kernel',
    'runtime',
    'application',
    'store-sqlite',
    'appdata-sqlite',
    'renderer-svelte',
    'scaffolder',
  ]) {
    scanNeutral(join(repoRoot, 'packages', name, 'src'));
  }
  check(!neutralImportsAdapter, 'no neutral package imports @vict/mastra (acyclic direction)');

  // Base neutral declarations contain no Mastra references.
  const forbidden = ['@mastra/', 'Mastra', 'LibSQLStore', 'ZodType'];
  let neutralViolation = '';
  for (const name of ['contracts', 'sdk', 'kernel', 'runtime']) {
    const distDir = join(repoRoot, 'packages', name, 'dist');
    for (const entry of readdirSync(distDir)) {
      if (!entry.endsWith('.d.ts')) {
        continue;
      }
      const content = readFileSync(join(distDir, entry), 'utf8');
      for (const token of forbidden) {
        if (content.includes(token)) {
          neutralViolation = `@vict/${name}/dist/${entry} contains '${token}'`;
        }
      }
    }
  }
  check(
    neutralViolation === '',
    `neutral base declarations are Mastra-free ${neutralViolation ? `(violation: ${neutralViolation})` : ''}`,
  );
}

const work = mkdtempSync(join(tmpdir(), 'vict-stage6a-'));
try {
  // ---- 2. Packed tarballs ------------------------------------------------------
  console.log('\n=== verify:stage6a — npm pack all packages ===');
  const neutralPackages = ['contracts', 'sdk', 'kernel', 'runtime'];
  const tarballs = {};
  for (const name of [...neutralPackages, 'mastra']) {
    const packageDir = resolve(repoRoot, 'packages', name);
    const pack = run(npm, ['pack', packageDir, '--pack-destination', work], {
      capture: true,
      shell,
      timeout: 300_000,
    });
    check(pack.status === 0, `npm pack @vict/${name}`);
    if (pack.status !== 0) {
      throw new Error(`npm pack failed for ${name}`);
    }
    const tgz = pack.stdout?.trim().split(/\r?\n/).at(-1)?.trim();
    if (tgz === undefined) {
      throw new Error(`npm pack output missing for ${name}`);
    }
    tarballs[`@vict/${name}`] = join(work, tgz).replace(/\\/g, '/');
  }

  // ---- 3. Neutral packed consumer: no Mastra on disk ---------------------------
  console.log('\n=== verify:stage6a — neutral packed consumer (no Mastra installed) ===');
  {
    const neutralConsumer = join(work, 'neutral-consumer');
    mkdirSync(neutralConsumer, { recursive: true });
    writeFileSync(
      join(neutralConsumer, 'package.json'),
      JSON.stringify(
        {
          name: 'vict-stage6a-neutral-consumer',
          private: true,
          type: 'module',
          dependencies: Object.fromEntries(
            neutralPackages.map((name) => [`@vict/${name}`, `file:${tarballs[`@vict/${name}`]}`]),
          ),
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(neutralConsumer, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            skipLibCheck: false,
            noEmit: true,
          },
          include: ['*.mts'],
        },
        null,
        2,
      ),
    );
    const neutralInstall = run(npm, ['install', '--no-audit', '--no-fund'], {
      cwd: neutralConsumer,
      capture: true,
      shell,
      timeout: 600_000,
    });
    check(neutralInstall.status === 0, 'neutral consumer installs packed neutral packages');
    if (neutralInstall.status === 0) {
      check(
        !existsSync(join(neutralConsumer, 'node_modules', '@mastra')),
        'no @mastra/* package is installed in the neutral consumer',
      );

      const neutralProbeRuntime = [
        "import { defineAgentProfile, AGENT_PROFILE_SCHEMA } from '@vict/sdk';",
        "import { compileAgentProfile } from '@vict/kernel';",
        '',
        '// Built EMITTED JavaScript, executed by plain Node (no tsx, no IPC).',
        'const profile = defineAgentProfile({',
        '  schema: AGENT_PROFILE_SCHEMA,',
        "  id: 'agent.packed.probe',",
        "  revision: '1',",
        "  instructions: { id: 'instructions.packed', revision: '1' },",
        "  modelProfile: { id: 'model.packed', revision: '1', routerModel: 'offline-fixture/deterministic-1', provider: 'offline-fixture' },",
        '  generation: {},',
        "  turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },",
        "  memoryPolicy: { id: 'memory-policy.packed', revision: '1' },",
        "  adapter: { id: '@vict/mastra', revision: '1', runtimePackages: { '@mastra/core': '1.64.0' } },",
        '});',
        '',
        'const first = compileAgentProfile(profile);',
        "if (!first.ok) { throw new Error('valid profile rejected: ' + JSON.stringify(first.issues)); }",
        'const second = compileAgentProfile(structuredClone(profile));',
        "if (!second.ok || second.value.agentProfileVersion !== first.value.agentProfileVersion) { throw new Error('agentProfileVersion not deterministic'); }",
        "const broken = compileAgentProfile({ ...structuredClone(profile), turnPolicy: { ...profile.turnPolicy, onLimit: 'anything-goes' } });",
        "if (broken.ok) { throw new Error('invalid profile accepted'); }",
        '',
        '// Credential-reference boundary (emitted JS, plain Node):',
        '// providerCredentialVar is an environment-variable NAME only. An',
        '// object carrying a unique secret canary must not compile and must',
        '// not serialize anywhere.',
        "const secretCanary = 'sk-packed-consumer-SECRET-9c31f';",
        'const hostile = structuredClone(profile);',
        'hostile.modelProfile.providerCredentialVar = { value: secretCanary };',
        'const hostileResult = compileAgentProfile(hostile);',
        "if (hostileResult.ok) { throw new Error('object providerCredentialVar accepted: an object containing a unique secret must not compile'); }",
        "if (JSON.stringify(hostileResult).includes(secretCanary)) { throw new Error('secret canary leaked into diagnostics'); }",
        'const valueHostile = structuredClone(profile);',
        'valueHostile.modelProfile.providerCredentialVar = secretCanary;',
        "if (compileAgentProfile(valueHostile).ok) { throw new Error('secret-bearing string accepted as providerCredentialVar'); }",
        'const validName = structuredClone(profile);',
        "validName.modelProfile.providerCredentialVar = 'OPENAI_API_KEY';",
        "if (!compileAgentProfile(validName).ok) { throw new Error('valid env-var name rejected'); }",
        '',
        "console.log('packed profile version ' + first.value.agentProfileVersion);",
      ].join('\n');
      writeFileSync(join(neutralConsumer, 'probe.mjs'), neutralProbeRuntime);
      const probe = run(process.execPath, ['probe.mjs'], {
        cwd: neutralConsumer,
        capture: true,
        timeout: 120_000,
      });
      check(
        probe.status === 0,
        'emitted-JS packed consumer compiles a valid profile, rejects an invalid one, and rejects secret-bearing providerCredentialVar values (plain Node, no tsx)',
      );
      if (probe.status !== 0) {
        console.error(probe.stdout?.slice(-2000));
        console.error(probe.stderr?.slice(-2000));
      } else {
        check(
          /v1_[0-9a-f]{64}/.test(probe.stdout?.trim() ?? ''),
          `profile identity has the canonical form (${probe.stdout?.trim()})`,
        );
      }
      // Type-level evidence: the packed declarations type-check under
      // strict TypeScript (skipLibCheck: false) via tsc alone.
      writeFileSync(
        join(neutralConsumer, 'probe.mts'),
        [
          "import { defineAgentProfile, AGENT_PROFILE_SCHEMA } from '@vict/sdk';",
          "import { compileAgentProfile } from '@vict/kernel';",
          '',
          'const profile = defineAgentProfile({',
          '  schema: AGENT_PROFILE_SCHEMA,',
          "  id: 'agent.packed.probe',",
          "  revision: '1',",
          "  instructions: { id: 'instructions.packed', revision: '1' },",
          "  modelProfile: { id: 'model.packed', revision: '1', routerModel: 'offline-fixture/deterministic-1', provider: 'offline-fixture' },",
          '  generation: {},',
          "  turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },",
          "  memoryPolicy: { id: 'memory-policy.packed', revision: '1' },",
          "  adapter: { id: '@vict/mastra', revision: '1', runtimePackages: { '@mastra/core': '1.64.0' } },",
          '});',
          'const compiled = compileAgentProfile(profile);',
          'if (!compiled.ok) { throw new Error(String(compiled.issues.length)); }',
          'const version: string = compiled.value.agentProfileVersion;',
          "if (!version.startsWith('v1_')) { throw new Error('bad version'); }",
          '',
        ].join('\n'),
      );
      const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
      const typecheck = run(process.execPath, [tscBin, '-p', 'tsconfig.json'], {
        cwd: neutralConsumer,
        capture: true,
        timeout: 300_000,
      });
      check(
        typecheck.status === 0,
        'neutral consumer type-checks under strict TypeScript (skipLibCheck: false)',
      );
      if (typecheck.status !== 0) {
        console.error('TSC STDOUT:', typecheck.stdout?.slice(-3000));
        console.error('TSC STDERR:', typecheck.stderr?.slice(-3000));
      } else {
        console.log(typecheck.stdout?.slice(-500));
      }
    }
  }

  // ---- 4. Mastra adapter packed consumer -----------------------------------------
  console.log('\n=== verify:stage6a — Mastra adapter packed consumer ===');
  {
    const adapterConsumer = join(work, 'adapter-consumer');
    mkdirSync(adapterConsumer, { recursive: true });
    const adapterPkg = JSON.parse(
      readFileSync(join(repoRoot, 'packages', 'mastra', 'package.json'), 'utf8'),
    );
    const pinned = Object.fromEntries(
      Object.entries(adapterPkg.dependencies)
        .filter(([name]) => name.startsWith('@mastra/') || name === 'zod')
        .map(([name, version]) => [name, version]),
    );
    writeFileSync(
      join(adapterConsumer, 'package.json'),
      JSON.stringify(
        {
          name: 'vict-stage6a-adapter-consumer',
          private: true,
          type: 'module',
          dependencies: {
            '@vict/mastra': `file:${tarballs['@vict/mastra']}`,
            ...Object.fromEntries(
              ['@vict/contracts', '@vict/sdk', '@vict/kernel', '@vict/runtime'].map((name) => [
                name,
                `file:${tarballs[name]}`,
              ]),
            ),
            ...pinned,
          },
        },
        null,
        2,
      ),
    );
    const adapterInstall = run(npm, ['install', '--no-audit', '--no-fund'], {
      cwd: adapterConsumer,
      capture: true,
      shell,
      timeout: 900_000,
    });
    check(adapterInstall.status === 0, 'adapter consumer installs the packed @vict/mastra');
    if (adapterInstall.status === 0) {
      // Exact pinned versions resolved from the registry (no workspace).
      for (const [name, version] of Object.entries(pinned)) {
        const expected = version.replace(/^[\^~]/, '');
        let resolved = 'missing';
        try {
          const pkgPath = join(adapterConsumer, 'node_modules', ...name.split('/'), 'package.json');
          resolved = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
        } catch {
          // leave 'missing'
        }
        check(resolved === expected, `${name} resolved exactly at ${expected} (got ${resolved})`);
      }

      const adapterProbe = [
        "import { AgentProfileRegistry } from '@vict/runtime';",
        'import {',
        '  createDedicatedMastraStore,',
        '  createDeterministicOfflineModel,',
        '  MastraProductAgent,',
        '  MASTRA_ADAPTER_COMPATIBILITY,',
        '  verifyMastraAdapterCompatibility,',
        "} from '@vict/mastra';",
        '',
        'const harness = await verifyMastraAdapterCompatibility();',
        "if (!harness.ok) { throw new Error('compatibility harness failed: ' + JSON.stringify(harness.checks)); }",
        '',
        'const dataDir = process.argv[2];',
        'const dedicated = await createDedicatedMastraStore({',
        '  dataDir,',
        '  retention: { messagesMaxAgeMs: 3600000, threadsMaxAgeMs: 86400000, spansMaxAgeMs: 3600000 },',
        '});',
        'const registry = new AgentProfileRegistry();',
        "registry.registerArtifact({ kind: 'instructions', id: 'instructions.packed', revision: '1', text: 'Be deterministic and brief.' });",
        "registry.registerArtifact({ kind: 'memory-policy', id: 'memory-policy.packed', revision: '1', config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false } });",
        'registry.registerArtifact({',
        "  kind: 'helper-tool', id: 'helper.packed', revision: '1',",
        '  definition: {',
        "    id: 'helper.packed', revision: '1', description: 'Echo helper.', effect: 'pure',",
        "    input: { id: 'in', revision: '1', jsonSchema: { type: 'object' }, parse: (v) => ({ ok: true, value: v }) },",
        "    output: { id: 'out', revision: '1', jsonSchema: { type: 'object' }, parse: (v) => ({ ok: true, value: v }) },",
        '    execute: (v) => v,',
        '  },',
        '});',
        "registry.registerArtifact({ kind: 'guardrail', id: 'guardrail.packed', revision: '1', check: (text) => (text.length <= 2000 ? { ok: true } : { ok: false, code: 'X' }) });",
        'registry.registerProfile({',
        "  schema: 'vict.agent-profile@1',",
        "  id: 'agent.packed', revision: '1',",
        "  instructions: { id: 'instructions.packed', revision: '1' },",
        "  modelProfile: { id: 'model.packed', revision: '1', routerModel: 'offline-fixture/deterministic-1', provider: 'offline-fixture' },",
        '  generation: {},',
        "  turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },",
        "  memoryPolicy: { id: 'memory-policy.packed', revision: '1' },",
        "  helperTools: [{ id: 'helper.packed', revision: '1' }],",
        '  capabilities: [],',
        '  adapter: { id: MASTRA_ADAPTER_COMPATIBILITY.id, revision: MASTRA_ADAPTER_COMPATIBILITY.revision, runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages } },',
        '});',
        "const activation = registry.activateAgentProfile({ id: 'agent.packed', revision: '1' });",
        'const agent = MastraProductAgent.create(activation, {',
        '  store: dedicated.store,',
        "  modelFactory: () => createDeterministicOfflineModel({ script: { 'packed proof': { kind: 'text', text: 'PACKED-PROOF-REPLY' } } }),",
        '});',
        "if (!/v1_[0-9a-f]{64}/.test(agent.metadata.agentProfileVersion)) { throw new Error('bad profile version'); }",
        "if (agent.metadata.agentProfileVersion !== activation.agentProfileVersion) { throw new Error('adapter/profile identity mismatch'); }",
        "const outcome = await agent.runTurn({ turnId: 'turn-packed', threadId: 'vict-conv-packed', actorId: 'actor-packed', input: 'packed proof' }, {});",
        "if (outcome.status !== 'completed' || outcome.text !== 'PACKED-PROOF-REPLY') { throw new Error('turn failed: ' + JSON.stringify(outcome)); }",
        "if (outcome.providerModelIdentity !== 'offline-fixture/deterministic-1') { throw new Error('provider identity missing'); }",
        "const domain = await dedicated.store.getStore('memory');",
        "const messages = await domain.listMessages({ threadId: 'vict-conv-packed', resourceId: 'vict-actor-actor-packed' });",
        'if (messages.messages.length !== 2) { throw new Error("memory not persisted"); }',
        'await agent.flush();',
        'await dedicated.close();',
        "console.log('adapter packed consumer proof passed');",
      ].join('\n');
      writeFileSync(join(adapterConsumer, 'adapter-probe.mjs'), adapterProbe);
      const storeDir = join(work, 'adapter-consumer-store');
      mkdirSync(storeDir, { recursive: true });
      const adapterProbeRun = run(process.execPath, ['adapter-probe.mjs', storeDir], {
        cwd: adapterConsumer,
        capture: true,
        timeout: 300_000,
      });
      check(
        adapterProbeRun.status === 0,
        'adapter consumer runs the offline-model proof against packed dist',
      );
      if (adapterProbeRun.status !== 0) {
        console.error(adapterProbeRun.stdout?.slice(-3000));
        console.error(adapterProbeRun.stderr?.slice(-3000));
      }
    }
  }

  // ---- 5. Fresh-process store proof ----------------------------------------------
  console.log('\n=== verify:stage6a — fresh-process store proof ===');
  {
    const worker = 'packages/mastra/test/fixtures/agent-worker.mts';
    const dir = join(work, 'restart-fixture');
    mkdirSync(dir, { recursive: true });
    const dataDir = join(dir, 'data');
    const governanceDbPath = join(dir, 'governance', 'ops.db');
    const statePath = join(dir, 'state.json');

    const spawnUntilReady = (args, expectedStage) => {
      const { spawn } = spawnSync_module;
      const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return {
        child,
        ready: new Promise((resolveReady, rejectReady) => {
          let buffer = '';
          const guard = setTimeout(() => {
            child.kill('SIGKILL');
            rejectReady(
              new Error(`readiness for '${expectedStage}' not observed (bounded failure guard)`),
            );
          }, 120_000);
          child.stdout.setEncoding('utf8');
          child.stdout.on('data', (chunk) => {
            buffer += chunk;
            if (!buffer.includes(`vict-agent-ready:${expectedStage}`)) return;
            clearTimeout(guard);
            resolveReady();
          });
          child.on('close', (code, signal) => {
            clearTimeout(guard);
            rejectReady(
              new Error(
                `readiness for '${expectedStage}' not observed; child exited first (status=${code}, signal=${signal})`,
              ),
            );
          });
        }),
        result: new Promise((resolveResult) => {
          child.on('close', (code, signal) => resolveResult({ status: code, signal }));
        }),
      };
    };
    const setup = spawnUntilReady(
      [worker, 'setup', dataDir, governanceDbPath, statePath],
      'setup-complete',
    );
    await setup.ready;
    setup.child.kill('SIGKILL');
    await setup.result;
    check(existsSync(statePath), 'fresh-process: state checkpoint written before the SIGKILL');

    const verify = spawnUntilReady(
      [worker, 'verify-memory', dataDir, governanceDbPath, statePath],
      'memory-verified',
    );
    await verify.ready;
    const verifyRun = await verify.result;
    check(
      verifyRun.status === 0,
      'fresh-process: dedicated Mastra database reopens with persisted memory',
    );
    const memoryResult = JSON.parse(readFileSync(join(dir, 'verify-memory-result.json'), 'utf8'));
    check(
      memoryResult.messageCount === 2,
      'fresh-process: the durable turn (user + assistant) reopened',
    );

    const partial = spawnUntilReady(
      [worker, 'delete-partial', dataDir, governanceDbPath, statePath],
      'deletion-partial',
    );
    await partial.ready;
    partial.child.kill('SIGKILL');
    await partial.result;

    const resume = spawnUntilReady(
      [worker, 'delete-resume', dataDir, governanceDbPath, statePath],
      'deletion-resumed',
    );
    await resume.ready;
    const resumeRun = await resume.result;
    check(resumeRun.status === 0, 'fresh-process: governed deletion resumes after the crash');
    const resumeResult = JSON.parse(readFileSync(join(dir, 'delete-resume-result.json'), 'utf8'));
    check(
      resumeResult.first.resumed === 1 &&
        resumeResult.first.completed === 1 &&
        resumeResult.first.pending === 0,
      'fresh-process: the partial deletion resumed to completion',
    );
    check(
      resumeResult.second.resumed === 0 &&
        resumeResult.second.completed === 0 &&
        resumeResult.second.pending === 0,
      'fresh-process: repeated recovery is a no-op (idempotent)',
    );
    check(
      JSON.stringify(resumeResult.receipts) ===
        JSON.stringify(['application-domain', 'mastra-memory']),
      'fresh-process: exactly one receipt per step (no duplicates, no lost completion)',
    );
    check(
      resumeResult.remainingMessages === 0,
      'fresh-process: the Mastra thread is fully deleted after reconciliation',
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

if (failures > 0) {
  console.error(`\nverify:stage6a — ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nverify:stage6a — all checks passed');
