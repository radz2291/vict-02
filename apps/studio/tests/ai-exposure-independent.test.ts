import {describe,expect,it} from 'vitest';
import {effectiveUiDescriptor} from '@victframework/ui';
import {installedAuthoringRegistry} from '../src/lib/designer/authoring.js';
import {screenRecipes} from '../src/lib/designer/recipes.js';
import {newScreen} from '../src/lib/designer/application.js';
import {documentCursor,prepareAgentEdit} from '../src/lib/designer/agent-edits.js';
import {agentContext} from '../src/lib/designer/agent-reads.js';

// Product inventory is independent of whichever registrations are installed.
const identities=['conversation','message','prompt-input','transcript','reasoning','chain-of-thought','tool','plan','task','queue','terminal','test-results','stack-trace','subagent','context','sources','inline-citation','file-tree','checkpoint','confirmation','suggestion','model-selector','markdown'] as const;

describe('independent complete public AI exposure',()=>{
  it('admits every intended public capability through the current exact contract and shared agent recipe path',()=>{
    expect(installedAuthoringRegistry.issues).toEqual([]);
    const document=newScreen('Independent public AI exposure','independent-ai-exposure');
    const cursor=documentCursor(document,'r1','independent-ai-exposure');
    for(const name of identities){
      const id=`vict.ai.${name}`,descriptor=effectiveUiDescriptor({definitionId:id},installedAuthoringRegistry.descriptors);
      expect(descriptor,`${id} descriptor`).toBeTruthy();
      const manual=screenRecipes.filter(recipe=>recipe.id===id);
      expect(manual,`${id} manual identity`).toHaveLength(1);
      expect(manual[0]!.create(`manual-${name}`).some(node=>node.kind==='component'&&node.definitionId===id&&node.revision===descriptor!.revision),`${id} effective manual revision`).toBe(true);
      const contracts=agentContext(document,cursor,undefined,{section:'contracts',components:[{id,revision:descriptor!.revision}],limit:20});
      expect(contracts.ok,`${id}: ${JSON.stringify(contracts)}`).toBe(true);
      expect(contracts.items,`${id} exact contract`).toEqual(expect.arrayContaining([expect.objectContaining({id,revision:descriptor!.revision})]));
      const prepared=prepareAgentEdit(document,cursor,{expectedRevision:cursor.revision,reason:'Author supplied public AI presentation',operations:[{op:'add',recipe:id,nodeId:`proof-${name}`,parentId:'screen'}]},`independent-${name}`);
      expect(prepared.ok,`${id}: ${JSON.stringify(prepared)}`).toBe(true);
      if(prepared.ok)expect(Object.values(prepared.document.nodes).some(node=>node.kind==='component'&&node.definitionId===id&&node.revision===descriptor!.revision),`${id} authored exact revision`).toBe(true);
    }
  });

  it('retains all six historical contracts alongside explicit latest message/composer revisions',()=>{
    const ai=installedAuthoringRegistry.contracts.filter(contract=>contract.descriptor.id.startsWith('vict.ai.'));
    expect(ai).toHaveLength(28);expect(new Set(ai.map(contract=>contract.descriptor.id)).size).toBe(23);
    for(const name of ['conversation','message','prompt-input']){
      const id=`vict.ai.${name}`;
      for(const revision of ['1','2'])expect(ai.some(contract=>contract.descriptor.id===id&&contract.descriptor.revision===revision),`${id}@${revision}`).toBe(true);
      expect(effectiveUiDescriptor({definitionId:id},installedAuthoringRegistry.descriptors)?.revision).toBe(name==='conversation'?'2':'3');
    }
  });
});
