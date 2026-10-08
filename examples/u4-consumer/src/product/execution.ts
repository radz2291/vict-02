import type { ActionResult, ActionDispatcher, ApplicationDataAdapter, ApplicationDataResult, ApplicationPlan } from '@victframework/application';
import { consumerContracts, consumerResource } from './definition.js';

export interface SimulationControls { denied: boolean; failNext: boolean; }
export function createConsumerAdapter(controls: SimulationControls): ApplicationDataAdapter & { reset(): void } {
  let generation = 0;
  const inspections = new Map<string, Record<string, unknown>>();
  return { id: 'u4.task-simulation', revision: '1',
    reset() { generation += 1; inspections.clear(); },
    async query() { return { ok: false, code: 'DATA_UNSUPPORTED_QUERY', message: 'This simulation provides declared mutations only.' }; },
    async mutate(request, context): Promise<ApplicationDataResult> {
      const mutation = consumerResource.mutations?.find(entry => entry.op === request.op);
      if (request.resourceId !== consumerResource.id || !mutation) return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'The mutation is not declared.' };
      if (context.effect !== 'write' || controls.denied || mutation.permissions?.some(permission => !context.permissions.includes(permission))) return { ok: false, code: 'DATA_UNAUTHORIZED', message: 'Task write permission is denied.' };
      const contract = consumerContracts.find(entry => entry.id === mutation.inputContractId && entry.revision === '1');
      const parsed = contract?.parse(request.input);
      if (!parsed?.ok) return { ok: false, code: 'CONTRACT_REJECTED', message: 'The action inputs do not match their contract.' };
      const capturedGeneration = generation;
      await new Promise(resolve => setTimeout(resolve, 600));
      if (capturedGeneration !== generation) return { ok: false, code: 'DATA_STALE', message: 'The inspection session was reset.' };
      if (controls.failNext) { controls.failNext = false; return { ok: false, code: 'SIMULATED_FAILURE', message: 'The simulated service failed. Try again.' }; }
      const input = typeof parsed.value === 'object' ? parsed.value : {};
      if (request.op === 'submit' && (input.ackFindings !== true || input.ackPricing !== true || input.region === '')) return { ok: false, code: 'CONTRACT_REJECTED', message: 'Acknowledge both items and choose a region.' };
      if (request.op === 'assign' && input.reviewer === '') return { ok: false, code: 'CONTRACT_REJECTED', message: 'Choose a reviewer before confirming.' };
      if (request.op === 'operation' && !['assign', 'export', 'copy', 'refresh'].includes(String(input.operation))) return { ok: false, code: 'CONTRACT_REJECTED', message: 'Choose a declared inspection operation.' };
      if (request.op === 'schedule') {
        const duration = input.duration as readonly number[];
        const capacity = input.capacity as readonly number[];
        if (!input.date || !input.start || !input.end || !input.time || String(input.start) > String(input.end) || duration.length !== 1 || duration[0]! < 30 || duration[0]! > 180 || capacity.length !== 2 || capacity[0]! > capacity[1]! || capacity[0]! < 0 || capacity[1]! > 100) return { ok: false, code: 'CONTRACT_REJECTED', message: 'Choose an ordered correction window, site time and valid capacity range.' };
      }
      const noteId = String(input.noteId ?? 't_1');
      const current = inspections.get(noteId) ?? { noteId, status: 'review' };
      if (request.op === 'operation') inspections.set(noteId, { ...current, lastRequestedOperation: input.operation });
      if (request.op === 'configure') inspections.set(noteId, { ...current, correctionPlan: parsed.value });
      if (request.op === 'schedule') inspections.set(noteId, { ...current, schedule: parsed.value });
      if (request.op === 'archive') inspections.set(noteId, { ...current, status: 'archived' });
      const message = request.op === 'assign' ? 'Reviewer assigned.' : request.op === 'configure' ? `Correction plan saved for ${noteId}.` : request.op === 'schedule' ? `Visit confirmed for ${input.date} at ${input.time}; corrections ${input.start} to ${input.end}.` : request.op === 'archive' ? 'Inspection archived.' : request.op === 'operation' ? ({ assign: 'Assignment requested.', export: `${noteId}: Riverside Plant, north loading bay. Three findings; handrail repair and access signage require correction.`, copy: `Inspection reference: ${noteId}`, refresh: 'Queue refreshed: Riverside Plant, Harbour Depot and Orchard Warehouse.' } as Record<string, string>)[String(input.operation)] : 'Review submitted.';
      return { ok: true, row: { message } };

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
