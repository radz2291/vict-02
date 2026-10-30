import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {authoringDigest,authoringImplementationCapabilities,createUiAuthoringRegistry,materializeAuthoringFragment,authoringSemanticIssues,compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
import {catalogDescriptors,catalogImplementations} from '../src/catalog/components/catalog.js';
import {catalogAuthoringPackage,catalogAuthoringRegistrations} from '../src/catalog/components/authoring.js';
import {validateSvelteComponentPlan} from '../src/document/extensions.js';
import {flushSync,mount,unmount} from 'svelte';
import AuthoringIdentityFixture from './AuthoringIdentityFixture.svelte';
const baselinePath=resolve('packages/ui-svelte/src/catalog/components/authoring-compatibility.json');
const generating=process.env.VICT_GENERATE_AUTHORING_BASELINE==='1';
it.skipIf(!generating)('records an explicit compatibility baseline from retained unchanged descriptors and actual renderer registrations',()=>{
  const pins=catalogDescriptors.map(descriptor=>({id:descriptor.id,revision:descriptor.revision,descriptorDigest:authoringDigest(descriptor),capabilitiesDigest:authoringDigest(authoringImplementationCapabilities(catalogImplementations.find(item=>item.extensionId===descriptor.id&&item.revision===descriptor.revision)!))}));
  writeFileSync(baselinePath,JSON.stringify(pins,null,2)+'\n');expect(pins).toHaveLength(catalogDescriptors.length);
});
describe.skipIf(generating)('general catalog package authoring knowledge',()=>{
  const registry=createUiAuthoringRegistry([catalogAuthoringPackage],catalogImplementations,{requireCompatibility:true});
  it('has one disposition per renderer descriptor and retained compatibility pins for all legacy components',()=>{
    expect(registry.issues).toEqual([]);expect(registry.ok).toBe(true);
    expect(catalogAuthoringRegistrations.map(item=>item.descriptor)).toEqual(catalogDescriptors);
    const pins=JSON.parse(readFileSync(baselinePath,'utf8')) as {id:string;revision:string}[];
    expect(pins.map(pin=>`${pin.id}@${pin.revision}`)).toEqual(catalogDescriptors.map(item=>`${item.id}@${item.revision}`));
    expect(JSON.parse(JSON.stringify(catalogAuthoringPackage))).toEqual(catalogAuthoringPackage);
  });
  it('compiles all declared examples against the real descriptor and renderer catalogs',()=>{
    for(const registration of catalogAuthoringRegistrations.filter(item=>item.eligibility.kind!=='host-required')){
      const fragment=materializeAuthoringFragment(registration.examples![0]!,'example');
      const document:UiDocument={schema:'vict.ui-document@1',id:`example-${registration.descriptor.id}`,revision:'r1',root:'screen',nodes:Object.fromEntries([{kind:'element' as const,id:'screen',tag:'main',children:[fragment.root]},...fragment.nodes].map(node=>[node.id,node])),componentDefinitions:{},localState:fragment.localState??{},styleSources:{},tokens:{},conditions:{},assets:{}};
      const result=compileUiDocument(document,defaultSemanticElementCatalog(),registry.descriptors);
      expect(result.ok,registration.descriptor.id).toBe(true);
      if(result.ok){expect(result.plan.diagnostics.filter(item=>item.severity==='error'),registration.descriptor.id).toEqual([]);expect(validateSvelteComponentPlan(result.plan,registry.descriptors,catalogImplementations),registration.descriptor.id).toEqual([]);}
      expect(authoringSemanticIssues(document,registry).filter(item=>item.severity==='error'),registration.descriptor.id).toEqual([]);
    }
  });
  it('seeds independent menu values and matching paired tab keys',()=>{
    const menu=catalogAuthoringRegistrations.find(item=>item.descriptor.id==='vict.catalog.menubar.menu')!;
    const first=materializeAuthoringFragment(menu.seed!,'file'),second=materializeAuthoringFragment(menu.seed!,'edit');
    expect(first.nodes[0]).toMatchObject({props:{value:{type:'literal',value:'file'}}});expect(second.nodes[0]).toMatchObject({props:{value:{type:'literal',value:'edit'}}});
    const tabs=catalogAuthoringRegistrations.find(item=>item.descriptor.id==='vict.catalog.tabs')!;
    const tab=materializeAuthoringFragment(tabs.seed!,'new-tabs');
    const trigger=tab.nodes.find(node=>node.kind==='component'&&node.definitionId==='vict.catalog.tabs-trigger');
    const panel=tab.nodes.find(node=>node.kind==='component'&&node.definitionId==='vict.catalog.tabs-panel');
    expect(trigger?.kind==='component'&&trigger.props?.value).toEqual(panel?.kind==='component'&&panel.props?.value);
  });
  it('derives typed date/time/list and boolean control state from descriptor contracts',()=>{
    for(const id of ['checkbox','date-field','time-field','select-multiple','slider']){
      const registration=catalogAuthoringRegistrations.find(item=>item.descriptor.id===`vict.catalog.${id}`)!;
      const fragment=materializeAuthoringFragment(registration.seed!,id);const root=fragment.nodes[0];
      expect(root?.kind).toBe('component');if(root?.kind!=='component')continue;
      for(const [output,binding]of Object.entries(root.outputs??{}))if('setState'in binding){const decl=fragment.localState?.[binding.setState.key];expect(decl?.type).toBe(registration.descriptor.outputs?.find(item=>item.name===output)?.payload);}
    }
  });
  it('accounts for every public package export path without advertising host helpers',()=>{
    const manifest=JSON.parse(readFileSync(resolve('packages/ui-svelte/package.json'),'utf8'));
    expect(catalogAuthoringPackage.exportDispositions.map(item=>item.name)).toEqual(Object.keys(manifest.exports));
    expect(catalogAuthoringRegistrations.find(item=>item.descriptor.id==='vict.catalog.appshell')?.eligibility.kind).toBe('host-required');
  });
  it('refuses ambiguous evaluated menu identities in actual DOM and recovers when runtime values become unique',async()=>{
    const source:UiDocument={schema:'vict.ui-document@1',id:'dynamic-menu',revision:'1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',children:['menu']},menu:{kind:'component',id:'menu',definitionId:'vict.catalog.menubar',slots:{menus:{name:'menus',children:['first','second']}}},first:{kind:'component',id:'first',definitionId:'vict.catalog.menubar.menu',props:{label:{type:'literal',value:'File'},value:{type:'ref',path:'state.first'}},slots:{items:{name:'items',children:['one']}}},second:{kind:'component',id:'second',definitionId:'vict.catalog.menubar.menu',props:{label:{type:'literal',value:'Edit'},value:{type:'ref',path:'state.second'}},slots:{items:{name:'items',children:['two']}}},one:{kind:'component',id:'one',definitionId:'vict.catalog.menubar.item',props:{label:{type:'literal',value:'First'}}},two:{kind:'component',id:'two',definitionId:'vict.catalog.menubar.item',props:{label:{type:'literal',value:'Second'}}}},localState:{first:{key:'first',type:'string',initial:'same'},second:{key:'second',type:'string',initial:'same'}},componentDefinitions:{},tokens:{},styleSources:{},assets:{},conditions:{}};
    const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),catalogDescriptors);expect(compiled.ok).toBe(true);if(!compiled.ok)return;
    const target=document.createElement('div');document.body.append(target);const diagnostics:unknown[]=[];
    const instance=mount(AuthoringIdentityFixture,{target,props:{plan:compiled.plan,localState:source.localState,onDiagnostic:(value:unknown)=>diagnostics.push(value)}});flushSync();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('ambiguous');expect(target.querySelector('[role="menubar"]')).toBeNull();expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({code:'UI_AUTHORING_RUNTIME_IDENTITY'})]));
    instance.setSecond('unique');flushSync();expect(target.querySelector('[role="alert"]')).toBeNull();expect(target.querySelector('[role="menubar"]')).not.toBeNull();
    await unmount(instance);target.remove();
  });
});
