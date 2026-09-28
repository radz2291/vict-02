/**
 * Owner-operator TRUST EVIDENCE for the trust preflight (contract §11/§12
 * + the §16 release-readiness corrections, r5 revision of the r4
 * artifact).
 *
 * THE PROBLEM THIS SOLVES: `npm trust list` is authentication-gated
 * (E401 without a session — observed), and GitHub Actions cannot hold an
 * npm session under the frozen no-secret policy (§4). The only pre-write
 * trust-proof channel in CI is a recorded operator artifact: the output
 * of the OFFICIAL read-only command, captured by the authenticated
 * operator during the release window. An arbitrary, stale, or
 * SELF-ASSERTING JSON file must never authorize publication, so the
 * artifact (schema v2) is VALIDATED and BOUND:
 *
 *   1. exact schema marker (`vict-trust-preflight-evidence/2` — v1
 *      artifacts recorded only a FORMAT-checked output hash with no
 *      captured output to recompute it from, and are refused);
 *   2. freshness: `generatedAt` within the max age of the check time
 *      (and not from the future beyond clock skew);
 *   3. set binding: `version` equals the CURRENT coherent manifest
 *      version and `setIdentity` equals the CURRENT content-derived
 *      release-set identity (a file from any other set/version is dead);
 *   4. RESULT binding, per recorded result:
 *      - the result names EXACTLY one frozen member (foreign-set,
 *        missing, and DUPLICATE results are refused);
 *      - the recorded command is EXACTLY the official
 *        `npm trust list <name> --json` invocation for THAT member;
 *      - `exitCode` is 0 — only SUCCESSFUL official-command results are
 *        evidence; a failed command is refused, never interpreted;
 *      - the non-sensitive captured output (`rawOutput`) is RETAINED in
 *        the artifact and its sha256 is RECOMPUTED and compared to
 *        `rawOutputSha256` — an invented hash, or output altered after
 *        hashing, is refused;
 *      - the trust relationship is CLASSIFIED FROM THE CAPTURED OUTPUT
 *        itself (the same classifier used for a live run) and the
 *        claimed `trust` status must agree with that classification —
 *        a fabricated `trust: exact` over output that does not carry
 *        the exact frozen relationship is refused.
 *   5. registry presence is NOT trusted from the artifact: the
 *      publication preflight re-probes the live registry at release
 *      time (read-only packument fetch, no npm session needed) and the
 *      LIVE result governs the §11 presence rule.
 *
 * HONEST LIMITS (recorded for the owner, in plain terms):
 *   - This check proves the artifact is INTERNALLY CONSISTENT, bound to
 *     the current set/version, fresh, and that its captured output
 *     CLASSIFIES as the exact frozen relationship. It does NOT prove
 *     who created the artifact or that npm actually produced the
 *     captured output on the operator's machine: a self-consistent hash
 *     and a timestamp authenticate NOTHING about the creator, and the
 *     artifact carries no independent signature or provenance. That
 *     integrity rests on the operator ceremony — exactly the §13 trust
 *     model under which every historical package was published.
 *   - Trust state can change between capture and publication (the
 *     freshness window bounds this to the artifact's max age; it cannot
 *     eliminate it). Registry presence IS re-proven at release time;
 *     trust is not.
 *   - GitHub therefore cannot INDEPENDENTLY verify trust pre-write
 *     under the frozen no-secret policy. CI publication under operator
 *     evidence remains an owner-ratified CEREMONY (the §16.5 owner
 *     decision), not a cryptographic guarantee — the contract-authority
 *     gate stays red until the owner explicitly chooses it. The
 *     concrete owner choices are recorded in
 *     docs/RELEASE-READINESS-CORRECTIONS-R5-2026-09-27.md.
 *
 * Pure functions only; no network access.
 */

