import {expect,it} from 'vitest';
import {GraphSession,applyGraphOperations,parseGraph,serializeGraph,copyGraphSelection,type GraphDocument} from '../src/editor/model.js';
import {GraphSessionV2,applyGraphOperationsV2,parseGraphV2,serializeGraphV2,copyGraphSelectionV2,type GraphDocumentV2} from '../src/editor/model-v2.js';
import {applyGraphCommand,type GraphCommandReceipt} from '../src/editor/commands.js';

function graph(version:1|2):GraphDocument|GraphDocumentV2 {
  const ports=Array.from({length:129},(_,i)=>({id:`p${i}`,label:`Port ${i}`,direction:'output' as 'input'|'output',type:'text'}));
  ports.push({id:'in',label:'Input',direction:'input',type:'text'});
  const families=Array.from({length:129},(_,i)=>({id:`f${i}`,label:`Family ${i}`,ports,
    ...(version===1?{fields:Array.from({length:129},(_,j)=>({id:`v${j}`,label:`Value ${j}`,kind:'text',default:''}))}:{parameters:Object.fromEntries(Array.from({length:129},(_,j)=>[`v${j}`,{type:'string',default:''}]))})}));
  return {schema:`vict.flow-graph@${version}`,revision:0,nodeTypes:families,
    nodes:Array.from({length:1001},(_,i)=>({id:`n${i}`,type:'f0',label:`Node ${i}`,position:{x:i,y:0},values:{v0:'x'.repeat(1100)}})),
    edges:Array.from({length:4001},(_,i)=>({id:`e${i}`,source:`n${Math.floor(i/100)}`,sourcePort:'p0',target:`n${100+i%100}`,targetPort:'in'}))} as GraphDocument|GraphDocumentV2;
}

it.each([1,2] as const)('round-trips graph@%i beyond former byte/family/port/parameter/node/edge and clipboard ceilings',version=>{
  const source=graph(version),before=JSON.stringify(source);
  expect(before.length).toBeGreaterThan(1_000_000);
  if(version===1){
    const value=source as GraphDocument;
    expect(parseGraph(serializeGraph(value))).toEqual({ok:true,graph:value});
    const selection={nodes:value.nodes.map(n=>n.id),edges:value.edges.map(e=>e.id)};
    const target={...value,nodes:[],edges:[]};
    expect(applyGraphOperations(target,[{type:'paste',clipboard:copyGraphSelection(value,selection)}]).ok).toBe(true);
    expect(applyGraphOperations(value,Array.from({length:51},()=>({type:'setLabel',nodeId:'n0',label:'Changed'}))).ok).toBe(true);
  }else{
    const value=source as GraphDocumentV2;
    expect(parseGraphV2(serializeGraphV2(value))).toEqual({ok:true,graph:value});
    const selection={nodes:value.nodes.map(n=>n.id),edges:value.edges.map(e=>e.id)};
    const target={...value,nodes:[],edges:[]};
    expect(applyGraphOperationsV2(target,[{type:'paste',clipboard:copyGraphSelectionV2(value,selection)}]).ok).toBe(true);
    expect(applyGraphOperationsV2(value,Array.from({length:51},()=>({type:'setLabel',nodeId:'n0',label:'Changed'}))).ok).toBe(true);
  }
  expect(JSON.stringify(source)).toBe(before);
},30000);

it.each([1,2] as const)('preserves default graph@%i history beyond100 and resets only explicitly',version=>{
  const source=graph(version);source.nodes=source.nodes.slice(0,1);source.edges=[];source.nodeTypes=source.nodeTypes.slice(0,1);
  source.nodeTypes[0]!.ports=[];
  if(source.schema==='vict.flow-graph@1')source.nodeTypes[0]!.fields=source.nodeTypes[0]!.fields.slice(0,1);
  else source.nodeTypes[0]!.parameters={v0:{type:'string',default:''}};
  const session=version===1?new GraphSession(source as GraphDocument):new GraphSessionV2(source as GraphDocumentV2);
  for(let i=0;i<101;i++)expect(session.apply([{type:'setLabel',nodeId:'n0',label:`Edit ${i}`}]).ok).toBe(true);
  for(let i=0;i<101;i++)expect(session.undo().ok).toBe(true);
  expect(session.graph.nodes[0]!.label).toBe('Node 0');expect(session.canUndo).toBe(false);
  expect(session.replace(session.graph).ok).toBe(true);expect(session.canRedo).toBe(false);
});

it('keeps all command identities beyond128 without replay or stale/type/atomicity regressions',()=>{
  let source=graph(1) as GraphDocument;source.nodes=source.nodes.slice(0,1);source.edges=[];source.nodeTypes=source.nodeTypes.slice(0,1);
  source.nodeTypes[0]!.ports=[];source.nodeTypes[0]!.fields=source.nodeTypes[0]!.fields.slice(0,1);
  let receipts:readonly GraphCommandReceipt[]=[];
  const first={schema:'vict.flow-command@1',id:'command-0',expectedRevision:0,operations:[{type:'setLabel',nodeId:'n0',label:'Edit 0'}]};
  for(let i=0;i<130;i++){
    const result=applyGraphCommand(source,{...first,id:`command-${i}`,expectedRevision:source.revision,operations:[{type:'setLabel',nodeId:'n0',label:`Edit ${i}`}]},receipts);
    expect(result.ok).toBe(true);if(!result.ok)throw Error('command refused');source=result.graph;receipts=result.receipts;
  }
  expect(receipts).toHaveLength(130);expect(applyGraphCommand(source,first,receipts)).toMatchObject({ok:true,replayed:true,graph:source});
  const before=JSON.stringify(source);
  expect(applyGraphOperations(source,[{type:'setLabel',nodeId:'n0',label:'Must not apply'}],0).ok).toBe(false);
  expect(applyGraphOperations(source,[{type:'setLabel',nodeId:'n0',label:'Must not apply'},{type:'setField',nodeId:'n0',fieldId:'v0',value:12}]).ok).toBe(false);
  expect(JSON.stringify(source)).toBe(before);
});
it('keeps legacy long text and finite clipboard offsets without arbitrary content/range ceilings',()=>{
  const source=graph(1) as GraphDocument;source.nodes=source.nodes.slice(0,1);source.edges=[];source.nodeTypes=source.nodeTypes.slice(0,1);
  source.nodes[0]!.values.v0='x'.repeat(10001);source.nodes[0]!.label='Label'.repeat(100);
  expect(parseGraph(serializeGraph(source))).toEqual({ok:true,graph:source});
  const moved=applyGraphOperations(source,[{type:'duplicate',selection:{nodes:['n0'],edges:[]},offset:20001}]);
  expect(moved.ok).toBe(true);if(moved.ok)expect(moved.graph.nodes[1]!.position.x).toBe(20001);
});
