import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import {flowAuthoringDescriptors,flowAuthoringImplementations} from '@victframework/ui-flow-svelte/authoring';
import OrdinaryField from './OrdinaryField.svelte';
const literal=(value:unknown)=>({type:'literal' as const,value}),ref=(path:string)=>({type:'ref' as const,path});
const field:UiExtensionDescriptor={id:'consumer.ordinary-field',revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'consumer.controls',styleTargets:['root'],props:[{name:'value',type:'string'}],outputs:[{name:'valueChange',payload:'string'}],slots:[]};
export const descriptors=[...flowAuthoringDescriptors,field],implementations=[...flowAuthoringImplementations,{extensionId:field.id,revision:'1',rendererImplementationId:'consumer.controls',abi:'vict.ui-component-abi@1',styleTargets:['root'],slots:[],component:OrdinaryField}];
export function source():UiDocument{return {schema:'vict.ui-document@1',id:'public-structure',revision:'1',root:'screen',nodes:{
 screen:{kind:'element',id:'screen',tag:'main',children:['section','other']},section:{kind:'element',id:'section',tag:'section',children:['input']},
 input:{kind:'element',id:'input',tag:'input',children:[],attributes:{'aria-label':'Shared message',value:ref('state.message'),title:ref('state.message')}},
 other:{kind:'element',id:'other',tag:'input',children:[],attributes:{value:ref('state.message')}},
},localState:{message:{key:'message',type:'string',initial:'Independent source'}},componentDefinitions:{},assets:{},styleSources:{},tokens:{},conditions:{}};}
export function ports():UiDocument{
const graph={schema:'vict.flow-graph@2',revision:0,nodeTypes:[{id:'review',label:'Review',parameters:{note:{type:'string',default:'Pending'}},ports:[{id:'brief',label:'Brief',direction:'input',type:'brief'},{id:'prompt',label:'Prompt',direction:'input',type:'prompt'},{id:'draft',label:'Draft',direction:'output',type:'image'}]}],nodes:[{id:'a',type:'review',label:'First',position:{x:0,y:0},values:{}},{id:'b',type:'review',label:'Second',position:{x:400,y:0},values:{note:'Second note'}}],edges:[]};
const document=source();document.id='public-ports';document.root='workspace';document.localState={graph:{key:'graph',type:'string',initial:JSON.stringify(graph)}};
document.nodes={workspace:{kind:'component',id:'workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:ref('state.graph')},outputs:{graphChange:{setState:{key:'graph'}}},slots:{content:{name:'content',children:['viewport'],scope:{schema:'vict.ui-slot-scope@1',props:[]}},body:{name:'body',children:['card'],scope:{schema:'vict.ui-slot-scope@1',props:[],state:{note:{key:'note',type:'string',initial:'',controlled:true}}}}}},
 viewport:{kind:'component',id:'viewport',definitionId:'vict.flow.viewport',revision:'2',props:{height:literal(330)}},
 card:{kind:'element',id:'card',tag:'article',children:['field','columns'],localStyle:[{property:'width',value:{type:'text',value:'300px'}}]},
 field:{kind:'component',id:'field',definitionId:'consumer.ordinary-field',revision:'1',props:{value:ref('state.note')},outputs:{valueChange:{setState:{key:'note'}}}},
 columns:{kind:'component',id:'columns',definitionId:'vict.flow.port-columns',revision:'1',slots:{inputs:{name:'inputs',children:['brief','prompt']},outputs:{name:'outputs',children:['draft']}}},
 brief:{kind:'component',id:'brief',definitionId:'vict.flow.port-row',revision:'2',props:{id:literal('brief')}},prompt:{kind:'component',id:'prompt',definitionId:'vict.flow.port-row',revision:'2',props:{id:literal('prompt')}},draft:{kind:'component',id:'draft',definitionId:'vict.flow.port-row',revision:'2',props:{id:literal('draft')}},
};return document;}
export function compile(document:UiDocument){const result=compileUiDocument(document,defaultSemanticElementCatalog(),descriptors);if(!result.ok)throw Error(JSON.stringify(result));return result.plan;}
