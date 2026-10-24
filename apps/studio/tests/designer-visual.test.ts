import { describe, it, expect } from 'vitest';
import { createVisualObserver, acceptVisualCapture, refuseVisualCapture, jpegDimensions, visualModelSupport } from '../src/lib/server/designer-visual.js';
import type { CaptureRequestEvent } from '../src/lib/server/designer-visual.js';
import type { CapabilityContext } from '@victframework/sdk';
import { POST } from '../src/routes/api/designer-agent/capture/[captureId]/+server.js';

// Synthetic JPEG-header fixture: exercises binary admission and the model seam,
// NOT browser rasterization or a real provider's image understanding.
const bytes = new Uint8Array([0xff,0xd8,0xff,0xc0,0,11,8,0,1,0,1,1,1,0x11,0,0xff,0xd9]);
const cursor = { documentId: 'screen-visual', revision: 'r1', digest: 'v1_fixture', epoch: 'be5d20ea-a11d-49cc-98ef-ef062f089e81' };
const metadata = () => ({ cursor, capturedAt: new Date().toISOString(), viewport: { width: 1, height: 1, scrollLeft: 0, scrollTop: 0, devicePixelRatio: 1 }, image: { width: 1, height: 1, sourceWidth: 1, sourceHeight: 1, offsetLeft: 0, offsetTop: 0, cropped: false }, preview: { mode: 'design', fingerprint: 'a'.repeat(64) } });
const context = {} as CapabilityContext;

