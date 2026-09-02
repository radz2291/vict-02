import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineCapability,
  defineContract,
  defineGraph,
  defineResource,
  VICT_AUTHORING_COMPAT_VERSION,
  validateCapabilityPack,
  defineCapabilityPack,
} from '@vict/sdk';

/**
 * Stage 04 authoring-ABI surface test.
 *
 * `@vict/sdk` is a lightweight authoring layer BELOW the kernel and runtime:
 * this file imports NOTHING from `@vict/runtime` (enforced structurally by
 * the packed-consumer isolation check) and exercises the stable authoring
 * factories, their immutability guarantees, and the capability-pack
 * validator.
 */
describe('@vict/sdk authoring ABI (Stage 04)', () => {
  it('authors contracts, capabilities and graphs without any runtime import', () => {
    const TextMessage = defineContract<{ text: string }>({
      id: 'smoke.text',
      revision: '1',
      parse: (input) => {
        const text = (input as { text?: unknown } | null)?.text;
        return typeof text === 'string'
          ? { ok: true as const, value: { text } }
          : {
              ok: false as const,
              issues: [{ code: 'invalid_type', path: '(root)', message: 'text required' }],
            };
      },
    });

    const uppercase = defineCapability({
      id: 'smoke.uppercase',
      revision: '2',
      effect: 'pure',
      input: TextMessage,
      output: TextMessage,
      invoke: async (input: { text: string }) => ({ text: input.text.toUpperCase() }),
    });

    const graph = defineGraph({
      id: 'smoke-graph',
      entry: 'upper',
      nodes: [{ id: 'upper', capability: 'smoke.uppercase' }],
      edges: [],
    });
    expect(uppercase.id).toBe('smoke.uppercase');
    expect((graph.nodes[0] as { capability?: string }).capability).toBe('smoke.uppercase');
  });

  it('returns deep-frozen definitions from every official factory', () => {
    const graph = defineGraph({
      id: 'g',
      entry: 'a',
      nodes: [
        {
          id: 'a',
          capability: 'c',
          retry: { maxAttempts: 2, retryOn: ['timeout'], backoff: { kind: 'fixed', delayMs: 5 } },
        },
      ],
      edges: [{ from: 'a', to: 'b' } as never],
    });
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
    expect(Object.isFrozen(graph.nodes[0])).toBe(true);
    expect(Object.isFrozen((graph.nodes[0] as { retry: object }).retry)).toBe(true);
    expect(() => {
      (graph as { id: string }).id = 'mutated';
    }).toThrow();

    const capability = defineCapability({
      id: 'c',
      revision: '1',
      effect: 'pure',
      invoke: () => 'x',
    });
    expect(Object.isFrozen(capability)).toBe(true);

    const resource = defineResource({
      schema: RESOURCE_DEFINITION_SCHEMA,
      id: 'notes',
      revision: '1',
      identity: { key: 'id' },
      fields: [{ name: 'id', type: 'string', required: true }],
    } as const);
    expect(Object.isFrozen(resource)).toBe(true);
    expect(Object.isFrozen(resource.fields)).toBe(true);

    const application = defineApplication({
      schema: APPLICATION_DEFINITION_SCHEMA,
      id: 'app',
      revision: '1',
      routes: [{ id: 'home', path: '/', screenId: 's' }],
      screens: [
        {
          id: 's',
          title: 'Home',
          layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't', content: 'hi' }] }],
        },
      ],
      actions: [],
      resources: [{ resourceId: 'notes', revision: '1' }],
    });
    expect(Object.isFrozen(application)).toBe(true);
    expect(Object.isFrozen(application.routes)).toBe(true);

    // Mutation of the ORIGINAL input after definition must not alter the
    // captured semantics (factories snapshot by value).
    const original = {
      schema: RESOURCE_DEFINITION_SCHEMA,
      id: 'notes',
      revision: '1',
      identity: { key: 'id' },
      fields: [{ name: 'id', type: 'string' as const, required: true }],
    } as const;
    const captured = defineResource(original);
    (original.fields as unknown as { name: string }[])[0]!.name = 'hijacked';
    expect(captured.fields[0]?.name).toBe('id');
  });

  it('validates capability packs: cross-validation, compatibility, closed schemas', () => {
    const Echo = defineContract<{ text?: unknown }>({
      id: 'pack.echo',
      revision: '1',
      parse: (input: unknown) => ({ ok: true as const, value: input as { text?: unknown } }),
    });
    const manifest = {
      schema: 'vict.capability-pack@1' as const,
      id: 'vict.test.pack',
      version: '1.0.0',
      victCompatibility: `^${VICT_AUTHORING_COMPAT_VERSION}`,
      capabilities: [
        {
          id: 'pack.echoCap',
          revision: '1',
          effect: 'pure' as const,
          input: { contractId: 'pack.echo', revision: '1' },
        },
      ],
      contracts: [{ id: 'pack.echo', revision: '1' }],
    };
    const bindings = {
      capabilities: [
        {
          id: 'pack.echoCap',
          revision: '1',
          invoke: () => 'ok',
          input: Echo,
        },
      ],
    };

    const valid = validateCapabilityPack(defineCapabilityPack(manifest, bindings));
    expect(valid.ok).toBe(true);

    // Compatibility mismatch is a structured failure.
    const incompatible = validateCapabilityPack(defineCapabilityPack(manifest, bindings), {
      victVersion: '9.0.0',
    });
    expect(incompatible.ok).toBe(false);
    if (!incompatible.ok) {
      expect(incompatible.issues.map((issue) => issue.code)).toContain('PACK_COMPATIBILITY_UNMET');
    }

    // Unknown manifest fields are rejected with a safe path.
    const unknownField = validateCapabilityPack(
      defineCapabilityPack(
        { ...manifest, capabilities: [manifest.capabilities[0]!], extraField: true } as never,
        bindings,
      ),
    );
    expect(unknownField.ok).toBe(false);
    if (!unknownField.ok) {
      expect(unknownField.issues.some((issue) => issue.code === 'PACK_UNKNOWN_FIELD')).toBe(true);
    }

    // Missing, extra, and revision-mismatched bindings fail deterministically.
    const missing = validateCapabilityPack(defineCapabilityPack(manifest, { capabilities: [] }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.issues.map((issue) => issue.code)).toContain('PACK_MISSING_BINDING');
    }
    const extra = validateCapabilityPack(
      defineCapabilityPack(manifest, {
        capabilities: [...bindings.capabilities, { id: 'ghost', revision: '1', invoke: () => 1 }],
      }),
    );
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.issues.map((issue) => issue.code)).toContain('PACK_EXTRA_BINDING');
    }
    const revisionMismatch = validateCapabilityPack(
      defineCapabilityPack(manifest, {
        capabilities: [{ ...bindings.capabilities[0]!, revision: '2' }],
      }),
    );
    expect(revisionMismatch.ok).toBe(false);
    if (!revisionMismatch.ok) {
      expect(revisionMismatch.issues.map((issue) => issue.code)).toContain(
        'PACK_BINDING_REVISION_MISMATCH',
      );
    }

    // Secret descriptors carry names, never values.
    const secretValue = validateCapabilityPack(
      defineCapabilityPack(
        {
          ...manifest,
          secrets: [{ name: 'token', value: 'hunter2' } as never],
        },
        bindings,
      ),
    );
    expect(secretValue.ok).toBe(false);
    if (!secretValue.ok) {
      expect(secretValue.issues.map((issue) => issue.code)).toContain('PACK_EMBEDDED_SECRET_VALUE');
    }

    // Captured pack is frozen; mutating the original manifest has no effect.
    const mutableManifest = JSON.parse(JSON.stringify(manifest)) as typeof manifest;
    const pack = defineCapabilityPack(mutableManifest, bindings);
    (mutableManifest.capabilities[0]! as { revision: string }).revision = '999';
    expect(pack.manifest.capabilities[0]?.revision).toBe('1');
    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(pack.manifest)).toBe(true);
  });
});
