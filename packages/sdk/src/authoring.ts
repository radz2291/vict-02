import type { ApplicationGraphDefinition } from '@vict/kernel';
import type { CapabilityDefinition } from '@vict/runtime';

/**
 * Authoring helpers. These are typed identity functions: real validation
 * happens when the runtime compiles and activates a graph, so authoring
 * stays fully type-checked and validation stays authoritative.
 */
export function defineCapability<I, O>(
  definition: CapabilityDefinition<I, O>,
): CapabilityDefinition<I, O> {
  return definition;
}

export function defineGraph(definition: ApplicationGraphDefinition): ApplicationGraphDefinition {
  return definition;
}
