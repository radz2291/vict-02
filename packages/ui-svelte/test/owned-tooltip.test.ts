import {afterEach,describe,expect,it} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import Harness from './OwnedTooltipHarness.svelte';
import {createOwnedTooltipBehavior} from '../src/owned-tooltip.js';
import CatalogTooltip from '../src/catalog/components/B5Tooltip.svelte';

const mounts:ReturnType<typeof mount>[]=[];
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,30));flushSync();};
function host(target:HTMLElement=document.body,props:Record<string,unknown>={}){
  const root=target.ownerDocument.createElement('div');target.append(root);
  mounts.push(mount(Harness,{target:root,props}));return root;
}
afterEach(async()=>{for(const component of mounts.splice(0))await unmount(component);document.body.replaceChildren();});

describe('shared application-owned tooltip',()=>{
  it('composes description IDs and scopes a hovered tooltip without stealing sibling focus or Escape',async()=>{
    const root=host();await settle();
    const trigger=root.querySelector<HTMLButtonElement>('[aria-label="Owned help"]')!;
    const other=root.querySelector<HTMLInputElement>('[aria-label="Sibling input"]')!;
    other.focus();trigger.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));await settle();
    const tip=root.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(tip).not.toBeNull();expect(tip.closest('[data-testid="tooltip-outlet"]')).not.toBeNull();expect(tip.closest('.tooltip-scope')).not.toBeNull();
    expect(trigger.getAttribute('aria-describedby')?.split(/\s+/)).toEqual(['existing-description',tip.id]);
    expect(document.activeElement).toBe(other);
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});other.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);expect(root.querySelector('[role="tooltip"]')).toBe(tip);expect(document.activeElement).toBe(other);
    trigger.focus();await settle();const ownEscape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});trigger.dispatchEvent(ownEscape);await settle();
    expect(ownEscape.defaultPrevented).toBe(true);expect(root.querySelector('[role="tooltip"]')).toBeNull();expect(trigger.getAttribute('aria-describedby')).toBe('existing-description');expect(document.activeElement).toBe(trigger);
  });

  it('retains tooltip content while the pointer reaches it, then closes after leaving both surfaces',async()=>{
    const root=host();await settle();const trigger=root.querySelector<HTMLButtonElement>('button')!;
    trigger.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));await settle();
    const tip=root.querySelector<HTMLElement>('[role="tooltip"]')!;
    trigger.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));tip.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));await new Promise(resolve=>setTimeout(resolve,130));await settle();
    expect(root.querySelector('[role="tooltip"]')).toBe(tip);
    tip.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));await new Promise(resolve=>setTimeout(resolve,130));await settle();expect(root.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('removes the popup and only its description token when its retained source is hidden or removed',async()=>{
    const root=host(document.body,{open:true});await settle();const trigger=root.querySelector<HTMLButtonElement>('button')!;
    expect(root.querySelector('[role="tooltip"]')).not.toBeNull();
    root.querySelector<HTMLElement>('[data-testid="tooltip-source"]')!.hidden=true;await settle();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();expect(trigger.getAttribute('aria-describedby')).toBe('existing-description');
    const second=host(document.body,{open:true});await settle();const source=second.querySelector<HTMLElement>('[data-testid="tooltip-source"]')!,button=source.querySelector('button')!;
    expect(second.querySelector('[role="tooltip"]')).not.toBeNull();source.remove();await settle();expect(second.querySelector('[role="tooltip"]')).toBeNull();expect(button.getAttribute('aria-describedby')).toBe('existing-description');
  });

  it('does not open disabled triggers, and retains iframe ownership without parent focus mutation',async()=>{
    const disabled=host(document.body,{disabled:true,open:true});await settle();expect(disabled.querySelector('[role="tooltip"]')).toBeNull();
    const frame=document.createElement('iframe');document.body.append(frame);const child=frame.contentDocument!;
    const root=host(child.body);await settle();const trigger=root.querySelector<HTMLButtonElement>('button')!;
    const ChildPointerEvent=child.defaultView!.PointerEvent;trigger.dispatchEvent(new ChildPointerEvent('pointerenter',{pointerType:'mouse'}));await settle();
    const tip=root.querySelector('[role="tooltip"]')!;expect(tip).not.toBeNull();expect(tip.ownerDocument).toBe(child);expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('closes an already visible tooltip when the actual trigger becomes disabled',async()=>{
    const root=host(document.body,{open:true});await settle();const trigger=root.querySelector<HTMLButtonElement>('button')!;
    expect(root.querySelector('[role="tooltip"]')).not.toBeNull();trigger.disabled=true;await settle();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();expect(trigger.getAttribute('aria-describedby')).toBe('existing-description');
  });

  it('preserves the standalone catalog document-scoped path and its controlled output',async()=>{
    const root=document.createElement('div');document.body.append(root);const outputs:unknown[]=[];
    mounts.push(mount(CatalogTooltip,{target:root,props:{nodeId:'document-tooltip',occurrenceKey:'document-tooltip',props:{label:'Document help',title:'Document-scoped text',open:true},io:{emit:(...args)=>outputs.push(args)}}}));await settle();
    expect(root.querySelector('button')?.textContent).toBe('Document help');expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('Document-scoped text');expect(document.querySelector('[data-owned-tooltip-content]')).toBeNull();
    const trigger=root.querySelector('button')!;trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();expect(outputs).toContainEqual(['openChange',false]);
  });

  it('reconciles an authored ID change and a replaced actual trigger without stale descriptions or listeners',async()=>{
    const root=host();await settle();let trigger=root.querySelector<HTMLButtonElement>('[aria-label="Owned help"]')!;
    trigger.focus();await settle();const originalId=root.querySelector('[role="tooltip"]')!.id;
    root.querySelector<HTMLButtonElement>('[aria-label="Change tooltip ID"]')!.click();await settle();
    const changed=root.querySelector('[role="tooltip"]')!;expect(changed.id).not.toBe(originalId);expect(trigger.getAttribute('aria-describedby')).toBe(`existing-description ${changed.id}`);
    const oldTrigger=trigger;root.querySelector<HTMLButtonElement>('[aria-label="Replace tooltip trigger"]')!.click();await settle();expect(root.querySelector('[role="tooltip"]')).toBeNull();expect(oldTrigger.getAttribute('aria-describedby')).toBe('existing-description');
    trigger=root.querySelector<HTMLButtonElement>('[aria-label="Owned help"]')!;expect(trigger).not.toBe(oldTrigger);
    trigger.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));await settle();expect(root.querySelector('[role="tooltip"]')).not.toBeNull();expect(trigger.getAttribute('aria-describedby')).toContain('changed-tip');
  });

  it('removes listeners and delayed opening on disposal, preserving a host-updated description',async()=>{
    const owner=document.createElement('section');owner.dataset.uiOwnerRoot='unit-tooltip';const trigger=document.createElement('button');trigger.setAttribute('aria-describedby','first');const panel=document.createElement('div');panel.id='unit-tip';owner.append(trigger,panel);document.body.append(owner);
    let open=false;const requested:boolean[]=[];
    const behavior=createOwnedTooltipBehavior({owner,trigger,id:panel.id,getPanel:()=>panel,isOpen:()=>open,delay:()=>20,onOpenChange:next=>{requested.push(next);open=next;}});
    trigger.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));behavior.dispose();await new Promise(resolve=>setTimeout(resolve,35));expect(requested).toEqual([]);
    const second=createOwnedTooltipBehavior({owner,trigger,id:panel.id,getPanel:()=>panel,isOpen:()=>true,onOpenChange:()=>{}});second.sync();
    trigger.setAttribute('aria-describedby','host-later');await settle();expect(trigger.getAttribute('aria-describedby')).toBe('host-later unit-tip');second.dispose();expect(trigger.getAttribute('aria-describedby')).toBe('host-later');
  });
});
