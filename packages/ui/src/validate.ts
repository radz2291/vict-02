/**
 * `validateUiDocument` — structural, reference, scope and catalog
 * validation for one `vict.ui-document@1` document (API-SPEC §3).
 *
 * Validation never throws for invalid input and never executes author
 * code; every failure is a structured UiDiagnostic. Cross-document rules
 * (catalog resolution, expansion cycles across documents, product-reference
 * resolution against the application) live in `packages/application`'s
 * joint compilation per API-SPEC §2.2; this module validates ONE document
 * against the provided catalogs.
 */

import type {
  UiCatalogs,
  UiComponentDefinition,
  UiDocument,
  UiExpression,
  UiFieldType,
  UiInteraction,
  UiNode,
} from './document.js';
import { UI_DOCUMENT_SCHEMA } from './document.js';
import { hasErrors, uiDiagnostic, type UiDiagnostic } from './diagnostics.js';
import { checkExpression, type UiScopeInfo } from './expressions.js';
import { allowedAttributes, isKnownElement, isLeafElement } from './semantic.js';

export type { UiDocument };

interface ValidateContext {
  readonly document: UiDocument;
  readonly catalogs: UiCatalogs;
  readonly issues: UiDiagnostic[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Registries may be absent (lenient parse); they are then treated as empty. */
function registryOf(document: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = document[key];
  return isPlainObject(value) ? value : {};
}

/**
 * Validate one document. Returns every diagnostic found; callers decide
 * via `hasErrors` whether compilation may proceed.
 */
export function validateUiDocument(
  input: unknown,
  catalogs: UiCatalogs,
): readonly UiDiagnostic[] {
  const issues: UiDiagnostic[] = [];
  if (!isPlainObject(input)) {
    return [
      uiDiagnostic('UI_DOC_UNKNOWN_SCHEMA', 'A UI document must be a plain object.', {
        schema: '(not an object)',
        supported: [UI_DOCUMENT_SCHEMA],
      }),
    ];
  }
  const document = input as unknown as UiDocument;
  if (document.schema !== UI_DOCUMENT_SCHEMA) {
    issues.push(
      uiDiagnostic('UI_DOC_UNKNOWN_SCHEMA', `Unsupported UI document schema.`, {
        schema: String(document.schema),
        supported: [UI_DOCUMENT_SCHEMA],
      }),
    );
    return issues; // shape unknown; deeper checks would be meaningless
  }
  if (!nonEmptyString(document.id)) {
    issues.push(
      uiDiagnostic('UI_DOC_REFERENCE_DANGLING', 'A UI document must declare a non-empty id.', {
        documentId: String(document.id ?? ''),
        reference: 'document.id',
      }),
    );
  }
  if (!nonEmptyString(document.revision)) {
    issues.push(
      uiDiagnostic('UI_DOC_REFERENCE_DANGLING', 'A UI document must declare a non-empty revision.', {
        documentId: String(document.id ?? ''),
        reference: 'document.revision',
      }),
    );
  }
  if (!nonEmptyString(document.root)) {
    issues.push(
      uiDiagnostic('UI_DOC_REFERENCE_DANGLING', 'A UI document must declare a root node id.', {
        documentId: String(document.id ?? ''),
        reference: 'document.root',
      }),
    );
    return issues;
  }

  const docRecord = document as unknown as Record<string, unknown>;
  const nodes = registryOf(docRecord, 'nodes') as Record<string, UiNode>;
  const definitions = registryOf(docRecord, 'componentDefinitions') as Record<
    string,
    UiComponentDefinition
  >;
  const styleSources = registryOf(docRecord, 'styleSources');
  const tokens = registryOf(docRecord, 'tokens');
  const conditions = registryOf(docRecord, 'conditions');
  const localState = registryOf(docRecord, 'localState');

  const ctx: ValidateContext = { document, catalogs, issues };
  const documentId = String(document.id);

  // ---- node registry -----------------------------------------------------
  const knownIds = new Set<string>();
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!isPlainObject(node) || !nonEmptyString((node as UiNode).id)) {
      issues.push(
        uiDiagnostic('UI_DOC_UNKNOWN_NODE', 'Every node entry must be an object with an id.', {
          documentId,
          nodeId,
          missingChildId: nodeId,
        }),
      );
      continue;
    }
    if (node.id !== nodeId) {
      issues.push(
        uiDiagnostic(
          'UI_DOC_DUPLICATE_NODE_ID',
          `Node registry key '${nodeId}' does not match the node's own id '${node.id}'.`,
          { documentId, nodeId },
        ),
      );
    }
    if (knownIds.has(node.id)) {
      issues.push(
        uiDiagnostic('UI_DOC_DUPLICATE_NODE_ID', `Node id '${node.id}' is registered twice.`, {
          documentId,
          nodeId: node.id,
        }),
      );
    }
    knownIds.add(node.id);
  }

