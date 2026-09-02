import { createRuntime } from '@vict/runtime';
import { registerAraCapabilities } from './capabilities.js';
import { araGraph } from './graph.js';
import type { AssistantMessage } from './contracts.js';

/**
 * Build a fully configured ARA proof runtime: capabilities registered and the
 * graph compiled and activated. Compilation happens here, once - never on the
 * conversational hot path.
 */
export async function createAraRuntime() {
  const runtime = createRuntime();
  registerAraCapabilities(runtime);
  const activation = await runtime.activate(araGraph);
  if (!activation.ok) {
    const detail = activation.issues.map((issue) => issue.message).join('; ');
    throw new Error(`ARA graph failed to activate: ${detail}`);
  }
  return { runtime, activation };
}

/** Run one deterministic ARA turn. */
export async function runAraTurn(text: string) {
  const { runtime, activation } = await createAraRuntime();
  const result = await runtime.run<{ role: 'assistant'; text: string }>({ text });
  return {
    result,
    graphVersion: activation.graphVersion,
    capabilitySetVersion: activation.capabilitySetVersion,
    activationVersion: activation.activationVersion,
  };
}

export type AraRunResult = Awaited<ReturnType<typeof runAraTurn>>['result'];
export type { AssistantMessage };
