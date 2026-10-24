import {it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,authoringSemanticIssues,createUiAuthoringRegistry,type UiDocument} from '@victframework/ui';
import DocumentHost from '../src/document/DocumentHost.svelte';
import {catalogDescriptors,catalogImplementations} from '../src/catalog/components/catalog.js';
import {catalogAuthoringPackage} from '../src/catalog/components/authoring.js';

it('keeps nested local slot caller scope through a real provider and its runtime identity checks (PV-04)',async()=>{
  const source:UiDocument={schema:'vict.ui-document@1',id:'nested-caller-slots',revision:'1',root:'outer',nodes:{
    outer:{kind:'component',id:'outer',definitionId:'local.outer',props:{title:{type:'literal',value:'Caller menu'}}},
    inner:{kind:'component',id:'inner',definitionId:'local.inner',props:{title:{type:'literal',value:'Wrong inner title'}},slots:{menus:{name:'menus',children:['menu']}}},
    provider:{kind:'component',id:'provider',definitionId:'vict.catalog.menubar',revision:'1',slots:{menus:{name:'menus',children:['slot']}}},
    slot:{kind:'slot',id:'slot',name:'menus',fallback:[]},
    menu:{kind:'component',id:'menu',definitionId:'vict.catalog.menubar.menu',revision:'1',props:{label:{type:'ref',path:'prop.title'},value:{type:'literal',value:'file'}},slots:{items:{name:'items',children:['item']}}},
    item:{kind:'component',id:'item',definitionId:'vict.catalog.menubar.item',revision:'1',props:{label:{type:'literal',value:'New item'}}},
  },componentDefinitions:{
    'local.outer':{id:'local.outer',revision:'1',root:'inner',props:[{name:'title',type:'string'}],slots:{}},
    'local.inner':{id:'local.inner',revision:'1',root:'provider',props:[{name:'title',type:'string'}],slots:{menus:{}}},
  },localState:{},styleSources:{},tokens:{},assets:{},conditions:{}};
  const registry=createUiAuthoringRegistry([catalogAuthoringPackage],catalogImplementations,{requireCompatibility:true});
  expect(registry.ok).toBe(true);expect(authoringSemanticIssues(source,registry).filter(issue=>issue.severity==='error')).toEqual([]);
  const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),catalogDescriptors);expect(compiled.ok).toBe(true);if(!compiled.ok)return;
  const target=document.createElement('div');document.body.append(target);const diagnostics:unknown[]=[];
  const instance=mount(DocumentHost,{target,props:{plan:compiled.plan,localState:source.localState,extensionDescriptors:catalogDescriptors,extensionImplementations:catalogImplementations,dispatch:async()=>undefined,navigate:()=>undefined,onRenderDiagnostic:(diagnostic:unknown)=>diagnostics.push(diagnostic)}});
  try{flushSync();expect(target.querySelector('[role="alert"]')).toBeNull();expect(target.querySelector('[role="menubar"]')).not.toBeNull();expect(target.textContent).toContain('Caller menu');expect(target.textContent).not.toContain('Wrong inner title');expect(target.querySelector('[data-ui-node="menu"]')?.getAttribute('data-ui-occ')).toContain('|menu|');expect(diagnostics).toEqual([]);}
  finally{await unmount(instance);target.remove();}
});
