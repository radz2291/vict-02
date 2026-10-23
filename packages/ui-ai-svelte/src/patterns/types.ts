/** Presentation data supplied by a host; none of these records grants execution authority. */
export type Step = {
  id: string;
  title: string;
  detail?: string;
  status?: 'running' | 'error' | 'pending' | 'done';
};
export type Citation = { id: string; title: string; url: string; excerpt?: string };
export type FileNode = { path: string; name: string; children?: readonly FileNode[] };
export type ModelOption = { id: string; label: string; /** Optional host-supplied provider/group label. */ group?: string };
export const aiElementPatterns = [
  'chain-of-thought',
  'chat',
  'checkpoint',
  'confirmation',
  'context',
  'file-tree',
  'inline-citation',
  'message',
  'model-selector',
  'plan',
  'prompt-input',
  'queue',
  'reasoning',
  'sources',
  'stack-trace',
  'subagent',
  'suggestion',
  'task',
  'terminal',
  'test-results',
  'tool',
] as const;
export type AIElementPattern = (typeof aiElementPatterns)[number];
