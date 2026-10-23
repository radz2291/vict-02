/** Cycle 1.1: a bounded palette vocabulary compiled to the manual editor's transactions. */
import { z } from 'zod';
import {
  applyUiEdit,
  canonicalUiDocument,
  isUiValueOfType,
  type UiDocument,
  type UiEditCommand,
} from '@victframework/ui';
import {
  insertRecipe,
  wireNativeInput,
  interactiveSlotConflicts,
  compositionChildren,
  canInsertRecipe,
  literalTextTarget,
  resolveOccurrence,
  type EditorBridge,
  type TransactionDraft,
} from '@victframework/ui-editor';
import { screenRecipes } from './recipes.js';
import { catalogDescriptors, designerCatalogs, screenIssues, compileScreen, actionInputs } from './application.js';

const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_.:-]+$/)
  .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
const value = z.union([scalar, z.array(z.string().max(4000)).max(100), z.array(z.number().finite()).max(100)]);
const expression = z.union([
  z.object({ type: z.literal('literal'), value: scalar }).strict(),
  z.object({ type: z.literal('ref'), path: z.string().min(1).max(300) }).strict(),
]);
const content = {
  text: z.string().max(4000).optional(),
  headingLevel:z.number().int().min(1).max(6).optional(),
  attributes: z.record(id, scalar).optional(),
  props: z.record(id, value).optional(),
  styles: z.record(z.string().min(1).max(80), z.string().max(500)).optional(),
};
const position = { slotName: id.optional(), index: z.number().int().min(0).max(1000).optional() };
export const agentOperationSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add'),
      recipe: z.enum(screenRecipes.map(recipe => recipe.id) as [string, ...string[]]),
      nodeId: id,
      parentId: id,
      ...position,
      replacePlaceholder: z.boolean().optional(),
      ...content,
    })
    .strict(),
  z.object({ op: z.literal('declareState'), key: id.refine(value => /^[a-zA-Z0-9_-]+$/.test(value), 'Use a simple local state key.'), type: z.enum(['string','number','boolean']), initial: scalar }).strict(),
  z.object({ op: z.literal('wireInput'), nodeId: id, key: id.refine(value => /^[a-zA-Z0-9_-]+$/.test(value), 'Use a simple local state key.'), initial: scalar.optional() }).strict(),
  z.object({ op: z.literal('modify'), nodeId: id, ...content }).strict(),
  z.object({ op: z.literal('move'), nodeId: id, newParentId: id, ...position }).strict(),
  z.object({ op: z.literal('remove'), nodeId: id }).strict(),
  z.object({ op: z.literal('bind'), nodeId: id, prop: id, expression: expression.optional() }).strict(),
  z.object({ op: z.literal('connect'), nodeId: id, output: id, binding: z.union([
    z.object({ setState: z.object({ key: id, value: expression.optional() }).strict() }).strict(),
    z.object({ invokeAction: z.object({ actionId: id, input: z.record(id, expression).optional() }).strict() }).strict(),
  ]).optional() }).strict(),
]);
export const agentEditSchema = z
  .object({
    expectedRevision: z.string().min(1).max(160),
    reason: z.string().min(1).max(240),
    operations: z.array(agentOperationSchema).min(1).max(40),
  })
  .strict();
