import { z } from 'zod';
import { defineZodContract } from '@vict/sdk/zod';

/**
 * The ARA example authors its contracts with the optional Zod adapter
 * (`@vict/sdk/zod`). The base `@vict/sdk` contract API is schema-library
 * neutral; this import is the explicit opt-in to the adapter.
 */

/** The user's message: the minimal ARA input shape. */
export interface UserMessage {
  text: string;
}

/** The message enriched with deterministic conversation context. */
export interface PreparedContext {
  text: string;
  context: string[];
}

/** The assistant's reply. */
export interface AssistantMessage {
  role: 'assistant';
  text: string;
}

/** The user's message: the minimal ARA input. */
export const UserMessageContract = defineZodContract<UserMessage>(
  'ara.UserMessage',
  '1',
  z.object({ text: z.string().min(1) }),
  { description: 'A non-empty user message' },
);

/** The message enriched with deterministic conversation context. */
export const PreparedContextContract = defineZodContract<PreparedContext>(
  'ara.PreparedContext',
  '1',
  z.object({ text: z.string().min(1), context: z.array(z.string()) }),
  { description: 'A user message with deterministic context notes attached' },
);

/** The assistant's reply. */
export const AssistantMessageContract = defineZodContract<AssistantMessage>(
  'ara.AssistantMessage',
  '1',
  z.object({ role: z.literal('assistant'), text: z.string().min(1) }),
  { description: "An assistant reply tagged with role 'assistant'" },
);