  // Reachability + dangling references + containment cycles (one walk).
  const childRefsOf = (node: UiNode): readonly string[] => {
    switch (node.kind) {
      case 'element':
        return node.children;
      case 'portal':
        return node.children;
      case 'repeat':
        return [node.templateRoot];
      case 'slot':
        return node.fallback ?? [];
      default:
        return [];
    }
  };
  const definitionSlotFillChildren = (node: UiNode): readonly { slot: string; children: readonly string[] }[] =>
    node.kind === 'component' && node.slots !== undefined
      ? Object.entries(node.slots).map(([slot, fill]) => ({ slot, children: fill.children }))
      : [];

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const innerRepeatScope = (node: Extract<UiNode, { kind: 'repeat' }>, scope: UiScopeInfo): UiScopeInfo => ({
    repeatItems: {
      ...scope.repeatItems,
      [node.itemName]: repeatItemFields(ctx, node.collection),
    },
    inDefinition: scope.inDefinition,
  });
  const visit = (nodeId: string, scope: UiScopeInfo): void => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      issues.push(
        uiDiagnostic('UI_DOC_CYCLE', 'Containment cycle in the node tree.', {
          documentId,
          path: [...path.slice(cycleStart === -1 ? 0 : cycleStart), nodeId],
        }),
      );
      return;
    }
    const node = nodes[nodeId];
    if (node === undefined) {
      issues.push(
        uiDiagnostic('UI_DOC_UNKNOWN_NODE', `Referenced node '${nodeId}' does not exist.`, {
          documentId,
          nodeId: path[path.length - 1] ?? String(document.root),
          missingChildId: nodeId,
        }),
      );
      return;
    }
    visiting.add(nodeId);
    path.push(nodeId);
    validateNode(ctx, node, scope, nodes);
    if (node.kind === 'repeat') {
      const inner = innerRepeatScope(node, scope);
      visit(node.templateRoot, inner);
    } else {
      for (const childId of childRefsOf(node)) visit(childId, scope);
    }
    for (const fill of definitionSlotFillChildren(node)) {
      for (const childId of fill.children) visit(childId, scope);
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  visit(String(document.root), { repeatItems: {}, inDefinition: false });

  // Definition bodies: prop-only scope; their nodes are owned by the
  // definition (not orphans). Slot fallbacks inside a definition body stay
  // in the definition scope; instance slot fills authored inside a body are
  // resolved in that body's scope.
  for (const definition of Object.values(definitions)) {
    const defScope: UiScopeInfo = { repeatItems: {}, inDefinition: true };
    const stack: { id: string; scope: UiScopeInfo }[] = [{ id: definition.root, scope: defScope }];
    const defSeen = new Set<string>();
    while (stack.length > 0) {
      const entry = stack.pop() as { id: string; scope: UiScopeInfo };
      const nodeId = entry.id;
      if (defSeen.has(nodeId)) continue;
      defSeen.add(nodeId);
      const node = nodes[nodeId];
      if (node === undefined) {
        issues.push(
          uiDiagnostic('UI_DOC_UNKNOWN_NODE', `Definition body references missing node '${nodeId}'.`, {
            documentId,
            nodeId: definition.root,
            missingChildId: nodeId,
          }),
        );
        continue;
      }
      validateNode(ctx, node, entry.scope, nodes);
      if (node.kind === 'repeat') {
        stack.push({ id: node.templateRoot, scope: innerRepeatScope(node, entry.scope) });
      } else if (node.kind === 'element' || node.kind === 'portal') {
        for (const childId of node.children) stack.push({ id: childId, scope: entry.scope });
      } else if (node.kind === 'slot') {
        for (const childId of node.fallback ?? []) stack.push({ id: childId, scope: entry.scope });
      } else if (node.kind === 'conditional') {
        for (const branch of node.branches) {
          for (const childId of branch.children) stack.push({ id: childId, scope: entry.scope });
        }
      }
      if (node.kind === 'component' && node.slots !== undefined) {
        for (const fill of Object.values(node.slots)) {
          for (const childId of fill.children) stack.push({ id: childId, scope: entry.scope });
        }
      }
      visited.add(nodeId);
    }
  }

  // Ordered reference integrity: a node may never have two owners.
  const ownerCount = new Map<string, number>();
  const countOwner = (ownerId: string, owned: readonly string[] | undefined): void => {
    for (const childId of owned ?? []) {
      ownerCount.set(childId, (ownerCount.get(childId) ?? 0) + 1);
      void ownerId;
    }
  };
  for (const node of Object.values(nodes)) {
    if (node.kind === 'element' || node.kind === 'portal') countOwner(node.id, node.children);
    else if (node.kind === 'repeat') countOwner(node.id, [node.templateRoot]);
    else if (node.kind === 'slot') countOwner(node.id, node.fallback);
    else if (node.kind === 'conditional') {
      for (const branch of node.branches) countOwner(node.id, branch.children);
    } else if (node.kind === 'component' && node.slots !== undefined) {
      for (const fill of Object.values(node.slots)) countOwner(node.id, fill.children);
    }
  }
  for (const definition of Object.values(definitions)) {
    countOwner(definition.id, [definition.root]);
    for (const slot of Object.values(definition.slots ?? {})) {
      countOwner(definition.id, slot.fallback);
    }
  }
  for (const [ownedId, count] of ownerCount) {
    if (count > 1) {
      issues.push(
        uiDiagnostic('UI_DOC_UNKNOWN_NODE', `Node '${ownedId}' has ${count} owners; every node has exactly one source parent.`, {
          documentId,
          nodeId: ownedId,
          missingChildId: ownedId,
        }),
      );
    }
  }

  // ---- component definitions ---------------------------------------------
  for (const [definitionId, definition] of Object.entries(definitions)) {
    validateDefinition(ctx, definitionId, definition, styleSources, conditions);
  }
  // Definition-level expansion cycles (within this document; cross-document
  // closure is the application compiler's obligation).
  const defVisiting = new Set<string>();
  const defDone = new Set<string>();
  const defPath: string[] = [];
  const walkDefinition = (id: string): void => {
    if (defDone.has(id)) return;
    if (defVisiting.has(id)) {
      const start = defPath.indexOf(id);
      issues.push(
        uiDiagnostic('UI_DOC_CYCLE', 'Definition-level expansion cycle.', {
          documentId,
          path: defPath.slice(start === -1 ? 0 : start).concat(id),
        }),
      );
      return;
    }
    const definition = definitions[id];
    if (definition === undefined) return;
    defVisiting.add(id);
    defPath.push(id);
    for (const nodeId of collectNodeSubtree(definition.root, nodes, new Set())) {
      const node = nodes[nodeId];
      if (node?.kind === 'component' && definitions[node.definitionId] !== undefined) {
        walkDefinition(node.definitionId);
      }
    }
    defPath.pop();
    defVisiting.delete(id);
    defDone.add(id);
  };
  for (const id of Object.keys(definitions)) walkDefinition(id);

  // ---- tokens / style sources / conditions / state ------------------------
  for (const [tokenId, token] of Object.entries(tokens)) {
    if (!isPlainObject(token) || !nonEmptyString((token as { value?: unknown }).value)) {
      issues.push(
        uiDiagnostic('UI_EXPR_UNKNOWN_REFERENCE', `Token '${tokenId}' must declare a string value.`, {
          documentId,
          nodeId: document.root,
          path: `token.${tokenId}`,
        }),
      );
    }
  }
  for (const [sourceId, source] of Object.entries(styleSources)) {
    if (!isPlainObject(source)) continue;
    for (const declaration of (source as { declarations?: unknown }).declarations as
      | readonly { property?: unknown; value?: unknown }[]
      | undefined
      ?? []) {
      validateStyleDeclaration(ctx, declaration, String(sourceId), String(document.root), tokens);
    }
  }
  for (const [conditionId, condition] of Object.entries(conditions)) {
    validateCondition(ctx, conditionId, condition, localState);
  }
  for (const [key, decl] of Object.entries(localState)) {
    if (!isPlainObject(decl)) continue;
    const type = (decl as { type?: unknown }).type;
    const initial = (decl as { initial?: unknown }).initial;
    const matches =
      (type === 'string' && typeof initial === 'string') ||
      (type === 'number' && typeof initial === 'number') ||
      (type === 'boolean' && typeof initial === 'boolean');
    if (!matches) {
      issues.push(
        uiDiagnostic('UI_EXPR_TYPE_MISMATCH', `Local state '${key}' initial value does not match its type.`, {
          documentId,
          nodeId: document.root,
          expected: String(type),
          actual: typeof initial,
        }),
      );
    }
  }

  return issues;
}

