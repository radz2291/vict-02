/** One package-owned policy for manual, Source, recipe and general agent authoring. */
import { authoringSemanticIssues, type UiDiagnostic, type UiDocument } from '@victframework/ui';
import { installedAuthoringRegistry, installedAuthoringHostCapabilities } from './authoring.js';

export function screenAuthoringIssues(document:UiDocument,previous?:UiDocument):readonly UiDiagnostic[] {
  return authoringSemanticIssues(document,installedAuthoringRegistry,{previous,legacy:previous===undefined,hostCapabilities:installedAuthoringHostCapabilities}).map(issue=>{
    const node=typeof issue.nodeId==='string'?document.nodes[issue.nodeId]:undefined;
    return issue.hostCode==='UI_AUTHORING_ANCESTOR_SLOT'&&node?.kind==='component'&&node.definitionId.startsWith('vict.catalog.')
      ? {...issue,code:'UI_EDIT_VALIDATION_FAILED',hostCode:'STUDIO_COMPONENT_CONTEXT',ruleCode:issue.hostCode,message:`${node.definitionId} (${node.id}) requires its declared component context and slot. ${issue.message}`} as UiDiagnostic
      : issue;
  });
}
export function screenPlacementIssues(document:UiDocument,previous?:UiDocument):readonly UiDiagnostic[] {
  return screenAuthoringIssues(document,previous).filter(issue=>issue.severity==='error');
}
