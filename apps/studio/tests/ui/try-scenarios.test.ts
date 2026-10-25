// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
import TryScenarios from '../../src/lib/designer/TryScenarios.svelte';
import StudioShowcase from '../../src/lib/designer/StudioShowcase.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
let editor:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';});
async function settle(){flushSync();await tick();await tick();}
it('explains unsupported screens without offering guessed scenarios, hides raw variables and traps only visible controls',async()=>{
  const close=vi.fn(),choose=vi.fn();
  editor=mount(TryScenarios,{target:document.body,props:{document:newScreen('Empty','empty'),values:{},onChoose:choose,onClose:close,onReset:vi.fn(),onTry:vi.fn(),onChange:vi.fn()}});await settle();
  expect(document.body.textContent).toContain('No ready-made scenarios');
  expect(document.querySelectorAll('.scenario-choice')).toHaveLength(0);
  expect(document.querySelector('details')!.open).toBe(false);
  const closeButton=document.querySelector<HTMLButtonElement>('[aria-label="Close testing"]')!;
  expect(document.activeElement).toBe(closeButton);
  closeButton.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));await settle();
  expect(document.activeElement?.textContent).toBe('Advanced');
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(close).toHaveBeenCalledOnce();
});
it('shows relevant sample choices, invokes the selected scenario and gives boolean state controls distinct names',async()=>{
  const seed=newScreen('Input','input');const source={...seed,nodes:{screen:{id:'screen',kind:'element' as const,tag:'input',children:[],attributes:{type:'text',value:{type:'ref' as const,path:'state.message'}}}}};const choose=vi.fn();
  editor=mount(TryScenarios,{target:document.body,props:{document:source,values:{},onChoose:choose,onClose:vi.fn(),onReset:vi.fn(),onTry:vi.fn(),onChange:vi.fn()}});await settle();
  const choices=[...document.querySelectorAll<HTMLButtonElement>('.scenario-choice')];expect(choices).toHaveLength(3);choices[2]!.click();expect(choose).toHaveBeenCalledWith(expect.objectContaining({id:'content:long'}));
  expect(document.querySelector('[type="checkbox"][aria-label="accepted value"]')).not.toBeNull();
});
it('returns keyboard focus to the showcase disclosure when testing closes',async()=>{
  editor=mount(StudioShowcase,{target:document.body});await settle();
  const summary=document.querySelector<HTMLElement>('.testing-example > summary')!;summary.click();await settle();
  document.querySelector<HTMLButtonElement>('[aria-label="Close testing"]')!.click();await settle();
  expect(document.querySelector<HTMLDetailsElement>('.testing-example')!.open).toBe(false);
  expect(document.activeElement).toBe(summary);
});
