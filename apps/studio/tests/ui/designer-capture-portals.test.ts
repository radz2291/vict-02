// @vitest-environment happy-dom
import { webcrypto } from 'node:crypto';
import { mount, tick, unmount } from 'svelte';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const rasterize = vi.hoisted(() => vi.fn());
vi.mock('@victframework/ui-ai-svelte', () => ({ captureRenderedElement: rasterize }));
import { DocumentHost } from '@victframework/ui-svelte';
import { compileScreen, newScreen, catalogDescriptors, catalogImplementations } from '../../src/lib/designer/application.js';
import { documentCursor, prepareAgentEdit } from '../../src/lib/designer/agent-edits.js';
import { captureDesignerPreview } from '../../src/lib/designer/visual-observation.js';

// DOM simulation: actual ownership attributes and real CatalogPortal composition,
// with deterministic layout rectangles and a mocked rasterizer (not pixel proof).
const cursor = { documentId: 'portal-fixture', revision: 'r1', digest: 'fixture', epoch: 'be5d20ea-a11d-49cc-98ef-ef062f089e81' };
const image = () => ({ blob: new Blob(['simulated image'], { type: 'image/jpeg' }), width: 500, height: 300, sourceWidth: 500, sourceHeight: 300, offsetLeft: 0, offsetTop: 0, cropped: false });
const state = () => ({ cursor, mode: 'interact' as const, state: {} });
let instance: ReturnType<typeof mount> | undefined;
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  const rect = new DOMRect(0, 0, 500, 300);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
  rasterize.mockReset().mockImplementation(async () => image());
});
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function frame() {
  const result = document.createElement('div');
  result.innerHTML = '<div class="uv-shared-plan" data-ui-owner-root="preview-a"><input data-ui-owner="preview-a" data-ui-occ="input" value="Start" /><button data-ui-owner="preview-a" data-ui-occ="popover" data-ui-part="trigger" aria-expanded="false">Preview popup</button></div>';
  document.body.append(result); return result;
}
function portal(owner = 'preview-a') {
  const wrapper = document.createElement('div'); wrapper.className = 'uv-shared-plan'; wrapper.style.cssText = 'display:contents;--vict-catalog-layer:100';
  const content = document.createElement('div'); content.dataset.uiOwner = owner; content.dataset.uiPart = 'content'; content.textContent = 'Portalled content';
  wrapper.append(content); document.body.append(wrapper); return wrapper;
}
it('refuses a visible preview-owned external portal before image capture', async () => {
  const target = frame(); portal();
  const result = await captureDesignerPreview(target, cursor, state);
  expect(result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED' });
  expect(rasterize).not.toHaveBeenCalled();
  expect(result).not.toHaveProperty('blob'); expect(result).not.toHaveProperty('metadata');
});
it('ignores unrelated Chat/Inspector ownership even with the same document style class, and ignores hidden preview portals', async () => {
  const target = frame(); portal('inspector-other-owner');
  const hidden = portal(); hidden.style.display = 'none';
  expect(await captureDesignerPreview(target, cursor, state)).toMatchObject({ ok: true });
  expect(rasterize).toHaveBeenCalledTimes(1);
});
it('refuses a preview portal that opens while rasterization awaits', async () => {
  const target = frame(); rasterize.mockImplementation(async () => { portal(); return image(); });
  expect(await captureDesignerPreview(target, cursor, state)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED' });
});
it('fences a portal opening and closing during capture even when final source and DOM state match', async () => {
  const target = frame(); rasterize.mockImplementation(async () => { const opened = portal(); opened.remove(); return image(); });
  expect(await captureDesignerPreview(target, cursor, state)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE' });
});
it('fences unbound native state changes and includes internal expanded state in the preview fingerprint', async () => {
  const target = frame();
  const closed = await captureDesignerPreview(target, cursor, state); expect(closed.ok).toBe(true);
  target.querySelector('button')!.setAttribute('aria-expanded', 'true');
  const expanded = await captureDesignerPreview(target, cursor, state); expect(expanded.ok).toBe(true);
  if (closed.ok && expanded.ok) expect(expanded.metadata.preview.fingerprint).not.toBe(closed.metadata.preview.fingerprint);
  rasterize.mockImplementation(async () => { target.querySelector('input')!.value = 'Changed without source mutation'; return image(); });
  expect(await captureDesignerPreview(target, cursor, state)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE' });
});
it('fingerprints internally rendered descendants without their own ownership attribute', async () => {
  const target = frame();
  const thumb = document.createElement('span'); thumb.setAttribute('role', 'slider'); thumb.setAttribute('aria-valuenow', '10'); target.querySelector('[data-ui-owner-root]')!.append(thumb);
  const before = await captureDesignerPreview(target, cursor, state); expect(before.ok).toBe(true);
  thumb.setAttribute('aria-valuenow', '20'); thumb.style.transform = 'translateX(20px)';
  const after = await captureDesignerPreview(target, cursor, state); expect(after.ok).toBe(true);
  if (before.ok && after.ok) expect(after.metadata.preview.fingerprint).not.toBe(before.metadata.preview.fingerprint);
});
it('detects the real CatalogPortal created by an unbound catalog Popover under document.body', async () => {
  const source = newScreen('Portal capture', 'portal-fixture');
  const prepared = prepareAgentEdit(source, documentCursor(source, 'r1', cursor.epoch), { expectedRevision: 'r1', reason: 'Portal fixture', operations: [{ op: 'add', recipe: 'popover', nodeId: 'popup', parentId: 'screen', props: { label: 'Open preview popup' } }] }, 'portal-fixture');
  expect(prepared.ok).toBe(true); if (!prepared.ok) throw Error(prepared.message);
  const compiled = compileScreen(prepared.document); expect(compiled.ok).toBe(true); if (!compiled.ok) throw Error('compile');
  const target = document.createElement('div'); document.body.append(target);
  instance = mount(DocumentHost, { target, props: { plan: Object.values(compiled.plan.documentPlans ?? {})[0]!, localState: prepared.document.localState, extensionDescriptors: catalogDescriptors, extensionImplementations: catalogImplementations, dispatch: async () => ({ ok: true }), navigate: () => {} } });
  await tick();
  const trigger = target.querySelector<HTMLButtonElement>('[data-ui-part="trigger"]')!; expect(trigger).not.toBeNull();
  const owner = target.querySelector<HTMLElement>('[data-ui-owner-root]')!.dataset.uiOwnerRoot!;
  trigger.click(); await tick();
  await vi.waitFor(() => expect(Array.from(document.querySelectorAll('[data-ui-owner]')).some(node => node.getAttribute('data-ui-owner') === owner && !target.contains(node))).toBe(true));
  expect(await captureDesignerPreview(target, cursor, state)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED' });
  expect(rasterize).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click(); await tick();
  await vi.waitFor(() => expect(Array.from(document.querySelectorAll('[data-ui-owner]')).some(node => node.getAttribute('data-ui-owner') === owner && !target.contains(node))).toBe(false));
  expect(await captureDesignerPreview(target, cursor, state)).toMatchObject({ ok: true });
  expect(rasterize).toHaveBeenCalledTimes(1);
});
