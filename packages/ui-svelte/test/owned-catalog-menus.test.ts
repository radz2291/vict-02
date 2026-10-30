import {afterEach,describe,expect,it,vi} from 'vitest';
import {flushSync,mount,unmount} from 'svelte';
import type {UiNode} from '@victframework/ui';
import {mountDoc,teardownAll} from './probe-kit.js';
import B4DropdownMenu from '../src/catalog/components/B4DropdownMenu.svelte';

const literal=(value:string|boolean|number)=>({type:'literal' as const,value});
const state=(key:string)=>({type:'ref' as const,path:`state.${key}`});
const bind=(key:string)=>({setState:{key,value:{type:'ref' as const,path:'$output'}}});
const slot=(name:string,children:string[])=>({[name]:{name,children}});
const component=(id:string,family:string,props:Record<string,unknown>={},slots:Record<string,unknown>={},outputs:Record<string,unknown>={}):UiNode=>({kind:'component',id,definitionId:`vict.catalog.${family}`,props,slots,outputs} as UiNode);
async function settle(){flushSync();await new Promise(resolve=>setTimeout(resolve,15));flushSync();}
const bodyStyles=()=>({overflow:document.body.style.overflow,userSelect:document.body.style.userSelect,pointerEvents:document.body.style.pointerEvents,paddingRight:document.body.style.paddingRight,marginRight:document.body.style.marginRight,scrollbarWidth:document.body.style.getPropertyValue('--scrollbar-width')});
function key(target:HTMLElement,key:string,extra:KeyboardEventInit={}){const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra});target.dispatchEvent(event);flushSync();return event;}
function leaf(id:string,label:string,extra:Record<string,unknown>={}){return component(id,'dropdown-menu.item',{label:literal(label),value:literal(id),...extra});}
function dropdown(items:UiNode[]){
  const nodes:Record<string,UiNode>={root:{kind:'element',id:'root',tag:'main',children:['menu']},menu:component('menu','dropdown-menu',{label:literal('Actions'),open:state('menuOpen')},slot('items',items.map(item=>item.id)),{openChange:bind('menuOpen')})};
  for(const item of items)nodes[item.id]=item;
  return nodes;
}
afterEach(async()=>{teardownAll();await settle();document.body.replaceChildren();});

