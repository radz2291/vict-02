import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { GovernedCapabilityContext } from './tool-bridge.js';
import { MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY } from './compatibility.js';
import {
  AGENT_EXCHANGE_ASK_CAPABILITY,
  AGENT_EXCHANGE_MAX_TEXT_BYTES,
  assertActorScope,
  authenticatedActorContext,
  awaitAgentDelivery,
  isRegisteredAgentActivation,
} from '@victframework/runtime';
import type {
  AgentControlStores,
  AgentExchangeDisposition,
  AgentExchangeIntent,
  AgentExchangeOccurrence,
  AgentExchangeReceipt,
  AgentExchangeRefusal,
  AgentExchangeStore,
  AgentProfileActivation,
} from '@victframework/runtime';

export { AGENT_EXCHANGE_ASK_CAPABILITY } from '@victframework/runtime';

type ActivationRef = { readonly id: string; readonly revision: string };

export interface AgentExchangeBinding {
  readonly asker: AgentProfileActivation;
  readonly answerer: AgentProfileActivation;
  readonly askCapability: ActivationRef;
  readonly holdingCapability: ActivationRef;
}

export interface AgentExchangeDisclosure {
  /** Recheck current authorization and return the only context permitted to cross. */
  allowQuestion(input: {
    readonly asker: AgentExchangeOccurrence;
    readonly answerer: AgentExchangeOccurrence;
    readonly question: string;
  }): Promise<{ readonly context: string } | undefined> | { readonly context: string } | undefined;
  /** Recheck current authorization and approve the exact text shared back. */
  allowAnswer(input: {
    readonly asker: AgentExchangeOccurrence;
    readonly answerer: AgentExchangeOccurrence;
    readonly question: string;
    readonly answer: string;
  }): Promise<boolean> | boolean;
}

export interface MastraAgentExchangeOptions {
  readonly binding: AgentExchangeBinding;
  readonly receipts: AgentExchangeStore;
  readonly stores: AgentControlStores;
  readonly disclosure: AgentExchangeDisclosure;
  readonly clock?: () => number;
}

interface LiveTurn {
  readonly occurrence: AgentExchangeOccurrence;
  readonly activation: AgentProfileActivation;
  readonly stores: AgentControlStores;
  readonly signal: AbortSignal;
  readonly stop: AbortController;
  readonly holding?: Holding;
  open: boolean;
}

interface Holding {
  readonly turn: LiveTurn;
  readonly invocationId: string;
  readonly closed: AbortController;
  open: boolean;
  used: boolean;
}

interface TurnEngine {
  readonly reserveStep: () => boolean;
  readonly reserveTool: () => boolean;
  readonly answer: (
    question: string,
    context: string,
    signal: AbortSignal,
    dispatched: () => void,
  ) => Promise<string>;
}

interface Invocation {
  readonly turn: LiveTurn;
  readonly capability: ActivationRef;
  readonly invocationId: string;
}

const validReference = (ref: ActivationRef) =>
  typeof ref.id === 'string' &&
  ref.id.length > 0 &&
  typeof ref.revision === 'string' &&
  ref.revision.length > 0;
const sameReference = (a: ActivationRef, b: ActivationRef) =>
  a.id === b.id && a.revision === b.revision;
const boundedText = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  Buffer.byteLength(value) <= AGENT_EXCHANGE_MAX_TEXT_BYTES;
const refusal = (code: AgentExchangeRefusal): AgentExchangeDisposition => ({
  status: 'refused',
  code,
});

/** Host-facing wiring for a single pair. No method accepts model-supplied run pins. */
export interface MastraAgentExchange {
  /**
   * Open the pinned asker inside the currently executing holding capability.
   * The callback must await its original execution. A different activation or
   * an attempt to attach a second turn is refused by the composition.
   */
  withAsker<T>(run: () => Promise<T>): Promise<T>;
  /** Reconcile this wiring after the previous single-process owner is known lost. */
  reconcileAfterRestart(): Promise<readonly AgentExchangeReceipt[]>;
  /** Authorized read-only replay. A receipt lookup never invokes a model. */
  readReceipt(operationId: string, actorId: string): Promise<AgentExchangeReceipt | undefined>;
}

