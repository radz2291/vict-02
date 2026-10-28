import type { ConversationActivity, ConversationEvent, ConversationMessage, ConversationToolPayload } from '../adapters.js';

/** Authored public presentation records, not private reasoning or execution instructions. */
export const CHAT_DATA_LIMITS = { bytes: 262144, messages: 120, events: 240, activities: 80, stages: 80, attachments: 40, text: 24000 } as const;
type RecordValue = Record<string, unknown>;
function record(value: unknown, keys: readonly string[]): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('Unknown data field.');
  return value as RecordValue;
}
function text(value: unknown, max: number = CHAT_DATA_LIMITS.text): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Expected text of at most ${max} characters.`);
  return value;
}
function id(value: unknown): string { const result = text(value, 160); if (!result.trim()) throw new Error('ID must not be empty.'); return result; }
function optionalText(value: unknown): string | undefined { return value === undefined ? undefined : text(value); }
function list<T>(value: unknown, limit: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error(`Expected at most ${limit} records.`);
  const result = value.map(parse);
  const ids = result.map(item => item && typeof item === 'object' && 'id' in item ? (item as { id: string }).id : undefined).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('Record IDs must be unique.');
  return result;
}
function state(value: unknown): ConversationActivity['state'] {
  if (typeof value !== 'string' || !['pending','running','completed','failed','cancelled'].includes(value)) throw new Error('Invalid activity state.');
  return value as ConversationActivity['state'];
}
function payload(value: unknown): ConversationToolPayload | undefined {
  if (value === undefined) return undefined;
  const item = record(value, ['text','redacted','truncated','unavailable']);
  for (const key of ['redacted','truncated','unavailable']) if (item[key] !== undefined && typeof item[key] !== 'boolean') throw new Error('Invalid payload flag.');
  return { text: text(item.text), ...(item.redacted === undefined ? {} : { redacted: item.redacted as boolean }), ...(item.truncated === undefined ? {} : { truncated: item.truncated as boolean }), ...(item.unavailable === undefined ? {} : { unavailable: item.unavailable as boolean }) };
}
function activity(value: unknown): ConversationActivity {
  const item = record(value, ['id','title','state','detail','input','result','stages']);
  return { id: id(item.id), title: text(item.title), state: state(item.state), detail: optionalText(item.detail), input: payload(item.input), result: payload(item.result),
    ...(item.stages === undefined ? {} : { stages: list(item.stages, CHAT_DATA_LIMITS.stages, value => { const stage = record(value, ['id','title','state','detail']); return { id: id(stage.id), title: text(stage.title), state: state(stage.state), detail: optionalText(stage.detail) }; }) }) };
}
function event(value: unknown): ConversationEvent {
  const item = record(value, ['id','kind','text','activity','omitted']);
  const eventId = id(item.id);
  if (item.kind === 'activity') {
    if (item.text !== undefined || item.omitted !== undefined) throw new Error('Activity event has invalid fields.');
    return { id: eventId, kind: 'activity', activity: activity(item.activity) };
  }
  if (item.activity !== undefined) throw new Error('Only activity events contain activity.');
  if (item.kind === 'text' || item.kind === 'summary') {
    if (item.omitted !== undefined) throw new Error('Only compaction events contain omitted count.');
    return { id: eventId, kind: item.kind, text: text(item.text) };
  }
  if (item.kind === 'compaction' && Number.isSafeInteger(item.omitted) && Number(item.omitted) >= 0) return { id: eventId, kind: 'compaction', text: text(item.text), omitted: Number(item.omitted) };
  throw new Error('Invalid event kind or omitted count.');
}
function envelope(value: unknown, key: string): RecordValue {
  if (typeof value !== 'string' || value.length > CHAT_DATA_LIMITS.bytes) throw new Error('Data must be bounded JSON text.');
  const result = record(JSON.parse(value), ['version',key]);
  if (result.version !== 1) throw new Error('Data version must be 1.');
  return result;
}
export function parseTranscriptData(value: unknown): readonly ConversationMessage[] {
  const data = envelope(value, 'messages');
  return list(data.messages, CHAT_DATA_LIMITS.messages, value => {
    const item = record(value, ['id','role','text','author','activity','events']);
    if (typeof item.role !== 'string' || !['user','assistant','system'].includes(item.role)) throw new Error('Invalid message role.');
    return { id: id(item.id), role: item.role as ConversationMessage['role'], text: text(item.text), author: optionalText(item.author),
      ...(item.activity === undefined ? {} : { activity: list(item.activity, CHAT_DATA_LIMITS.activities, activity) }),
      ...(item.events === undefined ? {} : { events: list(item.events, CHAT_DATA_LIMITS.events, event) }) };
  });
}
export function parseAttachmentData(value: unknown): readonly { id: string; name: string }[] {
  const data = envelope(value, 'attachments');
  return list(data.attachments, CHAT_DATA_LIMITS.attachments, value => { const item = record(value, ['id','name']); return { id: id(item.id), name: text(item.name, 300) }; });
}
export function readChatData<T>(parse: (value: unknown) => T, value: unknown): { value?: T; error?: string } {
  try { return { value: parse(value) }; } catch (error) { return { error: error instanceof Error ? error.message : 'Invalid authored chat data.' }; }
}
