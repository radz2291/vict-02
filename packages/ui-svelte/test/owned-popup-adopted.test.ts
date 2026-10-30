import {afterEach, describe, expect, it, vi} from 'vitest';
import {isOwnedElementRendered, isOwnedPopupSourceVisible, isOwnedPopupSourceAvailable, registerOwnedPopupLayer, ownedPopupBranches} from '../src/owned-popup.js';

const cleanup: (()=>void)[]=[];
afterEach(()=>{for(const dispose of cleanup.splice(0).reverse())dispose();document.body.replaceChildren();});

function adoptedFixture(){
  const iframe=document.createElement('iframe');document.body.append(iframe);
  const child=iframe.contentDocument!,window=child.defaultView!;
  const owner=document.createElement('main');owner.dataset.uiApplicationViewport='';
  const source=document.createElement('section');source.dataset.uiOwnerRoot='a';
  const sibling=document.createElement('section');sibling.dataset.uiOwnerRoot='b';
  const trigger=document.createElement('button');trigger.dataset.uiOwner='a';source.append(trigger);
  const panel=document.createElement('div');panel.dataset.uiOwner='a';panel.role='menu';
  owner.append(source,sibling,panel);child.body.append(child.adoptNode(owner));
  // Happy DOM shares window constructors. Model the native browser distinction
  // after real DOM adoption: ownerDocument changes but the creation prototype
  // remains. The production predicates must not require destination instanceof.
  const originalElement=Object.getOwnPropertyDescriptor(window,'Element')!;
  const originalHTMLElement=Object.getOwnPropertyDescriptor(window,'HTMLElement')!;
  Object.defineProperty(window,'Element',{...originalElement,value:class DestinationElement extends Element{}});
  Object.defineProperty(window,'HTMLElement',{...originalHTMLElement,value:class DestinationHTMLElement extends HTMLElement{}});
  cleanup.push(()=>{Object.defineProperty(window,'Element',originalElement);Object.defineProperty(window,'HTMLElement',originalHTMLElement);});
  return {iframe,child,window,owner,source,sibling,trigger,panel};
}

describe('owned popups with parent-created HTML adopted into an iframe',()=>{
  it('uses the actual adopted HTML node instead of destination-realm instanceof',()=>{
    const f=adoptedFixture();
    expect(f.trigger.ownerDocument).toBe(f.child);
    expect(f.trigger instanceof HTMLElement).toBe(true);
    expect(f.trigger instanceof f.window.HTMLElement).toBe(false);
    expect(isOwnedElementRendered(f.trigger)).toBe(true);
    expect(isOwnedPopupSourceVisible(f.trigger)).toBe(true);
    expect(isOwnedPopupSourceAvailable(f.trigger,{excludeDisabled:true})).toBe(true);
  });
  it('still rejects SVG, non-elements, detached HTML and unavailable documents',()=>{
    const f=adoptedFixture(),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');f.source.append(svg);
    const text=f.child.createTextNode('text');f.source.append(text);
    for(const item of [svg,text,f.child] as unknown as Element[]){expect(isOwnedElementRendered(item)).toBe(false);expect(isOwnedPopupSourceVisible(item)).toBe(false);}
    f.trigger.remove();expect(isOwnedElementRendered(f.trigger)).toBe(false);expect(isOwnedPopupSourceVisible(f.trigger)).toBe(false);
    const unavailable=document.implementation.createHTMLDocument('no window').createElement('button');
    expect(isOwnedElementRendered(unavailable)).toBe(false);
  });
  it('retains hidden, inert, disabled-fieldset and disclosure fences',()=>{
    const f=adoptedFixture();
    f.source.hidden=true;expect(isOwnedPopupSourceVisible(f.trigger)).toBe(false);f.source.hidden=false;
    f.source.setAttribute('inert','');expect(isOwnedElementRendered(f.trigger)).toBe(false);f.source.removeAttribute('inert');
    f.source.setAttribute('aria-hidden','true');expect(isOwnedElementRendered(f.trigger)).toBe(false);expect(isOwnedPopupSourceVisible(f.trigger)).toBe(true);f.source.removeAttribute('aria-hidden');
    const fieldset=document.createElement('fieldset');fieldset.disabled=true;f.source.append(fieldset);fieldset.append(f.trigger);
    expect(isOwnedPopupSourceAvailable(f.trigger,{excludeDisabled:true})).toBe(false);
    const legend=document.createElement('legend');fieldset.prepend(legend);legend.append(f.trigger);expect(isOwnedPopupSourceAvailable(f.trigger,{excludeDisabled:true})).toBe(true);
    f.source.append(f.trigger);const details=document.createElement('details');f.source.append(details);details.append(f.trigger);
    expect(isOwnedPopupSourceVisible(f.trigger)).toBe(false);const summary=document.createElement('summary');details.prepend(summary);summary.append(f.trigger);expect(isOwnedPopupSourceVisible(f.trigger)).toBe(true);
  });
  it('arbitrates adopted event targets without admitting a sibling owner',()=>{
    const f=adoptedFixture(),onKeydown=vi.fn((event:KeyboardEvent)=>event.preventDefault()),onClick=vi.fn();
    const layer=registerOwnedPopupLayer({owner:f.owner,panel:f.panel,kind:'menu',getTrigger:()=>f.trigger,onKeydown,onClick});cleanup.push(layer.dispose);
    expect(layer.isTop()).toBe(true);
    const key=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});f.trigger.dispatchEvent(key);
    expect(onKeydown).toHaveBeenCalledOnce();expect(key.defaultPrevented).toBe(true);
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');f.trigger.append(icon);
    icon.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));expect(onClick).toHaveBeenCalledOnce();
    const siblingTrigger=document.createElement('button');f.sibling.append(siblingTrigger);
    siblingTrigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(onKeydown).toHaveBeenCalledOnce();
    f.sibling.append(f.trigger);expect(layer.isTop()).toBe(false);
  });
  it('resolves an adopted popup by exact live control and source metadata',()=>{
    const f=adoptedFixture();f.source.append(f.panel);
    const control=document.createElement('button');control.dataset.uiOwner='a';control.dataset.uiOcc='nested';control.setAttribute('aria-controls','adopted-popup');control.setAttribute('aria-expanded','true');f.panel.append(control);
    const popup=document.createElement('div');popup.id='adopted-popup';popup.role='listbox';popup.dataset.uiOwner='a';popup.dataset.uiOcc='nested';popup.dataset.uiPart='content';f.owner.append(popup);
    expect(ownedPopupBranches(f.owner,f.panel)).toContain(popup);
    popup.dataset.uiOwner='b';expect(ownedPopupBranches(f.owner,f.panel)).not.toContain(popup);
    popup.dataset.uiOwner='a';popup.hidden=true;expect(ownedPopupBranches(f.owner,f.panel)).not.toContain(popup);
  });
});
