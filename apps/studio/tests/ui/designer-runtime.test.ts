// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
vi.mock('$app/navigation', () => ({ beforeNavigate: () => {} }));
import Designer from '../../src/lib/designer/Designer.svelte';
import { openStudioMenu } from './studio-menu.js';
import { newScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  document.body.innerHTML = '';
  localStorage.clear();
});
it('keeps runtime input and checkbox state across pointer selection and leaves authored history clean', async () => {
  const seed = newScreen('Runtime boundary', 'runtime-boundary');
  const source = {
    ...seed,
    revision: 'r1.r1',
    nodes: {
      ...seed.nodes,
      screen: { ...seed.nodes.screen!, children: ['input', 'checkbox', 'button'] },
      input: {
        kind: 'element' as const,
        id: 'input',
        tag: 'input',
        children: [],
        attributes: {
          type: 'text',
          'aria-label': 'Message',
          value: { type: 'ref' as const, path: 'state.message' },
        },
        interactions: [
          {
            on: 'change' as const,
            action: 'setState' as const,
            key: 'message',
            value: { type: 'ref' as const, path: 'state.message' },
          },
        ],
      },
      checkbox: {
        kind: 'component' as const,
        id: 'checkbox',
        definitionId: 'vict.catalog.checkbox',
        props: {
          label: { type: 'literal' as const, value: 'Accept' },
          checked: { type: 'ref' as const, path: 'state.accepted' },
        },
        outputs: { checkedChange: { setState: { key: 'accepted' } } },
      },
      button: {
        kind: 'component' as const,
        id: 'button',
        definitionId: 'vict.catalog.button',
        props: { label: { type: 'literal' as const, value: 'Submit preview' } },
        outputs: {
          press: {
            invokeAction: {
              actionId: 'demo.submit',
              input: {
                message: { type: 'ref' as const, path: 'state.message' },
                accepted: { type: 'ref' as const, path: 'state.accepted' },
              },
            },
          },
        },
      },
    },
  };
  expect(
    screenStore(localStorage, source.id).save({
      document: source,
      expectedStoredRevision: 'r1',
      newStoredRevision: 'r1.r1',
    }).ok,
  ).toBe(true);
  instance = mount(Designer, { target: document.body });
  await tick();
  await tick();
  const designButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent?.trim() === 'Submit preview',
  )!;
  designButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  designButton.click();
  await tick();
  for (const type of ['keydown', 'keyup']) {
    expect(
      designButton.dispatchEvent(
        new KeyboardEvent(type, { key: ' ', bubbles: true, cancelable: true }),
      ),
    ).toBe(false);
  }
  const designCheckbox = document.querySelector<HTMLElement>(
    '[data-testid="catalog-checkbox"] button',
  )!;
  designCheckbox.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
  );
  designCheckbox.click();
  await tick();
  expect(designCheckbox.getAttribute('aria-checked')).toBe('false');
  expect(document.body.textContent).not.toContain('Simulated submission:');
  expect(document.querySelector('.save-state')?.textContent).toContain('Saved');
  [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((node) => node.textContent?.trim() === 'Interact')!
    .click();
  await tick();
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
  input.value = 'Runtime stays separate';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  const checkbox = document.querySelector<HTMLElement>('[data-testid="catalog-checkbox"] button')!;
  expect(checkbox).not.toBeNull();
  checkbox.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await tick();
  checkbox.click();
  await tick();
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent?.trim() === 'Submit preview',
  )!;
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await tick();
  button.click();
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 550));
  await tick();
  expect(document.body.textContent).toContain('Simulated submission: Runtime stays separate');
  expect(document.querySelector('.save-state')?.textContent).toContain('Saved');
  await openStudioMenu('Edit');
  expect(
    document.querySelector('[title="Undo · Ctrl+Z"]')!.getAttribute('aria-disabled'),
  ).toBe('true');
  expect(screenStore(localStorage, source.id).rawLoad()).toMatchObject({
    status: 'loaded',
    document: source,
  });
});
