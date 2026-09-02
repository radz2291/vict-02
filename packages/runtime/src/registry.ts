import { NEUTRAL_JSON_CONTRACT_ID, type Contract } from '@vict/contracts';
import type {
  CapabilityDescriptor,
  CapabilityIndex,
  ContractEnvironment,
  EffectClass,
} from '@vict/kernel';
import { VictRuntimeError } from './errors.js';
import type { CapabilityDefinition, DoubleInvoke } from './types.js';
import {
  gateCapabilityInvoke,
  pinAuthorityDeclarations,
  type CapabilityAuthority,
} from './authority.js';

/** A frozen copy of the execution-relevant parts of a capability definition. */
export interface FrozenCapabilityBinding {
  readonly id: string;
  readonly revision: string;
  readonly effect: CapabilityDefinition['effect'];
  readonly invoke: CapabilityDefinition['invoke'];
  /** Declared idempotency semantics (drives write-timeout retry classification). */
  readonly idempotency?: CapabilityDefinition['idempotency'];
  readonly inputContractId?: string;
  readonly inputRevision?: string;
  readonly outputContractId?: string;
  readonly outputRevision?: string;
  readonly authority?: CapabilityDescriptor['authority'];
}

/** Modes in which a registered test double is eligible to run. */
export type DoubleMode = 'test' | 'simulate';

/** A registered test double with its declared mode-eligibility policy. */
export interface RegisteredDouble {
  readonly invoke: DoubleInvoke;
  /** The double NEVER runs in 'normal' mode; only these declared modes may use it. */
  readonly modes: ReadonlySet<DoubleMode>;
}

function isValidRevision(revision: unknown): revision is string {
  return typeof revision === 'string' && revision.trim().length > 0;
}

/**
 * The closed field set of a capability definition. Unknown fields are
 * rejected at the public registration boundary: a misspelled authority
 * field (e.g. `permissionsTypo`) must fail loudly instead of silently
 * dropping the author's intended enforcement.
 */
const CAPABILITY_DEFINITION_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'effect',
  'input',
  'output',
  'invoke',
  'idempotency',
  'permissions',
  'configuration',
  'requiredConfiguration',
  'secrets',
  'requiredSecrets',
]);

/** A contract-shaped object: identity + revision + a parse callable. */
function isContractShaped(value: unknown): value is Contract<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { revision?: unknown }).revision === 'string' &&
    typeof (value as { parse?: unknown }).parse === 'function'
  );
}

/** Staging area for an atomic capability-pack installation. */
export interface RegistryStagingArea {
  registerContract(contract: Contract<unknown>): void;
  registerCapability(definition: CapabilityDefinition): void;
  registerDouble(
    capabilityId: string,
    invoke: DoubleInvoke,
    options?: { readonly modes?: readonly DoubleMode[] },
  ): void;
}

/**
 * Owns registered capabilities, contracts, and test doubles for one runtime.
 * Not a global registry: every runtime instance carries its own.
 *
 * Registration validates author/build revisions and the full executable
 * definition (closed fields, effect vocabulary, CONT-001 contract presence,
 * authority names), because revisions and declarations feed activation
 * identity. Live maps are never exposed: consumers receive descriptors or
 * frozen copies.
 *
 * Atomic batch installation (HIGH-04-A): `installBatch` stages every
 * contract/capability/double against a staging overlay WITHOUT mutating any
 * live map, and commits the complete batch only when every step succeeds.
 * Any failure leaves the registry byte-for-byte semantically unchanged —
 * there is no best-effort rollback of partially registered entries.
 */
export class CapabilityRegistry {
  readonly #authority: CapabilityAuthority | undefined;
  readonly #capabilities = new Map<string, CapabilityDefinition<unknown, unknown>>();
  /**
   * Historical revisions per capability id. Registering a NEW revision for
   * an existing id adds a resolvable revision instead of replacing the
   * current one, so suspended runs can restore their exact pinned
   * activation artifacts. The same id+revision may never be registered
   * twice.
   */
  readonly #capabilityRevisions = new Map<
    string,
    Map<string, CapabilityDefinition<unknown, unknown>>
  >();
  readonly #contracts = new Map<string, Contract<unknown>>();
  readonly #contractRevisions = new Map<string, Map<string, Contract<unknown>>>();
  readonly #doubles = new Map<string, RegisteredDouble>();

