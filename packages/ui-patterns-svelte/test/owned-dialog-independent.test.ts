import {afterEach,describe,expect,it} from 'vitest';
import {createOwnedDialogBehavior} from '@victframework/ui-svelte';

let release:(()=>void)|undefined;
afterEach(()=>{release?.();release=undefined;document.body.innerHTML='';});

describe('independent owned dialog keyboard challenge',()=>{
  it('wraps after the checked radio because unchecked siblings are not native Tab stops',()=>{
    const owner=document.createElement('main');owner.setAttribute('data-ui-application-viewport','');
    const panel=document.createElement('div');panel.tabIndex=-1;
    panel.innerHTML='<button>First</button><input type="radio" name="mode" checked aria-label="Selected"/><input type="radio" name="mode" aria-label="Unselected"/>';
    owner.append(panel);document.body.append(owner);
    release=createOwnedDialogBehavior({owner,panel,onDismiss:()=>{}});
    const checked=panel.querySelector<HTMLInputElement>('[aria-label="Selected"]')!,first=panel.querySelector('button')!;
    checked.focus();
    const event=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});checked.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });
  it('keeps same-name radio groups independent when they have different form owners',()=>{
    const owner=document.createElement('main');owner.setAttribute('data-ui-application-viewport','');
    const panel=document.createElement('div');panel.tabIndex=-1;
    panel.innerHTML='<button>First</button><form><input type="radio" name="mode" checked aria-label="Other form"/></form><form><input type="radio" name="mode" checked aria-label="Selected"/><input type="radio" name="mode" aria-label="Unselected"/></form>';
    owner.append(panel);document.body.append(owner);
    release=createOwnedDialogBehavior({owner,panel,onDismiss:()=>{}});
    const checked=panel.querySelector<HTMLInputElement>('[aria-label="Selected"]')!,first=panel.querySelector('button')!;
    checked.focus();
    const event=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});checked.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });
  it('keeps nameless radio inputs as independent Tab stops',()=>{
    const owner=document.createElement('main');owner.setAttribute('data-ui-application-viewport','');
    const panel=document.createElement('div');panel.tabIndex=-1;
    panel.innerHTML='<button>First</button><input type="radio" checked aria-label="One"/><input type="radio" aria-label="Two"/>';
    owner.append(panel);document.body.append(owner);
    release=createOwnedDialogBehavior({owner,panel,onDismiss:()=>{}});
    const firstRadio=panel.querySelector<HTMLInputElement>('[aria-label="One"]')!,lastRadio=panel.querySelector<HTMLInputElement>('[aria-label="Two"]')!;
    firstRadio.focus();
    const middle=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});firstRadio.dispatchEvent(middle);
    expect(middle.defaultPrevented).toBe(false);
    lastRadio.focus();
    const end=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});lastRadio.dispatchEvent(end);
    expect(end.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(panel.querySelector('button'));
  });
  it('does not invent an inside Tab stop when the radio group selection is outside the panel',()=>{
    const owner=document.createElement('main');owner.setAttribute('data-ui-application-viewport','');
    const panel=document.createElement('div');panel.tabIndex=-1;
    panel.innerHTML='<button>Only native Tab stop</button><input type="radio" name="shared-mode" aria-label="Unselected"/>';
    const outside=document.createElement('input');outside.type='radio';outside.name='shared-mode';outside.checked=true;
    owner.append(panel);document.body.append(owner,outside);
    release=createOwnedDialogBehavior({owner,panel,onDismiss:()=>{}});
    const first=panel.querySelector('button')!;first.focus();
    const event=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});first.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });
});
