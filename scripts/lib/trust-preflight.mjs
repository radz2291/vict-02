/**
 * Pure trust-preflight rules for the coordinated release path
 * (contract §11/§12 semantics + the §16 first-publication bootstrap
 * exception).
 *
 * THE RULE: the coordinated release set may publish only when EVERY
 * member simultaneously
 *   (a) EXISTS in the registry (npm's trusted-publisher configuration is
 *       a per-package setting on an existing package — an absent package
 *       cannot be trusted, so its presence must be bootstrapped first),
 *   and (b) carries the EXACT frozen trust relationship
 *       (github radz2291/vict-02 / release.yml / publish / no env).
 *
 * The verdict is SET-WIDE: if any member fails, NO member may publish.
 * There is no "publish the ready subset first" path — that would
 * partially publish the coordinated set, which the contract forbids.
 *
 * Pure functions only; the registry-touching wrapper lives in
 * `scripts/verify-trust-preflight.mjs`.
 */

import { FROZEN_PUBLISH_ORDER } from './release-set.mjs';

/** Registry existence status of one member. */
export const REGISTRY_PRESENT = 'present';
export const REGISTRY_ABSENT = 'absent';
export const REGISTRY_UNREACHABLE = 'unreachable';

/** Trust-relationship status of one member (from `npm trust list` or a
 * recorded evidence artifact of that official command). */
export const TRUST_EXACT = 'exact';
export const TRUST_MISSING = 'missing';
export const TRUST_CONFLICTING = 'conflicting';
export const TRUST_UNVERIFIABLE = 'unverifiable';

/**
 * The dedicated placeholder version for the owner-authorized
 * first-publication bootstrap (§16 exception): intentionally OUTSIDE the
 * coordinated release-set version shape (X.Y.Z / X.Y.Z-rc.N), so a
 * bootstrap placeholder can never be mistaken for — or requested as — a
 * coordinated set version, and can never consume one.
 */
export const BOOTSTRAP_PLACEHOLDER_VERSION = '0.0.0-bootstrap.1';

/** The dist-tag the placeholder publishes under (never `latest`, never a
 * candidate tag: `latest` stays unoccupied until the first real
 * coordinated release of the package). */
export const BOOTSTRAP_PLACEHOLDER_TAG = 'bootstrap';

/**
 * Assess the whole set. Every member of `members` must be in
 * `FROZEN_PUBLISH_ORDER`; anything else is a hard error (never assessed
 * leniently).
 *
 * @param {{name: string, registry: string, trust: string}[]} members
 * @returns {{
 *   authorized: boolean,
 *   stage: 'authorized'|'first-publication-bootstrap'|'trust-bootstrap'|'blocked',
 *   problems: string[],
 *   absent: string[],
 *   untrusted: string[],
 *   conflicting: string[],
 *   unverifiable: string[],
 * }}
 */
export function assessTrustPreflight(members) {
  const byName = new Map(members.map((member) => [member.name, member]));
  const expected = [...FROZEN_PUBLISH_ORDER];
  for (const name of expected) {
    if (!byName.has(name)) {
      throw new Error(
        `trust preflight input is missing release-set member '${name}' — refusing to decide on a partial set.`,
      );
    }
  }
  for (const name of byName.keys()) {
    if (!expected.includes(name)) {
      throw new Error(`trust preflight input contains non-member '${name}'.`);
    }
  }

  const absent = [];
  const untrusted = [];
  const conflicting = [];
  const unverifiable = [];
  const unreachable = [];
  const problems = [];

  for (const name of expected) {
    const member = byName.get(name);
    if (member.registry === REGISTRY_ABSENT) {
      absent.push(name);
    } else if (member.registry === REGISTRY_UNREACHABLE) {
      unreachable.push(name);
    }
    if (member.trust === TRUST_MISSING) untrusted.push(name);
    else if (member.trust === TRUST_CONFLICTING) conflicting.push(name);
    else if (member.trust === TRUST_UNVERIFIABLE) unverifiable.push(name);
  }

  if (unreachable.length > 0) {
    problems.push(
      `registry reachability could not be proven for: ${unreachable.join(', ')} — absence of proof is a blocker, not a pass.`,
    );
  }
  if (conflicting.length > 0) {
    problems.push(
      `CONFLICTING trust relationship(s) on: ${conflicting.join(', ')} — refused (never auto-replaced); the owner must revoke consciously and re-run the bootstrap.`,
    );
  }
  if (absent.length > 0) {
    problems.push(
      `ABSENT from the registry (no presence at any version): ${absent.join(', ')} — npm's trusted-publisher configuration is a per-package setting on an EXISTING package, so these members cannot be trusted (and therefore cannot publish) until the owner-authorized first-publication bootstrap establishes their registry presence (§16 exception; placeholder version ${BOOTSTRAP_PLACEHOLDER_VERSION} under the '${BOOTSTRAP_PLACEHOLDER_TAG}' tag — never a coordinated set version).`,
    );
  }
  if (unverifiable.length > 0) {
    problems.push(
      `trust relationship could not be verified for: ${unverifiable.join(', ')} — verification is authentication-gated; run authenticated (npm login / trusted environment) or supply the recorded official-command evidence file (--evidence).`,
    );
  }
  if (untrusted.length > 0) {
    problems.push(
      `present but lacking the exact frozen trust relationship: ${untrusted.join(', ')} — run the §11 trust bootstrap (after the first-publication bootstrap, if absent members exist).`,
    );
  }

  let stage;
  if (problems.length === 0) {
    stage = 'authorized';
  } else if (absent.length > 0) {
    stage = 'first-publication-bootstrap';
  } else if (conflicting.length > 0) {
    stage = 'blocked';
  } else {
    stage = 'trust-bootstrap';
  }

  return {
    authorized: stage === 'authorized',
    stage,
    problems,
    absent,
    untrusted,
    conflicting,
    unverifiable,
  };
}

/**
 * The set-wide publication rule, as a single decision line: publication
 * of ANY member is refused unless EVERY member is present and exact.
 */
export function publicationBlockedReason(assessment) {
  if (assessment.authorized) return null;
  return `PUBLICATION REFUSED FOR THE WHOLE SET (stage: ${assessment.stage}) — the coordinated set publishes as ONE unit only after all ${FROZEN_PUBLISH_ORDER.length} members exist and carry the exact trust relationship. First blocking reason: ${assessment.problems[0]}`;
}
