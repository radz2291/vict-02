import type { Contract } from '@vict/contracts';
import type { CapabilityDescriptor, CapabilityIndex, ContractEnvironment } from '@vict/kernel';
import { VictRuntimeError } from './errors.js';
import type { CapabilityDefinition, DoubleInvoke } from './types.js';

/** A frozen copy of the execution-relevant parts of a capability definition. */
export interface FrozenCapabilityBinding {
  readonly id: string;
  readonly revision: string;
  readonly effect: CapabilityDefinition['effect'];
  readonly invoke: CapabilityDefinition['invoke'];
  readonly inputContractId?: string;
  readonly inputRevision?: string;
  readonly outputContractId?: string;
  readonly outputRevision?: string;
}

function isValidRevision(revision: unknown): revision is string {
  return typeof revision === 'string' && revision.length > 0;
}

/**
 * Owns registered capabilities, contracts, and test doubles for one runtime.
 * Not a global registry: every runtime instance carries its own.
 *
 * Registration validates author/build revisions (structured errors), because
 * revisions feed activation identity. Live maps are never exposed: consumers
 * receive descriptors or frozen copies.
 */
export class CapabilityRegistry {
  readonly #capabilities = new Map<string, CapabilityDefinition<unknown, unknown>>();
  /**
   * Stage 03: historical revisions per capability id. Registering a NEW
   * revision for an existing id adds a resolvable revision instead of
   * replacing the current one, so suspended runs can restore their exact
   * pinned activation artifacts (handoff §17). The same id+revision may
   * never be registered twice.
   */
  readonly #capabilityRevisions = new Map<string, Map<string, CapabilityDefinition<unknown, unknown>>>();
  readonly #contracts = new Map<string, Contract<unknown>>();
  readonly #contractRevisions = new Map<string, Map<string, Contract<unknown>>>();
  readonly #doubles = new Map<string, DoubleInvoke>();

  registerCapability(definition: CapabilityDefinition): void {
    if (typeof definition.id !== 'string' || definition.id.length === 0) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CAPABILITY',
        'Capability id must be a non-empty string.',
      );
    }
    const existing = this.#capabilities.get(definition.id);
    if (existing && existing.revision === definition.revision) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DUPLICATE_CAPABILITY',
        `Capability '${definition.id}' revision '${definition.revision}' is already registered in this runtime.`,
      );
    }
    if (this.#capabilityRevisions.get(definition.id)?.has(definition.revision)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DUPLICATE_CAPABILITY',
        `Capability '${definition.id}' revision '${definition.revision}' is already registered in this runtime.`,
      );
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
    this.#capabilities.set(definition.id, definition as CapabilityDefinition<unknown, unknown>);
    let capabilityRevisions = this.#capabilityRevisions.get(definition.id);
    if (!capabilityRevisions) {
      capabilityRevisions = new Map<string, CapabilityDefinition<unknown, unknown>>();
      this.#capabilityRevisions.set(definition.id, capabilityRevisions);
    }
    capabilityRevisions.set(definition.revision, definition as CapabilityDefinition<unknown, unknown>);
    // Capability-embedded contracts are published under their own ids so the
    // kernel can validate against them at execution time.
    if (definition.input) {
      this.registerContract(definition.input);
    }
    if (definition.output) {
      this.registerContract(definition.output);
    }
  }

  registerContract(contract: Contract<unknown>): void {
    if (typeof contract.id !== 'string' || contract.id.length === 0) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_INVALID_CONTRACT',
        'Contract id must be a non-empty string.',
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
    if (!existing) {
      this.#contracts.set(contract.id, contract);
    }
    let contractRevisions = this.#contractRevisions.get(contract.id);
    if (!contractRevisions) {
      contractRevisions = new Map<string, Contract<unknown>>();
      this.#contractRevisions.set(contract.id, contractRevisions);
    }
    const priorRevision = contractRevisions.get(contract.revision);
    if (priorRevision !== undefined && priorRevision !== contract) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_CONTRACT_CONFLICT',
        `Contract id '${contract.id}' revision '${contract.revision}' is already registered with a different contract object.`,
      );
    }
    contractRevisions.set(contract.revision, contract);
  }

  /**
   * Register a test double. Doubles are runtime test configuration: they are
   * not part of activation identity, and each run snapshots them at run
   * start. Duplicate registration is rejected — use `replaceDouble` for an
   * explicit replacement.
   */
  registerDouble(capabilityId: string, invoke: DoubleInvoke): void {
    if (!this.#capabilities.has(capabilityId)) {
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
    if (this.#doubles.has(capabilityId)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DOUBLE_ALREADY_REGISTERED',
        `A test double for capability '${capabilityId}' is already registered. Use replaceDouble() for an explicit replacement.`,
      );
    }
    this.#doubles.set(capabilityId, invoke);
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
    this.#doubles.set(capabilityId, invoke);
  }

  hasDouble(capabilityId: string): boolean {
    return this.#doubles.has(capabilityId);
  }

  getDouble(capabilityId: string): DoubleInvoke | undefined {
    return this.#doubles.get(capabilityId);
  }

  /** Snapshot the current doubles at run start. In-flight runs cannot observe later changes. */
  snapshotDoubles(): ReadonlyMap<string, DoubleInvoke> {
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

  capabilityIndex(): CapabilityIndex {
    const capabilities = this.#capabilities;
    return {
      getCapabilityDescriptor(capabilityId: string): CapabilityDescriptor | undefined {
        const definition = capabilities.get(capabilityId);
        if (!definition) {
          return undefined;
        }
        return {
          id: definition.id,
          revision: definition.revision,
          effect: definition.effect,
          inputContractId: definition.input?.id,
          inputRevision: definition.input?.revision,
          outputContractId: definition.output?.id,
          outputRevision: definition.output?.revision,
          idempotency: definition.idempotency,
        };
      },
    };
  }

  /**
   * A capability index pinned to EXACT revisions (suspended-run
   * restoration). Unknown id/revision pairs resolve to undefined so the
   * kernel reports structured missing-artifact diagnostics instead of
   * silently substituting a nearby revision.
   */
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
        return {
          id: definition.id,
          revision: definition.revision,
          effect: definition.effect,
          inputContractId: definition.input?.id,
          inputRevision: definition.input?.revision,
          outputContractId: definition.output?.id,
          outputRevision: definition.output?.revision,
          idempotency: definition.idempotency,
        };
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
      isCompatible: (from, to) => from === undefined || to === undefined || from === to,
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
      isCompatible: (from, to) => from === undefined || to === undefined || from === to,
      get: (contractId) => {
        const revision = revisions.get(contractId);
        return revision === undefined
          ? this.#contracts.get(contractId)
          : this.#contractRevisions.get(contractId)?.get(revision);
      },
    };
  }
}
