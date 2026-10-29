import {describe,it,expect} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
import Fixture from './ControlledNativeFixture.svelte';
function source():UiDocument{return {schema:'vict.ui-document@1',id:'controlled-native',revision:'1',root:'root',nodes:{root:{kind:'element',id:'root',tag:'main',children:['text','check','number','free']},text:{kind:'element',id:'text',tag:'input',attributes:{value:{type:'ref',path:'state.text'},'aria-label':'Text'},children:[],interactions:[{on:'change',action:'setState',key:'text'}]},check:{kind:'element',id:'check',tag:'input',attributes:{type:'checkbox',checked:{type:'ref',path:'state.checked'},'aria-label':'Check'},children:[],interactions:[{on:'change',action:'setState',key:'checked'}]},number:{kind:'element',id:'number',tag:'input',attributes:{type:'number',value:{type:'ref',path:'state.number'},'aria-label':'Number'},children:[],interactions:[{on:'change',action:'setState',key:'number'}]},free:{kind:'element',id:'free',tag:'input',attributes:{value:'default','aria-label':'Uncontrolled'},children:[],interactions:[{on:'change',action:'setState',key:'text'}]}},componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:{text:{key:'text',type:'string',initial:'A'},checked:{key:'checked',type:'boolean',initial:false},number:{key:'number',type:'number',initial:2}}};}
const settle=async()=>{flushSync();await tick();flushSync();};
describe('canonical native controlled properties',()=>{
 it('restores refused DOM edits when canonical values are unchanged without disturbing accepted cursors or uncontrolled fields',async()=>{
  const result=compileUiDocument(source(),defaultSemanticElementCatalog());expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return;
  const target=document.createElement('div');document.body.append(target);const app=mount(Fixture,{target,props:{plan:result.plan}});await settle();
  const field=target.querySelector<HTMLInputElement>('[aria-label=Text]')!,check=target.querySelector<HTMLInputElement>('[aria-label=Check]')!,number=target.querySelector<HTMLInputElement>('[aria-label=Number]')!,free=target.querySelector<HTMLInputElement>('[aria-label=Uncontrolled]')!;
  field.focus();field.value='accepted';field.setSelectionRange(3,3);field.dispatchEvent(new Event('input',{bubbles:true}));await settle();expect(field.value).toBe('accepted');expect(field.selectionStart).toBe(3);expect(app.snapshot().text).toBe('accepted');
  app.allow(false);field.value='refused';field.dispatchEvent(new Event('input',{bubbles:true}));check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));number.value='99';number.dispatchEvent(new Event('change',{bubbles:true}));free.value='user-owned';free.dispatchEvent(new Event('input',{bubbles:true}));await settle();
  expect(field.value).toBe('accepted');expect(check.checked).toBe(false);expect(number.value).toBe('2');expect(free.value).toBe('user-owned');expect(app.snapshot()).toEqual({text:'accepted',checked:false,number:2});
  app.allow(true);field.dispatchEvent(new Event('change',{bubbles:true}));await settle();expect(field.value).toBe('accepted');
  await unmount(app);target.remove();
 });
});
