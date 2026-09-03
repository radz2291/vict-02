#!/usr/bin/env node
/**
 * Stage 05 aggregate verification: application delivery.
 *
 * This is an aggregation for convenience — it does NOT replace or skip the
 * individual evidence commands in the verification ladder:
 *   npm ci, typecheck, format:check, lint, build, test:unit,
 *   test:integration, npm test, verify:consumer, verify:stage2,
 *   verify:stage3, verify:stage4, verify:stage5, example, bench,
 *   example:application
 *
 * Stage 05 additions proven here (not hidden by aggregation):
 *   - the full test suite includes the Stage 05 renderer conformance,
 *     SQLite application-data conformance, hostile-container diagnostics
 *     (LOW-C-1 closure), migration/restart fixtures, and scaffolder suites;
 *   - the Stage 05 reference application BUILDS WARNING-FREE (Svelte
 *     reactivity warnings fail the check, they are never suppressed) and
 *     passes its definition/DOM/real-process-HTTP(restart)/REAL-browser
 *     (desktop + mobile, axe accessibility) suites;
 *   - the scaffolder generates a runnable host from PACKED TARBALLS and the
 *     generated project installs and builds in isolation.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
let failures = 0;
const shell = process.platform === 'win32';
const npm = shell ? 'npm.cmd' : 'npm';
const npx = shell ? 'npx.cmd' : 'npx';

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

function step(label, command, args, options = {}) {
  console.log(`\n=== verify:stage5 — ${label} ===`);
  const result = run(command, args, options);
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

// 1. Required build prerequisites (all packages, fresh emit).
step('build all packages', npm, ['run', 'build'], { timeout: 600_000, shell });

// 2. Complete test suite: unit (incl. appdata-sqlite + scaffolder) +
//    renderer (DOM conformance) + integration projects.
step('full vitest suite', npm, ['run', 'test'], { timeout: 1_800_000, shell });

// 3. Warning-free Svelte build of the Stage 05 reference application.
console.log('\n=== verify:stage5 — reference application: warning-free build ===');
const referenceBuild = run(npx, ['vite', 'build'], {
  cwd: join(repoRoot, 'examples', 'reference-app'),
  capture: true,
  timeout: 600_000,
  shell,
});
check(referenceBuild.status === 0, 'reference application builds');
const buildLog = `${referenceBuild.stdout ?? ''}\n${referenceBuild.stderr ?? ''}`;
check(
  !buildLog.includes('state_referenced_locally'),
  'the reference application build is free of Svelte state_referenced_locally warnings',
);
check(
  !/\[vite-plugin-svelte\].*[Ww]arning/.test(buildLog),
  'the reference application build emits no vite-plugin-svelte warnings',
);

// 4. Reference application suites (identity, DOM, real-process HTTP with
//    restart survival, real-browser desktop+mobile accessibility scans).
step('reference application suites', npm, ['run', 'test', '-w', 'reference-app'], {
  timeout: 1_200_000,
  shell,
});

// 5. Packed-consumer scaffolder check.
console.log('\n=== verify:stage5 — packed-consumer scaffolder check ===');
packedScaffolderCheck();

function packedScaffolderCheck() {
  const work = mkdtempSync(join(tmpdir(), 'vict-stage5-packed-'));
  try {
    // Pack every package the generated host depends on.
    const tarballs = {};
    for (const name of [
      'contracts',
      'sdk',
      'kernel',
      'runtime',
      'store-sqlite',
      'application',
      'appdata-sqlite',
      'renderer-svelte',
      'scaffolder',
    ]) {
      const pack = run(npm, ['pack', `./packages/${name}`, '--pack-destination', work], {
        cwd: repoRoot,
        capture: true,
        shell,
      });
      if (pack.status !== 0) {
        console.error(`[FAIL] npm pack packages/${name}`);
        failures += 1;
        return;
      }
      const tgz = pack.stdout?.trim().split(/\r?\n/).at(-1);
      if (tgz === undefined) {
        console.error(`[FAIL] npm pack output for ${name}`);
        failures += 1;
        return;
      }
      tarballs[`@vict/${name}`] = join(work, tgz.trim()).replace(/\\/g, '/');
    }

    // A tiny consumer installs the PACKED scaffolder and generates the host
    // with the packed dist (never workspace sources).
    const consumer = join(work, 'scaffold-consumer');
    mkdirSync(consumer, { recursive: true });
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify(
        {
          name: 'vict-stage5-packed-consumer',
          private: true,
          type: 'module',
          dependencies: { '@vict/scaffolder': `file:${tarballs['@vict/scaffolder']}` },
        },
        null,
        2,
      ),
    );
    const consumerInstall = run('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: consumer,
      capture: true,
      shell,
      timeout: 600_000,
    });
    check(
      consumerInstall.status === 0,
      'packed-consumer: @vict/scaffolder installs from its tarball',
    );
    if (consumerInstall.status !== 0) return;

    const target = join(work, 'generated-app');
    const scaffold = run(
      process.execPath,
      [
        '-e',
        `import { scaffoldVictApp } from '@vict/scaffolder';
         const result = scaffoldVictApp({ targetDir: ${JSON.stringify(target)}, appName: 'Packed Consumer App' });
         if (result.status !== 'created') { throw new Error('scaffold status: ' + result.status); }
         console.log('generated', result.files.length, 'files');`,
      ],
      { cwd: consumer, capture: true },
    );
    check(scaffold.status === 0, 'packed-generation: the packed scaffolder created the host');
    if (scaffold.status !== 0) return;

    // The generated project consumes ONLY the packed tarballs.
    const pkgPath = join(target, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    // Route BOTH direct and transitive @vict dependencies to the packed
    // tarballs: private workspace packages are never on the public registry.
    for (const [name, tgz] of Object.entries(tarballs)) {
      pkg.dependencies[name] = `file:${tgz}`;
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    const install = run(npm, ['install', '--no-audit', '--no-fund'], {
      cwd: target,
      capture: true,
      shell,
      timeout: 900_000,
    });
    check(install.status === 0, 'packed-consumer: generated host installs from tarballs');
    if (install.status !== 0) return;

    const build = run(npx, ['vite', 'build'], {
      cwd: target,
      capture: true,
      shell,
      timeout: 900_000,
    });
    check(build.status === 0, 'packed-consumer: generated host builds in isolation');
    if (build.status !== 0) {
      console.error(build.stdout?.slice(-3000));
      console.error(build.stderr?.slice(-3000));
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (failures > 0) {
  console.error(`\nverify:stage5 — ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nverify:stage5 — all checks passed');
