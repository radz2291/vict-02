/**
 * Bootstrap candidate construction + inspection (release-readiness r4).
 *
 * Builds the FIRST-PUBLICATION BOOTSTRAP placeholder artifact for one
 * absent member — CORRECTLY:
 *   1. the member is BUILT in the real workspace first (`npm run build
 *      --workspace <name>`) so its real build output exists (for
 *      `@victframework/ui` that is ALL it publishes — `files: ["dist"]`;
 *      for `ui-svelte` it is the declaration-only `dist` alongside the
 *      shipped `src`);
 *   2. the package directory is temp-copied WITHOUT stripping anything
 *      npm pack would include (the r3 filter that dropped `dist` produced
 *      an artifact that violated its own manifest: `ui` would have packed
 *      ZERO exportable files). Only `node_modules` and stray tarballs are
 *      excluded;
 *   3. the TEMP COPY's manifest is re-versioned to the fixed placeholder
 *      version — dependencies and every other field stay EXACTLY as the
 *      source manifest declares them;
 *   4. `npm pack --dry-run --json` produces the actual tarball file list
 *      (no registry call, no artifact written);
 *   5. the candidate is VALIDATED against its own manifest: every
 *      declared export/main/types target must exist in the tarball, the
 *      `files` allowlist must be covered, dependencies must equal the
 *      source manifest's pins, and no workspace/link/file protocol may
 *      leak.
 *
 * TRUTHFUL PURPOSE (documented, not advertised away): the placeholder is
 * a REGISTRY-PRESENCE MARKER, not a functional release. Members whose
 * dependencies pin the coordinated version (e.g. `ui-svelte` →
 * `@victframework/{application,sdk,ui}@0.4.0-rc.1`) are NOT installable
 * until the coordinated set publishes — dependency resolution fails BY
 * DESIGN, which is exactly what keeps the placeholder from ever being
 * consumed as a release. The `bootstrap` dist-tag and the
 * `0.0.0-bootstrap.1` version keep it outside every resolution path; its
 * only purpose is to make the package EXIST so its trust relationship
 * can be configured.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveReleaseInventory } from './release-set.mjs';
import { BOOTSTRAP_PLACEHOLDER_VERSION } from './trust-preflight.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** Collect every path-like string value in a package.json exports map. */
export function collectExportTargets(value, collected = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./') || value.startsWith('.')) collected.push(value);
    return collected;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectExportTargets(entry, collected);
    return collected;
  }
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) collectExportTargets(child, collected);
  }
  return collected;
}

function sortedDependencies(dependencies) {
  if (dependencies === undefined) return undefined;
  return Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * Validate a built bootstrap candidate against its own source manifest
 * and the actual dry-run tarball file list. Returns every problem found
 * (an empty list is the only pass).
 */
export function validateBootstrapCandidate({ name, sourceManifest, manifest, fileList }) {
  const problems = [];
  if (manifest.version !== BOOTSTRAP_PLACEHOLDER_VERSION) {
    problems.push(
      `manifest version is ${manifest.version}, expected the fixed placeholder ${BOOTSTRAP_PLACEHOLDER_VERSION}.`,
    );
  }
  if (manifest.name !== name) {
    problems.push(`manifest name is ${manifest.name}, expected ${name}.`);
  }

  const listed = new Set(fileList);
  if (!listed.has('package.json')) problems.push('the tarball does not contain package.json.');

  // Every declared export target must physically exist in the tarball.
  const targets = collectExportTargets(manifest.exports ?? {});
  for (const field of ['main', 'types']) {
    if (typeof manifest[field] === 'string') targets.push(manifest[field]);
  }
  for (const target of targets) {
    const normalized = target.replace(/^\.\//, '');
    if (!listed.has(normalized)) {
      problems.push(
        `declared export target '${target}' is MISSING from the placeholder tarball — the artifact would be broken.`,
      );
    }
  }

  // The `files` allowlist must be covered (a declared-but-absent entry
  // means the build output was not carried into the candidate).
  for (const entry of sourceManifest.files ?? []) {
    const covered =
      listed.has(entry) ||
      [...listed].some((path) => path === entry || path.startsWith(`${entry}/`));
    if (!covered) {
      problems.push(
        `manifest 'files' entry '${entry}' is missing from the tarball — the build/pack process is incomplete.`,
      );
    }
  }

  // Dependencies stay EXACTLY the source pins (the placeholder tells the
  // truth about what the real package needs — which is precisely why it
  // is not installable before the coordinated set exists).
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const expected = sortedDependencies(sourceManifest[field]);
    const actual = sortedDependencies(manifest[field]);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      problems.push(
        `manifest '${field}' was mutated by the placeholder process — the placeholder must carry the source pins verbatim.`,
      );
    }
    for (const [dep, spec] of Object.entries(actual ?? {})) {
      if (/^(workspace|link|file):/.test(spec)) {
        problems.push(`manifest '${field}' leaks a non-registry protocol: ${dep}@${spec}.`);
      }
    }
  }

  return problems;
}

