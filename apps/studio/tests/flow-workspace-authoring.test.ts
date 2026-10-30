import { describe, it, expect } from 'vitest';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';
import { emptyGraph, serializeGraph, applyGraphOperations, parseGraph } from '@victframework/ui-flow-svelte';
import { installedAuthoringRegistry } from '../src/lib/designer/authoring.js';
import { newScreen, compileScreen } from '../src/lib/designer/application.js';
import { documentCursor, prepareAgentEdit, agentEditSchema, type AgentEdit } from '../src/lib/designer/agent-edits.js';
import { graphStateKeys, graphStateDocument, patchAuthoredGraph, rebaseGraphRuntime } from '../src/lib/designer/graph-authoring.js';
import { projectStructure } from '../src/lib/designer/structure.js';
import { editPresentation } from '../src/lib/designer/agent-edit-presentation.js';
const scope={schema:'vict.ui-slot-scope@1' as const,props:[{name:'nodeType',type:'string' as const},{name:'nodeId',type:'string' as const}],state:{prompt:{key:'prompt',type:'string' as const,initial:'',controlled:true}},conditions:{isPrompt:{type:'compare' as const,op:'eq' as const,left:{type:'ref' as const,path:'prop.nodeType'},right:{type:'literal' as const,value:'prompt'}}},outputs:[{name:'generate',payload:'string' as const}]};
function edit(source:UiDocument,operations:AgentEdit['operations']){const cursor=documentCursor(source,source.revision,'flow-workspace');return prepareAgentEdit(source,cursor,{expectedRevision:cursor.revision,reason:'Exercise public scoped flow contracts',operations},crypto.randomUUID());}
function graph(){const result=applyGraphOperations(emptyGraph(),[{type:'defineNodeType',definition:{id:'prompt',label:'Prompt',fields:[{id:'prompt',label:'Prompt',kind:'textarea',default:'Starting prompt'}],ports:[]}},{type:'addNode',id:'one',nodeType:'prompt',position:{x:0,y:0}}]);if(!result.ok)throw Error('fixture');return result.graph;}
function source(){return newScreen('Scoped graph','scoped-graph');}
function authored(){if(!installedAuthoringRegistry.ok)throw Error(JSON.stringify(installedAuthoringRegistry.issues));const result=edit(source(),[
  {op:'declareState',key:'graph',type:'string',initial:serializeGraph(graph())},
  {op:'insert',kind:'component',nodeId:'workspace',parentId:'screen',componentId:'vict.flow.workspace',revision:'1'},
  {op:'bind',nodeId:'workspace',prop:'graph',expression:{type:'ref',path:'state.graph'}},
  {op:'connect',nodeId:'workspace',output:'graphChange',binding:{setState:{key:'graph'}}},
  {op:'slotScope',nodeId:'workspace',slot:'body',scope},
  {op:'insert',kind:'element',nodeId:'promptBody',parentId:'workspace',slotName:'body',tag:'div'},
  {op:'when',nodeId:'promptBody',wrapperId:'promptVariant',conditionId:'isPrompt'},
  {op:'insert',kind:'element',nodeId:'input',parentId:'promptBody',tag:'textarea',attributes:{'aria-label':'Prompt'}},
  {op:'wireInput',nodeId:'input',key:'prompt'},
  {op:'insert',kind:'component',nodeId:'generate',parentId:'promptBody',componentId:'vict.catalog.button',revision:'1',props:{label:'Generate'}},
  {op:'connect',nodeId:'generate',output:'press',binding:{emit:{output:'generate',value:{type:'ref',path:'prop.nodeId'}}}},
]);if(!result.ok)throw Error(JSON.stringify(result));return result.document;}
describe('public Studio flow workspace authoring',()=>{
  it('authors canonical scoped bodies, declared outputs and family conditions without a private graph document',()=>{
    const doc=authored(),workspace=doc.nodes.workspace;
    expect(workspace.kind).toBe('component');if(workspace.kind!=='component')throw Error('fixture');
    expect(workspace.slots?.body.scope).toEqual(scope);
    expect(workspace.slots?.body.children).toEqual(['promptVariant']);
    expect(doc.localState).not.toHaveProperty('prompt');
    expect(doc.nodes.input.interactions).toEqual([{on:'change',action:'setState',key:'prompt',value:{type:'ref',path:'state.prompt'}}]);
    expect(doc.nodes.promptVariant).toEqual({kind:'conditional',id:'promptVariant',branches:[{when:'isPrompt',children:['promptBody']}]});
    expect(compileScreen(doc).ok).toBe(true);
    const structure=projectStructure(doc);
    const scopedStates=structure.nodes.filter(node=>node.data?.kindLabel==='Scoped state');
    expect(scopedStates.some(node=>node.data?.scope==='Slot workspace.body')).toBe(true);
    expect(structure.nodes.some(node=>node.data?.kindLabel==='Scoped condition'&&node.data?.support!=='Unknown')).toBe(true);
    expect(structure.nodes.some(node=>node.data?.kindLabel==='Scoped prop'&&node.data?.support==='Unknown')).toBe(false);
    expect(structure.nodes.some(node=>node.data?.kindLabel==='Scoped output')).toBe(true);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    expect(editPresentation.$defs.operation.oneOf).toContainEqual({$ref:'#/$defs/slotScope'});
  });
  it('rejects scoped state mismatches and scopes on ordinary slots before any mutation',()=>{
    const before=source(),digest=canonicalUiDocument(before).contentDigest;
    expect(agentEditSchema.safeParse({expectedRevision:'1',reason:'bad scoped state',operations:[{op:'slotScope',nodeId:'x',slot:'body',scope:{...scope,state:{prompt:{key:'prompt',type:'string',initial:1}}}}]}).success).toBe(false);
    const result=edit(before,[{op:'slotScope',nodeId:'screen',slot:'body',scope}]);
    expect(result).toMatchObject({ok:false,code:'STUDIO_AGENT_SLOT_SCOPE'});
    expect(canonicalUiDocument(before).contentDigest).toBe(digest);
  });
  it('rejects an undeclared scoped output instead of granting action authority',()=>{
    const doc=authored(),digest=canonicalUiDocument(doc).contentDigest;
    const result=edit(doc,[{op:'connect',nodeId:'generate',output:'press',binding:{emit:{output:'notGranted',value:{type:'literal',value:'no'}}}}]);
    expect(result.ok).toBe(false);
    expect(canonicalUiDocument(doc).contentDigest).toBe(digest);
  });
  it('persists workspace graph values through the same canonical graph history/save bridge',()=>{
    const doc=authored();expect(graphStateKeys(doc)).toEqual(['graph']);
    const patched=patchAuthoredGraph(doc,'workspace',[{type:'setField',nodeId:'one',fieldId:'prompt',value:'Owner edit'}],graph().revision);
    expect(patched.ok).toBe(true);if(!patched.ok)throw Error(patched.message);
    const model=parseGraph(String(patched.document.localState.graph.initial));
    expect(model.ok&&model.graph.nodes[0].values.prompt).toBe('Owner edit');
    expect(rebaseGraphRuntime(patched.document,{graph:'stale',other:'keep'})).toEqual({graph:patched.document.localState.graph.initial,other:'keep'});
    expect(graphStateDocument(doc,'graph',patched.document.localState.graph.initial)).toEqual(patched.document);
    expect(graphStateDocument(doc,'graph','invalid')).toBeUndefined();
  });
});
