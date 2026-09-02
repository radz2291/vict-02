import { describe, expect, it } from 'vitest';
import { runCapabilityPackConformanceSuite } from '@vict/runtime/testing';
import { notesPack, notesPackConformance } from '../src/index.js';

/**
 * The pure/read pack passes the SAME shared capability-pack conformance
 * suite that the write pack passes (and every future pack must pass).
 */
describe('capability pack conformance: vict.example.notes (pure/read)', () => {
  it('passes the shared conformance suite', async () => {
    await expect(
      runCapabilityPackConformanceSuite({
        name: 'vict.example.notes',
        pack: notesPack,
        pureCapabilityId: notesPackConformance.pureCapabilityId,
        pureInput: notesPackConformance.pureInput,
        pureExpectedOutput: notesPackConformance.pureExpectedOutput,
      }),
    ).resolves.toBeUndefined();
  });

  it('the manifest never contains handler content', () => {
    const serialized = JSON.stringify(notesPack.manifest);
    expect(serialized).not.toContain('invoke');
    expect(serialized).not.toContain('toUpperCase');
  });
});
