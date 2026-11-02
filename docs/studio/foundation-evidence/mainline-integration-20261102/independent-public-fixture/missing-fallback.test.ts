import {expect,it} from 'vitest';
import {canonicalUiDocument,compileUiDocument,defaultSemanticElementCatalog,UiEditSession} from '@victframework/ui';
import {projectStructure,structureId} from '@victframework/ui-structure-svelte/projection';
import {structureBehavior} from '@victframework/ui-structure-svelte/behavior';

it('keeps already-admitted native change interactions projectable without inventing a missing fallback',()=>{
 const document=JSON.parse(JSON.stringify({schema:'vict.ui-document@1',id:'admitted-native-change',revision:'1',root:'field',nodes:{field:{kind:'element',id:'field',tag:'input',attributes:{type:'text'},children:[],interactions:[{on:'change',action:'setState',key:'message'}]}},localState:{message:{key:'message',type:'string',initial:'Complete initial value'}},componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{}}));
 const before=canonicalUiDocument(document).contentDigest;
 expect(compileUiDocument(document,defaultSemanticElementCatalog()).ok).toBe(true);
 expect(canonicalUiDocument(UiEditSession.open({document,storedRevision:'1'}).document).contentDigest).toBe(before);
 const graph=projectStructure(document);
 expect(graph.edges.some(edge=>edge.target===structureId(document.id,'state','message')&&edge.data?.role==='updates')).toBe(true);
 const behavior=structureBehavior(document,'field');expect(behavior).toHaveLength(1);
 expect(behavior[0]!.value).toContain('entered');expect(behavior[0]!.value).not.toMatch(/undefined|fallback/i);
 expect(canonicalUiDocument(document).contentDigest).toBe(before);
});
