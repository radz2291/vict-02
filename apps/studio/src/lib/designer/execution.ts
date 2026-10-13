/** Explicit simulation through the ordinary adapter/dispatcher boundary. No target operator access. */
import type {
  ApplicationDataAdapter,
  ApplicationPlan,
  ActionDispatcher,
  ActionResult,
} from '@victframework/application';
import { demoResource, submitInput, submitOutput } from './application.js';
export function createScreenSimulation(controls: {
  denied: boolean;
  failNext: boolean;
}): ApplicationDataAdapter & { reset(): void } {
  let generation = 0;
  return {
    id: 'studio.screen-simulation',
    revision: '1',
    reset() {
      generation++;
    },
    async query() {
      return {
        ok: false,
        code: 'DATA_UNSUPPORTED_QUERY',
        message: 'This demo declares mutations only.',
      };
    },
    async mutate(request, context) {
      if (request.resourceId !== demoResource.id || request.op !== 'submit')
        return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared operation.' };
      if (
        context.effect !== 'write' ||
        controls.denied ||
        !context.permissions.includes('studio.demo.write')
      )
        return {
          ok: false,
          code: 'DATA_UNAUTHORIZED',
          message: 'Simulated write permission denied.',
        };
      const parsed = submitInput.parse(request.input);
      if (!parsed.ok)
        return {
          ok: false,
          code: 'DATA_INVALID_INPUT',
          message: 'Map message and accepted before running.',
        };
      const started = generation;
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (started !== generation)
        return { ok: false, code: 'DATA_STALE', message: 'Simulation was reset.' };
      if (controls.failNext) {
        controls.failNext = false;
        return {
          ok: false,
          code: 'DATA_INVALID_INPUT',
          message: 'Simulated service failure. Try again.',
        };
      }
      if (!parsed.value.accepted)
        return {
          ok: false,
          code: 'DATA_INVALID_INPUT',
          message: 'Check the agreement before submitting.',
        };
      return { ok: true, row: { message: `Simulated submission: ${parsed.value.message}` } };
    },
  };
}
export function screenDispatcher(
  plan: ApplicationPlan,
  adapter: ApplicationDataAdapter,
  run?: (op: string, input: unknown) => Promise<ActionResult>,
): ActionDispatcher {
  return {
    async execute(actionId, input) {
      const action = plan.actions[actionId];
      if (!action || action.kind !== 'mutation')
        return { ok: false, code: 'ACTION_UNDECLARED', message: 'The action is not declared.' };
      const parsed = submitInput.parse(input);
      if (!parsed.ok)
        return {
          ok: false,
          code: 'CONTRACT_REJECTED',
          message: 'Map message (string) and accepted (boolean) in Behavior.',
        };
      const result = run
        ? await run(`${action.resourceId}:${action.op}`, parsed.value)
        : await adapter.mutate(
            { resourceId: action.resourceId, op: action.op, input: parsed.value },
            { effect: 'write', actor: 'screen-demo', permissions: ['studio.demo.write'] },
          );
      if (!result.ok)
        return {
          ok: false,
          code: result.code ?? 'ACTION_FAILED',
          message: result.message ?? 'Simulation failed.',
        };
      const row = 'row' in result ? result.row : 'value' in result ? result.value : undefined;
      const output = submitOutput.parse(
        typeof row === 'object' && row !== null && 'message' in row ? row.message : undefined,
      );
      return output.ok
        ? { ok: true, value: output.value, message: output.value }
        : { ok: false, code: 'CONTRACT_REJECTED', message: 'Invalid simulation result.' };
    },
  };
}