const internals = new WeakMap<MastraAgentExchange, ExchangeCoordinator>();

/** @internal Used by the adapter/executor, never handed to a capability. */
export function exchangeCoordinator(exchange: MastraAgentExchange): ExchangeCoordinator {
  const coordinator = internals.get(exchange);
  if (!coordinator) throw new Error('VICT_EXCHANGE_UNBOUND');
  return coordinator;
}

export function createMastraAgentExchange(
  options: MastraAgentExchangeOptions,
): MastraAgentExchange {
  const coordinator = new ExchangeCoordinator(options);
  const exchange: MastraAgentExchange = Object.freeze({
    withAsker: <T>(run: () => Promise<T>) => coordinator.withAsker(run),
    readReceipt: (operationId: string, actorId: string) =>
      coordinator.readReceipt(operationId, actorId),
    reconcileAfterRestart: () => coordinator.reconcileAfterRestart(),
  });
  internals.set(exchange, coordinator);
  return exchange;
}

class ExchangeCoordinator {
  readonly #binding: AgentExchangeBinding;
  readonly #holdsByInvocation = new WeakMap<Invocation, Holding>();
  readonly #bindingId: string;
  readonly #receipts: AgentExchangeStore;
  readonly #stores: AgentControlStores;
  readonly #disclosure: AgentExchangeDisclosure;
  readonly #clock: () => number;
  readonly #turns = new AsyncLocalStorage<LiveTurn>();
  readonly #holds = new AsyncLocalStorage<Holding>();
  readonly #invocations = new AsyncLocalStorage<Invocation>();
  readonly #engines = new WeakMap<LiveTurn, TurnEngine>();
  readonly #questions = new WeakMap<LiveTurn, Map<string, string>>();
  #activeTurns = 0;
  #reconciling = false;
  readonly #pending = new Map<
    string,
    {
      readonly key: string;
      readonly result: Promise<AgentExchangeDisposition | AgentExchangeReceipt>;
    }
  >();