/** All node ids reachable through containment from a definition root. */
function collectNodeSubtree(root: string, nodes: Record<string, UiNode>, into: Set<string>): Set<string> {
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (into.has(id)) continue;
    into.add(id);
    const node = nodes[id];
    if (node === undefined) continue;
    if (node.kind === 'element' || node.kind === 'portal') stack.push(...node.children);
    if (node.kind === 'repeat') stack.push(node.templateRoot);
    if (node.kind === 'slot') stack.push(...(node.fallback ?? []));
    if (node.kind === 'component' && node.slots !== undefined) {
      for (const fill of Object.values(node.slots)) stack.push(...fill.children);
    }
  }
  return into;
}

function validateNode(
  ctx: ValidateContext,
  node: UiNode,
  scope: UiScopeInfo,
  nodes: Record<string, UiNode>,
): void {
  const { document, catalogs, issues } = ctx;
  const docRecord = document as unknown as Record<string, unknown>;
  const documentId = String(document.id);
  switch (node.kind) {
    case 'element': {
      if (!isKnownElement(catalogs.elements, node.tag)) {
        issues.push(
          uiDiagnostic('UI_DOC_UNKNOWN_ELEMENT', `Element tag '${node.tag}' is not registered.`, {
            documentId,
            nodeId: node.id,
            tag: node.tag,
          }),
        );
        break; // attribute checks are meaningless for unknown tags
      }
      const allowed = allowedAttributes(catalogs.elements, node.tag);
      for (const name of Object.keys(node.attributes ?? {})) {
        if (!allowed.has(name)) {
          issues.push(
            uiDiagnostic(
              'UI_DOC_UNKNOWN_ATTRIBUTE',
              `Attribute '${name}' is not declared for element '${node.tag}'.`,
              { documentId, nodeId: node.id, tag: node.tag, attribute: name },
            ),
          );
        }
      }
      if (isLeafElement(catalogs.elements, node.tag) && node.children.length > 0) {
        issues.push(
          uiDiagnostic(
            'UI_DOC_UNKNOWN_NODE',
            `Element '${node.tag}' is a leaf and cannot own children.`,
            { documentId, nodeId: node.children[0] as string, missingChildId: node.children[0] as string },
          ),
        );
      }
      for (const attribute of Object.entries(node.attributes ?? {})) {
        if (typeof attribute[1] === 'object' && attribute[1] !== null) {
          issues.push(...checkExpression(attribute[1] as UiExpression, catalogs, scope, documentId, node.id));
        }
      }
      for (const interaction of node.interactions ?? []) {
        validateInteraction(ctx, node.id, interaction, scope);
      }
      validatePresentation(ctx, node, scope);
      break;
    }
    case 'text': {
      if (node.content.type === 'expression') {
        issues.push(
          ...checkExpression(node.content.expression, catalogs, scope, documentId, node.id),
        );
      } else if (typeof node.content.value !== 'string') {
        issues.push(
          uiDiagnostic('UI_EXPR_TYPE_MISMATCH', 'Literal text content must be a string.', {
            documentId,
            nodeId: node.id,
            expected: 'string',
            actual: typeof node.content.value,
          }),
        );
      }
      break;
    }
    case 'component': {
      // Definition closure against THIS document's registry; extension
      // descriptors are resolved by the compiler (catalogs carry none here).
      const definition = (registryOf(docRecord, 'componentDefinitions') as Record<string, unknown>)[
        node.definitionId
      ];
      if (definition === undefined) {
        // Unknown here does not yet mean invalid: the compiler resolves
        // registered extensions. Structural absence alone is reported so a
        // plain document-level validation is honest about closure.
        issues.push(
          uiDiagnostic(
            'UI_DOC_UNKNOWN_COMPONENT',
            `Component definition '${node.definitionId}' is not stored in this document (extension resolution is the compiler's obligation).`,
            { documentId, nodeId: node.id, definitionId: node.definitionId },
          ),
        );
        break;
      }
      for (const [propName, expression] of Object.entries(node.props ?? {})) {
        const typeIssue = checkExpression(expression, catalogs, scope, documentId, node.id);
        issues.push(...typeIssue);
        const propDecl = (definition as UiComponentDefinition).props?.find(
          (candidate) => candidate.name === propName,
        );
        if (propDecl !== undefined && expression.type === 'literal') {
          const actual = expression.value === null ? 'null' : typeof expression.value;
          if (actual !== 'null' && actual !== propDecl.type) {
            issues.push(
              uiDiagnostic('UI_EXPR_TYPE_MISMATCH', `Prop '${propName}' expects ${propDecl.type}.`, {
                documentId,
                nodeId: node.id,
                expected: propDecl.type,
                actual,
              }),
            );
          }
        }
      }
      for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
        const declared = (definition as UiComponentDefinition).slots?.[slotName];
        if (declared === undefined) {
          issues.push(
            uiDiagnostic(
              'UI_DOC_UNKNOWN_COMPONENT',
              `Definition '${node.definitionId}' declares no slot '${slotName}'.`,
              { documentId, nodeId: node.id, definitionId: `${node.definitionId}#${slotName}` },
            ),
          );
        }
        // Slot fill children are resolved in the INSTANCE scope (document level).
        for (const childId of fill.children) {
          const child = nodes[childId];
          if (child === undefined) {
            issues.push(
              uiDiagnostic('UI_DOC_UNKNOWN_NODE', `Slot fill references missing node '${childId}'.`, {
                documentId,
                nodeId: node.id,
                missingChildId: childId,
              }),
            );
            continue;
          }
          validateNode(ctx, child, scope, nodes);
        }
      }
      break;
    }
    case 'repeat': {
      const collectionType = checkExpressionTypeOf(
        ctx,
        node.collection,
        scope,
        node.id,
        'array',
      );
      if (collectionType !== 'array' && collectionType !== 'unknown' && collectionType !== 'any') {
        issues.push(
          uiDiagnostic('UI_EXPR_TYPE_MISMATCH', 'A repeat collection must resolve to an array.', {
            documentId,
            nodeId: node.id,
            expected: 'array',
            actual: collectionType,
          }),
        );
      }
      const innerScope: UiScopeInfo = {
        repeatItems: {
          ...scope.repeatItems,
          [node.itemName]: repeatItemFields(ctx, node.collection),
        },
        inDefinition: scope.inDefinition,
      };
      // The key is evaluated per record inside the item scope.
      issues.push(...checkExpression(node.key, catalogs, innerScope, documentId, node.id));
      // Template recursion (with the inner scope) belongs to the tree walks.
      break;
    }
    case 'conditional': {
      for (const branch of node.branches) {
        if (branch.when !== undefined) {
          const condition = (registryOf(docRecord, 'conditions') as Record<string, unknown>)[
            branch.when
          ];
          if (condition === undefined) {
            issues.push(
              uiDiagnostic('UI_STYLE_CONDITION_UNKNOWN', `Branch references unknown condition.`, {
                documentId,
                conditionId: branch.when,
              }),
            );
          } else if ((condition as { kind?: unknown }).kind !== 'localState') {
            issues.push(
              uiDiagnostic(
                'UI_STYLE_CONDITION_UNKNOWN',
                'A conditional branch requires a localState condition (media conditions belong to style rules).',
                { documentId, conditionId: branch.when },
              ),
            );
          } else {
            const when = (condition as { when?: UiExpression }).when;
            if (when !== undefined) {
              issues.push(...checkExpression(when, catalogs, scope, documentId, node.id));
            }
          }
        }
        for (const childId of branch.children) {
          const child = nodes[childId];
          if (child === undefined) {
            issues.push(
              uiDiagnostic('UI_DOC_UNKNOWN_NODE', `Branch references missing node '${childId}'.`, {
                documentId,
                nodeId: node.id,
                missingChildId: childId,
              }),
            );
            continue;
          }
          validateNode(ctx, child, scope, nodes);
        }
      }
      break;
    }
    case 'slot': {
      if (!scope.inDefinition) {
        issues.push(
          uiDiagnostic(
            'UI_EXPR_SCOPE_VIOLATION',
            'Slot placeholders are only valid inside a component definition body.',
            { documentId, nodeId: node.id, scope: 'slot:outside-definition' },
          ),
        );
      }
      break;
    }
    case 'portal': {
      // Structural rules only; rendering support is a declared U1 limit.
      issues.push(
        uiDiagnostic('UI_DOC_UNSUPPORTED_FEATURE', 'Portal rendering is pending beyond the U1 slice.', {
          documentId,
          nodeId: node.id,
          feature: 'portal',
        }),
      );
      break;
    }
  }
}

