import { VictControlError } from '@victframework/runtime';
import type { Contract } from '@victframework/contracts';
import type { ServerActorContext } from './auth.js';

/**
 * Stage 06B — the remote Application data/action adapter.
 *
 * Wraps the Stage 05 verified Application data port with the SAME server
 * authorization boundary (APP-010, API-006):
 *
 * - resource queries and mutations preserve the declared resource ID,
 *   revision, and release binding — never re-derived or widened;
 * - VICT actions use the same authorization boundary (scopes below the UI);
 * - LOCAL actions are client-local by definition and are REFUSED remotely;
 * - cross-actor and stale-release access fails;
 * - hostile query/filter containers produce structured non-echoing errors.
 *
 * Stage 07C Phase F (F-8 correction): `remoteMutate` now ALSO carries the
 * governed, closed mutation envelope (`mutation`) with the compiled-plan
 * action identity (`actionId`, `expectedActionRevision`) from the corrected
 * `app.data.mutate`/`app.data.action` command payload into the conforming
 * `ApplicationDataMutationRequest` shape of the Application data port
 * (`resourceId`/`op`/`input`/`id`/`idempotencyKey`). The envelope path is
 * strictly additive: a payload without `mutation` keeps the EXACT legacy
 * identity-only adapter request. The envelope is a closed record
 * (`op`/`id`/`input`/`idempotencyKey` only), validated against the composed
 * compiled-plan action declaration and (when composed) the action's declared
 * input contract, under delivery-safe value, size, depth, array-length,
 * key-length, and prototype-safety bounds — all with stable, non-echoing
 * rejection codes. No second effect mechanism is introduced: the existing
 * durable command idempotency machinery governs the command dispatch; the
 * envelope's domain key reaches only the adapter's existing keyed
 * reconciliation boundary.
 */

export interface RemoteApplicationDataOptions {
  /** The verified Stage 05 application-data port (composed). */
  readonly data: ApplicationDataPortLike;
  /** The actor→resource ownership policy: resource records carry actorId. */
  readonly ownsResource?: (
    actor: ServerActorContext,
    resource: { readonly actorId?: unknown },
  ) => boolean;
  /** The expected release binding (stale-release denial). */
  readonly expectedReleaseVersion?: string;
  /**
   * The composed compiled-plan action resolver (Stage 07C Phase F). When an
   * `app.data.mutate` payload carries the mutation envelope, its `actionId`
   * MUST resolve through this resolver against the composed compiled plan;
   * an unresolvable, stale, or mismatched action identity fails closed
   * (`VICT_APPDATA_ACTION_UNRESOLVED`). The plan's declared `op`,
   * `resourceId`, revision, and `inputContractId` are the authority for
   * what the envelope may carry.
   */
  readonly resolveAction?: (actionId: string) => ResolvedApplicationAction | undefined;
  /**
   * The OPTIONAL input-contract resolver (Stage 07C Phase F, handoff §6.5):
   * maps a resolved action id to the product-owned executable contract
   * implementing the action's declared `inputContractId`. Contract
   * IMPLEMENTATIONS are product-owned — the framework never owns product
   * input meaning. When the resolver is composed and the resolved action
   * declares an input contract, `mutation.input` is parsed through that
   * contract at this boundary (first fence) BEFORE forwarding; the conforming
   * adapter keeps its own declared-contract validation (second fence). A
   * composition that supplies no resolver keeps the adapter-only validation
   * behavior for what it composed before this correction.
   */
  readonly resolveInputContract?: (actionId: string) => Contract<unknown> | undefined;
}

/**
 * The closed shape of a compiled-plan mutation-action declaration as
 * resolved by `resolveAction`. The resolved declaration is VICT-owned plain
 * data derived from the immutable compiled plan; it is the authority for
 * the action identity, target resource, declared op, and declared input
 * contract that the mutation envelope must match.
 */