  constructor(options: MastraAgentExchangeOptions) {
    const { asker, answerer, askCapability, holdingCapability } = options.binding;
    if (
      !isRegisteredAgentActivation(asker) ||
      !isRegisteredAgentActivation(answerer) ||
      asker.activationVersion === answerer.activationVersion ||
      !validReference(askCapability) ||
      askCapability.id !== AGENT_EXCHANGE_ASK_CAPABILITY ||
      !validReference(holdingCapability) ||
      asker.adapterCompatibility.revision !== MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY.revision ||
      answerer.adapterCompatibility.revision !== MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY.revision ||
      !asker.capabilities.some((ref) => sameReference(ref, askCapability)) ||
      !answerer.capabilities.some((ref) => sameReference(ref, holdingCapability)) ||
      asker.profile.profile.turnPolicy.schema === 'vict.agent-turn-policy@2' ||
      answerer.profile.profile.turnPolicy.schema === 'vict.agent-turn-policy@2'
    ) {
      throw new Error('VICT_EXCHANGE_UNBOUND');
    }
    this.#binding = {
      asker,
      answerer,
      askCapability: { ...askCapability },
      holdingCapability: { ...holdingCapability },
    };
    this.#bindingId = createHash('sha256')
      .update(
        JSON.stringify([
          asker.activationVersion,
          answerer.activationVersion,
          askCapability.id,
          askCapability.revision,
          holdingCapability.id,
          holdingCapability.revision,
        ]),
      )
      .digest('hex');
    this.#receipts = options.receipts;
    this.#stores = options.stores;
    this.#disclosure = {
      allowQuestion: options.disclosure.allowQuestion.bind(options.disclosure),
      allowAnswer: options.disclosure.allowAnswer.bind(options.disclosure),
    };
    this.#clock = options.clock ?? Date.now;
  }

  assertActivation(activation: AgentProfileActivation): void {
    if (activation !== this.#binding.asker && activation !== this.#binding.answerer)
      throw new Error('VICT_EXCHANGE_UNBOUND');
  }

  isAsk(activation: AgentProfileActivation, capability: ActivationRef): boolean {
    return (
      activation === this.#binding.asker && sameReference(capability, this.#binding.askCapability)
    );
  }

  async withTurn<T>(
    input: {
      activation: AgentProfileActivation;
      stores: AgentControlStores;
      turnId: string;
      streamId: string;
      actorId: string;
      deadlineAt: number;
      signal: AbortSignal;
    },
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    this.assertActivation(input.activation);
    const holding = this.#holds.getStore();
    const isAsker = input.activation === this.#binding.asker;
    const now = this.#clock();
    if (
      this.#reconciling ||
      input.stores !== this.#stores ||
      !Number.isSafeInteger(input.deadlineAt) ||
      input.deadlineAt <= now ||
      input.deadlineAt - now > 2_147_483_647 ||
      (isAsker &&
        (!holding?.open ||
          holding.used ||
          !holding.turn.open ||
          holding.turn.signal.aborted ||
          holding.turn.occurrence.actorId !== input.actorId ||
          holding.turn.stores !== input.stores))
    ) {
      throw new Error('VICT_EXCHANGE_UNBOUND');
    }
    const stop = new AbortController();
    const expiry = new AbortController();
    const signal = AbortSignal.any([
      input.signal,
      stop.signal,
      expiry.signal,
      ...(isAsker && holding ? [holding.closed.signal] : []),
    ]);
    const timer = setTimeout(() => expiry.abort(), input.deadlineAt - now);
    timer.unref();
    const turn: LiveTurn = {
      occurrence: Object.freeze({
        turnId: input.turnId,
        streamId: input.streamId,
        actorId: input.actorId,
        activationVersion: input.activation.activationVersion,
        agentProfileVersion: input.activation.agentProfileVersion,
        deadlineAt: input.deadlineAt,
      }),
      activation: input.activation,
      stores: input.stores,
      signal,
      stop,
      open: true,
      ...(isAsker && holding ? { holding } : {}),
    };
    const stopAsker = () => stop.abort();
    const stopAnswerer = () => holding?.turn.stop.abort();
    if (isAsker && holding) {
      holding.used = true;
      holding.turn.signal.addEventListener('abort', stopAsker, { once: true });
      signal.addEventListener('abort', stopAnswerer, { once: true });
      if (holding.turn.signal.aborted) stopAsker();
      if (signal.aborted) stopAnswerer();
    }
    this.#activeTurns += 1;
    try {
      return await this.#turns.run(turn, () => run(signal));
    } finally {
      this.#activeTurns -= 1;
      turn.open = false;
      clearTimeout(timer);
      if (isAsker) {
        holding?.turn.signal.removeEventListener('abort', stopAsker);
        signal.removeEventListener('abort', stopAnswerer);
      }
    }
  }

  attachEngine(activation: AgentProfileActivation, turnId: string, engine: TurnEngine): boolean {
    const turn = this.#turns.getStore();
    if (
      !turn?.open ||
      turn.activation !== activation ||
      turn.occurrence.turnId !== turnId ||
      this.#engines.has(turn)
    )
      return false;
    this.#engines.set(turn, engine);
    return true;
  }

  async invoke<T>(
    capability: ActivationRef,
    context: GovernedCapabilityContext,
    run: () => Promise<T>,
  ): Promise<T> {
    const turn = this.#turns.getStore();
    if (
      !turn ||
      !turn.open ||
      context.victTurnId !== turn.occurrence.turnId ||
      context.victActorId !== turn.occurrence.actorId ||
      !context.victInvocationId ||
      !context.victIdempotencyKey
    ) {
      throw new Error('VICT_EXCHANGE_UNBOUND');
    }
    const invocation: Invocation = {
      turn,
      capability,
      invocationId: context.victInvocationId,
    };
    return this.#invocations.run(invocation, run);
  }

  async withAsker<T>(run: () => Promise<T>): Promise<T> {
    const invocation = this.#invocations.getStore();
    if (
      !invocation ||
      this.#holdsByInvocation.has(invocation) ||
      !invocation.turn.open ||
      invocation.turn.signal.aborted ||
      invocation.turn.activation !== this.#binding.answerer ||
      !sameReference(invocation.capability, this.#binding.holdingCapability) ||
      !this.#engines.has(invocation.turn)
    )
      throw new Error('VICT_EXCHANGE_UNBOUND');
    const holding: Holding = {
      turn: invocation.turn,
      invocationId: invocation.invocationId,
      closed: new AbortController(),
      open: true,
      used: false,
    };
    this.#holdsByInvocation.set(invocation, holding);
    try {
      return await this.#holds.run(holding, run);
    } finally {
      holding.open = false;
      holding.closed.abort();
    }
  }

  async ask(
    input: unknown,
    context: GovernedCapabilityContext,
    replayOnly = false,
  ): Promise<AgentExchangeDisposition | AgentExchangeReceipt> {
    const turn = this.#turns.getStore(),
      holding = turn?.holding;
    if (
      !turn?.open ||
      !holding?.open ||
      !holding.turn.open ||
      turn.activation !== this.#binding.asker ||
      turn.signal.aborted ||
      holding.turn.signal.aborted ||
      context.victActorId !== turn.occurrence.actorId ||
      context.victTurnId !== turn.occurrence.turnId ||
      !context.victInvocationId ||
      !context.victIdempotencyKey
    )
      return refusal('VICT_EXCHANGE_UNBOUND');
    const question = (input as { question?: unknown } | null)?.question;
    if (!boundedText(question)) return refusal('VICT_EXCHANGE_AUTHORITY_DENIED');
    if (!context.victToolCallId) return refusal('VICT_EXCHANGE_UNBOUND');
    let questions = this.#questions.get(turn);
    if (!questions) {
      questions = new Map();
      this.#questions.set(turn, questions);
    }
    const original = questions.get(context.victToolCallId);
    if (original !== undefined && original !== context.victIdempotencyKey)
      return refusal('VICT_EXCHANGE_OPERATION_CONFLICT');
    const operationId = context.victIdempotencyKey;
    const key = JSON.stringify([
      turn.occurrence.turnId,
      holding.turn.occurrence.turnId,
      context.victInvocationId,
      holding.invocationId,
      question,
    ]);
    const pending = this.#pending.get(operationId);
    if (pending)
      return pending.key === key ? pending.result : refusal('VICT_EXCHANGE_OPERATION_CONFLICT');
    const existing = this.#receipts.read(operationId);
    if (existing) {
      const intent = existing.state === 'settled' ? existing.receipt : existing.intent;
      if (
        intent.bindingId !== this.#bindingId ||
        (intent.question !== null && intent.question !== question) ||
        intent.asker.turnId !== turn.occurrence.turnId ||
        intent.answerer.turnId !== holding.turn.occurrence.turnId ||
        intent.askInvocationId !== context.victInvocationId ||
        intent.holdingInvocationId !== holding.invocationId
      )
        return refusal('VICT_EXCHANGE_OPERATION_CONFLICT');
      if (existing.state === 'settled') {
        return (
          (await this.readReceipt(operationId, turn.occurrence.actorId)) ??
          refusal('VICT_EXCHANGE_AUTHORITY_DENIED')
        );
      }
      return refusal('VICT_EXCHANGE_OUTCOME_UNKNOWN');
    }
    if (replayOnly) return refusal('VICT_EXCHANGE_OUTCOME_UNKNOWN');
    questions.set(context.victToolCallId, operationId);
    const result = this.#execute(turn, holding, operationId, context.victInvocationId, question);
    this.#pending.set(operationId, { key, result });
    try {
      return await result;
    } finally {
      this.#pending.delete(operationId);
    }
  }

  async reconcileAfterRestart(): Promise<readonly AgentExchangeReceipt[]> {
    if (this.#reconciling || this.#activeTurns !== 0 || this.#pending.size !== 0)
      throw new Error('VICT_EXCHANGE_OWNER_ACTIVE');
    this.#reconciling = true;
    try {
      const reconciled: AgentExchangeReceipt[] = [];
      const turns = new Set<string>();
      for (const intent of this.#receipts.listPending()) {
        if (intent.bindingId !== this.#bindingId) continue;
        turns.add(intent.asker.turnId);
        turns.add(intent.answerer.turnId);
      }
      // Receipt settlement precedes delivery. A crash between them can leave
      // open turns linked to an already immutable receipt.
      const openTurns = new Map(
        (await this.#stores.turns.listOpenTurns()).map((turn) => [turn.turnId, turn]),
      );
      for (const receipt of this.#receipts.listSettledForTurns(this.#bindingId, [
        ...openTurns.keys(),
      ])) {
        for (const occurrence of [receipt.asker, receipt.answerer]) {
          const turn = openTurns.get(occurrence.turnId);
          if (
            turn?.streamId === occurrence.streamId &&
            turn.actorId === occurrence.actorId &&
            (turn.activationVersion === undefined ||
              turn.activationVersion === occurrence.activationVersion) &&
            turn.agentProfileVersion === occurrence.agentProfileVersion
          ) {
            turns.add(turn.turnId);
          }
        }
      }
      for (const turnId of turns) {
        const turn = await this.#stores.turns.getTurn(turnId);
        if (
          turn?.status === 'running' ||
          turn?.status === 'intent' ||
          turn?.status === 'awaiting-approval'
        ) {
          const cancelled = await this.#stores.turns.hasCancelIntent(turnId);
          await this.#stores.turns.reconcileTurn({
            turnId,
            status: cancelled ? 'cancelled' : 'failed',
            reasonCode: cancelled ? 'VICT_TURN_CANCELLED' : 'VICT_TURN_INTERRUPTED',
            at: this.#clock(),
          });
        }
      }
      // Leave the intent pending until both turn records have settled, so
      // a restart during reconciliation can repeat the read-only recovery.
      for (const intent of this.#receipts.listPending()) {
        if (intent.bindingId !== this.#bindingId) continue;
        const receipt = this.#receipts.reconcileAbandoned(intent.operationId, this.#clock());
        if (receipt) reconciled.push(receipt);
      }
      return reconciled;
    } finally {
      this.#reconciling = false;
    }
  }

  async readReceipt(
    operationId: string,
    actorId: string,
  ): Promise<AgentExchangeReceipt | undefined> {
    const record = this.#receipts.read(operationId);
    if (record?.state !== 'settled') return undefined;
    const receipt = record.receipt;
    if (
      receipt.bindingId !== this.#bindingId ||
      receipt.asker.actorId !== actorId ||
      receipt.answerer.actorId !== actorId
    )
      return undefined;
    if (!(await this.#actorAllows(actorId, 'agent.stream.read'))) return undefined;
    const { asker, answerer, question } = receipt;
    if (question === null) return receipt;
    try {
      if (!(await this.#disclosure.allowQuestion({ asker, answerer, question }))) return undefined;
      if (
        receipt.status === 'answered' &&
        (await this.#disclosure.allowAnswer({
          asker,
          answerer,
          question,
          answer: receipt.answer,
        })) !== true
      )
        return undefined;
      return (await this.#actorAllows(actorId, 'agent.stream.read')) ? receipt : undefined;
    } catch {
      return undefined;
    }
  }

  async #actorAllows(
    actorId: string,
    scope: 'agent.turn.start' | 'agent.stream.read',
  ): Promise<boolean> {
    try {
      assertActorScope(
        authenticatedActorContext(await this.#stores.actors.get(actorId), actorId),
        scope,
      );
      return true;
    } catch {
      return false;
    }
  }

  async #execute(
    asker: LiveTurn,
    holding: Holding,
    operationId: string,
    askInvocationId: string,
    question: string,
  ) {
    const answerer = holding.turn;
    const input = { asker: asker.occurrence, answerer: answerer.occurrence, question };
    const signal = AbortSignal.any([asker.signal, answerer.signal]);
    const stopped = () =>
      this.#clock() >= Math.min(input.asker.deadlineAt, input.answerer.deadlineAt)
        ? 'VICT_EXCHANGE_DEADLINE'
        : signal.aborted || !holding.open || !asker.open || !answerer.open
          ? 'VICT_EXCHANGE_CANCELLED'
          : undefined;
    const active = () => this.#actorAllows(input.asker.actorId, 'agent.turn.start');
    const share = await awaitAgentDelivery(
      Promise.resolve().then(async () => {
        try {
          return (await active()) ? await this.#disclosure.allowQuestion(input) : undefined;
        } catch {
          return undefined;
        }
      }),
      signal,
    );
    const code = stopped();
    const context = share.delivered ? share.value?.context : undefined;
    const questionAllowed =
      typeof context === 'string' &&
      Buffer.byteLength(context) <= AGENT_EXCHANGE_MAX_TEXT_BYTES &&
      (await active());
    const askerEngine = this.#engines.get(asker);
    const answererEngine = this.#engines.get(answerer);
    const admissionRefusal =
      code ??
      stopped() ??
      (!questionAllowed
        ? 'VICT_EXCHANGE_AUTHORITY_DENIED'
        : !askerEngine || !answererEngine
          ? 'VICT_EXCHANGE_UNBOUND'
          : undefined);
    const toolReserved = admissionRefusal === undefined && askerEngine?.reserveTool() === true;
    const reserved = toolReserved && answererEngine?.reserveStep() === true;
    const intent: AgentExchangeIntent = {
      operationId,
      bindingId: this.#bindingId,
      question: questionAllowed ? question : null,
      asker: input.asker,
      answerer: input.answerer,
      holdingInvocationId: holding.invocationId,
      askInvocationId,
      askerToolCalls: toolReserved ? 1 : 0,
      answererModelSteps: reserved ? 1 : 0,
      startedAt: this.#clock(),
    };
    if (!this.#receipts.claim(intent)) return refusal('VICT_EXCHANGE_OUTCOME_UNKNOWN');
    let attempts = 0;
    const settle = (disposition: AgentExchangeDisposition) =>
      this.#receipts.settle({
        ...intent,
        ...disposition,
        schema: 'vict.agent-exchange-receipt@1',
        settledAt: this.#clock(),
        answererProviderAttempts: attempts,
      });
    if (admissionRefusal) return settle(refusal(admissionRefusal));
    if (!toolReserved) return settle(refusal('VICT_EXCHANGE_TOOL_LIMIT'));
    if (!reserved) return settle(refusal('VICT_EXCHANGE_STEP_LIMIT'));
    if (!answererEngine || typeof context !== 'string')
      return settle(refusal('VICT_EXCHANGE_UNBOUND'));
    const answer = async (): Promise<AgentExchangeDisposition> => {
      const before = stopped();
      if (before) return refusal(before);
      const generated = await awaitAgentDelivery(
        answererEngine.answer(question, context, signal, () => {
          attempts += 1;
        }),
        signal,
      );
      const after = stopped();
      if (after) return refusal(after);
      const text = generated.delivered ? generated.value : undefined;
      if (!boundedText(text)) return refusal('VICT_EXCHANGE_ANSWER_UNAVAILABLE');
      const approved = await awaitAgentDelivery(
        Promise.resolve().then(
          async () =>
            (await active()) && (await this.#disclosure.allowAnswer({ ...input, answer: text })),
        ),
        signal,
      );
      const late = stopped();
      if (late) return refusal(late);
      if (!approved.delivered || approved.value !== true || !(await active()))
        return refusal('VICT_EXCHANGE_AUTHORITY_DENIED');
      return { status: 'answered', answer: text };
    };
    let disposition: AgentExchangeDisposition;
    try {
      disposition = await answer();
    } catch {
      disposition = refusal(stopped() ?? 'VICT_EXCHANGE_ANSWER_UNAVAILABLE');
    }
    const finalStop = stopped();
    return settle(finalStop ? refusal(finalStop) : disposition);
  }
}
