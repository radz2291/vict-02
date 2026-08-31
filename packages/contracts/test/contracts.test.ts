import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineContract, errorSignalContract, victError } from '../src/index.js';
import type { ContractIssue } from '../src/index.js';

describe('defineContract', () => {
  it('parses valid input successfully', () => {
    const contract = defineContract<{ text: string }>(
      'test.text',
      z.object({ text: z.string().min(1) }),
    );
    const result = contract.parse({ text: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe('hello');
    }
  });

  it('returns structured issues for invalid input', () => {
    const contract = defineContract<{ text: string }>(
      'test.text',
      z.object({ text: z.string().min(1) }),
    );
    const result = contract.parse({ text: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      for (const issue of result.issues) {
        expect(typeof issue.code).toBe('string');
        expect(typeof issue.path).toBe('string');
        expect(typeof issue.message).toBe('string');
      }
    }
  });

  it('identifies nested field paths correctly', () => {
    const contract = defineContract<unknown>(
      'test.nested',
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

  it('reports (root) for top-level type mismatches', () => {
    const contract = defineContract<{ text: string }>('test.text', z.object({ text: z.string() }));
    const result = contract.parse('not-an-object');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('(root)');
    }
  });

  it('does not leak the underlying schema library error type', () => {
    const contract = defineContract<{ text: string }>('test.text', z.object({ text: z.string() }));
    const result = contract.parse({ text: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues as readonly ContractIssue[]) {
        expect(Object.getPrototypeOf(issue)).toBe(Object.prototype);
        expect(issue).not.toBeInstanceOf(Error);
        const keys = Object.keys(issue).sort();
        expect(
          keys.every((key) => ['code', 'expected', 'message', 'path', 'received'].includes(key)),
        ).toBe(true);
      }
    }
    // The public contract object exposes only Vict vocabulary.
    expect(Object.keys(contract).sort()).toEqual(['expected', 'id', 'parse']);
  });

  it('never copies received secret values into issues', () => {
    const secret = 'hunter2-secret-value';
    const contract = defineContract<{ password: string }>(
      'test.password',
      z.object({ password: z.string().min(64) }),
    );
    const result = contract.parse({ password: secret });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    if (!result.ok) {
      // received is a safe type-shape description, not the value
      expect(result.issues[0]?.received).toBe(`string(${secret.length})`);
    }
  });

  it('redacts received values on literal mismatches too', () => {
    const secretRole = 'secret-agent-role-value';
    const contract = defineContract<{ role: 'assistant' }>(
      'test.role',
      z.object({ role: z.literal('assistant') }),
    );
    const result = contract.parse({ role: secretRole });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secretRole);
    if (!result.ok) {
      expect(result.issues[0]?.received).toBe(`string(${secretRole.length})`);
    }
  });
});

describe('errorSignalContract', () => {
  it('parses a structured Vict error including nested causes', () => {
    const inner = victError('INNER', 'inner failure');
    const outer = victError('OUTER', 'outer failure', { nodeId: 'n1' }, inner);
    const result = errorSignalContract.parse(outer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.code).toBe('OUTER');
      expect(result.value.cause?.code).toBe('INNER');
    }
  });

  it('rejects errors without a code', () => {
    const result = errorSignalContract.parse({ message: 'no code' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === 'code')).toBe(true);
    }
  });

  it('rejects non-object input', () => {
    const result = errorSignalContract.parse('boom');
    expect(result.ok).toBe(false);
  });
});
