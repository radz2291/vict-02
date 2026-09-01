import { victError } from '@vict/contracts';
import type { VictError } from '@vict/contracts';

/** Stable runtime-level error codes used by thrown configuration errors and defensive port failures. */
export type RuntimeErrorCode =
  | 'VICT_RUNTIME_NO_ACTIVE_GRAPH'
  | 'VICT_RUNTIME_DUPLICATE_CAPABILITY'
  | 'VICT_RUNTIME_INVALID_CAPABILITY'
  | 'VICT_RUNTIME_INVALID_REVISION'
  | 'VICT_RUNTIME_CONTRACT_CONFLICT'
  | 'VICT_RUNTIME_INVALID_CONTRACT'
  | 'VICT_RUNTIME_DOUBLE_FOR_UNKNOWN_CAPABILITY'
  | 'VICT_RUNTIME_DOUBLE_ALREADY_REGISTERED'
  | 'VICT_RUNTIME_DOUBLE_NOT_REGISTERED'
  | 'VICT_RUNTIME_UNKNOWN_NODE'
  | 'VICT_RUNTIME_CAPABILITY_MISSING'
  | 'VICT_RUNTIME_CAPABILITY_THREW'
  | 'VICT_RUNTIME_INVALID_RETENTION'
  | 'VICT_RUNTIME_INVALID_STORES'
  | 'VICT_RUNTIME_STORE_FAILURE';

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

/** Build sanitised metadata for a thrown (untrusted) error. Never copies the message. */
export function sanitiseThrownError(cause: unknown): { errorName: string; errorId: string } {
  return {
    errorName: cause instanceof Error ? cause.name : typeof cause,
    errorId: `err_${randomId()}`,
  };
}

function randomId(): string {
  // Runtime is an in-process Node package; a random correlation id is fine here.
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