export interface ResolvedApplicationAction {
  readonly actionId: string;
  readonly revision: string;
  readonly kind: 'mutation';
  readonly resourceId: string;
  readonly op: string;
  readonly inputContractId?: string;
}

/** The neutral application-data port surface used by the server. */
export interface ApplicationDataPortLike {
  query(request: Record<string, unknown>): Promise<unknown>;
  mutate(request: Record<string, unknown>): Promise<unknown>;
}

/** Bounded string fields on the remote boundary (closed schemas). */
function bounded(value: unknown, field: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new VictControlError('VICT_APPDATA_FIELD_INVALID', `${field} must be a bounded string.`);
  }
  return value;
}

// ---- Stage 07C Phase F — the governed mutation envelope ---------------------

/** The closed field set of the mutation envelope (both levels fail closed). */
export const MUTATION_ENVELOPE_FIELDS: readonly string[] = ['op', 'id', 'input', 'idempotencyKey'];

/** Maximum length of the envelope `op` (handoff §6.9 declared closed bound). */
export const MUTATION_ENVELOPE_OP_MAX_LENGTH = 32;

/** Maximum length of the envelope target identity `id` (handoff §6.9). */
export const MUTATION_ENVELOPE_ID_MAX_LENGTH = 128;

/** Maximum length of the envelope keyed domain `idempotencyKey` (handoff §6.9). */
export const MUTATION_ENVELOPE_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/**
 * Maximum nesting depth of `mutation.input` measured from the envelope
 * (handoff §6.9; the command payload's own envelope depth bound of 8 applies
 * to the WHOLE payload first and is stricter for command-path payloads).
 */
export const MUTATION_INPUT_MAX_DEPTH = 8;

/** Maximum canonical serialized size of `mutation.input` (handoff §6.9; below the 256 KiB body bound). */
export const MUTATION_INPUT_MAX_BYTES = 64 * 1024;

/** Maximum array length per level inside `mutation.input` (handoff §6.9). */
export const MUTATION_INPUT_MAX_ARRAY_LENGTH = 1000;

/** Maximum own-key length inside `mutation.input` (handoff §6.9). */
export const MUTATION_INPUT_MAX_KEY_LENGTH = 128;

/**
 * The one prohibited special key inside `mutation.input` (Stage 07A N-1
 * discipline): an OWN `__proto__` key in any own form at any depth is
 * REJECTED with the dedicated `VICT_APPDATA_MUTATION_INPUT_INVALID` code.
 * Null-prototype containers without a prohibited key remain accepted;
 * `constructor`/`prototype` string keys remain plain own data.
 */
const PROHIBITED_INPUT_KEYS: readonly string[] = ['__proto__'];

function inputInvalid(message: string): VictControlError {
  return new VictControlError('VICT_APPDATA_MUTATION_INPUT_INVALID', message);
}

/**
 * Capture the mutation envelope as a CLOSED plain-data record before any
 * field is read: only own enumerable string-keyed data properties cross;
 * accessors, symbol keys, inherited/non-enumerable members, exotic
 * prototypes, hostile proxies, and unknown fields fail closed with the
 * stable `VICT_COMMAND_PAYLOAD_INVALID` code (the same capture discipline
 * as the command envelope, extended to the mutation envelope).
 */
function captureMutationEnvelope(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      "The 'mutation' envelope must be a plain object.",
    );
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(raw);
  } catch {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      "The 'mutation' envelope could not be inspected; hostile containers are rejected.",
    );
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      "The 'mutation' envelope must be a plain data record; exotic prototypes are rejected.",
    );
  }
  let ownKeys: PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(raw);
  } catch {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      "The 'mutation' envelope could not be enumerated; hostile containers are rejected.",
    );
  }
  const capture: Record<string, unknown> = {};
  for (const key of ownKeys) {
    if (typeof key !== 'string') {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        "The 'mutation' envelope declares a symbol key; only plain data properties are accepted.",
      );
    }
    if (!MUTATION_ENVELOPE_FIELDS.includes(key)) {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        "The 'mutation' envelope declares an unknown field for 'app.data.mutate'.",
      );
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(raw, key);
    } catch {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        "The 'mutation' envelope could not be inspected; hostile containers are rejected.",
      );
    }
    if (
      descriptor === undefined ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    ) {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        "The 'mutation' envelope declares an accessor, inherited, or non-enumerable member; only own enumerable data properties are accepted.",
      );
    }
    capture[key] = descriptor.value;
  }
  return capture;
}

