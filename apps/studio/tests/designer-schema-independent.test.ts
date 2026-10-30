import { expect, it } from 'vitest';
import Ajv from 'ajv';
import { editPresentation } from '../src/lib/server/designer-agent.js';
import { agentEditSchema, documentCursor, prepareAgentEdit } from '../src/lib/designer/agent-edits.js';
import { newScreen } from '../src/lib/designer/application.js';
const validatePresentation = new Ajv({ allErrors: true }).compile(editPresentation);
const edit = (operation: unknown) => ({ expectedRevision: 'r1', reason: 'Independent schema challenge', operations: [operation] });

it('independent challenge: provider expression schema rejects the same forbidden fields as authoritative input', () => {
  const invalid = edit({ op: 'bind', nodeId: 'control', prop: 'checked', expression: { type: 'ref', path: 'state.accepted', value: true } });
  expect(agentEditSchema.safeParse(invalid).success).toBe(false);
  expect(validatePresentation(invalid)).toBe(false);
});

it('independent challenge: provider prop lists reject mixed types accepted by neither canonical list shape', () => {
  const invalid = edit({ op: 'modify', nodeId: 'control', props: { value: ['one', 2] } });
  expect(agentEditSchema.safeParse(invalid).success).toBe(false);
  expect(validatePresentation(invalid)).toBe(false);
});

it('independent challenge: malformed expression refusal includes a recoverable expected shape', () => {
  const document = newScreen('Schema refusal', 'independent-schema-refusal');
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  const result = prepareAgentEdit(document, cursor, edit({ op: 'bind', nodeId: 'control', prop: 'checked', expression: true }), 'schema-challenge');
  expect(result).toMatchObject({ ok: false, code: 'STUDIO_AGENT_INVALID_EDIT', diagnostics: [expect.objectContaining({ operation: 0, path: 'operations.0.expression' })] });
  expect(JSON.stringify(result)).toContain('literal');
  expect(JSON.stringify(result)).toContain('ref');
});
