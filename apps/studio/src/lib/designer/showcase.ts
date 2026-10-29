/** Deterministic, disposable examples built through the same canonical recipe commands. */
import { applyUiEdit, type UiDocument } from '@victframework/ui';
import { insertRecipe, type CompositionFocus } from '@victframework/ui-editor';
import { designerCatalogs, newScreen,catalogDescriptors } from './application.js';
import { screenRecipes } from './recipes.js';

export const showcaseCatalog = screenRecipes.map(recipe => ({
  id: recipe.id,
  label: recipe.label,
  description: recipe.description,
  category: recipe.placements?.length ? 'Context-owned part' : 'Standalone',
  placements: recipe.placements ?? [],
}));

export function createShowcaseFixture(recipeId: string): {
  document: UiDocument;
  targetNodeId: string;
  parentFocus?: CompositionFocus;
} {
  const recipe = screenRecipes.find(entry => entry.id === recipeId);
  if (!recipe) throw new Error(`Unknown showcase recipe: ${recipeId}`);
  let document = newScreen(`${recipe.label} showcase`, `showcase-${recipe.id}`);
  let parentId = document.root;
  let parentSlot: string | undefined;
  const chain: { recipeId: string; slotName: string }[] = [];
  const visited = new Set([recipe.id]);
  let placement = recipe.placements?.[0];
  while (placement) {
    const parentRecipe = screenRecipes.find(entry => (entry.id.startsWith('vict.')?entry.id:`vict.catalog.${entry.id}`) === placement!.definitionId);
    if (!parentRecipe || visited.has(parentRecipe.id)) throw new Error(`Invalid showcase ancestor for ${recipe.id}`);
    visited.add(parentRecipe.id);
    chain.unshift({ recipeId: parentRecipe.id, slotName: placement.slotName });
    placement = parentRecipe.placements?.[0];
  }
  function insert(id: string, nodeId: string) {
    const entry = screenRecipes.find(candidate => candidate.id === id)!;
    const draft = insertRecipe(`showcase-insert-${nodeId}`, entry, document, nodeId, { nodeId: parentId, slotName: parentSlot },catalogDescriptors);
    const result = applyUiEdit({ document, revision: 'fixture' }, { ...draft, expectedDocumentRevision: 'fixture' }, designerCatalogs);
    if (!result.ok) throw new Error(`Invalid showcase fixture ${id}: ${JSON.stringify(result.issues)}`);
    document = result.document;
  }
  for (const ancestor of chain) {
    const nodeId = `ancestor-${ancestor.recipeId}`;
    insert(ancestor.recipeId, nodeId);
    parentId = nodeId;
    parentSlot = ancestor.slotName;
  }
  const targetNodeId = `example-${recipe.id}`;
  insert(recipe.id, targetNodeId);
  return { document, targetNodeId, ...(parentSlot ? { parentFocus: { nodeId: parentId, slotName: parentSlot } } : {}) };
}
