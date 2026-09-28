#!/usr/bin/env node
/**
 * Read-only TRUST PREFLIGHT for the coordinated release set (contract
 * §11/§12 + the §16 first-publication bootstrap exception; r4: this is
 * a MANDATORY publication gate — every publication path runs it).
 *
 * For every one of the 14 release-set members, in the frozen
 * publication order, it proves — read-only — that the member
 *   (a) EXISTS in the public registry (npm's trusted-publisher
 *       configuration is a per-package setting on an EXISTING package;
 *       an absent member cannot be trusted, so it cannot publish), and
 *   (b) carries the EXACT frozen trust relationship
 *       (github radz2291/vict-02 / release.yml / publish / no
 *       environment), credibly verified through the official
 *       `npm trust list <pkg> --json` interface — LIVE (authenticated
 *       operator session) or via a VALIDATED operator-evidence artifact
 *       (schema-bound, freshness-bounded, and pinned to the CURRENT
 *       coherent version + content-derived set identity; an arbitrary
 *       or stale JSON file is refused — see scripts/lib/trust-evidence.mjs).
 *
 * THE SET-WIDE RULE: unless EVERY member passes (a) AND (b), publishing
 * ANY member is refused. There is no "publish the ready subset" — that
 * would partially publish the coordinated set.
 *
 * The script is READ-ONLY: it never configures, revokes, publishes, or
 * otherwise mutates anything. Trust verification is authentication-
 * gated (contract §13): without an authenticated npm session the live
 * status is `unverifiable` (a blocker — absence of proof is never a
 * pass). GitHub Actions holds no npm session under the frozen
 * no-secret policy (§4), so CI publication stays blocked until the
 * owner resolves the trust-proof decision recorded in
 * docs/RELEASE-READINESS-CORRECTIONS-R4-2026-09-27.md.
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
 *                                   auto-replaced), unreachable registry,
 *                                   or a non-credible evidence artifact
 *
 * Exit codes: 0 = authorized; 1 = refused (whole set). No writes.
 *
 * Usage:
 *   node scripts/verify-trust-preflight.mjs
 *   node scripts/verify-trust-preflight.mjs --require-authorized
 *   node scripts/verify-trust-preflight.mjs --require-authorized \
 *        --evidence trust-evidence.json
 *   RELEASE_TRUST_EVIDENCE=<path> node scripts/verify-trust-preflight.mjs \
 *        --require-authorized      (r5: env form — how release.yml passes
 *        the evidence input; an env value can never be word-split by a
 *        shell, unlike a shell-built argument string)
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOTSTRAP_PLACEHOLDER_TAG,
  BOOTSTRAP_PLACEHOLDER_VERSION,
} from './lib/trust-preflight.mjs';
import { assessPublicationPreflight, releaseSetIdentityAt } from './lib/publication-preflight.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const requireAuthorized = process.argv.includes('--require-authorized');
const evidenceIndex = process.argv.indexOf('--evidence');
if (evidenceIndex !== -1 && process.argv[evidenceIndex + 1] === undefined) {
  fail('verify-trust-preflight: --evidence requires a file path.');
}
// r5: the evidence path may arrive as the RELEASE_TRUST_EVIDENCE env var
// (the workflow passes its `trust_evidence_path` input this way to every
// preflight consumer) or as the explicit --evidence flag (flag wins).
const envEvidence = process.env.RELEASE_TRUST_EVIDENCE;
const envEvidencePath =
  typeof envEvidence === 'string' && envEvidence.trim() !== '' ? envEvidence.trim() : undefined;
const evidencePath = evidenceIndex !== -1 ? process.argv[evidenceIndex + 1] : envEvidencePath;

// Identity banner: the artifact (or live probe) is bound to THIS set.
try {
  const { identity, inventory } = releaseSetIdentityAt(repoRoot);
  console.log(
    `verify-trust-preflight: release set ${inventory.order.length} member(s) at ${inventory.version}; content-derived identity ${identity}`,
  );
} catch (error) {
  fail(`verify-trust-preflight: ${error.message}`);
}

if (requireAuthorized) {
  console.log(
    'verify-trust-preflight: MANDATORY publication gate — only a set-wide AUTHORIZED verdict permits publication (contract authority gate still applies).',
  );
}

const verdict = assessPublicationPreflight({
  repoRoot,
  evidencePath,
  log: (line) => console.log(line),
});
const assessment = verdict.assessment;

console.log('');
if (verdict.authorized) {
  console.log(
    `verify-trust-preflight: AUTHORIZED — all 14 members exist and carry the exact frozen trust relationship (mode: ${verdict.mode}). Publication is not blocked by this gate (the contract authority gate still applies).`,
  );
  process.exit(0);
}

console.error(`verify-trust-preflight: REFUSED — ${verdict.blockedReason}`);
for (const problem of verdict.problems) console.error(`  - ${problem}`);
if (assessment.stage === 'first-publication-bootstrap') {
  console.error(
    `Next stage (owner-authorized): scripts/first-publish-bootstrap.mjs — establish registry presence for ${assessment.absent.join(', ')} with placeholder version ${BOOTSTRAP_PLACEHOLDER_VERSION} under the '${BOOTSTRAP_PLACEHOLDER_TAG}' tag (never a coordinated set version), then re-run this preflight.`,
  );
} else if (assessment.stage === 'trust-bootstrap') {
  console.error(
    'Next stage: scripts/trust-bootstrap.mjs --execute (after the contract authority gate is green), then re-run this preflight.',
  );
} else if (verdict.mode === 'evidence' && verdict.stage === 'blocked') {
  console.error(
    'Next stage: capture a FRESH evidence artifact with scripts/capture-trust-evidence.mjs while authenticated (operator ceremony), or verify live with an npm session.',
  );
}
process.exit(1);
