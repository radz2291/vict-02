import type { Component } from 'svelte';
import type { UiAuthoringRegistration, UiExtensionDescriptor } from '@victframework/ui';
import type { UiSvelteComponentImplementation, UiSvelteComponentProps } from '@victframework/ui-svelte';
import ActionPattern from './ActionPattern.svelte';
import { modelSelectorExample } from './action-data.js';
import compatibility from './action-compatibility.json' with { type:'json' };

const base={revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'vict.svelte.ai.authoring',slots:[],styleTargets:['root','surface']} as const;
export const actionPatternDescriptors:readonly UiExtensionDescriptor[]=[
  {...base,id:'vict.ai.checkpoint',styleTargets:['root','surface','label','restore'],props:[{name:'label',type:'string',default:'Checkpoint'},{name:'canRestore',type:'boolean',default:false}],outputs:[{name:'restore',payload:'void',description:'Restore request only; host validates and advances history.'}],inspectionLimits:['canRestore defaults false; enable only with a host restore binding. No implicit history authority.']},
  {...base,id:'vict.ai.confirmation',styleTargets:['root','surface','title','description','actions','approve','deny','status'],props:[{name:'title',type:'string',default:'Confirm operation'},{name:'description',type:'string',default:''},{name:'state',type:'string',default:'requested'},{name:'pending',type:'boolean',default:false},{name:'resultText',type:'string'},{name:'canDecide',type:'boolean',default:false}],outputs:[{name:'decision',payload:'boolean',description:'Boolean decision request only. Host owns approval validation and state transitions.'}],inspectionLimits:['state is requested/running/denied/completed. No private approval authority; clicking never advances state.']},
  {...base,id:'vict.ai.suggestion',styleTargets:['root','surface','select'],props:[{name:'text',type:'string',default:'Suggested prompt'},{name:'allowActions',type:'boolean',default:false}],outputs:[{name:'select',payload:'string',description:'Supplied suggestion selected; connect to controlled composer state.'}],inspectionLimits:['Selection is a string intent only; does not send a message.']},
  {...base,id:'vict.ai.model-selector',styleTargets:['root','surface','model-trigger','model-menu','effort-trigger','effort-menu'],props:[{name:'data',type:'string',default:modelSelectorExample},{name:'model',type:'string',default:'supplied-model'},{name:'effort',type:'string',default:''},{name:'inline',type:'boolean',default:false},{name:'allowActions',type:'boolean',default:false}],outputs:[{name:'modelChange',payload:'string',description:'Supplied model id selection request; server validates actual provider use.'},{name:'effortChange',payload:'string',description:'Supplied effort id selection request.'}],inspectionLimits:['data requires strict version 1 JSON: models and optional efforts arrays, max100/30 entries, unique ids, id<=200/label<=300/group<=200 characters; max65536 JSON characters. Unknown fields rejected. Does not configure credentials or providers.']},
];
type Kind='checkpoint'|'confirmation'|'suggestion'|'model-selector';
function componentFor(kind:Kind):Component<UiSvelteComponentProps> {
  return (anchor, input) => ActionPattern(anchor, {
    kind,
    get props(){return input.props;},get io(){return input.io;},get presentation(){return input.presentation;},
    get occurrenceKey(){return input.occurrenceKey;},get nodeId(){return input.nodeId;},
  });
}
export const actionPatternImplementations:readonly UiSvelteComponentImplementation[]=actionPatternDescriptors.map(descriptor=>({
  extensionId:descriptor.id,revision:descriptor.revision,rendererImplementationId:descriptor.rendererImplementationId!,abi:'vict.ui-component-abi@1',slots:[],styleTargets:descriptor.styleTargets,component:componentFor(descriptor.id.slice('vict.ai.'.length) as Kind),
}));
const labels=['Checkpoint','Confirmation','Suggestion','Model selector'];
export const actionPatternRegistrations:readonly UiAuthoringRegistration[]=actionPatternDescriptors.map((descriptor,index)=>{
  const seed={root:'ai-action',nodes:[{kind:'component' as const,id:'ai-action',definitionId:descriptor.id,revision:descriptor.revision,props:Object.fromEntries(descriptor.props.flatMap(prop=>typeof prop.default==='string'||typeof prop.default==='boolean'||typeof prop.default==='number'?[[prop.name,{type:'literal' as const,value:prop.default}]]:[]))}]};
  return {descriptor,label:labels[index]!,family:'ai',category:'actions',purpose:descriptor.outputs?.map(output=>output.description).join(' ')??labels[index]!,eligibility:{kind:'standalone'},seed,examples:[seed],guidance:[
    'Reuse of the existing public AI pattern. Import @victframework/ui-ai-svelte/styles.css and establish the VICT control/theme scope.',
    'Action availability defaults false. Enable only after binding typed outputs to existing authorized host actions or local state. These components do not execute providers, approve operations, restore history, or run tools.',
    ...(descriptor.id==='vict.ai.model-selector'?['data schema: {"version":1,"models":[{"id":"supplied-model","label":"Supplied model"}],"efforts":[]}. All fields are supplied metadata; ids must be unique. Bind model/modelChange and effort/effortChange to string local state for controlled selection. Owned menus inherit the canonical portal outlet and presentation metadata.']:[]),
    'Text presentation is bounded to 16,000 characters. No private reasoning data is requested or generated.',
  ],...(descriptor.id==='vict.ai.model-selector'?{rules:[{kind:'controlledPair' as const,prop:'model',output:'modelChange'},{kind:'controlledPair' as const,prop:'effort',output:'effortChange'}]}:{})};
});
export const actionPatternCompatibility=compatibility;
