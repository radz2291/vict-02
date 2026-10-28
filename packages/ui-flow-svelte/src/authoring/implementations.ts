import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import FlowCanvas from './FlowCanvas.svelte';
import FlowNode from './FlowNodeDeclaration.svelte';
import FlowEdge from './FlowEdgeDeclaration.svelte';
import FlowEditor from './FlowEditor.svelte';
import { graphEditorParts } from '../editor/presentation.js';
export const flowAuthoringImplementations: readonly UiSvelteComponentImplementation[] = [
  {
    extensionId: 'vict.flow.editor',
    revision: '1',
    rendererImplementationId: 'vict.svelte.flow.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    component: FlowEditor,
  },
  {
    extensionId: 'vict.flow.editor', revision: '2',
    rendererImplementationId: 'vict.svelte.flow.authoring',
    abi: 'vict.ui-component-abi@1', styleTargets: graphEditorParts,
    slots: [], component: FlowEditor,
  },
  {
    extensionId: 'vict.flow.canvas',
    revision: '1',
    rendererImplementationId: 'vict.svelte.flow.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: ['nodes', 'edges'],
    component: FlowCanvas,
  },
  {
    extensionId: 'vict.flow.node',
    revision: '1',
    rendererImplementationId: 'vict.svelte.flow.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    requiresParentContext: true,
    component: FlowNode,
  },
  {
    extensionId: 'vict.flow.edge',
    revision: '1',
    rendererImplementationId: 'vict.svelte.flow.authoring',
    abi: 'vict.ui-component-abi@1',
    styleTargets: ['root'],
    slots: [],
    requiresParentContext: true,
    component: FlowEdge,
  },
];
