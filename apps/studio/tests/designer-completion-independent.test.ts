import { expect, it } from 'vitest';
import { newScreen, screenIssues } from '../src/lib/designer/application.js';
import { agentContext, documentCursor, prepareAgentEdit } from '../src/lib/designer/agent-edits.js';

it('independent challenge: agent can create a typed native number field in one batch', () => {
  const document = newScreen('Independent number', 'independent-number');
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  const result = prepareAgentEdit(document, cursor, {
    expectedRevision: cursor.revision, reason: 'Independent native number challenge', operations: [
      { op: 'add', recipe: 'input', nodeId: 'quantity', parentId: 'screen', attributes: { type: 'number', 'aria-label': 'Quantity' } },
      { op: 'wireInput', nodeId: 'quantity', key: 'quantity', initial: 2 },
    ],
  }, 'independent-number');
  expect(result).toMatchObject({ ok: true });
  if (result.ok) expect(result.document.localState.quantity).toMatchObject({ type: 'number', initial: 2 });
});

it('independent challenge: agent can create a typed native checkbox in one batch', () => {
  const document = newScreen('Independent checkbox', 'independent-checkbox');
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  const result = prepareAgentEdit(document, cursor, {
    expectedRevision: cursor.revision, reason: 'Independent native checkbox challenge', operations: [
      { op: 'add', recipe: 'input', nodeId: 'confirm', parentId: 'screen', attributes: { type: 'checkbox', 'aria-label': 'Confirm' } },
      { op: 'wireInput', nodeId: 'confirm', key: 'confirm', initial: false },
    ],
  }, 'independent-checkbox');
  expect(result).toMatchObject({ ok: true });
  if (result.ok) expect(result.document.localState.confirm).toMatchObject({ type: 'boolean', initial: false });
});

it('independent challenge: refuses nested interactive wrapper in a native trigger slot', () => {
  const document = newScreen('Nested wrappers', 'independent-nested-wrapper');
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  const result = prepareAgentEdit(document, cursor, {
    expectedRevision: cursor.revision, reason: 'Independent nested trigger challenge', operations: [
      { op: 'add', recipe: 'popover', nodeId: 'outer', parentId: 'screen' },
      { op: 'add', recipe: 'popover', nodeId: 'inner', parentId: 'outer', slotName: 'trigger' },
    ],
  }, 'independent-nested-wrapper');
  expect(result).toMatchObject({ ok: false, code: 'STUDIO_AGENT_INTERACTIVE_SLOT' });
});

it('independent challenge: reconstructs a long declared state through bounded targeted pages', () => {
  const base = newScreen('Long state', 'independent-long-state');
  const initial = 'Visible state '.repeat(1400) + 'FINAL STATE SENTINEL';
  const document = { ...base, localState: { ...base.localState, longValue: { key: 'longValue', type: 'string' as const, initial } } };
  expect(screenIssues(document)).toEqual([]);
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  let offset: number | null = 0;
  let json = '';
  let pages = 0;
  while (offset !== null && pages++ < 20) {
    const result = agentContext(document, cursor, undefined, { section: 'state', stateKey: 'longValue', offset, limit: 20 });
    expect(result).not.toMatchObject({ ok: false });
    expect(typeof result.sourceJson).toBe('string');
    json += result.sourceJson;
    offset = result.nextOffset as number | null;
  }
  expect(JSON.parse(json)).toEqual(document.localState.longValue);
});
