import {projectStructure as project, structureNodePresentation as present, type StructureNodeData, type StructureContext} from '@victframework/ui-structure-svelte/projection';
import type {UiDocument} from '@victframework/ui';
import {studioNodeLabels,studioDisplayName,studioStyleName} from './presentation.js';
export * from '@victframework/ui-structure-svelte/projection';
export const studioStructurePresentation = {nodeLabels:studioNodeLabels,displayName:studioDisplayName,styleName:studioStyleName};
export function projectStructure(document:UiDocument,context:StructureContext={}) { return project(document,{...context,presentation:{...studioStructurePresentation,...context.presentation}}); }

export function structureNodePresentation(document:UiDocument,data:StructureNodeData,context:StructureContext={}) { return present(document,data,{...context,presentation:{...studioStructurePresentation,...context.presentation}}); }
