import { victError } from '@vict/contracts';
import type { VictError } from '@vict/contracts';

/** Stable runtime-level error codes used by thrown configuration errors and defensive port failures. */
export type RuntimeErrorCode =
  | 'VICT_RUNTIME_NO_ACTIVE_GRAPH'
  | 'VICT_RUNTIME_DUPLICATE_CAPABILITY'
  | 'VICT_RUNTIME_CONTRACT_CONFLICT'
  | 'VICT_RUNTIME_DOUBLE_FOR_UNKNOWN_CAPABILITY'
  | 'VICT_RUNTIME_UNKNOWN_NODE'
  | 'VICT_RUNTIME_CAPABILITY_MISSING'
  | 'VICT_RUNTIME_CAPABILITY_THREW';

/** Thrown only for programmer/configuration errors; data-level failures are structured values. */
export class VictRuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  readonly details?: unknown;

  constructor(code: RuntimeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'VictRuntimeError';
    this.code = code;
    this.details = details;
  }
}

export function runtimeError(
  code: RuntimeErrorCode,
  message: string,
  details?: unknown,
): VictError {
  return victError(code, message, details);
}
