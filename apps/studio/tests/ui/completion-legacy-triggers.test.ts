// @vitest-environment happy-dom
import { mount, unmount, tick } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { DocumentHost } from '@victframework/ui-svelte';
import { compileScreen, newScreen, catalogDescriptors, catalogImplementations } from '../../src/lib/designer/application.js';
import type { UiDocument } from '@victframework/ui';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';});

it.each(['popover','alert-dialog','tooltip'])('preserves old %s source while rendering one native trigger with its authored label',async family=>{
  const initial=newScreen('Legacy trigger','legacy-trigger');
  const source:UiDocument={...initial,nodes:{
    ...initial.nodes,
    screen:{id:'screen',kind:'element',tag:'main',children:['overlay']},
    overlay:{id:'overlay',kind:'component',definitionId:`vict.catalog.${family}`,props:{label:{type:'literal',value:'Fallback'},title:{type:'literal',value:'Panel'}},slots:{trigger:{name:'trigger',children:['nested']},content:{name:'content',children:['body']},body:{name:'body',children:['body']}}},
    nested:{id:'nested',kind:'component',definitionId:'vict.catalog.button',props:{label:{type:'literal',value:'Legacy authored label'}}},
    body:{id:'body',kind:'text',content:{type:'literal',value:'Panel body'}},
  }};
  // Use only the declared slot for each exact descriptor; this fixture deliberately predates new editor guards.
  const overlay=source.nodes.overlay;
  if(overlay.kind==='component') (overlay as {slots:unknown}).slots={trigger:{name:'trigger',children:['nested']},[family==='alert-dialog'?'body':'content']:{name:family==='alert-dialog'?'body':'content',children:['body']}};
  const original=JSON.stringify(source);
  const compiled=compileScreen(source);expect(compiled.ok).toBe(true);if(!compiled.ok)throw Error(JSON.stringify(compiled.issues));
  const plan=Object.values(compiled.plan.documentPlans??{})[0]!;
  instance=mount(DocumentHost,{target:document.body,props:{plan,localState:source.localState,extensionDescriptors:catalogDescriptors,extensionImplementations:catalogImplementations,dispatch:async()=>({ok:true}),navigate:()=>{}}});
  await tick();
  expect(document.querySelector('button button')).toBeNull();
  const trigger=[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Legacy authored label');
  expect(trigger).toBeDefined();
  trigger!.focus();expect(document.activeElement).toBe(trigger);
  if(family!=='tooltip'){trigger!.click();await tick();expect(document.body.textContent).toContain('Panel body');}
  expect(JSON.stringify(source)).toBe(original);
});