describe('catalog menus use the shared owned boundary',()=>{
  it('retains the ordinary Bits content path for explicitly unowned coded composition',async()=>{
    const before=bodyStyles();
    const target=document.createElement('div');document.body.append(target);
    const instance=mount(B4DropdownMenu,{target,props:{props:{label:'Ordinary document menu',open:true},io:{emit:()=>{}}}});
    try{await settle();expect(document.querySelector('[data-dropdown-menu-content]')).not.toBeNull();expect(document.querySelector('[data-owned-menu-content]')).toBeNull();expect(document.body.style.overflow).toBe('hidden');}finally{
      await unmount(instance);
      // Installed Bits schedules its final body-style restoration after unmount
      // (24ms by default). Await that real lifecycle, rather than resetting body
      // styles or taking the next owned-mode snapshot during its pending cleanup.
      await vi.waitFor(()=>expect(bodyStyles()).toEqual(before),{timeout:1000,interval:5});
    }
  });
  it('fails closed into the owned path during initial owner resolution rather than mounting global Content',async()=>{
    const sibling=document.createElement('section');sibling.setAttribute('data-ui-application-viewport','');sibling.innerHTML='<button>Existing focus</button>';document.body.append(sibling);const other=sibling.querySelector('button')!;other.focus();
    const before={...bodyStyles(),hidden:sibling.getAttribute('aria-hidden'),inert:sibling.hasAttribute('inert')};
    const host=mountDoc({root:'root',nodes:dropdown([leaf('item','Visible item')])},{menuOpen:{key:'menuOpen',type:'boolean',initial:true}});await settle();
    expect(host.querySelector('[data-owned-menu-content]')).not.toBeNull();expect(document.activeElement).toBe(other);expect(key(other,'Escape').defaultPrevented).toBe(false);
    expect({...bodyStyles(),hidden:sibling.getAttribute('aria-hidden'),inert:sibling.hasAttribute('inert')}).toEqual(before);
  });
  it('renders an actual owned menu with native keyboard navigation, selection and sibling Escape isolation',async()=>{
    const host=mountDoc({root:'root',nodes:dropdown([leaf('first','First'),leaf('locked','Locked',{disabled:literal(true)}),leaf('last','Last')])},{menuOpen:{key:'menuOpen',type:'boolean',initial:false}});
    await settle();const trigger=host.querySelector<HTMLButtonElement>('[data-dropdown-menu-trigger]')!;trigger.focus();key(trigger,'ArrowDown');await settle();
    const menu=host.querySelector<HTMLElement>('[data-owned-menu-content]')!;expect(menu).toBeTruthy();expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id);
    const items=menu.querySelectorAll<HTMLElement>('[role="menuitem"]');expect(document.activeElement).toBe(items[0]);key(items[0]!,'ArrowDown');expect(document.activeElement).toBe(items[2]);key(items[2]!,'Home');expect(document.activeElement).toBe(items[0]);
    const sibling=document.createElement('section');sibling.setAttribute('data-ui-application-viewport','');sibling.innerHTML='<button>Other app</button>';document.body.append(sibling);const other=sibling.querySelector('button')!;other.focus();
    expect(key(other,'Escape').defaultPrevented).toBe(false);await settle();expect(host.querySelector('[role="menu"]')).not.toBeNull();expect(document.activeElement).toBe(other);
    items[2]!.focus();key(items[2]!,'Enter');await settle();expect(host.querySelector('[role="menu"]')).toBeNull();expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(trigger);
  });

  it('keeps radio and checkbox group values controlled and retains non-closing item defaults',async()=>{
    const nodes=dropdown([component('radio','dropdown-menu.radio-group',{value:state('choice')},slot('items',['a','b']),{valueChange:bind('choice')}),component('checks','dropdown-menu.checkbox-group',{values:state('choices')},slot('items',['check','mixed']),{valuesChange:bind('choices')})]);
    nodes.a=component('a','dropdown-menu.radio-item',{value:literal('a'),label:literal('A')});nodes.b=component('b','dropdown-menu.radio-item',{value:literal('b'),label:literal('B')});nodes.check=component('check','dropdown-menu.checkbox-item',{value:literal('notify'),label:literal('Notify')});nodes.mixed=component('mixed','dropdown-menu.checkbox-item',{value:literal('mixed-value'),label:literal('Mixed'),indeterminate:state('mixed')},{},{indeterminateChange:bind('mixed')});
    const host=mountDoc({root:'root',nodes},{menuOpen:{key:'menuOpen',type:'boolean',initial:false},choice:{key:'choice',type:'string',initial:'a'},choices:{key:'choices',type:'stringList',initial:['mixed-value']},mixed:{key:'mixed',type:'boolean',initial:true}});await settle();const trigger=host.querySelector<HTMLButtonElement>('[data-dropdown-menu-trigger]')!;trigger.focus();trigger.click();await settle();
    const radios=host.querySelectorAll<HTMLElement>('[role="menuitemradio"]');expect(radios[0]!.getAttribute('aria-checked')).toBe('true');radios[1]!.click();await settle();expect(radios[0]!.getAttribute('aria-checked')).toBe('false');expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    const checks=host.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),check=checks[0]!;check.click();await settle();expect(check.getAttribute('aria-checked')).toBe('true');expect(checks[1]!.getAttribute('aria-checked')).toBe('mixed');checks[1]!.click();await settle();expect(checks[1]!.getAttribute('aria-checked')).toBe('true');expect(host.querySelector('[role="menu"]')).not.toBeNull();
  });

  it('opens nested menus with ArrowRight, closes only the child with ArrowLeft, and closes the full chain on activation',async()=>{
    const nodes=dropdown([component('sub','dropdown-menu.sub',{label:literal('More'),open:state('subOpen')},slot('items',['child']),{openChange:bind('subOpen')})]);nodes.child=leaf('child','Child');
    const host=mountDoc({root:'root',nodes},{menuOpen:{key:'menuOpen',type:'boolean',initial:false},subOpen:{key:'subOpen',type:'boolean',initial:false}});await settle();const rootTrigger=host.querySelector<HTMLButtonElement>('[data-dropdown-menu-trigger]')!;rootTrigger.focus();key(rootTrigger,'ArrowDown');await settle();
    const sub=host.querySelector<HTMLElement>('[data-dropdown-menu-sub-trigger]')!;key(sub,'ArrowRight');await settle();const child=host.querySelector<HTMLElement>('[data-dropdown-menu-sub-content] [role="menuitem"]')!;expect(child).toBeTruthy();expect(document.activeElement).toBe(child);
    key(child,'ArrowLeft');await settle();expect(host.querySelector('[data-dropdown-menu-sub-content]')).toBeNull();expect(host.querySelector('[role="menu"]')).not.toBeNull();expect(document.activeElement).toBe(sub);
    key(sub,'ArrowRight');await settle();key(host.querySelector<HTMLElement>('[data-dropdown-menu-sub-content] [role="menuitem"]')!,'Enter');await settle();expect(host.querySelectorAll('[role="menu"]')).toHaveLength(0);expect(document.activeElement).toBe(rootTrigger);
  });

  it('arbitrates sibling submenus and does not block parent keyboard navigation after pointer opening',async()=>{
    const nodes=dropdown([component('sub1','dropdown-menu.sub',{label:literal('One'),open:state('one')},slot('items',['oneItem']),{openChange:bind('one')}),component('sub2','dropdown-menu.sub',{label:literal('Two'),open:state('two')},slot('items',['twoItem']),{openChange:bind('two')})]);nodes.oneItem=leaf('oneItem','First child');nodes.twoItem=leaf('twoItem','Second child');
    const host=mountDoc({root:'root',nodes},{menuOpen:{key:'menuOpen',type:'boolean',initial:false},one:{key:'one',type:'boolean',initial:false},two:{key:'two',type:'boolean',initial:false}});await settle();const root=host.querySelector<HTMLButtonElement>('[data-dropdown-menu-trigger]')!;root.focus();key(root,'ArrowDown');await settle();
    const triggers=host.querySelectorAll<HTMLElement>('[data-dropdown-menu-sub-trigger]');triggers[0]!.dispatchEvent(new PointerEvent('pointerenter',{bubbles:false}));await settle();expect(host.querySelector('[data-dropdown-menu-sub-content]')?.textContent).toContain('First child');key(triggers[0]!,'ArrowDown');expect(document.activeElement).toBe(triggers[1]);
    key(triggers[1]!,'ArrowRight');await settle();expect(host.querySelectorAll('[data-dropdown-menu-sub-content]')).toHaveLength(1);expect(host.querySelector('[data-dropdown-menu-sub-content]')?.textContent).toContain('Second child');
  });

  it('opens a context menu from a keyboard request and closes a hidden source without capturing sibling focus',async()=>{
    const nodes:Record<string,UiNode>={root:{kind:'element',id:'root',tag:'main',children:['context']},context:component('context','context-menu',{label:literal('Context actions'),open:state('contextOpen')},slot('items',['item']),{openChange:bind('contextOpen')}),item:component('item','context-menu.item',{label:literal('Inspect'),value:literal('inspect')})};
    const host=mountDoc({root:'root',nodes},{contextOpen:{key:'contextOpen',type:'boolean',initial:false}});await settle();const trigger=host.querySelector<HTMLElement>('[data-context-menu-trigger]')!;trigger.focus();key(trigger,'F10',{shiftKey:true});await settle();expect(host.querySelector('[data-context-menu-content]')).not.toBeNull();
    const other=document.createElement('button');other.textContent='Outside';document.body.append(other);other.focus();trigger.hidden=true;await settle();expect(host.querySelector('[role="menu"]')).toBeNull();expect(document.activeElement).toBe(other);
  });

  it('retains menubar horizontal roving focus and opens the selected menu using its canonical value',async()=>{
    const nodes:Record<string,UiNode>={root:{kind:'element',id:'root',tag:'main',children:['bar']},bar:component('bar','menubar',{value:state('barValue')},slot('menus',['file','edit']),{valueChange:bind('barValue')}),file:component('file','menubar.menu',{value:literal('file'),label:literal('File')},slot('items',['new'])),edit:component('edit','menubar.menu',{value:literal('edit'),label:literal('Edit')},slot('items',['copy'])),new:component('new','menubar.item',{label:literal('New'),value:literal('new')}),copy:component('copy','menubar.item',{label:literal('Copy'),value:literal('copy')})};
    const host=mountDoc({root:'root',nodes},{barValue:{key:'barValue',type:'string',initial:''}});await settle();const triggers=host.querySelectorAll<HTMLButtonElement>('[data-owned-menubar-trigger]');expect(triggers[0]!.tabIndex).toBe(0);expect(triggers[1]!.tabIndex).toBe(-1);triggers[0]!.focus();key(triggers[0]!,'ArrowRight');expect(document.activeElement).toBe(triggers[1]);key(triggers[1]!,'ArrowDown');await settle();const item=host.querySelector<HTMLElement>('[data-menubar-content] [role="menuitem"]')!;expect(item.textContent).toContain('Copy');expect(document.activeElement).toBe(item);key(item,'Escape');await settle();expect(host.querySelector('[role="menu"]')).toBeNull();expect(document.activeElement).toBe(triggers[1]);
  });
});
