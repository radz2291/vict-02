import { getCredential, type TargetCredential } from './targets.js';

/**
 * NARROW VERSION-AWARE QUIELLIGHT TRANSPORT (Stage 9, G3-C / WP-G3-C).
 *
 * A single-purpose server-held transport for the EXISTING Quellight
 * target's declared read-only same-turn inspection surface
 * (`@victframework/*0.3.1`). The narrow surface contract (frozen G3
 * entry contract §0/§3/WP-G3-C):
 *
 * - the target entry declares the EXPECTED release identity and the
 *   pilot D-3 binding (`act.queryInspection` / `qlt.inspection`,
 *   `getTurn` via the target's own `app.data.query`);
 * - on connect the transport runs the IDENTITY-PIN ORACLE. The inspect
 *   surfaces cannot act as a command-list oracle (the 0.3.1 inspect
 *   answers carry the version-invariant `vict.command@1` marker), so
 *   the pin is behavioral-plus-provenance:
 *     (i)   positive behavioral — `agent.turn.get` and the
 *           `qlt.inspection` `getTurn` query both execute;
 *     (ii)  negative behavioral anti-newer probe — one G1 operator read
 *           (`run.get` against a bounded dummy id) is REQUIRED to be
 *           refused; on a newer-schemad (greenfield) target that read
 *           would succeed, so any probe success FAILS CLOSED;
 *     (iii) the full `health.inspect` + `compatibility.inspect`
 *           answer records are recorded verbatim and must EQUAL the
 *           pinned expected record. HONEST CAVEAT (recorded, never
 *           hidden): (iii) alone CANNOT distinguish 0.3.1 from a newer
 *           set (the envelope marker is version-invariant); that
 *           discrimination is carried by (ii) and (iv);
 *     (iv)  provenance — the exact Quellight ref the fixture runs and
 *           that ref's own declared release identity, supplied by the
 *           deployment provisioning and carried through labeled as
 *           PROVENANCE (never claimed to be a runtime oracle).
 * - the two server-held credentials (operator + agent-context) are
 *   authenticated AS themselves against the target's own server; the
 *   target's `actor.whoami` answers are recorded per credential as
 *   identity evidence (the whoami DIFF is the identity evidence);
 * - NO mutation verb, no bypass, no invented data, no fallback that
 *   fabricates; every failed/absent read resolves to a TRUTHFUL
 *   banner state, never a guess;
 * - cross-target isolation: ONLY the declared Quellight target id and
 *   its declared credential refs may enter this transport; any other
 *   target or credential id fails closed before any fetch.
 */

/* ------------------------------------------------------------------ */
/* Declared target entry + pinned expected records                      */
/* ------------------------------------------------------------------ */

/** The Quellight target id under which the deployment provisions it. */
export const QUELLIGHT_TARGET_ID = 'quellight';

/** The two server-held credential refs (deployment-provisioned map keys). */
export const QUELLIGHT_OPERATOR_CREDENTIAL_REF = 'quellight-operator';
export const QUELLIGHT_AGENT_CREDENTIAL_REF = 'quellight-agent';

/**
 * The pinned expected INSPECT ANSWER RECORDS (oracle element (iii)),
 * recorded from the target's own released 0.3.1 server surface
 * (`packages/server` of the release set: health.inspect answers
 * `healthy`/`commandSchema`/`streamSchema`; compatibility.inspect
 * authenticates and carries the four schema ids verbatim).
 *
 * HONEST VERSION-INVARIANCE CAVEAT (contract-mandated): these records
 * are version-invariant across 0.3.1 and 0.4.0-rc.1 — the envelope
 * marker `vict.command@1` is opaque, not a command list. Equality of
 * this record is REQUIRED as evidence but is NEVER claimed to be the
 * discriminator; the anti-newer behavioral probe (ii) and the
 * provenance record (iv) carry that distinction.
 */
const PINNED_HEALTH_RECORD: Readonly<Record<string, unknown>> = {
  healthy: true,
  commandSchema: 'vict.command@1',
  streamSchema: 'vict.agent-stream@1',
};

const PINNED_COMPATIBILITY_RECORD: Readonly<Record<string, unknown>> = {
  commandSchema: 'vict.command@1',
  streamSchema: 'vict.agent-stream@1',
  changesetSchema: 'vict.changeset@1',
  turnSchema: 'vict.agent-turn@1',
};

/**
 * The expected target release identity (WP-G3-C item 1): Quellight's
 * declared release-set identity and version, as recorded from the
 * Quellight tree itself (`docs/system-reference.md` stable release
 * identity + the package.json `@victframework/*` pins).
 */
