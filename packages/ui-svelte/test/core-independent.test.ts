import { it, expect } from 'vitest';
import { mount,unmount,flushSync } from 'svelte';
import { compileUiDocument,defaultSemanticElementCatalog,authoringSemanticIssues,createUiAuthoringRegistry,type UiDocument } from '@victframework/ui';
import { catalogDescriptors,catalogImplementations } from '../src/catalog/components/catalog.js';
import { catalogAuthoringPackage } from '../src/catalog/components/authoring.js';
import AuthoringIdentityFixture from './AuthoringIdentityFixture.svelte';
it('preserves local-definition supplied slot parts in identity admission and actual rendered provider',async()=>{
 const source:UiDocument={schema:'vict.ui-document@1',id:'local-fill-independent',revision:'1',root:'instance',nodes:{
  instance:{kind:'component',id:'instance',definitionId:'local.menu',slots:{menus:{name:'menus',children:['menu']}}},
  provider:{kind:'component',id:'provider',definitionId:'vict.catalog.menubar',revision:'1',slots:{menus:{name:'menus',children:['fill']}}},
  fill:{kind:'slot',id:'fill',name:'menus',fallback:[]},
  menu:{kind:'component',id:'menu',definitionId:'vict.catalog.menubar.menu',revision:'1',props:{label:{type:'literal',value:'Local File'},value:{type:'literal',value:'file'}},slots:{items:{name:'items',children:['item']}}},
  item:{kind:'component',id:'item',definitionId:'vict.catalog.menubar.item',revision:'1',props:{label:{type:'literal',value:'New item'}}},
 },componentDefinitions:{'local.menu':{id:'local.menu',revision:'1',root:'provider',props:[],slots:{menus:{}}}},localState:{},styleSources:{},tokens:{},assets:{},conditions:{}};
 const registry=createUiAuthoringRegistry([catalogAuthoringPackage],catalogImplementations,{requireCompatibility:true});
 expect(authoringSemanticIssues(source,registry).filter(issue=>issue.severity==='error')).toEqual([]);
 const result=compileUiDocument(source,defaultSemanticElementCatalog(),catalogDescriptors);expect(result.ok).toBe(true);if(!result.ok)return;
 const target=document.createElement('div');document.body.append(target);const diagnostics:unknown[]=[];
 const instance=mount(AuthoringIdentityFixture,{target,props:{plan:result.plan,localState:source.localState,onDiagnostic:(value:unknown)=>diagnostics.push(value)}});
 try {flushSync();expect(target.querySelector('[role="alert"]')?.textContent).toBeUndefined();expect(target.querySelector('[role="menubar"]')).not.toBeNull();expect(target.textContent).toContain('Local File');}
 finally {await unmount(instance);target.remove();}
});