/**
 * Validate `mutation.input` against the declared closed delivery-safe value
 * domain (handoff §6.7–§6.9): JSON scalars (finite numbers only), plain
 * objects and arrays, bounded depth/size/keys/array lengths, and NO own
 * `__proto__` key in any own form at any depth. Hostile containers (throwing
 * getters, revoked proxies, hostile traps) produce the same stable,
 * non-echoing code — raw hostile content never echoes.
 */
function assertMutationInput(input: unknown): void {
  const visit = (value: unknown, depth: number): void => {
    if (depth > MUTATION_INPUT_MAX_DEPTH) {
      throw inputInvalid('The mutation input nests too deeply.');
    }
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'number'
    ) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw inputInvalid(
          'The mutation input contains a value outside the delivery-safe serializable domain.',
        );
      }
      return;
    }
    if (typeof value !== 'object') {
      // functions, symbols, bigints, and undefined inside the structure are
      // outside the declared canonical plain-data domain.
      throw inputInvalid(
        'The mutation input contains a value outside the delivery-safe serializable domain.',
      );
    }
    if (Array.isArray(value)) {
      if (value.length > MUTATION_INPUT_MAX_ARRAY_LENGTH) {
        throw inputInvalid('The mutation input contains an array beyond the declared bound.');
      }
      for (let index = 0; index < value.length; index += 1) {
        let item: unknown;
        try {
          item = (value as unknown[])[index];
        } catch {
          throw inputInvalid(
            'The mutation input could not be read safely; hostile containers are rejected.',
          );
        }
        visit(item, depth + 1);
      }
      return;
    }
    let prototype: object | null;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      throw inputInvalid(
        'The mutation input could not be inspected; hostile containers are rejected.',
      );
    }
    if (prototype !== Object.prototype && prototype !== null) {
      throw inputInvalid(
        'The mutation input contains an exotic prototype outside the delivery-safe serializable domain.',
      );
    }
    let ownKeys: PropertyKey[];
    try {
      ownKeys = Reflect.ownKeys(value);
    } catch {
      throw inputInvalid(
        'The mutation input could not be enumerated; hostile containers are rejected.',
      );
    }
    for (const key of ownKeys) {
      if (typeof key !== 'string') {
        throw inputInvalid(
          'The mutation input declares a symbol key; only plain data properties are accepted.',
        );
      }
      if (key.length > MUTATION_INPUT_MAX_KEY_LENGTH) {
        throw inputInvalid('The mutation input declares a key beyond the declared bound.');
      }
      if (PROHIBITED_INPUT_KEYS.includes(key)) {
        throw inputInvalid(
          'The mutation input declares a prohibited special key; such keys are rejected in any own form at any depth.',
        );
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        throw inputInvalid(
          'The mutation input could not be inspected; hostile containers are rejected.',
        );
      }
      if (
        descriptor === undefined ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        throw inputInvalid(
          'The mutation input declares an accessor member; hostile containers are rejected.',
        );
      }
      visit(descriptor.value, depth + 1);
    }
  };
  visit(input, 0);
  // Deterministic serialized-size bound (handoff §6.9): the serialized form
  // of the input must stay within the declared constant. A value that cannot
  // be serialized fails closed.
  let canonical: string;
  try {
    canonical = JSON.stringify(input) ?? '';
  } catch {
    throw inputInvalid(
      'The mutation input could not be canonically serialized (cyclic or unsupported structure).',
    );
  }
  if (Buffer.byteLength(canonical, 'utf8') > MUTATION_INPUT_MAX_BYTES) {
    throw inputInvalid('The mutation input exceeds the declared size bound.');
  }
}

