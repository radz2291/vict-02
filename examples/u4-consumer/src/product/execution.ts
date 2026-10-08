import type { ActionResult, ActionDispatcher, ApplicationDataAdapter, ApplicationDataResult, ApplicationPlan } from '@victframework/application';
import { consumerContracts, consumerResource } from './definition.js';

export interface SimulationControls { denied: boolean; failNext: boolean; }
export function createConsumerAdapter(controls: SimulationControls): ApplicationDataAdapter {
  return { id: 'u4.task-simulation', revision: '1',
    async query() { return { ok: false, code: 'DATA_UNSUPPORTED_QUERY', message: 'This simulation provides declared mutations only.' }; },
    async mutate(request, context): Promise<ApplicationDataResult> {
      const mutation = consumerResource.mutations?.find(entry => entry.op === request.op);
      if (request.resourceId !== consumerResource.id || !mutation) return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'The mutation is not declared.' };
      if (context.effect !== 'write' || controls.denied || mutation.permissions?.some(permission => !context.permissions.includes(permission))) return { ok: false, code: 'DATA_UNAUTHORIZED', message: 'Task write permission is denied.' };
      const contract = consumerContracts.find(entry => entry.id === mutation.inputContractId && entry.revision === '1');
      const parsed = contract?.parse(request.input);
      if (!parsed?.ok) return { ok: false, code: 'CONTRACT_REJECTED', message: 'The action inputs do not match their contract.' };
      await new Promise(resolve => setTimeout(resolve, 600));
      if (controls.failNext) { controls.failNext = false; return { ok: false, code: 'SIMULATED_FAILURE', message: 'The simulated service failed. Try again.' }; }
      const input = typeof parsed.value === 'object' ? parsed.value : {};
      if (request.op === 'submit' && (input.ackFindings !== true || input.ackPricing !== true || input.region === '')) return { ok: false, code: 'CONTRACT_REJECTED', message: 'Acknowledge both items and choose a region.' };
      if (request.op === 'assign' && input.reviewer === '') return { ok: false, code: 'CONTRACT_REJECTED', message: 'Choose a reviewer before confirming.' };
      return { ok: true, row: { message: request.op === 'assign' ? 'Reviewer assigned.' : 'Review submitted.' } };
    },
  };
}
/** Optional execution port lets authoring compose the existing preview session. */
export function createConsumerDispatcher(plan: ApplicationPlan, adapter: ApplicationDataAdapter,
  execute?: (op: string, input: unknown) => Promise<ActionResult>): ActionDispatcher {
  return { async execute(actionId, input) {
    const action = plan.actions[actionId];
    if (!action || action.kind !== 'mutation') return { ok: false, code: 'ACTION_UNDECLARED', message: 'The requested action is not declared.' };
    const inputContract = consumerContracts.find(contract => contract.id === action.inputContractId && contract.revision === action.inputContractRevision);
    const parsed = inputContract?.parse(input);
    if (!parsed?.ok) return { ok: false, code: 'CONTRACT_REJECTED', message: 'The action inputs do not match their exact contract.' };
    const result = execute ? await execute(`${action.resourceId}:${action.op}`, parsed.value)
      : await adapter.mutate({ resourceId: action.resourceId, op: action.op, input: parsed.value }, { effect: 'write', permissions: ['task.write'], actor: 'consumer' });
    if (!result.ok) return { ok: false, code: result.code ?? 'ACTION_FAILED', message: result.message ?? 'Action failed.' };
    const row = 'row' in result ? result.row : 'value' in result ? result.value : undefined;
    const message = typeof row === 'object' && row !== null && 'message' in row && typeof row.message === 'string' ? row.message : undefined;
    const outputContract = consumerContracts.find(contract => contract.id === action.outputContractId && contract.revision === action.outputContractRevision);
    const output = outputContract?.parse(message);
    return output?.ok ? { ok: true, value: output.value, message } : { ok: false, code: 'CONTRACT_REJECTED', message: 'The action result did not match its exact contract.' };
  } };
}
