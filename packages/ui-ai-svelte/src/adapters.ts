/** Presentation data only. Hosts own transport, authorization and committed effects. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  author?: string;
  activity?: readonly ConversationActivity[];
  /** Ordered host observations and text. When present this replaces the legacy activity grouping. */
  events?: readonly ConversationEvent[];
}
export interface ConversationActivity {
  id: string;
  title: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
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
