import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import type {UiSvelteComponentImplementation} from '@victframework/ui-svelte';
import {graphAuthoringContract,parseGraphV2} from '@victframework/ui-flow-svelte';
import {flowAuthoringDescriptors,flowAuthoringImplementations} from '@victframework/ui-flow-svelte/authoring';
import ReviewDecision from './ReviewDecision.svelte';
const descriptor:UiExtensionDescriptor={id:'consumer.review-decision',revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'consumer.controls',styleTargets:['root'],props:[{name:'value',type:'string'}],outputs:[{name:'valueChange',payload:'string'}],slots:[]};
const implementation:UiSvelteComponentImplementation={extensionId:descriptor.id,revision:'1',rendererImplementationId:'consumer.controls',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:[],component:ReviewDecision};
export const descriptors=[...flowAuthoringDescriptors,descriptor],implementations=[...flowAuthoringImplementations,implementation];
const literal=(value:unknown)=>({type:'literal' as const,value}),ref=(path:string)=>({type:'ref' as const,path});
export function createSource():UiDocument{
const graph={schema:'vict.flow-graph@2',revision:0,nodeTypes:[{id:'review',label:'Review',parameters:{decision:{type:'string',default:'pending'}},ports:[]}],nodes:[{id:'first',type:'review',label:'First review',position:{x:0,y:0},values:{}},{id:'second',type:'review',label:'Second review',position:{x:320,y:0},values:{decision:'revise'}}],edges:[]};
if(!parseGraphV2(JSON.stringify(graph)).ok)throw Error('Fixture graph invalid');
return {schema:'vict.ui-document@1',id:'independent-review',revision:'1',root:'workspace',nodes:{
workspace:{kind:'component',id:'workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:ref('state.reviewGraph')},outputs:{graphChange:{setState:{key:'reviewGraph'}}},slots:{content:{name:'content',children:['viewport'],scope:{schema:'vict.ui-slot-scope@1',props:[]}},body:{name:'body',children:['decision'],scope:{schema:'vict.ui-slot-scope@1',props:[{name:'nodeId',type:'string'}],state:{decision:{key:'decision',type:'string',initial:'pending',controlled:true}}}}}},
viewport:{kind:'component',id:'viewport',definitionId:'vict.flow.viewport',revision:'2',props:{height:literal(360)}},
decision:{kind:'component',id:'decision',definitionId:'consumer.review-decision',revision:'1',props:{value:ref('state.decision')},outputs:{valueChange:{setState:{key:'decision'}}},localStyle:[{property:'background-color',value:{type:'token',id:'review-surface'}}]},
},localState:{reviewGraph:{key:'reviewGraph',type:'string',initial:JSON.stringify(graph)}},componentDefinitions:{},assets:{},styleSources:{},tokens:{'review-surface':{id:'review-surface',value:'#f4f7ed'}},conditions:{},theme:{schema:'vict.ui-theme@1',roles:{surface:'#f4f7ed',text:'#223028',accent:'#38714c'}}};}
export function compile(source:UiDocument){const result=compileUiDocument(source,defaultSemanticElementCatalog(),descriptors);if(!result.ok)throw Error(JSON.stringify(result));return result.plan;}
export function contract(){return graphAuthoringContract('vict.flow.workspace','2');}
