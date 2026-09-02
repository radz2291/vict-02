import { defineCapabilityPack, defineContract } from '@vict/sdk';
import type { CapabilityPack } from '@vict/sdk';

/**
 * `vict.example.notes` — a PURE/READ capability pack.
 *
 * Demonstrates the Stage 04 pack contract for behavior without external
 * effects: stable id + semver, Vict compatibility range, declared
 * capabilities and contracts (exact id/revision), no permissions, no
 * configuration, no secrets, and no doubles (nothing unsafe to simulate).
 * The manifest is fully serializable; only the separate bindings carry
 * handlers.
 */

const NoteText = defineContract<{ title: string }>({
  id: 'notes.text',
  revision: '1',
  expected: '{ title: string }',
  parse: (input) => {
    const candidate = input as { title?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.title === 'string'
    ) {
      return { ok: true as const, value: { title: candidate.title } };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: 'title', message: 'title must be a string' }],
    };
  },
});

const FormattedNote = defineContract<{ formatted: string; length: number }>({
  id: 'notes.formatted',
  revision: '1',
  expected: '{ formatted: string, length: number }',
  parse: (input) => {
    const candidate = input as { formatted?: unknown; length?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.formatted === 'string' &&
      typeof candidate.length === 'number'
    ) {
      return {
        ok: true as const,
        value: { formatted: candidate.formatted, length: candidate.length },
      };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: '(root)', message: 'formatted note expected' }],
    };
  },
});

const NoteStats = defineContract<{ words: number; characters: number }>({
  id: 'notes.stats',
  revision: '1',
  expected: '{ words: number, characters: number }',
  parse: (input) => {
    const candidate = input as { words?: unknown; characters?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.words === 'number' &&
      typeof candidate.characters === 'number'
    ) {
      return {
        ok: true as const,
        value: { words: candidate.words, characters: candidate.characters },
      };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: '(root)', message: 'note statistics expected' }],
    };
  },
});

export const notesPack: CapabilityPack = defineCapabilityPack(
  {
    schema: 'vict.capability-pack@1',
    id: 'vict.example.notes',
    version: '1.0.0',
    victCompatibility: '^0.1.0',
    capabilities: [
      {
        id: 'notes.format',
        revision: '1',
        effect: 'pure',
        input: { contractId: 'notes.text', revision: '1' },
        output: { contractId: 'notes.formatted', revision: '1' },
      },
      {
        id: 'notes.stats',
        revision: '1',
        effect: 'read',
        input: { contractId: 'notes.text', revision: '1' },
        output: { contractId: 'notes.stats', revision: '1' },
      },
    ],
    contracts: [
      { id: 'notes.text', revision: '1' },
      { id: 'notes.formatted', revision: '1' },
      { id: 'notes.stats', revision: '1' },
    ],
    permissions: [],
    configuration: [],
    secrets: [],
    evaluations: [
      {
        id: 'eval.notes.format.uppercases',
        capabilityId: 'notes.format',
        description: 'The formatted output uppercases the input title.',
      },
    ],
    documentation: {
      summary: 'Pure/read text utilities for note-shaped records.',
    },
    provenance: { author: 'vict examples', license: 'MIT' },
  },
  {
    capabilities: [
      {
        id: 'notes.format',
        revision: '1',
        input: NoteText,
        output: FormattedNote,
        invoke: (input: { title: string }) => ({
          formatted: input.title.toUpperCase(),
          length: input.title.length,
        }),
      },
      {
        id: 'notes.stats',
        revision: '1',
        input: NoteText,
        output: NoteStats,
        invoke: (input: { title: string }) => ({
          words: input.title.trim().split(/\s+/).filter(Boolean).length,
          characters: input.title.length,
        }),
      },
    ],
    doubles: [],
  },
);

export const notesPackConformance = {
  pureCapabilityId: 'notes.format',
  pureInput: { title: 'hello vict' },
  pureExpectedOutput: { formatted: 'HELLO VICT', length: 10 },
} as const;
