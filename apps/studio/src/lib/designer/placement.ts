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

/** Non-blocking guidance has its own projection; storage admission only consumes errors. */
export function screenAuthoringGuidance(document:UiDocument) {
  const warnings=screenAuthoringIssues(document).filter(issue=>issue.severity==='warning');
  return {
    count:warnings.length,
    items:warnings.slice(0,20).map(issue=>({
      code:String(issue.hostCode??issue.code).slice(0,100),
      message:issue.message.slice(0,500),
      nodeId:typeof issue.nodeId==='string'?issue.nodeId.slice(0,200):undefined,
      path:typeof issue.path==='string'?issue.path.slice(0,300):undefined,
      legacy:issue.legacyCompatibility===true,
    })),
    more:warnings.length>20,
  };
}
