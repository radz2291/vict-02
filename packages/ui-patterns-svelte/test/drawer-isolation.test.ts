import {afterEach,describe,expect,it} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import Harness from './DrawerIsolationHarness.svelte';

let instance:ReturnType<typeof mount>|undefined;
const settle=async()=>{flushSync();await tick();flushSync();};
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';document.body.removeAttribute('style');});
async function setup(){
  const target=document.createElement('div');document.body.append(target);
  instance=mount(Harness,{target});await settle();
  const trigger=target.querySelector<HTMLButtonElement>('[data-dialog-trigger]')!;
  trigger.focus();trigger.click();await settle();
  return {target,trigger,dialog:target.querySelector<HTMLElement>('[role=dialog]')!,sibling:target.querySelector<HTMLInputElement>('[data-app=b] input')!,harness:instance};
}
describe('owned drawer integration boundary',()=>{
  it('does not capture focus moved deliberately into a sibling application',async()=>{
    const {sibling,dialog}=await setup();expect(document.activeElement).toBe(dialog);
    sibling.focus();await settle();expect(document.activeElement).toBe(sibling);
  });
  it('does not close or cancel Escape dispatched from a sibling application',async()=>{
    const {target,sibling}=await setup();
    const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
    sibling.dispatchEvent(event);await settle();
    expect(event.defaultPrevented).toBe(false);expect(target.querySelector('[role=dialog]')).not.toBeNull();
  });
  it('loops Tab and Shift+Tab inside the owner and closes on owned Escape',async()=>{
    const {target,dialog,trigger}=await setup();
    expect(dialog.getAttribute('aria-modal')).toBeNull();
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Owned drawer');
    const first=dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')!,last=dialog.querySelector<HTMLInputElement>('input')!;
    last.focus();const forward=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});last.dispatchEvent(forward);await settle();
    expect(forward.defaultPrevented).toBe(true);expect(document.activeElement).toBe(first);
    const reverse=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});first.dispatchEvent(reverse);await settle();
    expect(reverse.defaultPrevented).toBe(true);expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
    expect(target.querySelector('[role=dialog]')).toBeNull();expect(document.activeElement).toBe(trigger);
  });
  it('retains dynamic panel custom-property bindings while preserving sheet geometry',async()=>{
    const {dialog,harness}=await setup();
    expect(dialog.style.getPropertyValue('--ui-binding-panel-alpha')).toBe('0.2');
    harness.setAlpha('0.75');await settle();
    expect(dialog.style.getPropertyValue('--ui-binding-panel-alpha')).toBe('0.75');
    expect(dialog.style.position).toBe('absolute');expect(dialog.style.width).toBe('320px');
  });
  it('never mutates document body scroll or text selection during owned pointer input',async()=>{
    document.body.style.overflow='auto';document.body.style.userSelect='all';
    const {dialog}=await setup();
    dialog.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));await settle();
    expect(document.body.style.overflow).toBe('auto');expect(document.body.style.userSelect).toBe('all');
    dialog.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1}));await settle();
    expect(document.body.style.userSelect).toBe('all');
  });
  it('does not steal sibling focus when the owner closes its drawer programmatically',async()=>{
    const {sibling,harness,target}=await setup();sibling.focus();await settle();
    // Keep this assertion separate from focus-entry ownership: it must also hold after closing.
    harness.setOpen(false);await settle();
    expect(target.querySelector('[role=dialog]')).toBeNull();expect(document.activeElement).toBe(sibling);
  });
});
