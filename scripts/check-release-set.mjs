#!/usr/bin/env node
/**
 * Stage 07A — immutable compatible release-set consistency check
 * (handoff work item 4).
 *
 * Derives the release set from the ACTUAL publishable manifests and proves
 * it equals the RECORDED release set in `docs/RELEASE-COMPATIBILITY.md`:
 *
 *   1. the publishable inventory is exactly the recorded 13-package set;
 *   2. every member carries the ONE coherent release-set version;
 *   3. every internal `@victframework/*` dependency is an EXACT pin of the
 *      same release-set version — no ranges, no `workspace:`/`file:`/`git`
 *      references in any published manifest;
 *   4. the content-derived set identity (SHA-256 over the sorted
 *      `name@version` list, prefixed `v1_`) matches the recorded identity;
 *   5. every published manifest is publishable: no `private`, public
 *      access configured, Apache-2.0 licensed, Node engines declared.
 *
 * A manifest whose internal pins do not match the recorded release set
 * FAILS the release (exit 1). Wiring: `npm run verify:release-set`; part
 * of the Stage 07A verification ladder and the publish script's preflight.
 *
 * Usage: node scripts/check-release-set.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const RELEASE_PACKAGES = [
  'appdata-sqlite',
  'application',
  'cli',
  'contracts',
  'control',
  'kernel',
  'mastra',
  'renderer-svelte',
  'runtime',
  'scaffolder',
  'sdk',
  'server',
  'store-sqlite',
];

let failures = 0;
function check(condition, label) {
  if (condition) {
    console.log(`  ok: ${label}`);
  } else {
    console.error(`  FAIL: ${label}`);
    failures += 1;
  }
}

// ---- Derive the set from the actual manifests ------------------------------
const manifests = new Map();
for (const name of RELEASE_PACKAGES) {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, 'packages', name, 'package.json'), 'utf8'),
  );
  manifests.set(manifest.name, manifest);
}

const versions = new Set([...manifests.values()].map((m) => m.version));
check(
  versions.size === 1,
  `one coherent release-set version across the set (${[...versions].join(', ') || 'none'})`,
);
const releaseVersion = [...versions][0];

// Internal exact pins.
const INTERNAL_PREFIX = '@victframework/';
const FORBIDDEN_SPECIFIERS = /^(:?workspace:|file:|link:|git(?:\+[^:]+:)?\/\/)/;
let pinViolations = 0;
for (const [name, manifest] of manifests) {
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dep, spec] of Object.entries(manifest[section] ?? {})) {
      if (!dep.startsWith(INTERNAL_PREFIX)) {
        if (FORBIDDEN_SPECIFIERS.test(spec)) {
          console.error(
            `  FAIL: ${name} external dependency ${dep} uses a forbidden specifier '${spec}'`,
          );
          failures += 1;
        }
        continue;
      }
      if (spec !== releaseVersion) {
        console.error(
          `  FAIL: ${name} -> ${dep} pinned '${spec}' (release set is '${releaseVersion}')`,
        );
        pinViolations += 1;
      }
      if (!manifests.has(dep)) {
        console.error(`  FAIL: ${name} -> ${dep} is not a member of the release set`);
        pinViolations += 1;
      }
    }
  }
}
check(pinViolations === 0, 'all internal dependencies are exact pins of the release-set version');
check(
  [...manifests.values()].every((m) =>
    m.devDependencies
      ? Object.keys(m.devDependencies).every(
          (d) => !FORBIDDEN_SPECIFIERS.test(m.devDependencies[d]),
        )
      : true,
  ),
  'no forbidden specifiers in devDependencies',
);

// Publishability of every member.
const publishability = [...manifests.values()].map((m) => {
  const problems = [];
  if (m.private) problems.push('private:true');
  if (m.publishConfig?.access !== 'public') problems.push('publishConfig.access != public');
  if (m.license !== 'Apache-2.0') problems.push(`license '${m.license}'`);
  if (!m.engines?.node) problems.push('no engines.node');
  if (!m.files?.length) problems.push('no files');
  if (!m.exports) problems.push('no exports');
  return { name: m.name, problems };
});
for (const { name, problems } of publishability) {
  check(
    problems.length === 0,
    `${name} publishable (public access, Apache-2.0, engines, files, exports)${problems.length ? ` — ${problems.join('; ')}` : ''}`,
  );
}

// Content-derived set identity.
const canonicalList = [...manifests.entries()]
  .map(([name, m]) => `${name}@${m.version}`)
  .sort()
  .join('\n');
const contentId = `v1_${createHash('sha256').update(canonicalList, 'utf8').digest('hex')}`;

// ---- Recorded set (machine-readable block in the compatibility document) ----
const docPath = join(repoRoot, 'docs', 'RELEASE-COMPATIBILITY.md');
const doc = readFileSync(docPath, 'utf8');
const blockMatch = doc.match(/```json\s*(\{[\s\S]*?"vict-release-set"[\s\S]*?\})\s*```/);
check(
  blockMatch !== null,
  'RELEASE-COMPATIBILITY.md carries the machine-readable release-set record',
);
if (blockMatch) {
  let recorded;
  try {
    recorded = JSON.parse(blockMatch[1])['vict-release-set'];
  } catch (error) {
    console.error(`  FAIL: release-set record is not valid JSON (${error.message})`);
    failures += 1;
    recorded = undefined;
  }
  if (recorded) {
    check(
      recorded.identity === `vict-release-set@1/${releaseVersion}`,
      `recorded identity matches vict-release-set@1/${releaseVersion}`,
    );
    check(
      recorded.contentId === contentId,
      `recorded content-derived identity matches (${contentId.slice(0, 18)}…)`,
    );
    const recordedPackages = recorded.packages ?? {};
    const actualPackages = Object.fromEntries(
      [...manifests.entries()].map(([name, m]) => [name, m.version]),
    );
    check(
      JSON.stringify(recordedPackages) === JSON.stringify(actualPackages),
      'recorded package/version list matches the manifests exactly',
    );
    check(
      recorded.registry === 'https://registry.npmjs.org/' && recorded.access === 'public',
      'recorded registry identity is the public npm registry with public access',
    );
  }
}

if (failures > 0) {
  console.error(
    `\nverify:release-set: ${failures} check(s) FAILED — the release set is NOT consistent`,
  );
  process.exit(1);
}
console.log(
  `\nverify:release-set: ALL CHECKS PASSED — ${manifests.size} packages, ${releaseVersion}, ${contentId.slice(0, 18)}…`,
);