/** Field types of a repeat's collection (declared view fields, `<collectionField>.<itemField>` convention). */
function repeatItemFields(
  ctx: ValidateContext,
  collection: UiExpression,
): Readonly<Record<string, UiFieldType>> {
  if (collection.type !== 'ref') return {};
  const parts = collection.path.split('.');
  if ((parts[0] !== 'view' && parts[0] !== 'record') || parts.length !== 2) return {};
  const fields = ctx.catalogs.viewFields ?? {};
  const prefix = `${parts[1] as string}.`;
  const itemFields: Record<string, UiFieldType> = {};
  for (const [name, type] of Object.entries(fields)) {
    if (name.startsWith(prefix)) itemFields[name.slice(prefix.length)] = type;
  }
  return itemFields;
}

function checkExpressionTypeOf(
  ctx: ValidateContext,
  expression: UiExpression,
  scope: UiScopeInfo,
  nodeId: string,
  _expected: string,
): string {
  const issues: UiDiagnostic[] = [];
  const catalogs = ctx.catalogs;
  // Reuse checkExpression and infer the top type by a minimal local walker.
  issues.push(...checkExpression(expression, catalogs, scope, String(ctx.document.id), nodeId));
  ctx.issues.push(...issues);
  return inferType(expression, catalogs, scope);
}

