import { compileApplication, deriveActionInputCatalog } from '@victframework/application';
import { defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import { b1CatalogDescriptors, b1CatalogImplementations, catalogDescriptors, catalogImplementations } from '@victframework/ui-svelte';
import { consumerActionIds, consumerActions, consumerApplication, consumerContracts, consumerResource, consumerViewFields } from './definition.js';
import { inspectionDocuments, inspectionRoutes } from './operations.js';
import { consumerDocuments } from './documents.js';

// The compiler receives canonical passive declarations, while dispatch binds executable contracts.
export const consumerContractCatalog = consumerContracts.map(({ id, revision, presentationFields }) =>
  ({ id, revision, ...(presentationFields ? { presentationFields } : {}) }));
export const consumerActionInputs = deriveActionInputCatalog(consumerActions, consumerContractCatalog);
export const consumerCatalogs = {
  elements: defaultSemanticElementCatalog(), actionIds: consumerActionIds, routeIds: inspectionRoutes.map(route => route.id),
  viewFields: consumerViewFields, actionInputs: consumerActionInputs, extensions: catalogDescriptors,
};
export function compileConsumerDocuments(documents: readonly UiDocument[] = consumerDocuments) {
  return compileApplication({ application: consumerApplication(documents), resources: [consumerResource],
    contracts: consumerContractCatalog, uiDocuments: documents.map(document => ({ document })),
    uiExtensions: catalogDescriptors, uiViewFields: consumerViewFields });
}
export function documentIssues(document: UiDocument) {
  // Validate a stored candidate in its declared application context. A single
  // document may navigate to a sibling route; omitting sibling screens falsely
  // rejects that source during reopen even though the complete app compiles.
  const result = compileConsumerDocuments([document, ...inspectionDocuments.filter(seed => seed.id !== document.id)]);
  if (result.ok) return [];
  return [...result.issues.map(issue => ({ ...issue, severity: 'error' })), ...(result.uiIssues ?? [])];
}
export { b1CatalogDescriptors, b1CatalogImplementations, catalogDescriptors, catalogImplementations };
