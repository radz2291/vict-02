import type { EffectAuthorizationDecision, EffectAuthorizationRequest } from '@vict/kernel';

export interface EffectPolicyOverrides {
  /** Explicit caller permission required to run `irreversible` capabilities in normal mode. */
  readonly allowIrreversible?: boolean;
}

/**
 * The Night 01 effect policy table.
 *
 * | Effect        | Normal                | Simulate              | Isolated test          |
 * |---------------|-----------------------|-----------------------|------------------------|
 * | pure          | real                  | real                  | real                   |
 * | read          | real                  | double required       | double required        |
 * | write         | real                  | double required       | double required        |
 * | irreversible  | real only with explicit allow | double required | denied              |
 *
 * The runtime additionally denies a `useDouble` decision when no test double
 * is registered, producing a blocked result with remediation guidance.
 */
export function decideEffectAuthorization(
  request: EffectAuthorizationRequest,
  overrides: EffectPolicyOverrides,
): EffectAuthorizationDecision {
  const { effect, mode, capabilityId } = request;

  if (effect === 'pure') {
    return { allowed: true, useDouble: false };
  }

  if (mode === 'normal') {
    if (effect === 'irreversible') {
      if (overrides.allowIrreversible === true) {
        return { allowed: true, useDouble: false };
      }
      return {
        allowed: false,
        useDouble: false,
        reason:
          "Effect class 'irreversible' is denied by default in normal execution; irreversible effects are not invoked without explicit permission.",
        remediation:
          'Re-run with explicit permission, e.g. run(input, { policy: { allowIrreversible: true } }), or register a test double for non-production modes.',
      };
    }
    // read / write run their real implementation in normal mode.
    return { allowed: true, useDouble: false };
  }

  // simulate / test: read, write, and irreversible all require a registered double.
  return {
    allowed: true,
    useDouble: true,
    reason: `Effect class '${effect}' requires a registered test double in '${mode}' mode.`,
    remediation: `Register a test double for capability '${capabilityId}' with runtime.registerDouble().`,
  };
}
