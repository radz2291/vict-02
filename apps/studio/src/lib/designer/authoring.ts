/** Explicit family installation. Package registrations supply all component knowledge. */
import { createUiAuthoringRegistry, effectiveUiDescriptor, type UiNode } from '@victframework/ui';
import { catalogAuthoringPackage, catalogImplementations } from '@victframework/ui-svelte';
import { aiAuthoringPackage, aiAuthoringImplementations } from '@victframework/ui-ai-svelte/authoring';
import { flowAuthoringPackage, flowAuthoringImplementations } from '@victframework/ui-flow-svelte/authoring';

export const installedAuthoringImplementations = [...catalogImplementations,...aiAuthoringImplementations,...flowAuthoringImplementations];
export const installedAuthoringRegistry = createUiAuthoringRegistry(
  [catalogAuthoringPackage,aiAuthoringPackage,flowAuthoringPackage],installedAuthoringImplementations,{requireCompatibility:true},
);
export const installedAuthoringDescriptors = installedAuthoringRegistry.descriptors;
/** Installed presentation provider only; ancestor-slot checks still prove each occurrence's context. */
export const installedAuthoringHostCapabilities = ['vict.flow.canvas-context@1'] as const;
export function authoringContract(id:string, revision?:string) {
  const descriptor=effectiveUiDescriptor({definitionId:id,revision},installedAuthoringDescriptors);
  return descriptor && installedAuthoringRegistry.contracts.find(item=>item.descriptor.id===descriptor.id&&item.descriptor.revision===descriptor.revision);
}
export function nodeDescriptor(node:UiNode|undefined) {
  return node?.kind==='component'?effectiveUiDescriptor(node,installedAuthoringDescriptors):undefined;
}
