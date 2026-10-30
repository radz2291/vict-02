import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import {writable,fromStore} from 'svelte/store';
import {UiEditSession,defaultSemanticElementCatalog,type UiDocument,type UiExtensionDescriptor} from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';
import {editableStyle,sourceStyles} from '../src/inspector-ux.js';
import type {TransactionDraft} from '../src/commands.js';

const descriptor:UiExtensionDescriptor={id:'test.parts',revision:'1',props:[],slots:[],outputs:[],abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],styleTargets:['root','content'],rendererImplementationId:'test.parts'};
function source():UiDocument{return {schema:'vict.ui-document@1',id:'inspector-parts',revision:'1',root:'root',nodes:{root:{id:'root',kind:'element',tag:'main',children:['card']},card:{id:'card',kind:'component',definitionId:descriptor.id,revision:'1',localStyle:[{property:'color',value:{type:'text',value:'#112233'}}],partStyles:{content:{localStyle:[{property:'color',value:{type:'text',value:'#ddeeff'}}]}}}},componentDefinitions:{},tokens:{},styleSources:{},conditions:{phone:{id:'phone',kind:'media',query:'(max-width: 600px)'}},assets:{},localState:{}};}
function choose(target:HTMLElement,label:string,value:string){const field=target.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);expect(field).not.toBeNull();field!.value=value;field!.dispatchEvent(new Event('change',{bubbles:true}));flushSync();}
function change(target:HTMLElement,label:string,value:string){const field=target.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);expect(field).not.toBeNull();expect(field!.disabled).toBe(false);field!.value=value;field!.dispatchEvent(new Event('input',{bubbles:true}));field!.dispatchEvent(new Event('change',{bubbles:true}));flushSync();}
function click(target:HTMLElement,text:string){const button=[...target.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim()===text);expect(button).toBeDefined();button!.click();flushSync();}
function mounted(native=false){
 const doc=source();const session=UiEditSession.open({document:doc,storedRevision:'1',catalogs:{elements:defaultSemanticElementCatalog(),extensions:[descriptor]}});
 const documents=writable(session.document);const live=fromStore(documents);const drafts:TransactionDraft[]=[];const target=document.createElement('div');document.body.append(target);
 const editor=mount(Inspector,{target,props:{get document(){return live.current;},selectedOccurrence:`inspector-parts|${native?'root':'card'}`,componentDescriptors:[descriptor],styleConditions:[{id:'phone',label:'Phone'}],onApply:(draft:TransactionDraft)=>{drafts.push(draft);const result=session.applyTransaction({...draft,expectedDocumentRevision:session.workingRevision});expect(result).toMatchObject({ok:true});if(result.ok)documents.set(session.document);return result.ok;}}});flushSync();click(target,'Style');
 return {target,editor,session,drafts,sync(){documents.set(session.document);flushSync();}};
}
describe('manual Inspector component parts share canonical edits/history',()=>{
 it('reads/writes a selected surface without changing the legacy primary and supports undo/redo/reset',async()=>{
  const view=mounted();try{
   expect(view.target.querySelector<HTMLInputElement>('[aria-label="Text color"]')?.value).toBe('#112233');
   choose(view.target,'Component part','content');
   expect(view.target.querySelector<HTMLInputElement>('[aria-label="Text color"]')?.value).toBe('#ddeeff');
   change(view.target,'Text color','#abcdef');
   expect(view.drafts.at(-1)?.commands).toEqual([{op:'setPartStyleDeclaration',nodeId:'card',part:'content',property:'color',value:{type:'text',value:'#abcdef'}}]);
   expect(view.session.document.nodes.card?.localStyle).toEqual(source().nodes.card?.localStyle);
   expect(editableStyle(view.session.document,'card','color',undefined,undefined,'content')).toEqual({type:'text',value:'#abcdef'});
   expect(view.session.undo().ok).toBe(true);view.sync();expect(view.target.querySelector<HTMLInputElement>('[aria-label="Text color"]')?.value).toBe('#ddeeff');
   expect(view.session.redo().ok).toBe(true);view.sync();expect(view.target.querySelector<HTMLInputElement>('[aria-label="Text color"]')?.value).toBe('#abcdef');
   const reset=view.target.querySelector<HTMLButtonElement>('[aria-label="Reset Text color"]');expect(reset?.disabled).toBe(false);reset!.click();flushSync();
   expect(view.session.document.nodes.card?.partStyles).toBeUndefined();expect(view.session.document.nodes.card?.localStyle).toEqual(source().nodes.card?.localStyle);
  }finally{await unmount(view.editor);view.target.remove();}
 });
 it('keeps legacy component state restrictions until a declared explicit part is selected',async()=>{
  const view=mounted();try{
   choose(view.target,'Style target','phone');choose(view.target,'Pseudo state','focus');
   expect(view.target.querySelector<HTMLInputElement>('[aria-label="Border color"]')?.disabled).toBe(true);
   choose(view.target,'Component part','content');change(view.target,'Border color','#556677');
   expect(view.drafts.at(-1)?.commands[0]).toEqual({op:'setPartStyleDeclaration',nodeId:'card',part:'content',property:'border-color',value:{type:'text',value:'#556677'},conditionId:'phone',pseudo:'focus'});
   expect(editableStyle(view.session.document,'card','border-color','phone','focus','content')).toEqual({type:'text',value:'#556677'});
   expect(sourceStyles(view.session.document,'card','border-color','content').join()).toContain('focus');
   expect(sourceStyles(view.session.document,'card','border-color')).toEqual([]);
  }finally{await unmount(view.editor);view.target.remove();}
 });
 it('leaves native root styling on its existing command path without a part selector',async()=>{
  const view=mounted(true);try{
   expect(view.target.querySelector('[aria-label="Component part"]')).toBeNull();
   change(view.target,'Text color','#223344');
   expect(view.drafts.at(-1)?.commands).toEqual([{op:'setStyleDeclaration',nodeId:'root',property:'color',value:{type:'text',value:'#223344'}}]);
  }finally{await unmount(view.editor);view.target.remove();}
 });
});
