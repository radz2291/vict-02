import type { AssistantMessage, PreparedContext } from './contracts.js';

/**
 * Deterministic assistant provider. This stands in for a model provider:
 * same input, same output, zero network, zero credentials. The proof is about
 * Vict orchestration, contracts, effects, execution, and trace - not AI quality.
 *
 * A real provider adapter would be optional, isolated outside the kernel, and
 * unused by normal verification.
 */
export function deterministicAssistant(input: PreparedContext): AssistantMessage {
  const topic = input.text.trim().replace(/\s+/g, ' ');
  return {
    role: 'assistant',
    text: `Practical next step for "${topic}": reviewed ${input.context.length} context note(s) - start with the smallest reversible experiment and record what you observe.`,
  };
}
