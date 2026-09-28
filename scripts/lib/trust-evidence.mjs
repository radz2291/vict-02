/**
 * Owner-operator TRUST EVIDENCE for the trust preflight (contract §11/§12
 * + the §16 release-readiness corrections, r4).
 *
 * THE PROBLEM THIS SOLVES: `npm trust list` is authentication-gated
 * (E401 without a session — observed), and GitHub Actions cannot hold an
 * npm session under the frozen no-secret policy (§4). The ONLY
 * pre-write proof channel is a recorded operator artifact: the output of
 * the OFFICIAL read-only command, captured by the authenticated operator
 * during the release window. An arbitrary or stale JSON file must never
 * authorize publication, so the artifact is VALIDATED and BOUND:
 *
 *   1. exact schema marker (`vict-trust-preflight-evidence/1`);
 *   2. freshness: `generatedAt` within the max age of the check time
 *      (and not from the future beyond clock skew);
 *   3. set binding: `version` equals the CURRENT coherent manifest
 *      version and `setIdentity` equals the CURRENT content-derived
 *      release-set identity (a file from any other set/version is dead);
 *   4. member binding: exactly the 14 frozen members, no more, no less;
 *   5. per-member binding: the recorded command must be the official
 *      `npm trust list <name> --json` invocation for THAT member, with
 *      its exit code and the sha256 of the raw official output.
 *
 * HONEST LIMIT (recorded for the owner): this binds the artifact to the
 * set, the version, and the time window — the INTEGRITY of the captured
 * output itself rests on the operator ceremony, which is exactly the
 * §13 trust model under which every historical package was published.
 * GitHub cannot independently verify trust pre-write under the frozen
 * no-secret policy; publication from CI stays blocked until the owner
 * either accepts the operator-evidence ceremony for CI or amends the
 * policy (see docs/RELEASE-READINESS-CORRECTIONS-R4-2026-09-27.md).
 *
 * Pure functions only; no network access.
 */

import { FROZEN_PUBLISH_ORDER } from './release-set.mjs';
import { sanitize } from './trust-config.mjs';
import {
  REGISTRY_ABSENT,
  REGISTRY_PRESENT,
  TRUST_CONFLICTING,
  TRUST_EXACT,
  TRUST_MISSING,
  TRUST_UNVERIFIABLE,
} from './trust-preflight.mjs';

/** Exact schema marker a trust-evidence artifact must carry. */
export const TRUST_EVIDENCE_SCHEMA = 'vict-trust-preflight-evidence/1';

/** Maximum age of a trust-evidence artifact at validation time. */
export const TRUST_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Tolerance for future-dated `generatedAt` (clock skew). */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const REGISTRY_VALUES = new Set([REGISTRY_PRESENT, REGISTRY_ABSENT]);
const TRUST_VALUES = new Set([TRUST_EXACT, TRUST_MISSING, TRUST_CONFLICTING, TRUST_UNVERIFIABLE]);

/**
 * Validate a trust-evidence artifact against the CURRENT release set.
 *
 * @param {string} rawText the artifact file content
 * @param {{expectedVersion: string, expectedIdentity: string,
 *          now?: Date, maxAgeMs?: number}} binding
 * @returns {{ok: boolean, problems: string[], evidence?: object}}
 */
