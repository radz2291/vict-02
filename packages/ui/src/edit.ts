/**
 * `vict.ui-edit@1` — transactional edit commands (API-SPEC §6.1).
 *
 * Atomic: every command applies to a deep snapshot; the whole transaction
 * is validated afterwards; any failure rejects the WHOLE transaction with
 * no partial mutation (`UI_EDIT_VALIDATION_FAILED` carries per-command
 * diagnostics). Destructive `remove` checks remaining references.
 * Validation never throws and never executes author code.
 */

import type {
  UiAttributeValue,
  UiComponentDefinition,
  UiDocument,
  UiExpression,
  UiInteraction,
  UiNode,
  UiPropDecl,
  UiStyleDeclaration,
  UiStyleValue,
  UiTextContent,
} from './document.js';
import { UI_DOCUMENT_SCHEMA } from './document.js';
import { uiDiagnostic, type UiDiagnostic } from './diagnostics.js';
import { validateUiDocument } from './validate.js';
import type { UiCatalogs } from './document.js';

export interface UiEditCommandInsert {
  readonly op: 'insert';
  readonly parentId: string;
  /** Where to insert among the parent's ordered children (default: end). */
  readonly index?: number;
  readonly node: UiNode;
}
export interface UiEditCommandMove {
  readonly op: 'move';
  readonly nodeId: string;
  readonly newParentId: string;
  readonly index?: number;
}
export interface UiEditCommandRemove {
  readonly op: 'remove';
  readonly nodeId: string;
}
export interface UiEditCommandSetProperty {
  readonly op: 'setProperty';
  readonly nodeId: string;
  /** Closed property vocabulary for the editor boundary. */
  readonly property: 'tag' | 'textLiteral' | 'itemName' | 'definitionId' | 'slotName';
  readonly value: string;
}
export interface UiEditCommandSetAttribute {
  readonly op: 'setAttribute';
  readonly nodeId: string;
  readonly name: string;
  /** `undefined` removes the attribute. */
  readonly value?: UiAttributeValue;
}
export interface UiEditCommandSetStyleDeclaration {
  readonly op: 'setStyleDeclaration';
  readonly nodeId: string;
  readonly property: string;
  readonly value?: UiStyleValue;
}
export interface UiEditCommandSetConditionState {
  readonly op: 'setConditionState';
  readonly conditionId: string;
  readonly patch: Partial<{ readonly query: string; readonly initial: string | number | boolean }>;
}
export interface UiEditCommandBindExpression {
  readonly op: 'bindExpression';
  readonly nodeId: string;
  readonly target:
    | { readonly kind: 'text' }
    | { readonly kind: 'attribute'; readonly name: string }
    | { readonly kind: 'prop'; readonly name: string };
  readonly expression?: UiExpression;
}
export interface UiEditCommandConnectInteraction {
  readonly op: 'connectInteraction';
  readonly nodeId: string;
  readonly interaction?: UiInteraction;
  /** Replace the interaction declared for the same `on` event when omitted. */
  readonly remove?: { readonly on: UiInteraction['on'] };
}
export interface UiEditCommandCreateComponentDefinition {
  readonly op: 'createComponentDefinition';
  readonly definition: UiComponentDefinition;
}
export interface UiEditCommandUpdateComponentDefinition {
  readonly op: 'updateComponentDefinition';
  readonly definitionId: string;
  readonly patch: Partial<
    Pick<UiComponentDefinition, 'revision' | 'props' | 'slots' | 'baseStyle'>
  >;
}
export interface UiEditCommandFillSlot {
  readonly op: 'fillSlot';
  readonly nodeId: string;
  readonly slotName: string;
  readonly children: readonly string[];
}

export type UiEditCommand =
  | UiEditCommandInsert
  | UiEditCommandMove
  | UiEditCommandRemove
  | UiEditCommandSetProperty
  | UiEditCommandSetAttribute
  | UiEditCommandSetStyleDeclaration
  | UiEditCommandSetConditionState
  | UiEditCommandBindExpression
  | UiEditCommandConnectInteraction
  | UiEditCommandCreateComponentDefinition
  | UiEditCommandUpdateComponentDefinition
  | UiEditCommandFillSlot;

export interface UiEditTransaction {
  readonly requestId: string;
  readonly expectedDocumentRevision: string;
  readonly reason?: string;
  readonly commands: readonly UiEditCommand[];
}

/** The editor's addressable unit: the working document + its revision. */
export interface UiDocumentSnapshot {
  readonly document: UiDocument;
  readonly revision: string;
}