function inferType(
  expression: UiExpression,
  catalogs: UiCatalogs,
  scope: UiScopeInfo,
): string {
  switch (expression.type) {
    case 'literal':
      return expression.value === null ? 'null' : typeof expression.value;
    case 'ref': {
      const parts = expression.path.split('.');
      const head = parts[0] as string;
      if ((head === 'view' || head === 'record') && parts.length === 2) {
        return (catalogs.viewFields ?? {})[parts[1] as string] ?? 'unknown';
      }
      if (head === 'repeat' && parts.length === 3) {
        return scope.repeatItems[parts[1] as string]?.[parts[2] as string] ?? 'unknown';
      }
      if (head === 'token') return 'string';
      if (head === 'prop' && scope.inDefinition) return 'any';
      if (head === 'state' && !scope.inDefinition) return 'any';
      return 'unknown';
    }
    case 'compare':
    case 'boolean':
      return 'boolean';
    case 'conditionalValue':
      return inferType(expression.then, catalogs, scope);
    case 'op':
      return 'unknown';
  }
}

function validateInteraction(
  ctx: ValidateContext,
  nodeId: string,
  interaction: UiInteraction,
  scope: UiScopeInfo,
): void {
  const { document, catalogs, issues } = ctx;
  const docRecord = document as unknown as Record<string, unknown>;
  const documentId = String(document.id);
  if (interaction.action === 'invokeAction') {
    if (catalogs.actionIds !== undefined && !catalogs.actionIds.includes(interaction.actionId)) {
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNKNOWN_PRODUCT_REFERENCE',
          `Interaction references undeclared action '${interaction.actionId}'.`,
          { documentId, nodeId, kind: 'action', ref: interaction.actionId },
        ),
      );
    }
    const input = interaction.input as Readonly<Record<string, UiExpression>> | undefined;
    for (const expression of Object.values(input ?? {})) {
      issues.push(...checkExpression(expression, catalogs, scope, documentId, nodeId));
    }
  } else if (interaction.action === 'navigate') {
    if (catalogs.routeIds !== undefined && !catalogs.routeIds.includes(interaction.routeId)) {
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNKNOWN_PRODUCT_REFERENCE',
          `Interaction references undeclared route '${interaction.routeId}'.`,
          { documentId, nodeId, kind: 'route', ref: interaction.routeId },
        ),
      );
    }
    const params = interaction.params as Readonly<Record<string, UiExpression>> | undefined;
    for (const expression of Object.values(params ?? {})) {
      issues.push(...checkExpression(expression, catalogs, scope, documentId, nodeId));
    }
  } else if (interaction.action === 'setState') {
    const localState = registryOf(docRecord, 'localState');
    if (localState[interaction.key] === undefined) {
      issues.push(
        uiDiagnostic('UI_EXPR_UNKNOWN_REFERENCE', `setState targets undeclared state key.`, {
          documentId,
          nodeId,
          path: `state.${interaction.key}`,
        }),
      );
    }
    if (interaction.value !== undefined) {
      issues.push(
        ...checkExpression(interaction.value as UiExpression, catalogs, scope, documentId, nodeId),
      );
    }
  }
}

