import {describe,it,expect} from 'vitest';
import {UiEditSession,defaultSemanticElementCatalog,compileUiDocument,type UiDocument,type UiSlotScope,type UiEditCommand,type UiExtensionDescriptor} from '../src/index.js';
const scope:UiSlotScope={schema:'vict.ui-slot-scope@1',props:[{name:'nodeId',type:'string'}],state:{note:{key:'note',type:'string',initial:'hello',controlled:true}},outputs:[{name:'choose',payload:'string'}],conditions:{matches:{type:'compare',op:'eq',left:{type:'ref',path:'prop.nodeId'},right:{type:'literal',value:'a'}}}};
const descriptor:UiExtensionDescriptor={id:'test.scoped',revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],props:[],outputs:[],slots:['body','other'],scopedSlots:['body'],rendererImplementationId:'test.scoped'};
function source():UiDocument{return {schema:'vict.ui-document@1',id:'scope-edit',revision:'r1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',children:['a','b']},a:{kind:'component',id:'a',definitionId:'test.scoped',revision:'1',slots:{body:{name:'body',children:['branch'],scope}}},b:{kind:'component',id:'b',definitionId:'test.scoped',revision:'1',slots:{body:{name:'body',children:[],scope}}},branch:{kind:'conditional',id:'branch',branches:[{when:'matches',children:['value']}]},value:{kind:'text',id:'value',content:{type:'expression',expression:{type:'ref',path:'state.note'}}}},componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{}};}
describe('scoped slot canonical ownership edits',()=>{
 it('retains complete scope through insert, cross-owner move/detach, fill, undo and serialized reopen',()=>{
   const editor=UiEditSession.open({document:source(),storedRevision:'r1',catalogs:{elements:defaultSemanticElementCatalog(),extensions:[descriptor]}});
   const apply=(commands:readonly UiEditCommand[])=>{const result=editor.applyTransaction({requestId:crypto.randomUUID(),expectedDocumentRevision:editor.workingRevision,commands});expect(result.ok,JSON.stringify(result)).toBe(true);};
   const assertScopes=()=>{for(const id of ['a','b'])expect((editor.document.nodes[id] as Extract<UiDocument['nodes'][string],{kind:'component'}>).slots!.body!.scope).toEqual(scope);};
   apply([{op:'insert',parentId:'a',slotName:'body',node:{kind:'text',id:'new',content:{type:'expression',expression:{type:'ref',path:'prop.nodeId'}}}}]);assertScopes();
   apply([{op:'move',nodeId:'new',newParentId:'b',slotName:'body'}]);assertScopes();
   apply([{op:'fillSlot',nodeId:'b',slotName:'body',children:['new']}]);assertScopes();
   apply([{op:'remove',nodeId:'new',detachFromParent:true}]);assertScopes();
   editor.undo();assertScopes();
   const reopened=JSON.parse(JSON.stringify(editor.document)) as UiDocument;
   expect(compileUiDocument(reopened,defaultSemanticElementCatalog(),[descriptor]).ok).toBe(true);
 });
});
