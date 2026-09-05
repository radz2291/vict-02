/**
 * The deterministic offline model fixture (MSTR-010, amendment §12.1).
 *
 * A REAL language-model implementation consumed by the REAL pinned Mastra
 * `Agent` — not a fake class that merely resembles Mastra. The fixture
 * implements the AI SDK LanguageModelV2 surface structurally (the same
 * interface the pinned `@mastra/core` model-router consumes) while
 * importing only declared workspace/registry dependencies: the provider
 * wire types are declared locally so the package never relies on an
 * undeclared transitive dependency.
 *
 * Properties:
 * - no network call, no provider credential, no environment variable;
 * - the same scripted prompt input always produces the same response and
 *   the same stream-part ordering;
 * - scripted tool calls are emitted AT MOST ONCE per conversation (the
 *   fixture inspects the prompt for an already-present tool result of the
 *   same name and switches to the post-tool text), so the pinned agent
 *   loop terminates deterministically;
 * - deterministic input produces deterministic output and event ordering,
 *   which the adapter normalizes into deterministic `vict.agent-stream@1`
 *   events;
 * - the fixture records the observed provider/model identity
 *   (`offline-fixture/deterministic-1`) for the run snapshot; that
 *   identity is recorded metadata, never an identity input.
 */

/** One scripted tool call the fixture should request. */
export interface OfflineModelToolCallStep {
  readonly kind: 'tool-call';
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  /** Text produced after the tool result is present in the prompt. */
  readonly thenText: string;
}

/** A scripted plain-text response. */
export interface OfflineModelTextStep {
  readonly kind: 'text';
  readonly text: string;
}

export type OfflineModelStep = OfflineModelTextStep | OfflineModelToolCallStep;

/** A scripted throw: the fixture fails the stream with a canary-bearing error. */
export interface OfflineModelThrowStep {
  readonly kind: 'throw';
  readonly message: string;
}

/** Script keyed by the LAST user message text. */
export type OfflineModelScript = Readonly<Record<string, OfflineModelStep | OfflineModelThrowStep>>;

/** The offline fixture provider/model identity. */
export const OFFLINE_MODEL_PROVIDER = 'offline-fixture';
export const OFFLINE_MODEL_ID = 'deterministic-1';
export const OFFLINE_MODEL_IDENTITY = `${OFFLINE_MODEL_PROVIDER}/${OFFLINE_MODEL_ID}`;

/** Local structural declaration of the LanguageModelV2 prompt message shapes the fixture consumes. */
type FixturePromptMessage =
  | {
      readonly role: 'system';
      readonly content: string;
    }
  | {
      readonly role: 'user';
      readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
    }
  | {
      readonly role: 'assistant';
      readonly content: ReadonlyArray<
        | { readonly type: 'text'; readonly text: string }
        | {
            readonly type: 'tool-call';
            readonly toolCallId: string;
            readonly toolName: string;
            readonly input: unknown;
          }
      >;
    }
  | {
      readonly role: 'tool';
      readonly content: ReadonlyArray<{
        readonly type: 'tool-result';
        readonly toolCallId: string;
        readonly toolName: string;
        readonly output: unknown;
      }>;
    };

/** Local structural declaration of the LanguageModelV2 stream-part shapes the fixture emits. */
export type FixtureStreamPart =
  | { readonly type: 'stream-start'; readonly warnings: readonly [] }
  | {
      readonly type: 'response-metadata';
      readonly id: string;
      readonly modelId: string;
      readonly timestamp: Date;
    }
  | { readonly type: 'text-start'; readonly id: string }
  | { readonly type: 'text-delta'; readonly id: string; readonly delta: string }
  | { readonly type: 'text-end'; readonly id: string }
  | { readonly type: 'tool-input-start'; readonly id: string; readonly toolName: string }
  | { readonly type: 'tool-input-delta'; readonly id: string; readonly delta: string }
  | { readonly type: 'tool-input-end'; readonly id: string }
  | {
      readonly type: 'tool-call';
      readonly toolCallId: string;
      readonly toolName: string;
      readonly input: string;
    }
  | {
      readonly type: 'finish';
      readonly finishReason: 'stop' | 'tool-calls';
      readonly usage: OfflineUsage;
    }
  | { readonly type: 'error'; readonly error: unknown };

interface OfflineUsage {
  readonly inputTokens: {
    readonly total: number;
    readonly noCache: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
  };
  readonly outputTokens: {
    readonly total: number;
    readonly text: number;
    readonly reasoning: number;
  };
}

/** A deterministic offline model compatible with the pinned Mastra version. */
export interface DeterministicOfflineModel {
  readonly specificationVersion: 'v2';
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, never>;
  doGenerate(options: { readonly prompt: readonly FixturePromptMessage[] }): Promise<{
    readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>;
    readonly finishReason: 'stop';
    readonly usage: OfflineUsage;
    readonly warnings: readonly [];
  }>;
  doStream(options: { readonly prompt: readonly FixturePromptMessage[] }): Promise<{
    readonly stream: ReadableStream<FixtureStreamPart>;
  }>;
}

const OFFLINE_USAGE: OfflineUsage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 21, text: 21, reasoning: 0 },
};

/** Extract the last user-message text from the prompt. */
function lastUserText(prompt: readonly FixturePromptMessage[]): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    const message = prompt[index];
    if (message?.role === 'user') {
      const textPart = message.content.find((part) => part.type === 'text');
      if (textPart?.type === 'text') {
        return textPart.text;
      }
    }
  }
  return '';
}

