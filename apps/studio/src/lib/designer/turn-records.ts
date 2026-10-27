import type { ConversationActivity } from '@victframework/ui-ai-svelte';
import type { AgentCursor } from './agent-edits.js';
import type { ObservedRegion, TurnMetrics } from './agent-progress.js';
import type { ToolArchiveReference } from './tool-evidence.js';
import type { ProviderLimitEvidence } from './provider-limit.js';
export const TURN_RECORD_TTL_MS = 30 * 60_000;
export interface RetainedTurn {
  id: string; runId: string; engineTurnId?: string; task: string; mode?:'observe-only'; startedAt: number; endedAt: number; expiresAt: number;
  status: 'completed' | 'failed' | 'cancelled' | 'interrupted'; code?: string; source: AgentCursor; finalSource?: AgentCursor; confirmedRevision?: string; applied: number;
  metrics?: TurnMetrics; regions: (ObservedRegion & { currentSource: boolean })[]; progress: string[]; diagnostics: Record<string, string>;
  providerLimit?:ProviderLimitEvidence;
  receipts: Record<string, { title: string; stages: NonNullable<ConversationActivity['stages']> }>; evidence: string; archives: ToolArchiveReference[];
}
/** A turn's facts never become the next turn's mutable detail panel. */
export function retainTurn(records: readonly RetainedTurn[], record: RetainedTurn, now = Date.now()): RetainedTurn[] {
  const snapshot: RetainedTurn = JSON.parse(JSON.stringify(record));
  return [...records.filter(item => item.id !== record.id && item.expiresAt > now), snapshot].slice(-24);
}
export function sameTurnSource(left: AgentCursor, right: AgentCursor) {
  return left.documentId === right.documentId && left.revision === right.revision && left.digest === right.digest && left.epoch === right.epoch;
}
