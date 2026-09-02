import { randomUUID } from 'node:crypto';
import { sanitizeContractIssues, type ContractResult, type VictError } from '@vict/contracts';
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
const SYSTEM_IDS = {
  runId: (): string => `run_${randomUUID()}`,
  errorId: (): string => `err_${randomUUID()}`,
};

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
 *
 * Determinism: the kernel awaits the optional `beforeInvoke` port at every
 * invocation boundary, but the port itself is environment policy — with no
 * guard supplied, execution is exactly as deterministic as before.
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
      graphVersion: graph.graphVersion,
      capabilitySetVersion: graph.capabilitySetVersion,
      activationVersion: graph.activationVersion,
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
      rawIssues: readonly unknown[],
    ): VictError => {
      // Author-controlled issues are reduced to the framework-controlled
      // safe vocabulary BEFORE they reach the event ledger or error details.
      const issues = sanitizeContractIssues(rawIssues);
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

    /**
     * A THROWING author parser is a hostile/buggy validation boundary, not a
     * data-level rejection: it is always a TERMINAL run failure. No error
     * edge is routed and no downstream capability may run. The thrown
     * message is untrusted content and is never retained.
     */
    const parserThrew = (stage: 'input' | 'output', contractId: string, cause: unknown): void => {
      finalError = kernelError(
        'VICT_KERNEL_CONTRACT_PARSER_THREW',
        `Contract '${contractId}' threw while parsing the ${stage} value at node '${node.id}'; the thrown message is not retained.`,
        {
          stage,
          contractId,
          nodeId: node.id,
          errorName: cause instanceof Error ? cause.name : typeof cause,
          ...(ids.errorId ? { errorId: ids.errorId() } : {}),
        },
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
      failed = true;
    };

    /**
     * Invoke an author-supplied parser safely: a throw becomes a structured
     * `undefined` marker the caller must turn into a sanitized terminal
     * failure — the exception itself never escapes into the engine.
     */
    const parseSafely = (
      contract: { parse(input: unknown): ContractResult<unknown> },
      input: unknown,
    ):
      | { readonly result: ContractResult<unknown>; readonly threw?: never }
      | { readonly result?: never; readonly threw: unknown } => {
      try {
        return { result: contract.parse(input) };
      } catch (cause) {
        return { threw: cause };
      }
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
      const parseOutcome = parseSafely(
        contract as { parse(input: unknown): ContractResult<unknown> },
        payload,
      );
      if ('threw' in parseOutcome) {
        parserThrew('input', node.inputContractId, parseOutcome.threw);
        break loop;
      }
      const result = parseOutcome.result;
      if (!result.ok) {
        const error = contractRejection(
          'input',
          node.inputContractId,
          result.issues as readonly unknown[],
        );
        handleNodeFailure(error, 0);
        if (failed) {
          break loop;
        }
        continue loop;
      }
    }

    // ---- Invocation ------------------------------------------------------
    emit({ type: 'node.started', nodeId: node.id, capabilityId: node.capability });
    // Durable write-ahead boundary: the environment may require every
    // durable write enqueued so far — run creation, the preceding
    // node-result batch, and this node's `node.started` transition — to be
    // committed before this capability may begin. A rejection here is an
    // infrastructure failure: the capability is not invoked and the error
    // propagates unchanged (never converted into a domain event).
    if (ports.beforeInvoke !== undefined) {
      await ports.beforeInvoke({
        runId,
        nodeId: node.id,
        capabilityId: node.capability,
        step: steps,
      });
    }
    const startedAt = clock.now();
    let invocation;
    try {
      invocation = await ports.capabilities.invoke(node.capability, payload, {
        runId,
        graphId: graph.id,
        graphVersion: graph.graphVersion,
        capabilitySetVersion: graph.capabilitySetVersion,
        activationVersion: graph.activationVersion,
        nodeId: node.id,
        capabilityId: node.capability,
        mode: run.mode,
        step: steps,
        useDouble: decision.useDouble,
      });
    } catch (cause) {
      // Ports must return explicit results; a throw is converted, never swallowed.
      // The thrown message is untrusted content and is never copied into the
      // error: only a safe type name and a correlation id are retained.
      invocation = {
        ok: false as const,
        error: kernelError(
          'VICT_KERNEL_PORT_FAILURE',
          `Capability port threw while invoking '${node.capability}'; the thrown message is not retained.`,
          {
            capabilityId: node.capability,
            nodeId: node.id,
            errorName: cause instanceof Error ? cause.name : typeof cause,
            errorId: ids.errorId?.(),
          },
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
      const parseOutcome = parseSafely(
        contract as { parse(input: unknown): ContractResult<unknown> },
        validatedOutput,
      );
      if ('threw' in parseOutcome) {
        parserThrew('output', node.outputContractId, parseOutcome.threw);
        break loop;
      }
      const result = parseOutcome.result;
      if (!result.ok) {
        const error = contractRejection(
          'output',
          node.outputContractId,
          result.issues as readonly unknown[],
        );
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
    graphVersion: graph.graphVersion,
    capabilitySetVersion: graph.capabilitySetVersion,
    activationVersion: graph.activationVersion,
    status,
    output,
    error: finalError,
    events,
    steps,
  };
}