/** Hostile-container containment: any throw from a filter object is a stable error. */

/** The remote resource query boundary. */
export async function remoteQuery(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
): Promise<unknown> {
  const resourceId = bounded(input.resourceId, 'resourceId');
  const releaseVersion = bounded(input.releaseVersion, 'releaseVersion');
  if (
    options.expectedReleaseVersion !== undefined &&
    releaseVersion !== options.expectedReleaseVersion
  ) {
    throw new VictControlError(
      'VICT_APPDATA_RELEASE_STALE',
      'The declared release binding does not match the currently selected release.',
    );
  }
  // The authenticated actor owns the read; hostile filter containers are
  // contained BEFORE they reach the adapter.
  let filters: Record<string, unknown> | undefined;
  if (input.filters !== undefined) {
    if (
      typeof input.filters !== 'object' ||
      input.filters === null ||
      Array.isArray(input.filters)
    ) {
      throw new VictControlError(
        'VICT_APPDATA_FILTER_INVALID',
        'The filter container must be a plain object.',
      );
    }
    filters = input.filters as Record<string, unknown>;
    // Hostile getters/proxies are contained: enumeration failures collapse
    // to the stable structured error without echoing the hostile value.
    try {
      for (const key of Object.keys(filters)) {
        bounded(key, 'filterKey');
      }
    } catch (error) {
      if (error instanceof VictControlError) {
        throw error;
      }
      throw new VictControlError(
        'VICT_APPDATA_FILTER_INVALID',
        'The filter container could not be read safely.',
      );
    }
  }
  // Hostile containers (throwing getters/proxies) are contained at this
  // boundary: any downstream throw collapses to the stable structured
  // error — raw hostile content never echoes.
  try {
    return await options.data.query({
      kind: 'query',
      resourceId,
      releaseVersion,
      actorId: actor.actorId,
      ...(filters !== undefined ? { filters } : {}),
    });
  } catch (error) {
    if (error instanceof VictControlError) {
      throw error;
    }
    throw new VictControlError(
      'VICT_APPDATA_FILTER_INVALID',
      'The query could not be processed safely.',
    );
  }
}

/** The remote resource mutation boundary. */
export async function remoteMutate(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
): Promise<unknown> {
  const resourceId = bounded(input.resourceId, 'resourceId');
  const releaseVersion = bounded(input.releaseVersion, 'releaseVersion');
  const expectedRevision = bounded(input.expectedRevision ?? '0', 'expectedRevision');
  if (
    options.expectedReleaseVersion !== undefined &&
    releaseVersion !== options.expectedReleaseVersion
  ) {
    throw new VictControlError(
      'VICT_APPDATA_RELEASE_STALE',
      'The declared release binding does not match the currently selected release.',
    );
  }
  const actionKind = bounded(input.actionKind ?? 'mutation', 'actionKind', 32);
  if (actionKind === 'local') {
    // Local/view actions are CLIENT-LOCAL by definition and can never be
    // dispatched through the server boundary.
    throw new VictControlError(
      'VICT_APPDATA_LOCAL_ACTION_DENIED',
      'Local view actions are client-local and cannot be dispatched remotely.',
    );
  }
  // ---- Stage 07C Phase F: the governed mutation envelope (additive) -------
  // A payload WITHOUT `mutation` keeps the EXACT legacy identity-only adapter
  // request below. A payload WITH `mutation` carries the declared mutation
  // request through a closed, plan-resolved, contract-fenced envelope into
  // the conforming `ApplicationDataMutationRequest` shape.
  if (input.mutation !== undefined) {
    return remoteMutateEnvelope(actor, options, input, resourceId);
  }
  try {
    return await options.data.mutate({
      kind: 'mutate',
      resourceId,
      releaseVersion,
      actorId: actor.actorId,
      expectedRevision,
      actionKind,
    });
  } catch (error) {
    if (error instanceof VictControlError) {
      throw error;
    }
    throw new VictControlError(
      'VICT_APPDATA_FILTER_INVALID',
      'The mutation could not be processed safely.',
    );
  }
}

