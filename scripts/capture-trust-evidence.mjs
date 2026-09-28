#!/usr/bin/env node
/**
 * CAPTURE TRUST EVIDENCE (operator ceremony; read-only against npm).
 *
 * Produces the schema-bound, freshness-bounded, set-pinned evidence
 * artifact that `verify-trust-preflight.mjs --evidence` (and therefore
 * every publication path) accepts — see scripts/lib/trust-evidence.mjs.
 *
 * WHY THIS EXISTS: `npm trust list` is authentication-gated (E401
 * without a session) and GitHub Actions holds no npm session under the
 * frozen no-secret policy (contract §4). The ONLY pre-write proof
 * channel is the authenticated operator capturing the OFFICIAL
 * read-only command output during the release window. The artifact
 * records, for each of the 14 frozen members:
 *   - registry presence (read-only packument probe),
 *   - the exact command run (`npm trust list <name> --json`),
 *   - its exit code,
 *   - the sha256 of the raw official output,
 *   - the classified trust status,
 * and binds the whole artifact to the CURRENT coherent version and the
 * CURRENT content-derived release-set identity. A stale artifact (from
 * another version or set) is dead on arrival.
 *
 * HONEST LIMIT: the artifact binds the capture to the set/version/time;
 * the integrity of the captured output rests on the operator ceremony —
 * the same §13 trust model under which every historical package was
 * published. Run this ONLY from an authenticated, trusted environment.
 *
 * The script performs READ-ONLY npm calls (`npm view`, `npm trust
 * list`) and writes ONE local artifact file. It never publishes,
 * configures, or revokes anything.
 *
 * Usage (requires an authenticated npm session):
 *   node scripts/capture-trust-evidence.mjs --out trust-evidence.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRUST_EVIDENCE_SCHEMA } from './lib/trust-evidence.mjs';
import {
  releaseSetIdentityAt,
  spawnTrustList,
  classifyTrustListOutput,
} from './lib/publication-preflight.mjs';
import { resolveNpmLauncher } from './lib/npm-launcher.mjs';
import { fetchPackument } from './lib/registry-probe.mjs';
import {
  REGISTRY_ABSENT,
  REGISTRY_PRESENT,
  TRUST_CONFLICTING,
  TRUST_EXACT,
  TRUST_MISSING,
  TRUST_UNVERIFIABLE,
} from './lib/trust-preflight.mjs';
import { sanitize } from './lib/trust-config.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function fail(message) {
  console.error(`capture-trust-evidence: BLOCKED — ${sanitize(message)}`);
  process.exit(1);
}

const outIndex = process.argv.indexOf('--out');
const outPath = outIndex !== -1 ? process.argv[outIndex + 1] : undefined;
if (outPath === undefined || outPath.length === 0) {
  fail('--out <file> is required (the artifact is written to a LOCAL file only).');
}

// 1. Inventory + identity binding.
const { inventory, identity } = releaseSetIdentityAt(repoRoot);
console.log(
  `capture-trust-evidence: release set ${inventory.order.length} member(s) at ${inventory.version}; identity ${identity}`,
);

// 2. An npm launcher able to run the official `npm trust list`.
let launcher;
try {
  launcher = resolveNpmLauncher();
  console.log(`capture-trust-evidence: npm launcher — ${launcher.description}`);
} catch (error) {
  fail(`no qualifying npm launcher: ${error.message}`);
}

// 3. Per-member capture (read-only). Anything unprovable is recorded
//    truthfully as unverifiable — the preflight, not this script,
//    decides whether that blocks publication.
const members = {};
let unverifiable = 0;
for (const name of inventory.order) {
  let registry;
  let versionCount = 0;
  try {
    const packument = fetchPackument(name);
    versionCount = Object.keys(packument.versions ?? {}).length;
    registry = versionCount > 0 ? REGISTRY_PRESENT : REGISTRY_ABSENT;
  } catch (error) {
    fail(
      `registry probe failed for ${name}: ${error.message} — capture only from a working environment.`,
    );
  }

  const command = `npm trust list ${name} --json`;
  const result = spawnTrustList(launcher, name);
  let trust;
  let exitCode;
  let rawOutputSha256;
  if (result.kind === 'ok') {
    exitCode = 0;
    const raw = result.stdout ?? '';
    rawOutputSha256 = createHash('sha256').update(raw).digest('hex');
    const classified = classifyTrustListOutput(raw);
    if (classified.error !== undefined) {
      trust = TRUST_UNVERIFIABLE;
    } else if (classified.conflicting.length > 0) {
      trust = TRUST_CONFLICTING;
    } else if (classified.exact.length > 0) {
      trust = TRUST_EXACT;
    } else {
      trust = TRUST_MISSING;
    }
  } else {
    exitCode = result.kind === 'auth' ? 1 : 1;
    trust = TRUST_UNVERIFIABLE;
    rawOutputSha256 = createHash('sha256')
      .update(result.message ?? 'unavailable')
      .digest('hex');
    unverifiable += 1;
  }
  members[name] = { registry, versionCount, command, exitCode, rawOutputSha256, trust };
  console.log(`  ${name}: ${registry} (${versionCount} version(s)); trust ${command} → ${trust}`);
}

// 4. Assemble the bound artifact (local file only).
const artifact = {
  schema: TRUST_EVIDENCE_SCHEMA,
  generatedAt: new Date().toISOString(),
  version: inventory.version,
  setIdentity: identity,
  command:
    'npm trust list <name> --json (per member; captured by scripts/capture-trust-evidence.mjs)',
  members,
};
const target = resolve(outPath);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  `capture-trust-evidence: artifact written to ${target} (${Object.keys(members).length} members; ${unverifiable} unverifiable).`,
);
if (unverifiable > 0) {
  console.log(
    'capture-trust-evidence: NOTE — unverifiable members BLOCK publication. Re-run authenticated (npm login) so every `npm trust list` succeeds.',
  );
}
