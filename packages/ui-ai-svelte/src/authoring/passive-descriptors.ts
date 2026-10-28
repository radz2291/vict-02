import type { UiExtensionDescriptor } from '@victframework/ui';
import { publicPatternKinds, publicPatternSeedData, type PublicPatternKind } from './passive-data.js';

const string = (name: string, value = '') => ({name, type: 'string' as const, default: value});
const boolean = (name: string, value = false) => ({name, type: 'boolean' as const, default: value});
const number = (name: string, value?: number) => ({name, type: 'number' as const, ...(value === undefined ? {} : {default: value})});
const props: Record<PublicPatternKind, UiExtensionDescriptor['props']> = {
  reasoning: [string('title', 'Public summary'), string('text'), boolean('running'), number('duration'), boolean('open', true), boolean('markdown', true), boolean('showIcon')],
  'chain-of-thought': [string('title', 'Public execution steps'), string('description'), boolean('open', true)],
  tool: [string('title', 'Tool call'), string('input'), string('output'), string('error'), string('status'), string('state', 'pending'), boolean('open', true), boolean('details'), boolean('allowOpenOutput'), boolean('allowDecision'), string('approvalTitle', 'Decision requested'), string('approvalDescription')],
  plan: [string('title', 'Proposed work'), string('description'), boolean('open', true)],
  task: [string('title', 'Observed activity'), string('description'), boolean('open', true)],
  queue: [boolean('completedOpen', true)],
  terminal: [string('command'), string('output'), string('status', 'pending'), number('exitCode'), boolean('open', true)],
  'test-results': [string('title'), string('output'), boolean('running'), boolean('open', true), boolean('errorsOpen', true)],
  'stack-trace': [string('title'), string('frames'), string('summaryIcon', 'terminal'), boolean('open', true), boolean('allowSelect')],
  subagent: [string('title', 'Observed child run'), string('result'), string('state', 'pending'), number('duration'), string('model'), string('description'), boolean('open', true)],
  context: [number('used', 0), number('limit', 0)], sources: [boolean('open', true)], 'inline-citation': [],
  'file-tree': [string('selected'), boolean('allowSelect')],
  markdown: [string('text')],
};
const trace = ['row', 'title', 'icon', 'disclosure', 'body'];
const parts: Record<PublicPatternKind, readonly string[]> = {
  reasoning: [...trace, 'metadata'], 'chain-of-thought': [...trace, 'code', 'badge', 'link'],
  tool: [...trace, 'code', 'output-action', 'description', 'actions', 'approve', 'deny'], plan: [...trace, 'metadata'], task: trace, queue: trace,
  terminal: [...trace, 'code'], 'test-results': [...trace, 'code'], 'stack-trace': [...trace, 'error', 'frame-action'],
  subagent: [...trace, 'metadata', 'code', 'badge', 'result'],
  context: ['trigger', 'popup', 'title', 'usage', 'progress', 'breakdown-row'],
  sources: [...trace, 'source'], 'inline-citation': ['trigger', 'popup', 'title', 'excerpt', 'source'],
  'file-tree': ['folder', 'file', 'folder-body'], markdown: [],
};
export const publicPatternDescriptors: readonly UiExtensionDescriptor[] = publicPatternKinds.map(kind => ({
  id: `vict.ai.${kind}`, revision: '1', abi: 'vict.ui-component-abi@1', events: ['vict.ui-component-abi@1'],
  rendererImplementationId: 'vict.svelte.ai.authoring',
  props: [...props[kind], string('data', JSON.stringify(publicPatternSeedData[kind]))], slots: [],
  outputs: kind === 'tool' ? [{name: 'openOutput', payload: 'void', description: 'Request host-owned output inspection only.'}, {name: 'decision', payload: 'boolean', description: 'Request a host decision; never grants execution authority.'}]
    : kind === 'file-tree' ? [{name: 'select', payload: 'string', description: 'Request selection of a supplied path; no filesystem access.'}]
    : kind === 'stack-trace' ? [{name: 'frameSelect', payload: 'string', description: 'JSON string of selected parsed supplied frame; host owns navigation.'}] : [],
  styleTargets: ['root', 'content', ...parts[kind]],
  inspectionLimits: ['Presentation of supplied public data only. No provider, tool, shell, retrieval, subagent launch or execution authority.',
    'data is bounded strict version-1 JSON; unsupported keys, duplicate identities and malformed records show a visible validation error.',
    'Public summaries and explicit execution steps only; private chain-of-thought is never requested, inferred or fabricated.',
    'allowDecision, allowOpenOutput and allowSelect default false. Enable only when the corresponding typed intent output has an explicit host binding.'],
}));
export const publicPatternCapabilities = publicPatternDescriptors.map(descriptor => ({
  extensionId: descriptor.id, revision: descriptor.revision, rendererImplementationId: descriptor.rendererImplementationId!,
  abi: 'vict.ui-component-abi@1' as const, slots: [] as readonly string[], styleTargets: descriptor.styleTargets,
}));
