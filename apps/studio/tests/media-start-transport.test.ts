import { describe, it, expect } from 'vitest';
import { newScreen } from '../src/lib/designer/application.js';
import { documentCursor } from '../src/lib/designer/agent-edits.js';
import { validateAgentStart } from '../src/lib/server/designer-agent.js';
import { agentMediaInventorySnapshot } from '../src/lib/designer/media-assets.js';
function fixture() {
  const document = newScreen('Media admission', 'media-admission'),
    cursor = documentCursor(document, 'r1#0', crypto.randomUUID());
  const digest = 'a'.repeat(64),
    mediaInventory = agentMediaInventorySnapshot(
      document.id,
      [
        {
          schema: 'vict.media-asset@1',
          reference: `asset:sha256:${digest}`,
          digest,
          name: 'supplied.png',
          mime: 'image/png',
          size: 7350,
          createdAt: '2026-10-27T00:00:00.000Z',
        },
      ],
      '2026-10-27T01:00:00.000Z',
    );
  return {
    prompt: 'Inspect supplied media metadata only',
    document,
    cursor,
    history: [],
    mediaInventory,
  };
}
describe('actual agent start media metadata admission', () => {
  it('accepts optional current-document host metadata unchanged without starting a provider', () => {
    const start = fixture(),
      result = validateAgentStart(start);
    expect(result).toMatchObject({ ok: true, value: { mediaInventory: start.mediaInventory } });
    const { mediaInventory: _metadata, ...legacy } = start;
    expect(validateAgentStart(legacy).ok).toBe(true);
  });
  it('rejects another document inventory before any run opens', () => {
    const start = fixture();
    expect(
      validateAgentStart({
        ...start,
        mediaInventory: { ...start.mediaInventory, documentId: 'another-document' },
      }),
    ).toMatchObject({ ok: false, code: 'STUDIO_AGENT_MEDIA_SCOPE' });
  });
  it('rejects undeclared fields, duplicate references and contradictory metadata counts', () => {
    const start = fixture(),
      item = start.mediaInventory.items[0]!;
    const invalid = [
      { ...start.mediaInventory, items: [{ ...item, bytes: [137, 80] }] },
      { ...start.mediaInventory, items: [{ ...item, provenance: 'not part of the transport' }] },
      { ...start.mediaInventory, items: Array(101).fill(item), total: 101 },
      { ...start.mediaInventory, total: 2, truncated: false },
    ];
    for (const mediaInventory of invalid)
      expect(validateAgentStart({ ...start, mediaInventory })).toMatchObject({
        ok: false,
        code: 'STUDIO_AGENT_REQUEST',
      });
  });
  it('admits complete host metadata beyond former display and upload-envelope quotas', () => {
    const start = fixture(),
      item = start.mediaInventory.items[0]!;
    const mediaInventory = {
      ...start.mediaInventory,
      items: Array.from({ length: 150 }, (_, index) => {
        const digest = index.toString(16).padStart(64, '0');
        return {
          ...item,
          digest,
          reference: `asset:sha256:${digest}`,
          name: 'long name '.repeat(100),
          mime: 'application/' + 'x'.repeat(110),
          size: 128 * 1024 * 1024,
        };
      }),
      total: 150,
      truncated: false,
    };
    expect(validateAgentStart({ ...start, mediaInventory })).toMatchObject({
      ok: true,
      value: { mediaInventory },
    });
  });
});
