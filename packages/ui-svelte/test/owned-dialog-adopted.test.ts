import {afterEach, describe, expect, it, vi} from 'vitest';
import {createOwnedDialogBehavior} from '../src/owned-dialog.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
});

function fixture(distinctCreationRealm: boolean) {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const child = iframe.contentDocument!, view = child.defaultView!;
  const owner = document.createElement('main'); owner.dataset.uiApplicationViewport = '';
  const source = document.createElement('section'); source.dataset.uiOwnerRoot = 'a';
  const trigger = document.createElement('button'); trigger.dataset.uiOwner = 'a';
  const outside = document.createElement('button'); outside.textContent = 'Outside dialog, same application';
  source.append(trigger, outside);
  const panel = document.createElement('div'); panel.dataset.uiOwner = 'a'; panel.tabIndex = -1;
  const inside = document.createElement('button'); inside.textContent = 'Dialog action'; panel.append(inside);
  owner.append(source, panel); child.body.append(child.adoptNode(owner));
  if (distinctCreationRealm) {
    // Happy DOM shares constructors. As in owned-popup-adopted.test.ts, model
    // native adoption retaining the parent creation prototype after ownerDocument changes.
    const original = Object.getOwnPropertyDescriptor(view, 'Element')!;
    Object.defineProperty(view, 'Element', {...original, value: class DestinationElement extends Element {}});
    cleanup.push(() => Object.defineProperty(view, 'Element', original));
  }
  const dismiss = vi.fn();
  cleanup.push(createOwnedDialogBehavior({owner, panel, getTrigger: () => trigger, onDismiss: dismiss, focusOnOpen: false}));
  inside.focus();
  return {child, view, trigger, inside, outside, panel, dismiss};
}

describe.each([false, true])('owned dialog parent-created adopted targets, distinct realm=%s', distinctRealm => {
  it('prevents a background automatic-tab focus handler from activating and unmounting the dialog', () => {
    const f = fixture(distinctRealm);
    let activeTab = 'projects';
    const order: string[] = [];
    const insideFocus = vi.fn();
    f.inside.addEventListener('focus', insideFocus);
    // B5Tabs uses public Bits Tabs.Trigger. Its onfocus handler activates an
    // automatic tab before focusin; this models that public handler's effect.
    f.outside.addEventListener('focus', () => {
      order.push('background-tab-focus');
      activeTab = 'notes';
      f.panel.remove();
    });
    f.outside.addEventListener('focusin', () => order.push('background-tab-focusin'));
    f.outside.focus();
    expect.soft(order).not.toContain('background-tab-focus');
    expect.soft(activeTab).toBe('projects');
    expect.soft(f.panel.isConnected).toBe(true);
    expect(f.child.activeElement).toBe(f.inside);
    expect(insideFocus).toHaveBeenCalledOnce();
  });
  it('does not block focus handlers or focus in a different canonical application', () => {
    const f = fixture(distinctRealm);
    const otherOwner = document.createElement('section'); otherOwner.dataset.uiOwnerRoot = 'b';
    const other = document.createElement('button'); otherOwner.append(other); f.panel.parentElement!.append(otherOwner);
    const focus = vi.fn(); other.addEventListener('focus', focus);
    other.focus();
    expect(focus).toHaveBeenCalledOnce();
    expect(f.child.activeElement).toBe(other);
    expect(f.panel.isConnected).toBe(true);
  });
  it('contains focus within the dialog when a same-app outside control receives focus', () => {
    const f = fixture(distinctRealm);
    expect(f.inside.ownerDocument).toBe(f.child);
    if (distinctRealm) expect(f.inside instanceof f.view.Element).toBe(false);
    f.outside.focus();
    expect(f.child.activeElement).toBe(f.inside);
  });
  it('dismisses a pointer activation outside the panel in the same owner', () => {
    const f = fixture(distinctRealm);
    f.outside.dispatchEvent(new f.view.PointerEvent('pointerdown', {bubbles: true, cancelable: true, pointerType: 'mouse'}));
    f.outside.dispatchEvent(new f.view.MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
    expect(f.dismiss).toHaveBeenCalledExactlyOnceWith('outside');
  });
  it('keeps owner-local Escape dismissal through the shared hub', () => {
    const f = fixture(distinctRealm);
    const escape = new f.view.KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    f.inside.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(f.dismiss).toHaveBeenCalledExactlyOnceWith('escape');
  });
});
