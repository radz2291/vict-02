import { beforeEach, expect, test, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { navigationLayout, navigationFrame } from './navigation-layout-state.svelte.js';
import Host from './NavigationLayoutHost.svelte';
const control = vi.hoisted(() => ({ fit: vi.fn() }));
vi.mock('@xyflow/svelte', async () => {
  const { navigationLayout } = await import('./navigation-layout-state.svelte.js');
  return {
    useStore: () => navigationLayout,
    useViewportInitialized: () => ({ current: true }),
    useNodes: () => ({
      current: ['crop', 'grade', 'caption'].map((id) => ({
        id,
        measured: { width: 210, height: 128 },
      })),
    }),
    useSvelteFlow: () => ({ fitView: control.fit }),
  };
});
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};
beforeEach(() => {
  control.fit.mockReset();
  navigationLayout.width = 737;
  navigationLayout.height = 378;
  navigationFrame.scale = 0.321269;
  navigationFrame.expectedWidth = 736.8 * 0.321269;
  navigationFrame.expectedHeight = 378.4 * 0.321269;
});

test('initial fit waits for own engine dimensions then settles once, retaining draft on later ancestor zoom', async () => {
  control.fit.mockResolvedValue(true);
  const settled = vi.fn(),
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, { target, props: { settled } });
  try {
    await settle();
    expect(control.fit).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
    navigationLayout.width = 237;
    navigationLayout.height = 122;
    await settle();
    expect(control.fit).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(control.fit.mock.calls[0][0]).toEqual({
      minZoom: 0.15 * 0.321269,
      maxZoom: 1.1 * 0.321269,
      padding: 0.2,
    });
    const input = target.querySelector('input')!;
    input.focus();
    input.value = 'User draft';
    navigationFrame.scale = 0.5;
    navigationFrame.expectedWidth = 368.4;
    navigationFrame.expectedHeight = 189.2;
    navigationLayout.width = 368;
    navigationLayout.height = 189;
    await settle();
    expect(control.fit).toHaveBeenCalledTimes(1);
    expect(target.querySelector('input')).toBe(input);
    expect(input.value).toBe('User draft');
    expect(document.activeElement).toBe(input);
  } finally {
    await unmount(app);
    target.remove();
  }
});

test('pending old-frame fit cannot settle a new unit frame and retries only after its dimensions arrive', async () => {
  const pending: { resolve: (value: boolean) => void; promise: Promise<boolean> }[] = [];
  control.fit.mockImplementation(() => {
    const item = Promise.withResolvers<boolean>();
    pending.push(item);
    return item.promise;
  });
  navigationLayout.width = 237;
  navigationLayout.height = 122;
  const settled = vi.fn(),
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, { target, props: { settled } });
  try {
    await settle();
    expect(control.fit).toHaveBeenCalledTimes(1);
    navigationFrame.scale = 0.5;
    navigationFrame.expectedWidth = 368.4;
    navigationFrame.expectedHeight = 189.2;
    await settle();
    pending[0].resolve(true);
    await settle();
    expect(settled).not.toHaveBeenCalled();
    expect(control.fit).toHaveBeenCalledTimes(1);
    navigationLayout.width = 368;
    navigationLayout.height = 189;
    await settle();
    expect(control.fit).toHaveBeenCalledTimes(2);
    pending[1].resolve(true);
    await settle();
    expect(settled).toHaveBeenCalledTimes(1);
  } finally {
    await unmount(app);
    target.remove();
  }
});

test('pending public fit resolution cannot settle after host teardown', async () => {
  const pending = Promise.withResolvers<boolean>();
  control.fit.mockReturnValue(pending.promise);
  navigationLayout.width = 237;
  navigationLayout.height = 122;
  const settled = vi.fn(),
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, { target, props: { settled } });
  await settle();
  expect(control.fit).toHaveBeenCalledTimes(1);
  await unmount(app);
  target.remove();
  pending.resolve(true);
  await settle();
  expect(settled).not.toHaveBeenCalled();
});