export type UiEditResult =
  | { readonly ok: true; readonly document: UiDocument; readonly revision: string; readonly requestId: string }
  | { readonly ok: false; readonly issues: readonly UiDiagnostic[] };

/** Deep clone via structured clone semantics for plain data (JSON round trip). */
export function cloneDocument(document: UiDocument): UiDocument {
  return JSON.parse(JSON.stringify(document)) as UiDocument;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Apply one transaction atomically. Pure: the input snapshot is never
 * mutated. On success the returned document is a fresh object with an
 * unchanged document.revision (revisions advance at the session/save
 * boundary; the session assigns the working revision).
 */
export function applyUiEdit(
  snapshot: UiDocumentSnapshot,
  transaction: UiEditTransaction,
  catalogs?: UiCatalogs,
): UiEditResult {
  const issues: UiDiagnostic[] = [];
  if (transaction.expectedDocumentRevision !== snapshot.revision) {
    return {
      ok: false,
      issues: [
        uiDiagnostic('UI_DOC_STALE_REVISION', 'The transaction targets a stale revision.', {
          expectedRevision: transaction.expectedDocumentRevision,
          storedRevision: snapshot.revision,
        }),
      ],
    };
  }
  if (!Array.isArray(transaction.commands) || transaction.commands.length === 0) {
    return {
      ok: false,
      issues: [uiDiagnostic('UI_EDIT_VALIDATION_FAILED', 'A transaction needs at least one command.', { commandIndex: 0, diagnostics: [] })],
    };
  }
  const working = cloneDocument(snapshot.document);
  // Normalize registries to mutable records.
  const doc = working as unknown as {
    nodes: Record<string, UiNode>;
    componentDefinitions: Record<string, UiComponentDefinition>;
    styleSources: Record<string, { id: string; declarations: UiStyleDeclaration[]; conditionId?: string }>;
    tokens: Record<string, { id: string; value: string }>;
    conditions: Record<string, { id: string; kind: string; [key: string]: unknown }>;
    assets: Record<string, { id: string; kind: string; [key: string]: unknown }>;
    localState: Record<string, { key: string; type: string; initial: string | number | boolean }>;
  };
  doc.nodes = { ...(doc.nodes ?? {}) };
  doc.componentDefinitions = { ...(doc.componentDefinitions ?? {}) };
  doc.styleSources = { ...(doc.styleSources ?? {}) };
  doc.tokens = { ...(doc.tokens ?? {}) };
  doc.conditions = { ...(doc.conditions ?? {}) };
  doc.localState = { ...(doc.localState ?? {}) };

  transaction.commands.forEach((command, commandIndex) => {
    const fail = (message: string, diagnostics: UiDiagnostic[] = []): void => {
      issues.push(
        uiDiagnostic('UI_EDIT_VALIDATION_FAILED', message, { commandIndex, diagnostics }),
      );
    };
    switch (command.op) {
      case 'insert': {
        const parent = doc.nodes[command.parentId];
        if (parent === undefined) {
          fail(`Insert parent '${command.parentId}' does not exist.`);
          return;
        }
        if (parent.kind !== 'element' && parent.kind !== 'portal') {
          fail(`Insert parent '${command.parentId}' cannot own children (${parent.kind}).`);
          return;
        }
        const node = command.node;
        if (
          typeof node !== 'object' ||
          node === null ||
          Array.isArray(node) ||
          typeof node.id !== 'string' ||
          node.id.length === 0
        ) {
          fail('Inserted node needs a non-empty id.');
          return;
        }
        if (doc.nodes[node.id] !== undefined) {
          fail(`Node id '${node.id}' already exists.`, [
            uiDiagnostic('UI_DOC_DUPLICATE_NODE_ID', `Node id '${node.id}' already exists.`, {
              documentId: String(working.id),
              nodeId: node.id,
            }),
          ]);
          return;
        }
        const children = [...(parent.children as readonly string[])];
        const index = command.index ?? children.length;
        if (index < 0 || index > children.length) {
          fail(`Insert index ${String(command.index)} out of range.`);
          return;
        }
        children.splice(index, 0, node.id);
        doc.nodes[node.id] = node;
        const updatedParent: UiNode =
          parent.kind === 'element' ? { ...parent, children } : { ...parent, children };
        doc.nodes[updatedParent.id] = updatedParent;
        return;
      }
      case 'move': {
        const node = doc.nodes[command.nodeId];
        const newParent = doc.nodes[command.newParentId];
        if (node === undefined || newParent === undefined) {
          fail('Move source or target does not exist.');
          return;
        }
        if (newParent.kind !== 'element' && newParent.kind !== 'portal') {
          fail(`Move target '${command.newParentId}' cannot own children.`);
          return;
        }
        if (command.nodeId === command.newParentId) {
          fail('A node cannot become its own parent.');
          return;
        }
        // Guard: moving into own subtree would create a containment cycle.
        if (subtreeContains(doc.nodes, command.nodeId, command.newParentId)) {
          fail('Move would create a containment cycle.', [
            uiDiagnostic('UI_DOC_CYCLE', 'Move would create a containment cycle.', {
              documentId: String(working.id),
              path: [command.nodeId, command.newParentId],
            }),
          ]);
          return;
        }
        detach(doc.nodes, command.nodeId);
        const children = [...(newParent.children as readonly string[])];
        const index = command.index ?? children.length;
        if (index < 0 || index > children.length) {
          fail(`Move index ${String(command.index)} out of range.`);
          return;
        }
        children.splice(index, 0, command.nodeId);
        const updatedTarget: UiNode =
          newParent.kind === 'element' ? { ...newParent, children } : { ...newParent, children };
        doc.nodes[updatedTarget.id] = updatedTarget;
        return;
      }
      case 'remove': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined) {
          fail(`Remove target '${command.nodeId}' does not exist.`);
          return;
        }
        if (command.nodeId === working.root) {
          fail('The root node cannot be removed.');
          return;
        }
        const remaining = collectReferences(doc, command.nodeId);
        if (remaining.length > 0) {
          fail(`Node '${command.nodeId}' is still referenced.`, [
            uiDiagnostic('UI_EDIT_REFERENCE_REMAINS', `Node '${command.nodeId}' is still referenced.`, {
              nodeId: command.nodeId,
              remainingRefs: remaining,
            }),
          ]);
          return;
        }
        detach(doc.nodes, command.nodeId);
        // Remove the subtree owned solely by this node.
        for (const ownedId of collectNodeSubtree(doc.nodes, command.nodeId)) {
          const stillReferenced = collectReferences(doc, ownedId);
          if (stillReferenced.length === 0 && ownedId !== working.root) {
            delete doc.nodes[ownedId];
          }
        }
        delete doc.nodes[command.nodeId];
        return;
      }
      case 'setProperty': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined) {
          fail(`setProperty target '${command.nodeId}' does not exist.`);
          return;
        }
        if (command.property === 'tag' && node.kind === 'element') {
          doc.nodes[node.id] = { ...node, tag: command.value };
        } else if (command.property === 'textLiteral' && node.kind === 'text') {
          const content: UiTextContent = { type: 'literal', value: command.value };
          doc.nodes[node.id] = { ...node, content };
        } else if (command.property === 'itemName' && node.kind === 'repeat') {
          doc.nodes[node.id] = { ...node, itemName: command.value };
        } else if (command.property === 'definitionId' && node.kind === 'component') {
          doc.nodes[node.id] = { ...node, definitionId: command.value };
        } else if (command.property === 'slotName' && node.kind === 'slot') {
          doc.nodes[node.id] = { ...node, name: command.value };
        } else {
          fail(`setProperty ${command.property} does not apply to node kind.`);
        }
        return;
      }
      case 'setAttribute': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined || node.kind !== 'element') {
          fail('setAttribute requires an element node.');
          return;
        }
        const attributes: Record<string, UiAttributeValue> = { ...(node.attributes ?? {}) };
        if (command.value === undefined) delete attributes[command.name];
        else attributes[command.name] = command.value;
        doc.nodes[node.id] = { ...node, attributes };
        return;
      }
      case 'setStyleDeclaration': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined) {
          fail('setStyleDeclaration target does not exist.');
          return;
        }
        const localStyle: UiStyleDeclaration[] = [...(node.localStyle ?? [])];
        const existingIndex = localStyle.findIndex((declaration) => declaration.property === command.property);
        if (command.value === undefined) {
          if (existingIndex >= 0) localStyle.splice(existingIndex, 1);
        } else if (existingIndex >= 0) {
          localStyle[existingIndex] = { property: command.property, value: command.value };
        } else {
          localStyle.push({ property: command.property, value: command.value });
        }
        doc.nodes[node.id] = { ...node, localStyle } as UiNode;
        return;
      }
      case 'setConditionState': {
        const condition = doc.conditions[command.conditionId];
        if (condition === undefined) {
          fail(`Condition '${command.conditionId}' does not exist.`);
          return;
        }
        doc.conditions[command.conditionId] = { ...condition, ...command.patch };
        return;
      }
      case 'bindExpression': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined) {
          fail('bindExpression target does not exist.');
          return;
        }
        if (command.target.kind === 'text') {
          if (node.kind !== 'text') {
            fail('text binding requires a text node.');
            return;
          }
          if (command.expression === undefined) {
            fail('text binding needs an expression.');
            return;
          }
          const content: UiTextContent = { type: 'expression', expression: command.expression };
          doc.nodes[node.id] = { ...node, content };
          return;
        }
        if (command.target.kind === 'attribute') {
          if (node.kind !== 'element') {
            fail('attribute binding requires an element node.');
            return;
          }
          const attributes: Record<string, UiAttributeValue> = { ...(node.attributes ?? {}) };
          if (command.expression === undefined) delete attributes[command.target.name];
          else attributes[command.target.name] = command.expression;
          doc.nodes[node.id] = { ...node, attributes };
          return;
        }
        // prop binding
        if (node.kind !== 'component') {
          fail('prop binding requires a component node.');
          return;
        }
        const props: Record<string, UiExpression> = { ...(node.props ?? {}) };
        if (command.expression === undefined) delete props[command.target.name];
        else props[command.target.name] = command.expression;
        doc.nodes[node.id] = { ...node, props };
        return;
      }
      case 'connectInteraction': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined) {
          fail('connectInteraction target does not exist.');
          return;
        }
        const interactions: UiInteraction[] = [...(node.interactions ?? [])];
        if (command.remove !== undefined) {
          const filtered = interactions.filter((candidate) => candidate.on !== command.remove?.on);
          doc.nodes[node.id] = { ...node, interactions: filtered } as UiNode;
          return;
        }
        if (command.interaction === undefined) {
          fail('connectInteraction needs an interaction or a removal.');
          return;
        }
        const filtered = interactions.filter((candidate) => candidate.on !== command.interaction?.on);
        filtered.push(command.interaction);
        doc.nodes[node.id] = { ...node, interactions: filtered } as UiNode;
        return;
      }
      case 'createComponentDefinition': {
        const definition = command.definition;
        if (
          !isPlainObject(definition) ||
          typeof definition.id !== 'string' ||
          typeof definition.revision !== 'string' ||
          typeof definition.root !== 'string' ||
          doc.nodes[definition.root] === undefined
        ) {
          fail('createComponentDefinition needs a definition with an id, revision and an existing root.');
          return;
        }
        if (doc.componentDefinitions[definition.id] !== undefined) {
          fail(`Definition '${definition.id}' already exists.`);
          return;
        }
        doc.componentDefinitions[definition.id] = definition as unknown as UiComponentDefinition;
        return;
      }
      case 'updateComponentDefinition': {
        const definition = doc.componentDefinitions[command.definitionId];
        if (definition === undefined) {
          fail(`Definition '${command.definitionId}' does not exist.`);
          return;
        }
        doc.componentDefinitions[command.definitionId] = { ...definition, ...command.patch };
        return;
      }
      case 'fillSlot': {
        const node = doc.nodes[command.nodeId];
        if (node === undefined || node.kind !== 'component') {
          fail('fillSlot requires a component node.');
          return;
        }
        for (const childId of command.children) {
          if (doc.nodes[childId] === undefined) {
            fail(`Slot fill references missing node '${childId}'.`);
            return;
          }
        }
        const slots: Record<string, { name: string; children: readonly string[] }> = {};
        for (const [name, fill] of Object.entries(node.slots ?? {})) {
          slots[name] = { name: fill.name, children: [...fill.children] };
        }
        slots[command.slotName] = { name: command.slotName, children: [...command.children] };
        doc.nodes[node.id] = { ...node, slots } as UiNode;
        return;
      }
      default:
        fail('Unknown command.');
    }
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  // Whole-document validation AFTER all commands applied (atomic semantics).
  const validation = validateUiDocument(working, catalogs ?? emptyCatalogs());
  if (validation.some((issue) => issue.severity === 'error')) {
    return {
      ok: false,
      issues: [
        uiDiagnostic('UI_EDIT_VALIDATION_FAILED', 'The resulting document does not validate.', {
          commandIndex: transaction.commands.length - 1,
          diagnostics: validation.filter((issue) => issue.severity === 'error'),
        }),
      ],
    };
  }
  return { ok: true, document: working, revision: snapshot.revision, requestId: transaction.requestId };
}

