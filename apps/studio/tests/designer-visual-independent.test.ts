import { expect, it } from 'vitest';
import type { CapabilityContext } from '@victframework/sdk';
import { acceptVisualCapture, createVisualObserver } from '../src/lib/server/designer-visual.js';

it('independent challenge: post-inference validation rejects changed image bytes even when source and DOM metadata match', async () => {
  // Synthetic JPEG-header fixtures exercise the server/model seam only. They
  // are not evidence of actual rasterization or provider image understanding.
  const first = new Uint8Array([0xff,0xd8,0xff,0xc0,0,11,8,0,1,0,1,1,1,0x11,0,0xff,0xd9]);
  const second = new Uint8Array(first); second[13] = 0x12;
  const cursor = { documentId: 'independent-image-bytes', revision: 'r1', digest: 'fixture', epoch: 'be5d20ea-a11d-49cc-98ef-ef062f089e81' };
  let captures = 0;
  let modelCalls = 0;
  const observer = createVisualObserver({ owner: 'independent-image-owner', runId: 'independent', model: 'zai/glm-5.3-flash',
    getCursor: () => cursor, signal: new AbortController().signal,
    emit: event => {
      const metadata = { cursor, capturedAt: new Date().toISOString(), viewport: { width: 1, height: 1, scrollLeft: 0, scrollTop: 0, devicePixelRatio: 1 }, image: { width: 1, height: 1, sourceWidth: 1, sourceHeight: 1, offsetLeft: 0, offsetTop: 0, cropped: false }, preview: { mode: 'design', fingerprint: 'a'.repeat(64) } };
      expect(acceptVisualCapture('independent-image-owner', event.captureId, metadata, ++captures === 1 ? first : second)).toEqual({ ok: true });
    },
    modelFactory: () => ({ doStream: async () => {
      modelCalls++;
      return { stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'text-delta', delta: 'Observation of the first captured image.' });
        controller.enqueue({ type: 'finish' }); controller.close();
      } }) };
    } }),
  });
  try {
    const result = await observer.capability.invoke({ focus: 'Appearance' }, {} as CapabilityContext);
    expect(captures).toBe(2); expect(modelCalls).toBe(1);
    expect(result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE' });
    expect(result).not.toHaveProperty('observation');
  } finally { observer.dispose(); }
});
