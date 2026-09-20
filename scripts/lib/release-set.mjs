/**
 * Shared release-set rules for the GitHub-OIDC trusted-publishing path
 * (docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md, frozen).
 *
 * Extracted as PURE functions so both `scripts/oidc-release.mjs` (the
 * workflow's validate/publish/verify engine) and
 * `scripts/trust-bootstrap.mjs` (the one-time bulk trust bootstrap) use
 * the SAME derivation of the 13-package inventory, the SAME closed
 * version/tag rule, and the SAME publication argv — and so the rules
 * carry permanent regression coverage in `scripts/test/`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The only registry the release path ever talks to. */
export const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

/** The exact coordinated release-set size (frozen contract §5). */
export const EXPECTED_RELEASE_PACKAGE_COUNT = 13;

/** The internal dependency prefix of every release-set member. */
export const INTERNAL_DEPENDENCY_PREFIX = '@victframework/';

/**
 * The frozen dependency-topological publication order (contract §5).
 * Every release action validates that this order is still a valid
 * linearization of the ACTUAL manifests' internal dependency graph and
 * fails closed when the graph drifted — the order is frozen, not
 * re-derived per release.
 */
export const FROZEN_PUBLISH_ORDER = [
  '@victframework/contracts',
  '@victframework/sdk',
  '@victframework/kernel',
  '@victframework/runtime',
  '@victframework/store-sqlite',
  '@victframework/application',
  '@victframework/renderer-svelte',
  '@victframework/appdata-sqlite',
  '@victframework/scaffolder',
  '@victframework/control',
  '@victframework/mastra',
  '@victframework/server',
  '@victframework/cli',
];

/**
 * A full git object name (SHA-1) — the only accepted shape for a
 * release-source commit reference (contract §6).
 */
export const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/;

/** The exact shape of a coordinated release-set version. */
export const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/;

/**
 * Closed version→tag rule (contract §7). A candidate version
 * `X.Y.Z-rc.N` publishes ONLY under the non-latest candidate tag
 * `vict-X.Y.Z-rc`; a stable version `X.Y.Z` publishes ONLY under
 * `latest`. Everything else is refused.
 *
 * @param {string} version the requested release-set version
 * @param {string} tag the requested distribution tag
 * @returns {{ok: true, tag: string} | {ok: false, reason: string}}
 */
export function validateVersionTagPair(version, tag) {
  if (typeof version !== 'string' || !RELEASE_VERSION_PATTERN.test(version)) {
    return {
      ok: false,
      reason: `version '${String(version)}' is not a coordinated release-set version (expected X.Y.Z or X.Y.Z-rc.N).`,
    };
  }
  if (typeof tag !== 'string' || tag.length === 0 || tag.length > 64) {
    return { ok: false, reason: `tag '${String(tag)}' is not a valid distribution tag.` };
  }
  const candidateMatch = /^(\d+\.\d+\.\d+)-rc\.(\d+)$/.exec(version);
  if (candidateMatch !== null) {
    const expectedTag = `vict-${candidateMatch[1]}-rc`;
    if (tag !== expectedTag) {
      return {
        ok: false,
        reason: `candidate version '${version}' must publish under the candidate tag '${expectedTag}' (got '${tag}'); 'latest' never moves to a candidate.`,
      };
    }
    return { ok: true, tag };
  }
  if (tag !== 'latest') {
    return {
      ok: false,
      reason: `stable version '${version}' must publish under 'latest' (got '${tag}').`,
    };
  }
  return { ok: true, tag };
}

/**
 * Read one release-set manifest from a repository root.
 *
 * @param {string} repoRoot repository root directory
 * @param {string} packageDirName directory name under packages/
 * @returns {{name: string, version: string, manifest: Record<string, unknown>, dir: string}}
 */
export function readReleaseManifest(repoRoot, packageDirName) {
  const dir = resolve(repoRoot, 'packages', packageDirName);
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  return {
    name: manifest.name,
    version: manifest.version,
    manifest,
    dir,
  };
}

/**
 * Derive the release-set inventory from the ACTUAL publishable manifests
 * (contract §5): one manifest per directory under packages/, the exact
 * frozen 13-name inventory, and ONE coherent release-set version.
 *
 * @param {string} repoRoot repository root directory
 * @returns {{
 *   byName: Map<string, {name: string, version: string, manifest: object, dir: string}>,
 *   version: string,
 *   order: string[],
 *   problems: string[],
 * }}
 */
