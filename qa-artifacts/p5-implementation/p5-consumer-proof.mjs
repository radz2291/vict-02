/**
 * P5 implementation proof — packed-consumer verification (bounded).
 *
 * Proves the P5 architectural ownership move OUTSIDE workspace resolution:
 *  1. packs the six required packages from the implementation worktree;
 *  2. copies the consumer app + tarballs into a FRESH temp dir OUTSIDE the
 *     repository (no workspace resolution possible there) and npm-installs;
 *  3. asserts installed versions, and that the lockfile carries NO
 *     workspace:/link: specifiers and NO monorepo paths (file: appears only
 *     as the packed-tarball install specifiers themselves);
 *  4. asserts the packed manifests declare no workspace: protocol and the
 *     installed `renderer-svelte/theme.css` is ONLY a compatibility entry
 *     point routing to `ui-svelte/styles.css`;
 *  5. vite-builds the consumer (which imports BOTH public paths: direct
 *     `@victframework/ui-svelte` + styles.css AND compat
 *     `@victframework/renderer-svelte` + theme.css) and inspects the
 *     emitted bundle: exactly ONE renderer implementation (the renderer
 *     identity string and the host marker each occur once in the JS; the
 *     style source occurrences are byte-identical, i.e. the same
 *     implementation reached through both style entry points);
 *  6. runs the built bundle under happy-dom (real mounts, no browser) and
 *     requires EVERY in-page check to pass: frozen renderer identity,
 *     binding-identity between the two paths, identical host markup,
 *     mounting, theme tokens through both entries, reactive updates
 *     without remount, idempotent unmount.
 *
 * This is the bounded §8 proof for the P5 implementation pass — NOT the
 * extended P1–P4 visual matrix (that remains the QA loop's job).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKTREE = resolve(HERE, '..', '..');
const PACKED = join(HERE, 'packed');
const PACKAGES = ['contracts', 'sdk', 'application', 'ui', 'ui-svelte', 'renderer-svelte'];
const VERSION = '0.3.1';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: ok === true, detail: String(detail).slice(0, 800) });
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${name}${ok === true ? '' : ' — ' + detail}`);
}
const count = (haystack, needle) => haystack.split(needle).length - 1;

// Invoke npm through its JS CLI entry: the npm.cmd batch wrapper fails with
// "stdout is not a tty" when spawned with redirected output on Windows.
const NPM_CLI = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';
const run = (cmd, args, opts = {}) =>
  cmd === 'npm'
    ? spawnSync(process.execPath, [NPM_CLI, ...args], { encoding: 'utf8', timeout: 900_000, ...opts })
    : spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', timeout: 900_000, ...opts });

// ---- 1. pack from the implementation worktree ------------------------------
rmSync(PACKED, { recursive: true, force: true });
mkdirSync(PACKED, { recursive: true });
for (const pkg of PACKAGES) {
  const pack = run('npm', ['pack', '--pack-destination', PACKED], { cwd: join(WORKTREE, 'packages', pkg) });
  if (pack.status !== 0) throw new Error(`npm pack ${pkg} failed: ${(pack.stderr ?? '').slice(-300)}`);
}
const packedTgzs = readdirSync(PACKED).filter((f) => f.endsWith('.tgz'));
check(
  'pack: all six 0.3.1 packages packed from the implementation worktree',
  PACKAGES.every((p) => packedTgzs.includes(`victframework-${p}-${VERSION}.tgz`)),
  packedTgzs.join(', '),
);

// The packed manifests must declare no workspace protocol anywhere.
// Note: MSYS tar (Git-Bash) misreads `C:/...` as a remote host, so prefer
// the Windows system tar and fall back to `--force-local`.
const SYSTEM_TAR = 'C:/Windows/System32/tar.exe';
const extractMember = (tgz, member) => {
  let out = spawnSync(SYSTEM_TAR, ['-xOf', tgz, member], { encoding: 'utf8' });
  if (out.status !== 0) out = spawnSync('tar', ['--force-local', '-xOf', tgz, member], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`tar extract failed for ${tgz}: ${(out.stderr ?? '').slice(-200)}`);
  return out.stdout;
};
const packedManifestLeak = PACKAGES.filter((p) =>
  extractMember(join(PACKED, `victframework-${p}-${VERSION}.tgz`), 'package/package.json').includes('workspace:'),
);
check('pack: packed manifests declare NO workspace: protocol', packedManifestLeak.length === 0, packedManifestLeak.join(','));

// ---- 2. fresh consumer outside the repository ------------------------------
const workRoot = mkdtempSync(join(tmpdir(), 'vict-p5-proof-'));
const dest = join(workRoot, 'consumer');
cpSync(join(HERE, 'consumer'), dest, { recursive: true });
cpSync(PACKED, join(dest, 'packed'), { recursive: true });

const install = run('npm', ['install', '--no-audit', '--no-fund'], { cwd: dest });
if (install.status !== 0) {
  check('npm install from packed tarballs (clean temp dir)', false, (install.stderr ?? '').slice(-500));
  throw new Error('install failed');
}
check('npm install from packed tarballs (clean temp dir)', true, dest);

// ---- 3. lockfile: versions + leakage ---------------------------------------
const lock = JSON.parse(readFileSync(join(dest, 'package-lock.json'), 'utf8'));
const wrong = PACKAGES.filter(
  (p) => lock.packages?.[`node_modules/@victframework/${p}`]?.version !== VERSION,
);
check(`lockfile: installed versions exactly ${VERSION}`, wrong.length === 0, wrong.join(','));
const lockText = JSON.stringify(lock);
check('lockfile: NO workspace: protocol', !lockText.includes('workspace:'));
check('lockfile: NO link: specifiers', !lockText.includes('"link"'));
check('lockfile: NO monorepo path leakage (vict-02)', !lockText.includes('vict-02'));
const fileSpecs = [...lockText.matchAll(/"file:([^"]*)"/g)].map((m) => m[1]);
const distinctSpecs = [...new Set(fileSpecs)];
check(
  'lockfile: file: specifiers are ONLY the packed tarball installs',
  distinctSpecs.length === PACKAGES.length &&
    distinctSpecs.every((s) => s.startsWith('packed/victframework-')) &&
    fileSpecs.length === 2 * PACKAGES.length,
  `[${fileSpecs.length} occurrences] ${distinctSpecs.join(',')}`,
);

// ---- 4. compat theme.css entry point inside the installed package ----------
const themeCss = readFileSync(
  join(dest, 'node_modules', '@victframework', 'renderer-svelte', 'src', 'theme.css'),
  'utf8',
);
check(
  'installed theme.css is ONLY the compatibility entry importing ui-svelte/styles.css',
  /@import\s+'@victframework\/ui-svelte\/styles.css'/.test(themeCss) &&
    !/\.vict-[a-z-]+\s*{/.test(themeCss),
  themeCss.trim().slice(0, 120),
);
const installedFacade = readFileSync(
  join(dest, 'node_modules', '@victframework', 'renderer-svelte', 'src', 'index.ts'),
  'utf8',
);
check(
  'installed renderer-svelte is the facade (re-exports from ui-svelte, no own implementation)',
  installedFacade.includes("from '@victframework/ui-svelte'") &&
    !/export (async )?function|export class/.test(installedFacade),
);
const installedStyles = existsSync(
  join(dest, 'node_modules', '@victframework', 'ui-svelte', 'src', 'styles.css'),
);
check('installed ui-svelte ships styles.css (the one style source)', installedStyles);

// ---- 5. build + bundle inspection ------------------------------------------
const build = run('npm', ['run', 'build'], { cwd: dest });
if (build.status !== 0) {
  check('vite build', false, (build.stderr ?? build.stdout ?? '').slice(-600));
  throw new Error('build failed');
}
check('vite build succeeds (both renderer entry points resolve)', true);

const assetsDir = join(dest, 'dist', 'assets');
const jsFile = readdirSync(assetsDir).find((a) => a.startsWith('index') && a.endsWith('.js'));
const cssFile = readdirSync(assetsDir).find((a) => a.endsWith('.css'));
const js = readFileSync(join(assetsDir, jsFile), 'utf8');
const css = cssFile !== undefined ? readFileSync(join(assetsDir, cssFile), 'utf8') : '';

// Exactly ONE renderer implementation in the JS bundle.
check(
  'bundle: renderer identity string occurs EXACTLY once (single implementation)',
  count(js, 'renderer.svelte-kit') === 1,
  String(count(js, 'renderer.svelte-kit')),
);
check(
  'bundle: generic host marker occurs EXACTLY once (single VitApp implementation)',
  count(js, 'vict-host') === 1,
  String(count(js, 'vict-host')),
);

// Style entry points: theme.css inlines styles.css AND the direct styles.css
// import inlines it — occurrences must be identical bytes (no divergence).
const styleCounts = [count(css, '.vict-list-item{'), count(css, 'max-height:60vh'), count(css, '--vict-color-accent:')];
check(
  'bundle: style source reached through BOTH entry points (1 or 2 inline copies)',
  styleCounts.every((n) => n === 1 || n === 2),
  JSON.stringify(styleCounts),
);
if (styleCounts.some((n) => n === 2)) {
  const signature = '.vict-list-item{';
  const first = css.indexOf(signature);
  const second = css.indexOf(signature, first + 1);
  const a = css.slice(first, first + 200);
  const b = css.slice(second, second + 200);
  check('bundle: inline style copies are byte-identical (no divergent styles)', a === b);
} else {
  check('bundle: inline style copies are byte-identical (deduplicated by the bundler)', true);
}

// ---- 6. execute the built consumer under happy-dom --------------------------
const dom = spawnSync(process.execPath, ['run-in-dom.mjs'], { cwd: dest, encoding: 'utf8', timeout: 120_000 });
const resultLine = (dom.stdout ?? '')
  .split('\n')
  .find((line) => line.startsWith('P5_PROOF_RESULT '));
if (resultLine === undefined) {
  check('consumer runtime executed', false, ((dom.stderr ?? '') + '\n' + (dom.stdout ?? '')).slice(-2500));
} else {
  const { checks } = JSON.parse(resultLine.slice('P5_PROOF_RESULT '.length));
  for (const c of checks) check(`consumer: ${c.name}`, c.ok, c.detail);
}

// ---- cleanup + report -------------------------------------------------------
try {
  rmSync(workRoot, { recursive: true, force: true });
} catch {
  /* Windows file lock; temp dir cleanup is best-effort */
}

writeFileSync(join(HERE, 'p5-consumer-results.json'), JSON.stringify({ results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== P5 CONSUMER PROOF: ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length > 0) process.exitCode = 1;
