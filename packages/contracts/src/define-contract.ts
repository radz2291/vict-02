import type { Contract, ContractDefinition, ContractResult } from './types.js';
import { ContractDefinitionError } from './errors.js';

/**
 * Define a Vict contract from a neutral definition.
 *
 * This is the base authoring API and is schema-library neutral: no schema
 * library appears in the signature or in emitted declarations. For schema
 * library convenience use an optional adapter such as
 * `defineZodContract` from `@vict/contracts/zod`.
 *
 * The `revision` is an author/build responsibility: changing the contract's
 * accepted shape or semantics requires publishing a new revision so activation
 * identity can distinguish the change.
 */
export function defineContract<T>(definition: ContractDefinition<T>): Contract<T> {
  validateContractIdentity(definition.id, definition.revision);
  if (typeof definition.parse !== 'function') {
    throw new ContractDefinitionError(
      'MISSING_CONTRACT_PARSE',
      `Contract '${definition.id}' must provide a parse function.`,
    );
  }
  const contract: Contract<T> = {
    id: definition.id,
    revision: definition.revision,
    expected: definition.expected ?? definition.id,
    parse: (input: unknown): ContractResult<T> => definition.parse(input),
  };
  return Object.freeze(contract);
}

/** Validate contract identity fields; shared by the base API and adapters. */
export function validateContractIdentity(id: unknown, revision: unknown): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new ContractDefinitionError(
      'EMPTY_CONTRACT_ID',
      'Contract id must be a non-empty string.',
    );
  }
  if (typeof revision !== 'string' || revision.length === 0) {
    throw new ContractDefinitionError(
      'INVALID_CONTRACT_REVISION',
      `Contract '${id}' must declare a non-empty revision string (e.g. revision: '1').`,
      { contractId: id },
    );
  }
}