/**
 * The governed mutation-envelope path (Stage 07C Phase F).
 *
 * Resolves the payload's `actionId` against the composed compiled plan,
 * validates the closed mutation envelope (op/id/input/idempotencyKey only),
 * re-validates the declared delivery-safe input domain, parses the input
 * through the action's declared input contract when the contract resolver is
 * composed (first fence — the adapter remains the authoritative second
 * fence), and forwards EXACTLY the conforming `ApplicationDataMutationRequest`
 * shape into the Application data port. Every failure is a stable,
 * non-echoing rejection code; no undeclared field, no ambient value, and no
 * second execution trigger can reach the adapter.
 */
async function remoteMutateEnvelope(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
  resourceId: string,
): Promise<unknown> {
  // The action identity is REQUIRED and must resolve against the composed
  // compiled plan (handoff §6.3): unknown action, kind mismatch, stale
  // expectedActionRevision, resource mismatch, or envelope op differing from
  // the plan-declared op all fail closed with ONE stable code.
  if (typeof input.actionId !== 'string' || input.actionId.length === 0) {
    throw new VictControlError(
      'VICT_APPDATA_ACTION_UNRESOLVED',
      'The mutation envelope requires a compiled-plan actionId; no action identity was declared.',
    );
  }
  const actionId = bounded(input.actionId, 'actionId');
  // Execution identity is server-derived (never client-supplied) and is
  // asserted present before any envelope dispatch; the composed port carries
  // actor identity through its own request context.
  if (typeof actor.actorId !== 'string' || actor.actorId.length === 0) {
    throw new VictControlError(
      'VICT_APPDATA_ACTOR_IDENTITY_MISSING',
      'The mutation envelope requires an authenticated server actor.',
    );
  }
  if (options.resolveAction === undefined) {
    throw new VictControlError(
      'VICT_APPDATA_ACTION_UNRESOLVED',
      'No compiled-plan action resolver is composed; the mutation envelope cannot be resolved.',
    );
  }
  const action = options.resolveAction(actionId);
  if (action === undefined || action.kind !== 'mutation') {
    throw new VictControlError(
      'VICT_APPDATA_ACTION_UNRESOLVED',
      'The declared actionId does not resolve to a declared mutation action in the composed plan.',
    );
  }
  if (input.expectedActionRevision !== undefined) {
    const expectedActionRevision = bounded(
      input.expectedActionRevision,
      'expectedActionRevision',
      128,
    );
    if (expectedActionRevision !== action.revision) {
      throw new VictControlError(
        'VICT_APPDATA_ACTION_UNRESOLVED',
        'The declared expectedActionRevision does not match the composed plan revision for the resolved action.',
      );
    }
  }
  if (action.resourceId !== resourceId) {
    throw new VictControlError(
      'VICT_APPDATA_ACTION_UNRESOLVED',
      'The declared resourceId does not match the composed-plan resource of the resolved action.',
    );
  }
  // Closed envelope capture (BEFORE any envelope field is read).
  const envelope = captureMutationEnvelope(input.mutation);
  const op = envelope.op;
  if (typeof op !== 'string' || op.length === 0 || op.length > MUTATION_ENVELOPE_OP_MAX_LENGTH) {
    throw new VictControlError(
      'VICT_APPDATA_FIELD_INVALID',
      "The 'mutation' envelope op must be a bounded string.",
    );
  }
  if (op !== action.op) {
    throw new VictControlError(
      'VICT_APPDATA_ACTION_UNRESOLVED',
      "The 'mutation' envelope op does not match the plan-declared op of the resolved action.",
    );
  }
  let id: string | undefined;
  if (envelope.id !== undefined) {
    id = bounded(envelope.id, 'mutation.id');
    if (id.length > MUTATION_ENVELOPE_ID_MAX_LENGTH) {
      throw new VictControlError(
        'VICT_APPDATA_FIELD_INVALID',
        "The 'mutation' envelope id must be a bounded identifier.",
      );
    }
  }
  let idempotencyKey: string | undefined;
  if (envelope.idempotencyKey !== undefined) {
    idempotencyKey = bounded(
      envelope.idempotencyKey,
      'mutation.idempotencyKey',
      MUTATION_ENVELOPE_IDEMPOTENCY_KEY_MAX_LENGTH,
    );
  }
  const envelopeInput = envelope.input;
  if (envelopeInput !== undefined) {
    // Delivery-safe value domain, bounds, and special-key safety (defense in
    // depth; the command canonicalization already guarantees plain data on
    // the command path — direct callers are contained here with the same
    // stable, non-echoing codes).
    assertMutationInput(envelopeInput);
  }
  // First fence: parse the input through the action's DECLARED input
  // contract when the composition supplies the resolver (handoff §6.5).
  // A resolver that cannot supply the declared contract fails closed; a
  // contract rejection is stable and non-echoing (codes and bounded paths
  // only — never the received values).
  if (action.inputContractId !== undefined && options.resolveInputContract !== undefined) {
    const contract = options.resolveInputContract(actionId);
    if (contract === undefined) {
      throw new VictControlError(
        'VICT_APPDATA_CONTRACT_RESOLVER_UNAVAILABLE',
        `The declared input contract for action '${actionId}' is not composed; the mutation cannot be validated at the boundary.`,
      );
    }
    let parsed;
    try {
      parsed = contract.parse(envelopeInput);
    } catch {
      throw new VictControlError(
        'VICT_APPDATA_INPUT_CONTRACT_REJECTED',
        'The mutation input could not be validated by the declared input contract.',
      );
    }
    if (!parsed.ok) {
      throw new VictControlError(
        'VICT_APPDATA_INPUT_CONTRACT_REJECTED',
        'The mutation input was rejected by the declared input contract of the resolved action.',
      );
    }
  }
  // Forward EXACTLY the conforming ApplicationDataMutationRequest shape of
  // the Application data port — no envelope scaffolding, no ambient fields,
  // no second effect path. The command's own durable idempotency key still
  // governs the dispatch; the envelope's domain key (when present) reaches
  // only the adapter's keyed reconciliation.
  try {
    return await options.data.mutate({
      resourceId,
      op,
      ...(envelopeInput !== undefined ? { input: envelopeInput } : {}),
      ...(id !== undefined ? { id } : {}),
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    });
  } catch (error) {
    if (error instanceof VictControlError) {
      throw error;
    }
    throw new VictControlError(
      'VICT_APPDATA_FILTER_INVALID',
      'The mutation could not be processed safely.',
    );
  }
}

/** The VICT-action boundary (governed Vict actions through the same server authorization). */
export async function remoteAction(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
): Promise<unknown> {
  const actionKind = bounded(input.actionKind, 'actionKind', 32);
  if (actionKind === 'local') {
    throw new VictControlError(
      'VICT_APPDATA_LOCAL_ACTION_DENIED',
      'Local view actions are client-local and cannot be dispatched remotely.',
    );
  }
  if (actionKind === 'query' || actionKind === 'mutation') {
    return actionKind === 'query'
      ? remoteQuery(actor, options, input)
      : remoteMutate(actor, options, input);
  }
  // capability / signal / navigation actions must reference their exact
  // declared identities; the composition supplies the authorized handler.
  throw new VictControlError(
    'VICT_APPDATA_ACTION_UNAVAILABLE',
    'The declared action kind is not composed in this deployment.',
  );
}
