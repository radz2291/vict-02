import {expect,it} from 'vitest';
import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
import {installedAuthoringRegistry,authoringContract} from '../../../../apps/studio/src/lib/designer/authoring.js';
import {screenRecipes} from '../../../../apps/studio/src/lib/designer/recipes.js';
import {patternAuthoringPackage} from '../../../../packages/ui-patterns-svelte/src/authoring/knowledge.js';
it('installs both exact first-visit contracts but offers one latest Studio manual recipe',()=>{
 expect(installedAuthoringRegistry.issues).toEqual([]);
 const contracts=installedAuthoringRegistry.contracts.filter(item=>item.descriptor.id==='vict.pattern.first-visit');
 expect(contracts.map(item=>item.descriptor.revision)).toEqual(['1','2']);
 const recipes=screenRecipes.filter(item=>item.id==='vict.pattern.first-visit');
 expect(recipes).toHaveLength(1);
 const root=recipes[0]!.create('manual-reset').find(item=>item.id==='manual-reset');
 expect(root).toMatchObject({kind:'component',definitionId:'vict.pattern.first-visit',revision:'2',props:{allowReset:{type:'literal',value:true}}});
 expect(authoringContract('vict.pattern.first-visit','1')?.descriptor.props.some(item=>item.name==='allowReset')).toBe(false);
 expect(authoringContract('vict.pattern.first-visit','2')?.descriptor.styleTargets).toContain('reset');
 for(const registration of patternAuthoringPackage.registrations){
  const fragment=registration.seed!;
  const document:UiDocument={schema:'vict.ui-document@1',id:'independent-firstvisit-registry',revision:'1',root:fragment.root,nodes:Object.fromEntries(fragment.nodes.map(node=>[node.id,node])),componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:fragment.localState??{}};
  const compiled=compileUiDocument(document,defaultSemanticElementCatalog(),installedAuthoringRegistry.descriptors);
  expect(compiled.ok,`${registration.descriptor.id}@${registration.descriptor.revision}: ${JSON.stringify(compiled)}`).toBe(true);
 }
 expect(patternAuthoringPackage.registrations).toHaveLength(10);
});