describe('bounded visual observation boundary', () => {
  it('recognizes the exact documented flash model without treating plain GLM as vision', () => {
    expect(visualModelSupport('zai/glm-5.3-flash').supported).toBe(true);
    expect(visualModelSupport('zai/glm-5.3').supported).toBe(false);
    expect(visualModelSupport('zai/glm-5.3-flash-other').supported).toBe(false);
    expect(jpegDimensions(bytes)).toEqual({ width: 1, height: 1 });
    expect(jpegDimensions(new Uint8Array([1,2,3]))).toBeUndefined();
  });
  it('returns an explicit configuration choice for unknown models without capture or silent fallback', async () => {
    let emitted = false;
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3', getCursor: () => cursor, signal: new AbortController().signal, emit: () => { emitted = true; } });
    expect(await observer.capability.invoke({ focus: 'Appearance' }, context)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_MODEL_UNSUPPORTED', message: expect.stringContaining('STUDIO_AGENT_MODEL=zai/glm-5.3-flash') });
    expect(emitted).toBe(false);
    observer.dispose();
  });
  it('returns a preview-portal refusal with no appearance observation or image inference', async () => {
    let request!: CaptureRequestEvent;
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => cursor, signal: new AbortController().signal, emit: event => { request = event; } });
    const result = observer.capability.invoke({ focus: 'Inspect open popup' }, context);
    expect(refuseVisualCapture('session-a', request.captureId, 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED')).toBe(true);
    expect(await result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED', message: expect.stringContaining('No image or overlay observation was made') });
    expect(await result).not.toHaveProperty('observation');
    observer.dispose();
  });
  it('passes image bytes to the selected model while returning only bounded observation/provenance', async () => {
    let request!: CaptureRequestEvent; let modelPrompt: unknown; let captures = 0; let confirm!: (event: CaptureRequestEvent) => void;
    const confirmation = new Promise<CaptureRequestEvent>(resolve => { confirm = resolve; });
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => cursor, signal: new AbortController().signal, emit: event => { request = event; if (++captures === 2) confirm(event); }, modelFactory: () => ({ doStream: async (options: unknown) => { modelPrompt = options; return { stream: new ReadableStream({ start(controller) { controller.enqueue({ type: 'text-delta', delta: 'Observed a white square. Interactions are untested.' }); controller.enqueue({ type: 'finish' }); controller.close(); } }) }; } }) });
    const result = Promise.resolve(observer.capability.invoke({ focus: 'Appearance' }, context));
    const firstCaptureId = request.captureId;
    expect(acceptVisualCapture('other-session', request.captureId, metadata(), bytes)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_UNAVAILABLE' });
    const response = await POST({ request: new Request(`http://localhost/api/designer-agent/capture/${request.captureId}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-vict-csrf': 'nonce', 'x-vict-capture': encodeURIComponent(JSON.stringify(metadata())) }, body: bytes }), params: { captureId: request.captureId }, locals: { session: { sessionId: 'session-a', csrfToken: 'nonce', actorLabel: 'operator' } } } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(acceptVisualCapture('session-a', firstCaptureId, metadata(), bytes)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_UNAVAILABLE' });
    const current = await confirmation;
    expect(acceptVisualCapture('session-a', current.captureId, metadata(), bytes)).toEqual({ ok: true });
    const observed = await result as { imageDigest: string; confirmedImageDigest: string };
    expect(observed).toMatchObject({ ok: true, evidence: 'observed-appearance', interactionVerified: false, simulatedModel: true, model: 'zai/glm-5.3-flash', validation: 'same-source-preview-viewport-and-image-bytes-after-inference', imageComparison: 'sha256-identical' });
    expect(observed.imageDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(observed.confirmedImageDigest).toBe(observed.imageDigest);
    expect(captures).toBe(2);
    expect((modelPrompt as { prompt: { content: unknown }[] }).prompt[1]!.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'file', mediaType: 'image/jpeg', data: bytes })]));
    expect(JSON.stringify(await result)).not.toContain('base64');
    observer.dispose();
  });
  it('refuses changed JPEG bytes with identical metadata after inference and does not call the model twice', async () => {
    let captures = 0; let modelCalls = 0;
    const identicalMetadata = metadata();
    const changedBytes = new Uint8Array(bytes); changedBytes[14] = 1;
    expect(jpegDimensions(changedBytes)).toEqual(jpegDimensions(bytes));
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => cursor, signal: new AbortController().signal,
      emit: event => { captures++; expect(acceptVisualCapture('session-a', event.captureId, identicalMetadata, captures === 1 ? bytes : changedBytes)).toEqual({ ok: true }); },
      modelFactory: () => ({ doStream: async () => { modelCalls++; return { stream: new ReadableStream({ start(controller) { controller.enqueue({ type: 'text-delta', delta: 'Old pixels from the first image.' }); controller.enqueue({ type: 'finish' }); controller.close(); } }) }; } }),
    });
    const result = await observer.capability.invoke({ focus: 'Current pixels' }, context);
    expect(result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE', message: expect.stringContaining('rendered image bytes changed') });
    expect(result).not.toHaveProperty('observation');
    expect(captures).toBe(2); expect(modelCalls).toBe(1); observer.dispose();
  });
  it('accepts identical pixels across separate source revisions while labeling equality as within each observation only', async () => {
    let current = { ...cursor }; let fingerprint = 'a'.repeat(64); let captures = 0; let modelCalls = 0;
    const observer = createVisualObserver({ owner: 'separate-observations', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => current, signal: new AbortController().signal,
      emit: event => { captures++; const image = { ...metadata(), cursor: { ...current }, preview: { mode: 'design', fingerprint } }; expect(acceptVisualCapture('separate-observations', event.captureId, image, bytes)).toEqual({ ok: true }); },
      modelFactory: () => ({ doStream: async () => { modelCalls++; return { stream: new ReadableStream({ start(controller) { controller.enqueue({ type: 'text-delta', delta: 'The visible fixture has no pixel change. Interactions are untested.' }); controller.enqueue({ type: 'finish' }); controller.close(); } }) }; } }),
    });
    const first = await observer.capability.invoke({ focus: 'Initial appearance' }, context) as { ok: boolean; imageDigest: string; metadata: { cursor: { revision: string }; preview: { fingerprint: string } } };
    // A wrapper style or offscreen edit can change source/fingerprint without
    // changing the imaged pixels. Each observation still has its own fences.
    current = { ...current, revision: 'r2', digest: 'v1_nonvisual-change' }; fingerprint = 'b'.repeat(64);
    const second = await observer.capability.invoke({ focus: 'Appearance after source edit' }, context) as typeof first;
    expect(first).toMatchObject({ ok: true, imageComparison: 'sha256-identical', imageComparisonScope: 'within-this-observation-before-and-after-inference', metadata: { cursor: { revision: 'r1' } } });
    expect(second).toMatchObject({ ok: true, imageComparison: 'sha256-identical', imageComparisonScope: 'within-this-observation-before-and-after-inference', metadata: { cursor: { revision: 'r2' } }, fingerprintMeaning: expect.stringContaining('not a pixel digest'), limitation: expect.stringContaining('do not prove stale capture') });
    expect(second.imageDigest).toBe(first.imageDigest);
    expect(second.metadata.preview.fingerprint).not.toBe(first.metadata.preview.fingerprint);
    expect(captures).toBe(4); expect(modelCalls).toBe(2); observer.dispose();
  });
  it.each(['runtime', 'viewport', 'portal'] as const)('refuses %s changes during inference with a second capture and only one model call', async change => {
    let captures = 0; let modelCalls = 0;
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => cursor, signal: new AbortController().signal,
      emit: event => {
        captures++;
        if (captures === 2 && change === 'portal') { refuseVisualCapture('session-a', event.captureId, 'STUDIO_CAPTURE_PORTAL_UNSUPPORTED'); return; }
        const capture = metadata();
        if (captures === 2 && change === 'runtime') capture.preview.fingerprint = 'b'.repeat(64);
        if (captures === 2 && change === 'viewport') capture.viewport.scrollTop = 20;
        acceptVisualCapture('session-a', event.captureId, capture, bytes);
      },
      modelFactory: () => ({ doStream: async () => { modelCalls++; return { stream: new ReadableStream({ start(controller) { controller.enqueue({ type: 'text-delta', delta: 'Appearance from the first image.' }); controller.enqueue({ type: 'finish' }); controller.close(); } }) }; } }),
    });
    const result = await observer.capability.invoke({ focus: 'Appearance' }, context);
    expect(result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE' });
    expect(result).not.toHaveProperty('observation');
    expect(captures).toBe(2); expect(modelCalls).toBe(1); observer.dispose();
  });
  it('rejects stale cursor and oversized images, then receives a truthful browser refusal', async () => {
    let request!: CaptureRequestEvent;
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => cursor, signal: new AbortController().signal, emit: event => { request = event; } });
    const result = observer.capability.invoke({ focus: 'Appearance' }, context);
    expect(acceptVisualCapture('session-a', request.captureId, { ...metadata(), cursor: { ...cursor, revision: 'r2' } }, bytes)).toMatchObject({ code: 'STUDIO_CAPTURE_STALE' });
    expect(acceptVisualCapture('session-a', request.captureId, metadata(), new Uint8Array(524_289))).toMatchObject({ code: 'STUDIO_CAPTURE_INVALID' });
    expect(refuseVisualCapture('session-a', request.captureId, 'STUDIO_CAPTURE_NOT_VISIBLE')).toBe(true);
    expect(await result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_NOT_VISIBLE' });
    observer.dispose();
  });
  it('fences source changes during inference, and Stop releases pending capture without a provider call', async () => {
    let current = { ...cursor }; let request!: CaptureRequestEvent;
    const controller = new AbortController();
    const observer = createVisualObserver({ owner: 'session-a', runId: 'run', model: 'zai/glm-5.3-flash', getCursor: () => current, signal: controller.signal, emit: event => { request = event; }, modelFactory: () => ({ doStream: async () => { current = { ...current, revision: 'r2' }; return { stream: new ReadableStream({ start(stream) { stream.enqueue({ type: 'text-delta', delta: 'Old image' }); stream.enqueue({ type: 'finish' }); stream.close(); } }) }; } }) });
    const result = observer.capability.invoke({ focus: 'Appearance' }, context);
    acceptVisualCapture('session-a', request.captureId, metadata(), bytes);
    expect(await result).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_STALE' });
    current = { ...cursor };
    const stopped = observer.capability.invoke({ focus: 'Appearance' }, context);
    controller.abort();
    expect(await stopped).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_CANCELLED' });
    expect(acceptVisualCapture('session-a', request.captureId, metadata(), bytes)).toMatchObject({ ok: false, code: 'STUDIO_CAPTURE_UNAVAILABLE' });
    observer.dispose();
  });
  it('applies authentication, CSRF and binary streaming admission at the actual capture route', async () => {
    const call = (body: BodyInit, headers: Record<string, string>, authenticated = true) => POST({
      request: new Request('http://localhost/api/designer-agent/capture/missing', { method: 'POST', headers, body }),
      params: { captureId: 'missing' },
      locals: { session: authenticated ? { sessionId: 'session-a', csrfToken: 'nonce', actorLabel: 'operator' } : null },
    } as never);
    expect((await call(bytes, { 'content-type': 'image/jpeg' }, false)).status).toBe(401);
    expect((await call(bytes, { 'content-type': 'image/jpeg' })).status).toBe(403);
    expect((await call('text', { 'content-type': 'text/plain', 'x-vict-csrf': 'nonce' })).status).toBe(415);
    expect((await call(new Uint8Array(524_289), { 'content-type': 'image/jpeg', 'x-vict-csrf': 'nonce' })).status).toBe(413);
    const refused = await call(bytes, { 'content-type': 'image/jpeg', 'x-vict-csrf': 'nonce', 'x-vict-capture': encodeURIComponent(JSON.stringify(metadata())) });
    expect(refused.status).toBe(404);
    expect(await refused.json()).toMatchObject({ code: 'STUDIO_CAPTURE_UNAVAILABLE' });
  });
});
