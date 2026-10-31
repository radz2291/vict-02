import { ModelRouterLanguageModel } from '@mastra/core/llm';
import { classifyProviderLimit } from './provider-limit.js';
import { providerLimitCode, type ProviderLimitEvidence } from '$lib/designer/provider-limit.js';

interface StreamPart {
  readonly type: string;
  readonly error?: unknown;
  readonly warnings?: readonly unknown[];
  readonly input?: string;
  readonly finishReason?: string | { readonly unified?: string; readonly raw?: string };
  readonly usage?: unknown;
}
interface StreamResult {
  readonly stream: ReadableStream<StreamPart>;
}
const dataProperty = (value: unknown, key: string): unknown => {
  if (!value || typeof value !== 'object') return;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return;
  }
};
/** Host model seam, following the existing Quellight deadline composition.
 * The real router/SDK still performs inference. This only contains thrown and
 * rejected provider failures, stalled streams and cancellation. No retry. */
export function boundedProviderModel<T extends object>(
  model: T,
  signal: AbortSignal,
  deadlineAt: number | undefined,
  onFailure?: (code: string, evidence?: ProviderLimitEvidence) => void,
  observe?: (event: { kind: 'request' } | { kind: 'usage'; usage: unknown }) => void,
  providerContext?: { provider?: 'zai' },
): T {
  const source = model as T & { doStream: (options: unknown) => Promise<StreamResult> };
  const original = source.doStream.bind(model);
  const wrap = async (options: unknown): Promise<StreamResult> => {
    const upstreamAbort = new AbortController();
    const callerSignal = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
    const callOptions = {
      ...(options as Record<string, unknown>),
      abortSignal: AbortSignal.any([
        signal,
        upstreamAbort.signal,
        ...(callerSignal ? [callerSignal] : []),
      ]),
    };
    let reader: ReadableStreamDefaultReader<StreamPart> | undefined;
    let closed = false,
      streamStarted = false,
      finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: () => void = () => {};
    let fail: (code?: string, evidence?: ProviderLimitEvidence) => void = () => {};
    const upstream = Promise.resolve().then(() => {
      if (signal.aborted || upstreamAbort.signal.aborted) throw Error('cancelled');
      observe?.({ kind: 'request' });
      return original(callOptions);
    });
    // Attach rejection handling immediately; pull still reports its safe outcome.
    void upstream.catch(() => undefined);
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const providerFailure = (error: unknown) => {
      const evidence = classifyProviderLimit(error, providerContext?.provider);
      fail(evidence ? providerLimitCode(evidence.kind) : 'STUDIO_AGENT_PROVIDER_FAILED', evidence);
    };
    const stream = new ReadableStream<StreamPart>(
      {
        start(controller) {
          fail = (code = 'STUDIO_AGENT_PROVIDER_FAILED', evidence) => {
            if (closed) return;
            closed = true;
            cleanup();
            const expired = deadlineAt !== undefined && Date.now() >= deadlineAt;
            const safeCode = signal.aborted
              ? 'STUDIO_AGENT_CANCELLED'
              : expired
                ? 'STUDIO_AGENT_PROVIDER_FAILED'
                : code;
            onFailure?.(safeCode, ...(evidence && !signal.aborted && !expired ? [evidence] : []));
            upstreamAbort.abort();
            try {
              if (!streamStarted) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                streamStarted = true;
              }
              controller.enqueue({ type: 'error', error: new Error(safeCode) });
              controller.close();
            } catch {
              /* detached consumer */
            }
            void reader?.cancel().catch(() => undefined);
          };
          abort = () => fail();
          signal.addEventListener('abort', abort, { once: true });
          if (deadlineAt !== undefined)
            timer = setTimeout(fail, Math.max(0, deadlineAt - Date.now()));
          if (signal.aborted || (deadlineAt !== undefined && Date.now() >= deadlineAt)) fail();
        },
        async pull(controller) {
          if (closed) return;
          try {
            if (!reader) {
              const result = await upstream;
              if (closed) {
                void result.stream.cancel().catch(() => undefined);
                return;
              }
              reader = result.stream.getReader();
            }
            const next = await reader.read();
            if (closed) return;
            if (next.done) {
              if (!finished) {
                fail();
                return;
              }
              closed = true;
              cleanup();
              controller.close();
              return;
            }
            if (next.value.type === 'error') {
              providerFailure(dataProperty(next.value, 'error'));
              return;
            }
            if (next.value.type === 'tool-call') {
              try {
                JSON.parse(next.value.input!);
              } catch {
                fail('STUDIO_AGENT_INCOMPLETE_TOOL');
                return;
              }
            }
            const reason = dataProperty(next.value, 'finishReason'),
              unified = dataProperty(reason, 'unified');
            if (next.value.type === 'finish' && (reason === 'error' || unified === 'error')) {
              providerFailure(dataProperty(next.value, 'error'));
              return;
            }
            if (next.value.type === 'finish' && (reason === 'length' || unified === 'length')) {
              fail('STUDIO_AGENT_OUTPUT_LIMIT');
              return;
            }
            if (next.value.type === 'finish') {
              finished = true;
              if (next.value.usage !== undefined)
                observe?.({ kind: 'usage', usage: next.value.usage });
            }
            if (next.value.type === 'stream-start') streamStarted = true;
            controller.enqueue(next.value);
          } catch (error) {
            providerFailure(error);
          }
        },
        cancel() {
          closed = true;
          cleanup();
          upstreamAbort.abort();
          void reader?.cancel().catch(() => undefined);
        },
      },
      { highWaterMark: 0 },
    );
    return { stream };
  };
  // Preserve the router instance receiver: proxy/prototype wrappers break its
  // class-private fields. Only doStream is shadowed, as in Quellight's seam.
  Object.defineProperty(model, 'doStream', {
    value: wrap,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return model;
}

export function studioProviderModel(model: string, baseUrl?: string): object {
  return new ModelRouterLanguageModel(
    model.startsWith('zai/')
      ? { id: model as `${string}/${string}`, url: baseUrl, apiKey: process.env['ZAI_API_KEY'] }
      : (model as ConstructorParameters<typeof ModelRouterLanguageModel>[0]),
  );
}
