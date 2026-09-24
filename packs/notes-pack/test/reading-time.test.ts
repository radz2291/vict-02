import { describe, expect, it } from 'vitest';
import {
  estimateReadingTime,
  notesPack,
  notesPackConformance,
  readingTimeExample,
} from '../src/index.js';

/**
 * Permanent tests for the `notes.readingTime@1` pure read: the pure
 * derivation itself, the declaration/binding wiring inside the pack, the
 * pack's example surface, and the purity/authority shape of the capability.
 */

describe('estimateReadingTime (pure derivation)', () => {
  it('estimates zero minutes for empty or whitespace-only content', () => {
    expect(estimateReadingTime('')).toEqual({ minutes: 0, words: 0 });
    expect(estimateReadingTime('   \n\t  ')).toEqual({ minutes: 0, words: 0 });
  });

  it('reports a one-minute minimum for any non-empty content', () => {
    expect(estimateReadingTime('one two three')).toEqual({ minutes: 1, words: 3 });
    expect(estimateReadingTime('word '.repeat(200).trim())).toEqual({ minutes: 1, words: 200 });
  });

  it('rounds partial minutes up beyond the one-minute minimum', () => {
    expect(estimateReadingTime('word '.repeat(201).trim())).toEqual({ minutes: 2, words: 201 });
    expect(estimateReadingTime('word '.repeat(400).trim())).toEqual({ minutes: 2, words: 400 });
    expect(estimateReadingTime('word '.repeat(401).trim())).toEqual({ minutes: 3, words: 401 });
  });

  it('never mutates its input and returns equal results for equal inputs', () => {
    const content = 'a b c';
    const snapshot = content;
    const first = estimateReadingTime(content);
    const second = estimateReadingTime(content);
    expect(content).toBe(snapshot);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first) || typeof first === 'object').toBe(true);
  });
});

describe('notes.readingTime@1 declaration and binding wiring', () => {
  const manifestCapability = notesPack.manifest.capabilities.find(
    (capability) => capability.id === 'notes.readingTime',
  );
  const binding = notesPack.bindings.capabilities.find(
    (capability) => capability.id === 'notes.readingTime',
  );

  it('declares the capability in the manifest with effect and contract references', () => {
    expect(manifestCapability).toBeDefined();
    expect(manifestCapability?.revision).toBe('1');
    expect(manifestCapability?.effect).toBe('read');
    expect(manifestCapability?.input).toEqual({ contractId: 'notes.text', revision: '1' });
    expect(manifestCapability?.output).toEqual({
      contractId: 'notes.readingTime',
      revision: '1',
    });
  });

  it('declares the output contract in the pack contracts list (exact id + revision)', () => {
    expect(notesPack.manifest.contracts).toContainEqual({
      id: 'notes.readingTime',
      revision: '1',
    });
  });

  it('adds no authority requirements: the pack stays permission-, config-, and secret-free', () => {
    expect(notesPack.manifest.permissions).toEqual([]);
    expect(notesPack.manifest.configuration).toEqual([]);
    expect(notesPack.manifest.secrets).toEqual([]);
    expect(manifestCapability?.permissions).toBeUndefined();
    expect(manifestCapability?.configuration).toBeUndefined();
    expect(manifestCapability?.secrets).toBeUndefined();
  });

  it('binds an invoke whose input and output satisfy the declared contracts', () => {
    expect(binding).toBeDefined();
    expect(binding?.revision).toBe('1');
    expect(binding?.input).toBeDefined();
    expect(binding?.output).toBeDefined();
    const parsedInput = binding?.input?.parse(readingTimeExample.input);
    expect(parsedInput?.ok).toBe(true);
    const raw = binding?.invoke({ title: 'hello from the reading time test' });
    const parsedOutput = binding?.output?.parse(raw);
    expect(parsedOutput).toEqual({
      ok: true,
      value: { minutes: 1, words: 6 },
    });
  });

  it('rejects malformed input and malformed output through the declared contracts', () => {
    expect(binding?.input?.parse({ title: 42 })?.ok).toBe(false);
    expect(binding?.input?.parse(null)?.ok).toBe(false);
    expect(binding?.output?.parse({ minutes: '1', words: 3 })?.ok).toBe(false);
    expect(binding?.output?.parse({ minutes: 1 })?.ok).toBe(false);
  });

  it('the manifest never contains handler content', () => {
    const serialized = JSON.stringify(notesPack.manifest);
    expect(serialized).not.toContain('invoke');
    expect(serialized).not.toContain('estimateReadingTime');
  });
});

describe('reading-time example (pack example surface)', () => {
  it('the published example matches the capability output exactly', () => {
    const binding = notesPack.bindings.capabilities.find(
      (capability) => capability.id === readingTimeExample.capabilityId,
    );
    expect(binding).toBeDefined();
    const raw = binding?.invoke(readingTimeExample.input);
    expect(raw).toEqual(readingTimeExample.output);
    expect(readingTimeExample.output).toEqual({ minutes: 1, words: 10 });
  });

  it('the conformance fixture carries the same reading-time example', () => {
    expect(notesPackConformance.readingTimeCapabilityId).toBe('notes.readingTime');
    expect(notesPackConformance.readingTimeInput).toEqual(readingTimeExample.input);
    expect(notesPackConformance.readingTimeExpectedOutput).toEqual(readingTimeExample.output);
  });
});
