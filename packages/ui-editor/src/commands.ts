/**
 * Exported transactional command builders (U1-03/U1-04).
 *
 * Every editor operation flows through `UiEditSession.applyTransaction`
 * with these commands — the editor never mutates documents directly.
 * Builders are pure: they assemble the frozen `vict.ui-edit@1` commands;
 * application/validation lives in `@victframework/ui`.
 */

import type {
  UiAttributeValue,
  UiDocument,
  UiEditCommand,
  UiExpression,
  UiInteraction,
  UiNode,
  UiOutputBinding,
  UiSlotScope,
  UiStyleValue,
  UiValue,
} from '@victframework/ui';

export interface TransactionDraft {
  readonly requestId: string;
  readonly reason?: string;
  readonly commands: readonly UiEditCommand[];
}

/** Replace canonical class tokens without touching generated renderer ownership. */
export function setClasses(input:{requestId:string;nodeId:string;classes:readonly string[]}):TransactionDraft {
  return {requestId:input.requestId,reason:'Edit authored classes',commands:[{op:'setClasses',nodeId:input.nodeId,classes:input.classes}]};
}
/** Edit authored state through the existing atomic source replacement boundary. */
export function setStateInitial(input: {
  requestId: string;
  document: UiDocument;
  key: string;
  value: UiValue;
}): TransactionDraft {
  const declaration = input.document.localState[input.key];
  if (!declaration) throw new Error(`Unknown local state '${input.key}'.`);
  return {
    requestId: input.requestId,
    reason: 'Edit saved starting value',
    commands: [
      {
        op: 'replaceDocument',
        document: {
          ...input.document,
          localState: {
            ...input.document.localState,
            [input.key]: { ...declaration, initial: input.value },
          },
        },
      },
    ],
  };
}

/** Insert a text node with a literal (or bound) value into an element. */
export function insertText(input: {
  readonly requestId: string;
  readonly parentId: string;
  readonly nodeId: string;
  readonly value: string;
  readonly index?: number;
  readonly bind?: UiExpression;
}): TransactionDraft {
  const content = input.bind
    ? ({ type: 'expression', expression: input.bind } as const)
    : ({ type: 'literal', value: input.value } as const);
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'insert',
        parentId: input.parentId,
        ...(input.index !== undefined ? { index: input.index } : {}),
        node: { kind: 'text', id: input.nodeId, content } as UiNode,
      },
    ],
  };
}

/** Insert an element (optionally with a class and interactions). */
export function insertElement(input: {
  readonly requestId: string;
  readonly parentId: string;
  readonly node: UiNode;
  readonly index?: number;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'insert',
        parentId: input.parentId,
        ...(input.index !== undefined ? { index: input.index } : {}),
        node: input.node,
      },
    ],
  };
}

/** Move a node under a new parent at an ordered position. */
export function moveNode(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly newParentId: string;
  readonly index?: number;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'move',
        nodeId: input.nodeId,
        newParentId: input.newParentId,
        ...(input.index !== undefined ? { index: input.index } : {}),
      },
    ],
  };
}

/** Set one instance-local style declaration (token/text/binding value). */
export function setStyle(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly property: string;
  readonly value?: UiStyleValue;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'setStyleDeclaration',
        nodeId: input.nodeId,
        property: input.property,
        ...(input.value !== undefined ? { value: input.value } : {}),
      },
    ],
  };
}

/** Keep promoted base declarations in their attached source so responsive overrides survive. */
export function setBaseStyle(
  document: UiDocument,
  input: Parameters<typeof setStyle>[0],
): TransactionDraft {
  const attachedBase =
    !document.nodes[input.nodeId]?.localStyle?.some((d) => d.property === input.property) &&
    document.styleSources[`src.${input.nodeId}.always.plain`]?.declarations.some(
      (d) => d.property === input.property,
    );
  return attachedBase ? setConditionalStyle(input) : setStyle(input);
}

/** Set/remove an attribute (literal or typed expression). */
export function setAttribute(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly name: string;
  readonly value?: UiAttributeValue;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'setAttribute',
        nodeId: input.nodeId,
        name: input.name,
        ...(input.value !== undefined ? { value: input.value } : {}),
      },
    ],
  };
}

/** Bind a text node or an attribute/prop to an expression. */
export function bindExpression(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly target:
    | { readonly kind: 'text' }
    | { readonly kind: 'attribute'; readonly name: string }
    | { readonly kind: 'prop'; readonly name: string };
  readonly expression?: UiExpression;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'bindExpression',
        nodeId: input.nodeId,
        target: input.target,
        expression: input.expression,
      },
    ],
  };
}

/** Connect an action/navigation interaction to an element (replaces same-event). */
export function connectInteraction(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly interaction: UiInteraction;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [{ op: 'connectInteraction', nodeId: input.nodeId, interaction: input.interaction }],
  };
}

/** Fill a component instance's slot with ordered children. */
export function fillSlot(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly slotName: string;
  readonly children: readonly string[];
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      { op: 'fillSlot', nodeId: input.nodeId, slotName: input.slotName, children: input.children },
    ],
  };
}

/**
 * Set or clear one authored output binding on a component instance
 * (amendment §3.6 — transactional, undoable through the session like
 * every other op).
 */
