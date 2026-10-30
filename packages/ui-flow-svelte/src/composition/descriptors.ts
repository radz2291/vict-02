import type { UiExtensionDescriptor } from '@victframework/ui';
const common={revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'vict.svelte.flow.composition',styleTargets:['root']} as const;
export const graphWorkspaceDescriptor:UiExtensionDescriptor={...common,id:'vict.flow.workspace',
  props:[{name:'graph',type:'string'},{name:'label',type:'string',default:'Graph workspace'},{name:'readOnly',type:'boolean',default:false}],
  slots:['content','body'],scopedSlots:['content','body'],
  outputs:[
    {name:'graphChange',payload:'string',description:'Validated graph snapshot; bind to the same canonical graph state.'},
    {name:'selectionChange',payload:'string',description:'Transient node/edge selection IDs.'},
    {name:'nodeAction',payload:'string',description:'Declared body intent with node ID, type, output and payload. No effect is executed.'},
    {name:'applicationAction',payload:'string',description:'Declared content intent not handled as a graph transaction.'},
    {name:'operationResult',payload:'string',description:'Validated graph transaction outcome.'},
  ],inspectionLimits:['No editor chrome or execution engine. Authored content chooses controls and viewport; authored body chooses node presentation.']};
export const graphViewportDescriptor:UiExtensionDescriptor={...common,id:'vict.flow.viewport',
  props:[{name:'height',type:'number',default:480},{name:'label',type:'string',default:'Graph canvas'}],slots:[],outputs:[],
  inspectionLimits:['Requires the nearest workspace content. Geometry and direct connections only; no imposed toolbar or inspector.']};
export const graphPortDescriptor:UiExtensionDescriptor={...common,id:'vict.flow.port',
  props:[{name:'id',type:'string'}],slots:['content'],outputs:[],
  inspectionLimits:['Place within an authored workspace body. Exact port ID resolves direction/type/capacity from the graph, not from styling.']};
/** A new exact identity opts into generic typed parameters; @1 is never reinterpreted. */
export const graphWorkspaceDescriptorV2:UiExtensionDescriptor={...graphWorkspaceDescriptor,revision:'2',inspectionLimits:[...graphWorkspaceDescriptor.inspectionLimits??[],'Accepts vict.flow-graph@2 only. Parameters use canonical VICT value types independently of node controls.']};
export const graphViewportDescriptorV2:UiExtensionDescriptor={...graphViewportDescriptor,revision:'2'};
export const graphPortDescriptorV2:UiExtensionDescriptor={...graphPortDescriptor,revision:'2'};
