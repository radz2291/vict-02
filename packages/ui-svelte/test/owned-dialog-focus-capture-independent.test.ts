import {afterEach, describe, expect, it, vi} from 'vitest';
import {registerOwnedPopupLayer} from '../src/owned-popup.js';

const cleanup: (() => void)[] = [];
afterEach(() => {for (const dispose of cleanup.splice(0).reverse()) dispose(); document.body.replaceChildren();});
function fixture() {
  const owner = document.createElement('main'); owner.dataset.uiApplicationViewport = '';
  const trigger = document.createElement('button'), panel = document.createElement('section');
  const first = document.createElement('button'), second = document.createElement('button');
  panel.append(first, second); owner.append(trigger, panel); document.body.append(owner);
  return {owner, trigger, panel, first, second};
}
describe('independent optional early owned focus guard compatibility', () => {
  it('calls an existing focusin callback once, not for the separate focus event', () => {
    const f = fixture(), focusIn = vi.fn();
    const layer = registerOwnedPopupLayer({...f, kind: 'menu', getTrigger: () => f.trigger, onFocusIn: focusIn});
    cleanup.push(() => layer.dispose());
    f.first.focus();
    expect(focusIn).toHaveBeenCalledOnce();
    expect(focusIn.mock.calls[0][0].type).toBe('focusin');
  });
  it('orders an opted-in capture before target focus and legacy focusin afterward', () => {
    const f = fixture(), order: string[] = [];
    const capture = vi.fn((event: FocusEvent) => {order.push(`capture:${event.type}`);});
    const focusIn = vi.fn((event: FocusEvent) => {order.push(`legacy:${event.type}`);});
    f.first.addEventListener('focus', () => order.push('target:focus'));
    const layer = registerOwnedPopupLayer({...f, kind: 'menu', getTrigger: () => f.trigger, onFocusCapture: capture, onFocusIn: focusIn});
    cleanup.push(() => layer.dispose());
    f.first.focus();
    expect(order).toEqual(['capture:focus', 'target:focus', 'legacy:focusin']);
    expect(capture).toHaveBeenCalledOnce(); expect(focusIn).toHaveBeenCalledOnce();
  });
  it('removes both focus listeners after the last owned layer is disposed', () => {
    const f = fixture(), capture = vi.fn(), focusIn = vi.fn();
    const layer = registerOwnedPopupLayer({...f, kind: 'menu', getTrigger: () => f.trigger, onFocusCapture: capture, onFocusIn: focusIn});
    f.first.focus(); expect(capture).toHaveBeenCalledOnce(); expect(focusIn).toHaveBeenCalledOnce();
    layer.dispose();
    f.second.focus();
    expect(capture).toHaveBeenCalledOnce(); expect(focusIn).toHaveBeenCalledOnce();
  });
});