export function deriveReleaseInventory(repoRoot) {
  const problems = [];
  const packagesDir = join(repoRoot, 'packages');
  const dirNames = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const byName = new Map();
  for (const dirName of dirNames) {
    let manifest;
    try {
      const entry = readReleaseManifest(repoRoot, dirName);
      manifest = entry;
    } catch (error) {
      problems.push(`packages/${dirName}: unreadable manifest (${error.message})`);
      continue;
    }
    if (!manifest.name.startsWith(INTERNAL_DEPENDENCY_PREFIX)) {
      problems.push(
        `packages/${dirName}: manifest name '${manifest.name}' is not an ${INTERNAL_DEPENDENCY_PREFIX}* release-set member`,
      );
      continue;
    }
    if (byName.has(manifest.name)) {
      problems.push(`duplicate release-set member name '${manifest.name}'`);
      continue;
    }
    byName.set(manifest.name, manifest);
  }

  const frozenSet = new Set(FROZEN_PUBLISH_ORDER);
  for (const name of byName.keys()) {
    if (!frozenSet.has(name)) {
      problems.push(`'${name}' is not in the frozen 13-package inventory`);
    }
  }
  for (const name of FROZEN_PUBLISH_ORDER) {
    if (!byName.has(name)) {
      problems.push(`frozen inventory member '${name}' has no publishable manifest`);
    }
  }
  if (byName.size !== EXPECTED_RELEASE_PACKAGE_COUNT) {
    problems.push(
      `release-set inventory is ${byName.size} packages, expected exactly ${EXPECTED_RELEASE_PACKAGE_COUNT}`,
    );
  }

  const versions = new Set([...byName.values()].map((entry) => entry.version));
  if (versions.size !== 1) {
    problems.push(
      `release-set manifests do not share ONE coherent version (${[...versions].join(', ')})`,
    );
  }

  // The frozen order must still be a valid linearization of the ACTUAL
  // internal dependency graph — a graph drift fails closed here (the
  // order is frozen by contract §5, never silently re-derived).
  const orderProblems = validateFrozenOrderIsTopological(byName);
  problems.push(...orderProblems);

  return {
    byName,
    version: versions.values().next().value,
    order: [...FROZEN_PUBLISH_ORDER],
    problems,
  };
}

/**
 * Check that the frozen publication order is a topological linearization
 * of the manifests' internal dependency graph (only
 * `dependencies`/`peerDependencies`/`optionalDependencies` edges between
 * release-set members count).
 *
 * @param {Map<string, {name: string, manifest: object}>} byName inventory
 * @returns {string[]} problems (empty when the frozen order is valid)
 */
export function validateFrozenOrderIsTopological(byName) {
  const problems = [];
  const position = new Map(FROZEN_PUBLISH_ORDER.map((name, index) => [name, index]));
  for (const [name, entry] of byName) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const deps = entry.manifest[section];
      if (deps === undefined || typeof deps !== 'object') continue;
      for (const depName of Object.keys(deps)) {
        if (!depName.startsWith(INTERNAL_DEPENDENCY_PREFIX)) continue;
        const depPosition = position.get(depName);
        if (depPosition === undefined) {
          problems.push(
            `'${name}' depends on internal '${depName}', which is not a release-set member`,
          );
          continue;
        }
        if (depPosition >= position.get(name)) {
          problems.push(
            `frozen publication order violated: '${name}' (position ${position.get(name)}) depends on '${depName}' (position ${depPosition}) which publishes later`,
          );
        }
      }
    }
  }
  return problems;
}

/**
 * The EXACT publish argv for one release member (contract §10): the
 * packed tarball, public access, the closed distribution tag, the public
 * registry — and NEVER a token, secret, or `_auth` material of any kind.
 *
 * @param {string} tarballPath absolute path of the packed tarball
 * @param {string} tag distribution tag (already validated)
 * @returns {string[]}
 */
export function publishArgv(tarballPath, tag) {
  return [
    'publish',
    tarballPath,
    '--access',
    'public',
    '--tag',
    tag,
    '--registry',
    PUBLIC_REGISTRY,
  ];
}

/**
 * The EXACT `npm trust github` argv for one release member (contract
 * §11): trusts exactly the frozen repository and workflow filename with
 * publish permission, no environment, no other provider.
 *
 * @param {string} packageName exact package name
 * @param {{repository: string, workflowFile: string}} target frozen trust target
 * @returns {string[]}
 */
export function trustGithubArgv(packageName, target) {
  return [
    'trust',
    'github',
    packageName,
    '--repo',
    target.repository,
    '--file',
    target.workflowFile,
    '--allow-publish',
    '--yes',
  ];
}

/** The frozen trust target (contract §1/§2/§11). */
export const FROZEN_TRUST_TARGET = Object.freeze({
  repository: 'radz2291/vict-02',
  workflowFile: 'release.yml',
});

/**
 * npm CLI minimum versions (contract §3/§11): >= 11.5.1 for OIDC
 * publication, >= 11.15.0 for the `npm trust` bootstrap interface.
 */
export const MIN_NPM_FOR_TRUST = '11.15.0';

/**
 * Compare two dotted npm version strings (numeric segments only —
 * sufficient for the >= 11.15.0 gate).
 *
 * @param {string} actual observed npm version
 * @param {string} minimum required minimum version
 * @returns {boolean} true when actual >= minimum
 */
export function npmVersionSatisfiesMinimum(actual, minimum = MIN_NPM_FOR_TRUST) {
  const parse = (value) =>
    String(value)
      .split('.')
      .map((segment) => Number.parseInt(segment, 10) || 0);
  const a = parse(actual);
  const b = parse(minimum);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left > right;
  }
  return true;
}