export function validateTrustEvidence(rawText, binding) {
  const problems = [];
  const now = binding.now ?? new Date();
  const maxAgeMs = binding.maxAgeMs ?? TRUST_EVIDENCE_MAX_AGE_MS;

  let parsed;
  try {
    parsed = JSON.parse(sanitize(String(rawText ?? '')));
  } catch (error) {
    return { ok: false, problems: [`evidence file is not valid JSON: ${error.message}`] };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, problems: ['evidence file must be a JSON object.'] };
  }

  if (parsed.schema !== TRUST_EVIDENCE_SCHEMA) {
    problems.push(
      `evidence schema mismatch: expected "${TRUST_EVIDENCE_SCHEMA}", got ${JSON.stringify(parsed.schema ?? null)} — an arbitrary or older-format evidence file never authorizes publication.`,
    );
  }

  const generatedAt =
    typeof parsed.generatedAt === 'string' ? Date.parse(parsed.generatedAt) : Number.NaN;
  if (Number.isNaN(generatedAt)) {
    problems.push('evidence "generatedAt" is missing or not an ISO-8601 timestamp.');
  } else {
    const age = now.getTime() - generatedAt;
    if (age < -MAX_FUTURE_SKEW_MS) {
      problems.push('evidence "generatedAt" is in the future beyond clock-skew tolerance.');
    } else if (age > maxAgeMs) {
      problems.push(
        `evidence is STALE: generatedAt is ${Math.round(age / 60_000)} minutes old (max ${Math.round(maxAgeMs / 60_000)} minutes) — capture fresh evidence during the release window.`,
      );
    }
  }

  if (parsed.version !== binding.expectedVersion) {
    problems.push(
      `evidence is bound to version ${JSON.stringify(parsed.version ?? null)}, but the current release set is ${binding.expectedVersion} — a stale artifact never authorizes publication.`,
    );
  }
  if (parsed.setIdentity !== binding.expectedIdentity) {
    problems.push(
      `evidence is bound to release-set identity ${JSON.stringify(parsed.setIdentity ?? null)}, but the current manifests derive ${binding.expectedIdentity} — a foreign-set artifact never authorizes publication.`,
    );
  }

  const members = parsed.members;
  if (members === null || typeof members !== 'object' || Array.isArray(members)) {
    problems.push('evidence "members" must be an object keyed by package name.');
  } else {
    const expectedNames = [...FROZEN_PUBLISH_ORDER];
    for (const name of expectedNames) {
      const entry = members[name];
      if (entry === undefined) {
        problems.push(
          `evidence is missing member '${name}' — partial evidence never authorizes publication.`,
        );
        continue;
      }
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        problems.push(`evidence member '${name}' must be an object.`);
        continue;
      }
      if (!REGISTRY_VALUES.has(entry.registry)) {
        problems.push(
          `evidence member '${name}' has registry status ${JSON.stringify(entry.registry ?? null)} (expected '${REGISTRY_PRESENT}' or '${REGISTRY_ABSENT}').`,
        );
      }
      if (!TRUST_VALUES.has(entry.trust)) {
        problems.push(
          `evidence member '${name}' has trust status ${JSON.stringify(entry.trust ?? null)} (expected one of: exact, missing, conflicting, unverifiable).`,
        );
      }
      if (
        typeof entry.command !== 'string' ||
        !entry.command.includes('trust list') ||
        !entry.command.includes(name)
      ) {
        problems.push(
          `evidence member '${name}' does not record the official 'npm trust list ${name} --json' command — unbound commands are not evidence.`,
        );
      }
      if (!Number.isInteger(entry.exitCode)) {
        problems.push(`evidence member '${name}' is missing the recorded command exit code.`);
      }
      if (
        typeof entry.rawOutputSha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(entry.rawOutputSha256)
      ) {
        problems.push(
          `evidence member '${name}' is missing the sha256 of the raw official output (64-hex) — unbound output is not evidence.`,
        );
      }
    }
    for (const name of Object.keys(members)) {
      if (!expectedNames.includes(name)) {
        problems.push(
          `evidence contains non-member '${name}' — refusing to decide on a foreign set.`,
        );
      }
    }
  }

  return { ok: problems.length === 0, problems, evidence: parsed };
}

/**
 * Map a validated evidence artifact to the member shape the trust
 * preflight assesses (registry + trust per frozen member).
 */
export function membersFromTrustEvidence(evidence) {
  return FROZEN_PUBLISH_ORDER.map((name) => ({
    name,
    registry: evidence.members[name].registry,
    trust: evidence.members[name].trust,
  }));
}
