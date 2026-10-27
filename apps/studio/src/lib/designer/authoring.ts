/** Explicit family installation. Package registrations supply all component knowledge. */
import { createUiAuthoringRegistry, effectiveUiDescriptor, type UiNode } from '@victframework/ui';
import { catalogAuthoringPackage, catalogImplementations } from '@victframework/ui-svelte';
import { aiAuthoringPackage, aiAuthoringImplementations } from '@victframework/ui-ai-svelte/authoring';
import {mediaAuthoringPackage,mediaAuthoringImplementations} from '@victframework/ui-media-svelte/authoring';
import {patternAuthoringPackage,patternAuthoringImplementations} from '@victframework/ui-patterns-svelte/authoring';
import { flowAuthoringPackage, flowAuthoringImplementations } from '@victframework/ui-flow-svelte/authoring';

export const installedAuthoringImplementations = [...catalogImplementations,...aiAuthoringImplementations,...flowAuthoringImplementations,...mediaAuthoringImplementations,...patternAuthoringImplementations];
export const installedAuthoringRegistry = createUiAuthoringRegistry(
  [catalogAuthoringPackage,aiAuthoringPackage,flowAuthoringPackage,mediaAuthoringPackage,patternAuthoringPackage],installedAuthoringImplementations,{requireCompatibility:true},
);
export const installedAuthoringDescriptors = installedAuthoringRegistry.descriptors;
/** Installed presentation provider only; ancestor-slot checks still prove each occurrence's context. */
export const installedAuthoringHostCapabilities = ['vict.flow.canvas-context@1','media.asset-store@1'] as const;
export function authoringContract(id:string, revision?:string) {
  const descriptor=effectiveUiDescriptor({definitionId:id,revision},installedAuthoringDescriptors);
  return descriptor && installedAuthoringRegistry.contracts.findLast(item=>item.descriptor.id===descriptor.id&&item.descriptor.revision===descriptor.revision);
}
export function nodeDescriptor(node:UiNode|undefined) {
  return node?.kind==='component'?effectiveUiDescriptor(node,installedAuthoringDescriptors):undefined;
}
