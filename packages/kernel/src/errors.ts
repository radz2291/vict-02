import { victError } from '@vict/contracts';
import type { VictError } from '@vict/contracts';

/** Stable kernel error codes carried by structured error signals. */
export type KernelErrorCode =
  | 'VICT_KERNEL_MAX_STEPS_EXCEEDED'
  | 'VICT_KERNEL_UNKNOWN_NODE'
  | 'VICT_KERNEL_UNKNOWN_CAPABILITY'
  | 'VICT_KERNEL_UNKNOWN_CONTRACT'
  | 'VICT_KERNEL_CONTRACT_REJECTED'
  | 'VICT_KERNEL_PORT_FAILURE';

export function kernelError(
  code: KernelErrorCode,
  message: string,
  details?: unknown,
  cause?: VictError,
): VictError {
  return victError(code, message, details, cause);
}
