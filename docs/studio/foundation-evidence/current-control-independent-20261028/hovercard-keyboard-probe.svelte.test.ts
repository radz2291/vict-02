import {expect,it} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import Fixture from '../../../../packages/ui-ai-svelte/test/PassivePopupOwner.svelte';
import {createOwnedHoverCardBehavior} from '../../../../packages/ui-svelte/src/owned-tooltip.js';
import {createOwnedDialogBehavior} from '../../../../packages/ui-svelte/src/owned-dialog.js';
it('demonstrates keyboard reachability when an ordinary focusable follows an owned citation',async()=>{
 const target=document.createElement('div');document.body.append(target);
 const instance=mount(Fixture,{target,props:{name:'keyboard-review',citation:true,nextAction:true}});
 try{
  flushSync();await tick();flushSync();
  const owner=target.querySelector<HTMLElement>('[data-ui-application-viewport]')!;
  const trigger=owner.querySelector<HTMLButtonElement>('button')!;
  const next=owner.querySelector<HTMLButtonElement>('[data-next-ordinary]')!;
  trigger.focus();flushSync();await tick();flushSync();
  const panel=owner.querySelector<HTMLElement>('[data-ui-part="popup"]')!;
  expect(panel).not.toBeNull();
  const link=panel.querySelector<HTMLAnchorElement>('a')!;
  const order=[...owner.querySelectorAll<HTMLElement>('button,a[href]')];
  expect(order.indexOf(next)).toBe(order.indexOf(trigger)+1);
  expect(order.indexOf(link)).toBeGreaterThan(order.indexOf(next));
  const tab=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});trigger.dispatchEvent(tab);
  // Happy DOM does not perform native Tab navigation. Only if the component
  // leaves Tab unhandled, model the next focus target from actual DOM order.
  if(!tab.defaultPrevented)next.focus();
  flushSync();await tick();await new Promise(resolve=>setTimeout(resolve,150));flushSync();
  console.log(JSON.stringify({tabPrevented:tab.defaultPrevented,activeNext:document.activeElement===next,linkConnected:link.isConnected,popupStillPresent:!!owner.querySelector('[data-ui-part="popup"]')}));
  expect(owner.querySelector('[data-ui-part="popup"]'),'An open interactive citation must remain keyboard reachable, or provide a keyboard entry action').not.toBeNull();
  expect(tab.defaultPrevented).toBe(true);expect(document.activeElement).toBe(link);
  const reverse=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});link.dispatchEvent(reverse);
  expect(reverse.defaultPrevented).toBe(true);expect(document.activeElement).toBe(trigger);
  trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  const exit=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});link.dispatchEvent(exit);
  expect(exit.defaultPrevented).toBe(true);expect(document.activeElement).toBe(next);
  flushSync();await tick();flushSync();expect(owner.querySelector('[data-ui-part="popup"]')).toBeNull();
 }finally{await unmount(instance);target.remove();}
});

it('leaves unavailable hover entry and last-link exit to the enclosing owned dialog, not an outside action',async()=>{
 const owner=document.createElement('main');owner.dataset.uiApplicationViewport='';
 const dialog=document.createElement('section');dialog.dataset.ownedDialogContent='';dialog.dataset.uiOwner='a';
 const first=document.createElement('button'),trigger=document.createElement('button');
 trigger.dataset.uiOwner='a';dialog.append(first,trigger);
 const outside=document.createElement('button');outside.textContent='Outside dialog';outside.dataset.uiOwner='a';
 const card=document.createElement('div');card.dataset.uiOwner='a';
 const link=document.createElement('a');link.href='https://example.com/';card.append(link);
 owner.append(dialog,outside,card);document.body.append(owner);
 let open=true;
 const releaseDialog=createOwnedDialogBehavior({owner,panel:dialog,focusOnOpen:false,onDismiss:()=>{throw Error('Unexpected dialog dismissal');}});
 const hover=createOwnedHoverCardBehavior({owner,trigger,id:'dialog-card',getPanel:()=>card,isOpen:()=>open,onOpenChange:value=>open=value,delay:()=>0});
 try{
  hover.sync();trigger.focus();
  const enter=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});trigger.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(true);expect(document.activeElement).toBe(link);
  const exit=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});link.dispatchEvent(exit);
  expect(exit.defaultPrevented).toBe(true);expect(document.activeElement).toBe(first);
  await new Promise(resolve=>setTimeout(resolve,140));expect(open).toBe(false);
  // A noninteractive card must also leave Tab to its containing dialog.
  link.remove();open=true;hover.sync();trigger.focus();
  const empty=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});trigger.dispatchEvent(empty);
  expect(empty.defaultPrevented).toBe(true);expect(document.activeElement).toBe(first);
  expect(document.activeElement).not.toBe(outside);
 }finally{hover.dispose();releaseDialog();owner.remove();}
});

it('leaves last-link no-next default Tab a connected anchor, then closes after native focus leaves',async()=>{
 const owner=document.createElement('main');owner.dataset.uiApplicationViewport='';
 const trigger=document.createElement('button'),card=document.createElement('div'),link=document.createElement('a');
 link.href='https://example.com/';card.append(link);owner.append(trigger,card);document.body.append(owner);
 const outside=document.createElement('button');document.body.append(outside);
 let open=true;
 const hover=createOwnedHoverCardBehavior({owner,trigger,id:'sync-card',getPanel:()=>card,isOpen:()=>open,delay:()=>0,onOpenChange:value=>{open=value;if(!value)card.remove();}});
 try{
  hover.sync();trigger.focus();
  trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  expect(document.activeElement).toBe(link);
  const exit=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});link.dispatchEvent(exit);
  expect(open).toBe(true);expect(exit.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(link);expect(link.isConnected).toBe(true);
  // Happy DOM has no native Tab default; model it only after confirming the
  // real handler left Tab unprevented and the focused link connected.
  outside.focus();await new Promise(resolve=>setTimeout(resolve,140));
  expect(open).toBe(false);expect(document.activeElement).toBe(outside);
 }finally{hover.dispose();owner.remove();outside.remove();}
});
