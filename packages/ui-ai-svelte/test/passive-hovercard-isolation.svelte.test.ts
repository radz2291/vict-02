import {afterEach, describe, expect, it, vi} from 'vitest';
import {flushSync, mount, tick, unmount} from 'svelte';
import PassivePopupOwner from './PassivePopupOwner.svelte';
import Context from '../src/patterns/Context.svelte';
import {createOwnedHoverCardBehavior} from '../../ui-svelte/src/owned-tooltip.js';
import {loopOwnedDialogFocus, ownedFocusableOrder} from '../../ui-svelte/src/owned-dialog.js';

let instances: ReturnType<typeof mount>[] = [];
const settle = async () => {flushSync(); await tick(); flushSync();};
afterEach(async () => {
  for (const instance of instances) await unmount(instance);
  instances = [];
  document.body.innerHTML = '';
});

it('preserves canonical positive-tabindex and radio-group order without admitting an outside checked radio', () => {
  const owner = document.createElement('main'); owner.dataset.uiApplicationViewport = '';
  const panel = document.createElement('div'); panel.dataset.uiOwner = 'tab-order';
  const ordinary = document.createElement('button'), positiveTwo = document.createElement('button'), positiveOne = document.createElement('button');
  positiveTwo.tabIndex = 2; positiveOne.tabIndex = 1;
  const firstRadio = document.createElement('input'), checkedRadio = document.createElement('input');
  for (const radio of [firstRadio, checkedRadio]) {radio.type = 'radio'; radio.name = 'choice';}
  checkedRadio.checked = true;
  const disabled = document.createElement('button'); disabled.disabled = true;
  const hidden = document.createElement('button'); hidden.hidden = true;
  panel.append(ordinary, firstRadio, checkedRadio, positiveTwo, positiveOne, disabled, hidden); owner.append(panel); document.body.append(owner);
  expect(ownedFocusableOrder(panel, [], owner)).toEqual([positiveOne, positiveTwo, ordinary, checkedRadio]);
  checkedRadio.focus();
  const forward = new KeyboardEvent('keydown', {key: 'Tab', cancelable: true});
  loopOwnedDialogFocus(forward, panel, [], owner);
  expect(forward.defaultPrevented).toBe(true); expect(document.activeElement).toBe(positiveOne);
  const reverse = new KeyboardEvent('keydown', {key: 'Tab', shiftKey: true, cancelable: true});
  loopOwnedDialogFocus(reverse, panel, [], owner);
  expect(reverse.defaultPrevented).toBe(true); expect(document.activeElement).toBe(checkedRadio);
  const outside = document.createElement('input'); outside.type = 'radio'; outside.name = 'choice'; owner.append(outside); outside.checked = true;
  expect(ownedFocusableOrder(panel, [], owner)).toEqual([positiveOne, positiveTwo, ordinary]);
});

it('keeps citation links interactive and returns panel Escape focus to its source without tooltip semantics', async () => {
  const {app, trigger} = await fixture(true);
  const panel = app.querySelector<HTMLElement>('[data-ui-part="popup"]')!;
  const link = panel.querySelector<HTMLAnchorElement>('a')!;
  expect(panel.dataset.slot).toBe('hover-card-content');
  expect(panel.getAttribute('role')).not.toBe('tooltip');
  expect(trigger.getAttribute('aria-describedby')).toBeNull();
  expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  link.focus(); await settle();
  expect(document.activeElement).toBe(link);
  link.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
  await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('retains the ordinary unowned Bits hovercard path', async () => {
  const app = document.createElement('div'); document.body.append(app);
  instances.push(mount(Context, {target: app, props: {used: 3, limit: 10}})); await settle();
  const trigger = app.querySelector<HTMLButtonElement>('button')!;
  trigger.dispatchEvent(new PointerEvent('pointerenter', {bubbles: false, pointerType: 'mouse'}));
  await vi.waitFor(() => expect(document.querySelector('[data-link-preview-content]')).not.toBeNull());
  expect(document.querySelector('[data-owned-hover-card-content]')).toBeNull();
});

it('leaves the active last link mounted for native Tab when no next logical owned control exists', async () => {
  const {app, trigger, outside} = await fixture(true);
  const panel = app.querySelector<HTMLElement>('[data-ui-part="popup"]')!, link = panel.querySelector<HTMLAnchorElement>('a')!;
  link.focus(); trigger.dispatchEvent(new PointerEvent('pointerleave', {pointerType: 'mouse'})); await settle();
  const tab = new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true});
  link.dispatchEvent(tab); await settle();
  expect(tab.defaultPrevented).toBe(false); expect(document.activeElement).toBe(link);
  expect(app.querySelector('[data-ui-part="popup"]')).toBe(panel);
  // Model the normal Tab destination after the app; only subsequent focusout
  // closes the card, rather than removing the active native-navigation source.
  outside.focus();
  await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).toBeNull());
  expect(document.activeElement).toBe(outside);
});

