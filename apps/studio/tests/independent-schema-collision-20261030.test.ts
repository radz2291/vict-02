import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { capturePresentationSchema } from '@victframework/mastra';
import { editPresentation } from '../src/lib/designer/agent-edit-presentation.js';
import { agentEditSchema, documentCursor } from '../src/lib/designer/agent-edits.js';
import { agentContext, agentReadPresentation, agentReadSchema } from '../src/lib/designer/agent-reads.js';
import { newScreen } from '../src/lib/designer/application.js';
import { STUDIO_AGENT_PROTOCOL } from '../src/lib/server/designer-agent.js';

const options: NonNullable<ConstructorParameters<typeof Ajv>[0]> & { strict: boolean } = { strict: false, allErrors: true };
const ajv = new Ajv(options);
const editValid = ajv.compile(editPresentation);
const readValid = ajv.compile(agentReadPresentation);
const scope = {
  schema: 'vict.ui-slot-scope@1', props: [{ name: 'label', type: 'string' }],
  state: { url: { key: 'url', type: 'string', initial: '', controlled: true } },
};
const payload = (operation: unknown) => ({ expectedRevision: 'r1#0', reason: 'Independent schema challenge', operations: [operation] });

describe('independent exact schema collision review', () => {
  it('reproduces the old overwritten definition and admits only the canonical new wrapper', () => {
    // Replay the exact prior overwrite from b6cf, keeping the actual candidate's
    // other definitions and operation-union references. This is a bounded old
    // schema reproduction, not an authored application or live-provider proof.
    const old = structuredClone(editPresentation);
    const prior = { ...old, $defs: { ...old.$defs, slotScope: old.$defs.slotScopeDeclaration } };
    const oldValid = ajv.compile(prior);
    const bare = payload({ schema: 'vict.ui-slot-scope@1', props: [] });
    const wrapper = payload({ op: 'slotScope', nodeId: 'workspace', slot: 'body', scope });
    expect(oldValid(bare)).toBe(true);
    expect(oldValid(wrapper)).toBe(false);
    expect(agentEditSchema.safeParse(bare).success).toBe(false);
    expect(editValid(bare)).toBe(false);
    expect(agentEditSchema.safeParse(wrapper).success).toBe(true);
    expect(editValid(wrapper), JSON.stringify(editValid.errors)).toBe(true);
  });

  it('keeps wrapper fields, state dictionaries and closed declaration fields strict', () => {
    for (const operation of [
      { op: 'slotScope', nodeId: 'workspace', slot: 'body' },
      { op: 'slotScope', nodeId: 'workspace', slot: 'body', scope },
    ]) {
      expect(editValid(payload(operation))).toBe(true);
      expect(agentEditSchema.safeParse(payload(operation)).success).toBe(true);
    }
    for (const operation of [
      { op: 'slotScope', nodeId: 'workspace', scope },
      { op: 'slotScope', slot: 'body', scope },
      { op: 'slotScope', nodeId: 'workspace', slot: 'body', ...scope },
      { op: 'slotScope', nodeId: 'workspace', slot: 'body', scope: { ...scope, state: [] } },
      { op: 'slotScope', nodeId: 'workspace', slot: 'body', scope: { ...scope, unknown: true } },
      { op: 'slotScope', nodeId: 'workspace', slot: 'body', scope: JSON.stringify(scope) },
    ]) {
      expect(editValid(payload(operation)), JSON.stringify(operation)).toBe(false);
      expect(agentEditSchema.safeParse(payload(operation)).success, JSON.stringify(operation)).toBe(false);
    }
  });

  it('resolves every operation-union reference to its own discriminated wrapper within bridge bounds', () => {
    for (const ref of editPresentation.$defs.operation.oneOf) {
      const key = ref.$ref.slice('#/$defs/'.length);
      const definition = editPresentation.$defs[key as keyof typeof editPresentation.$defs];
      expect(definition).toMatchObject({ type: 'object', additionalProperties: false, required: expect.arrayContaining(['op']), properties: { op: { const: key } } });
    }
    expect(() => capturePresentationSchema(editPresentation, 'independent-edit')).not.toThrow();
    expect(() => capturePresentationSchema(agentReadPresentation, 'independent-read')).not.toThrow();
    const visit = (value: unknown, root: Record<string, unknown>) => {
      if (!value || typeof value !== 'object') return;
      if ('$ref' in value && typeof value.$ref === 'string') {
        expect(value.$ref.startsWith('#/$defs/')).toBe(true);
        let target: unknown = root;
        for (const segment of value.$ref.slice(2).split('/')) {
          target = target && typeof target === 'object' ? (target as Record<string, unknown>)[segment.replaceAll('~1', '/').replaceAll('~0', '~')] : undefined;
        }
        expect(target, value.$ref).toBeDefined();
      }
      for (const child of Object.values(value)) visit(child, root);
    };
    visit(editPresentation, editPresentation); visit(agentReadPresentation, agentReadPresentation);
  });

  it('requires native preflight objects without parsing strings and leaves source unchanged on every outcome', () => {
    const source = newScreen('Independent preflight', 'independent-schema-preflight');
    const cursor = documentCursor(source, 'r1#0', 'ecb3d23b-9b15-4fe9-8d28-685dd5aad5a9');
    const before = JSON.stringify(source);
    const edit = { expectedRevision: cursor.revision, reason: 'Independent object preflight', operations: [{ op: 'modify', nodeId: source.root, styles: { color: '#123456' } }] };
    for (const native of [edit, {}, { ...edit, extra: true }, { ...edit, expectedRevision: 'stale' }]) {
      const input = { section: 'preflight', edit: native };
      expect(readValid(input)).toBe(true);
      expect(agentReadSchema.safeParse(input).success).toBe(true);
      const result = agentContext(source, cursor, undefined, input);
      expect(result).toMatchObject({ ok: native === edit, applied: false });
      for (const key of ['proposalId', 'draft', 'document']) expect(result).not.toHaveProperty(key);
    }
    for (const invalid of [JSON.stringify(edit), 'null', '', [], true, 0]) {
      const input = { section: 'preflight', edit: invalid };
      expect(readValid(input)).toBe(false);
      expect(agentReadSchema.safeParse(input).success).toBe(false);
    }
    for (const input of [{ section: 'preflight' }, { section: 'preflight', edit: null }]) {
      expect(readValid(input)).toBe(true); expect(agentReadSchema.safeParse(input).success).toBe(true);
      expect(agentContext(source, cursor, undefined, input)).toMatchObject({ ok: false });
    }
    expect(JSON.stringify(source)).toBe(before);
    expect(STUDIO_AGENT_PROTOCOL).toMatchObject({ readCapabilityRevision: '10', readInputRevision: '10', editCapabilityRevision: '10', editInputRevision: '10', profileRevision: '20', observationProfileRevision: '14' });
  });

  it('does not drop an own JSON __proto__ field before strict nested edit validation', () => {
    const source = newScreen('Exact preflight payload', 'independent-exact-preflight');
    const cursor = documentCursor(source, 'r1#0', '1f995dda-594c-45a4-91b5-7e0ddf0d4dd8');
    const edit = JSON.parse(JSON.stringify({ expectedRevision: cursor.revision, reason: 'Unknown JSON field must refuse', operations: [{ op: 'modify', nodeId: source.root, styles: { color: '#123456' } }] }).slice(0, -1) + ',"__proto__":{"canary":"inert"}}');
    expect(Object.hasOwn(edit, '__proto__')).toBe(true);
    expect(agentEditSchema.safeParse(edit).success).toBe(false);
    const admitted = agentReadSchema.parse({ section: 'preflight', edit });
    expect(admitted.edit).toBe(edit);
    expect(Object.hasOwn(admitted.edit as object, '__proto__')).toBe(true);
    const before = JSON.stringify(source);
    expect(agentContext(source, cursor, undefined, { section: 'preflight', edit })).toMatchObject({ ok: false, applied: false });
    expect(JSON.stringify(source)).toBe(before);
  });
});
