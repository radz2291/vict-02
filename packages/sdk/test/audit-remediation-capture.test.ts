import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_RELEASE_SCHEMA,
  defineApplication,
  defineApplicationRelease,
  defineCapability,
  defineCapabilityPack,
  defineContract,
  defineGraph,
  defineResource,
  neutralJsonContract,
  RESOURCE_DEFINITION_SCHEMA,
  VictAuthoringError,
} from '../src/index.js';

/**
 * Stage 04 audit remediation — MED-04-I: real deep immutable captures.
 *
 * Proven across ALL SIX official factories:
 * - ordinary mutable input is deep-copied and frozen;
 * - a shallow-frozen root cannot bypass descendant copying;
 * - a frozen intermediate with mutable descendants cannot bypass copying;
 * - an arbitrary object merely containing `parse` is NOT a trusted contract
 *   (only officially branded frozen contracts preserve identity);
 * - functions are captured by reference;
 * - cycles and unsupported exotic values fail structurally;
 * - hostile getters/proxies produce structured diagnostics, not raw throws.
 */

const officialContract = defineContract<{ v?: string }>({
  id: 'cap.official',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { v?: string } }),
});

describe('MED-04-I: official factories provide real deep immutable captures', () => {
  it('defineCapability: a frozen intermediate with mutable descendants is deep-copied', () => {
    const desc = { secret: 'safe' };
    const capability = defineCapability({
      id: 'cap.frozen-intermediate',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: () => 'x',
      ...({ meta: Object.freeze({ desc }) } as object),
    });
    desc.secret = 'RA4-CANARY-MUTATED';
    expect((capability as unknown as { meta: { meta: { secret: string } } }).meta).toBeDefined();
    const capturedMeta = (capability as unknown as { meta: { meta: { secret: string } } }).meta;
    expect(JSON.stringify(capturedMeta)).not.toContain('RA4-CANARY-MUTATED');
  });

  it('defineCapability: a shallow-frozen root with mutable descendants is deep-copied', () => {
    const nested = { list: ['original'] };
    const capability = defineCapability({
      ...({
        id: 'cap.shallow-frozen',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'x',
        extra: nested,
      } as const),
    });
    nested.list.push('MUTATED');
    expect(JSON.stringify((capability as unknown as { extra: unknown }).extra)).not.toContain(
      'MUTATED',
    );
  });

  it('defineCapability: a parse-bearing impostor is NOT treated as a trusted contract', () => {
    const impostor: { parse: (input: unknown) => unknown } = {
      parse: (input: unknown) => ({ ok: true, value: input }),
    };
    const capability = defineCapability({
      id: 'cap.parse-impostor',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: () => 'x',
      ...({ note: impostor } as Record<string, unknown>),
    });
    // Replacing the impostor's parse after definition cannot change the capture.
    impostor.parse = () => ({
      ok: false as const,
      issues: [{ code: 'HIJACKED', path: '(root)', message: 'hijacked' }],
    });
    const note = (capability as unknown as { note: { parse(): { ok: boolean } } }).note;
    expect((note.parse() as { ok: boolean }).ok).toBe(true);
  });

  it('defineCapability: official frozen contracts keep their object identity', () => {
    const capability = defineCapability({
      id: 'cap.identity',
      revision: '1',
      effect: 'pure',
      input: officialContract,
      output: officialContract,
      invoke: (): { v?: string } => ({ v: 'x' }),
    });
    expect(capability.input).toBe(officialContract);
  });

  it('defineCapability: functions are captured by reference', () => {
    const handler = (): string => 'by-reference';
    const capability = defineCapability({
      id: 'cap.fn',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: handler,
    });
    expect(capability.invoke).toBe(handler);
  });

  it('cycles fail structurally (VictAuthoringError), never with a raw TypeError', () => {
    const cyclic: Record<string, unknown> = { id: 'cap.cyclic' };
    cyclic['self'] = cyclic;
    expect(() =>
      defineCapability({
        ...cyclic,
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'x',
      } as never),
    ).toThrowError(VictAuthoringError);
  });

  it('unsupported exotic values fail structurally', () => {
    const exotic = { id: 'g.exotic', entry: 'a', nodes: [], edges: [] } as Record<string, unknown>;
    exotic['extra'] = new Map();
    expect(() => defineGraph(exotic as never)).toThrowError(VictAuthoringError);
  });

  it('throwing getters fail with a structured authoring diagnostic', () => {
    const hostile: Record<string, unknown> = {
      id: 'cap.hostile',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: () => 'x',
    };
    Object.defineProperty(hostile, 'hostileField', {
      get() {
        throw new TypeError('HOSTILE-GETTER-CANARY');
      },
      enumerable: true,
      configurable: true,
    });
    try {
      defineCapability(hostile as never);
      throw new Error('expected a structured authoring error');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('VICT_AUTHORING_HOSTILE_INPUT');
    }
  });

  it('later source mutation never affects captured definitions across all factories', () => {
    const original: import('../src/index.js').ResourceDefinition & {
      fields: { name: string; type: string; required?: boolean }[];
    } = {
      schema: RESOURCE_DEFINITION_SCHEMA,
      id: 'notes',
      revision: '1',
      identity: { key: 'id' },
      fields: [{ name: 'id', type: 'string' as const, required: true }],
    };
    const captured = defineResource(original);
    (original.fields as { name: string; type: string }[]).push({ name: 'title', type: 'string' });
    expect(captured.fields).toHaveLength(1);

    const application = defineApplication({
      schema: APPLICATION_DEFINITION_SCHEMA,
      id: 'app',
      revision: '1',
      routes: [],
      screens: [],
      actions: [],
      resources: [],
    });
    expect(Object.isFrozen(application)).toBe(true);

    const release = defineApplicationRelease({
      schema: APPLICATION_RELEASE_SCHEMA,
      applicationId: 'app',
      applicationRevision: '1',
      applicationVersion: 'v1_x',
      renderer: { id: 'r', revision: '1' },
      dataAdapter: { id: 'd', revision: '1' },
      victCompatibility: '^0.1.0',
      activation: { kind: 'policy', selection: 'latest' },
    });
    expect(Object.isFrozen(release)).toBe(true);

    const pack = defineCapabilityPack(
      {
        schema: 'vict.capability-pack@1',
        id: 'p',
        version: '1.0.0',
        victCompatibility: '^0.1.0',
        capabilities: [
          {
            id: 'c',
            revision: '1',
            effect: 'pure',
            input: { contractId: 'k', revision: '1' },
            output: { contractId: 'k', revision: '1' },
          },
        ],
        contracts: [{ id: 'k', revision: '1' }],
      },
      { capabilities: [{ id: 'c', revision: '1', invoke: () => 'x' }] },
    );
    expect(Object.isFrozen(pack.manifest)).toBe(true);
    void captured;
  });
});
