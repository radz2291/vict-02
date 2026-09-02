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
  | 'VICT_RUNTIME_CONTRACT_PARSER_THREW'
  | 'VICT_RUNTIME_PERMISSION_DENIED'
  | 'VICT_RUNTIME_SECRET_UNAVAILABLE'
  | 'VICT_RUNTIME_CONFIGURATION_UNAVAILABLE'
  | 'VICT_RUNTIME_INVALID_AUTHORITY'
  | 'VICT_RUNTIME_UNKNOWN_DEFINITION_FIELD'
  | 'VICT_RUNTIME_INVALID_EFFECT'
  | 'VICT_RUNTIME_MISSING_CONTRACT'
  | 'VICT_RUNTIME_INVALID_RETENTION'
  | 'VICT_RUNTIME_INVALID_STORES'
  | 'VICT_RUNTIME_STORE_FAILURE'
  // Stage 03 durable orchestration.
  | 'VICT_RUN_NOT_FOUND'
  | 'VICT_RUNTIME_ACTIVATION_NOT_FOUND'
  | 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE'
  | 'VICT_RUNTIME_ACTIVATION_MISMATCH'
  | 'VICT_ORCH_ACTIVATION_UNAVAILABLE'
  | 'VICT_ORCH_INVALID_SIGNAL'
  | 'VICT_ORCH_SIGNAL_CONTRACT_REJECTED'
  | 'VICT_ORCH_SIGNAL_ID_CONFLICT'
  | 'VICT_ORCH_CANCELLATION_CONFLICT'
  | 'VICT_ORCH_INVALID_REASON'
  | 'VICT_ORCH_UNKNOWN_RUN'
  | 'VICT_ORCH_WAIT_NOT_FOUND'
  | 'VICT_ORCH_SIGNAL_NAME_MISMATCH'
  | 'VICT_ORCH_INVALID_TRANSITION'
  | 'VICT_ORCH_OUTCOME_UNKNOWN'
  | 'VICT_ORCH_AMBIGUOUS_TIMEOUT'
  | 'VICT_ORCH_OPERATOR_DENIED'
  | 'VICT_ORCH_OPERATOR_CONFLICT'
  | 'VICT_ORCH_INVALID_CHECKPOINT'
  | 'VICT_ORCH_RETRY_EXHAUSTED'
  | 'VICT_ORCH_UNSUPPORTED_EFFECT'
  // Stage 04 capability packs.
  | 'VICT_PACK_INVALID'
  | 'VICT_PACK_COMPATIBILITY_UNMET'
  | 'VICT_PACK_DUPLICATE';

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

/**
 * Stable codes a structured in-invocation failure may carry through to the
 * structured error signal (Stage 04 least-authority gate). Everything else
 * is untrusted content and is reduced to CAPABILITY_THREW.
 */
export const SAFE_INVOCATION_ERROR_CODES: ReadonlySet<RuntimeErrorCode> = new Set([
  'VICT_RUNTIME_PERMISSION_DENIED',
  'VICT_RUNTIME_SECRET_UNAVAILABLE',
  'VICT_RUNTIME_CONFIGURATION_UNAVAILABLE',
] as RuntimeErrorCode[]);

/**
 * Classify one capability-invocation failure. Structured VictRuntimeError
 * authority failures (permission/secret/configuration) keep their stable
 * code and framework-generated message so authorization outcomes stay
 * observable and classified; any other throw is reduced to the stable
 * CAPABILITY_THREW class with the thrown message never retained.
 */
export function classifyInvocationFailure(
  cause: unknown,
  capabilityId: string,
  context: { readonly nodeId?: string; readonly invokedVia?: 'real' | 'double' },
): { code: RuntimeErrorCode; message: string; details: Record<string, unknown> } {
  const sanitised = sanitiseThrownError(cause);
  if (cause instanceof VictRuntimeError && SAFE_INVOCATION_ERROR_CODES.has(cause.code)) {
    return {
      code: cause.code,
      message: cause.message,
      details: {
        capabilityId,
        ...(context.nodeId !== undefined ? { nodeId: context.nodeId } : {}),
        ...(context.invokedVia !== undefined ? { invokedVia: context.invokedVia } : {}),
        errorId: sanitised.errorId,
      },
    };
  }
  return {
    code: 'VICT_RUNTIME_CAPABILITY_THREW',
    message: `Capability '${capabilityId}' threw during invocation; the thrown message is not retained.`,
    details: {
      capabilityId,
      ...(context.nodeId !== undefined ? { nodeId: context.nodeId } : {}),
      ...(context.invokedVia !== undefined ? { invokedVia: context.invokedVia } : {}),
      ...sanitised,
    },
  };
}

function randomId(): string {
  // Runtime is an in-process Node package; a random correlation id is fine here.
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
