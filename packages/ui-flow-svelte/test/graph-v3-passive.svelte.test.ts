import {it,expect} from 'vitest';
import {validateGraphV3,parseGraphOperationsV3,applyGraphOperationsV3,serializeGraphV3,copyGraphSelectionV3,migrateGraphV2ToV3,resolveGraphEdgeAppearance,type GraphDocumentV3} from '../src/editor/model-v3.js';
import {passiveJsonSnapshot} from '../src/editor/passive-json.js';
const graph=():GraphDocumentV3=>({schema:'vict.flow-graph@3',revision:4,nodeTypes:[],nodes:[],edges:[],edgeDefaults:{color:'#abc',width:2},allowCycles:false});
it('owns descriptors before public validation/operation parsing without invoking virtual JSON hooks',()=>{
 let hooks=0;const input=new Proxy(graph(),{get(target,key,receiver){if(key==='toJSON')return ()=>{hooks++;return {...graph(),edgeDefaults:{color:'url(https://unsafe.invalid)'}};};return Reflect.get(target,key,receiver);}});
 const checked=validateGraphV3(input);expect(checked.ok).toBe(true);expect(checked.ok&&checked.graph).toEqual(graph());
 const op=new Proxy({type:'setEdgeDefaults',appearance:{width:3}},{get(target,key,receiver){if(key==='toJSON')return ()=>{hooks++;return {type:'setEdgeDefaults',appearance:{color:'url(https://unsafe.invalid)'}};};return Reflect.get(target,key,receiver);}});
 const parsed=parseGraphOperationsV3([op]);expect(parsed).toEqual({ok:true,operations:[{type:'setEdgeDefaults',appearance:{width:3}}]});expect(hooks).toBe(0);
});
it('copy, default revision, appearance projection and migration never reread raw source properties',()=>{
 const gets:string[]=[];const raw=graph();const proxy=new Proxy(raw,{get(_target,key){gets.push(String(key));throw Error('Raw property read');}});
 expect(serializeGraphV3(proxy)).toBe(JSON.stringify(raw));const copied=JSON.parse(copyGraphSelectionV3(proxy,new Proxy({nodes:[],edges:[]},{get(){throw Error('Raw selection read');}})));expect(copied.edgeDefaults).toEqual(raw.edgeDefaults);expect(copied.allowCycles).toBe(false);
 const result=applyGraphOperationsV3(proxy,[{type:'setEdgeDefaults',appearance:{width:3}}]);expect(result.ok&&result.graph.revision).toBe(5);expect(resolveGraphEdgeAppearance(proxy)).toMatchObject(raw.edgeDefaults!);
 const legacy={...raw,schema:'vict.flow-graph@2' as const};delete (legacy as Partial<GraphDocumentV3>).edgeDefaults;
 const migrated=migrateGraphV2ToV3(new Proxy(legacy,{get(){throw Error('Raw migration read');}}));expect(migrated.ok).toBe(true);expect(gets).toEqual([]);
});
it('rejects sparse/symbol/accessor/prototype/cyclic and throwing-trap input without hidden execution',()=>{
 let getters=0;const getter=Object.defineProperty(graph(),'edgeDefaults',{enumerable:true,get(){getters++;return {};}});expect(validateGraphV3(getter).ok).toBe(false);expect(getters).toBe(0);
 const proto=graph();Object.defineProperty(proto,'__proto__',{enumerable:true,value:{}});expect(validateGraphV3(proto).ok).toBe(false);
 expect(validateGraphV3({...graph(),[Symbol('hidden')]:1}).ok).toBe(false);expect(parseGraphOperationsV3(new Array(2)).ok).toBe(false);
 for(const handler of [{ownKeys(){throw Error('ownKeys');}},{getPrototypeOf(){throw Error('prototype');}},{getOwnPropertyDescriptor(){throw Error('descriptor');}}])expect(validateGraphV3(new Proxy(graph(),handler)).ok).toBe(false);
 const cyclic:{self?:unknown}={};cyclic.self=cyclic;expect(passiveJsonSnapshot(cyclic).ok).toBe(false);
});
it('retains acyclic alias JSON values without references to caller data or arbitrary traversal depth quota',()=>{
 const zero=passiveJsonSnapshot(-0);expect(zero.ok&&Object.is(zero.value,0)).toBe(true);const shared={values:[1,'two',true]};const result=passiveJsonSnapshot({first:shared,second:shared});expect(result.ok).toBe(true);if(!result.ok)return;const owned=result.value as {first:typeof shared;second:typeof shared};expect(owned.first).toEqual(shared);expect(owned.first).not.toBe(shared);expect(owned.first).not.toBe(owned.second);shared.values[0]=9;expect(owned.first.values[0]).toBe(1);
 let deep:unknown='leaf';for(let i=0;i<5000;i++)deep={child:deep};const captured=passiveJsonSnapshot(deep);expect(captured.ok).toBe(true);if(captured.ok){let current=captured.value;for(let i=0;i<5000;i++)current=(current as {child:unknown}).child;expect(current).toBe('leaf');}
});
