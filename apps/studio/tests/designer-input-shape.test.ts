import { describe, expect, it, vi } from 'vitest';
import { studioInputShape } from '../src/lib/server/designer-input-shape.js';
import { studioValidationRejection } from '../src/lib/server/designer-validation-feedback.js';
import { agentReadSchema } from '../src/lib/designer/agent-reads.js';

const issues = (paths: readonly (readonly (string | number)[])[]) =>
  paths.map((path) => ({ path, rule: 'invalid_type' as const }));
const canary = 'private-value-must-never-appear';

describe('value-free actual input shape receipts', () => {
  it('distinguishes wrong JSON types without parsing strings, values or lengths', () => {
    const input = {
      components: `[{"id":"${canary}"}]`,
      includeExamples: 'false',
      offset: '0',
      expectedBodyIdentities: `{"${canary}":"${canary}"}`,
    };
    const parsed = agentReadSchema.safeParse({ section: 'contracts', ...input });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw Error('Expected structural refusal');
    const rejection = studioValidationRejection('studio.screen.read', parsed.error.issues);
    const result = studioInputShape(input, rejection.issues);
    expect(result).toEqual({
      schema: 'studio.tool-input-shape@1',
      rootType: 'object',
      fields: ['offset', 'components', 'includeExamples', 'expectedBodyIdentities'].map((key) => ({
        path: [key],
        observedType: 'string',
      })),
    });
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(input.components).toContain(canary);
  });

  it('reports arrays, objects, booleans and numbers without retaining their contents', () => {
    const result = studioInputShape(
      {
        components: [{ id: canary }],
        includeExamples: false,
        offset: 0,
        expectedBodyIdentities: { secret: canary },
      },
      issues([['components'], ['includeExamples'], ['offset'], ['expectedBodyIdentities']]),
    );
    expect(result.fields.map((field) => field.observedType)).toEqual([
      'array',
      'boolean',
      'number',
      'object',
    ]);
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('distinguishes null, own undefined and missing data without inherited reads', () => {
    const input = Object.create(null) as Record<string, unknown>;
    input.components = null;
    input.offset = undefined;
    expect(
      studioInputShape(input, issues([['components'], ['offset'], ['includeExamples']])).fields,
    ).toEqual([
      { path: ['components'], observedType: 'null' },
      { path: ['offset'], observedType: 'undefined' },
      { path: ['includeExamples'], observedType: 'missing' },
    ]);
    expect(studioInputShape(null, []).rootType).toBe('null');
    expect(studioInputShape(undefined, []).rootType).toBe('undefined');
  });

  it('never executes accessors, toJSON, iterators or proxy traps', () => {
    const getter = vi.fn(() => canary),
      toJSON = vi.fn(() => canary),
      iterator = vi.fn(() => {
        throw Error(canary);
      });
    const input = { toJSON, [Symbol.iterator]: iterator };
    Object.defineProperty(input, 'components', { get: getter, enumerable: true });
    const result = studioInputShape(input, issues([['components']]));
    expect(result.fields[0]?.observedType).toBe('uninspectable');
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    expect(iterator).not.toHaveBeenCalled();
    const trap = vi.fn(() => {
      throw Error(canary);
    });
    const proxy = new Proxy(
      {},
      { get: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap, ownKeys: trap },
    );
    expect(studioInputShape(proxy, issues([['components']]))).toMatchObject({
      rootType: 'uninspectable',
      fields: [{ observedType: 'uninspectable' }],
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(studioInputShape(revoked.proxy, []).rootType).toBe('uninspectable');
    expect(trap).not.toHaveBeenCalled();
  });

  it('rejects inherited, hidden and exotic containers rather than accessing them', () => {
    const inherited = Object.create({ components: [canary] });
    expect(studioInputShape(inherited, issues([['components']])).fields[0]?.observedType).toBe(
      'uninspectable',
    );
    const hidden = {};
    Object.defineProperty(hidden, 'components', { value: [canary] });
    expect(studioInputShape(hidden, issues([['components']])).fields[0]?.observedType).toBe(
      'uninspectable',
    );
    expect(studioInputShape(new Date(), []).rootType).toBe('uninspectable');
    expect(studioInputShape(() => canary, []).rootType).toBe('non-json');
    expect(studioInputShape(Infinity, []).rootType).toBe('non-json');
  });

  it('bounds the already sanitized path projection and ignores non-type failures', () => {
    const input = { components: [{ id: canary }] };
    const projected = [
      ...issues([
        ['components', 0, 'id'],
        ['components'],
        ['offset'],
        ['includeExamples'],
        ['expectedBodyIdentities'],
        ['query'],
      ]),
    ];
    const result = studioInputShape(input, projected);
    expect(result.fields).toHaveLength(5);
    expect(result.fields[0]).toEqual({ path: ['components', 0, 'id'], observedType: 'string' });
    expect(studioInputShape(input, [{ path: ['components'], rule: 'too_big' }]).fields).toEqual([]);
    expect(
      studioInputShape(input, issues([['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']])).fields,
    ).toEqual([]);
    expect(studioInputShape(input, issues([['__proto__']])).fields).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(canary);
  });
});
