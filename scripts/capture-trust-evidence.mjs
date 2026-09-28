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
 * frozen no-secret policy (contract §4). The ONLY pre-write trust-proof
 * channel is the authenticated operator capturing the OFFICIAL
 * read-only command output during the release window. The artifact
 * (schema v2) records, for each of the 14 frozen members, one RESULT:
 *   - registry presence + version count (read-only packument probe),
 *   - the EXACT official command (`npm trust list <name> --json`),
 *   - its exit code (only successful captures can ever authorize),
 *   - the RETAINED non-sensitive captured output (rawOutput),
 *   - the sha256 of that output (RECOMPUTED by the validator — the
 *     artifact cannot claim a hash over output it does not retain),
 *   - the trust status CLASSIFIED FROM THAT OUTPUT (never self-asserted
 *     without proof — the validator reclassifies and compares).
 * and binds the whole artifact to the CURRENT coherent version and the
 * CURRENT content-derived release-set identity. A stale artifact (from
 * another version or set) is dead on arrival.
 *
 * HONEST LIMIT: the artifact binds the capture to the set/version/time;
 * the integrity of the captured output rests on the operator ceremony —
 * the same §13 trust model under which every historical package was
 * published. The hash and timestamp do NOT authenticate the creator;
 * there is no independent signature. Run this ONLY from an
 * authenticated, trusted environment.
 *
 * The script performs READ-ONLY npm calls (`npm view`, `npm trust
 * list`) and writes ONE local artifact file. It never publishes,
 * configures, or revokes anything.
 *
 * Usage (requires an authenticated npm session):
 *   node scripts/capture-trust-evidence.mjs --out trust-evidence.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRUST_EVIDENCE_SCHEMA,
  officialTrustListCommand,
  rawOutputSha256Of,
} from './lib/trust-evidence.mjs';
import { releaseSetIdentityAt, spawnTrustList } from './lib/publication-preflight.mjs';
import { classifyTrustListOutput } from './lib/trust-config.mjs';
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
//    truthfully as a FAILED result (exitCode 1) — such an artifact can
//    never validate (only successful official-command results are
//    evidence); the preflight, not this script, says what blocks.

// npm's tightened 2FA policy gates even read-only `npm trust list`
// behind a recent web authentication (HTTP 401 → EOTP, observed
// 2026-09-28 with npm 11.19.1). Mirror trust-bootstrap's proven
// operator flow: on the OTP challenge, re-run THE SAME official
// command INTERACTIVELY (stdio inherited) so the human completes the
// browser authentication once — npm's five-minute skip then covers the
// remaining members — and repeat the captured read inside the grace
// window so the recorded output still comes from this script's own
// official-command spawn (schema, bindings, and provenance unchanged).
function spawnTrustListWithOtpRetry(name) {
  let result = spawnTrustList(launcher, name);
  if (result.kind !== 'auth') {
    return result;
  }
  console.log(
    `  ${name}: npm requires a 2FA pass — complete the browser authentication for the interactive re-run below (npm's five-minute skip then covers the remaining members)...`,
  );
  const interactive = spawnSync(
    launcher.command,
    [...launcher.prefix, 'trust', 'list', name, '--json'],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32' && launcher.command !== process.execPath,
    },
  );
  if (interactive.status !== 0) {
    return {
      kind: 'error',
      message: `exit ${interactive.status} after the interactive 2FA pass`,
    };
  }
  return spawnTrustList(launcher, name);
}

const results = [];
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

  const command = officialTrustListCommand(name);
  const result = spawnTrustListWithOtpRetry(name);
  let exitCode;
  let rawOutput;
  let rawOutputSha256;
  let trust;
  if (result.kind === 'ok') {
    exitCode = 0;
    rawOutput = result.stdout ?? '';
    rawOutputSha256 = rawOutputSha256Of(rawOutput);
    const classified = classifyTrustListOutput(rawOutput);
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
    exitCode = 1;
    rawOutput = result.message ?? 'unavailable';
    rawOutputSha256 = rawOutputSha256Of(rawOutput);
    trust = TRUST_UNVERIFIABLE;
    unverifiable += 1;
  }
  results.push({
    name,
    registry,
    versionCount,
    command,
    exitCode,
    rawOutput,
    rawOutputSha256,
    trust,
  });
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
  results,
};
const target = resolve(outPath);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  `capture-trust-evidence: artifact written to ${target} (${results.length} member results; ${unverifiable} unverifiable).`,
);
if (unverifiable > 0) {
  console.log(
    'capture-trust-evidence: NOTE — this artifact records FAILED captures and will be REFUSED by the preflight (only successful official-command results are evidence). Re-run authenticated (npm login) so every `npm trust list` succeeds.',
  );
}
