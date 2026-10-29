import type { UiDocument } from '@victframework/ui';
import type { GraphDocumentV2 } from '../src/editor/model-v2.js';
import { typedCompositionDocument } from './composition-fixtures.js';

/** Canonical test composition, never an authoring recipe or actual-agent proof. */
export function nestedCompositionDocument():UiDocument {
  const inner=typedCompositionDocument('research','nested-composition');
  const nested=inner.nodes.workspace;if(nested.kind!=='component')throw Error('Fixture');
  const innerGraph=String(inner.localState.graph.initial);
  const graph:GraphDocumentV2={schema:'vict.flow-graph@2',revision:0,
    nodeTypes:[{id:'container',label:'Container',parameters:{innerGraph:{type:'string',default:innerGraph}},ports:[]}],
    nodes:[{id:'outer-node',type:'container',label:'Outer project node',position:{x:80,y:60},values:{}}],edges:[],
  };
  const {workspace:_old,...nodes}=inner.nodes;
  return {...inner,root:'outer-workspace',nodes:{...nodes,
    'outer-workspace':{kind:'component',id:'outer-workspace',definitionId:'vict.flow.workspace',revision:'2',props:{graph:{type:'ref',path:'state.graph'}},outputs:{graphChange:{setState:{key:'graph'}}},slots:{
      content:{name:'content',children:['outer-layout'],scope:{schema:'vict.ui-slot-scope@1',props:[]}},
      body:{name:'body',children:['outer-card'],scope:{schema:'vict.ui-slot-scope@1',props:[{name:'readOnly',type:'boolean'}],state:{innerGraph:{key:'innerGraph',type:'string',initial:'',controlled:true}}}},
    }},
    'outer-layout':{kind:'element',id:'outer-layout',tag:'section',children:['outer-viewport']},
    'outer-viewport':{kind:'component',id:'outer-viewport',definitionId:'vict.flow.viewport',revision:'2',props:{label:{type:'literal',value:'Outer graph'},height:{type:'literal',value:760}}},
    'outer-card':{kind:'element',id:'outer-card',tag:'article',children:['outer-title','inner-workspace'],localStyle:[{property:'width',value:{type:'text',value:'760px'}}]},
    'outer-title':{kind:'element',id:'outer-title',tag:'header',children:['outer-title-text'],classes:['vict-graph-drag-handle']},
    'outer-title-text':{kind:'text',id:'outer-title-text',content:{type:'literal',value:'Nested project container'}},
    'inner-workspace':{...nested,id:'inner-workspace',props:{...nested.props,graph:{type:'ref',path:'state.innerGraph'},readOnly:{type:'ref',path:'prop.readOnly'}},outputs:{graphChange:{setState:{key:'innerGraph'}}}},
  },localState:{graph:{key:'graph',type:'string',initial:JSON.stringify(graph)}}};
}