function validatePresentation(ctx: ValidateContext, node: UiNode, scope: UiScopeInfo): void {
  const { document, catalogs, issues } = ctx;
  const docRecord = document as unknown as Record<string, unknown>;
  const documentId = String(document.id);
  const styleSources = registryOf(docRecord, 'styleSources');
  for (const sourceId of node.styleSources ?? []) {
    if (styleSources[sourceId] === undefined) {
      issues.push(
        uiDiagnostic('UI_DOC_REFERENCE_DANGLING', `Style source '${String(sourceId)}' does not exist.`, {
          documentId,
          nodeId: node.id,
          reference: `styleSource:${String(sourceId)}`,
        }),
      );
    }
  }
  for (const declaration of node.localStyle ?? []) {
    validateStyleDeclaration(ctx, declaration, node.id, node.id, registryOf(docRecord, 'tokens'));
    if (
      declaration.value !== undefined &&
      typeof declaration.value === 'object' &&
      declaration.value.type === 'binding'
    ) {
      issues.push(
        ...checkExpression(declaration.value.expression, catalogs, scope, documentId, node.id),
      );
    }
  }
}

function validateStyleDeclaration(
  ctx: ValidateContext,
  declaration: { property?: unknown; value?: unknown },
  owner: string,
  nodeId: string,
  tokens: Record<string, unknown>,
): void {
  const { document, issues } = ctx;
  const documentId = String(document.id);
  if (!nonEmptyString(declaration.property)) {
    issues.push(
      uiDiagnostic('UI_STYLE_PROPERTY_UNSUPPORTED', `Style declaration needs a property name.`, {
        documentId,
        nodeId,
        property: String(declaration.property ?? ''),
      }),
    );
    return;
  }
  const value = declaration.value as { type?: string; value?: unknown; id?: unknown } | undefined;
  if (value === undefined || typeof value !== 'object') {
    issues.push(
      uiDiagnostic('UI_STYLE_PROPERTY_UNSUPPORTED', `Style value must be a typed value.`, {
        documentId,
        nodeId,
        property: String(declaration.property),
      }),
    );
    return;
  }
  if (value.type === 'token' && tokens[value.id as string] === undefined) {
    issues.push(
      uiDiagnostic('UI_EXPR_UNKNOWN_REFERENCE', `Style value references unknown token.`, {
        documentId,
        nodeId,
        path: `token.${String(value.id)}`,
      }),
    );
  }
  void owner;
}

