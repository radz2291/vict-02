import { z } from 'zod';
import { defineContract } from './define-contract.js';
import type { Contract, VictError } from './types.js';

/** Create a structured Vict error. `details` must be safe-to-log diagnostic data. */
export function victError(
  code: string,
  message: string,
  details?: unknown,
  cause?: VictError,
): VictError {
  const error: { code: string; message: string; details?: unknown; cause?: VictError } = {
    code,
    message,
  };
  if (details !== undefined) {
    error.details = details;
  }
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

const victErrorSchema: z.ZodType<VictError> = z.lazy(() =>
  z.object({
    code: z.string().min(1),
    message: z.string(),
    details: z.unknown().optional(),
    cause: victErrorSchema.optional(),
  }),
);

/**
 * Ready-made contract for nodes that handle structured error signals routed
 * over `error` edges. The validated value is a `VictError`.
 */
export const errorSignalContract: Contract<VictError> = defineContract<VictError>(
  'vict.error-signal',
  victErrorSchema,
  { description: 'A structured Vict error signal routed over an error edge' },
);
