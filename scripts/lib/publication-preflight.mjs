/**
 * The MANDATORY publication preflight gate (release-readiness r4).
 *
 * THE SET-WIDE RULE (contract §11/§12 + §16): the coordinated release
 * set may publish only when EVERY one of the 14 members simultaneously
 *   (a) EXISTS in the public registry (npm's trusted-publisher
 *       configuration is a per-package setting on an EXISTING package),
 *   and (b) carries the EXACT frozen trust relationship — credibly
 *       verified through the official `npm trust list <name> --json`
 *       interface, either LIVE (authenticated operator session) or
 *       through a VALIDATED, set-bound, fresh operator-evidence
 *       artifact (scripts/lib/trust-evidence.mjs — GitHub Actions holds
 *       no npm session under the frozen no-secret policy).
 *
 * If ANY member fails, publishing ANY member is refused — there is no
 * "publish the ready subset" path. The gate is invoked by EVERY
 * publication path (oidc-release validate + publish including resume,
 * publish-release --publish, trust-bootstrap --execute, the release.yml
 * preflight step) BEFORE any registry write, immediately after the
 * contract-authority gate.
 *
 * This module owns the probing so the CLI and the engines cannot drift:
 * registry existence via read-only packument probes; trust via the live
 * official command or validated evidence (r5: evidence mode re-probes
 * registry presence LIVE at release time — the artifact's presence
 * claims are never trusted — and classifies trust from the RETAINED
 * captured output, never from a claimed status). Read-only: never
 * configures, revokes, or publishes anything.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  deriveReleaseInventory,
  deriveReleaseSetContentId,
  FROZEN_PUBLISH_ORDER,
} from './release-set.mjs';
import { fetchPackument } from './registry-probe.mjs';
import { resolveNpmLauncher } from './npm-launcher.mjs';
import { classifyTrustListOutput, sanitize } from './trust-config.mjs';
import {
  assessTrustPreflight,
  publicationBlockedReason,
  REGISTRY_ABSENT,
  REGISTRY_PRESENT,
  REGISTRY_UNREACHABLE,
  TRUST_CONFLICTING,
  TRUST_EXACT,
  TRUST_MISSING,
  TRUST_UNVERIFIABLE,
} from './trust-preflight.mjs';
import { membersFromTrustEvidence, validateTrustEvidence } from './trust-evidence.mjs';

/** Classify the JSON output of the official `npm trust list` command
 * (r5: the implementation moved to the shared trust rules so the
 * evidence validator classifies from the CAPTURED output with exactly
 * the same code path as a live run; re-exported for compatibility). */
export { classifyTrustListOutput };

