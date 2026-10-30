// @vitest-environment happy-dom
import { mount,tick,unmount } from 'svelte';
import { afterEach,expect,it,vi } from 'vitest';
import { DocumentHost } from '@victframework/ui-svelte';
import { compileScreen,newScreen,catalogDescriptors,catalogImplementations } from '../../src/lib/designer/application.js';
import { prepareAgentEdit,documentCursor } from '../../src/lib/designer/agent-edits.js';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';vi.restoreAllMocks();});
it('changes two native fields and two boolean controls independently through real renderer events (DOM simulation)',async()=>{
 const warnings=vi.spyOn(console,'warn');
 const source=newScreen('Independent fields','independent-fields');const cursor=documentCursor(source,'r1',crypto.randomUUID());
 const result=prepareAgentEdit(source,cursor,{expectedRevision:'r1',reason:'Independent fields',operations:[
  {op:'add',recipe:'input',nodeId:'email',parentId:'screen',attributes:{'aria-label':'Email'}},
  {op:'add',recipe:'input',nodeId:'name',parentId:'screen',attributes:{'aria-label':'Name'}},
  {op:'add',recipe:'checkbox',nodeId:'terms',parentId:'screen',props:{label:'Terms'}},
  {op:'add',recipe:'switch',nodeId:'news',parentId:'screen',props:{label:'News'}},
 ]},'fields');expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);
 const booleanStateKey=(nodeId:string)=>{
  const control=result.document.nodes[nodeId];expect(control?.kind).toBe('component');if(control?.kind!=='component')throw Error('Missing boolean control');
  const reference=control.props?.checked;expect(reference).toMatchObject({type:'ref',path:expect.stringMatching(/^state\./)});
  if(reference?.type!=='ref'||!reference.path.startsWith('state.'))throw Error('Missing controlled boolean reference');
  const key=reference.path.slice('state.'.length);expect(control.outputs?.checkedChange).toMatchObject({setState:{key}});
  expect(result.document.localState[key]).toMatchObject({type:'boolean',initial:false});return key;
 };
 const termsKey=booleanStateKey('terms');const newsKey=booleanStateKey('news');
 expect(new Set(['input_email','input_name',termsKey,newsKey]).size).toBe(4);
 const compiled=compileScreen(result.document);expect(compiled.ok).toBe(true);if(!compiled.ok)throw Error('compile');const plan=Object.values(compiled.plan.documentPlans??{})[0]!;
 const changes:{key:string;value:unknown}[]=[];
 instance=mount(DocumentHost,{target:document.body,props:{plan,localState:result.document.localState,extensionDescriptors:catalogDescriptors,extensionImplementations:catalogImplementations,dispatch:async()=>({ok:true}),navigate:()=>{},onStateChange:(key:string,value:unknown)=>changes.push({key,value})}});await tick();
 const email=document.querySelector<HTMLInputElement>('input[aria-label="Email"]')!;const name=document.querySelector<HTMLInputElement>('input[aria-label="Name"]')!;
 expect(email.value).toBe('');expect(name.value).toBe('');email.value='test@example.com';email.dispatchEvent(new Event('change',{bubbles:true}));await tick();expect(name.value).toBe('');expect(changes).toContainEqual({key:'input_email',value:'test@example.com'});
 name.value='Alice';name.dispatchEvent(new Event('change',{bubbles:true}));await tick();expect(email.value).toBe('test@example.com');expect(changes).toContainEqual({key:'input_name',value:'Alice'});
 const terms=document.querySelector<HTMLButtonElement>('[role="checkbox"]')!;const news=document.querySelector<HTMLButtonElement>('[role="switch"]')!;expect(terms.getAttribute('aria-checked')).toBe('false');expect(news.getAttribute('aria-checked')).toBe('false');
 terms.click();await tick();expect(terms.getAttribute('aria-checked')).toBe('true');expect(news.getAttribute('aria-checked')).toBe('false');expect(changes).toContainEqual({key:termsKey,value:true});news.click();await tick();expect(changes).toContainEqual({key:newsKey,value:true});expect(terms.getAttribute('aria-checked')).toBe('true');expect(news.getAttribute('aria-checked')).toBe('true');
 expect(result.document.localState.input_email.initial).toBe('');expect(result.document.localState[termsKey].initial).toBe(false);expect(result.document.localState[newsKey].initial).toBe(false);
 expect(warnings.mock.calls.flat().map(String).join(' ')).not.toContain('dynamic_void_element_content');
});
