import type { UiDocument, UiExpression } from '@victframework/ui';
import { readableName } from './presentation.js';
export const structureStateName = (key: string) => ({message:'Message',accepted:'Agreement',busy:'Submitting',dialogOpen:'Dialog open',actionError:'Action error',actionResult:'Action result'} as Record<string,string>)[key] ?? readableName(key);

/** Describes declarations only. No expression evaluation or runtime-state inference. */
export function expressionDescription(expression: UiExpression): string {
  switch (expression.type) {
    case 'literal': return typeof expression.value === 'string' ? `“${expression.value}”` : String(expression.value);
    case 'ref': return expression.path.startsWith('state.') ? structureStateName(expression.path.slice(6)) : readableName(expression.path);
    case 'compare': return `${expressionDescription(expression.left)} ${{eq:'equals',ne:'does not equal',lt:'is less than',lte:'is at most',gt:'is greater than',gte:'is at least'}[expression.op]} ${expressionDescription(expression.right)}`;
    case 'boolean': return expression.op === 'not' ? `not (${expression.terms.map(expressionDescription).join(', ')})` : expression.terms.map(term => `(${expressionDescription(term)})`).join(` ${expression.op} `);
    case 'conditionalValue': return `${expressionDescription(expression.then)} when ${expressionDescription(expression.when)}; otherwise ${expressionDescription(expression.otherwise)}`;
    case 'op': return `${readableName(expression.name)} (${expression.args.map(expressionDescription).join(', ')})`;
  }
}
export function conditionDescription(document: UiDocument, id: string): string {
  const condition = document.conditions[id];
  if (!condition) return `${readableName(id)} (condition unavailable)`;
  if (condition.kind === 'localState') {
    const description = expressionDescription(condition.when);
    return condition.when.type === 'ref' ? `${description} is on` : description;
  }
  if (condition.kind === 'media' || condition.kind === 'container') {
    const name=condition.kind==='media'?'screen':readableName(condition.name),width=condition.query.match(/^\(\s*(max|min)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/);
    return width ? `${name} is ${width[2]} px wide or ${width[1]==='max'?'smaller':'larger'}` : `${name} matches ${condition.query}`;
  }
  if (condition.kind === 'variant') return `${readableName(condition.variant)} is ${condition.value}`;
  return `${readableName(condition.name)} environment`;
}
export type StructureBehaviorFact = { name: string; value: string };
export const branchDescription = (document:UiDocument, when:string|undefined, index:number) => when ? `${index===0?'Shown when':'Otherwise, when'} ${conditionDescription(document,when)}` : 'Otherwise';
function structuralFacts(document: UiDocument, sourceId: string): StructureBehaviorFact[] {
  const source = document.nodes[sourceId];
  if (!source) return [];
  if (source.kind === 'conditional') return source.branches.map((branch, index) => ({
    name: branch.when ? `Branch ${index + 1}` : 'Otherwise',
    value: `${branch.when ? branchDescription(document,branch.when,index) : 'Fallback branch after earlier branches'} · ${branch.children.length} item${branch.children.length === 1 ? '' : 's'}`,
  }));
  if (source.kind === 'repeat') return [
    { name: 'Repeats', value: `One template for each item in ${expressionDescription(source.collection)}` },
    { name: 'Item identity', value: expressionDescription(source.key) },
    { name: 'View', value: 'Template source; individual runtime rows are not shown here' },
  ];
  if (source.kind === 'slot') return [{ name: 'Slot', value: readableName(source.name) }, { name: 'Fallback', value: `${source.fallback?.length ?? 0} items used when no content is supplied` }];
  if (source.kind === 'portal') return [{ name: 'Overlay target', value: source.target.overlayId }, { name: 'Support', value: 'Logical ownership only; native portal rendering is not supported' }];
  if (source.kind === 'component') return Object.entries(source.slots ?? {}).map(([name, slot]) => ({ name: `Slot · ${readableName(name)}`, value: `${slot.children.length} supplied item${slot.children.length === 1 ? '' : 's'}` }));
  return [];
}
export function structureBehavior(document: UiDocument, sourceId: string): StructureBehaviorFact[] {
  const source=document.nodes[sourceId];
  if(!source)return [];
  const actionName=(id:string)=>id==='demo.submit'?'Submit (simulated)':readableName(id);
  const events=(source.interactions??[]).map(interaction=>({
    name:interaction.on==='click'?'When clicked':interaction.on==='change'?'When changed':'When submitted',
    value:interaction.action==='setState'?`Updates ${structureStateName(interaction.key)} from ${expressionDescription(interaction.value)}`:interaction.action==='navigate'?`Requests navigation to ${readableName(interaction.routeId)}`:`Requests ${actionName(interaction.actionId)}`,
  }));
  if(source.kind==='component')for(const [name,binding] of Object.entries(source.outputs??{}))events.push({name:`On ${readableName(name)}`,value:'setState' in binding?`Updates ${structureStateName(binding.setState.key)}`:`Requests ${actionName(binding.invokeAction.actionId)}`});
  return [...structuralFacts(document,sourceId),...events];
}
