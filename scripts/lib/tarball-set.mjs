/**
 * Canonical packed-tarball identity resolution for VICT release
 * verification.
 *
 * Extracted from scripts/verify-stage4.mjs (Phase F4 release-gate repair,
 * F3 finding MD-1) so the identity rules carry permanent regression
 * coverage. The historical verifier located packed tarballs with stale
 * pre-migration name matchers ('vict-sdk', 'vict-application',
 * 'vict-contracts') that never match the canonical `@victframework/*`
 * tarball names emitted since the namespace migration, and then
 * dereferenced the unmatched `undefined` results. Identity is now decided
 * by the package metadata INSIDE each tarball, matched against the exact
 * expected identities (derived from the workspace manifests), under the
 * canonical npm-pack filename rule.
 *
 * npm pack names a tarball after the manifest identity:
 *
 *   @victframework/sdk@0.2.0 -> victframework-sdk-0.2.0.tgz
 */

/**
 * The canonical npm-pack filename for a package identity.
 *
 * @param {string} name package name (scoped or unscoped)
 * @param {string} version exact version
 * @returns {string} canonical tarball filename
 */
export function canonicalTarballName(name, version) {
  const packedName = name.startsWith('@') ? name.slice(1).replace('/', '-') : name;
  return `${packedName}-${version}.tgz`;
}

/**
 * Match the packed tarballs found in a pack directory against the exact
 * expected package identities.
 *
 * Identity is read from each tarball's own package metadata (never trusted
 * from the filename alone). Every expected identity must be matched by
 * EXACTLY ONE tarball whose metadata equals the expected name AND version
 * and whose filename is the canonical npm-pack name. Missing tarballs,
 * duplicates, extraneous packages, misnamed files, wrong versions,
 * substitutions, and unreadable tarballs all produce stable diagnostic
 * strings — never an undefined dereference.
 *
 * @param {Array<{name: string, version: string}>} expected the exact
 *        expected package identities
 * @param {Array<{fileName: string, name?: string, version?: string,
 *        error?: string}>} found metadata read from each tarball in the
 *        pack directory (an `error` entry records an unreadable tarball)
 * @returns {{ok: boolean, byName: Map<string, {fileName: string, name:
 *          string, version: string}>, problems: string[]}} the resolution
 *          result; `ok` is true only when every check passed
 */
export function matchTarballSet(expected, found) {
  const problems = [];

  const expectedNames = new Set(expected.map((entry) => entry.name));
  const byName = new Map();

  // 1. Every found tarball must carry parseable identity metadata and name
  //    a package that belongs to the expected set at all.
  for (const entry of found) {
    if (typeof entry.error === 'string') {
      problems.push(`${entry.fileName}: unreadable tarball metadata (${entry.error})`);
      continue;
    }
    if (typeof entry.name !== 'string' || typeof entry.version !== 'string') {
      problems.push(`${entry.fileName}: tarball metadata has no name/version`);
      continue;
    }
    if (!expectedNames.has(entry.name)) {
      problems.push(
        `${entry.fileName}: tarball is ${entry.name}@${entry.version}, which is not part of the expected package set`,
      );
    }
  }

  // 2. Each expected identity must be matched by at most one tarball.
  for (const entry of found) {
    if (typeof entry.error === 'string' || !expectedNames.has(entry.name)) {
      continue;
    }
    const previous = byName.get(entry.name);
    if (previous !== undefined) {
      problems.push(
        `${entry.fileName}: duplicate tarball for ${entry.name} (already matched ${previous.fileName})`,
      );
      continue;
    }
    byName.set(
      entry.name,
      /** @type {{fileName: string, name: string, version: string}} */ (entry),
    );
  }

  // 3. Every expected identity must be matched exactly once, with the
  //    exact version and the canonical filename.
  for (const want of expected) {
    const entry = byName.get(want.name);
    if (entry === undefined) {
      problems.push(`no packed tarball found for ${want.name}@${want.version}`);
      continue;
    }
    if (entry.version !== want.version) {
      problems.push(
        `${entry.fileName}: expected ${want.name}@${want.version} but the tarball contains ${entry.name}@${entry.version}`,
      );
    }
    const canonical = canonicalTarballName(want.name, want.version);
    if (entry.fileName !== canonical) {
      problems.push(
        `${entry.fileName}: tarball filename is not canonical for ${want.name}@${want.version} (expected ${canonical})`,
      );
    }
  }

  return { ok: problems.length === 0, byName, problems };
}
