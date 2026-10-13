import type { UiDocument, UiStyleDeclaration } from '@victframework/ui';
import type { TransactionDraft } from './commands.js';
import { setConditionalStyle, setStyle } from './commands.js';

/** Local shorthand and longhand declarations may both mask a conditioned property. */
function related(base: string, conditional: string): boolean {
  const sides = ['top', 'right', 'bottom', 'left'];
  const border = sides.flatMap((side) =>
    ['width', 'style', 'color'].map((part) => `border-${side}-${part}`),
  );
  const shorthands: Record<string, readonly string[]> = {
    padding: sides.map((side) => `padding-${side}`),
    margin: sides.map((side) => `margin-${side}`),
    inset: sides,
    border,
    'border-width': sides.map((side) => `border-${side}-width`),
    'border-style': sides.map((side) => `border-${side}-style`),
    'border-color': sides.map((side) => `border-${side}-color`),
    ...Object.fromEntries(
      sides.map((side) => [
        `border-${side}`,
        border.filter((part) => part.startsWith(`border-${side}-`)),
      ]),
    ),
    'border-radius': ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(
      (corner) => `border-${corner}-radius`,
    ),
    background: [
      'color',
      'image',
      'position',
      'size',
      'repeat',
      'origin',
      'clip',
      'attachment',
    ].map((part) => `background-${part}`),
    font: [
      'font-size',
      'font-family',
      'font-stretch',
      'font-style',
      'font-variant',
      'font-weight',
      'line-height',
    ],
    flex: ['flex-basis', 'flex-grow', 'flex-shrink'],
    'flex-flow': ['flex-direction', 'flex-wrap'],
    grid: [
      'grid-template-rows',
      'grid-template-columns',
      'grid-template-areas',
      'grid-auto-rows',
      'grid-auto-columns',
      'grid-auto-flow',
    ],
    'grid-template': ['grid-template-rows', 'grid-template-columns', 'grid-template-areas'],
    gap: ['row-gap', 'column-gap'],
    overflow: ['overflow-x', 'overflow-y'],
  };
  const left = shorthands[base] ?? [base],
    right = shorthands[conditional] ?? [conditional];
  return left.some((property) => right.includes(property));
}
export function conditionalStyleConflicts(
  document: UiDocument,
  nodeId: string,
  condition?: string,
  pseudo?: string,
): readonly UiStyleDeclaration[] {
  if (!condition && !pseudo) return [];
  const node = document.nodes[nodeId];
  const conditioned = (node?.styleSources ?? []).flatMap((id) => {
    const source = document.styleSources[id];
    return source && source.conditionId === condition && source.pseudo === pseudo
      ? source.declarations
      : [];
  });
  return (node?.localStyle ?? []).filter((base) =>
    conditioned.some((rule) => related(base.property, rule.property)),
  );
}
/** Explicitly resolve masking without losing base presentation or changing cascade semantics. */
export function allowConditionalStyles(
  requestId: string,
  document: UiDocument,
  nodeId: string,
  condition?: string,
  pseudo?: string,
): TransactionDraft {
  const conflicts = conditionalStyleConflicts(document, nodeId, condition, pseudo);
  return {
    requestId,
    reason: 'Allow responsive style overrides',
    commands: conflicts.flatMap((declaration) => [
      ...setConditionalStyle({
        requestId,
        nodeId,
        property: declaration.property,
        value: declaration.value,
      }).commands,
      ...setStyle({ requestId, nodeId, property: declaration.property }).commands,
    ]),
  };
}
