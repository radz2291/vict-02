import {it,expect} from 'vitest';
import {createUiAuthoringRegistry,authoringSemanticIssues,type UiAuthoringRegistration,type UiNode,type UiDocument} from '../src/index.js';
const reg=(id:string,extra:Partial<UiAuthoringRegistration>={}):UiAuthoringRegistration=>({descriptor:{id,revision:'1',props:[{name:'value',type:'string',default:''}],slots:['tabs','panels'],abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'independent'},label:id,family:'independent',category:'test',purpose:'Independent positive and negative admission',eligibility:{kind:'standalone'},...extra});
const install=(rs:UiAuthoringRegistration[])=>createUiAuthoringRegistry([{schema:'vict.ui-authoring@1',packageName:'independent',packageVersion:'1',registrations:rs,exportDispositions:[]}],rs.map(r=>({extensionId:r.descriptor.id,revision:r.descriptor.revision,rendererImplementationId:'independent',abi:r.descriptor.abi,slots:r.descriptor.slots})));
const document=(nodes:UiNode[]):UiDocument=>({schema:'vict.ui-document@1',id:'recheck',revision:'1',root:'outer',nodes:Object.fromEntries(nodes.map(n=>[n.id,n])),componentDefinitions:{},localState:{},tokens:{},conditions:{},styleSources:{},assets:{}});
it('owns required and paired parts by nearest provider while accepting two fully valid nested providers',()=>{
 const provider=reg('tabs',{dependencies:[{id:'trigger',revision:'1'},{id:'panel',revision:'1'}],rules:[{kind:'requiredParts',slot:'tabs',definitionIds:['trigger']},{kind:'requiredParts',slot:'panels',definitionIds:['panel']},{kind:'pairedValues',left:{slot:'tabs',definitionIds:['trigger'],property:'value'},right:{slot:'panels',definitionIds:['panel'],property:'value'}}]});
 const registry=install([provider,reg('trigger'),reg('panel')]);expect(registry.ok).toBe(true);
 const part=(id:string,kind:string,value:string):UiNode=>({kind:'component',id,definitionId:kind,revision:'1',props:{value:{type:'literal',value}}});
 const source=document([{kind:'component',id:'outer',definitionId:'tabs',slots:{tabs:{name:'tabs',children:['wrapper','outer-trigger']},panels:{name:'panels',children:['outer-panel']}}},{kind:'element',id:'wrapper',tag:'div',children:['inner']},{kind:'component',id:'inner',definitionId:'tabs',slots:{tabs:{name:'tabs',children:['inner-trigger']},panels:{name:'panels',children:['inner-panel']}}},part('outer-trigger','trigger','outer'),part('outer-panel','panel','outer'),part('inner-trigger','trigger','inner'),part('inner-panel','panel','inner')]);
 expect(authoringSemanticIssues(source,registry).filter(i=>i.severity==='error')).toEqual([]);
 const missing={...source,nodes:{...source.nodes,outer:{...source.nodes.outer,slots:{tabs:{name:'tabs',children:['wrapper']},panels:{name:'panels',children:['outer-panel']}}} as UiNode}};
 const issues=authoringSemanticIssues(missing,registry);expect(issues.some(i=>i.nodeId==='outer'&&i.hostCode==='UI_AUTHORING_REQUIRED_PART')).toBe(true);expect(issues.some(i=>i.nodeId==='outer'&&i.hostCode==='UI_AUTHORING_PAIRED_VALUES')).toBe(true);expect(issues.filter(i=>i.nodeId==='inner')).toEqual([]);
});
it('rejects unavailable children independently from valid owner-slot and declared child-property checks',()=>{
 expect(install([reg('owner',{rules:[{kind:'requiredParts',slot:'tabs',definitionIds:['missing']}]})]).ok).toBe(false);
 const invalid=reg('owner',{dependencies:[{id:'child',revision:'1'}],rules:[{kind:'pairedValues',left:{slot:'tabs',definitionIds:['child'],property:'missing'},right:{slot:'panels',definitionIds:['child'],property:'value'}}]});
 expect(install([invalid,reg('child')]).ok).toBe(false);
 const valid={...invalid,rules:[{kind:'pairedValues' as const,left:{slot:'tabs',definitionIds:['child'],property:'value'},right:{slot:'panels',definitionIds:['child'],property:'value'}}]};expect(install([valid,reg('child')]).ok).toBe(true);
});