export const QUELLIGHT_EXPECTED_IDENTITY = {
  releaseSetIdentity: 'vict-release-set@1',
  version: '0.3.1',
  frameworkPins: '@victframework/*@0.3.1',
} as const;

/**
 * The pilot binding (D-3): the EXISTING declared query action/resource.
 * The `getTurn` read executes through the target's own released
 * `app.data.query` boundary. `releaseVersion` is the Quellight tree's
 * OWN declared application release version, not an invented value.
 */
export const QUELLIGHT_PILOT_BINDING = {
  queryActionId: 'act.queryInspection',
  inspectionResourceId: 'qlt.inspection',
  getTurnOp: 'getTurn',
  /**
   * The declared read ingress of the released read boundary
   * (`app.data.query` via `/api/act`, per the inspection contract's own
   * header: "exposed ONLY through the released read boundary
   * (`app.data.query` via `/api/act")"). The VICT HTTP GET path on this
   * composition cannot carry the closed nested filter object (a flat
   * query-payload form only), so the declared ACT ingress is the honest
   * route for the `getTurn` proof read.
   */
  queryIngressPath: '/api/act',
} as const;

/** Provenance is DEPLOYMENT-PROVIDED and carried through labeled as such. */
export interface QuellightProvenance {
  readonly quellightRef: string;
  readonly declaredReleaseIdentity: string;
  readonly recordedAtLabel: 'provenance';
}

/* ------------------------------------------------------------------ */
/* Envelope helpers (bounded; non-echoing failures)                     */
/* ------------------------------------------------------------------ */

const TIMEOUT_MS = 8000;

type Envelope = { ok: true; data: Record<string, unknown> } | { ok: false; code: string };