it('provides logical Tab entry, reverse entry and exit before the next ordinary app action', async () => {
  const {app, trigger} = await fixture(true, true);
  const owner = app.querySelector<HTMLElement>('[data-ui-application-viewport]')!;
  const next = owner.querySelector<HTMLButtonElement>('[data-next-ordinary]')!;
  const panel = app.querySelector<HTMLElement>('[data-ui-part="popup"]')!, link = panel.querySelector<HTMLAnchorElement>('a')!;
  // The physical next button precedes the portal; plain native Tab cannot
  // reach the link before focusout closes the popup.

  const physical = [...owner.querySelectorAll<HTMLElement>('button,a[href]')];
  expect(physical.indexOf(next)).toBe(physical.indexOf(trigger) + 1);
  expect(physical.indexOf(link)).toBeGreaterThan(physical.indexOf(next));
  trigger.focus(); await settle();
  const enter = new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true});
  trigger.dispatchEvent(enter); await settle();
  expect(enter.defaultPrevented).toBe(true); expect(document.activeElement).toBe(link);
  await new Promise(resolve => setTimeout(resolve, 130));
  expect(app.querySelector('[data-ui-part="popup"]')).toBe(panel);
  const reverse = new KeyboardEvent('keydown', {key: 'Tab', shiftKey: true, bubbles: true, cancelable: true});
  link.dispatchEvent(reverse); await settle();
  expect(reverse.defaultPrevented).toBe(true); expect(document.activeElement).toBe(trigger);
  trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true})); await settle();
  const exit = new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true});
  link.dispatchEvent(exit); await settle();
  expect(exit.defaultPrevented).toBe(true); expect(document.activeElement).toBe(next);
  await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).toBeNull());
});

it('keeps parent-created adopted trigger-to-link focus inside an iframe hovercard corridor', async () => {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const inner = iframe.contentDocument!, view = inner.defaultView!;
  const owner = document.createElement('main'); owner.dataset.uiApplicationViewport = '';
  const trigger = document.createElement('button'), panel = document.createElement('div'), link = document.createElement('a');
  link.href = 'https://example.com/'; panel.append(link); owner.append(trigger, panel); inner.body.append(inner.adoptNode(owner));
  // Happy DOM shares constructors; model the distinct creation prototype after
  // real adoption, as in the shared popup adoption regression.
  const originalElement = Object.getOwnPropertyDescriptor(view, 'Element')!;
  Object.defineProperty(view, 'Element', {...originalElement, value: class DestinationElement extends Element {}});
  let open = true;
  const behavior = createOwnedHoverCardBehavior({owner, trigger, id: 'adopted-hover', getPanel: () => panel, isOpen: () => open, delay: () => 0, onOpenChange: value => {open = value;}});
  try {
    expect(link instanceof view.Element).toBe(false);
    behavior.sync(); trigger.focus(); link.focus();
    trigger.dispatchEvent(new view.PointerEvent('pointerleave', {pointerType: 'mouse'}));
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(open).toBe(true); expect(inner.activeElement).toBe(link);
    link.dispatchEvent(new view.KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
    expect(open).toBe(false); expect(inner.activeElement).toBe(trigger);
  } finally {
    behavior.dispose(); Object.defineProperty(view, 'Element', originalElement); iframe.remove();
  }
});
async function fixture(citation: boolean, nextAction = false) {
  const app = document.createElement('div');
  const sibling = document.createElement('div');
  sibling.setAttribute('data-ui-application-viewport', '');
  const outside = document.createElement('button');
  outside.textContent = 'Sibling action';
  sibling.append(outside);
  document.body.append(app, sibling);
  instances.push(mount(PassivePopupOwner, {target: app, props: {name: 'subject', citation, nextAction}}));
  await settle();
  const trigger = app.querySelector<HTMLButtonElement>('button')!;
  trigger.dispatchEvent(new PointerEvent('pointerenter', {bubbles: false, pointerType: 'mouse'}));
  trigger.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse'}));
  await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).not.toBeNull());
  return {app, trigger, outside};
}

describe.each([false, true])('AI hovercard ownership, citation=%s', citation => {
  it('does not consume sibling Escape, steal sibling focus or dismiss its unrelated popup', async () => {
    const {app, outside} = await fixture(citation);
    outside.focus(); await settle();
    expect(document.activeElement).toBe(outside);
    const escape = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
    outside.dispatchEvent(escape); await settle();
    expect.soft(escape.defaultPrevented).toBe(false);
    expect.soft(document.activeElement).toBe(outside);
    expect.soft(app.querySelector('[data-ui-part="popup"]')).not.toBeNull();
  });
  it('dismisses on its own trigger Escape without transferring focus', async () => {
    const {app, trigger} = await fixture(citation);
    trigger.focus(); await settle();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it('removes the open popup when its actual source becomes hidden', async () => {
    const {app, trigger} = await fixture(citation);
    trigger.hidden = true; await settle();
    await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).toBeNull());
    trigger.hidden = false; await settle();
    expect(app.querySelector('[data-ui-part="popup"]')).toBeNull();
  });
  it('removes the open popup when its actual source is detached', async () => {
    const {app, trigger} = await fixture(citation);
    trigger.remove(); await settle();
    await vi.waitFor(() => expect(app.querySelector('[data-ui-part="popup"]')).toBeNull());
  });
});