/** Run the official read-only `npm trust list <name> --json`. */
export function spawnTrustList(launcherResolved, packageName) {
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

function trustStatusFromClassification(classified) {
  if (classified.error !== undefined) return TRUST_UNVERIFIABLE;
  if (classified.conflicting.length > 0) return TRUST_CONFLICTING;
  if (classified.exact.length > 0) return TRUST_EXACT;
  return TRUST_MISSING;
}

/**
 * The coherent release-set inventory + its content-derived identity, as
 * ONE validated unit (invalid inventory refuses the gate).
 */
export function releaseSetIdentityAt(repoRoot) {
  const inventory = deriveReleaseInventory(repoRoot);
  if (inventory.problems.length > 0) {
    throw new Error(`release-set inventory invalid:\n  - ${inventory.problems.join('\n  - ')}`);
  }
  if (inventory.order.join('\n') !== FROZEN_PUBLISH_ORDER.join('\n')) {
    throw new Error('derived inventory order does not equal the frozen publication order.');
  }
  const identity = deriveReleaseSetContentId(
    inventory.order.map((name) => `${name}@${inventory.byName.get(name).version}`),
  );
  return { inventory, identity };
}

/**
 * Probe the whole set — READ-ONLY — and return the set-wide preflight
 * verdict. Evidence mode consumes a VALIDATED artifact (never an
 * arbitrary JSON file); live mode probes the registry and runs the
 * official `npm trust list` command per member (authentication-gated:
 * without a session the status is UNVERIFIABLE — a blocker).
 *
 * @param {{repoRoot: string, evidencePath?: string, log?: (line: string) => void,
 *          now?: Date}} options
 */
export function assessPublicationPreflight(options) {
  const { repoRoot, evidencePath, log = () => {}, now } = options;
  const { inventory, identity } = releaseSetIdentityAt(repoRoot);

  let members;
  let mode;
  if (evidencePath !== undefined && evidencePath.length > 0) {
    mode = 'evidence';
    let raw;
    try {
      raw = readFileSync(resolve(evidencePath), 'utf8');
    } catch (error) {
      const verdict = {
        authorized: false,
        stage: 'blocked',
        problems: [`the trust-evidence artifact is unreadable: ${error.message}`],
        blockedReason: 'the trust-evidence artifact is unreadable.',
        mode,
        version: inventory.version,
        identity,
      };
      return {
        ...verdict,
        assessment: assessTrustPreflight(
          FROZEN_PUBLISH_ORDER.map((name) => ({
            name,
            registry: REGISTRY_ABSENT,
            trust: TRUST_UNVERIFIABLE,
          })),
        ),
      };
    }
    const validation = validateTrustEvidence(raw, {
      expectedVersion: inventory.version,
      expectedIdentity: identity,
      now,
    });
    if (!validation.ok) {
      const verdict = {
        authorized: false,
        stage: 'blocked',
        problems: validation.problems,
        blockedReason: `the trust-evidence artifact is NOT CREDIBLE for this release set (${validation.problems.length} binding failure(s)) — an arbitrary or stale evidence file never authorizes publication.`,
        mode,
        version: inventory.version,
        identity,
      };
      return {
        ...verdict,
        assessment: assessTrustPreflight(
          FROZEN_PUBLISH_ORDER.map((name) => ({
            name,
            registry: REGISTRY_ABSENT,
            trust: TRUST_UNVERIFIABLE,
          })),
        ),
      };
    }
    log(
      `trust preflight: validated operator evidence bound to ${inventory.version} / ${identity.slice(0, 18)}… (trust classified from the RETAINED captured output)`,
    );
    const evidenceMembers = membersFromTrustEvidence(validation.evidence);
    const claimedRegistry = new Map(
      evidenceMembers.map((member) => [member.name, member.registry]),
    );
    // RELEASE-TIME REGISTRY RECHECK (r5): the artifact's `registry`
    // claims are never trusted for the §11 presence rule — presence is
    // re-proven LIVE (read-only packument fetch; needs no npm session,
    // so it always runs wherever the gate runs, including CI).
    members = [];
    for (const member of evidenceMembers) {
      let registry;
      try {
        const packument = fetchPackument(member.name);
        const versionCount = Object.keys(packument.versions ?? {}).length;
        registry = versionCount > 0 ? REGISTRY_PRESENT : REGISTRY_ABSENT;
        log(
          `  ${member.name}: LIVE registry recheck → ${registry === REGISTRY_PRESENT ? `present (${versionCount} version(s))` : 'ABSENT (no presence at any version)'}` +
            (claimedRegistry.get(member.name) !== registry
              ? ` (evidence claimed '${claimedRegistry.get(member.name)}' — the LIVE result governs)`
              : ''),
        );
      } catch (error) {
        registry = REGISTRY_UNREACHABLE;
        log(`  ${member.name}: release-time registry recheck failed (${error.message})`);
      }
      // Trust comes ONLY from the evidence (classified from the captured
      // output — see membersFromTrustEvidence); it is authentication-
      // gated and cannot be re-proven by CI.
      members.push({ name: member.name, registry, trust: member.trust });
    }
  } else {
    mode = 'live';
    members = [];
    for (const name of inventory.order) {
      let registry;
      try {
        const packument = fetchPackument(name);
        const versionCount = Object.keys(packument.versions ?? {}).length;
        registry = versionCount > 0 ? REGISTRY_PRESENT : REGISTRY_ABSENT;
        log(
          `  ${name}: ${registry === REGISTRY_PRESENT ? `present in the registry (${versionCount} version(s))` : 'ABSENT from the registry (no presence at any version)'}`,
        );
      } catch (error) {
        registry = REGISTRY_UNREACHABLE;
        log(`  ${name}: registry probe failed (${error.message})`);
      }
      members.push({ name, registry, trust: undefined });
    }

    let launcher;
    try {
      launcher = resolveNpmLauncher();
      log(`trust preflight: npm launcher — ${launcher.description}`);
    } catch (error) {
      for (const member of members) member.trust = TRUST_UNVERIFIABLE;
      log(
        `trust preflight: no qualifying npm launcher (${error.message}); all members UNVERIFIABLE.`,
      );
    }
    for (const member of members) {
      if (member.trust !== undefined) continue;
      if (launcher === undefined) {
        member.trust = TRUST_UNVERIFIABLE;
        continue;
      }
      const result = spawnTrustList(launcher, member.name);
      if (result.kind === 'auth') {
        member.trust = TRUST_UNVERIFIABLE;
        log(
          `  ${member.name}: trust verification is authentication-gated (no npm session) → UNVERIFIABLE`,
        );
        continue;
      }
      if (result.kind === 'error') {
        member.trust = TRUST_UNVERIFIABLE;
        log(`  ${member.name}: npm trust list failed → UNVERIFIABLE (${result.message})`);
        continue;
      }
      member.trust = trustStatusFromClassification(classifyTrustListOutput(result.stdout));
      log(`  ${member.name}: live npm trust list → ${member.trust}`);
    }
  }

  const assessment = assessTrustPreflight(members);
  return {
    authorized: assessment.authorized,
    stage: assessment.stage,
    problems: assessment.problems,
    blockedReason: publicationBlockedReason(assessment),
    mode,
    version: inventory.version,
    identity,
    assessment,
  };
}
