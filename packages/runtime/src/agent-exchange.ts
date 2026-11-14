import { AGENT_STREAM_ID_PATTERN } from '@victframework/contracts';

export const AGENT_EXCHANGE_ASK_CAPABILITY = 'vict.agent.exchange.ask';
/** Wire/retention size bound. This is not an exchange count policy. */
export const AGENT_EXCHANGE_MAX_TEXT_BYTES = 16_384;

/** An exchange receipt is operational evidence, separate from the agent stream. */
export interface AgentExchangeOccurrence {
  readonly turnId: string;
  readonly streamId: string;
  readonly actorId: string;
  readonly activationVersion: string;
  readonly agentProfileVersion: string;
  readonly deadlineAt: number;
}

export interface AgentExchangeIntent {
  readonly operationId: string;
  readonly bindingId: string;
  /** Null when the question itself was not authorized for retention. */
  readonly question: string | null;
  readonly asker: AgentExchangeOccurrence;
  readonly answerer: AgentExchangeOccurrence;
  readonly holdingInvocationId: string;
  readonly askInvocationId: string;
  readonly askerToolCalls: 0 | 1;
  /** Reserved from the same balance used by the ordinary answerer loop. */
  readonly answererModelSteps: 0 | 1;
  readonly startedAt: number;
}

export type AgentExchangeRefusal =
  | 'VICT_EXCHANGE_UNBOUND'
  | 'VICT_EXCHANGE_AUTHORITY_DENIED'
  | 'VICT_EXCHANGE_OPERATION_CONFLICT'
  | 'VICT_EXCHANGE_STEP_LIMIT'
  | 'VICT_EXCHANGE_TOOL_LIMIT'
  | 'VICT_EXCHANGE_CANCELLED'
  | 'VICT_EXCHANGE_DEADLINE'
  | 'VICT_EXCHANGE_ANSWER_UNAVAILABLE'
  | 'VICT_EXCHANGE_OUTCOME_UNKNOWN';

export type AgentExchangeDisposition =
  | { readonly status: 'answered'; readonly answer: string }
  | { readonly status: 'refused'; readonly code: AgentExchangeRefusal };

export type AgentExchangeReceipt = AgentExchangeIntent &
  AgentExchangeDisposition & {
    readonly schema: 'vict.agent-exchange-receipt@1';
    readonly settledAt: number;
    readonly answererProviderAttempts: number | null;
  };

export type AgentExchangeRecord =
  | { readonly state: 'pending'; readonly intent: AgentExchangeIntent }
  | { readonly state: 'settled'; readonly receipt: AgentExchangeReceipt };

/**
 * Trusted operational store port. Commit the intent before dispatch and the
 * terminal receipt before delivering an answer. Pending records never replay
 * execution. The owner alone reconciles abandoned pending records.
 */
export interface AgentExchangeStore {
  read(operationId: string): AgentExchangeRecord | undefined;
  listPending(): readonly AgentExchangeIntent[];
  /** Settled receipts for this binding that reference at least one supplied turn. */
  listSettledForTurns(
    bindingId: string,
    turnIds: readonly string[],
  ): readonly AgentExchangeReceipt[];
  claim(intent: AgentExchangeIntent): boolean;
  settle(receipt: AgentExchangeReceipt): AgentExchangeReceipt;
  reconcileAbandoned(operationId: string, settledAt: number): AgentExchangeReceipt | undefined;
}

const refusalCodes: ReadonlySet<AgentExchangeRefusal> = new Set([
  'VICT_EXCHANGE_UNBOUND',
  'VICT_EXCHANGE_AUTHORITY_DENIED',
  'VICT_EXCHANGE_OPERATION_CONFLICT',
  'VICT_EXCHANGE_STEP_LIMIT',
  'VICT_EXCHANGE_TOOL_LIMIT',
  'VICT_EXCHANGE_CANCELLED',
  'VICT_EXCHANGE_DEADLINE',
  'VICT_EXCHANGE_ANSWER_UNAVAILABLE',
  'VICT_EXCHANGE_OUTCOME_UNKNOWN',
]);

const intentKeys = [
  'operationId',
  'bindingId',
  'question',
  'asker',
  'answerer',
  'holdingInvocationId',
  'askInvocationId',
  'askerToolCalls',
  'answererModelSteps',
  'startedAt',
];
function closed(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
const validId = (value: unknown): value is string =>
  typeof value === 'string' && AGENT_STREAM_ID_PATTERN.test(value);
const time = (value: number) => Number.isSafeInteger(value) && value >= 0;
const validText = (value: unknown) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  Buffer.byteLength(value) <= AGENT_EXCHANGE_MAX_TEXT_BYTES;

function validOccurrence(value: AgentExchangeOccurrence): boolean {
  return (
    !!value &&
    closed(value, [
      'turnId',
      'streamId',
      'actorId',
      'activationVersion',
      'agentProfileVersion',
      'deadlineAt',
    ]) &&
    validId(value.turnId) &&
    validId(value.streamId) &&
    validId(value.actorId) &&
    validId(value.activationVersion) &&
    validId(value.agentProfileVersion) &&
    time(value.deadlineAt)
  );
}
function validIntentFields(intent: AgentExchangeIntent): boolean {
  return (
    typeof intent.operationId === 'string' &&
    intent.operationId.length > 0 &&
    intent.operationId.length <= 1024 &&
    typeof intent.bindingId === 'string' &&
    /^[a-f0-9]{64}$/.test(intent.bindingId) &&
    (validText(intent.question) ||
      (intent.question === null &&
        intent.askerToolCalls === 0 &&
        intent.answererModelSteps === 0)) &&
    validOccurrence(intent.asker) &&
    validOccurrence(intent.answerer) &&
    intent.asker.turnId !== intent.answerer.turnId &&
    intent.asker.streamId !== intent.answerer.streamId &&
    intent.asker.actorId === intent.answerer.actorId &&
    validId(intent.holdingInvocationId) &&
    validId(intent.askInvocationId) &&
    (intent.askerToolCalls === 0 || intent.askerToolCalls === 1) &&
    (intent.answererModelSteps === 0 || intent.answererModelSteps === 1) &&
    intent.answererModelSteps <= intent.askerToolCalls &&
    time(intent.startedAt)
  );
}
export function validateAgentExchangeIntent(intent: AgentExchangeIntent): boolean {
  return !!intent && closed(intent, intentKeys) && validIntentFields(intent);
}
export function validateAgentExchangeReceipt(receipt: AgentExchangeReceipt): boolean {
  if (
    !receipt ||
    receipt.schema !== 'vict.agent-exchange-receipt@1' ||
    !validIntentFields(receipt) ||
    !time(receipt.settledAt) ||
    receipt.settledAt < receipt.startedAt
  )
    return false;
  const attempts = receipt.answererProviderAttempts;
  const fields = [...intentKeys, 'schema', 'status', 'settledAt', 'answererProviderAttempts'];
  if (
    attempts === null
      ? receipt.answererModelSteps !== 1
      : !Number.isSafeInteger(attempts) ||
        attempts < 0 ||
        (receipt.answererModelSteps === 0 && attempts !== 0)
  )
    return false;
  if (receipt.status === 'answered')
    return (
      closed(receipt, [...fields, 'answer']) &&
      validText(receipt.question) &&
      validText(receipt.answer) &&
      receipt.answererModelSteps === 1 &&
      attempts !== null &&
      attempts > 0
    );
  return (
    receipt.status === 'refused' &&
    closed(receipt, [...fields, 'code']) &&
    refusalCodes.has(receipt.code)
  );
}