/** Detect whether a tool with the given name already produced a result in the prompt. */
function promptHasToolResult(prompt: readonly FixturePromptMessage[], toolName: string): boolean {
  return prompt.some(
    (message) =>
      message.role === 'tool' &&
      message.content.some((part) => part.type === 'tool-result' && part.toolName === toolName),
  );
}

/**
 * Create a deterministic offline model fixture. `script` maps the LAST
 * user message text to the scripted step. A missing script entry responds
 * with an empty completion (deterministic).
 */
export function createDeterministicOfflineModel(options?: {
  readonly script?: OfflineModelScript;
  readonly throwOnStep?: OfflineModelThrowStep;
}): DeterministicOfflineModel & OfflineModelRecord {
  const script = options?.script ?? {};
  const throwOnStep = options?.throwOnStep;
  let invocations = 0;

  const model: DeterministicOfflineModel & OfflineModelRecord = {
    specificationVersion: 'v2' as const,
    provider: OFFLINE_MODEL_PROVIDER,
    modelId: OFFLINE_MODEL_ID,
    supportedUrls: {} as Record<string, never>,
    providerModelIdentity: OFFLINE_MODEL_IDENTITY,
    invocationCount: () => invocations,
    async doGenerate(callOptions: { readonly prompt: readonly FixturePromptMessage[] }) {
      invocations += 1;
      const step: OfflineModelStep | OfflineModelThrowStep = script[
        lastUserText(callOptions.prompt)
      ] ?? { kind: 'text' as const, text: '' };
      const text =
        step.kind === 'throw' || throwOnStep !== undefined
          ? ''
          : renderStep(step, callOptions.prompt);
      return {
        content: [{ type: 'text' as const, text }],
        finishReason: 'stop' as const,
        usage: OFFLINE_USAGE,
        warnings: [] as const,
      };
    },
    async doStream(callOptions: { readonly prompt: readonly FixturePromptMessage[] }) {
      invocations += 1;
      const step: OfflineModelStep | OfflineModelThrowStep = script[
        lastUserText(callOptions.prompt)
      ] ?? { kind: 'text' as const, text: '' };
      let controller: ReadableStreamDefaultController<FixtureStreamPart> | undefined;
      const stream = new ReadableStream<FixtureStreamPart>({
        start(c) {
          controller = c;
        },
      });
      void enqueueScript(
        controller as ReadableStreamDefaultController<FixtureStreamPart>,
        step,
        callOptions.prompt,
        throwOnStep,
      );
      return { stream };
    },
  };
  return model;
}

/** Recorded fixture metadata for the run snapshot. */
export interface OfflineModelRecord {
  readonly providerModelIdentity: string;
  invocationCount(): number;
}

async function enqueueScript(
  controller: ReadableStreamDefaultController<FixtureStreamPart>,
  step: OfflineModelStep | OfflineModelThrowStep,
  prompt: readonly FixturePromptMessage[],
  throwOnStep: OfflineModelThrowStep | undefined,
): Promise<void> {
  try {
    controller.enqueue({ type: 'stream-start', warnings: [] });
    controller.enqueue({
      type: 'response-metadata',
      id: `offline-${OFFLINE_MODEL_ID}`,
      modelId: OFFLINE_MODEL_ID,
      timestamp: new Date(0),
    });

    if (step.kind === 'throw') {
      // PROVIDER-BOUNDARY SANITIZATION (the compatibility requirement a
      // real Stage 07 provider wrapper must also implement): the pinned
      // Mastra observability persists raw error objects thrown by the
      // model on failed spans, so provider error content must NEVER be
      // carried in the thrown error itself. The deterministic message
      // below is the only content that crosses; the scripted canary stays
      // inside the fixture and must appear on no observable surface.
      controller.enqueue({ type: 'error', error: new Error('VICT_OFFLINE_MODEL_FAILED') });
      controller.close();
      return;
    }
    if (throwOnStep !== undefined) {
      controller.enqueue({ type: 'error', error: new Error('VICT_OFFLINE_MODEL_FAILED') });
      controller.close();
      return;
    }

    if (step.kind === 'tool-call' && !promptHasToolResult(prompt, step.toolName)) {
      const toolCallId = `offline-call-${step.toolName}`;
      controller.enqueue({ type: 'tool-input-start', id: toolCallId, toolName: step.toolName });
      const inputJson = JSON.stringify(step.args);
      controller.enqueue({ type: 'tool-input-delta', id: toolCallId, delta: inputJson });
      controller.enqueue({ type: 'tool-input-end', id: toolCallId });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName: step.toolName,
        input: inputJson,
      });
      controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: OFFLINE_USAGE });
      controller.close();
      return;
    }

    const text = step.kind === 'tool-call' ? step.thenText : step.text;
    controller.enqueue({ type: 'text-start', id: 'offline-text-1' });
    // Split deterministically into two deltas to prove ordering.
    const split = Math.ceil(text.length / 2);
    controller.enqueue({ type: 'text-delta', id: 'offline-text-1', delta: text.slice(0, split) });
    controller.enqueue({ type: 'text-delta', id: 'offline-text-1', delta: text.slice(split) });
    controller.enqueue({ type: 'text-end', id: 'offline-text-1' });
    controller.enqueue({ type: 'finish', finishReason: 'stop', usage: OFFLINE_USAGE });
    controller.close();
  } catch (error) {
    controller.enqueue({ type: 'error', error });
    controller.close();
  }
}

function renderStep(
  step: OfflineModelStep | OfflineModelThrowStep,
  prompt: readonly FixturePromptMessage[],
): string {
  if (step.kind === 'text') {
    return step.text;
  }
  if (step.kind === 'throw') {
    return '';
  }
  return promptHasToolResult(prompt, step.toolName) ? step.thenText : '';
}