function validateCondition(
  ctx: ValidateContext,
  conditionId: string,
  condition: unknown,
  localState: Record<string, unknown>,
): void {
  const { document, catalogs, issues } = ctx;
  const docRecord = document as unknown as Record<string, unknown>;
  const documentId = String(document.id);
  void docRecord;
  if (!isPlainObject(condition)) {
    issues.push(
      uiDiagnostic('UI_STYLE_CONDITION_UNKNOWN', `Condition '${conditionId}' must be an object.`, {
        documentId,
        conditionId,
      }),
    );
    return;
  }
  const kind = (condition as { kind?: unknown }).kind;
  if (kind === 'media') {
    const query = (condition as { query?: unknown }).query;
    if (typeof query !== 'string' || !isBoundedMediaQuery(query)) {
      issues.push(
        uiDiagnostic('UI_STYLE_CONDITION_UNKNOWN', `Media condition query is not a bounded width query.`, {
          documentId,
          conditionId,
        }),
      );
    }
    return;
  }
  if (kind === 'localState') {
    const when = (condition as { when?: UiExpression }).when;
    if (when === undefined) {
      issues.push(
        uiDiagnostic('UI_STYLE_CONDITION_UNKNOWN', `localState condition needs a when expression.`, {
          documentId,
          conditionId,
        }),
      );
      return;
    }
    issues.push(
      ...checkExpression(when, catalogs, { repeatItems: {}, inDefinition: false }, documentId, document.root),
    );
    void localState;
    return;
  }
  // container / environment / variant: declared records are valid source;
  // render support is declared pending (renderer warns).
}

