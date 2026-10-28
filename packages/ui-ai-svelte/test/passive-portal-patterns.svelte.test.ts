import {describe, it, expect} from 'vitest';
import {mount, unmount, flushSync} from 'svelte';
import PassivePopupOwner from './PassivePopupOwner.svelte';
async function open(button: HTMLElement, document: Document) {
  const Pointer = document.defaultView!.PointerEvent;
  button.dispatchEvent(new Pointer('pointerenter', {bubbles: false, pointerType: 'mouse'}));
  button.dispatchEvent(new Pointer('pointermove', {bubbles: true, pointerType: 'mouse'}));
  await new Promise(resolve => setTimeout(resolve, 80)); flushSync();
}
describe('actual AI hovercard application portals', () => {
  it.each([false, true])('keeps citation=%s popup in its owning app and canonical scope', async citation => {
    const target = document.createElement('div'); document.body.append(target);
    const component = mount(PassivePopupOwner, {target, props: {name: 'a', citation}}); flushSync();
    const owner = target.querySelector<HTMLElement>('[data-owner="a"]')!;
    await open(owner.querySelector<HTMLElement>('button')!, document);
    const popup = owner.querySelector<HTMLElement>('[data-ui-part="popup"]');
    expect(popup).not.toBeNull();
    expect(popup?.closest('.scope-a')).not.toBeNull();
    expect(popup?.closest('.vict-ai')).not.toBeNull();
    expect(popup?.getAttribute('data-ui-owner')).toBe('a');
    expect(popup?.style.getPropertyValue('--public-popup')).toBe('1');
    expect(document.body.querySelectorAll('[data-ui-part="popup"]')).toHaveLength(1);
    await unmount(component); target.remove();
  });
  it('does not send app A content into sibling app B', async () => {
    const targetA = document.createElement('div'), targetB = document.createElement('div'); document.body.append(targetA, targetB);
    const a = mount(PassivePopupOwner, {target: targetA, props: {name: 'a'}}), b = mount(PassivePopupOwner, {target: targetB, props: {name: 'b', citation: true}}); flushSync();
    await open(targetA.querySelector<HTMLElement>('button')!, document);
    await open(targetB.querySelector<HTMLElement>('button')!, document);
    expect(targetA.querySelector('[data-ui-owner="a"][data-ui-part="popup"]')).not.toBeNull();
    expect(targetA.querySelector('[data-ui-owner="b"]')).toBeNull();
    expect(targetB.querySelector('[data-ui-owner="b"][data-ui-part="popup"]')).not.toBeNull();
    expect(targetB.querySelector('[data-ui-owner="a"]')).toBeNull();
    await unmount(a); await unmount(b); targetA.remove(); targetB.remove();
  });
  it('uses an explicitly hosted iframe document instead of the outer body', async () => {
    const iframe = document.createElement('iframe'); document.body.append(iframe);
    const inner = iframe.contentDocument!, target = inner.createElement('div'); inner.body.append(target);
    const component = mount(PassivePopupOwner, {target, props: {name: 'inner', citation: true}}); flushSync();
    await open(target.querySelector<HTMLElement>('button')!, inner);
    const popup = inner.querySelector('[data-ui-part="popup"]');
    expect(popup).not.toBeNull(); expect(popup?.ownerDocument).toBe(inner);
    expect(popup?.closest('[data-owner="inner"]')).not.toBeNull();
    expect(document.querySelector('[data-ui-owner="inner"][data-ui-part="popup"]')).toBeNull();
    await unmount(component); iframe.remove();
  });
});
