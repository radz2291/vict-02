import { expect } from 'vitest';
import { tick,flushSync } from 'svelte';

/** Exercise the real View menu now that panel launchers are deliberately absent. */
export function workspaceControl(name:string):HTMLElement|undefined {
  const panel=['Chat','Document'].includes(name)?name:name==='Show chat'?'Chat':undefined;
  if(panel){
    const view=[...document.querySelectorAll<HTMLElement>('.studio-menus > button')].find(node=>node.textContent==='View');
    if(view?.getAttribute('aria-expanded')!=='true'){view?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));flushSync();}
    return document.querySelector<HTMLElement>(`[role="menuitemcheckbox"][aria-label="${panel}"]`)??undefined;
  }
  return [...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].find(node=>node.getAttribute('aria-label')===name||node.textContent?.trim()===name);
}

export async function openStudioMenu(name: string) {
  const trigger = [...document.querySelectorAll<HTMLButtonElement>('.studio-menus > button')]
    .find(button => button.textContent === name);
  expect(trigger).toBeDefined();
  trigger!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true,cancelable:true}));
  await tick();
  await tick();
}

export async function wholeHierarchy(){
 const view=[...document.querySelectorAll<HTMLElement>('.structure-tools [role="menubar"] > button')].find(node=>node.textContent==='View');
 expect(view).toBeDefined();view!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await tick();await tick();
 const option=[...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(node=>node.textContent?.startsWith('Whole hierarchy'));
 expect(option).toBeDefined();option!.click();await tick();await tick();
}