/** Bounded viewport-condition grammar: width min/max clauses joined by `and`. */
export function isBoundedMediaQuery(query: string): boolean {
  const clause = /^\(\s*(min|max)-width\s*:\s*\d+(?:\.\d+)?px\s*\)$/;
  const parts = query.split(' and ').map((part) => part.trim());
  if (parts.length === 0) return false;
  return parts.every((part) => clause.test(part));
}

function validateDefinition(
  ctx: ValidateContext,
  definitionId: string,
  definition: UiComponentDefinition,
  styleSources: Record<string, unknown>,
  conditions: Record<string, unknown>,
): void {
  const { document, issues } = ctx;
  const docRecord = document as unknown as Record<string, unknown>;
  const documentId = String(document.id);
  if (!nonEmptyString(definition.revision)) {
    issues.push(
      uiDiagnostic('UI_DOC_UNKNOWN_COMPONENT', `Definition '${definitionId}' needs a revision.`, {
        documentId,
        nodeId: document.root,
        definitionId,
      }),
    );
  }
  const nodes = registryOf(docRecord, 'nodes') as Record<string, UiNode>;
  if (nodes[definition.root] === undefined) {
    issues.push(
      uiDiagnostic('UI_DOC_UNKNOWN_NODE', `Definition '${definitionId}' root does not exist.`, {
        documentId,
        nodeId: definition.root,
        missingChildId: definition.root,
      }),
    );
  }
  if (definition.baseStyle !== undefined && styleSources[definition.baseStyle] === undefined) {
    issues.push(
      uiDiagnostic('UI_DOC_REFERENCE_DANGLING', `Definition base style does not exist.`, {
        documentId,
        nodeId: definition.root,
        reference: `styleSource:${definition.baseStyle}`,
      }),
    );
  }
  for (const [variant, ref] of Object.entries(definition.variants ?? {})) {
    if (conditions[ref.conditionId] === undefined) {
      issues.push(
        uiDiagnostic('UI_STYLE_CONDITION_UNKNOWN', `Variant '${variant}' references unknown condition.`, {
          documentId,
          conditionId: ref.conditionId,
        }),
      );
    } else {
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNSUPPORTED_FEATURE',
          'Component variants are pending beyond the U1 slice.',
          { documentId, feature: `variant:${definitionId}:${variant}` },
        ),
      );
    }
  }
}

export { hasErrors };
