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
    emitAwaitingApproval: (event: AgentStreamEvent) => {
      // Fire-and-forget publication: the DURABLE awaiting state is the
      // pending approval record + the turn's awaiting-approval state; the
      // stream milestone is secondary (its persistence failure never
      // blocks the governed flow and never leaks content).
      void emit(event).catch(() => undefined);
    },
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
              onEvent: (event: AgentStreamEvent) => {
                void emit(event).catch(() => undefined);
              },
            },
          ),
      );
      // Correlation: record the Mastra trace identity on the VICT turn
      // record (IDs only — never payloads).
      await deps.stores.turns.recordTurnCorrelation(command.turnId, {
        ...(outcome.traceId !== undefined ? { traceId: outcome.traceId } : {}),
      });
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
