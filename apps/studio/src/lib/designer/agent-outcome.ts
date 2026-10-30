import type { AgentCursor } from './agent-edits.js';
import { sameTurnSource } from './turn-records.js';

export function hasMatchingOutcomeCapture(regions: readonly { currentSource: boolean; cursor: AgentCursor }[], finalCursor?: AgentCursor): boolean {
  return Boolean(finalCursor && regions.some(region => region.currentSource && sameTurnSource(region.cursor, finalCursor)));
}

/** Host facts only. Never infer task completion or semantic truth from model text. */
export function agentOutcomeSummary(input: {
  state: 'completed' | 'failed' | 'cancelled';
  applied: number;
  matchingCapture: boolean;
  observationFailed: boolean;
}): string {
  const source = input.applied > 0
    ? 'Source changes were applied; saving is separate.'
    : 'No source changes were applied.';
  const terminal = input.state === 'cancelled' ? 'Stopped. ' : input.state === 'failed' ? 'The turn did not finish successfully. ' : '';
  // A completed image call verifies neither its interpretation nor behavior.
  const appearance = input.observationFailed
    ? 'Appearance checks did not finish.'
    : input.matchingCapture
      ? 'A preview image matching the final source was assessed by AI; its claims remain unverified.'
      : 'No image assessment matches the final source.';
  return `${terminal}${source} ${appearance} Behavior was not tested by this agent.`;
}
