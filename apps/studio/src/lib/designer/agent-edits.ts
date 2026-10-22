/** Cycle 1.1: a bounded palette vocabulary compiled to the manual editor's transactions. */
import { z } from 'zod';
import {
  applyUiEdit,
  canonicalUiDocument,
  type UiDocument,
  type UiEditCommand,
} from '@victframework/ui';
import {
  insertSubtree,
  literalTextTarget,
  resolveOccurrence,
  type EditorBridge,
  type TransactionDraft,
} from '@victframework/ui-editor';
import { screenRecipes } from './recipes.js';
import { catalogDescriptors, designerCatalogs, screenIssues, actionInputs } from './application.js';

const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_.:-]+$/)
  .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
const content = {
  text: z.string().max(4000).optional(),
  attributes: z.record(id, scalar).optional(),
  props: z.record(id, scalar).optional(),
  styles: z.record(z.string().min(1).max(80), z.string().max(500)).optional(),
};
const position = { slotName: id.optional(), index: z.number().int().min(0).max(1000).optional() };
export const agentOperationSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add'),
      recipe: z.enum([
        'section',
        'row',
        'heading',
        'text',
        'input',
        'button',
        'checkbox',
        'switch',
        'dialog',
        'separator',
      ]),
      nodeId: id,
      parentId: id,
      ...position,
      ...content,
    })
    .strict(),
  z.object({ op: z.literal('modify'), nodeId: id, ...content }).strict(),
  z.object({ op: z.literal('move'), nodeId: id, newParentId: id, ...position }).strict(),
  z.object({ op: z.literal('remove'), nodeId: id }).strict(),
]);
export const agentEditSchema = z
  .object({
    expectedRevision: z.string().min(1).max(160),
    reason: z.string().min(1).max(240),
    operations: z.array(agentOperationSchema).min(1).max(40),
  })
  .strict();
export type AgentEdit = z.infer<typeof agentEditSchema>;
export interface AgentCursor {
  documentId: string;
  revision: string;
  digest: string;
  epoch: string;
}
export interface AgentProposal {
  proposalId: string;
  cursor: AgentCursor;
  edit: AgentEdit;
  resultDigest: string;
}
export type EditFailure = { ok: false; code: string; message: string };
export type EditReceipt = EditFailure | { ok: true; revision: string; digest: string };
export const failure = (code: string, message: string): EditFailure => ({
  ok: false,
  code,
  message,
});

export function documentCursor(document: UiDocument, revision: string, epoch: string): AgentCursor {
  return {
    documentId: document.id,
    revision,
    digest: canonicalUiDocument(document).contentDigest,
    epoch,
  };
}

export function prepareAgentEdit(
  document: UiDocument,
  cursor: AgentCursor,
  input: unknown,
  requestId: string,
): EditFailure | { ok: true; draft: TransactionDraft; document: UiDocument; digest: string } {
  const parsed = agentEditSchema.safeParse(input);
  if (!parsed.success)
    return failure(
      'STUDIO_AGENT_INVALID_EDIT',
      'Use the declared add, modify, move or remove contract.',
    );
  if (
    document.id !== cursor.documentId ||
    canonicalUiDocument(document).contentDigest !== cursor.digest
  )
    return failure(
      'UI_DOC_STALE_REVISION',
      'The screen changed. Read the current screen before requesting another edit.',
    );
  if (parsed.data.expectedRevision !== cursor.revision)
    return failure(
      'STUDIO_AGENT_REVISION_MISMATCH',
      `The edit supplied the wrong working revision. Read the screen and copy expectedRevision exactly: ${JSON.stringify(cursor.revision)}. document.revision is source metadata, not the editing revision. This request applied no edits.`,
    );
  let working = document;
  const commands: UiEditCommand[] = [];
  try {
    for (const operation of parsed.data.operations) {
      const next: UiEditCommand[] = [];
      if (operation.op === 'add') {
        const recipe = screenRecipes.find((recipe) => recipe.id === operation.recipe)!;
        next.push(
          ...insertSubtree(requestId, recipe.create(operation.nodeId), {
            nodeId: operation.parentId,
            slotName: operation.slotName,
            index: operation.index,
          }).commands,
        );
        // A generated form field is independent by default. Do not bind every new field
        // to the palette demo's shared message value or manufacture backend behavior.
        if (operation.recipe === 'input') {
          next.push(
            { op: 'setAttribute', nodeId: operation.nodeId, name: 'value' },
            { op: 'connectInteraction', nodeId: operation.nodeId, remove: { on: 'change' } },
          );
        }
      }
      if (operation.op === 'move')
        next.push({
          op: 'move',
          nodeId: operation.nodeId,
          newParentId: operation.newParentId,
          slotName: operation.slotName,
          index: operation.index,
        });
      if (operation.op === 'remove')
        next.push({ op: 'remove', nodeId: operation.nodeId, detachFromParent: true });
      if (operation.op === 'add' || operation.op === 'modify') {
        // Recipe IDs are known, so a fresh recipe's direct text child is addressable
        // before the assembled transaction is applied.
        const fresh =
          operation.op === 'add'
            ? screenRecipes
                .find((recipe) => recipe.id === operation.recipe)!
                .create(operation.nodeId)
            : [];
        if (operation.text !== undefined) {
          const target = literalTextTarget(working, operation.nodeId);
          const textId = fresh.find((node) => node.kind === 'text')?.id ?? target?.nodeId;
          if (!textId)
            return failure(
              'STUDIO_AGENT_TEXT_TARGET',
              'This element has no direct literal text. Use attributes or component props.',
            );
          if (target?.prop)
            next.push({
              op: 'bindExpression',
              nodeId: textId,
              target: { kind: 'prop', name: target.prop },
              expression: { type: 'literal', value: operation.text },
            });
          else
            next.push({
              op: 'setProperty',
              nodeId: textId,
              property: 'textLiteral',
              value: operation.text,
            });
        }
        for (const [name, value] of Object.entries(operation.attributes ?? {}))
          next.push({
            op: 'setAttribute',
            nodeId: operation.nodeId,
            name,
            value: typeof value === 'string' ? value : { type: 'literal', value },
          });
        for (const [name, value] of Object.entries(operation.props ?? {}))
          next.push({
            op: 'bindExpression',
            nodeId: operation.nodeId,
            target: { kind: 'prop', name },
            expression: { type: 'literal', value },
          });
        for (const [property, value] of Object.entries(operation.styles ?? {}))
          next.push({
            op: 'setStyleDeclaration',
            nodeId: operation.nodeId,
            property,
            value: { type: 'text', value },
          });
      }
      if (!next.length) return failure('STUDIO_AGENT_EMPTY_EDIT', 'Supply a property to modify.');
      const result = applyUiEdit(
        { document: working, revision: cursor.revision },
        { requestId, expectedDocumentRevision: cursor.revision, commands: next },
        designerCatalogs,
      );
      if (!result.ok)
        return failure(
          'STUDIO_AGENT_VALIDATION',
          'Edit rejected: ' +
            result.issues
              .map((issue) => issue.code)
              .slice(0, 5)
              .join(', '),
        );
      working = result.document;
      commands.push(...next);
    }
    const issues = screenIssues(working);
    if (issues.length)
      return failure(
        'STUDIO_AGENT_VALIDATION',
        'Edit rejected: ' +
          issues
            .map((issue) => issue.code)
            .slice(0, 5)
            .join(', '),
      );
    if (JSON.stringify(working).length > 200_000 || Object.keys(working.nodes).length > 500)
      return failure('STUDIO_AGENT_LIMIT', 'This screen exceeds the Cycle 1.1 editing limit.');
    return {
      ok: true,
      draft: { requestId, reason: parsed.data.reason, commands },
      document: working,
      digest: canonicalUiDocument(working).contentDigest,
    };
  } catch {
    return failure(
      'STUDIO_AGENT_INVALID_EDIT',
      'The edit could not be validated. The screen was preserved.',
    );
  }
}

