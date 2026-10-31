import {expect,it} from 'vitest';
import {slotScopeProblems} from '../src/slot-scope.js';
import type {UiExpression} from '../src/document.js';
it('validates deep finite scoped expressions completely without weakening closed shapes, values or cycles',()=>{
  let expression:UiExpression={type:'literal',value:true};
  for(let i=0;i<100;i++)expression={type:'boolean',op:'not',terms:[expression]};
  const scope={schema:'vict.ui-slot-scope@1',props:[],conditions:{deep:expression}};
  expect(slotScopeProblems(scope)).toEqual([]);
  expect(slotScopeProblems({...scope,conditions:{bad:{type:'literal',value:Infinity}}})).not.toEqual([]);
  expect(slotScopeProblems({...scope,conditions:{bad:{type:'ref',path:'state.a',ignored:true}}})).not.toEqual([]);
  const cycle:{type:'boolean';op:'not';terms:unknown[]}={type:'boolean',op:'not',terms:[]};cycle.terms.push(cycle);
  expect(slotScopeProblems({...scope,conditions:{cycle}})).not.toEqual([]);
});
