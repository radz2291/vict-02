import type { UiAuthoringRegistration } from '@victframework/ui';
import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import { publicPatternDescriptors, publicPatternCapabilities } from './passive-descriptors.js';
import compatibility from './compatibility-public-patterns.json' with {type: 'json'};
import PassiveReasoning from './PassiveReasoning.svelte';
import PassiveChainOfThought from './PassiveChainOfThought.svelte';
import PassiveTool from './PassiveTool.svelte';
import PassivePlan from './PassivePlan.svelte';
import PassiveTask from './PassiveTask.svelte';
import PassiveQueue from './PassiveQueue.svelte';
import PassiveTerminal from './PassiveTerminal.svelte';
import PassiveTestResults from './PassiveTestResults.svelte';
import PassiveStackTrace from './PassiveStackTrace.svelte';
import PassiveSubagent from './PassiveSubagent.svelte';
import PassiveContext from './PassiveContext.svelte';
import PassiveSources from './PassiveSources.svelte';
import PassiveInlineCitation from './PassiveInlineCitation.svelte';
import PassiveFileTree from './PassiveFileTree.svelte';
import PassiveMarkdown from './PassiveMarkdown.svelte';
export { publicPatternDescriptors } from './passive-descriptors.js';
export const publicPatternCompatibility = compatibility;
const components = [PassiveReasoning, PassiveChainOfThought, PassiveTool, PassivePlan, PassiveTask, PassiveQueue, PassiveTerminal, PassiveTestResults, PassiveStackTrace, PassiveSubagent, PassiveContext, PassiveSources, PassiveInlineCitation, PassiveFileTree, PassiveMarkdown];
export const publicPatternImplementations: readonly UiSvelteComponentImplementation[] = publicPatternCapabilities.map((capability, index) => ({...capability, component: components[index]!}));
export const publicPatternRegistrations: readonly UiAuthoringRegistration[] = publicPatternDescriptors.map(descriptor => {
  const kind = descriptor.id.slice('vict.ai.'.length);
  const seed = {root: 'activity', nodes: [{kind: 'component' as const, id: 'activity', definitionId: descriptor.id, revision: descriptor.revision, props: {}}]};
  return {descriptor, label: kind.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join(' '), family: 'ai', category: 'public-activity',
    purpose: 'Render supplied ' + kind + ' using the existing public VICT AI pattern; no execution authority.',
    eligibility: {kind: 'standalone'}, seed, examples: [seed],
    guidance: [...descriptor.inspectionLimits ?? [],
      'Import @victframework/ui-ai-svelte/styles.css. Root/content are containment; row/title/icon/metadata/disclosure/body/code and specialist parts are forwarded to actual existing public pattern surfaces. Popup is the actual owned hovercard where present.',
      `Editable parts: ${(descriptor.styleTargets ?? []).join(', ')}. Repeated activity rows share declared semantic parts; they are not private upstream primitive identities.`,
      'Configure data as a version-1 JSON string. Steps use {id,title,detail?,status?:pending|running|done|error,open?,code?,badges?,links?:[{title,url}]}; sources use {id,title,url,excerpt?}; file nodes use {path,name,children?}; testSuites use {id,name,tests:[{id,name,status:passed|failed|skipped,error?}]}. Context breakdown uses {label,value}.',
      'Data shape is pattern-specific: chain-of-thought/plan/task/queue => {version:1,steps:[]}; subagent also tools:[]; sources => sources:[]; inline-citation => source:{id,title,url}; file-tree => nodes:[]; context => breakdown:[]; test-results => testSuites:[]; other scalar patterns => {version:1}.',
      'No demo records are fabricated. Safe external URL handling is delegated to the existing public pattern.',
      'Reader disclosure is local presentation state, not persisted execution progress. Use explicit canonical scalar/data bindings to supply actual state.']};
});
