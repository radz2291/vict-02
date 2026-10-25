import { expect, it } from 'vitest';
import { newScreen } from '../src/lib/designer/application.js';
import { testScenarios } from '../src/lib/designer/test-scenarios.js';
import type { UiDocument } from '@victframework/ui';

function fixture(): UiDocument {
  const seed=newScreen('Scenario projection','scenarios');
  return {...seed,nodes:{screen:{id:'screen',kind:'element',tag:'main',children:['field','submit']},field:{id:'field',kind:'element',tag:'input',attributes:{type:'text',value:{type:'ref',path:'state.message'}},children:[]},submit:{id:'submit',kind:'element',tag:'button',attributes:{disabled:{type:'ref',path:'state.busy'}},children:[],interactions:[{on:'click',action:'invokeAction',actionId:'demo.submit',input:{message:{type:'ref',path:'state.message'},accepted:{type:'ref',path:'state.accepted'}}}]}}};
}
it('does not infer scenarios from unused conventional state names or disconnected action nodes',()=>{
  const source=fixture();
  expect(testScenarios(newScreen('Empty','empty'))).toEqual([]);
  const disconnected={...source,nodes:{...source.nodes,screen:{...source.nodes.screen!,kind:'element' as const,tag:'main',children:[]}}};
  expect(testScenarios(disconnected)).toEqual([]);
});
it('requires reachable action wiring and a rendered pending connection before offering Loading',()=>{
  const source=fixture();
  expect(testScenarios(source).map(choice=>choice.id)).toEqual(['loading','failure','denied','content:empty','content:typical','content:long']);
  const submit=source.nodes.submit!;
  const noConsumer={...source,nodes:{...source.nodes,submit:{...submit,attributes:{}}}} as UiDocument;
  expect(testScenarios(noConsumer).map(choice=>choice.id)).not.toContain('loading');
});
it('excludes hidden subtrees, conditional templates and arbitrary data attributes from ready-made cases',()=>{
  const source=fixture();
  for(const parent of [
    {id:'screen',kind:'element',tag:'main',children:['field','submit'],attributes:{hidden:true}},
    {id:'screen',kind:'element',tag:'main',children:['field','submit'],localStyle:[{property:'display',value:{type:'text',value:'none'}}]},
    {id:'screen',kind:'conditional',branches:[{children:['field','submit']}]},
  ])expect(testScenarios({...source,nodes:{...source.nodes,screen:parent}} as UiDocument)).toEqual([]);
  const arbitrary={...source,nodes:{...source.nodes,submit:{...source.nodes.submit,attributes:{'data-pending':{type:'ref',path:'state.busy'}}}}} as UiDocument;
  expect(testScenarios(arbitrary).some(choice=>choice.id==='loading')).toBe(false);
  expect(testScenarios(arbitrary).find(choice=>choice.id==='failure')!.description).toContain('no directly connected error message');
});
it('seeds only connected plain text, excludes sensitive/specialized/unbound inputs and leaves canonical source exact',()=>{
  const source=fixture(),before=JSON.stringify(source);
  const content=testScenarios(source).find(choice=>choice.id==='content:long')!;
  expect(Object.keys(content.values!)).toEqual(['message']);
  expect(JSON.stringify(source)).toBe(before);
  const field=source.nodes.field!;
  for(const type of ['password','email','hidden'])expect(testScenarios({...source,nodes:{...source.nodes,field:{...field,attributes:{type,value:{type:'ref',path:'state.message'}}}}} as UiDocument).some(choice=>choice.id.startsWith('content:'))).toBe(false);
});
it('offers opening a dialog only for a declared controlled Open binding of the right type',()=>{
  const source=fixture();
  const dialog={...source,nodes:{...source.nodes,screen:{id:'screen',kind:'element',tag:'main',children:['dialog']},dialog:{id:'dialog',kind:'component',definitionId:'vict.catalog.dialog',props:{open:{type:'ref',path:'state.dialogOpen'}},slots:{}}}} as UiDocument;
  expect(testScenarios(dialog)).toMatchObject([{id:'open:dialog',values:{dialogOpen:true}}]);
  expect(testScenarios({...dialog,localState:{...dialog.localState,dialogOpen:{key:'dialogOpen',type:'string',initial:''}}})).toEqual([]);
});
