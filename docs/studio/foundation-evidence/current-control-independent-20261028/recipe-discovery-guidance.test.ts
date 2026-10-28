import {it,expect} from 'vitest';
import {newScreen} from '../../../../apps/studio/src/lib/designer/application.js';
import {documentCursor} from '../../../../apps/studio/src/lib/designer/agent-edits.js';
import {agentContext} from '../../../../apps/studio/src/lib/designer/agent-reads.js';
it('uses the documented native recipe queries against the real dispatcher and retains strict section admission',()=>{
 const source=newScreen('Discovery review','discovery-review'),cursor=documentCursor(source,'r1','discovery-review');
 const read=(query:unknown)=>agentContext(source,cursor,undefined,query);
 for(const [recipe,tag] of [['rhea-input','input'],['rhea-native-select','select']]){
  const palette=read({section:'palette',query:recipe});
  expect(palette.ok).not.toBe(false);expect((palette.items as {id:string}[]).some(item=>item.id===recipe)).toBe(true);
  let offset=0,text='';
  for(let guard=0;guard<20;guard++){
   const page=read({section:'component',recipe,...(offset?{offset}:{})});
   expect(page).toMatchObject({kind:'native-recipe',recipe});text+=page.sourceJson;
   if(page.nextOffset===null)break;offset=page.nextOffset as number;
  }
  expect(JSON.parse(text).nodes.some((node:{kind:string;tag?:string})=>node.kind==='element'&&node.tag===tag)).toBe(true);
 }
 for(const query of [{section:'component',key:'rhea-input'},{section:'palette',recipe:'rhea-input'},{section:'source',key:'rhea-input'},{section:'component',recipe:'rhea-input',limit:21}])expect(read(query)).toMatchObject({ok:false,code:'STUDIO_AGENT_READ_QUERY'});
 expect(read({section:'source',nodeId:'rhea-input'})).toMatchObject({ok:false,code:'STUDIO_AGENT_NODE_NOT_FOUND'});
});
