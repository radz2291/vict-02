import { compileApplication, deriveActionInputCatalog } from '@victframework/application';
import { defaultSemanticElementCatalog, type UiDocument } from '@victframework/ui';
import { b1CatalogDescriptors, b1CatalogImplementations } from '@victframework/ui-svelte';
import { consumerActionIds, consumerActions, consumerApplication, consumerContracts, consumerResource, consumerViewFields } from './definition.js';
import { consumerDocuments } from './documents.js';

// The compiler receives canonical passive declarations, while dispatch binds executable contracts.
export const consumerContractCatalog = consumerContracts.map(({ id, revision, presentationFields }) =>
  ({ id, revision, ...(presentationFields ? { presentationFields } : {}) }));
export const consumerActionInputs = deriveActionInputCatalog(consumerActions, consumerContractCatalog);
export const consumerCatalogs = {
  elements: defaultSemanticElementCatalog(), actionIds: consumerActionIds, routeIds: ['controls', 'shell'],
  viewFields: consumerViewFields, actionInputs: consumerActionInputs, extensions: b1CatalogDescriptors,
};
export function compileConsumerDocuments(documents: readonly UiDocument[] = consumerDocuments) {
  return compileApplication({ application: consumerApplication(documents), resources: [consumerResource],
    contracts: consumerContractCatalog, uiDocuments: documents.map(document => ({ document })),
    uiExtensions: b1CatalogDescriptors, uiViewFields: consumerViewFields });
}
export function documentIssues(document: UiDocument) {
  const result = compileConsumerDocuments([document]);
  if (result.ok) return [];
  return [...result.issues.map(issue => ({ ...issue, severity: 'error' })), ...(result.uiIssues ?? [])];
}
export { b1CatalogDescriptors, b1CatalogImplementations };
