import { uiDiagnostic, type UiDiagnostic, type UiDocument } from '@victframework/ui';
import { screenRecipes } from './recipes.js';

const rules = new Map(screenRecipes.flatMap(recipe => {
  const node = recipe.placements && recipe.create('placement-rule')[0];
  return node?.kind === 'component' ? [[node.definitionId, recipe.placements!] as const] : [];
}));
type Context = { definitionId: string; slotName: string };
type Fill = { children: readonly string[]; scope: Readonly<Record<string, Fill>> };
type Fills = Readonly<Record<string, Fill>>;

/** Studio renderer policy, not a change to the framework-neutral source schema.
 * Validate occurrences, not just node ownership: wrappers retain provider context,
 * local definitions substitute their slots, and detached kept content is not rendered.
 */
export function screenPlacementIssues(document: UiDocument): readonly UiDiagnostic[] {
  const issues: UiDiagnostic[] = [];
  function visit(id: string, context: readonly Context[], fills: Fills, ancestors: ReadonlySet<string>, path: string) {
    // Structural cycles/missing nodes belong to the canonical compiler.
    if (ancestors.has(id)) return;
    const node = document.nodes[id];
    if (!node) return;
    const nextAncestors = new Set([...ancestors, id]);
    const children = (ids: readonly string[], nextContext = context, nextFills = fills) =>
      ids.forEach((child, index) => visit(child, nextContext, nextFills, nextAncestors, `${path}/${index}:${child}`));
    if (node.kind === 'component') {
      const placements = rules.get(node.definitionId);
      if (placements) {
        const provider = [...context].reverse().find(entry => placements.some(placement => placement.definitionId === entry.definitionId));
        if (!provider || !placements.some(placement => placement.definitionId === provider.definitionId && placement.slotName === provider.slotName)) {
          issues.push(uiDiagnostic('UI_EDIT_VALIDATION_FAILED',
            `${node.definitionId} (${node.id}) requires its declared component context and slot. Keep this part aside or place it inside a compatible composition.`,
            { hostCode: 'STUDIO_COMPONENT_CONTEXT', documentId: document.id, nodeId: node.id, path }));
        }
      }
      const definition = document.componentDefinitions[node.definitionId];
      if (definition) {
        const localFills: Record<string, Fill> = {};
        for (const [name, fill] of Object.entries(node.slots ?? {})) localFills[name] = { children: fill.children, scope: fills };
        children([definition.root], context, localFills);
      } else {
        for (const [slotName, fill] of Object.entries(node.slots ?? {}))
          children(fill.children, [...context, { definitionId: node.definitionId, slotName }]);
      }
    } else if (node.kind === 'element' || node.kind === 'portal') children(node.children);
    else if (node.kind === 'conditional') node.branches.forEach(branch => children(branch.children));
    else if (node.kind === 'repeat') children([node.templateRoot]);
    else if (node.kind === 'slot') {
      const fill = fills[node.name];
      if (fill?.children.length) children(fill.children, context, fill.scope);
      else children(node.fallback ?? []);
    }
  }
  visit(document.root, [], {}, new Set(), document.root);
  return issues;
}