/** A permissive standalone catalog for transactions (host catalogs tighten). */
export function emptyCatalogs(): UiCatalogs {
  return {
    elements: { elements: [], globalAttributes: ['role', 'aria-label', 'data-test-id'] },
  };
}

function subtreeContains(
  nodes: Record<string, UiNode>,
  ancestorId: string,
  maybeDescendantId: string,
): boolean {
  return collectNodeSubtree(nodes, ancestorId).has(maybeDescendantId);
}

function detach(nodes: Record<string, UiNode>, nodeId: string): void {
  for (const node of Object.values(nodes)) {
    if (node.kind === 'element' || node.kind === 'portal') {
      if (node.children.includes(nodeId)) {
        nodes[node.id] = {
          ...node,
          children: (node.children as readonly string[]).filter((child) => child !== nodeId),
        } as UiNode;
      }
    } else if (node.kind === 'repeat' && node.templateRoot === nodeId) {
      nodes[node.id] = { ...node, templateRoot: '' } as UiNode;
    } else if (node.kind === 'slot' && (node.fallback ?? []).includes(nodeId)) {
      nodes[node.id] = {
        ...node,
        fallback: (node.fallback as readonly string[]).filter((child) => child !== nodeId),
      } as UiNode;
    } else if (node.kind === 'conditional') {
      let changed = false;
      const branches = node.branches.map((branch) => {
        if (branch.children.includes(nodeId)) {
          changed = true;
          return { ...branch, children: branch.children.filter((child) => child !== nodeId) };
        }
        return branch;
      });
      if (changed) nodes[node.id] = { ...node, branches };
    } else if (node.kind === 'component' && node.slots !== undefined) {
      let changed = false;
      const slots: Record<string, { name: string; children: readonly string[] }> = {};
      for (const [name, fill] of Object.entries(node.slots)) {
        if (fill.children.includes(nodeId)) {
          changed = true;
          slots[name] = { name: fill.name, children: fill.children.filter((child) => child !== nodeId) };
        } else {
          slots[name] = fill;
        }
      }
      if (changed) nodes[node.id] = { ...node, slots } as UiNode;
    }
  }
}

