import { getTarget } from '$lib/server/targets.js';
import {
  QUELLIGHT_AGENT_CREDENTIAL_REF,
  QUELLIGHT_EXPECTED_IDENTITY,
  QUELLIGHT_OPERATOR_CREDENTIAL_REF,
  QUELLIGHT_TARGET_ID,
  attemptRefusalDemonstration,
  connectQuellightIdentityPin,
  readQuellightTurnPair,
  type QuellightProvenance,
  type QuellightRefusalAttempt,
  type QuellightTurnPairRead,
} from '$lib/server/quellight-transport.js';
import { getCredential } from '$lib/server/targets.js';
import type { PageServerLoad } from './$types';

/**
 * PRODUCT-VIEW / SAME-TURN PAGE SERVER (Stage 9, G3-C; WP-G3-C items 2-4).
 *
 * Everything the page renders is produced HERE, on the server, from the
 * target's own returned projections: no fallback fabricates data, no
 * credential material crosses to the browser, and every failed/absent
 * read becomes a TRUTHFUL banner state (NOT-CONNECTED / NOT-RETRIEVED /
 * NOT-DEMONSTRATED). The +page.svelte renders this payload GENERICALLY
 * (labeled key/value rows and banners) — no target-name branching.
 *
 * The selected turn arrives DEPLOYMENT-PROVISIONED (the same-turn panel
 * selects ONE fixture turn; the fixture creates it through the target's
 * own governed agent.turn.start boundary before the journey). Provision:
 *   VICT_STUDIO_QUELLIGHT_TURN: { "threadId": "...", "turnId": "..." }
 *   VICT_STUDIO_QUELLIGHT_PROVENANCE:
 *     { "quellightRef": "…", "declaredReleaseIdentity": "…" }
 */

function parseProvisionedEnvObject(raw: string | undefined): Record<string, string> | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return undefined;
  }
}

function plain(record: unknown): Record<string, unknown> | null {
  if (typeof record !== 'object' || record === null) {
    return null;
  }
  return structuredClone(record as Record<string, unknown>);
}