/** Shared safe refusal guidance for browser preparation and provider contract validation. */
export function agentEditDiagnostics(error:z.ZodError,input?:unknown) {
 const operations=input && typeof input==='object' && Array.isArray((input as {operations?:unknown}).operations) ? (input as {operations:unknown[]}).operations : [];
 const shape:Record<string,string>={add:'add(recipe,nodeId,parentId,slotName?,index?,text?,headingLevel?,attributes?,props?,styles?)',modify:'modify(nodeId,text?,headingLevel?,attributes?,props?,styles?)',move:'move(nodeId,newParentId,slotName?,index?)',remove:'remove(nodeId)',bind:'bind(nodeId,prop,expression?)',connect:'connect(nodeId,output,binding?)',declareState:'declareState(key,type:string|number|boolean,initial:matchingScalar)',wireInput:'wireInput(nodeId,key,initial?)'};
 return error.issues.slice(0,8).map(issue=>{
  const operation=typeof issue.path[1]==='number' ? issue.path[1] : undefined;
  const path=issue.path.join('.');let expected='';
  if(path.includes('.expression'))expected='Expected exactly {type:"literal",value:scalar} OR {type:"ref",path:"state.key"}; no extra fields. Example: {"type":"ref","path":"state.accepted"}.';
  else if(path.includes('.binding'))expected='Expected {setState:{key,value?:literalOrRef}} OR {invokeAction:{actionId,input?:{field:literalOrRef}}}; no extra fields. Example: {"setState":{"key":"accepted"}}.';
  else if(path.includes('.props'))expected='Expected a property record of scalar values or homogeneous string[]/number[] (max100). Example: {"options":["one","two"]}; mixed lists and object arrays are unsupported.';
  else if(path.endsWith('.initial')||path.includes('.attributes'))expected='Expected string (max4000), finite number, or boolean. Expressions use bind/wireInput instead of attributes.';
  else if(operation!==undefined){const value=operations[operation];const op=value && typeof value==='object' ? (value as {op?:unknown}).op : undefined;expected=typeof op==='string' && shape[op] ? 'Expected '+shape[op]+'.' : 'Expected a declared add/modify/move/remove/bind/connect/declareState/wireInput operation.';}
  return {...(operation===undefined ? {} : {operation}),path,message:(expected+' '+issue.message).trim().slice(0,700)};
 });
}
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
export type EditFailure = { ok: false; code: string; message: string; diagnostics?: readonly { operation?: number; path: string; message: string }[] };
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
  if (!parsed.success) return { ...failure('STUDIO_AGENT_INVALID_EDIT', 'Use the exact operation fields. No edits applied.'), diagnostics:agentEditDiagnostics(parsed.error,input) };
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
    for (const [operationIndex, operation] of parsed.data.operations.entries()) {
      const next: UiEditCommand[] = [];
      if (operation.op === 'add') {
        const recipe = screenRecipes.find((recipe) => recipe.id === operation.recipe)!;
        if (!canInsertRecipe(recipe, working, { nodeId: operation.parentId, slotName: operation.slotName }))
          return failure('STUDIO_AGENT_COMPONENT_CONTEXT', 'This component part requires a compatible parent and declared slot. Read the recipe placements.');
        next.push(
          ...insertRecipe(requestId, recipe, working, operation.nodeId, {
            nodeId: operation.parentId,
            slotName: operation.slotName,
            index: operation.index,
          }).commands,
        );
        if (operation.replacePlaceholder !== false && operation.slotName) {
          const parent = working.nodes[operation.parentId];
          if (parent?.kind === 'component') {
            const parentRecipe = screenRecipes.find(recipe => recipe.id === parent.definitionId.replace('vict.catalog.', ''));
            const seeded = parentRecipe?.create(parent.id) ?? [];
            const root = seeded[0];
            const children = root?.kind === 'component' ? root.slots?.[operation.slotName]?.children ?? [] : [];
            const current = parent.slots?.[operation.slotName]?.children ?? [];
            const seedMap = new Map(seeded.map(node => [node.id,node]));
            const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([,child]) => !(child && typeof child === 'object' && Object.keys(child).length === 0)).sort(([a],[b]) => a.localeCompare(b)).map(([key,child]) => [key,normalized(child)])) : value;
            const unchanged = (nodeId: string): boolean => !!working.nodes[nodeId] && JSON.stringify(normalized(working.nodes[nodeId])) === JSON.stringify(normalized(seedMap.get(nodeId))) && compositionChildren(working.nodes[nodeId]!).every(unchanged);
            if (children.length && JSON.stringify(current) === JSON.stringify(children) && children.every(unchanged)) {
              next.unshift(...children.map(nodeId => ({ op: 'remove' as const, nodeId, detachFromParent: true })));
            }
          }
        }
      }
      if (operation.op === 'declareState') {
        if (Object.hasOwn(working.localState, operation.key)) return failure('STUDIO_AGENT_STATE_EXISTS', 'State already exists. Read state and bind its exact key; use a fresh key for an independent field.');
        if (typeof operation.initial !== operation.type) return failure('STUDIO_AGENT_STATE_TYPE', 'The starting value must match the declared scalar type.');
        next.push({ op: 'replaceDocument', document: { ...working, localState: { ...working.localState, [operation.key]: { key: operation.key, type: operation.type, initial: operation.initial } } } });
      }
      if (operation.op === 'wireInput') next.push(...wireNativeInput({ requestId, document: working, nodeId: operation.nodeId, key: operation.key, initial: operation.initial }).commands);
      if (operation.op === 'move') {
        const node = working.nodes[operation.nodeId];
        const recipe = node?.kind === 'component' ? screenRecipes.find(recipe => recipe.id === node.definitionId.replace('vict.catalog.', '')) : undefined;
        if (recipe && !canInsertRecipe(recipe, working, { nodeId: operation.newParentId, slotName: operation.slotName }))
          return failure('STUDIO_AGENT_COMPONENT_CONTEXT', 'This component part cannot move outside its compatible parent slot.');
        next.push({
          op: 'move',
          nodeId: operation.nodeId,
          newParentId: operation.newParentId,
          slotName: operation.slotName,
          index: operation.index,
        });
      }
      if (operation.op === 'remove')
        next.push({ op: 'remove', nodeId: operation.nodeId, detachFromParent: true });
      if (operation.op === 'bind' || operation.op === 'connect') {
        const node = working.nodes[operation.nodeId];
        const descriptor = node?.kind === 'component' ? catalogDescriptors.find(item => item.id === node.definitionId) : undefined;
        const supported = operation.op === 'bind' ? descriptor?.props.map(prop => prop.name) : descriptor?.outputs?.map(output => output.name);
        const field = operation.op === 'bind' ? operation.prop : operation.output;
        if (!supported?.includes(field)) return { ...failure('STUDIO_AGENT_PROPERTY', `Operation ${operationIndex}: unsupported ${operation.op === 'bind' ? 'prop' : 'output'} ${field}. Supported: ${supported?.join(', ') || '(none)'}. Native fields use wireInput.`), diagnostics: [{ operation: operationIndex, path: `operations.${operationIndex}.${operation.op === 'bind' ? 'prop' : 'output'}`, message: `Expected one of: ${supported?.join(', ') || '(none)'}` }] };
      }
      if (operation.op === 'bind')
        next.push({ op: 'bindExpression', nodeId: operation.nodeId, target: { kind: 'prop', name: operation.prop }, expression: operation.expression });
      if (operation.op === 'connect')
        next.push({ op: 'setOutputBinding', nodeId: operation.nodeId, output: operation.output, binding: operation.binding });
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
        if(operation.headingLevel !== undefined) {
          const node=operation.op === 'add' ? fresh[0] : working.nodes[operation.nodeId];
          if(node?.kind !== 'element' || !/^h[1-6]$/.test(node.tag)) return failure('STUDIO_AGENT_HEADING_TARGET','headingLevel requires an h1–h6 element. Use the heading recipe or modify an existing heading.');
          next.push({op:'setProperty',nodeId:operation.nodeId,property:'tag',value:`h${operation.headingLevel}`});
        }
        for (const [name, value] of Object.entries(operation.attributes ?? {}))
          next.push({
            op: 'setAttribute',
            nodeId: operation.nodeId,
            name,
            value: typeof value === 'string' ? value : { type: 'literal', value },
          });
        for (const [name, value] of Object.entries(operation.props ?? {})) {
          if (Array.isArray(value)) {
            // Lists are canonical typed state values, never expression literals.
            const staged = next.length ? applyUiEdit({ document: working, revision: cursor.revision },
              { requestId, expectedDocumentRevision: cursor.revision, commands: next }, designerCatalogs)
              : { ok: true as const, document: working };
            if (!staged.ok) return failure('STUDIO_AGENT_VALIDATION', 'The component could not be prepared for its list value.');
            const node = staged.document.nodes[operation.nodeId];
            const descriptor = node?.kind === 'component' ? catalogDescriptors.find(entry => entry.id === node.definitionId) : undefined;
            const prop = descriptor?.props.find(prop => prop.name === name);
            if (!prop || (prop.type !== 'stringList' && prop.type !== 'numberList') || !isUiValueOfType(value, prop.type))
              return failure('STUDIO_AGENT_VALIDATION', 'Use a homogeneous list matching the declared property type.');
            const current = node?.kind === 'component' ? node.props?.[name] : undefined;
            const boundKey = current?.type === 'ref' && current.path.startsWith('state.') ? current.path.slice(6) : undefined;
            const key = boundKey && staged.document.localState[boundKey]?.type === prop.type ? boundKey
              : `catalog_${operation.nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${name}`;
            const existing = staged.document.localState[key];
            if (existing && key !== boundKey) return failure('STUDIO_AGENT_VALIDATION', 'A local value already owns that identity; choose a different node ID.');
            next.push({ op: 'replaceDocument', document: { ...staged.document, localState: {
              ...staged.document.localState, [key]: { key, type: prop.type, initial: value },
            } } });
            next.push({ op: 'bindExpression', nodeId: operation.nodeId, target: { kind: 'prop', name }, expression: { type: 'ref', path: `state.${key}` } });
            continue;
          }
          next.push({
            op: 'bindExpression',
            nodeId: operation.nodeId,
            target: { kind: 'prop', name },
            expression: { type: 'literal', value },
          });
        }
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
          `Operation ${operationIndex} (${operation.op}) rejected by canonical authoring: ` + result.issues.slice(0,5).map(issue => `${issue.code}: ${issue.message}`).join('; '),
        );
      working = result.document;
      commands.push(...next);
    }
    // Neutral authoring deliberately returns partial plans with component diagnostics.
    // An agent completion must not promote those error diagnostics to a valid edit.
    const existingConflicts = new Set(interactiveSlotConflicts(document).map(issue => issue.id));
    const addedConflicts = interactiveSlotConflicts(working).filter(issue => !existingConflicts.has(issue.id));
    if (addedConflicts.length) return { ...failure('STUDIO_AGENT_INTERACTIVE_SLOT','A trigger/action/cancel slot already supplies a button. Use text or noninteractive content.'), diagnostics:addedConflicts.map(issue => ({path:`nodes.${issue.nodeId}`,message:`${issue.parentId}.${issue.slot} already owns the interactive trigger.`})) };
    const compiled = compileScreen(working);
    const issues = [
      ...screenIssues(working),
      ...(compiled.ok ? Object.values(compiled.plan.documentPlans ?? {}).flatMap(plan =>
        plan.diagnostics.filter(issue => issue.severity === 'error')) : []),
    ];
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

export { agentContext, agentReadSchema, agentReadPresentation, agentCoverage } from './agent-reads.js';
