/** Structured errors thrown when a contract definition itself is invalid. */

export type ContractDefinitionErrorCode =
  'EMPTY_CONTRACT_ID' | 'INVALID_CONTRACT_REVISION' | 'MISSING_CONTRACT_PARSE';

/** Thrown only for programmer errors at contract-authoring time; data-level validation never throws. */
export class ContractDefinitionError extends Error {
  readonly code: ContractDefinitionErrorCode;
  readonly details?: unknown;

  constructor(code: ContractDefinitionErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ContractDefinitionError';
    this.code = code;
    this.details = details;
  }
}