export const load: PageServerLoad = async (): Promise<Record<string, unknown>> => {
  // The declared Quellight target only: nothing else may enter this page's
  // server load (target isolation is transport-declared).
  const entry = getTarget(QUELLIGHT_TARGET_ID);
  const expectedIdentity = QUELLIGHT_EXPECTED_IDENTITY;
  if (entry === undefined) {
    return {
      targetId: QUELLIGHT_TARGET_ID,
      expectedIdentity,
      pinned: { ok: false, code: 'TARGET_NOT_PROVISIONED', detail: 'no registry entry' },
      panel: null,
      refusal: null,
      capabilityHonesty:
        'Newer operator run.* command reads are not offered by this page: the target was not provisioned, so no capability comparison is demonstrated.',
    };
  }
  const provenance = parseProvisionedEnvObject(process.env['VICT_STUDIO_QUELLIGHT_PROVENANCE']);
  const provenanceRecord: QuellightProvenance | { recorded: false } =
    provenance === undefined
      ? { recorded: false }
      : {
          quellightRef: provenance['quellightRef'] ?? '',
          declaredReleaseIdentity: provenance['declaredReleaseIdentity'] ?? '',
          recordedAtLabel: 'provenance' as const,
        };
  const pin = await connectQuellightIdentityPin({
    endpoint: entry.endpoint,
    provenance: 'quellightRef' in provenanceRecord ? provenanceRecord : undefined,
  });
  if (pin.ok === false) {
    return {
      targetId: QUELLIGHT_TARGET_ID,
      targetLabel: entry.label,
      expectedIdentity,
      pin: { ok: false, code: pin.code, detail: pin.detail },
      panel: null,
      refusal: null,
      capabilityHonesty:
        'No capability comparison is demonstrated: the identity pin failed closed, so the page claims nothing about this target.',
    };
  }

  // Per-credential identity evidence: the whoami answers verbatim plus the
  // computed DIFF (distinct identities are demonstrated, not assumed).
  const whoamiOperator = plain(pin.whoamiOperator) ?? {};
  const whoamiAgent = plain(pin.whoamiAgent) ?? {};
  const singleActor =
    whoamiOperator['actorId'] === whoamiAgent['actorId'] &&
    typeof whoamiOperator['actorId'] === 'string';

  // The selected turn is deployment-provisioned (fixture-created via the
  // target's own governed agent.turn.start; no transport mutation).
  const provisioned = parseProvisionedEnvObject(process.env['VICT_STUDIO_QUELLIGHT_TURN']);
  const selected: { threadId: string; turnId: string } | null =
    provisioned !== undefined &&
    typeof provisioned['threadId'] === 'string' &&
    provisioned['threadId'].length > 0 &&
    typeof provisioned['turnId'] === 'string' &&
    provisioned['turnId'].length > 0
      ? { threadId: provisioned['threadId'], turnId: provisioned['turnId'] }
      : null;

  let panel:
    | (QuellightTurnPairRead & {
        selected: { threadId: string; turnId: string } | null;
        banner: { state: 'aligned' | 'not_demonstrated' | 'not_retrieved'; text: string };
      })
    | null = null;
  if (pin.ok === true) {
    if (selected === null) {
      panel = {
        turnRecord: null,
        inspection: null,
        correlationTurnId: null,
        correlations: { turnRead: false, inspection: false },
        failureCodes: { turnRecord: null, inspection: null },
        selected: null,
        banner: {
          state: 'not_demonstrated',
          text: 'SAME-TURN ALIGNMENT NOT DEMONSTRATED: no turn was provisioned for this journey (VICT_STUDIO_QUELLIGHT_TURN); nothing is invented.',
        },
      };
    } else {
      const pair = await readQuellightTurnPair({
        endpoint: entry.endpoint,
        threadId: selected.threadId,
        turnId: selected.turnId,
      });
      const aligned = pair.correlationTurnId !== null;
      panel = {
        ...pair,
        selected,
        banner: aligned
          ? {
              state: 'aligned',
              text: `SAME-TURN alignment demonstrated: the target's own turnId appears in BOTH answers (${pair.correlationTurnId}).`,
            }
          : pair.turnRecord === null || pair.inspection === null
            ? {
                state: 'not_retrieved',
                text: 'SAME-TURN ALIGNMENT NOT RETRIEVED: one or both proof reads did not answer; the target answered truthfully and nothing is substituted.',
              }
            : {
                state: 'not_demonstrated',
                text: 'SAME-TURN ALIGNMENT NOT DEMONSTRATED: the inspection projection carries no turn correlation (or it does not match), so this pairing is truthfully NOT demonstrated.',
              },
      };
    }
  }

  // Refusal demonstration: agent-context credential against the operator
  // proof surface + the whoami DIFF as the identity evidence.
  let refusal: (QuellightRefusalAttempt & { singleActor: boolean; whoamiDiff: string[] }) | null =
    null;
  if (pin.ok === true && selected !== null) {
    const attempt = await attemptRefusalDemonstration({
      endpoint: entry.endpoint,
      turnId: selected.turnId,
    });
    const diff: string[] = [];
    for (const key of new Set([...Object.keys(whoamiOperator), ...Object.keys(whoamiAgent)])) {
      const left = JSON.stringify(whoamiOperator[key] ?? null);
      const right = JSON.stringify(whoamiAgent[key] ?? null);
      if (left !== right) {
        diff.push(key);
      }
    }
    refusal = { ...attempt, singleActor, whoamiDiff: diff };
  }

  return {
    targetId: QUELLIGHT_TARGET_ID,
    targetLabel: entry.label,
    expectedIdentity,
    pinned: {
      ok: true,
      healthRecord: pin.healthRecord,
      compatibilityRecord: pin.compatibilityRecord,
      whoamiOperator,
      whoamiAgent,
      singleActor,
      refusalProbe: pin.refusalProbe,
      provenance: pin.provenance,
      credentialRefs: {
        operator: QUELLIGHT_OPERATOR_CREDENTIAL_REF,
        agentContext: QUELLIGHT_AGENT_CREDENTIAL_REF,
      },
      operatorActorLabel: getCredential(QUELLIGHT_OPERATOR_CREDENTIAL_REF)?.actorLabel ?? null,
      agentActorLabel: getCredential(QUELLIGHT_AGENT_CREDENTIAL_REF)?.actorLabel ?? null,
    },
    panel: panel === null ? null : { ...panel },
    refusal,
    capabilityHonesty:
      'Capability honesty: the newer G1 operator command reads (run.get, run.list, run.detail, run.events, run.waits) are NOT available on this declared 0.3.1 target — the transport anti-newer probe was REQUIRED to be refused and was refused. This banner is truthful and differs from a target that serves those reads.',
  };
};
