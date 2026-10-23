/** Presentation data only. Hosts own transport, authorization and committed effects. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  author?: string;
  activity?: readonly ConversationActivity[];
}
export interface ConversationActivity {
  id: string;
  title: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
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