interface FetchLike {
  (
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{ status: number; json(): Promise<unknown> }>;
}

function defaultFetch(): FetchLike {
  return (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/** The stable code when NO bounded envelope answer was received at all. */
const UNREACHABLE_CODE = 'HTTP_CONNECTION_UNAVAILABLE';

/** One bounded VICT-envelope call; unknown statuses collapse to an error. */
export async function callTargetCommand(
  fetchImpl: FetchLike | undefined,
  endpoint: string,
  path: string,
  token: string | undefined = undefined,
  payload?: Record<string, unknown>,
): Promise<Envelope> {
  const perform = fetchImpl ?? defaultFetch();
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers['authorization'] = `Bearer ${token}`;
  }
  // M-1 (Stage 9 exit audit): a POST body MUST declare application/json —
  // SvelteKit's production CSRF protection 403s JSON POSTs without the
  // explicit content-type, so the same-turn Read 2 failed under
  // production serving while dev-mode (no CSRF check) masked it.
  if (payload !== undefined) {
    headers['content-type'] = 'application/json';
  }
  let raw: { status: number; json: () => Promise<unknown> };
  try {
    raw = await perform(`${endpoint}${path}`, {
      ...(payload !== undefined ? { method: 'POST' } : { method: 'GET' }),
      headers,
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
  } catch {
    return { ok: false, code: UNREACHABLE_CODE };
  }
  let parsed: unknown;
  try {
    parsed = await raw.json();
  } catch {
    return { ok: false, code: UNREACHABLE_CODE };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, code: `HTTP_${raw.status}` };
  }
  const parsedRecord = parsed as Record<string, unknown>;
  if (parsedRecord['ok'] !== true) {
    const code = parsedRecord['code'];
    return { ok: false, code: typeof code === 'string' ? code : `HTTP_${raw.status}` };
  }
  // The VICT command envelope carries `data`; the declared act ingress
  // carries the action's result under `value` (its own declared shape).
  const dataMember = parsedRecord['data'];
  if (typeof dataMember === 'object' && dataMember !== null) {
    return { ok: true, data: dataMember as Record<string, unknown> };
  }
  const valueMember = parsedRecord['value'];
  if (typeof valueMember === 'object' && valueMember !== null) {
    return { ok: true, data: valueMember as Record<string, unknown> };
  }
  return { ok: false, code: 'HTTP_BODY_ABSENT' };
}

/* ------------------------------------------------------------------ */
/* Fail-closed results                                                  */
/* ------------------------------------------------------------------ */

export type QuellightPinOutcome =
  | {
      readonly ok: true;
      readonly healthRecord: Readonly<Record<string, unknown>>;
      readonly compatibilityRecord: Readonly<Record<string, unknown>>;
      readonly whoamiOperator: Readonly<Record<string, unknown>>;
      readonly whoamiAgent: Readonly<Record<string, unknown>>;
      readonly refusalProbe: {
        readonly command: 'run.get';
        readonly refused: true;
        readonly code: string;
      };
      readonly provenance: QuellightProvenance | { readonly recorded: false };
    }
  | { readonly ok: false; readonly code: string; readonly detail: string };

/* ------------------------------------------------------------------
 * Cross-target isolation (fail closed BEFORE any fetch)
 * ------------------------------------------------------------------ */

/**
 * Only the DECLARED Quellight target and its declared credential refs may
 * enter this transport. Any other target id or credential ref is refused
 * by a Studio-local closed rejection — no fetch is attempted, and the
 * other target's identity is never resolved through this transport.
 */
export function resolveQuellightCredential(
  targetId: string,
  credentialRef: string,
):
  | { ok: true; credential: TargetCredential }
  | { ok: false; code: 'VICT_STUDIO_CROSS_TARGET_REFUSED' | 'VICT_STUDIO_CREDENTIAL_ABSENT' } {
  if (targetId !== QUELLIGHT_TARGET_ID) {
    return { ok: false, code: 'VICT_STUDIO_CROSS_TARGET_REFUSED' };
  }
  if (
    credentialRef !== QUELLIGHT_OPERATOR_CREDENTIAL_REF &&
    credentialRef !== QUELLIGHT_AGENT_CREDENTIAL_REF
  ) {
    return { ok: false, code: 'VICT_STUDIO_CROSS_TARGET_REFUSED' };
  }
  const credential = getCredential(credentialRef);
  if (credential === undefined) {
    return { ok: false, code: 'VICT_STUDIO_CREDENTIAL_ABSENT' };
  }
  return { ok: true, credential };
}

/** Deep record equality (bounded shape: plain nested objects only). */
function recordsEqual(
  expected: Readonly<Record<string, unknown>>,
  actual: Readonly<Record<string, unknown>>,
): boolean {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  if (expectedKeys.length !== actualKeys.length) {
    return false;
  }
  for (const [index, key] of expectedKeys.entries()) {
    if (key !== actualKeys[index]) {
      return false;
    }
    const left = expected[key];
    const right = actual[key];
    if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
      if (
        !recordsEqual(
          left as Readonly<Record<string, unknown>>,
          right as Readonly<Record<string, unknown>>,
        )
      ) {
        return false;
      }
    } else if (left !== right) {
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* The identity-pin oracle + credential identity evidence               */
/* ------------------------------------------------------------------ */

/**
 * Run the identity-pin oracle against the target and capture the
 * per-credential `actor.whoami` evidence. Fail closed at EVERY step:
 * connection trouble, a deviating inspect record, a successful
 * anti-newer probe, or a failed positive read all refuse the pin.
 * `fetchImpl` exists for unit tests (real runs use global fetch).
 */
export async function connectQuellightIdentityPin(options: {
  endpoint: string;
  provenance?: QuellightProvenance;
  expectedHealth?: Readonly<Record<string, unknown>>;
  expectedCompatibility?: Readonly<Record<string, unknown>>;
  fetchImpl?: FetchLike;
}): Promise<QuellightPinOutcome> {
  const expectedHealth = options.expectedHealth ?? PINNED_HEALTH_RECORD;
  const expectedCompatibility = options.expectedCompatibility ?? PINNED_COMPATIBILITY_RECORD;

  // (iii) inspect answer-record equality, verbatim, before anything else.
  // /vict/v1/health is unauthenticated-safe on this target; the other
  // inspect surfaces and every proof read authenticate AS the credential.
  const earlyOperator = resolveQuellightCredential(
    QUELLIGHT_TARGET_ID,
    QUELLIGHT_OPERATOR_CREDENTIAL_REF,
  );
  if (!earlyOperator.ok) {
    return { ok: false, code: earlyOperator.code, detail: 'operator credential required to pin' };
  }
  const health = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    '/vict/v1/health',
    earlyOperator.credential.token,
  );
  if (health.ok === false && health.code === UNREACHABLE_CODE) {
    return {
      ok: false,
      code: 'VICT_QUELLIGHT_TARGET_UNREACHABLE',
      detail: 'the pinned target did not answer the health inspect within the bounded window',
    };
  }
  if (health.ok !== true || !recordsEqual(expectedHealth, health.data)) {
    return {
      ok: false,
      code: 'VICT_QUELLIGHT_IDENTITY_PIN_FAILED',
      detail:
        'the health inspect answer-record does not equal the pinned expected record; the connection fails closed',
    };
  }
  const compatibility = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    '/vict/v1/compatibility',
    earlyOperator.credential.token,
  );
  if (compatibility.ok !== true || !recordsEqual(expectedCompatibility, compatibility.data)) {
    return {
      ok: false,
      code: 'VICT_QUELLIGHT_IDENTITY_PIN_FAILED',
      detail:
        'the compatibility inspect answer-record does not equal the pinned expected record; the connection fails closed',
    };
  }

  // Identity evidence: whoami per credential (the whoami DIFF is the
  // identity evidence; the transport never assumes distinctness).
  const operator = resolveQuellightCredential(
    QUELLIGHT_TARGET_ID,
    QUELLIGHT_OPERATOR_CREDENTIAL_REF,
  );
  if (!operator.ok) {
    return { ok: false, code: operator.code, detail: 'operator credential required to pin' };
  }
  const agent = resolveQuellightCredential(QUELLIGHT_TARGET_ID, QUELLIGHT_AGENT_CREDENTIAL_REF);
  if (!agent.ok) {
    return { ok: false, code: agent.code, detail: 'agent-context credential required to pin' };
  }
  const whoamiOperator = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    '/vict/v1/actor/whoami',
    operator.credential.token,
  );
  const whoamiAgent = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    '/vict/v1/actor/whoami',
    agent.credential.token,
  );
  if (whoamiOperator.ok !== true || whoamiAgent.ok !== true) {
    return {
      ok: false,
      code: 'VICT_QUELLIGHT_IDENTITY_PIN_FAILED',
      detail: 'actor.whoami did not answer for both server-held credentials',
    };
  }

  // (ii) NEGATIVE BEHAVIORAL / ANTI-NEWER PROBE: one G1 operator read
  // against a bounded dummy id. REQUIRED refusal = the pin's discriminating
  // behavioral evidence. ANY success fails closed with a truthful version
  // error — the target is newer-schemad than its declared 0.3.1 identity.
  const probe = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    '/vict/v1/runs/qlt-probe-nonexistent',
    operator.credential.token,
  );
  if (probe.ok === true) {
    return {
      ok: false,
      code: 'VICT_QUELLIGHT_VERSION_PIN_REFUSED',
      detail:
        'the anti-newer probe (run.get) succeeded: the surface is newer-schemad than the pinned 0.3.1 identity; failing closed',
    };
  }
  const probeCode: string = probe.ok ? '' : probe.code;

