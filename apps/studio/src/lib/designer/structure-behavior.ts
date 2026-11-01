import {structureBehavior as behavior,conditionDescription as condition,branchDescription as branch,expressionDescription as expression,structureStateName as state} from '@victframework/ui-structure-svelte/behavior';
import {studioDisplayName} from './presentation.js';
export * from '@victframework/ui-structure-svelte/behavior';
export const structureBehavior=(...args:Parameters<typeof behavior>)=>behavior(args[0],args[1],args[2]??studioDisplayName);
export const conditionDescription=(...args:Parameters<typeof condition>)=>condition(args[0],args[1],args[2]??studioDisplayName);
export const branchDescription=(...args:Parameters<typeof branch>)=>branch(args[0],args[1],args[2],args[3]??studioDisplayName);
export const expressionDescription=(...args:Parameters<typeof expression>)=>expression(args[0],args[1]??studioDisplayName);
export const structureStateName=(...args:Parameters<typeof state>)=>state(args[0],args[1]??studioDisplayName);
