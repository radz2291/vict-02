import { z } from 'zod';
import { defineContract } from '@vict/sdk';

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
export const UserMessageContract = defineContract<UserMessage>(
  'ara.UserMessage',
  z.object({ text: z.string().min(1) }),
  { description: 'A non-empty user message' },
);

/** The message enriched with deterministic conversation context. */
export const PreparedContextContract = defineContract<PreparedContext>(
  'ara.PreparedContext',
  z.object({ text: z.string().min(1), context: z.array(z.string()) }),
  { description: 'A user message with deterministic context notes attached' },
);

/** The assistant's reply. */
export const AssistantMessageContract = defineContract<AssistantMessage>(
  'ara.AssistantMessage',
  z.object({ role: z.literal('assistant'), text: z.string().min(1) }),
  { description: "An assistant reply tagged with role 'assistant'" },
);