/**
 * Build + inspect the bootstrap placeholder candidate for one absent
 * member. NEVER touches the registry; the workspace tree is never
 * mutated (the member is built in place — the ordinary build output —
 * and packed from a temp copy).
 *
 * @returns {{workDir: string, manifest: object, fileList: string[],
 *            packSummary: object, problems: string[]}}
 */
export function buildBootstrapCandidate({ repoRoot, name, log = () => {} }) {
  const inventory = deriveReleaseInventory(repoRoot);
  if (inventory.problems.length > 0) {
    throw new Error(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
  }
  const entry = inventory.byName.get(name);
  if (entry === undefined) throw new Error(`'${name}' is not a release-set member.`);
  const bare = name.replace('@victframework/', '');

  const sourceManifest = JSON.parse(readFileSync(join(entry.dir, 'package.json'), 'utf8'));

  // 1. Real build in the workspace (the ordinary build output the real
  //    release would pack).
  if (typeof sourceManifest.scripts?.build === 'string') {
    log(`  building ${name} in the workspace (npm run build --workspace ${name})...`);
    const build = spawnSync(npm, ['run', 'build', '--workspace', name], {
      encoding: 'utf8',
      cwd: repoRoot,
      shell: process.platform === 'win32',
    });
    if (build.status !== 0) {
      throw new Error(
        `workspace build failed for ${name} (exit ${build.status}): ${(build.stderr ?? build.stdout ?? '').slice(-400)}`,
      );
    }
  }

  // 2. Temp copy — WITHOUT the r3 dist-stripping mistake.
  const work = mkdtempSync(join(tmpdir(), 'vict-bootstrap-candidate-'));
  const candidateDir = join(work, bare);
  try {
    cpSync(entry.dir, candidateDir, {
      recursive: true,
      filter: (source) =>
        !source.includes(`${bare}${join('node_modules')}`) && !source.endsWith('.tgz'),
    });

    // 3. Re-version the TEMP COPY only; everything else stays verbatim.
    const manifestPath = join(candidateDir, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.name !== name) throw new Error(`temp-copy manifest name mismatch for ${name}.`);
    manifest.version = BOOTSTRAP_PLACEHOLDER_VERSION;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    // 4. The ACTUAL dry-run tarball contents (no artifact, no registry).
    const pack = spawnSync(npm, ['pack', candidateDir, '--dry-run', '--json', '--silent'], {
      encoding: 'utf8',
      cwd: work,
      shell: process.platform === 'win32',
    });
    if (pack.status !== 0) {
      throw new Error(
        `npm pack --dry-run failed for ${name} (exit ${pack.status}): ${(pack.stderr ?? '').slice(-400)}`,
      );
    }
    const packOutput = JSON.parse((pack.stdout ?? '').trim());
    const summary = Array.isArray(packOutput) ? packOutput[0] : packOutput;
    const fileList = (summary.files ?? []).map((file) => file.path);

    // 5. Validate against the manifest + the real file list.
    const problems = validateBootstrapCandidate({ name, sourceManifest, manifest, fileList });

    return {
      workDir: work,
      candidateDir,
      manifest,
      sourceManifest,
      fileList,
      packSummary: summary,
      problems,
    };
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    throw error;
  }
}
