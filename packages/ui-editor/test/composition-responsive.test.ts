import { describe, expect, it } from 'vitest';
import { UiEditSession, type UiDocument } from '@victframework/ui';
import { compositionName, moveRelative } from '../src/composition.js';
import { allowConditionalStyles, conditionalStyleConflicts } from '../src/responsive-style.js';

function fixture(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'compose',
    revision: '1',
    root: 'root',
    nodes: {
      root: { id: 'root', kind: 'element', tag: 'main', children: ['a', 'b', 'c'] },
      a: { id: 'a', kind: 'element', tag: 'section', children: ['nested'] },
      nested: { id: 'nested', kind: 'element', tag: 'section', children: [] },
      b: {
        id: 'b',
        kind: 'element',
        tag: 'h1',
        children: [],
        localStyle: [
          { property: 'font-size', value: { type: 'text', value: '36px' } },
          { property: 'padding', value: { type: 'text', value: '24px' } },
          { property: 'color', value: { type: 'text', value: 'navy' } },
        ],
        styleSources: ['compact'],
      },
      c: { id: 'c', kind: 'element', tag: 'p', children: [] },
    },
    componentDefinitions: {},
    tokens: {},
    assets: {},
    localState: {},
    conditions: { compact: { id: 'compact', kind: 'media', query: '(max-width: 600px)' } },
    styleSources: {
      compact: {
        id: 'compact',
        conditionId: 'compact',
        declarations: [
          { property: 'font-size', value: { type: 'text', value: '24px' } },
          { property: 'padding-left', value: { type: 'text', value: '8px' } },
        ],
      },
    },
  };
}

describe('composition and explicit responsive conflict resolution', () => {
  it('compares CSS shorthand members rather than unrelated property prefixes', () => {
    const document = fixture();
    const source: UiDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        b: {
          ...document.nodes.b!,
          localStyle: [
            { property: 'border', value: { type: 'text', value: '1px solid navy' } },
            { property: 'flex', value: { type: 'text', value: '1 1 auto' } },
            { property: 'padding-left', value: { type: 'text', value: '20px' } },
          ],
        },
      },
      styleSources: {
        compact: {
          ...document.styleSources.compact!,
          declarations: [
            { property: 'border-radius', value: { type: 'text', value: '8px' } },
            { property: 'flex-direction', value: { type: 'text', value: 'column' } },
            { property: 'padding', value: { type: 'text', value: '8px' } },
          ],
        },
      },
    };
    expect(conditionalStyleConflicts(source, 'b', 'compact').map((d) => d.property)).toEqual([
      'padding-left',
    ]);
  });
  it('moves in both directions after detach and refuses cycles/root moves', () => {
    const session = UiEditSession.open({ document: fixture(), storedRevision: '1' });
    const move = (id: string, anchor: string, placement: 'before' | 'inside' | 'after') => {
      const command = moveRelative(session.document, id, anchor, placement, []);
      expect(command).toBeDefined();
      expect(
        session.applyTransaction({
          requestId: session.workingRevision,
          expectedDocumentRevision: session.workingRevision,
          commands: [command!],
        }).ok,
      ).toBe(true);
    };
    move('a', 'c', 'after');
    expect(session.document.nodes.root).toMatchObject({ children: ['b', 'c', 'a'] });
    move('a', 'b', 'before');
    expect(session.document.nodes.root).toMatchObject({ children: ['a', 'b', 'c'] });
    expect(moveRelative(session.document, 'a', 'nested', 'inside', [])).toBeUndefined();
    expect(moveRelative(session.document, 'root', 'a', 'after', [])).toBeUndefined();
    move('c', 'nested', 'inside');
    expect(session.document.nodes.nested).toMatchObject({ children: ['c'] });
    expect(compositionName(session.document, 'a')).toBe('Section 1');
    expect(compositionName(session.document, 'nested')).toBe('Section 2');
  });
  it('preserves exact base values, clears shorthand masking atomically, and undo restores locals', () => {
    const source = fixture();
    const session = UiEditSession.open({ document: source, storedRevision: '1' });
    expect(conditionalStyleConflicts(source, 'b', 'compact').map((d) => d.property)).toEqual([
      'font-size',
      'padding',
    ]);
    expect(
      session.applyTransaction({
        ...allowConditionalStyles('resolve', source, 'b', 'compact'),
        expectedDocumentRevision: session.workingRevision,
      }).ok,
    ).toBe(true);
    expect(session.document.nodes.b?.localStyle).toEqual([
      { property: 'color', value: { type: 'text', value: 'navy' } },
    ]);
    expect(session.document.styleSources['src.b.always.plain']?.declarations).toEqual(
      source.nodes.b?.localStyle?.slice(0, 2),
    );
    expect(session.document.styleSources.compact).toEqual(source.styleSources.compact);
    expect(conditionalStyleConflicts(session.document, 'b', 'compact')).toEqual([]);
    expect(session.undo().ok).toBe(true);
    expect(session.document.nodes.b).toEqual(source.nodes.b);
    expect(session.redo().ok).toBe(true);
    expect(conditionalStyleConflicts(session.document, 'b', 'compact')).toEqual([]);
  });
});