  /** Active staging overlay (set only inside `installBatch`). */
  #staging:
    | {
        readonly contracts: Map<string, Map<string, Contract<unknown>>>;
        readonly capabilities: Map<string, Map<string, CapabilityDefinition<unknown, unknown>>>;
        readonly doubles: Map<string, RegisteredDouble>;
      }
    | undefined;

  constructor(authority?: CapabilityAuthority) {
    this.#authority = authority;
  }

  // ---- Validation ---------------------------------------------------------

  /** Full executable-definition validation at the public registration boundary. */
  #validateCapabilityDefinition(definition: CapabilityDefinition): void {
    if (typeof definition.id !== 'string' || definition.id.trim().length === 0) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CAPABILITY',
        'Capability id must be a non-empty, non-whitespace string.',
      );
    }
    for (const key of Object.keys(definition as unknown as Record<string, unknown>)) {
      if (!CAPABILITY_DEFINITION_FIELDS.has(key)) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_UNKNOWN_DEFINITION_FIELD',
          `Capability '${definition.id}' declares unknown field '${key}'; the capability-definition schema is closed. A misspelled authority or metadata field is rejected instead of silently dropping the author's intended semantics.`,
          { capabilityId: definition.id, field: key },
        );
      }
    }
    if (!isValidRevision(definition.revision)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_REVISION',
        `Capability '${definition.id}' must declare a non-empty revision string (e.g. revision: '1'). ` +
          'Changing handler logic or execution metadata requires changing the revision.',
        { capabilityId: definition.id },
      );
    }
    if (typeof definition.invoke !== 'function') {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CAPABILITY',
        `Capability '${definition.id}' must provide an invoke function.`,
      );
    }
    const effect = definition.effect as unknown;
    if (typeof effect !== 'string' || !['pure', 'read', 'write', 'irreversible'].includes(effect)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_EFFECT',
        `Capability '${definition.id}' declares effect '${String(definition.effect)}', which is not in the closed effect vocabulary ('pure', 'read', 'write', 'irreversible').`,
        { capabilityId: definition.id, effect: String(definition.effect) },
      );
    }
    if (definition.idempotency !== undefined && definition.idempotency !== 'keyed') {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CAPABILITY',
        `Capability '${definition.id}' declares unsupported idempotency '${String(definition.idempotency)}'; only 'keyed' (or absent) is supported.`,
        { capabilityId: definition.id },
      );
    }
    // CONT-001: every executable capability declares BOTH input and output
    // contracts. Enforced at the public registration/pack-installation
    // boundary — TypeScript typing alone cannot guarantee it for plain
    // JavaScript objects.
    for (const role of ['input', 'output'] as const) {
      const contract = definition[role];
      if (contract === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_MISSING_CONTRACT',
          `Capability '${definition.id}' must declare an ${role} contract (CONT-001: every executable capability declares its input and output contracts). Use a deliberate neutral contract (e.g. vict.neutral.json) when the boundary intentionally accepts arbitrary JSON values.`,
          { capabilityId: definition.id, role },
        );
      }
      if (!isContractShaped(contract)) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_INVALID_CONTRACT',
          `Capability '${definition.id}' declares an ${role} contract without a contract identity (id, revision) and a parse function.`,
          { capabilityId: definition.id, role },
        );
      }
    }
    // Authority declarations are executable semantics: validate every name,
    // reject duplicates and whitespace-only entries, and PIN (copy + freeze)
    // the declaration snapshot used by the invocation gate.
    pinAuthorityDeclarations(definition);
  }

  // ---- Registration -------------------------------------------------------

  registerCapability(definition: CapabilityDefinition): void {
    this.#validateCapabilityDefinition(definition);
    if (this.#capabilityRevisions.get(definition.id)?.has(definition.revision)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DUPLICATE_CAPABILITY',
        `Capability '${definition.id}' revision '${definition.revision}' is already registered in this runtime.`,
      );
    }
    // Stage 04 least-authority gate: the WRAPPED invoke is what activations
    // capture, so permission/secret/configuration enforcement is identical
    // on the sequential and durable engines. Default-deny: a definition
    // that declares permissions/requirements is gated even when the runtime
    // has NO authority configured (empty grants, absent ports). The gate
    // closes over PINNED (copied + frozen) declaration snapshots, never the
    // caller's arrays. Function-bearing fields are captured by reference.
    const declaresAuthorityRequirements =
      (definition.permissions !== undefined && definition.permissions.length > 0) ||
      (definition.requiredConfiguration !== undefined &&
        definition.requiredConfiguration.length > 0) ||
      (definition.requiredSecrets !== undefined && definition.requiredSecrets.length > 0);
    const needsGate = this.#authority !== undefined || declaresAuthorityRequirements;
    const effective: CapabilityDefinition<unknown, unknown> = needsGate
      ? {
          ...(definition as CapabilityDefinition<unknown, unknown>),
          invoke: gateCapabilityInvoke(definition, this.#authority ?? {}),
        }
      : (definition as CapabilityDefinition<unknown, unknown>);
    this.#commitCapability(definition.id, definition.revision, effective);
    // Capability-embedded contracts are published under their own ids so the
    // kernel can validate against them at execution time.
    if (definition.input) {
      this.registerContract(definition.input);
    }
    if (definition.output) {
      this.registerContract(definition.output);
    }
  }

  /** Commit one capability registration to live or staged storage. */
  #commitCapability(
    id: string,
    revision: string,
    effective: CapabilityDefinition<unknown, unknown>,
  ): void {
    if (this.#staging !== undefined) {
      let revisions = this.#staging.capabilities.get(id);
      if (!revisions) {
        revisions = new Map<string, CapabilityDefinition<unknown, unknown>>();
        this.#staging.capabilities.set(id, revisions);
      }
      if (revisions.has(revision)) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_DUPLICATE_CAPABILITY',
          `Capability '${id}' revision '${revision}' is already staged by this installation.`,
        );
      }
      revisions.set(revision, effective);
      return;
    }
    this.#capabilities.set(id, effective);
    let capabilityRevisions = this.#capabilityRevisions.get(id);
    if (!capabilityRevisions) {
      capabilityRevisions = new Map<string, CapabilityDefinition<unknown, unknown>>();
      this.#capabilityRevisions.set(id, capabilityRevisions);
    }
    capabilityRevisions.set(revision, effective);
  }

  registerContract(contract: Contract<unknown>): void {
    if (typeof contract.id !== 'string' || contract.id.trim().length === 0) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CONTRACT',
        'Contract id must be a non-empty, non-whitespace string.',
      );
    }
    if (!isValidRevision(contract.revision)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CONTRACT',
        `Contract '${contract.id}' must declare a non-empty revision string (e.g. revision: '1'). ` +
          'Changing contract semantics requires changing the revision.',
        { contractId: contract.id },
      );
    }
    const existing = this.#contracts.get(contract.id);
    if (existing && existing !== contract) {
      if (existing.revision === contract.revision) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_CONTRACT_CONFLICT',
          `Contract id '${contract.id}' revision '${contract.revision}' is already registered with a different contract object.`,
        );
      }
      // A new revision for an existing contract id: both remain resolvable.
    }
    if (!existing && this.#staging === undefined) {
      this.#contracts.set(contract.id, contract);
    }
    const revisionMap =
      this.#staging !== undefined
        ? this.#contractRevisionMapFor(this.#staging.contracts, contract.id)
        : this.#contractRevisionMapFor(this.#contractRevisions, contract.id);
    const priorRevision = revisionMap.get(contract.revision);
    if (priorRevision !== undefined && priorRevision !== contract) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_CONTRACT_CONFLICT',
        `Contract id '${contract.id}' revision '${contract.revision}' is already registered with a different contract object.`,
      );
    }
    revisionMap.set(contract.revision, contract);
  }

  #contractRevisionMapFor(
    map: Map<string, Map<string, Contract<unknown>>>,
    id: string,
  ): Map<string, Contract<unknown>> {
    let revisions = map.get(id);
    if (!revisions) {
      revisions = new Map<string, Contract<unknown>>();
      map.set(id, revisions);
    }
    return revisions;
  }

  /**
   * Register a test double. Doubles are runtime test configuration: they are
   * not part of activation identity, and each run snapshots them at run
   * start. A double NEVER runs in normal mode; without an explicit
   * `modes` option it is eligible in both 'test' and 'simulate'. Duplicate
   * registration is rejected — use `replaceDouble` for an explicit
   * replacement.
   */
  registerDouble(
    capabilityId: string,
    invoke: DoubleInvoke,
    options: { readonly modes?: readonly DoubleMode[] } = {},
  ): void {
    if (!this.#capabilities.has(capabilityId) && !this.#staging?.capabilities.has(capabilityId)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DOUBLE_FOR_UNKNOWN_CAPABILITY',
        `Cannot register a test double for unknown capability '${capabilityId}'. Register the capability first.`,
      );
    }
    if (typeof invoke !== 'function') {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CAPABILITY',
        `Test double for '${capabilityId}' must be a function.`,
      );
    }
    if (this.#doubles.has(capabilityId) || this.#staging?.doubles.has(capabilityId)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DOUBLE_ALREADY_REGISTERED',
        `A test double for capability '${capabilityId}' is already registered. Use replaceDouble() for an explicit replacement.`,
      );
    }
    const modes = new Set<DoubleMode>(options.modes ?? ['test', 'simulate']);
    if (modes.size === 0) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CAPABILITY',
        `Test double for '${capabilityId}' must declare at least one eligible mode ('test' or 'simulate').`,
      );
    }
    const registered: RegisteredDouble = { invoke, modes: Object.freeze(modes) };
    if (this.#staging !== undefined) {
      this.#staging.doubles.set(capabilityId, registered);
    } else {
      this.#doubles.set(capabilityId, registered);
    }
  }

  /** Explicitly replace an existing test double. Requires a double to be registered. */
  replaceDouble(capabilityId: string, invoke: DoubleInvoke): void {
    if (!this.#capabilities.has(capabilityId)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DOUBLE_FOR_UNKNOWN_CAPABILITY',
        `Cannot replace a test double for unknown capability '${capabilityId}'. Register the capability first.`,
      );
    }
    if (!this.#doubles.has(capabilityId)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DOUBLE_NOT_REGISTERED',
        `No test double is registered for capability '${capabilityId}'. Use registerDouble() first.`,
      );
    }
    this.#doubles.set(capabilityId, {
      invoke,
      modes:
        this.#doubles.get(capabilityId)?.modes ??
        Object.freeze(new Set<DoubleMode>(['test', 'simulate'])),
    });
  }

  hasDouble(capabilityId: string): boolean {
    return this.#doubles.has(capabilityId);
  }

  getDoubleModes(capabilityId: string): ReadonlySet<DoubleMode> | undefined {
    return this.#doubles.get(capabilityId)?.modes;
  }

  /** Snapshot the current doubles at run start. In-flight runs cannot observe later changes. */
  snapshotDoubles(): ReadonlyMap<string, RegisteredDouble> {
    return new Map(this.#doubles);
  }

  getCapability(capabilityId: string): CapabilityDefinition<unknown, unknown> | undefined {
    return this.#capabilities.get(capabilityId);
  }

  /** Resolve a capability by exact revision (suspended-run restoration). */
  getCapabilityRevision(
    capabilityId: string,
    revision: string,
  ): CapabilityDefinition<unknown, unknown> | undefined {
    return this.#capabilityRevisions.get(capabilityId)?.get(revision);
  }

  getContract(contractId: string): Contract<unknown> | undefined {
    return this.#contracts.get(contractId);
  }

  /** Resolve a contract by exact revision (suspended-run restoration). */
  getContractRevision(contractId: string, revision: string): Contract<unknown> | undefined {
    return this.#contractRevisions.get(contractId)?.get(revision);
  }

  // ---- Atomic batch installation (HIGH-04-A) -------------------------------

  /**
   * Install a batch atomically. `step` registers contracts, capabilities,
   * and doubles through the staging area; NOTHING touches the live maps
   * until the callback returns successfully. Any throw — a validation
   * failure, a collision with the live registry, or a collision inside the
   * batch — discards the staging overlay and leaves the registry
   * semantically unchanged: no capability, contract, or double from the
   * attempted batch is resolvable afterwards.
   *
   * The staging overlay participates in collision checks, so both
   * batch-vs-registry and batch-internal duplicates are detected BEFORE any
   * commit.
   */
  installBatch(install: (staging: RegistryStagingArea) => void): void {
    if (this.#staging !== undefined) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_STORES',
        'A registry batch installation is already in progress.',
      );
    }
    this.#staging = {
      contracts: new Map(),
      capabilities: new Map(),
      doubles: new Map(),
    };
    const staging = this.#staging;
    try {
      install({
        registerContract: (contract) => this.registerContract(contract),
        registerCapability: (definition) => this.registerCapability(definition),
        registerDouble: (capabilityId, invoke, options) =>
          this.registerDouble(capabilityId, invoke, options),
      });
    } catch (error) {
      this.#staging = undefined;
      throw error;
    }
    // Commit: contracts, then capabilities, then doubles — deterministic,
    // after EVERY validation and collision check has succeeded.
    for (const [, revisions] of staging.contracts) {
      for (const [, contract] of revisions) {
        this.#commitStagedContract(contract);
      }
    }
    for (const [, revisions] of staging.capabilities) {
      for (const [, effective] of revisions) {
        this.#capabilities.set(effective.id, effective);
        let capabilityRevisions = this.#capabilityRevisions.get(effective.id);
        if (!capabilityRevisions) {
          capabilityRevisions = new Map<string, CapabilityDefinition<unknown, unknown>>();
          this.#capabilityRevisions.set(effective.id, capabilityRevisions);
        }
        capabilityRevisions.set(effective.revision, effective);
      }
    }
    for (const [capabilityId, registered] of staging.doubles) {
      this.#doubles.set(capabilityId, registered);
    }
    this.#staging = undefined;
  }

  #commitStagedContract(contract: Contract<unknown>): void {
    const existing = this.#contracts.get(contract.id);
    if (!existing) {
      this.#contracts.set(contract.id, contract);
    }
    let contractRevisions = this.#contractRevisions.get(contract.id);
    if (!contractRevisions) {
      contractRevisions = new Map<string, Contract<unknown>>();
      this.#contractRevisions.set(contract.id, contractRevisions);
    }
    contractRevisions.set(contract.revision, contract);
  }

  // ---- Indexes -------------------------------------------------------------

  /**
   * A capability index pinned to EXACT revisions (suspended-run
   * restoration). Unknown id/revision pairs resolve to undefined so the
   * kernel reports structured missing-artifact diagnostics instead of
   * silently substituting a nearby revision.
   */
  capabilityIndex(): CapabilityIndex {
    const capabilities = this.#capabilities;
    return {
      getCapabilityDescriptor(capabilityId: string): CapabilityDescriptor | undefined {
        const definition = capabilities.get(capabilityId);
        if (!definition) {
          return undefined;
        }
        return descriptorOfPublic(definition);
      },
    };
  }

  capabilityIndexPinned(revisions: ReadonlyMap<string, string>): CapabilityIndex {
    return {
      getCapabilityDescriptor: (capabilityId: string): CapabilityDescriptor | undefined => {
        const revision = revisions.get(capabilityId);
        if (revision === undefined) {
          return undefined;
        }
        const definition = this.#capabilityRevisions.get(capabilityId)?.get(revision);
        if (!definition) {
          return undefined;
        }
        return descriptorOfPublic(definition);
      },
    };
  }

  contractEnvironment(): ContractEnvironment {
    const contracts = this.#contracts;
    return {
      has: (contractId) => contracts.has(contractId),
      // Night 01 static compatibility is identity-based: two adjacent
      // contracts are compatible when they are the same contract. Structural
      // compatibility is deferred until the contract system grows one.
      // The neutral JSON contract is deliberately untyped: it accepts any
      // canonical JSON value, so it is compatible with EVERY contract on
      // either side of an edge.
      isCompatible: (from, to) =>
        from === undefined ||
        to === undefined ||
        from === to ||
        from === NEUTRAL_JSON_CONTRACT_ID ||
        to === NEUTRAL_JSON_CONTRACT_ID,
      get: (contractId) => contracts.get(contractId),
    };
  }

  /** A contract environment pinned to exact revisions (suspended-run restoration). */
  contractEnvironmentPinned(revisions: ReadonlyMap<string, string>): ContractEnvironment {
    return {
      has: (contractId) => {
        const revision = revisions.get(contractId);
        return revision === undefined
          ? this.#contracts.has(contractId)
          : (this.#contractRevisions.get(contractId)?.has(revision) ?? false);
      },
      isCompatible: (from, to) =>
        from === undefined ||
        to === undefined ||
        from === to ||
        from === NEUTRAL_JSON_CONTRACT_ID ||
        to === NEUTRAL_JSON_CONTRACT_ID,
      get: (contractId) => {
        const revision = revisions.get(contractId);
        return revision === undefined
          ? this.#contracts.get(contractId)
          : this.#contractRevisions.get(contractId)?.get(revision);
      },
    };
  }
}

