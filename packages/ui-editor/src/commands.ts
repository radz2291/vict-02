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
  UiStyleValue,
} from '@victframework/ui';

export interface TransactionDraft {
  readonly requestId: string;
  readonly reason?: string;
  readonly commands: readonly UiEditCommand[];
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
