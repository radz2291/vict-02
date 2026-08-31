import type { Contract } from '@vict/contracts';
import type { CapabilityDescriptor, CapabilityIndex, ContractEnvironment } from '@vict/kernel';
import { VictRuntimeError } from './errors.js';
import type { CapabilityDefinition, DoubleInvoke } from './types.js';

/**
 * Owns registered capabilities, contracts, and test doubles for one runtime.
 * Not a global registry: every runtime instance carries its own.
 */
export class CapabilityRegistry {
  readonly #capabilities = new Map<string, CapabilityDefinition<unknown, unknown>>();
  readonly #contracts = new Map<string, Contract<unknown>>();
  readonly #doubles = new Map<string, DoubleInvoke>();

  registerCapability(definition: CapabilityDefinition): void {
    if (typeof definition.id !== 'string' || definition.id.length === 0) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DUPLICATE_CAPABILITY',
        'Capability id must be a non-empty string.',
      );
    }
    if (this.#capabilities.has(definition.id)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DUPLICATE_CAPABILITY',
        `Capability '${definition.id}' is already registered in this runtime.`,
      );
    }
    if (typeof definition.invoke !== 'function') {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DUPLICATE_CAPABILITY',
        `Capability '${definition.id}' must provide an invoke function.`,
      );
    }
    this.#capabilities.set(definition.id, definition as CapabilityDefinition<unknown, unknown>);
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
    const existing = this.#contracts.get(contract.id);
    if (existing && existing !== contract) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_CONTRACT_CONFLICT',
        `Contract id '${contract.id}' is already registered with a different contract object.`,
      );
    }
    if (!existing) {
      this.#contracts.set(contract.id, contract);
    }
  }

  registerDouble(capabilityId: string, invoke: DoubleInvoke): void {
    if (!this.#capabilities.has(capabilityId)) {
      throw new VictRuntimeError(
        'VICT_RUNTIME_DOUBLE_FOR_UNKNOWN_CAPABILITY',
        `Cannot register a test double for unknown capability '${capabilityId}'. Register the capability first.`,
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

  getCapability(capabilityId: string): CapabilityDefinition<unknown, unknown> | undefined {
    return this.#capabilities.get(capabilityId);
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
          effect: definition.effect,
          inputContractId: definition.input?.id,
          outputContractId: definition.output?.id,
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
}
