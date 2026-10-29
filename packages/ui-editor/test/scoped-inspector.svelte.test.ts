import { expect,it } from 'vitest';
import { mount,unmount,flushSync } from 'svelte';
import type { UiDocument,UiExtensionDescriptor } from '@victframework/ui';
import Inspector from '../src/Inspector.svelte';
import NativeInputContent from '../src/NativeInputContent.svelte';
import type { TransactionDraft } from '../src/commands.js';
function fixture():UiDocument{return {schema:'vict.ui-document@1',id:'scoped-inspector',revision:'1',root:'workspace',nodes:{workspace:{kind:'component',id:'workspace',definitionId:'example.workspace',revision:'1',slots:{body:{name:'body',scope:{schema:'vict.ui-slot-scope@1',props:[{name:'nodeId',type:'string'}],state:{nodeValue:{key:'nodeValue',type:'string',initial:'node',controlled:true}},outputs:[{name:'generate',payload:'string'}]},children:['button','field']}}},button:{kind:'component',id:'button',definitionId:'example.control',revision:'1',props:{value:{type:'ref',path:'state.nodeValue'}},outputs:{change:{emit:{output:'generate',value:{type:'ref',path:'state.nodeValue'}}}}},field:{kind:'element',id:'field',tag:'textarea',children:[]}},localState:{rootSecret:{key:'rootSecret',type:'string',initial:'owner root value'}},componentDefinitions:{},conditions:{},assets:{},tokens:{},styleSources:{}};}
const descriptor:UiExtensionDescriptor={id:'example.control',revision:'1',rendererImplementationId:'example',props:[{name:'value',type:'string'}],outputs:[{name:'change',payload:'string'}],styleTargets:['root']};
it('shows scoped emit and only lexical scoped state choices in the manual Inspector',async()=>{
 const source=fixture(),target=document.createElement('div');document.body.append(target);
 const app=mount(Inspector,{target,props:{document:source,selectedOccurrence:'scoped-inspector|button',componentDescriptors:[descriptor],section:'Behavior',onApply:()=>true}});
 flushSync();
 expect(target.textContent).toContain('Scoped output: generate');
 const options=[...target.querySelectorAll<HTMLOptionElement>('[aria-label="change state target"] option')].map(option=>option.value);
 expect(options).toContain('nodeValue');expect(options).not.toContain('rootSecret');
 await unmount(app);target.remove();
});
it('connects a native body input to declared node state without creating a root field',async()=>{
 const source=fixture(),field=source.nodes.field;if(field.kind!=='element')throw Error('fixture');
 const target=document.createElement('div');document.body.append(target);const drafts:TransactionDraft[]=[];
 const app=mount(NativeInputContent,{target,props:{document:source,node:field,references:['state.nodeValue'],referenceLabels:{},labels:{},onApply:draft=>{drafts.push(draft);return true;}}});
 flushSync();
 const button=[...target.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Connect scoped field state');expect(button).toBeDefined();button!.click();flushSync();
 expect(drafts).toHaveLength(1);expect(drafts[0].commands.map(command=>command.op)).toEqual(['setAttribute','connectInteraction']);
 expect(drafts[0].commands).toMatchObject([{value:{type:'ref',path:'state.nodeValue'}},{interaction:{key:'nodeValue'}}]);
 expect(source.localState).not.toHaveProperty('nodeValue');
 await unmount(app);target.remove();
});