/** Module-level descriptor builder (keeps the class body free of self-references). */
function descriptorOfPublic(
  definition: CapabilityDefinition<unknown, unknown>,
): CapabilityDescriptor {
  const hasAuthority =
    (definition.permissions !== undefined && definition.permissions.length > 0) ||
    (definition.configuration !== undefined && definition.configuration.length > 0) ||
    (definition.requiredConfiguration !== undefined &&
      definition.requiredConfiguration.length > 0) ||
    (definition.secrets !== undefined && definition.secrets.length > 0) ||
    (definition.requiredSecrets !== undefined && definition.requiredSecrets.length > 0);
  return {
    id: definition.id,
    revision: definition.revision,
    effect: definition.effect as EffectClass,
    inputContractId: definition.input?.id,
    inputRevision: definition.input?.revision,
    outputContractId: definition.output?.id,
    outputRevision: definition.output?.revision,
    idempotency: definition.idempotency,
    ...(hasAuthority
      ? {
          authority: {
            ...(definition.permissions !== undefined && definition.permissions.length > 0
              ? { permissions: Object.freeze([...definition.permissions]) }
              : {}),
            ...(definition.configuration !== undefined && definition.configuration.length > 0
              ? { configuration: Object.freeze([...definition.configuration]) }
              : {}),
            ...(definition.requiredConfiguration !== undefined &&
            definition.requiredConfiguration.length > 0
              ? { requiredConfiguration: Object.freeze([...definition.requiredConfiguration]) }
              : {}),
            ...(definition.secrets !== undefined && definition.secrets.length > 0
              ? { secrets: Object.freeze([...definition.secrets]) }
              : {}),
            ...(definition.requiredSecrets !== undefined && definition.requiredSecrets.length > 0
              ? { requiredSecrets: Object.freeze([...definition.requiredSecrets]) }
              : {}),
          },
        }
      : {}),
  };
}
