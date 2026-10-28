import {afterEach,describe,expect,it} from 'vitest';
import {isFocusable,restoreFocus,trapFocus} from '../src/focus.js';

afterEach(()=>{document.body.innerHTML='';});
describe('owned pattern focus boundaries',()=>{
  it('ignores hidden, inert and disabled ancestors during forward/reverse wrapping',()=>{
    const panel=document.createElement('section');panel.tabIndex=-1;
    panel.innerHTML='<button id="first">First</button><div hidden><button>Hidden</button></div><div inert><button>Inert</button></div><div style="display:none"><button>CSS hidden</button></div><fieldset disabled><button>Disabled</button></fieldset><button id="last">Last</button>';
    document.body.append(panel);
    const first=panel.querySelector<HTMLElement>('#first')!,last=panel.querySelector<HTMLElement>('#last')!;
    last.focus();const forward=new KeyboardEvent('keydown',{key:'Tab',cancelable:true});trapFocus(forward,panel);
    expect(forward.defaultPrevented).toBe(true);expect(document.activeElement).toBe(first);
    first.focus();const reverse=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,cancelable:true});trapFocus(reverse,panel);
    expect(reverse.defaultPrevented).toBe(true);expect(document.activeElement).toBe(last);
    expect([...panel.querySelectorAll('button')].filter(isFocusable)).toEqual([first,last]);
  });
  it('restores the exact connected application-frame element and refuses inert or detached targets',()=>{
    const frame=document.createElement('iframe');document.body.append(frame);
    const doc=frame.contentDocument!;
    const original=doc.createElement('button'),fallback=doc.createElement('button');doc.body.append(original,fallback);
    fallback.focus();restoreFocus(original,fallback);expect(doc.activeElement).toBe(original);
    original.setAttribute('inert','');restoreFocus(original,fallback);expect(doc.activeElement).toBe(fallback);
    original.remove();restoreFocus(original,fallback);expect(doc.activeElement).toBe(fallback);
  });
});
