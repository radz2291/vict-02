import { defineGraph } from '@vict/sdk';

/**
 * The deterministic ARA conversation flow:
 *
 *   user-message -> prepare-context -> deterministic-assistant -> assistant-response
 */
export const araGraph = defineGraph({
  id: 'ara-proof',
  entry: 'user-message',
  nodes: [
    { id: 'user-message', capability: 'ara.user-message' },
    { id: 'prepare-context', capability: 'ara.prepare-context' },
    { id: 'assistant', capability: 'ara.assistant' },
    { id: 'assistant-response', capability: 'ara.assistant-response' },
  ],
  edges: [
    { from: 'user-message', to: 'prepare-context' },
    { from: 'prepare-context', to: 'assistant' },
    { from: 'assistant', to: 'assistant-response' },
  ],
});
