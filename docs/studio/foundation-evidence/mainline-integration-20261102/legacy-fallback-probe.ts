import {compileUiDocument,defaultSemanticElementCatalog,canonicalUiDocument} from '@victframework/ui';
import {projectStructure,structureId} from '@victframework/ui-structure-svelte/projection';
import {structureBehavior} from '@victframework/ui-structure-svelte/behavior';
// JSON admission, not a newly typed authoring shape. Existing compiler/renderer
// accept historical native changes without a declared fallback expression.
const source=JSON.parse(JSON.stringify({schema:'vict.ui-document@1',id:'legacy-fallback',revision:'1',root:'root',nodes:{root:{id:'root',kind:'element',tag:'main',children:['field']},field:{id:'field',kind:'element',tag:'input',attributes:{value:{type:'ref',path:'state.message'}},children:[],interactions:[{on:'change',action:'setState',key:'message'}]}},componentDefinitions:{},localState:{message:{key:'message',type:'string',initial:'Initial'}},styleSources:{},conditions:{},tokens:{},assets:{}}));
const before=canonicalUiDocument(source).contentDigest;
const compiled=compileUiDocument(source,defaultSemanticElementCatalog());
try{
 if(!compiled.ok)throw Error('Canonical admission refused: '+JSON.stringify(compiled));
 const graph=projectStructure(source),state=structureId(source.id,'state','message'),field=structureId(source.id,'node','field');
 if(!graph.edges.some(edge=>edge.source===field&&edge.target===state&&edge.data?.role==='updates'))throw Error('Missing declared state update');
 if(graph.edges.some(edge=>edge.data?.role==='fallback'))throw Error('Invented absent fallback');
 const behavior=structureBehavior(source,'field');
 if(!behavior.some(fact=>fact.value.includes('entered value'))||behavior.some(fact=>fact.value.includes('fallback')))throw Error('Behavior invents fallback');
 if(canonicalUiDocument(source).contentDigest!==before)throw Error('Source changed');
 console.log(JSON.stringify({status:'PASS',canonicalAdmission:compiled.ok,sourceDigest:before,sourceUnchanged:true,behavior,updates:true,absentFallbackPreserved:true}));
}catch(error){console.log(JSON.stringify({status:'FAIL',canonicalAdmission:compiled.ok,sourceDigest:before,sourceUnchanged:canonicalUiDocument(source).contentDigest===before,error:String(error)}));process.exitCode=1;}
