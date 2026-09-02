import type { CapabilityDefinition } from './capability.js';
import type { ApplicationGraphDefinition } from './graph.js';
import type {
  ApplicationDefinition,
  ApplicationRelease,
  ResourceDefinition,
} from './application.js';

/**
 * Authoring helpers.
 *
 * Official factories return DEEP-FROZEN DEEP COPIES: the author's original
 * object can be mutated (or frozen) afterwards without changing captured
 * semantics, and captured semantics can never be changed through the
 * original. Function values (handlers, parsers) are captured by reference
 * and are never cloned.
 */

function frozenCopy<T>(value: T): T {
  if (typeof value === 'function') {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => frozenCopy(item))) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    // Contract-like objects (with a `parse` callable) and already-frozen
    // objects are ATOMIC: captured by reference so shared contract identity
    // is preserved exactly as authored. Frozen contracts from
    // `defineContract`/adapters therefore keep their object identity when a
    // capability definition is captured.
    const candidate = value as Record<string, unknown>;
    if (Object.isFrozen(value) || typeof candidate.parse === 'function') {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = frozenCopy(item);
    }
    return Object.freeze(out) as unknown as T;
  }
  return value;
}

/**
 * Define a capability. Returns a deep-frozen copy of the definition; the
 * author's original object can be mutated afterwards without changing
 * captured semantics.
 */
export function defineCapability<I, O>(
  definition: CapabilityDefinition<I, O>,
): CapabilityDefinition<I, O> {
  return frozenCopy({ ...definition });
}

/**
 * Define an application graph. Returns a deep-frozen copy of the
 * definition.
 */
export function defineGraph(definition: ApplicationGraphDefinition): ApplicationGraphDefinition {
  return frozenCopy(definition);
}

/** Define a storage-neutral resource definition. Returns a deep-frozen copy. */
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
  return frozenCopy(definition);
}

/** Define a framework-neutral application. Returns a deep-frozen copy. */
export function defineApplication(definition: ApplicationDefinition): ApplicationDefinition {
  return frozenCopy(definition);
}

/** Define an application release. Returns a deep-frozen copy. */
export function defineApplicationRelease(definition: ApplicationRelease): ApplicationRelease {
  return frozenCopy(definition);
}