  return {
    ok: true,
    healthRecord: health.data,
    compatibilityRecord: compatibility.data,
    whoamiOperator: whoamiOperator.data,
    whoamiAgent: whoamiAgent.data,
    refusalProbe: { command: 'run.get', refused: true, code: probeCode },
    provenance: options.provenance ?? { recorded: false },
  };
}

/* ------------------------------------------------------------------ */
/* The same-turn proof reads (exactly two declared reads)               */
/* ------------------------------------------------------------------ */

export interface QuellightTurnPairRead {
  readonly turnRecord: Readonly<Record<string, unknown>> | null;
  readonly inspection: Readonly<Record<string, unknown>> | null;
  /**
   * The target's own turnId correlation identity: the turnId must appear
   * in BOTH answers to be rendered as aligned; `null` correlation is a
   * TRUTHFUL NOT-DEMONSTRATED state (never approximated).
   */
  readonly correlationTurnId: string | null;
  readonly correlations: { readonly turnRead: boolean; readonly inspection: boolean };
  readonly failureCodes: {
    readonly turnRecord: string | null;
    readonly inspection: string | null;
  };
}

/**
 * Execute the TWO declared proof reads for ONE selected turn:
 * 1. `agent.turn.get` (the target's own turn record), and
 * 2. the `qlt.inspection` `getTurn` query through the target's own
 *    `app.data.query` boundary (the declared pilot binding).
 *
 * No mutation verb is issued, no third read is made, no data is invented:
 * the panel projections are only the fields the target returned.
 */
