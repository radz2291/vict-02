import {describe,it,expect} from 'vitest';
import {effectiveUiDescriptor} from '@victframework/ui';
import {installedAuthoringRegistry} from '../src/lib/designer/authoring.js';
import {screenRecipes} from '../src/lib/designer/recipes.js';
import {newScreen} from '../src/lib/designer/application.js';
import {documentCursor,prepareAgentEdit} from '../src/lib/designer/agent-edits.js';
import {agentContext} from '../src/lib/designer/agent-reads.js';

// Explicit product inventory: package additions cannot make this test pass by
// merely iterating whatever registrations happened to be installed.
const required=['conversation','message','prompt-input','transcript','reasoning','chain-of-thought','tool','plan','task','queue','terminal','test-results','stack-trace','subagent','context','sources','inline-citation','file-tree','checkpoint','confirmation','suggestion','model-selector','markdown'];

describe('AI public capability exposure through Studio',()=>{
  it('offers one manual recipe at the effective revision while retaining exact old contracts',()=>{
    expect(installedAuthoringRegistry.issues).toEqual([]);
    for(const name of required){
      const id=`vict.ai.${name}`;
      const descriptor=effectiveUiDescriptor({definitionId:id},installedAuthoringRegistry.descriptors);
      expect(descriptor, id).toBeTruthy();
      const recipes=screenRecipes.filter(recipe=>recipe.id===id);
      expect(recipes, id).toHaveLength(1);
      const node=recipes[0]!.create(`manual-${name}`).find(node=>node.kind==='component'&&node.definitionId===id);
      expect(node, id).toMatchObject({kind:'component',definitionId:id,revision:descriptor!.revision});
    }
    for(const id of ['vict.ai.message','vict.ai.prompt-input']){
      expect(screenRecipes.find(recipe=>recipe.id===id)!.create('latest')[0]).toMatchObject({revision:'3'});
      expect(installedAuthoringRegistry.contracts.filter(item=>item.descriptor.id===id).map(item=>item.descriptor.revision)).toEqual(['1','2','3']);
    }
  });

  it('admits the public reasoning and tool adapters through real scoped discovery and edit preparation',()=>{
    const document=newScreen('Public AI authoring','ai-exposure-proof');
    const cursor=documentCursor(document,'r1','ai-exposure-epoch');
    for(const name of ['reasoning','chain-of-thought','tool']){
      const id=`vict.ai.${name}`;
      const contract=agentContext(document,cursor,undefined,{section:'contracts',components:[{id,revision:'1'}],includeExamples:true,limit:20});
      expect(contract.ok,JSON.stringify(contract)).not.toBe(false);
      expect(JSON.stringify(contract)).toContain(id);
      const prepared=prepareAgentEdit(document,cursor,{expectedRevision:cursor.revision,reason:'Expose supplied public process information',operations:[{op:'insert',kind:'component',nodeId:`public-${name}`,parentId:'screen',componentId:id,revision:'1'}]},`proposal-${name}`);
      expect(prepared.ok,JSON.stringify(prepared)).toBe(true);
    }
  });
});
