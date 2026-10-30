import {afterEach,describe,expect,it,vi} from 'vitest';
import {createOwnedMenuBehavior,createOwnedMenuContext,focusOwnedMenuItem,ownedMenuTriggerKey} from '../src/owned-menu.js';
const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const stop of cleanups.splice(0))stop();document.body.innerHTML='';});
function setup(){
  const owner=document.createElement('section');owner.setAttribute('data-ui-application-viewport','');
  const trigger=document.createElement('button');trigger.textContent='Actions';
  const panel=document.createElement('div');panel.role='menu';panel.tabIndex=-1;
  const items=['Alpha','Disabled','Beta','Bravo'].map((label,index)=>{const item=document.createElement('button');item.type='button';item.role='menuitem';item.tabIndex=-1;item.textContent=label;if(index===1)item.disabled=true;panel.append(item);return item;});
  owner.append(trigger,panel);document.body.append(owner);trigger.focus();
  const requestClose=vi.fn();const context=createOwnedMenuContext({owner:()=>owner,trigger:()=>trigger,panel:()=>panel,requestClose});
  cleanups.push(createOwnedMenuBehavior({owner,panel,context}));
  return{owner,trigger,panel,items,context,requestClose};
}
const key=(target:HTMLElement,value:string)=>{const event=new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true});target.dispatchEvent(event);return event;};
describe('shared application-owned menu semantics',()=>{
  it('uses enabled roving targets, edges, looping and typeahead without a second activation channel',()=>{
    const {panel,items}=setup();focusOwnedMenuItem(panel);
    expect(document.activeElement).toBe(items[0]);
    key(items[0]!,'ArrowDown');expect(document.activeElement).toBe(items[2]);expect(items[2]!.hasAttribute('data-highlighted')).toBe(true);
    key(items[2]!,'End');expect(document.activeElement).toBe(items[3]);
    key(items[3]!,'ArrowDown');expect(document.activeElement).toBe(items[0]);
    key(items[0]!,'b');expect(document.activeElement).toBe(items[2]);
    key(items[2]!,'b');expect(document.activeElement).toBe(items[3]);
    key(items[3]!,'Home');expect(document.activeElement).toBe(items[0]);
    const activate=vi.fn();items[0]!.addEventListener('click',activate);
    expect(key(items[0]!,'Enter').defaultPrevented).toBe(true);expect(activate).toHaveBeenCalledTimes(1);
    expect(key(items[0]!,' ').defaultPrevented).toBe(true);expect(activate).toHaveBeenCalledTimes(2);
  });
  it('does not consume sibling application keys or recapture its focus',()=>{
    const {panel,items,requestClose}=setup();focusOwnedMenuItem(panel);
    const other=document.createElement('section');other.setAttribute('data-ui-application-viewport','');const button=document.createElement('button');other.append(button);document.body.append(other);button.focus();
    expect(key(button,'Escape').defaultPrevented).toBe(false);expect(document.activeElement).toBe(button);expect(requestClose).not.toHaveBeenCalled();
    key(items[0]!,'Escape');expect(requestClose).toHaveBeenCalledWith('escape');
    expect(document.activeElement).toBe(button);
  });
  it('restores its trigger for owned Escape, while a host callback moving focus wins',()=>{
    const {owner,trigger,panel,items,context,requestClose}=setup();focusOwnedMenuItem(panel);
    expect(key(items[0]!,'Escape').defaultPrevented).toBe(true);expect(document.activeElement).toBe(trigger);
    const outside=document.createElement('button');owner.append(outside);focusOwnedMenuItem(panel);
    requestClose.mockImplementation(()=>outside.focus());context.close('programmatic');expect(document.activeElement).toBe(outside);
  });
  it('closes only nested menus on ArrowLeft and the whole tree on activation',()=>{
    const root=setup();const subTrigger=root.items[2]!;const subPanel=document.createElement('div');subPanel.role='menu';subPanel.tabIndex=-1;const leaf=document.createElement('button');leaf.role='menuitem';subPanel.append(leaf);root.owner.append(subPanel);
    const subClose=vi.fn();const context=createOwnedMenuContext({owner:()=>root.owner,trigger:()=>subTrigger,panel:()=>subPanel,parent:root.context,requestClose:subClose});
    cleanups.push(createOwnedMenuBehavior({owner:root.owner,panel:subPanel,context}));root.context.activateChild(context);leaf.focus();
    key(leaf,'ArrowLeft');expect(subClose).toHaveBeenCalledWith('arrow-left');expect(root.requestClose).not.toHaveBeenCalled();expect(document.activeElement).toBe(subTrigger);
    root.context.activateChild(context);leaf.focus();context.closeAll('activate');expect(root.requestClose).toHaveBeenCalledWith('activate');expect(document.activeElement).toBe(root.trigger);
  });
  it('closes a previously open sibling submenu without taking focus',()=>{
    const root=setup();const firstClose=vi.fn(),secondClose=vi.fn();
    const first=createOwnedMenuContext({trigger:()=>root.items[0],panel:()=>root.panel,parent:root.context,requestClose:firstClose});
    const second=createOwnedMenuContext({trigger:()=>root.items[2],panel:()=>root.panel,parent:root.context,requestClose:secondClose});
    root.context.activateChild(first);root.items[3]!.focus();root.context.activateChild(second);
    expect(firstClose).toHaveBeenCalledWith('programmatic');expect(secondClose).not.toHaveBeenCalled();expect(document.activeElement).toBe(root.items[3]);
  });
  it('maps trigger keyboard intent exactly and leaves unrelated shortcuts alone',()=>{
    const open=vi.fn();for(const value of ['Enter',' ','ArrowDown','ArrowUp']){const event=new KeyboardEvent('keydown',{key:value,cancelable:true});expect(ownedMenuTriggerKey(event,open)).toBe(true);expect(event.defaultPrevented).toBe(true);}
    expect(open.mock.calls.map(call=>call[0])).toEqual(['first','first','first','last']);expect(ownedMenuTriggerKey(new KeyboardEvent('keydown',{key:'x'}),open)).toBe(false);
  });
  it('does not turn editing keys inside a supplied editable surface into menu navigation',()=>{
    const {panel,requestClose}=setup();const input=document.createElement('textarea');panel.append(input);input.focus();
    for(const value of ['ArrowLeft','ArrowRight','ArrowDown','Home','End',' ','Enter','b'])expect(key(input,value).defaultPrevented,value).toBe(false);
    expect(document.activeElement).toBe(input);expect(requestClose).not.toHaveBeenCalled();
  });
  it('keeps parent menus open for a nonclosing checkbox in an exactly related submenu portal',()=>{
    const root=setup(),trigger=root.items[2]!;const child=document.createElement('div');child.id='child-options';child.role='menu';child.dataset.uiOwner='doc';child.dataset.uiOcc='child';child.dataset.uiPart='content';
    trigger.dataset.uiOwner='doc';trigger.dataset.uiOcc='child';trigger.setAttribute('aria-controls',child.id);trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-haspopup','menu');
    const item=document.createElement('button');item.role='menuitemcheckbox';item.setAttribute('aria-checked','false');child.append(item);root.owner.append(child);
    const close=vi.fn();const context=createOwnedMenuContext({trigger:()=>trigger,panel:()=>child,parent:root.context,owner:()=>root.owner,requestClose:close});
    cleanups.push(createOwnedMenuBehavior({owner:root.owner,panel:child,context}));root.context.activateChild(context);item.focus();item.click();
    expect(close).not.toHaveBeenCalled();expect(root.requestClose).not.toHaveBeenCalled();expect(document.activeElement).toBe(item);
  });
});
