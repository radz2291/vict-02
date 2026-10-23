// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import OrientationHandle from './fixtures/OrientationHandle.svelte';
import SourceOrientation from './fixtures/SourceOrientation.svelte';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
// This regression isolates the documented library boundary. Actual edge geometry
// must additionally be reverified in the production browser after this repair.
vi.mock('@xyflow/svelte', () => ({
  Handle: OrientationHandle,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  useUpdateNodeInternals: () => refresh,
}));
let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (instance) await unmount(instance); instance = undefined; refresh.mockReset(); document.body.innerHTML = ''; });

it('refreshes actual handle internals after each committed orientation change, not selection-only changes', async () => {
  const observed: { id: string; source: string | undefined; target: string | undefined }[] = [];
  refresh.mockImplementation((id: string) => observed.push({ id,
    source: document.querySelector<HTMLElement>('[data-test-handle=source]')?.dataset.testPosition,
    target: document.querySelector<HTMLElement>('[data-test-handle=target]')?.dataset.testPosition,
  }));
  instance = mount(SourceOrientation, { target: document.body });
  await tick(); await tick();
  expect(observed.at(-1)).toEqual({ id: 'orientation-node', source: 'bottom', target: 'top' });
  const change = [...document.querySelectorAll('button')].find(button => button.textContent === 'Change orientation')!;
  change.click(); await tick(); await tick();
  expect(observed.at(-1)).toEqual({ id: 'orientation-node', source: 'right', target: 'left' });
  change.click(); await tick(); await tick();
  expect(observed.at(-1)).toEqual({ id: 'orientation-node', source: 'bottom', target: 'top' });
  expect(refresh).toHaveBeenCalledTimes(3);
  [...document.querySelectorAll('button')].find(button => button.textContent === 'Change selection')!.click();
  await tick(); await tick();
  expect(refresh).toHaveBeenCalledTimes(3);
});
