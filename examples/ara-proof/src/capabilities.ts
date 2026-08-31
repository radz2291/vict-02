import { defineCapability } from '@vict/sdk';
import type { CapabilityDefinition, VictRuntime } from '@vict/sdk';
import {
  AssistantMessageContract,
  PreparedContextContract,
  UserMessageContract,
} from './contracts.js';
import { deterministicAssistant } from './assistant.js';

/**
 * The deterministic ARA capabilities.
 *
 * `ara.user-message`, `ara.prepare-context`, and `ara.assistant-response` are
 * pure. `ara.assistant` is classified `read` (it consults an external
 * assistant), which lets the example demonstrate effect policy: simulation
 * requires a registered test double for that node.
 */
export const userMessageCapability = defineCapability({
  id: 'ara.user-message',
  revision: '1',
  effect: 'pure',
  input: UserMessageContract,
  output: UserMessageContract,
  invoke: async (input) => ({ text: input.text.trim() }),
});

export const prepareContextCapability = defineCapability({
  id: 'ara.prepare-context',
  revision: '1',
  effect: 'pure',
  input: UserMessageContract,
  output: PreparedContextContract,
  invoke: (input) => ({
    text: input.text,
    context: ['conversation: ara-proof', `user-goal: ${input.text}`],
  }),
});

export function createAssistantCapability() {
  return defineCapability({
    id: 'ara.assistant',
    revision: '1',
    effect: 'read',
    input: PreparedContextContract,
    output: AssistantMessageContract,
    invoke: (input) => deterministicAssistant(input),
  });
}

export const assistantResponseCapability = defineCapability({
  id: 'ara.assistant-response',
  revision: '1',
  effect: 'pure',
  input: AssistantMessageContract,
  output: AssistantMessageContract,
  invoke: async (message) => ({ role: message.role, text: message.text }),
});

/** Register all four ARA capabilities on a runtime. */
export function registerAraCapabilities(runtime: VictRuntime): void {
  const capabilities: CapabilityDefinition[] = [
    userMessageCapability,
    prepareContextCapability,
    createAssistantCapability(),
    assistantResponseCapability,
  ];
  for (const capability of capabilities) {
    runtime.registerCapability(capability);
  }
}
