import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@victframework/ui-ai-svelte', () => ({ captureRenderedElement: vi.fn() }));
import { captureDesignerPreview, uploadVisualCapture, type CaptureMetadata } from '../src/lib/designer/visual-observation.js';
const cursor = { documentId: 'visual-client', revision: 'r1', digest: 'fixture', epoch: 'be5d20ea-a11d-49cc-98ef-ef062f089e81' };
const metadata: CaptureMetadata = { cursor, capturedAt: new Date().toISOString(), viewport: { width: 1, height: 1, scrollLeft: 0, scrollTop: 0, devicePixelRatio: 1 }, image: { width: 1, height: 1, sourceWidth: 1, sourceHeight: 1, offsetLeft: 0, offsetTop: 0, cropped: false }, preview: { mode: 'interact', fingerprint: 'a'.repeat(64) } };
afterEach(() => vi.unstubAllGlobals());
it('refuses stale source and hidden Structure before attempting rasterization', async () => {
  expect(await captureDesignerPreview(undefined, cursor, () => ({ cursor: { ...cursor, revision: 'r2' }, mode: 'interact', state: {} }))).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE' });
  expect(await captureDesignerPreview(undefined, cursor, () => ({ cursor, mode: 'design', state: {}, structureOpen: true }))).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_NOT_VISIBLE' });
});
it('routes deterministic image admission refusal to the pending tool as JSON rather than connectivity failure', async () => {
  const transport = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, code: 'STUDIO_CAPTURE_IMAGE_LIMIT' }), { status: 413 })).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', transport);
  await uploadVisualCapture('id', 'nonce', { ok: true, blob: new Blob(['fixture'], { type: 'image/jpeg' }), metadata }, new AbortController().signal);
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[1]![1]).toMatchObject({ headers: { 'content-type': 'application/json', 'x-vict-csrf': 'nonce' }, body: JSON.stringify({ ok: false, code: 'STUDIO_CAPTURE_IMAGE_LIMIT' }) });
});
it('does not retry expired or unauthorized image requests as new observations', async () => {
  const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, code: 'STUDIO_CAPTURE_UNAVAILABLE' }), { status: 404 }));
  vi.stubGlobal('fetch', transport);
  await expect(uploadVisualCapture('expired', 'nonce', { ok: true, blob: new Blob(['fixture']), metadata }, new AbortController().signal)).rejects.toThrow('STUDIO_CAPTURE_UNAVAILABLE');
  expect(transport).toHaveBeenCalledTimes(1);
});