import { createHash } from 'node:crypto';
import { FROZEN_PUBLISH_ORDER } from './release-set.mjs';
import { classifyTrustListOutput, sanitize } from './trust-config.mjs';
import {
  REGISTRY_ABSENT,
  REGISTRY_PRESENT,
  TRUST_CONFLICTING,
  TRUST_EXACT,
  TRUST_MISSING,
  TRUST_UNVERIFIABLE,
} from './trust-preflight.mjs';

/** Exact schema marker a trust-evidence artifact must carry (v2: the
 * captured official output is retained and re-verified; v1 claimed a
 * hash over output it did not retain and is refused). */
export const TRUST_EVIDENCE_SCHEMA = 'vict-trust-preflight-evidence/2';

/** The schema marker of the superseded r4 artifact format. */
export const TRUST_EVIDENCE_SCHEMA_V1 = 'vict-trust-preflight-evidence/1';

/** Maximum age of a trust-evidence artifact at validation time. */
export const TRUST_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Tolerance for future-dated `generatedAt` (clock skew). */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const REGISTRY_VALUES = new Set([REGISTRY_PRESENT, REGISTRY_ABSENT]);
const TRUST_VALUES = new Set([TRUST_EXACT, TRUST_MISSING, TRUST_CONFLICTING, TRUST_UNVERIFIABLE]);

/** The EXACT official command a member's recorded result must carry. */
export function officialTrustListCommand(name) {
  return `npm trust list ${name} --json`;
}

/** Recompute the sha256 a captured raw output must hash to. */
export function rawOutputSha256Of(rawOutput) {
  return createHash('sha256').update(rawOutput, 'utf8').digest('hex');
}

/**
 * Classify a captured raw output the same way a live run classifies it.
 * Returns TRUST_UNVERIFIABLE for unparseable output (never guesses).
 */