/** Every structural reference to `nodeId` still held by OTHER nodes. */
function collectReferences(
  doc: {
    nodes: Record<string, UiNode>;
    componentDefinitions: Record<string, UiComponentDefinition>;
  },
  nodeId: string,
): string[] {
  const refs: string[] = [];
  for (const node of Object.values(doc.nodes)) {
    if (node.id === nodeId) continue;
    if (node.kind === 'element' || node.kind === 'portal') {
      if (node.children.includes(nodeId)) refs.push(`${node.id}.children`);
    } else if (node.kind === 'repeat') {
      if (node.templateRoot === nodeId) refs.push(`${node.id}.templateRoot`);
    } else if (node.kind === 'slot') {
      if ((node.fallback ?? []).includes(nodeId)) refs.push(`${node.id}.fallback`);
    } else if (node.kind === 'conditional') {
      node.branches.forEach((branch, index) => {
        if (branch.children.includes(nodeId)) refs.push(`${node.id}.branches.${index}`);
      });
    } else if (node.kind === 'component' && node.slots !== undefined) {
      for (const [name, fill] of Object.entries(node.slots)) {
        if (fill.children.includes(nodeId)) refs.push(`${node.id}.slots.${name}`);
      }
    }
  }
  for (const definition of Object.values(doc.componentDefinitions)) {
    if (definition.root === nodeId) refs.push(`${definition.id}.root`);
    for (const [slotName, slot] of Object.entries(definition.slots ?? {})) {
      if ((slot.fallback ?? []).includes(nodeId)) refs.push(`${definition.id}.slots.${slotName}.fallback`);
    }
  }
  return refs;
}

function collectNodeSubtree(nodes: Record<string, UiNode>, rootId: string): Set<string> {
  const into = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (into.has(id)) continue;
    into.add(id);
    const node = nodes[id];
    if (node === undefined) continue;
    if (node.kind === 'element' || node.kind === 'portal') stack.push(...node.children);
    else if (node.kind === 'repeat') stack.push(node.templateRoot);
    else if (node.kind === 'slot') stack.push(...(node.fallback ?? []));
    else if (node.kind === 'conditional') node.branches.forEach((branch) => stack.push(...branch.children));
    else if (node.kind === 'component' && node.slots !== undefined) {
      for (const fill of Object.values(node.slots)) stack.push(...fill.children);
    }
  }
  return into;
}

/** Non-empty schema marker guard shared by session save paths. */
export function expectUiDocument(document: unknown): UiDocument {
  if (!isPlainObject(document) || document.schema !== UI_DOCUMENT_SCHEMA) {
    throw new TypeError('Expected a vict.ui-document@1 document.');
  }
  return document as unknown as UiDocument;
}

export type { UiPropDecl };
