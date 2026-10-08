/**
 * Registration + compile plumbing: B1 descriptors/implementations come from
 * @victframework/ui-svelte (the packed package ships them; the consumer
 * registers them explicitly — registration is always the host's job).
 * Compilation runs through resolveUiAttachments (the application joint
 * compiler) so action-input typing is derived exactly as in production.
 */
import { resolveUiAttachments, type ResolvedUiAttachments } from '@victframework/application';
import { b1CatalogDescriptors, b1CatalogImplementations } from '@victframework/ui-svelte';
import {
  consumerActionIds,
  consumerActions,
  consumerContractInputTypes,
  consumerContracts,
  consumerViewFields,
} from './definition.js';
import { consumerDocuments } from './documents.js';

export function compileConsumerDocuments(
  /** Defaults to the committed seeds; the finished app passes the SAVED documents. */
  documents: readonly import('@victframework/ui').UiDocument[] = consumerDocuments,
): ResolvedUiAttachments {
  return resolveUiAttachments({
    application: { actions: consumerActions, screens: [] },
    uiDocuments: documents.map((document) => ({ document })),
    uiExtensions: b1CatalogDescriptors,
    actionIds: consumerActionIds,
    routeIds: [],
    viewFields: consumerViewFields,
    contracts: consumerContracts,
    contractInputTypes: consumerContractInputTypes,
  });
}

export { b1CatalogDescriptors, b1CatalogImplementations };