/** Synchronous compare/validate/apply: no asynchronous gap before EditorBridge.apply. */
export function applyAgentProposal(
  bridge: EditorBridge,
  proposal: AgentProposal,
  epoch: string,
  draftBlocked: boolean,
): EditReceipt {
  if (draftBlocked)
    return failure(
      'STUDIO_AGENT_DRAFT',
      'Apply or cancel the pending property, data, rename or source draft, then send a new request.',
    );
  const current = documentCursor(bridge.document, bridge.getSnapshot().revision, epoch);
  if (JSON.stringify(current) !== JSON.stringify(proposal.cursor))
    return failure(
      'UI_DOC_STALE_REVISION',
      'The screen changed while the agent was working. No edit was applied; send a new request using the current screen.',
    );
  const prepared = prepareAgentEdit(bridge.document, current, proposal.edit, proposal.proposalId);
  if (!prepared.ok) return prepared;
  if (prepared.digest !== proposal.resultDigest)
    return failure(
      'STUDIO_AGENT_DIGEST',
      'The proposed result did not match validation. No edit was applied.',
    );
  const applied = bridge.apply(prepared.draft);
  if (!applied.ok)
    return failure(
      'STUDIO_AGENT_VALIDATION',
      'The editor refused this edit: ' + applied.issues.map((issue) => issue.code).join(', '),
    );
  const snapshot = bridge.getSnapshot();
  return { ok: true, revision: snapshot.revision, digest: snapshot.contentDigest };
}

export function agentContext(document: UiDocument, cursor: AgentCursor, selection?: string) {
  const occurrence = selection ? resolveOccurrence(selection, document) : undefined;
  return {
    // Match the edit argument's name so the model need not infer a token from
    // saved source metadata. This remains an opaque compare-and-apply guard.
    expectedRevision: cursor.revision,
    cursor,
    document,
    selection: occurrence
      ? {
          occurrence: selection,
          nodeId: occurrence.sourceNodeId,
          repeated: !!occurrence.repeatKeys.length,
          instancePath: occurrence.instancePath,
        }
      : null,
    palette: screenRecipes.map(({ id, label, description }) => ({ id, label, description })),
    components: catalogDescriptors.filter((descriptor) =>
      screenRecipes.some((recipe) =>
        recipe
          .create('example')
          .some((node) => node.kind === 'component' && node.definitionId === descriptor.id),
      ),
    ),
    actionInputs,
    actions: designerCatalogs.actionIds,
    editing:
      'Copy top-level expectedRevision exactly into each edit; document.revision is saved source metadata and MUST NOT be used as expectedRevision. add(recipe,nodeId,parentId,slotName?,index?,text?,attributes?,props?,styles?), modify(nodeId,text?,attributes?,props?,styles?), move(nodeId,newParentId,slotName?,index?), remove(nodeId). Use exact existing node IDs. Each batch is atomic and one Undo. Never claim save or backend implementation. Form fields are independent local preview inputs; backend authoring is outside Cycle 1.1.',
  };
}