export function trustFromCapturedOutput(rawOutput) {
  const classified = classifyTrustListOutput(rawOutput);
  if (classified.error !== undefined) return TRUST_UNVERIFIABLE;
  if (classified.conflicting.length > 0) return TRUST_CONFLICTING;
  if (classified.exact.length > 0) return TRUST_EXACT;
  return TRUST_MISSING;
}

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
      parsed.schema === TRUST_EVIDENCE_SCHEMA_V1
        ? `evidence schema ${TRUST_EVIDENCE_SCHEMA_V1} is superseded and REFUSED: a v1 artifact recorded only a format-checked output hash without retaining the captured output it hashes, so its contents cannot be re-verified — recapture with scripts/capture-trust-evidence.mjs (schema ${TRUST_EVIDENCE_SCHEMA}).`
        : `evidence schema mismatch: expected "${TRUST_EVIDENCE_SCHEMA}", got ${JSON.stringify(parsed.schema ?? null)} — an arbitrary or older-format evidence file never authorizes publication.`,
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

  const results = parsed.results;
  if (!Array.isArray(results) || results.length === 0) {
    problems.push(
      'evidence "results" must be a non-empty array of per-member official-command results.',
    );
  } else {
    const expectedNames = [...FROZEN_PUBLISH_ORDER];
    const seen = new Set();
    for (const result of results) {
      if (result === null || typeof result !== 'object' || Array.isArray(result)) {
        problems.push('every evidence result must be an object.');
        continue;
      }
      const name = result.name;
      if (typeof name !== 'string' || !expectedNames.includes(name)) {
        problems.push(
          `evidence contains a result for ${JSON.stringify(name ?? null)}, which is not a frozen release-set member — refusing to decide on a foreign set.`,
        );
        continue;
      }
      if (seen.has(name)) {
        problems.push(
          `evidence contains DUPLICATE results for '${name}' — exactly one official-command result per member is evidence; conflicting copies are refused.`,
        );
        continue;
      }
      seen.add(name);

      if (result.command !== officialTrustListCommand(name)) {
        problems.push(
          `evidence member '${name}' does not record the EXACT official command '${officialTrustListCommand(name)}' (got ${JSON.stringify(result.command ?? null)}) — unbound or mismatched commands are not evidence.`,
        );
      }
      if (!Number.isInteger(result.exitCode)) {
        problems.push(
          `evidence member '${name}' is missing the recorded command exit code — a result that does not even record its outcome is not evidence.`,
        );
      } else if (result.exitCode !== 0) {
        problems.push(
          `evidence member '${name}' records a FAILED official command (exitCode ${result.exitCode}) — only successful official-command results are evidence; a failed or authentication-gated capture never authorizes publication.`,
        );
      }
      if (!REGISTRY_VALUES.has(result.registry)) {
        problems.push(
          `evidence member '${name}' has registry status ${JSON.stringify(result.registry ?? null)} (expected '${REGISTRY_PRESENT}' or '${REGISTRY_ABSENT}'); the gate re-probes the live registry regardless.`,
        );
      }
      if (!Number.isInteger(result.versionCount) || result.versionCount < 0) {
        problems.push(
          `evidence member '${name}' is missing a valid "versionCount" (non-negative integer) from the release-time packument probe at capture.`,
        );
      }
      if (typeof result.rawOutput !== 'string') {
        problems.push(
          `evidence member '${name}' does not RETAIN the captured raw official output ("rawOutput") — a hash over output nobody can inspect is not evidence. (An EMPTY capture is honest evidence of a MISSING relationship and is accepted as such — it never authorizes publication.)`,
        );
      } else {
        if (
          typeof result.rawOutputSha256 !== 'string' ||
          !/^[0-9a-f]{64}$/.test(result.rawOutputSha256)
        ) {
          problems.push(
            `evidence member '${name}' is missing the sha256 of the raw official output (64-hex).`,
          );
        } else if (rawOutputSha256Of(result.rawOutput) !== result.rawOutputSha256) {
          problems.push(
            `evidence member '${name}' rawOutputSha256 does NOT match the retained captured output (recomputed ${rawOutputSha256Of(result.rawOutput).slice(0, 16)}…) — an invented hash, or output altered after capture, is refused.`,
          );
        }
        const derived = trustFromCapturedOutput(result.rawOutput);
        if (derived === TRUST_UNVERIFIABLE) {
          problems.push(
            `evidence member '${name}' captured output is not parseable official 'npm trust list --json' output — the trust relationship cannot be classified from it.`,
          );
        } else if (!TRUST_VALUES.has(result.trust)) {
          problems.push(
            `evidence member '${name}' has trust status ${JSON.stringify(result.trust ?? null)} (expected one of: exact, missing, conflicting, unverifiable).`,
          );
        } else if (result.trust !== derived) {
          problems.push(
            `evidence member '${name}' CLAIMS trust '${result.trust}', but its own captured output CLASSIFIES as '${derived}' — a fabricated status contradicted by the recorded output is refused.`,
          );
        }
      }
    }
    for (const name of expectedNames) {
      if (!seen.has(name)) {
        problems.push(
          `evidence has no result for release-set member '${name}' — partial evidence never authorizes publication.`,
        );
      }
    }
  }

  return { ok: problems.length === 0, problems, evidence: parsed };
}

/**
 * Map a validated evidence artifact to the member shape the trust
 * preflight assesses. The trust status is CLASSIFIED FROM THE RETAINED
 * CAPTURED OUTPUT (never from the claimed status — the claim was
 * already checked against it during validation, and this mapping
 * refuses to inherit it even if validation were bypassed). The claimed
 * registry status is returned only as a hint: the publication preflight
 * re-probes the live registry at release time and the live result
 * governs.
 */
export function membersFromTrustEvidence(evidence) {
  const byName = new Map(evidence.results.map((result) => [result.name, result]));
  return FROZEN_PUBLISH_ORDER.map((name) => {
    const result = byName.get(name);
    return {
      name,
      registry: result.registry,
      trust: trustFromCapturedOutput(result.rawOutput),
    };
  });
}