export async function readQuellightTurnPair(options: {
  endpoint: string;
  /** The target app origin that serves the declared act ingress (default: endpoint). */
  actIngressEndpoint?: string;
  threadId: string;
  turnId: string;
  fetchImpl?: FetchLike;
}): Promise<QuellightTurnPairRead> {
  const operator = resolveQuellightCredential(
    QUELLIGHT_TARGET_ID,
    QUELLIGHT_OPERATOR_CREDENTIAL_REF,
  );
  if (!operator.ok) {
    return {
      turnRecord: null,
      inspection: null,
      correlationTurnId: null,
      correlations: { turnRead: false, inspection: false },
      failureCodes: { turnRecord: operator.code, inspection: null },
    };
  }
  const turnGet = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    `/vict/v1/turns/${encodeURIComponent(options.turnId)}`,
    operator.credential.token,
  );
  const turnRecord = turnGet.ok
    ? ((turnGet.data['turn'] as Record<string, unknown>) ?? null)
    : null;
  const inspection = await appDataQuery(
    options.fetchImpl,
    options.actIngressEndpoint ?? options.endpoint,
    operator.credential.token,
    {
      query: QUELLIGHT_PILOT_BINDING.getTurnOp,
      threadId: options.threadId,
      turnId: options.turnId,
    },
  );
  const inspectionRow = inspection.data;
  const detail = inspectionRow?.['details'];
  const inspectionTurnId =
    inspectionRow !== null &&
    typeof detail === 'object' &&
    detail !== null &&
    typeof (detail as Record<string, unknown>)['turnId'] === 'string'
      ? ((detail as Record<string, unknown>)['turnId'] as string)
      : null;
  const turnRecordId = typeof turnRecord?.['turnId'] === 'string' ? turnRecord['turnId'] : null;
  return {
    turnRecord,
    inspection: inspectionRow,
    correlationTurnId:
      inspectionTurnId !== null && inspectionTurnId === turnRecordId ? inspectionTurnId : null,
    correlations: {
      turnRead: turnRecordId !== null,
      inspection: inspectionTurnId !== null,
    },
    failureCodes: {
      turnRecord: turnGet.ok ? null : turnGet.code,
      inspection: inspection.code,
    },
  };
}

/**
 * The declared read 2: the `act.queryInspection` action of the released
 * read boundary (`app.data.query` via `/api/act`), read-only. The
 * response is the target's own declared result shape; only the returned
 * row is carried.
 */
async function appDataQuery(
  fetchImpl: FetchLike | undefined,
  actIngressEndpoint: string,
  token: string,
  filters: Record<string, string>,
): Promise<
  | { data: Readonly<Record<string, unknown>> | null; code: string | null }
  | { data: null; code: string }
> {
  const envelope = await callTargetCommand(
    fetchImpl,
    actIngressEndpoint,
    QUELLIGHT_PILOT_BINDING.queryIngressPath,
    token,
    {
      actionId: QUELLIGHT_PILOT_BINDING.queryActionId,
      input: { filters },
    },
  );
  if (!envelope.ok) {
    return { data: null, code: envelope.code };
  }
  // The ingress answer was normalized; the value member is the
  // ApplicationDataResult of the declared surface.
  const value = envelope.data;
  const row = (value as Record<string, unknown>)['row'];
  return {
    data: typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null,
    code: null,
  };
}
/* ------------------------------------------------------------------ */
/* Agent-identity refusal attempt (operator surface, agent credential)  */
/* ------------------------------------------------------------------ */

export interface QuellightRefusalAttempt {
  readonly command: 'agent.turn.get';
  readonly succeeded: boolean;
  readonly refusalCode: string | null;
}

/**
 * Present the AGENT-CONTEXT credential to the OPERATOR proof surface
 * (one `agent.turn.get`) and report the target's own answer truthfully.
 * A failure/absence becomes a truthful banner, never a simulated denial:
 * if the single-actor tree resolves both credentials to one actor the
 * whoami evidence (rendered next to this attempt) PROVES that fact and
 * the criterion is reported as NOT DEMONSTRATED on the existing tree.
 * No mutation verb is issued.
 */
export async function attemptRefusalDemonstration(options: {
  endpoint: string;
  turnId: string;
  fetchImpl?: FetchLike;
}): Promise<QuellightRefusalAttempt> {
  const agent = resolveQuellightCredential(QUELLIGHT_TARGET_ID, QUELLIGHT_AGENT_CREDENTIAL_REF);
  if (!agent.ok) {
    return { command: 'agent.turn.get', succeeded: false, refusalCode: agent.code };
  }
  const attempt = await callTargetCommand(
    options.fetchImpl,
    options.endpoint,
    `/vict/v1/turns/${encodeURIComponent(options.turnId)}`,
    agent.credential.token,
  );
  return attempt.ok
    ? { command: 'agent.turn.get', succeeded: true, refusalCode: null }
    : { command: 'agent.turn.get', succeeded: false, refusalCode: attempt.code };
}
