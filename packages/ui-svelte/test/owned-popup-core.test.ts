import {afterEach, describe, expect, it, vi} from 'vitest';
import {registerOwnedPopupLayer, resolveOwnedPopupOwner, observeOwnedPopupSource, ownedPopupBranches, positionOwnedPopup} from '../src/owned-popup.js';

const disposers: (()=>void)[]=[];
afterEach(()=>{for(const dispose of disposers.splice(0).reverse())dispose();document.body.replaceChildren();});
function element(parent:HTMLElement,tag='div',attrs:Record<string,string>={}){
  const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);parent.append(node);return node;
}
function fixture(){
  const viewport=element(document.body,'section',{'data-ui-application-viewport':''});
  const sourceA=element(viewport,'section',{'data-ui-owner-root':'a'});
  const sourceB=element(viewport,'section',{'data-ui-owner-root':'b'});
  const triggerA=element(sourceA,'button',{'data-ui-owner':'a'});
  const triggerB=element(sourceB,'button',{'data-ui-owner':'b'});
  const outlet=element(viewport);
  const panelA=element(outlet,'div',{'data-ui-owner':'a'});
  const panelB=element(outlet,'div',{'data-ui-owner':'b'});
  return{viewport,sourceA,sourceB,triggerA,triggerB,panelA,panelB};
}
function escape(node:HTMLElement){const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});node.dispatchEvent(event);return event;}

