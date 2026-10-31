import { describe, it, expect, vi } from 'vitest';
import { boundedProviderModel } from '../src/lib/server/designer-model.js';
describe('Studio provider stream boundary', () => {
  it.each([
    [
      {
        type: 'tool-call',
        toolCallId: 'partial',
        toolName: 'studio_screen_edit',
        input: '{"operations":[',
      },
      'STUDIO_AGENT_INCOMPLETE_TOOL',
    ],
    [{ type: 'finish', finishReason: 'length', usage: {} }, 'STUDIO_AGENT_OUTPUT_LIMIT'],
    [
      { type: 'finish', finishReason: { unified: 'length', raw: 'length' }, usage: {} },
      'STUDIO_AGENT_OUTPUT_LIMIT',
    ],
  ])('fails closed before forwarding an incomplete output (%j)', async (part, code) => {
    const failures: string[] = [];
    const model = {
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue(part);
            controller.close();
          },
        }),
      }),
    };
    boundedProviderModel(model, new AbortController().signal, Date.now() + 1000, (code) =>
      failures.push(code),
    );
    const received: unknown[] = [];
    const reader = (await model.doStream()).stream.getReader();
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      received.push(item.value);
    }
    expect(received).toEqual([
      { type: 'stream-start', warnings: [] },
      { type: 'error', error: expect.objectContaining({ message: code }) },
    ]);
    expect(failures).toEqual([code]);
  });
  it('preserves complete tool calls and normal finish, but rejects an unfinished EOF', async () => {
    for (const finish of [true, false]) {
      const tool = {
        type: 'tool-call',
        toolName: 'studio_screen_read',
        toolCallId: 'read',
        input: '{}',
      };
      const model = {
        doStream: async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue(tool);
              if (finish)
                controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: {} });
              controller.close();
            },
          }),
        }),
      };
      boundedProviderModel(model, new AbortController().signal, Date.now() + 1000);
      const reader = (await model.doStream()).stream.getReader();
      const parts: { type: string }[] = [];
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        parts.push(item.value);
      }
      expect(parts[1]).toEqual(tool);
      expect(parts.at(-1)?.type).toBe(finish ? 'finish' : 'error');
    }
  });
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

it('normal provider calls have no elapsed cutoff and owner cancellation closes an unsettled call', async () => {
  vi.useFakeTimers();
  const abort = new AbortController();
  const model = { doStream: async () => await new Promise<never>(() => {}) };
  let settled = false;
  try {
    boundedProviderModel(model, abort.signal, undefined);
    const response = (await model.doStream()) as unknown as {
      stream: ReadableStream<{ type: string }>;
    };
    const reader = response.stream.getReader();
    const first = reader.read().then((value) => {
      settled = true;
      return value;
    });
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
    expect(settled).toBe(false);
    abort.abort();
    expect((await first).value?.type).toBe('stream-start');
    expect((await reader.read()).value?.type).toBe('error');
    expect((await reader.read()).done).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
it('pulls provider parts only on downstream demand instead of eagerly pumping a queue', async () => {
  let pulls = 0;
  const model = {
    doStream: async () => ({
      stream: new ReadableStream(
        {
          pull(controller) {
            pulls++;
            if (pulls === 1) controller.enqueue({ type: 'stream-start', warnings: [] });
            else if (pulls === 2) controller.enqueue({ type: 'finish', finishReason: 'stop' });
            else controller.close();
          },
        },
        { highWaterMark: 0 },
      ),
    }),
  };
  boundedProviderModel(model, new AbortController().signal, undefined);
  const response = await model.doStream();
  await Promise.resolve();
  expect(pulls).toBe(0);
  const reader = response.stream.getReader();
  expect((await reader.read()).value).toMatchObject({ type: 'stream-start' });
  await Promise.resolve();
  expect(pulls).toBe(1);
  expect((await reader.read()).value).toMatchObject({ type: 'finish' });
  expect((await reader.read()).done).toBe(true);
});
