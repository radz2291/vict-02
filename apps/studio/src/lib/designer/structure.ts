import {projectStructure as project, type StructureContext} from '@victframework/ui-structure-svelte/projection';
import type {UiDocument} from '@victframework/ui';
import {studioNodeLabels,studioDisplayName,studioStyleName} from './presentation.js';
export * from '@victframework/ui-structure-svelte/projection';
export const studioStructurePresentation = {nodeLabels:studioNodeLabels,displayName:studioDisplayName,styleName:studioStyleName};
export function projectStructure(document:UiDocument,context:StructureContext={}) { return project(document,{...context,presentation:{...studioStructurePresentation,...context.presentation}}); }