describe('shared owned popup arbitration',()=>{
  it('admits the real viewport sibling outlet and keeps canonical documents independent',()=>{
    const f=fixture(),a=vi.fn((event:KeyboardEvent)=>event.preventDefault()),b=vi.fn((event:KeyboardEvent)=>event.preventDefault());
    expect(resolveOwnedPopupOwner(f.triggerA,'a')).toBe(f.viewport);
    const layerA=registerOwnedPopupLayer({owner:f.viewport,panel:f.panelA,kind:'menu',getTrigger:()=>f.triggerA,onKeydown:a});
    const layerB=registerOwnedPopupLayer({owner:f.viewport,panel:f.panelB,kind:'tooltip',getTrigger:()=>f.triggerB,onKeydown:b});
    disposers.push(layerA.dispose,layerB.dispose);
    expect(layerA.isTop()).toBe(true);expect(layerB.isTop()).toBe(true);
    escape(f.triggerA);expect(a).toHaveBeenCalledOnce();expect(b).not.toHaveBeenCalled();
    escape(f.triggerB);expect(b).toHaveBeenCalledOnce();expect(a).toHaveBeenCalledOnce();
  });
  it('excludes a source moved into a different canonical document even while the popup stays mounted',()=>{
    const f=fixture(),handler=vi.fn();
    const layer=registerOwnedPopupLayer({owner:f.viewport,panel:f.panelA,kind:'tooltip',getTrigger:()=>f.triggerA,onKeydown:handler});disposers.push(layer.dispose);
    f.sourceB.append(f.triggerA);
    expect(layer.isTop()).toBe(false);expect(escape(f.panelA).defaultPrevented).toBe(false);expect(handler).not.toHaveBeenCalled();
  });
  it('continues an unhandled tooltip key to its dialog and skips hidden retained layers',()=>{
    const f=fixture(),dialog=vi.fn((event:KeyboardEvent)=>event.preventDefault()),tooltip=vi.fn(()=> 'continue' as const);
    const lower=registerOwnedPopupLayer({owner:f.viewport,panel:f.panelA,kind:'dialog',getTrigger:()=>f.triggerA,onKeydown:dialog});
    const tip=element(f.panelA,'div',{'data-ui-owner':'a'});
    const upper=registerOwnedPopupLayer({owner:f.viewport,panel:tip,kind:'tooltip',getTrigger:()=>f.triggerA,onKeydown:tooltip});disposers.push(lower.dispose,upper.dispose);
    escape(f.triggerA);expect(tooltip).toHaveBeenCalledOnce();expect(dialog).toHaveBeenCalledOnce();
    tip.hidden=true;
    escape(f.triggerA);expect(tooltip).toHaveBeenCalledOnce();expect(dialog).toHaveBeenCalledTimes(2);expect(lower.isTop()).toBe(true);
  });
  it('observes source visibility without treating aria-hidden alone as visual removal',async()=>{
    const f=fixture(),hidden=vi.fn(),visibility=vi.fn();
    disposers.push(observeOwnedPopupSource(f.viewport,f.triggerA,hidden,visibility));
    expect(visibility).toHaveBeenLastCalledWith(true);
    f.sourceA.setAttribute('aria-hidden','true');await new Promise(resolve=>setTimeout(resolve,0));expect(hidden).not.toHaveBeenCalled();
    f.sourceA.style.display='none';await new Promise(resolve=>setTimeout(resolve,0));expect(hidden).toHaveBeenCalledOnce();expect(visibility).toHaveBeenLastCalledWith(false);
    f.sourceA.style.display='';await new Promise(resolve=>setTimeout(resolve,0));expect(visibility).toHaveBeenLastCalledWith(true);
    f.sourceA.remove();await new Promise(resolve=>setTimeout(resolve,0));expect(hidden).toHaveBeenCalledTimes(2);
    const newParent=element(f.viewport);newParent.append(f.sourceA);
    await new Promise(resolve=>setTimeout(resolve,0));expect(visibility).toHaveBeenLastCalledWith(true);
  });
  it('keeps visible dialog content eligible with a disabled launcher while menus require an available launcher',()=>{
    const f=fixture(),dialog=vi.fn((event:KeyboardEvent)=>event.preventDefault()),menu=vi.fn();
    const lower=registerOwnedPopupLayer({owner:f.viewport,panel:f.panelA,kind:'dialog',getTrigger:()=>f.triggerA,onKeydown:dialog});
    const popup=element(f.sourceA,'div',{'data-ui-owner':'a'});
    const upper=registerOwnedPopupLayer({owner:f.viewport,panel:popup,kind:'menu',getTrigger:()=>f.triggerA,onKeydown:menu});disposers.push(lower.dispose,upper.dispose);
    (f.triggerA as HTMLButtonElement).disabled=true;
    expect(upper.isTop()).toBe(false);expect(lower.isTop()).toBe(true);
    expect(escape(f.panelA).defaultPrevented).toBe(true);expect(dialog).toHaveBeenCalledOnce();expect(menu).not.toHaveBeenCalled();
  });
  it('observes disclosure visibility as the source moves between summary and closed details content',async()=>{
    const f=fixture(),details=element(f.sourceA,'details'),summary=element(details,'summary'),hidden=vi.fn(),visibility=vi.fn();
    summary.append(f.triggerA);
    disposers.push(observeOwnedPopupSource(f.viewport,f.triggerA,hidden,visibility));
    expect(visibility).toHaveBeenLastCalledWith(true);
    details.append(f.triggerA);await new Promise(resolve=>setTimeout(resolve,0));expect(visibility).toHaveBeenLastCalledWith(false);
    details.setAttribute('open','');await new Promise(resolve=>setTimeout(resolve,0));expect(visibility).toHaveBeenLastCalledWith(true);
  });
  it('admits registered coded child popups through actual references without accepting unregistered lookalikes',()=>{
    const owner=element(document.body,'main',{'data-ui-application-viewport':''}),panel=element(owner),trigger=element(panel,'button'),popup=element(owner,'div',{role:'menu'}),lookalike=element(owner,'div',{role:'menu'});
    const layer=registerOwnedPopupLayer({owner,panel:popup,kind:'menu',getTrigger:()=>trigger});disposers.push(layer.dispose);
    expect(ownedPopupBranches(owner,panel)).toContain(popup);expect(ownedPopupBranches(owner,panel)).not.toContain(lookalike);
    layer.dispose();expect(ownedPopupBranches(owner,panel)).not.toContain(popup);
  });
  it('retains popup geometry after canonical style replacement without losing authored binding variables',async()=>{
    const f=fixture(),stop=positionOwnedPopup({owner:f.viewport,trigger:f.triggerA,panel:f.panelA});disposers.push(stop);
    await new Promise(resolve=>setTimeout(resolve,20));
    expect(f.panelA.dataset.ownedPopupPosition).toBe('ready');expect(f.panelA.style.position).toBe('fixed');
    f.panelA.setAttribute('style','--ui-binding-opacity: 0.75; color: green;');
    await new Promise(resolve=>setTimeout(resolve,20));
    expect(f.panelA.style.position).toBe('fixed');expect(f.panelA.style.left).not.toBe('');expect(f.panelA.style.top).not.toBe('');
    expect(f.panelA.style.getPropertyValue('--ui-binding-opacity')).toBe('0.75');expect(f.panelA.style.color).toBe('green');
    stop();expect(f.panelA.style.position).toBe('');expect(f.panelA.style.getPropertyValue('--ui-binding-opacity')).toBe('0.75');
  });
  it('fences an outstanding geometry computation after cleanup',async()=>{
    const f=fixture();f.panelA.style.left='7px';
    const stop=positionOwnedPopup({owner:f.viewport,trigger:f.triggerA,panel:f.panelA});stop();
    await new Promise(resolve=>setTimeout(resolve,20));
    expect(f.panelA.style.left).toBe('7px');expect(f.panelA.dataset.ownedPopupPosition).toBeUndefined();
  });
});
