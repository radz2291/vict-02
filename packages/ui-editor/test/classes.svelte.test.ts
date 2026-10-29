import {it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {applyUiEdit,compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
import {catalogDescriptors,catalogImplementations} from '@victframework/ui-svelte';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
const elements=defaultSemanticElementCatalog();
it('renders authored native and component classes while preserving generated ownership after clear',async()=>{
 const source:UiDocument={schema:'vict.ui-document@1',id:'render-classes',revision:'1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',children:['heading','field','button']},heading:{kind:'element',id:'heading',tag:'h2',classes:['old'],children:[],localStyle:[{property:'color',value:{type:'text',value:'#123456'}}]},field:{kind:'element',id:'field',tag:'textarea',children:[]},button:{kind:'component',id:'button',definitionId:'vict.catalog.button',revision:'1',props:{label:{type:'literal',value:'Action'}}}},componentDefinitions:{},styleSources:{},localState:{},tokens:{},conditions:{},assets:{}};
 const edited=applyUiEdit({document:source,revision:'1'},{requestId:'render-set',expectedDocumentRevision:'1',commands:[{op:'setClasses',nodeId:'heading',classes:['vict-graph-drag-handle','作品']},{op:'setClasses',nodeId:'field',classes:['nodrag','nopan','nowheel','vict-textarea']},{op:'setClasses',nodeId:'button',classes:['project-button']}]},{elements,extensions:catalogDescriptors});expect(edited.ok).toBe(true);if(!edited.ok)return;
 async function render(doc:UiDocument){const compiled=compileUiDocument(doc,elements,catalogDescriptors);expect(compiled.ok).toBe(true);if(!compiled.ok)throw Error('fixture');const target=document.createElement('div');document.body.append(target);const app=mount(DocumentHost,{target,props:{plan:compiled.plan,extensionDescriptors:catalogDescriptors,extensionImplementations:catalogImplementations,dispatch:async()=>undefined,navigate:()=>{}}});flushSync();return {target,app};}
 const first=await render(edited.document),heading=first.target.querySelector<HTMLElement>('[data-ui-node="heading"]')!;
 expect(heading.classList.contains('vict-graph-drag-handle')).toBe(true);expect(heading.classList.contains('作品')).toBe(true);expect(heading.classList.length).toBeGreaterThan(2);
 for(const name of ['nodrag','nopan','nowheel','vict-textarea'])expect(first.target.querySelector('textarea')?.classList.contains(name)).toBe(true);
 expect(first.target.querySelector('button')?.classList.contains('project-button')).toBe(true);expect(heading.getAttribute('data-ui-owner')).toBeTruthy();await unmount(first.app);first.target.remove();
 const cleared=applyUiEdit({document:edited.document,revision:'2'},{requestId:'render-clear',expectedDocumentRevision:'2',commands:[{op:'setClasses',nodeId:'heading',classes:[]}]},{elements,extensions:catalogDescriptors});expect(cleared.ok).toBe(true);if(!cleared.ok)return;
 const last=await render(cleared.document),owned=last.target.querySelector<HTMLElement>('[data-ui-node="heading"]')!;expect(owned.classList.contains('vict-graph-drag-handle')).toBe(false);expect(owned.classList.length).toBeGreaterThan(0);expect(owned.getAttribute('data-ui-node')).toBe('heading');expect(owned.getAttribute('data-ui-owner')).toBeTruthy();await unmount(last.app);last.target.remove();
});
