import GraphWorkspace from '../composition/GraphWorkspace.svelte';
import GraphWorkspaceV2 from '../composition/GraphWorkspaceV2.svelte';
import GraphViewport from '../composition/GraphViewport.svelte';
import GraphPort from '../composition/GraphPort.svelte';
import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import FlowCanvas from './FlowCanvas.svelte';
import FlowNode from './FlowNodeDeclaration.svelte';
import FlowEdge from './FlowEdgeDeclaration.svelte';
import FlowEditor from './FlowEditor.svelte';
import { graphEditorParts } from '../editor/presentation.js';
export const flowAuthoringImplementations: readonly UiSvelteComponentImplementation[] = [
  {extensionId:'vict.flow.workspace',revision:'2',rendererImplementationId:'vict.svelte.flow.composition',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:['content','body'],scopedSlots:['content','body'],component:GraphWorkspaceV2},
  {extensionId:'vict.flow.viewport',revision:'2',rendererImplementationId:'vict.svelte.flow.composition',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:[],requiresParentContext:true,component:GraphViewport},
  {extensionId:'vict.flow.port',revision:'2',rendererImplementationId:'vict.svelte.flow.composition',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:['content'],requiresParentContext:true,component:GraphPort},
  {extensionId:'vict.flow.workspace',revision:'1',rendererImplementationId:'vict.svelte.flow.composition',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:['content','body'],scopedSlots:['content','body'],component:GraphWorkspace},
  {extensionId:'vict.flow.viewport',revision:'1',rendererImplementationId:'vict.svelte.flow.composition',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:[],requiresParentContext:true,component:GraphViewport},
  {extensionId:'vict.flow.port',revision:'1',rendererImplementationId:'vict.svelte.flow.composition',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:['content'],requiresParentContext:true,component:GraphPort},
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
