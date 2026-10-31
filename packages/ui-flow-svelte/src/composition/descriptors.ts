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

/** Appearance is a new exact identity, never a widening of saved @1/@2. */
export const graphWorkspaceDescriptorV3:UiExtensionDescriptor={...graphWorkspaceDescriptor,revision:'3',inspectionLimits:[...graphWorkspaceDescriptor.inspectionLimits??[],'Accepts vict.flow-graph@3 only. Static connection appearance defaults and per-edge overrides never imply execution.']};
export const graphViewportDescriptorV3:UiExtensionDescriptor={...graphViewportDescriptor,revision:'3'};
export const graphPortDescriptorV3:UiExtensionDescriptor={...graphPortDescriptor,revision:'3'};
export const graphEdgeSettingsDescriptor:UiExtensionDescriptor={...common,id:'vict.flow.edge-settings',props:[{name:'target',type:'string',default:'selection'},{name:'label',type:'string',default:'Connection appearance'}],slots:['content'],scopedSlots:['content'],outputs:[],inspectionLimits:['Requires nearest graph@3 workspace content. target canvas edits graph defaults; target selection edits exactly one selected edge with no selected nodes. App supplies ordinary controls in scoped content. No imposed inspector UI or execution.']};
