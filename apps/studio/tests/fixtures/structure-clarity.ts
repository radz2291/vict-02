import type { UiDocument, UiNode } from '@victframework/ui';
import { newScreen } from '../../src/lib/designer/application.js';
export function clarityFixture(count=2): UiDocument {
  const seed=newScreen('Structure clarity','structure-clarity');
  const nodes:Record<string,UiNode>={
    screen:{id:'screen',kind:'element',tag:'main',children:['title','conditional','repeat','card','portal',...Array.from({length:count},(_,i)=>`field-${i}`)]},
    title:{id:'title',kind:'element',tag:'h1',children:['title-text']},
    'title-text':{id:'title-text',kind:'text',content:{type:'literal',value:'An intentionally long heading whose complete content must remain available in accessible labels and tooltips'}},
    conditional:{id:'conditional',kind:'conditional',branches:[{when:'show',children:['yes']},{children:['no']}]},
    yes:{id:'yes',kind:'text',content:{type:'literal',value:'Shown content'}},
    no:{id:'no',kind:'text',content:{type:'literal',value:'Fallback content'}},
    repeat:{id:'repeat',kind:'repeat',collection:{type:'ref',path:'state.items'},key:{type:'literal',value:'stable'},itemName:'item',templateRoot:'template'},
    template:{id:'template',kind:'text',content:{type:'literal',value:'Repeated content'}},
    card:{id:'card',kind:'component',definitionId:'local.card',slots:{}},
    definition:{id:'definition',kind:'element',tag:'section',children:['slot']},
    slot:{id:'slot',kind:'slot',name:'content',fallback:['fallback']},
    fallback:{id:'fallback',kind:'text',content:{type:'literal',value:'Default slot content'}},
    portal:{id:'portal',kind:'portal',target:{overlayId:'logical-overlay'},children:['portal-text']},
    'portal-text':{id:'portal-text',kind:'text',content:{type:'literal',value:'Logical portal child'}},
  };
  for(let i=0;i<count;i++)nodes[`field-${i}`]={id:`field-${i}`,kind:'element',tag:'input',attributes:{'aria-label':`Field ${i}`,value:{type:'ref',path:'state.message'}},children:[]};
  return {...seed,nodes,componentDefinitions:{'local.card':{id:'local.card',revision:'1',root:'definition',props:[],slots:{content:{}}}},conditions:{show:{id:'show',kind:'localState',when:{type:'ref',path:'state.accepted'}}},localState:{...seed.localState,items:{key:'items',type:'stringList',initial:[]}}};
}
