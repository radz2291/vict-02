import type { ComponentRegistration } from '@victframework/application/renderer';
import SessionPicker from './SessionPicker.svelte';
import SessionConsole from './SessionConsole.svelte';
import OutputLog from './OutputLog.svelte';

/**
 * EAGER registrations of the agent product surfaces for DOM-level tests.
 * The browser keeps the lazy AgentSurface wrapper (see registry.ts); the
 * tests resolve the SAME component ids and revisions statically so they
 * never depend on dynamic-import behaviour under the vitest toolchain.
 */
export const eagerAgentComponents: readonly ComponentRegistration[] = [
  { componentId: 'cmp.session-picker', revision: '1', implementation: SessionPicker },
  { componentId: 'cmp.session-console', revision: '1', implementation: SessionConsole },
  { componentId: 'cmp.output-log', revision: '1', implementation: OutputLog },
];
