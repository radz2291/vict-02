/** UTF-8 bounds shared by the browser and HTTP admission. Snapshot guards remain unchanged. */
export const AGENT_REQUEST_BYTES = 1_200_000;
export const AGENT_STREAM_BYTES = 2_000_000;
export const AGENT_FRAME_CHARACTERS = 300_000;

export function boundedHistoryText(text: string): string {
  if (text.length <= 6000) return text;
  return `${text.slice(0,800)}\n[Earlier text compacted. Read current source; do not replay edits.]\n${text.slice(-5000)}`;
}

export function agentFailureMessage(code: string | undefined): string | undefined {
  if (code === 'STUDIO_AGENT_REQUEST_LIMIT') return 'This request exceeds the UTF-8 size limit. Shorten the prompt or history, or reduce the screen before retrying.';
  if (code === 'STUDIO_AGENT_STREAM_LIMIT') return 'The turn reached the transport size limit. Continue in a new request from the current screen.';
  if (code === 'STUDIO_AGENT_SOURCE_LIMIT') return 'This screen exceeds the advertised source limits. Reduce its size before retrying.';
  if (code === 'STUDIO_AGENT_REQUEST' || code === 'STUDIO_AGENT_SOURCE') return 'The request or screen could not be validated. Check the current source and request details before retrying.';
  if (code === 'STUDIO_AGENT_SETUP_FAILED') return 'The agent could not start with its current configuration. Check Chat details and the server configuration before retrying.';
  if (code === 'STUDIO_AGENT_EXECUTION_FAILED') return 'The agent execution failed. Check the confirmed edits and Chat details before continuing from the current screen.';
  if (code === 'VICT_STUDIO_UNAUTHENTICATED' || code === 'VICT_STUDIO_CSRF') return 'The Studio session needs to be renewed. Sign in again before retrying.';
  return undefined;
}
