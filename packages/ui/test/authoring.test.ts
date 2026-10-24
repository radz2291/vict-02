import {describe,it,expect} from 'vitest';
import {createUiAuthoringRegistry,authoringDigest,authoringImplementationCapabilities,authoringIndex,authoringContractBundle,authoringSemanticIssues,materializeAuthoringFragment,effectiveUiDescriptor,compileUiDocument,defaultSemanticElementCatalog,type UiAuthoringRegistration,type UiAuthoringPackage,type UiDocument,type UiNode} from '../src/index.js';
const registration=(id:string,extra:Partial<UiAuthoringRegistration>={}):UiAuthoringRegistration=>({descriptor:{id,revision:'1',props:[{name:'value',type:'string',default:''}],slots:['items'],outputs:[],abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'test'},label:id,family:'test',category:'input',purpose:'A test component',eligibility:{kind:'standalone'},...extra});
const pkg=(registrations:readonly UiAuthoringRegistration[]):UiAuthoringPackage=>({schema:'vict.ui-authoring@1',packageName:'@test/components',packageVersion:'1',registrations,exportDispositions:[]});
const capabilities=(r:UiAuthoringRegistration)=>({extensionId:r.descriptor.id,revision:r.descriptor.revision,rendererImplementationId:'test',abi:r.descriptor.abi,slots:r.descriptor.slots});
const registry=(registrations:readonly UiAuthoringRegistration[])=>createUiAuthoringRegistry([pkg(registrations)],registrations.map(capabilities));
const document=(nodes:UiNode[]):UiDocument=>({schema:'vict.ui-document@1',id:'doc',revision:'r1',root:'root',nodes:Object.fromEntries([{kind:'element',id:'root',tag:'main',children:nodes.filter(node=>node.id==='host').map(node=>node.id)} as UiNode,...nodes].map(node=>[node.id,node])),componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:{}});
describe('package authoring contracts',()=>{
  it('detects descriptor/renderer drift against retained compatibility bytes',()=>{
    const original=registration('field'),originalCapabilities=authoringImplementationCapabilities(capabilities(original));
    const pinned={...pkg([original]),compatibility:[{id:'field',revision:'1',descriptorDigest:authoringDigest(original.descriptor),capabilitiesDigest:authoringDigest(originalCapabilities)}]};
    expect(createUiAuthoringRegistry([pinned],[capabilities(original)]).ok).toBe(true);
    const changed={...original,descriptor:{...original.descriptor,props:[{name:'value',type:'number' as const,default:0}]}};
    const result=createUiAuthoringRegistry([{...pinned,registrations:[changed]}],[capabilities(changed)]);
    expect(result.issues.some(item=>item.hostCode==='UI_AUTHORING_CONTRACT_DRIFT')).toBe(true);
  });
  it('requires retained descriptor and capability baselines for production installs while keeping fixture registration explicitly unfrozen',()=>{
    const fresh=registration('new');expect(registry([fresh]).ok).toBe(true);
    const strict=createUiAuthoringRegistry([pkg([fresh])],[capabilities(fresh)],{requireCompatibility:true});expect(strict.ok).toBe(false);expect(strict.issues.some(item=>item.hostCode==='UI_AUTHORING_COMPATIBILITY_MISSING')).toBe(true);
  });
  it('registers a new eligible family and derives contracts without parallel schema copies',()=>{
    const fresh=registration('new-family');const installed=registry([fresh]);
    expect(installed.ok).toBe(true);expect(authoringIndex(installed).items[0]?.id).toBe('new-family');
    expect(authoringContractBundle(installed,{requested:[{id:'new-family'}]}).items[0]).toMatchObject({contract:{descriptor:fresh.descriptor}});
  });
  it('selectively invalidates a changed contract and its dependencies',()=>{
    const child=registration('child'),parent=registration('parent',{dependencies:[{id:'child',revision:'1'}]}),other=registration('other');
    const before=registry([child,parent,other]);const after=registry([{...child,purpose:'Changed semantic guidance'},parent,other]);
    expect(before.contracts[0]?.digest).not.toBe(after.contracts[0]?.digest);expect(before.contracts[1]?.digest).not.toBe(after.contracts[1]?.digest);expect(before.contracts[2]?.digest).toBe(after.contracts[2]?.digest);
    const known=Object.fromEntries(before.contracts.map(item=>[`${item.descriptor.id}@1`,item.digest]));
    expect(authoringContractBundle(after,{requested:[{id:'other'}],knownDigests:known}).items[0]).toMatchObject({unchanged:true});
  });
  it('derives a changed revision contract while retaining the exact prior contract and its cache identity',()=>{
    const old=registration('field'),before=registry([old]);
    const changed:UiAuthoringRegistration={...old,descriptor:{...old.descriptor,revision:'2',props:[{name:'value',type:'number',default:0}]}};
    const after=registry([old,changed]);expect(after.ok).toBe(true);
    const oldDigest=before.contracts[0]!.digest;
    const bundle=authoringContractBundle(after,{requested:[{id:'field',revision:'1'},{id:'field',revision:'2'}],knownDigests:{'field@1':oldDigest}});
    expect(bundle.complete).toBe(true);expect(bundle.items[0]).toMatchObject({id:'field',revision:'1',unchanged:true});expect(bundle.items[1]).toMatchObject({id:'field',revision:'2',contract:{descriptor:{props:[{name:'value',type:'number'}]}}});
  });
  it('bounds large discovery and refuses an incomplete closure truthfully',()=>{
    const many=registry(Array.from({length:300},(_,index)=>registration(`item-${index}`)));
    expect(authoringIndex(many,{limit:99}).items).toHaveLength(20);expect(authoringIndex(many,{query:'item-299'}).items).toHaveLength(1);
    const child=registration('child'),parent=registration('parent',{dependencies:[{id:'child',revision:'1'}]});
    const result=authoringContractBundle(registry([child,parent]),{requested:[{id:'parent'}],maxItems:1});
    expect(result.complete).toBe(false);expect(result.pending).toEqual(['parent@1']);expect(result.items).toHaveLength(1);
  });
  it('fails missing registrations, missing dependencies and cyclic dependencies',()=>{
    const a=registration('a',{dependencies:[{id:'b',revision:'1'}]}),b=registration('b',{dependencies:[{id:'a',revision:'1'}]});
    expect(registry([a]).issues.some(item=>item.hostCode==='UI_AUTHORING_DEPENDENCY_MISSING')).toBe(true);
    expect(registry([a,b]).issues.some(item=>item.hostCode==='UI_AUTHORING_DEPENDENCY_CYCLE')).toBe(true);
    expect(createUiAuthoringRegistry([pkg([])],[capabilities(a)]).issues[0]?.hostCode).toBe('UI_AUTHORING_MISSING');
  });
  it('matches existing effective-revision semantics, including ambiguity',()=>{
    const old=registration('field').descriptor,newer={...old,revision:'2',slots:['new']};
    expect(effectiveUiDescriptor({definitionId:'field'},[old,newer])).toBe(newer);expect(effectiveUiDescriptor({definitionId:'field',revision:'1'},[old,newer])).toBe(old);expect(effectiveUiDescriptor({definitionId:'field'},[newer,newer])).toBeUndefined();
  });
  it('remaps structural identity, typed state references and explicit paired identities only',()=>{
    const result=materializeAuthoringFragment({root:'field',nodes:[{kind:'component',id:'field',definitionId:'test',props:{label:{type:'literal',value:'field'},value:{type:'ref',path:'state.chosen'}}}],localState:{chosen:{key:'chosen',type:'string',initial:'old'}},identities:[{stateKey:'chosen',sourceNodeId:'field'}]},'new');
    expect(result.nodes[0]).toMatchObject({id:'new',props:{label:{value:'field'},value:{path:'state.catalog_new_chosen'}}});expect(result.localState?.catalog_new_chosen?.initial).toBe('new');
  });
});
describe('source semantic admission',()=>{
  const host=registration('host'),part=registration('part',{legacyCompatibility:true,eligibility:{kind:'part'},rules:[{kind:'ancestorSlot',placements:[{definitionId:'host',slotName:'items'}]},{kind:'uniqueValue',property:'value',providerIds:['host'],slots:['items'],nonempty:true}]});
  const installed=registry([host,part]);
  const duplicate=document([{kind:'component',id:'host',definitionId:'host',slots:{items:{name:'items',children:['a','b']}}},{kind:'component',id:'a',definitionId:'part',props:{value:{type:'literal',value:'same'}}},{kind:'component',id:'b',definitionId:'part',props:{value:{type:'literal',value:'same'}}}]);
  it('rejects provable duplicate values through provider context and carries unchanged legacy source',()=>{
    const errors=authoringSemanticIssues(duplicate,installed);expect(errors.filter(item=>item.hostCode==='UI_AUTHORING_DUPLICATE_VALUE')).toHaveLength(2);
    expect(authoringSemanticIssues(duplicate,installed,{previous:duplicate}).every(item=>item.severity==='warning')).toBe(true);
    const moved={...duplicate,nodes:{...duplicate.nodes,a:{...duplicate.nodes.a,props:{value:{type:'literal',value:'different'}}} as UiNode}};
    expect(authoringSemanticIssues(duplicate,installed,{previous:moved}).some(item=>item.severity==='error')).toBe(true);
  });
  it('labels runtime identity uncertainty and checks invalid placement',()=>{
    const dynamic={...duplicate,nodes:{...duplicate.nodes,a:{...duplicate.nodes.a,props:{value:{type:'ref',path:'state.dynamic'}}} as UiNode}};
    expect(authoringSemanticIssues(dynamic,installed).some(item=>item.hostCode==='UI_AUTHORING_UNRESOLVED'&&item.severity==='warning')).toBe(true);
    const wrong=document([{kind:'component',id:'host',definitionId:'part',props:{value:{type:'literal',value:'x'}}}]);
    expect(authoringSemanticIssues(wrong,installed).some(item=>item.hostCode==='UI_AUTHORING_ANCESTOR_SLOT')).toBe(true);
  });
  it('rejects mismatched paired parts but allows an atomic matching composition',()=>{
    const tabs=registration('tabs',{rules:[{kind:'pairedValues',left:{slot:'items',definitionIds:['left'],property:'value'},right:{slot:'panels',definitionIds:['right'],property:'value'}}],descriptor:{...registration('tabs').descriptor,slots:['items','panels']}}),left=registration('left'),right=registration('right');
    const documentWithPair=document([{kind:'component',id:'host',definitionId:'tabs',slots:{items:{name:'items',children:['a']},panels:{name:'panels',children:['b']}}},{kind:'component',id:'a',definitionId:'left',props:{value:{type:'literal',value:'a'}}},{kind:'component',id:'b',definitionId:'right',props:{value:{type:'literal',value:'b'}}}]);
    const all=registry([tabs,left,right]);expect(authoringSemanticIssues(documentWithPair,all).some(item=>item.hostCode==='UI_AUTHORING_PAIRED_VALUES')).toBe(true);
    const fixed={...documentWithPair,nodes:{...documentWithPair.nodes,b:{...documentWithPair.nodes.b,props:{value:{type:'literal',value:'a'}}} as UiNode}};expect(authoringSemanticIssues(fixed,all)).toEqual([]);
  });
  it('compiles all six native heading levels through the shared semantic catalog',()=>{
    const doc=document([]);const nodes:Record<string,UiNode>={root:{kind:'element',id:'root',tag:'main',children:[]}};
    for(let level=1;level<=6;level++)nodes[`h${level}`]={kind:'element',id:`h${level}`,tag:`h${level}`,children:[]};nodes.root={...nodes.root,children:Object.keys(nodes).filter(id=>id!=='root')} as UiNode;
    expect(compileUiDocument({...doc,nodes},defaultSemanticElementCatalog()).ok).toBe(true);
  });
});
