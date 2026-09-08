import type { AgentProfileActivation, AgentControlStores } from '@vict/runtime';
import { AgentStreamHub } from '@vict/runtime';
import type { AgentStreamEvent } from '@vict/contracts';
import { AgentTurnService } from '@vict/control';
import { MastraProductAgent } from './adapter.js';
import type { MastraProductAgentConfig } from './adapter.js';
import {
  buildCapabilityTools,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from './tool-bridge.js';

/**
 * Stage 06B — the Mastra-backed turn executor (implements the neutral
 * `AgentTurnExecutor` port from `@vict/control`).
 *
 * Composition:
 * - the ProductAgent port (adapter) executes the pinned turn;
 * - the stream hub assigns per-stream monotonic sequences over the durable
 *   ledger and persists durable milestones;
 * - the governed capability tools bridge model tool selection through the
 *   VICT authorization boundary (built INSIDE the composition so the SAME
 *   tool instances are both validated by the adapter against the frozen
 *   authority envelope and wired to the durable approval ports);
 * - cancellation propagates the service's `AbortSignal` into the adapter;
 * - every normalized event is validated by the FINAL `vict.agent-stream@1`
 *   schema at the hub's publish gate (fail closed).
 */

export interface MastraTurnExecutorDeps {
  readonly stores: AgentControlStores;
  readonly activation: AgentProfileActivation;
  /** The adapter configuration WITHOUT the capability tools (injected here). */
  readonly agentConfig: MastraProductAgentConfig;
  readonly hub: AgentStreamHub;
  readonly capabilityBridge: CapabilityBridgeDeps;
  readonly clock?: () => number;
  readonly ids?: ConstructorParameters<typeof AgentTurnService>[0]['ids'];
}

/** The composed turn service + executor pair for one deployment. */
export interface MastraTurnComposition {
  readonly turnService: AgentTurnService;
  readonly productAgent: MastraProductAgent;
  readonly capabilityTools: Record<string, unknown>;
}

/** Build the composed Mastra turn executor (turn service + executor). */
export function composeMastraTurnExecutor(deps: MastraTurnExecutorDeps): MastraTurnComposition {
  const clock = deps.clock ?? (() => Date.now());
  const emit = async (event: AgentStreamEvent): Promise<void> => {
    // Every event crosses the final vict.agent-stream@1 schema gate at the
    // hub's publish boundary; durable kinds are persisted there.
    await deps.hub.publish(event);
  };

  const capabilityTools = buildCapabilityTools(deps.activation, {
    ...deps.capabilityBridge,
    // The durable awaiting-approval milestone is AWAITED: it is part of the
    // governed durable ordering and never fire-and-forget. A persistence
    // failure fails the tool closed BEFORE any effect exists (the approval
    // record and the awaiting-approval milestone stay consistent).
    emitAwaitingApproval: async (event: AgentStreamEvent) => {
      await emit(event);
    },
    // Durable ordinal of the turn's recorded invocations — the deterministic
    // tool-call identity fallback input (turn context + ordinal, no clocks).
    getTurnInvocationOrdinal: async (turnId: string) =>
      (await deps.stores.invocations.listInvocationsForTurn(turnId)).length,
  });

  const productAgent = MastraProductAgent.create(deps.activation, {
    ...deps.agentConfig,
    capabilityTools,
  });

  const executor = {
    agentProfileVersion: deps.activation.agentProfileVersion,
    executeTurn: async (
      command: {
        readonly turnId: string;
        readonly streamId: string;
        readonly threadId: string;
        readonly actorId: string;
        readonly input: string;
        readonly inputSummary: string;
      },
      handle: {
        readonly abortSignal: AbortSignal;
        emitEvent(event: AgentStreamEvent): Promise<void>;
      },
    ): Promise<{
      readonly status: 'completed' | 'failed' | 'cancelled';
      readonly text?: string;
      readonly errorCode?: string;
    }> => {
      // Durable milestones are AWAITED through a SERIALIZED emission chain:
      // each publication starts only after the previous one settled, so a
      // strictly ordered, exactly-once durable sequence holds even for
      // asynchronous adapters (collecting already-started promises and
      // awaiting them later does NOT guarantee order). A durable
      // publication failure is NEVER swallowed: it makes the turn outcome
      // truthfully failed instead of silently dropping a milestone.
      let emissionChain = Promise.resolve();
      let publicationFailure = false;
      const awaitEmission = async (emit: () => Promise<void>): Promise<void> => {
        const run = emissionChain.then(emit, emit);
        emissionChain = run.catch(() => undefined);
        try {
          await run;
        } catch {
          publicationFailure = true;
        }
      };
      const outcome = await runWithBridgeTurnScope(
        {
          turnId: command.turnId,
          streamId: command.streamId,
          actorId: command.actorId,
          agentProfileVersion: deps.activation.agentProfileVersion,
          threadId: command.threadId,
          abortSignal: handle.abortSignal,
        },
        () =>
          productAgent.runTurn(
            {
              turnId: command.turnId,
              threadId: command.threadId,
              actorId: command.actorId,
              input: command.input,
            },
            {
              activation: deps.activation,
              abortSignal: handle.abortSignal,
              streamId: command.streamId,
              onEvent: (event: AgentStreamEvent) => awaitEmission(() => emit(event)),
            },
          ),
      );
      // The chain has fully settled before the turn outcome is produced.
      await emissionChain;
      // Correlation: record the Mastra trace identity on the VICT turn
      // record (IDs only — never payloads).
      await deps.stores.turns.recordTurnCorrelation(command.turnId, {
        ...(outcome.traceId !== undefined ? { traceId: outcome.traceId } : {}),
      });
      if (publicationFailure && outcome.status === 'completed') {
        // A completed turn with a durably unrecorded milestone is NOT a
        // normal completion: report the truthful persistence failure (the
        // turn store records the same status through the terminal gate).
        return { status: 'failed', errorCode: 'VICT_TURN_STREAM_PERSISTENCE_FAILED' };
      }
      return {
        status: outcome.status,
        ...(outcome.text !== undefined ? { text: outcome.text } : {}),
        ...(outcome.errorCode !== undefined ? { errorCode: outcome.errorCode } : {}),
      };
    },
  };

  const turnService = new AgentTurnService({
    stores: deps.stores,
    executor,
    clock,
    ...(deps.ids !== undefined ? { ids: deps.ids } : {}),
  });

  return {
    turnService,
    productAgent,
    capabilityTools,
  };
}
