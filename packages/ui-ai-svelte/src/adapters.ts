/** Presentation data only. Hosts own transport, authorization and committed effects. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  author?: string;
  activity?: readonly ConversationActivity[];
  /** Ordered host observations and text. When present this replaces the legacy activity grouping. */
  events?: readonly ConversationEvent[];
  /** Host-only lifecycle projection, like busy/transport callbacks, not authored
   * transcript data or a canonical prop. Hosts supply receipt-derived status and
   * terminal text IDs from actual stream boundaries; prose is never classified.
   * Omit to preserve the public authored transcript's expanded presentation. */
  hostTurn?: {
    state: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
    statusText: string;
    finalTextEventIds: readonly string[];
    /** Optional receipt-derived host report, never a paraphrase or validation
     * of model prose. Original text stays unchanged in inspectable details. */
    evidenceSummary?: string;
  };
}
/** Sanitized host-supplied tool evidence. This is presentation, never execution authority. */
export interface ConversationToolPayload {
  text: string;
  redacted?: boolean;
  truncated?: boolean;
  unavailable?: boolean;
}
export interface ConversationActivity {
  id: string;
  title: string;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  detail?: string;
  input?: ConversationToolPayload;
  result?: ConversationToolPayload;
  /** Ordered public receipts for one actual tool attempt. No private reasoning. */
  stages?: readonly { id: string; title: string; state: ConversationActivity['state']; detail?: string }[];
}
export type ConversationEvent =
  | { id: string; kind: 'text' | 'summary'; text: string }
  | { id: string; kind: 'activity'; activity: ConversationActivity }
  | { id: string; kind: 'compaction'; text: string; omitted: number };

/** Bound transcript presentation visibly. Hosts retain confirmed effect boundaries separately. */
export function appendConversationEvent(
  existing: readonly ConversationEvent[], event: ConversationEvent, limit = 240,
): ConversationEvent[] {
  const events = [...existing];
  const index = events.findIndex(item => item.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
  if (events.length <= limit) return events;
  const previous = events[0]?.kind === 'compaction' ? events.shift() : undefined;
  const excess = events.length - limit + 1;
  events.splice(0, excess);
  const omitted = (previous?.kind === 'compaction' ? previous.omitted : 0) + excess;
  events.unshift({ id: 'transcript-compaction', kind: 'compaction', omitted,
    text: `${omitted} earlier timeline entries compacted. Confirmed edits remain in screen history; continue from current source.` });
  return events;
}
export type SendResult = boolean | { ok: boolean; message?: string };
/** Called once the host admits the request, before its streamed response finishes. */
export type SendAccepted = () => void;

/** Adapt VICT's stable participant/text presentation shape without importing its runtime. */
export function conversationMessages(messages: readonly {
  participant: string; text: string; author?: string;
}[]): ConversationMessage[] {
  return messages.map((message, index) => ({
    id: `message-${index}`,
    role: message.participant === 'user' ? 'user' : message.participant === 'assistant' ? 'assistant' : 'system',
    text: message.text,
    ...(message.author ? { author: message.author } : {}),
  }));
}
