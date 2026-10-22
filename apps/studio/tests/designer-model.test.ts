import { describe, it, expect } from 'vitest';
import { boundedProviderModel } from '../src/lib/server/designer-model.js';
describe('Studio provider stream boundary', () => {
  it('contains rejected provider calls and raw errored streams with one safe error chunk', async () => {
    for (const doStream of [
      async () => {
        throw new Error('RAW_CREDENTIAL_CANARY');
      },
      async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.error(new Error('RAW_CREDENTIAL_CANARY'));
          },
        }),
      }),
    ]) {
      const model = { doStream };
      const controller = new AbortController();
      const bounded = boundedProviderModel(model, controller.signal, Date.now() + 1000);
      expect(bounded).toBe(model);
      const result = await bounded.doStream();
      const reader = result!.stream.getReader();
      const first = await reader.read();
      expect(first.value).toMatchObject({ type: 'stream-start' });
      const error = await reader.read();
      expect((error.value as { error: Error }).error.message).toBe('STUDIO_AGENT_PROVIDER_FAILED');
      expect((await reader.read()).done).toBe(true);
    }
  });
  it('stops stalled provider promises on deadline and aborts their supplied signal', async () => {
    let observed: AbortSignal | undefined;
    const model = {
      doStream: (options: { abortSignal: AbortSignal }) => {
        observed = options.abortSignal;
        return new Promise<{ stream: ReadableStream<never> }>(() => {});
      },
    };
    const bounded = boundedProviderModel(model, new AbortController().signal, Date.now() + 25);
    const result = await bounded.doStream({} as never);
    const reader = result.stream.getReader();
    expect((await reader.read()).value).toMatchObject({ type: 'stream-start' });
    expect((await reader.read()).value).toMatchObject({ type: 'error' });
    expect((await reader.read()).done).toBe(true);
    expect(observed?.aborted).toBe(true);
  });
  it('Stop terminates a quiet stream immediately and keeps normal chunks ordered', async () => {
    const controller = new AbortController();
    let observed: AbortSignal | undefined;
    const model = {
      doStream: async (options: { abortSignal: AbortSignal }) => {
        observed = options.abortSignal;
        return {
          stream: new ReadableStream({
            start(stream) {
              stream.enqueue({ type: 'text-delta', delta: 'First' });
            },
          }),
        };
      },
    };
    const bounded = boundedProviderModel(model, controller.signal, Date.now() + 10_000);
    const result = await bounded.doStream({} as never);
    const reader = result.stream.getReader();
    expect((await reader.read()).value).toMatchObject({ type: 'text-delta', delta: 'First' });
    controller.abort();
    const start = await reader.read();
    expect(start.value).toMatchObject({ type: 'stream-start' });
    const stopped = await reader.read();
    expect((stopped.value as { error: Error }).error.message).toBe('STUDIO_AGENT_CANCELLED');
    expect((await reader.read()).done).toBe(true);
    expect(observed?.aborted).toBe(true);
  });
});
