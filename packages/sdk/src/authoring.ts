import type { CapabilityDefinition } from './capability.js';
import type { ApplicationGraphDefinition } from './graph.js';
import type {
  ApplicationDefinition,
  ApplicationRelease,
  ResourceDefinition,
} from './application.js';
import { isOfficialContract } from '@vict/contracts';

/**
 * Authoring helpers.
 *
 * Official factories return DEEP-FROZEN DEEP COPIES: the author's original
 * object can be mutated (or frozen) afterwards without changing captured
 * semantics, and captured semantics can never be changed through the
 * original. Function values (handlers, parsers) are captured by reference
 * and are never cloned.
 *
 * Capture rules (Stage 04 audit remediation):
 * - ONLY officially branded frozen contract objects (created through
 *   `defineContract` / `defineZodContract`) preserve object identity. A
 *   shallow-frozen root, a frozen intermediate with mutable descendants, or
 *   an arbitrary object that merely carries a `parse` method is always
 *   deep-copied — a frozen shell can never alias live descendants into the
 *   captured definition.
 * - Cyclic structures and unsupported exotic values (Map, Set, Date, and
 *   other non-plain prototypes) fail with a structured
 *   `VictAuthoringError` instead of being silently coerced.
 * - Getters and proxies that throw during capture are converted into the
 *   same structured diagnostic; hostile input never escapes as a raw
 *   TypeError.
 */

/** Structured authoring-capture diagnostics. */
export type AuthoringErrorCode =
  | 'VICT_AUTHORING_UNSUPPORTED_VALUE'
  | 'VICT_AUTHORING_CYCLIC_STRUCTURE'
  | 'VICT_AUTHORING_HOSTILE_INPUT';

export class VictAuthoringError extends Error {
  readonly code: AuthoringErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AuthoringErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VictAuthoringError';
    this.code = code;
    this.details = details;
  }
}

const MAX_CAPTURE_DEPTH = 64;

class Capture {
  readonly #seen = new Set<object>();

  copy<T>(value: T, depth: number): T {
    if (depth > MAX_CAPTURE_DEPTH) {
      throw new VictAuthoringError(
        'VICT_AUTHORING_CYCLIC_STRUCTURE',
        'The definition is too deep to capture safely; nesting beyond 64 levels is rejected structurally.',
      );
    }
    if (typeof value === 'function') {
      return value; // handlers/parsers are captured by reference, as documented
    }
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'symbol' || typeof value === 'bigint') {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `Definitions capture canonical serializable data only; a ${typeof value} value is not capturable.`,
        );
      }
      return value;
    }
    // ONLY officially branded frozen contracts keep their object identity.
    if (isOfficialContract(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      if (this.#seen.has(value)) {
        throw new VictAuthoringError(
          'VICT_AUTHORING_CYCLIC_STRUCTURE',
          'The definition contains a cyclic structure; cycles cannot be captured.',
        );
      }
      this.#seen.add(value);
      const out: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        out.push(this.copy(value[index], depth + 1));
      }
      return Object.freeze(out) as unknown as T;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new VictAuthoringError(
        'VICT_AUTHORING_UNSUPPORTED_VALUE',
        'Definitions capture plain objects and arrays only; unsupported exotic objects are rejected structurally.',
      );
    }
    if (this.#seen.has(value)) {
      throw new VictAuthoringError(
        'VICT_AUTHORING_CYCLIC_STRUCTURE',
        'The definition contains a cyclic structure; cycles cannot be captured.',
      );
    }
    this.#seen.add(value);
    try {
      const out: Record<string, unknown> = {};
      let entries: [string, unknown][];
      try {
        entries = Object.entries(value as Record<string, unknown>);
      } catch {
        throw new VictAuthoringError(
          'VICT_AUTHORING_HOSTILE_INPUT',
          'The definition could not be captured: enumerating its fields threw (hostile getter or proxy).',
        );
      }
      for (const [key, item] of entries) {
        let copied: unknown;
        try {
          copied = this.copy(item, depth + 1);
        } catch (error) {
          if (error instanceof VictAuthoringError) {
            throw error;
          }
          throw new VictAuthoringError(
            'VICT_AUTHORING_HOSTILE_INPUT',
            `The definition could not be captured: reading field '${key}' threw (hostile getter or proxy).`,
          );
        }
        out[key] = copied;
      }
      return Object.freeze(out) as unknown as T;
    } finally {
      // Shared (DAG) references are legal: only true cycles reject.
      this.#seen.delete(value);
    }
  }
}

/**
 * Deep-copy and deep-freeze a definition value for capture. Frozen shells
 * are NOT atomic: every descendant is copied so later mutation of any
 * live object can never reach the captured semantics.
 */
export function frozenCapture<T>(value: T): T {
  return new Capture().copy(value, 0);
}

/**
 * Define a capability. Returns a deep-frozen copy of the definition; the
 * author's original object can be mutated afterwards (including frozen
 * intermediates and shallow-frozen roots) without changing captured
 * semantics. Official frozen contracts keep their object identity.
 */
export function defineCapability<I, O>(
  definition: CapabilityDefinition<I, O>,
): CapabilityDefinition<I, O> {
  // frozenCapture deep-copies the root itself, so hostile getters and
  // proxies are handled by the capture (structured diagnostics) instead of
  // escaping as raw TypeErrors from a spread.
  return frozenCapture(definition);
}

/** Define an application graph. Returns a deep-frozen copy of the definition. */
export function defineGraph(definition: ApplicationGraphDefinition): ApplicationGraphDefinition {
  return frozenCapture(definition);
}

/** Define a storage-neutral resource definition. Returns a deep-frozen copy. */
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
  return frozenCapture(definition);
}

/** Define a framework-neutral application. Returns a deep-frozen copy. */
export function defineApplication(definition: ApplicationDefinition): ApplicationDefinition {
  return frozenCapture(definition);
}

/** Define an application release. Returns a deep-frozen copy. */
export function defineApplicationRelease(definition: ApplicationRelease): ApplicationRelease {
  return frozenCapture(definition);
}
