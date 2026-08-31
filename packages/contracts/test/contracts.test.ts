import { describe, expect, it } from 'vitest';
import {
  defineContract,
  errorSignalContract,
  victError,
  ContractDefinitionError,
} from '../src/index.js';
import type { ContractIssue } from '../src/index.js';

/** Hand-written neutral parser used throughout these tests — zero schema libraries involved. */
function textContract(revision = '1') {
  return defineContract<{ text: string }>({
    id: 'test.text',
    revision,
    parse: (input) => {
      if (
        input !== null &&
        typeof input === 'object' &&
        typeof (input as { text?: unknown }).text === 'string' &&
        (input as { text: string }).text.length > 0
      ) {
        return { ok: true, value: input as { text: string } };
      }
      return {
        ok: false,
        issues: [
          {
            code: 'invalid_type',
            path: 'text',
            message: `Expected a non-empty string at 'text', received ${typeof input}.`,
            expected: 'string',
            received: 'undefined',
          },
        ],
      };
    },
  });
}

describe('neutral defineContract', () => {
  it('parses valid input successfully', () => {
    const contract = textContract();
    const result = contract.parse({ text: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe('hello');
    }
  });

  it('returns structured issues for invalid input', () => {
    const contract = textContract();
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

  it('the public contract surface is plain data plus parse', () => {
    const contract = textContract();
    expect(Object.keys(contract).sort()).toEqual(['expected', 'id', 'parse', 'revision']);
    expect(Object.isFrozen(contract)).toBe(true);
  });

  it('rejects missing or invalid revisions with structured errors', () => {
    expect(() =>
      defineContract({ id: 'x', revision: '', parse: (input) => ({ ok: true, value: input }) }),
    ).toThrowError(ContractDefinitionError);
    expect(() =>
      defineContract({
        id: 'x',
        revision: undefined as unknown as string,
        parse: (input) => ({ ok: true, value: input }),
      }),
    ).toThrowError(ContractDefinitionError);
    try {
      defineContract({
        id: 'x',
        revision: 3 as unknown as string,
        parse: (i) => ({ ok: true, value: i }),
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContractDefinitionError);
      expect((error as ContractDefinitionError).code).toBe('INVALID_CONTRACT_REVISION');
    }
    expect(() =>
      defineContract({ id: '', revision: '1', parse: (input) => ({ ok: true, value: input }) }),
    ).toThrowError(ContractDefinitionError);
    try {
      defineContract({ id: '', revision: '1', parse: (i) => ({ ok: true, value: i }) });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ContractDefinitionError).code).toBe('EMPTY_CONTRACT_ID');
    }
  });

  it('does not leak library error types through results', () => {
    const contract = textContract();
    const result = contract.parse({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues as readonly ContractIssue[]) {
        expect(Object.getPrototypeOf(issue)).toBe(Object.prototype);
        expect(issue).not.toBeInstanceOf(Error);
        const keys = Object.keys(issue).sort();
        expect(
          keys.every((key) =>
            ['code', 'expected', 'message', 'path', 'received', 'safeMessage'].includes(key),
          ),
        ).toBe(true);
      }
    }
  });

  it('never copies received secret values into issues', () => {
    const secret = 'hunter2-secret-value';
    const contract = defineContract<{ password: string }>({
      id: 'test.password',
      revision: '1',
      parse: (input) => {
        const password = (input as { password?: unknown })?.password;
        if (typeof password === 'string' && password.length >= 64) {
          return { ok: true, value: input as { password: string } };
        }
        return {
          ok: false,
          issues: [
            {
              code: 'too_small',
              path: 'password',
              message: `Value at 'password' is too small, received ${typeof password}(${password ? String(password).length : 0}).`,
              received: `string(${password ? String(password).length : 0})`,
            },
          ],
        };
      },
    });
    const result = contract.parse({ password: secret });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    if (!result.ok) {
      expect(result.issues[0]?.received).toBe(`string(${secret.length})`);
    }
  });
});

describe('errorSignalContract (neutral parser)', () => {
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

  it('reports nested cause paths', () => {
    const result = errorSignalContract.parse({ code: 'A', message: 'x', cause: { code: 5 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('cause.code');
    }
  });
});
