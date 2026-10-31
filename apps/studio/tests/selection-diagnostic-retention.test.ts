import {expect,it,vi} from 'vitest';
import {ZodError} from 'zod';
import {agentEditDiagnostics,canonicalEditFailure,canonicalEditDiagnosticSchema,documentCursor,prepareAgentEdit} from '../src/lib/designer/agent-edits.js';
import {selectionSet,selectionSetSchema,selectionContext,validSelectionSet} from '../src/lib/designer/selection-context.js';
import {nodeItem} from '../src/lib/designer/workspace-selection.js';
import {bindingFixture} from './fixtures/structure-semantics.js';
import {createShowcaseFixture} from '../src/lib/designer/showcase.js';
import * as authoring from '../src/lib/designer/authoring.js';

it('retains every valid large selection and full source-derived labels without identity/authority weakening',()=>{
  const source=bindingFixture();const label='Label '+'界'.repeat(2000);const ids=Array.from({length:30},(_,index)=>`node-${index}-`+'n'.repeat(4500));
  const nodes={...source.nodes};for(const id of ids)nodes[id]={kind:'element',id,tag:'input',children:[],attributes:{'aria-label':label}};
  const root=nodes[source.root];if(root.kind!=='element')throw Error('Root fixture');nodes[source.root]={...root,children:[...root.children,...ids]};
  const document={...source,id:'document-'+ 'd'.repeat(200),nodes};
  const items=ids.map(id=>nodeItem(document,`${document.id}|${id}`)!);expect(items.every(Boolean)).toBe(true);
  const set=selectionSet({documentId:document.id,items});expect(selectionSetSchema.safeParse(set).success).toBe(true);expect(set.items).toHaveLength(30);expect(JSON.stringify(set).length).toBeGreaterThan(6000);expect(validSelectionSet(document,set,{})).toBe(true);
  const context=selectionContext(document,set,{});expect(context?.items).toHaveLength(30);expect(context?.truncated).toBe(false);expect(context?.items.every(item=>item.label===label)).toBe(true);expect(JSON.stringify(context).length).toBeGreaterThan(5000);
  expect(selectionSetSchema.safeParse({...set,total:30000}).success).toBe(true);
  for(const invalid of [{...set,privateReasoning:'secret'},{...set,items:[{kind:'node',id:ids[0],execute:true}]},{...set,total:-1},{...set,total:0}])expect(selectionSetSchema.safeParse(invalid).success).toBe(false);
  expect(validSelectionSet(document,{...set,documentId:'foreign'},{})).toBe(false);
});

it('retains every schema diagnostic and complete long paths/messages',()=>{
  const message='Invalid '+'界'.repeat(3000),path='path-'+ 'p'.repeat(1000);
  const error=new ZodError(Array.from({length:40},(_,index)=>({code:'custom' as const,path:['operations',index,path],message})));
  const diagnostics=agentEditDiagnostics(error);expect(diagnostics).toHaveLength(40);expect(diagnostics[39]?.message).toContain(message);expect(diagnostics[39]?.path).toContain(path);
});

it('unwraps all deep compiler-envelope causes, keeps long whitelisted detail and never copies private nested payloads',()=>{
  const message='Cause '+'界'.repeat(2000),nodeId='node-'+'n'.repeat(900),path='state.'+'p'.repeat(900);
  const leaves=Array.from({length:80},(_,index)=>({code:`CAUSE_${index}`,message,path,nodeId,expected:'expected'.repeat(100),actual:'actual'.repeat(100),privateReasoning:'DO-NOT-FORWARD',detail:{reference:'ref'.repeat(300),providerCredential:'DO-NOT-FORWARD'}}));
  let envelope:{code:string;message:string;diagnostics:unknown[];commandIndex?:number}={code:'UI_EDIT_VALIDATION_FAILED',message:'Envelope',diagnostics:leaves,commandIndex:3};
  for(let depth=0;depth<100;depth++)envelope={code:'UI_EDIT_VALIDATION_FAILED',message:'Envelope',diagnostics:[envelope]};
  const result=canonicalEditFailure([envelope],4);expect(result.diagnostics).toHaveLength(80);expect(result.diagnosticsTruncated).toBeUndefined();
  expect(result.diagnostics?.[79]).toMatchObject({code:'CAUSE_79',message,path,nodeId,commandIndex:3,operation:4,envelopeCode:'UI_EDIT_VALIDATION_FAILED',reference:'ref'.repeat(300)});expect(result.message).toContain('CAUSE_79');expect(result.message.length).toBeGreaterThan(1800);expect(JSON.stringify(result)).not.toContain('DO-NOT-FORWARD');
  expect(result.diagnostics?.every(diagnostic=>canonicalEditDiagnosticSchema.safeParse(diagnostic).success)).toBe(true);
  const opaque=canonicalEditFailure([{code:'OPAQUE',message:'Public',diagnostics:leaves,privateReasoning:'DO-NOT-FORWARD'}]);expect(opaque.diagnostics).toHaveLength(1);expect(JSON.stringify(opaque)).not.toContain('CAUSE_0');
});

it('terminates cyclic compiler envelopes without executing accessors or forwarding unknown/private values',()=>{
  let calls=0;const leaf={code:'PUBLIC',message:'Actual public cause'};const envelope:{code:string;message:string;diagnostics:unknown[];expected?:unknown}={code:'UI_EDIT_VALIDATION_FAILED',message:'Cycle envelope',diagnostics:[leaf]};envelope.diagnostics.push(envelope);
  Object.defineProperty(leaf,'expected',{get(){calls++;throw Error('Do not execute');}});
  Object.defineProperty(envelope,'privateReasoning',{get(){calls++;throw Error('Do not execute');}});
  const result=canonicalEditFailure([envelope]);expect(calls).toBe(0);expect(result.diagnosticsTruncated).toBe(true);expect(result.diagnostics?.[0]).toMatchObject({code:'PUBLIC',message:'Actual public cause'});expect(JSON.stringify(result)).not.toContain('privateReasoning');
});

it('reports the full supported-property catalog when a browser edit is refused',()=>{
  const fixture=createShowcaseFixture('vict.ai.prompt-input'),node=fixture.document.nodes[fixture.targetNodeId],original=authoring.nodeDescriptor(node);if(!original)throw Error('Registered descriptor fixture');
  const props=[...original.props,...Array.from({length:140},(_,index)=>({name:`supplied-${index}`,type:'string' as const}))];
  const descriptor=vi.spyOn(authoring,'nodeDescriptor').mockReturnValue({...original,props});
  try{
    const cursor=documentCursor(fixture.document,'r1',crypto.randomUUID());
    const result=prepareAgentEdit(fixture.document,cursor,{expectedRevision:cursor.revision,reason:'Inspect refused prop metadata',operations:[{op:'modify',nodeId:fixture.targetNodeId,props:{notDeclared:['one']}}]},'supported-props');
    expect(result.ok).toBe(false);if(result.ok)throw Error('Unknown property unexpectedly accepted');
    expect(result.diagnostics?.[0]?.supportedProps).toEqual(props.map(prop=>prop.name));expect(result.message).toContain('supplied-139');
  }finally{descriptor.mockRestore();}
});
