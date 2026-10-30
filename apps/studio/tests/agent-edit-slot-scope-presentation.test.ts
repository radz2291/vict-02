import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { agentEditSchema } from '../src/lib/designer/agent-edits.js';
import { editPresentation } from '../src/lib/designer/agent-edit-presentation.js';

const ajvOptions: NonNullable<ConstructorParameters<typeof Ajv>[0]> & { strict: boolean } = { strict: false, allErrors: true };
const presented = new Ajv(ajvOptions).compile(editPresentation);
const declaration = { schema: 'vict.ui-slot-scope@1', props: [] };
const edit = (operation: unknown) => ({
  expectedRevision: 'r1#0',
  reason: 'Declare the workspace body scope',
  operations: [operation],
});

describe('slot scope operation presentation', () => {
  it('admits the canonical wrapper and optional scope removal', () => {
    for (const operation of [
      { op: 'slotScope', nodeId: 'workspace', slot: 'body', scope: declaration },
      { op: 'slotScope', nodeId: 'workspace', slot: 'body' },
    ]) {
      expect(agentEditSchema.safeParse(edit(operation)).success).toBe(true);
      expect(presented(edit(operation))).toBe(true);
    }
  });

  it('refuses the reproduced bare declaration as an operation', () => {
    expect(agentEditSchema.safeParse(edit(declaration)).success).toBe(false);
    expect(presented(edit(declaration))).toBe(false);
  });

  it('validates the declaration inside the operation wrapper', () => {
    const invalid = edit({
      op: 'slotScope',
      nodeId: 'workspace',
      slot: 'body',
      scope: { schema: 'vict.ui-slot-scope@1', props: '[]' },
    });
    expect(agentEditSchema.safeParse(invalid).success).toBe(false);
    expect(presented(invalid)).toBe(false);
  });

  it('keeps every operation union branch a discriminated wrapper', () => {
    for (const branch of editPresentation.$defs.operation.oneOf) {
      const name = branch.$ref.slice('#/$defs/'.length);
      const definition = editPresentation.$defs[name as keyof typeof editPresentation.$defs];
      expect(definition, name).toMatchObject({
        type: 'object',
        required: expect.arrayContaining(['op']),
        properties: { op: { const: name } },
      });
    }
  });
});
