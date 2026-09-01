import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineZodContract } from '../src/zod/index.js';

const SECRET = 'sk-live-TOPSECRET-9f3c1a';

describe('defineZodContract (optional adapter)', () => {
  it('maps zod schemas to neutral contracts', () => {
    const contract = defineZodContract<{ text: string }>(
      'z.text',
      '1',
      z.object({ text: z.string().min(1) }),
    );
    const ok = contract.parse({ text: 'hello' });
    expect(ok.ok).toBe(true);
    const bad = contract.parse({ text: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0]?.path).toBe('text');
      expect(typeof bad.issues[0]?.message).toBe('string');
    }
  });

  it('identifies nested field paths correctly', () => {
    const contract = defineZodContract<unknown>(
      'z.nested',
      '1',
      z.object({
        user: z.object({ name: z.string() }),
        items: z.array(z.object({ qty: z.number() })),
      }),
    );
    const result = contract.parse({ user: { name: 5 }, items: [{ qty: 'x' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((issue) => issue.path).sort();
      expect(paths).toEqual(['items[0].qty', 'user.name']);
    }
  });

  it('generates framework-safe messages and never copies schema messages by default', () => {
    const contract = defineZodContract<{ token: string }>(
      'z.token',
      '1',
      z.object({
        token: z.string().refine((value) => value.length > 100, {
          message: `Auth rejected for token value: ${SECRET}`,
        }),
      }),
    );
    const result = contract.parse({ token: 'short' });
    expect(result.ok).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET);
    if (!result.ok) {
      for (const issue of result.issues) {
        // Framework-generated message: code/path/type only.
        expect(issue.message).toMatch(/^Validation failed \(custom\) at 'token'/);
        expect(issue.safeMessage).toBeUndefined();
        // Received is a type-shape description, never the value.
        expect(issue.received).toBe('string(5)');
      }
    }
  });

  it('exposes schema messages only as safeMessage when explicitly trusted', () => {
    const contract = defineZodContract<{ token: string }>(
      'z.token.trusted',
      '1',
      z.object({
        token: z.string().refine((value) => value.length > 100, {
          message: 'token too short (auth subsystem)',
        }),
      }),
      { trustSchemaMessages: true },
    );
    const result = contract.parse({ token: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).not.toContain('token too short');
      expect(result.issues[0]?.safeMessage).toContain('token too short');
    }
  });

  it('reports safe received descriptions on literal mismatches', () => {
    const contract = defineZodContract<{ role: 'assistant' }>(
      'z.role',
      '1',
      z.object({ role: z.literal('assistant') }),
    );
    const result = contract.parse({ role: SECRET });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(SECRET);
    if (!result.ok) {
      expect(result.issues[0]?.received).toBe(`string(${SECRET.length})`);
    }
  });

  it('rejects missing or invalid revisions with structured errors', () => {
    expect(() => defineZodContract('z.bad', '', z.object({}))).toThrowError(/revision/);
  });

  it('results never contain zod error instances', () => {
    const contract = defineZodContract<{ n: number }>('z.n', '1', z.object({ n: z.number() }));
    const result = contract.parse({ n: 'nope' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues) {
        expect(issue).not.toBeInstanceOf(Error);
        expect(issue.constructor.name).toBe('Object');
      }
    }
  });

  it('returns a frozen contract that cannot be mutated in place', () => {
    const contract = defineZodContract<{ n: number }>('z.frozen', '1', z.object({ n: z.number() }));
    expect(Object.isFrozen(contract)).toBe(true);
    expect(() => {
      (contract as { parse: unknown }).parse = () => ({ ok: true as const, value: { n: 666 } });
    }).toThrow();
    expect(() => {
      (contract as { revision: string }).revision = '2';
    }).toThrow();
    // The original parsing behaviour is unchanged.
    expect(contract.parse({ n: 'still-bad' }).ok).toBe(false);
  });
});
