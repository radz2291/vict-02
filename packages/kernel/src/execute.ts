import { randomUUID } from 'node:crypto';
import type { VictError } from '@vict/contracts';
import { kernelError } from './errors.js';
import { summarizeOutput } from './summarize.js';
import type {
  CompiledNode,
  CapabilityDescriptor,
  KernelEvent,
  KernelRunInput,
  KernelRunOutput,
  RunStatus,
} from './types.js';

export const DEFAULT_MAX_STEPS = 100;

const SYSTEM_CLOCK = { now: (): number => Date.now() };
const SYSTEM_IDS = { runId: (): string => `run_${randomUUID()}` };

/**
 * Execute a compiled graph deterministically.
 *
 * Sequential semantics: start at the entry node with the run input, invoke
 * one capability per step, validate inputs and outputs against the effective
 * contracts, route validated outputs along the success edge, convert failures
 * into structured error signals routed along the error edge, and terminate
 * honestly at a terminal node or on an unhandled failure.
 *
 * Purity: the kernel performs no I/O. Capability invocation, policy,
 * contract judgment, time, and identity are all supplied through ports.
 * Event order is defined by the per-run monotonic `seq`, never timestamps.
 */
export async function executeGraph(run: KernelRunInput): Promise<KernelRunOutput> {
  const { graph, ports } = run;
  const maxSteps = run.maxSteps ?? DEFAULT_MAX_STEPS;
  const clock = ports.clock ?? SYSTEM_CLOCK;
  const ids = ports.ids ?? SYSTEM_IDS;
  const runId = ids.runId();

  const events: KernelEvent[] = [];
  let seq = 0;
  const emit = (event: Record<string, unknown> & { type: string }): void => {
    const full = {
      seq: seq++,
      runId,
      graphId: graph.id,
      graphVersion: graph.version,
      timestamp: clock.now(),
      ...event,
    } as KernelEvent;
    events.push(full);
    ports.onEvent?.(full);
  };

  emit({ type: 'run.started' });

  let current: string = graph.entryNodeId;
  let payload: unknown = run.input;
  let steps = 0;
  let status: RunStatus = 'failed';
  let output: unknown = undefined;
  let finalError: VictError | undefined;

  loop: while (true) {
    steps += 1;
    if (steps > maxSteps) {
      finalError = kernelError(
        'VICT_KERNEL_MAX_STEPS_EXCEEDED',
        `Run exceeded the maximum of ${maxSteps} steps.`,
        { maxSteps, lastNodeId: current },
      );
      emit({ type: 'run.failed', steps, error: finalError });
      status = 'failed';
      break;
    }

    const node: CompiledNode | undefined = graph.getNode(current);
    if (!node) {
      // Defensive: compilation guarantees node existence.
      finalError = kernelError(
        'VICT_KERNEL_UNKNOWN_NODE',
        `Compiled graph '${graph.id}' has no node '${current}'.`,
        { nodeId: current },
      );
      emit({
        type: 'node.failed',
        nodeId: current,
        capabilityId: '(unknown)',
        durationMs: 0,
        error: finalError,
      });
      emit({ type: 'run.failed', steps, error: finalError });
      status = 'failed';
      break;
    }

    const descriptor: CapabilityDescriptor | undefined = ports.descriptors.getCapabilityDescriptor(
      node.capability,
    );
    if (!descriptor) {
      // Defensive: compilation rejects unknown capabilities; the environment changed underneath the run.
      finalError = kernelError(
        'VICT_KERNEL_UNKNOWN_CAPABILITY',
        `Capability '${node.capability}' (node '${node.id}') is no longer known to the environment.`,
        { nodeId: node.id, capabilityId: node.capability },
      );
      emit({
        type: 'node.failed',
        nodeId: node.id,
        capabilityId: node.capability,
        durationMs: 0,
        error: finalError,
      });
      emit({ type: 'run.failed', steps, error: finalError });
      status = 'failed';
      break;
    }

    // ---- Effect policy -------------------------------------------------
    const decision = ports.policy.authorize({
      capabilityId: node.capability,
      effect: descriptor.effect,
      mode: run.mode,
    });
    if (!decision.allowed) {
      const reason =
        decision.reason ??
        `Effect class '${descriptor.effect}' is not allowed in '${run.mode}' mode.`;
      const remediation =
        decision.remediation ??
        'Adjust the execution policy or provide an approved implementation.';
      emit({
        type: 'effect.blocked',
        nodeId: node.id,
        capabilityId: node.capability,
        effect: descriptor.effect,
        mode: run.mode,
        reason,
        remediation,
      });
      emit({
        type: 'run.blocked',
        steps,
        reason,
        capabilityId: node.capability,
        effect: descriptor.effect,
        remediation,
      });
      status = 'blocked';
      break;
    }

    const errorTarget = graph.errorTargetOf(node.id);
    let failed = false;

    /** Emit the contract.rejected event and build the corresponding error signal. */
    const contractRejection = (
      stage: 'input' | 'output',
      contractId: string,
      issues: readonly { code: string; path: string; message: string }[],
    ): VictError => {
      emit({
        type: 'contract.rejected',
        stage,
        nodeId: node.id,
        capabilityId: node.capability,
        contractId,
        issues,
      });
      return kernelError(
        'VICT_KERNEL_CONTRACT_REJECTED',
        `${stage === 'input' ? 'Input' : 'Output'} contract '${contractId}' rejected the value at node '${node.id}'.`,
        { stage, contractId, nodeId: node.id, issues },
      );
    };

    /** Route a node failure along its error edge, or fail the run honestly. */
    const handleNodeFailure = (error: VictError, durationMs: number): void => {
      emit({
        type: 'node.failed',
        nodeId: node.id,
        capabilityId: node.capability,
        durationMs,
        error,
      });
      if (errorTarget !== undefined) {
        emit({ type: 'signal.routed', kind: 'error', fromNodeId: node.id, toNodeId: errorTarget });
        current = errorTarget;
        payload = error;
        return;
      }
      finalError = error;
      emit({ type: 'run.failed', steps, error });
      status = 'failed';
      failed = true;
    };

    // ---- Input contract ------------------------------------------------
    if (node.inputContractId !== undefined) {
      const contract = ports.contracts.get(node.inputContractId);
      if (!contract) {
        finalError = kernelError(
          'VICT_KERNEL_UNKNOWN_CONTRACT',
          `Node '${node.id}' references unknown input contract '${node.inputContractId}'.`,
          { nodeId: node.id, contractId: node.inputContractId },
        );
        emit({
          type: 'node.failed',
          nodeId: node.id,
          capabilityId: node.capability,
          durationMs: 0,
          error: finalError,
        });
        emit({ type: 'run.failed', steps, error: finalError });
        status = 'failed';
        break;
      }
      const result = contract.parse(payload);
      if (!result.ok) {
        const error = contractRejection('input', node.inputContractId, result.issues);
        handleNodeFailure(error, 0);
        if (failed) {
          break loop;
        }
        continue loop;
      }
    }

    // ---- Invocation ------------------------------------------------------
    emit({ type: 'node.started', nodeId: node.id, capabilityId: node.capability });
    const startedAt = clock.now();
    let invocation;
    try {
      invocation = await ports.capabilities.invoke(node.capability, payload, {
        runId,
        graphId: graph.id,
        graphVersion: graph.version,
        nodeId: node.id,
        capabilityId: node.capability,
        mode: run.mode,
        step: steps,
        useDouble: decision.useDouble,
      });
    } catch (cause) {
      // Ports must return explicit results; a throw is converted, never swallowed.
      invocation = {
        ok: false as const,
        error: kernelError(
          'VICT_KERNEL_PORT_FAILURE',
          `Capability port threw while invoking '${node.capability}': ${cause instanceof Error ? cause.message : String(cause)}.`,
          { capabilityId: node.capability, nodeId: node.id },
        ),
      };
    }
    const durationMs = Math.max(0, clock.now() - startedAt);

    if (!invocation.ok) {
      handleNodeFailure(invocation.error, durationMs);
      if (failed) {
        break loop;
      }
      continue loop;
    }

    // ---- Output contract -------------------------------------------------
    let validatedOutput = invocation.value;
    if (node.outputContractId !== undefined) {
      const contract = ports.contracts.get(node.outputContractId);
      if (!contract) {
        finalError = kernelError(
          'VICT_KERNEL_UNKNOWN_CONTRACT',
          `Node '${node.id}' references unknown output contract '${node.outputContractId}'.`,
          { nodeId: node.id, contractId: node.outputContractId },
        );
        emit({
          type: 'node.failed',
          nodeId: node.id,
          capabilityId: node.capability,
          durationMs,
          error: finalError,
        });
        emit({ type: 'run.failed', steps, error: finalError });
        status = 'failed';
        break;
      }
      const result = contract.parse(validatedOutput);
      if (!result.ok) {
        const error = contractRejection('output', node.outputContractId, result.issues);
        handleNodeFailure(error, durationMs);
        if (failed) {
          break loop;
        }
        continue loop;
      }
      validatedOutput = result.value;
    }

    emit({
      type: 'node.completed',
      nodeId: node.id,
      capabilityId: node.capability,
      durationMs,
      invokedVia: decision.useDouble ? 'double' : 'real',
      output: summarizeOutput(validatedOutput),
    });

    // ---- Success routing ---------------------------------------------------
    const successTarget = graph.successTargetOf(node.id);
    if (successTarget === undefined) {
      status = 'completed';
      output = validatedOutput;
      emit({ type: 'run.completed', steps, output: summarizeOutput(validatedOutput) });
      break;
    }
    emit({ type: 'signal.routed', kind: 'success', fromNodeId: node.id, toNodeId: successTarget });
    current = successTarget;
    payload = validatedOutput;
  }

  return {
    runId,
    graphId: graph.id,
    graphVersion: graph.version,
    status,
    output,
    error: finalError,
    events,
    steps,
  };
}
