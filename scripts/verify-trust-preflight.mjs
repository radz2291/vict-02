#!/usr/bin/env node
/**
 * Read-only TRUST PREFLIGHT for the coordinated release set (contract
 * §11/§12 + the §16 first-publication bootstrap exception).
 *
 * For every one of the 14 release-set members, in the frozen
 * publication order, it proves — read-only — that the member
 *   (a) EXISTS in the public registry (npm's trusted-publisher
 *       configuration is a per-package setting on an EXISTING package;
 *       an absent member cannot be trusted, so it cannot publish), and
 *   (b) carries the EXACT frozen trust relationship
 *       (github radz2291/vict-02 / release.yml / --allow-publish /
 *       no environment), verified through the official
 *       `npm trust list <pkg> --json` interface.
 *
 * THE SET-WIDE RULE: unless EVERY member passes (a) AND (b), publishing
 * ANY member is refused. There is no "publish the ready subset" — that
 * would partially publish the coordinated set.
 *
 * The script is READ-ONLY: it never configures, revokes, publishes, or
 * otherwise mutates anything. Trust verification is authentication-
 * gated (contract §13): without an authenticated npm session the status
 * is reported as `unverifiable` (a blocker — absence of proof is never a
 * pass), unless `--evidence <file>` supplies the recorded JSON output of
 * the official `npm trust list <name> --json` command per member (the
 * artifact is non-sensitive; token-shaped material is sanitized on
 * load).
 *
 * Outcome stages:
 *   authorized                    — all 14 present + exact: publish allowed
 *   first-publication-bootstrap   — some members ABSENT: run the
 *                                   owner-authorized bootstrap
 *                                   (scripts/first-publish-bootstrap.mjs)
 *                                   before trust configuration
 *   trust-bootstrap               — all present, trust incomplete: run
 *                                   scripts/trust-bootstrap.mjs --execute
 *   blocked                       — conflicting relationships (never
 *                                   auto-replaced) or unreachable registry
 *
 * Exit codes: 0 = authorized; 1 = refused (whole set). No writes.
 *
 * Usage:
 *   node scripts/verify-trust-preflight.mjs
 *   node scripts/verify-trust-preflight.mjs --evidence trust-evidence.json
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessTrustPreflight,
  BOOTSTRAP_PLACEHOLDER_TAG,
  BOOTSTRAP_PLACEHOLDER_VERSION,
  publicationBlockedReason,
  REGISTRY_ABSENT,
  REGISTRY_PRESENT,
  REGISTRY_UNREACHABLE,
  TRUST_CONFLICTING,
  TRUST_EXACT,
  TRUST_MISSING,
  TRUST_UNVERIFIABLE,
} from './lib/trust-preflight.mjs';
import { fetchPackument } from './lib/registry-probe.mjs';
import { resolveNpmLauncher } from './lib/npm-launcher.mjs';
import { classifyRelationships, sanitize } from './lib/trust-config.mjs';
import { deriveReleaseInventory, FROZEN_PUBLISH_ORDER } from './lib/release-set.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const DELAY_MS = 2000;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const evidenceIndex = process.argv.indexOf('--evidence');
let evidence = {};
if (evidenceIndex !== -1) {
  const evidencePath = process.argv[evidenceIndex + 1];
  if (evidencePath === undefined) fail('verify-trust-preflight: --evidence requires a file path.');
  let parsed;
  try {
    parsed = JSON.parse(sanitize(readFileSync(resolve(evidencePath), 'utf8')));
  } catch (error) {
    fail(
      `verify-trust-preflight: the evidence file is unreadable or invalid JSON: ${error.message}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('verify-trust-preflight: the evidence file must be a JSON object keyed by package name.');
  }
  evidence = parsed;
  console.log(
    `verify-trust-preflight: recorded official-command evidence loaded for ${Object.keys(evidence).length} member(s)`,
  );
}

// 1. Frozen inventory (the assessed set is exactly the release set).
const inventory = deriveReleaseInventory(repoRoot);
if (inventory.problems.length > 0) {
  fail(
    `verify-trust-preflight: release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`,
  );
}
if (inventory.order.join('\n') !== FROZEN_PUBLISH_ORDER.join('\n')) {
  fail(
    'verify-trust-preflight: derived inventory order does not equal the frozen publication order.',
  );
}

// 2. Registry existence per member (read-only).
const members = [];
for (const name of inventory.order) {
  let registry;
  try {
    const packument = fetchPackument(name);
    const versionCount = Object.keys(packument.versions ?? {}).length;
    registry = versionCount > 0 ? REGISTRY_PRESENT : REGISTRY_ABSENT;
    if (registry === REGISTRY_PRESENT) {
      console.log(`  ${name}: present in the registry (${versionCount} version(s))`);
    } else {
      console.log(`  ${name}: ABSENT from the registry (no presence at any version)`);
    }
  } catch (error) {
    registry = REGISTRY_UNREACHABLE;
    console.log(`  ${name}: registry probe failed (${error.message})`);
  }
  members.push({ name, registry, trust: undefined });
}

// 3. Trust relationship per member: recorded evidence first, else the
//    live official command (read-only `npm trust list <name> --json`).
const liveNames = members
  .filter((member) => evidence[member.name] === undefined)
  .map((m) => m.name);
let launcher;
if (liveNames.length > 0) {
  try {
    launcher = resolveNpmLauncher();
    console.log(`verify-trust-preflight: npm launcher — ${launcher.description}`);
  } catch (error) {
    for (const member of members) {
      if (evidence[member.name] === undefined) member.trust = TRUST_UNVERIFIABLE;
    }
    console.log(
      `verify-trust-preflight: no qualifying npm launcher (${error.message}); affected members are UNVERIFIABLE.`,
    );
  }
}

function classifyTrustListOutput(rawOutput) {
  let parsed;
  try {
    parsed = JSON.parse(rawOutput || '{}');
  } catch {
    return { error: 'unparseable npm trust list output; inspect manually.' };
  }
  const entries = [];
  const collect = (value) => {
    if (Array.isArray(value)) {
      for (const entry of value) collect(entry);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const hasTarget =
      'repository' in value || 'repo' in value || 'workflow' in value || 'file' in value;
    const hasKind = 'provider' in value || 'type' in value || 'tool' in value;
    if (hasTarget && hasKind) entries.push(value);
    for (const child of Object.values(value)) collect(child);
  };
  collect(parsed);
  return classifyRelationships(entries);
}

for (const member of members) {
  if (member.trust !== undefined) continue;
  if (evidence[member.name] !== undefined) {
    const result = classifyTrustListOutput(JSON.stringify(evidence[member.name]));
    member.trust =
      result.error !== undefined
        ? TRUST_UNVERIFIABLE
        : result.exact.length > 0 && result.conflicting.length === 0
          ? TRUST_EXACT
          : result.conflicting.length > 0
            ? TRUST_CONFLICTING
            : TRUST_MISSING;
    console.log(
      `  ${member.name}: trust assessed from RECORDED official-command evidence → ${member.trust}`,
    );
    continue;
  }
  if (launcher === undefined) {
    member.trust = TRUST_UNVERIFIABLE;
    continue;
  }
  const result = spawnTrustList(launcher, member.name);
  if (result.kind === 'auth') {
    member.trust = TRUST_UNVERIFIABLE;
    console.log(
      `  ${member.name}: trust verification is authentication-gated (no npm session) → UNVERIFIABLE`,
    );
    continue;
  }
  if (result.kind === 'error') {
    member.trust = TRUST_UNVERIFIABLE;
    console.log(`  ${member.name}: npm trust list failed → UNVERIFIABLE (${result.message})`);
    continue;
  }
  const classified = classifyTrustListOutput(result.stdout);
  member.trust =
    classified.error !== undefined
      ? TRUST_UNVERIFIABLE
      : classified.exact.length > 0 && classified.conflicting.length === 0
        ? TRUST_EXACT
        : classified.conflicting.length > 0
          ? TRUST_CONFLICTING
          : TRUST_MISSING;
  console.log(`  ${member.name}: live npm trust list → ${member.trust}`);
}

function spawnTrustList(launcherResolved, packageName) {
  const result = spawnSync(
    launcherResolved.command,
    [...launcherResolved.prefix, 'trust', 'list', packageName, '--json'],
    {
      encoding: 'utf8',
      shell: process.platform === 'win32' && launcherResolved.command !== process.execPath,
    },
  );
  const combined = sanitize(`${result.stderr ?? ''}${result.stdout ?? ''}`);
  if (result.status !== 0) {
    if (/EOTP|one-time password|Open this URL/i.test(combined)) return { kind: 'auth' };
    return { kind: 'error', message: `exit ${result.status}: ${combined.slice(0, 200)}` };
  }
  return { kind: 'ok', stdout: sanitize(result.stdout ?? '') };
}

// 4. Set-wide verdict.
const assessment = assessTrustPreflight(members);
console.log('');
if (assessment.authorized) {
  console.log(
    `verify-trust-preflight: AUTHORIZED — all ${inventory.order.length} members exist and carry the exact frozen trust relationship. Publication is not blocked by this gate (the contract authority gate still applies).`,
  );
  process.exit(0);
}
console.error(`verify-trust-preflight: REFUSED — ${publicationBlockedReason(assessment)}`);
for (const problem of assessment.problems) console.error(`  - ${problem}`);
if (assessment.stage === 'first-publication-bootstrap') {
  console.error(
    `Next stage (owner-authorized): scripts/first-publish-bootstrap.mjs — establish registry presence for ${assessment.absent.join(', ')} with placeholder version ${BOOTSTRAP_PLACEHOLDER_VERSION} under the '${BOOTSTRAP_PLACEHOLDER_TAG}' tag (never a coordinated set version), then re-run this preflight.`,
  );
} else if (assessment.stage === 'trust-bootstrap') {
  console.error(
    'Next stage: scripts/trust-bootstrap.mjs --execute (after the contract authority gate is green), then re-run this preflight.',
  );
}
process.exit(1);