export function setOutputBinding(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly output: string;
  /** `undefined` clears the binding. */
  readonly binding?: UiOutputBinding;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'setOutputBinding',
        nodeId: input.nodeId,
        output: input.output,
        ...(input.binding !== undefined ? { binding: input.binding } : {}),
      },
    ],
  };
}

/** Set or clear a condition/pseudo-gated style declaration on an ATTACHED
 * style source (never base local style — U2-04 preview-size safety). */
export function setConditionalStyle(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly property: string;
  readonly value?: TransactionDraft extends never
    ? never
    : import('@victframework/ui').UiStyleValue;
  readonly conditionId?: string;
  readonly pseudo?: 'hover' | 'focus' | 'active' | 'disabled';
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      {
        op: 'setConditionalStyle',
        nodeId: input.nodeId,
        property: input.property,
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.conditionId !== undefined ? { conditionId: input.conditionId } : {}),
        ...(input.pseudo !== undefined ? { pseudo: input.pseudo } : {}),
      },
    ],
  };
}

/** Remove a node (reference-checked; the subtree goes with it). */
export function removeNode(input: {
  readonly requestId: string;
  readonly nodeId: string;
}): TransactionDraft {
  return { requestId: input.requestId, commands: [{ op: 'remove', nodeId: input.nodeId }] };
}

/** Set a literal text value (the inspector's text field). */
export function setTextLiteral(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly value: string;
}): TransactionDraft {
  return {
    requestId: input.requestId,
    commands: [
      { op: 'setProperty', nodeId: input.nodeId, property: 'textLiteral', value: input.value },
    ],
  };
}

/** The root node id of a document (insertion default). */
export function rootIdOf(document: UiDocument): string {
  return String(document.root);
}

/** Connect a native field through the canonical attribute/change contracts.
 * A new key is independent; existing keys must already have the requested type.
 * Manual and agent authoring use this same transaction builder. */
/** Source ownership determines lexical state; no renderer/domain-specific lookup. */
export function findNodeSlotScope(document:UiDocument,nodeId:string):UiSlotScope|undefined {
  const seen=new Set<string>();let current=nodeId;
  while(!seen.has(current)){
    seen.add(current);
    const parents:{id:string;scope?:UiSlotScope}[]=[];
    for(const node of Object.values(document.nodes)){
      if((node.kind==='element'||node.kind==='portal')&&node.children.includes(current))parents.push({id:node.id});
      else if(node.kind==='component')for(const fill of Object.values(node.slots??{})){if(fill.children.includes(current))parents.push({id:node.id,scope:fill.scope});}
      else if(node.kind==='conditional'&&node.branches.some(branch=>branch.children.includes(current)))parents.push({id:node.id});
      else if(node.kind==='repeat'&&node.templateRoot===current)parents.push({id:node.id});
      else if(node.kind==='slot'&&node.fallback?.includes(current))parents.push({id:node.id});
    }
    if(!parents.length)return;
    if(parents.length!==1)throw new Error('Native wiring requires unambiguous canonical ownership.');
    if(parents[0]!.scope)return parents[0]!.scope;
    current=parents[0]!.id;
  }
  throw new Error('Native wiring cannot cross cyclic canonical ownership.');
}
export function wireNativeInput(input: {
  requestId: string; document: UiDocument; nodeId: string; key: string;
  type?: 'string' | 'number' | 'boolean'; initial?: string | number | boolean;
}): TransactionDraft {
  const node = input.document.nodes[input.nodeId];
  if (node?.kind !== 'element' || !['input', 'textarea', 'select'].includes(node.tag))
    throw new Error('Native wiring requires input, textarea or select.');
  const nativeType = node.attributes?.type;
  const type = input.type ?? (nativeType === 'checkbox' ? 'boolean' : nativeType === 'number' ? 'number' : 'string');
  const expected = nativeType === 'checkbox' ? 'boolean' : nativeType === 'number' ? 'number' : 'string';
  if (type !== expected) throw new Error(`This native field emits ${expected}; state must match.`);
  const initial = input.initial ?? (type === 'string' ? '' : type === 'number' ? 0 : false);
  if (typeof initial !== type) throw new Error('Starting value must match the field type.');
  if (!/^[a-zA-Z0-9_-]+$/.test(input.key) || ['__proto__','prototype','constructor'].includes(input.key))
    throw new Error('Use a simple safe local state key.');
  const scope=findNodeSlotScope(input.document,input.nodeId);
  const existing = scope?scope.state?.[input.key]:input.document.localState[input.key];
  if(scope&&!existing)throw new Error('Declare this scoped state key before wiring its native field. Root state is not visible inside a scoped fill.');
  if (existing && existing.type !== type) throw new Error('Existing state has a different type.');
  return { requestId: input.requestId, reason: 'Connect independent input state', commands: [
    ...(!existing && !scope ? [{ op: 'replaceDocument' as const, document: { ...input.document,
      localState: { ...input.document.localState, [input.key]: { key: input.key, type, initial } } } }] : []),
    { op: 'setAttribute', nodeId: node.id, name: type === 'boolean' ? 'checked' : 'value', value: { type: 'ref', path: `state.${input.key}` } },
    { op: 'connectInteraction', nodeId: node.id, interaction: { on: 'change', action: 'setState', key: input.key, value: { type: 'ref', path: `state.${input.key}` } } },
  ] };
}
