import type { UiSlotScope } from './document.js';
import type { UiScopeInfo } from './expressions.js';
import { isUiValueOfType, isUiValueType } from './values.js';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const closed=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).every(key=>keys.includes(key));
function expressionShape(value:unknown,depth=0,seen=new Set<object>()):boolean {
  if(!record(value)||depth>64||seen.has(value))return false;seen.add(value);
  const child=(next:unknown)=>expressionShape(next,depth+1,seen);
  let valid=false;
  switch(value.type){
    case 'literal':valid=closed(value,['type','value'])&&(value.value===null||typeof value.value==='string'||typeof value.value==='boolean'||(typeof value.value==='number'&&Number.isFinite(value.value)));break;
    case 'ref':valid=closed(value,['type','path'])&&typeof value.path==='string'&&!!value.path;break;
    case 'compare':valid=closed(value,['type','op','left','right'])&&['eq','ne','lt','lte','gt','gte'].includes(String(value.op))&&child(value.left)&&child(value.right);break;
    case 'boolean':valid=closed(value,['type','op','terms'])&&['and','or','not'].includes(String(value.op))&&Array.isArray(value.terms)&&value.terms.every(child);break;
    case 'conditionalValue':valid=closed(value,['type','when','then','otherwise'])&&child(value.when)&&child(value.then)&&child(value.otherwise);break;
    case 'op':valid=closed(value,['type','name','args'])&&typeof value.name==='string'&&!!value.name&&Array.isArray(value.args)&&value.args.every(child);break;
  }
  seen.delete(value);return valid;
}
const safeName=(name:unknown):name is string=>typeof name==='string'&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)&&!['__proto__','prototype','constructor'].includes(name);
/** Shape validation stays independent of any specialist renderer or domain model. */
export function slotScopeProblems(value: unknown): string[] {
  if(!value||typeof value!=='object'||Array.isArray(value))return ['Scoped slot requires a scope record.'];
  const scope=value as UiSlotScope, problems:string[]=[];
  if(!closed(value as Record<string,unknown>,['schema','props','state','outputs','conditions']))problems.push('Unknown scoped slot field.');
  if(scope.schema!=='vict.ui-slot-scope@1')problems.push('Unsupported scoped slot schema.');
  if(!Array.isArray(scope.props))return [...problems,'Scoped slot props must be declarations.'];
  const names=new Set<string>();
  for(const prop of scope.props){if(!record(prop)||!closed(prop as unknown as Record<string,unknown>,['name','type','default'])||!safeName(prop.name)||names.has(prop.name)||!(prop.type==='array'||(typeof prop.type==='string'&&isUiValueType(prop.type))))problems.push('Scoped slot props need unique valid names and types.');else names.add(prop.name);if(prop?.default!==undefined&&!(prop.type==='array'?Array.isArray(prop.default):isUiValueOfType(prop.default,prop.type)))problems.push('Scoped slot prop default has the wrong type.');}
  if(scope.state!==undefined&&(!scope.state||typeof scope.state!=='object'||Array.isArray(scope.state)))problems.push('Scoped slot state must be a declaration record.');
  else for(const [key,decl] of Object.entries(scope.state??{})){if(!safeName(key)||!record(decl)||!closed(decl as unknown as Record<string,unknown>,['key','type','initial','controlled'])||decl.key!==key||!isUiValueType(decl.type)||!isUiValueOfType(decl.initial,decl.type)||(decl.controlled!==undefined&&typeof decl.controlled!=='boolean'))problems.push('Scoped state requires matching key, type and initial value.');}
  if(scope.outputs!==undefined&&!Array.isArray(scope.outputs))problems.push('Scoped outputs must be declarations.');
  else {const outputs=new Set<string>();for(const output of scope.outputs??[]){if(!record(output)||!closed(output as unknown as Record<string,unknown>,['name','payload','description'])||!safeName(output.name)||outputs.has(output.name)||!(output.payload==='void'||(typeof output.payload==='string'&&isUiValueType(output.payload))))problems.push('Scoped outputs need unique valid names and payload types.');else outputs.add(output.name);}}
  if(scope.conditions!==undefined&&(!scope.conditions||typeof scope.conditions!=='object'||Array.isArray(scope.conditions)||Object.entries(scope.conditions).some(([name,value])=>!safeName(name)||!expressionShape(value))))problems.push('Scoped conditions must be named expression records.');
  return problems;
}
export function scopedSlotLexicalScope(parent:UiScopeInfo,scope:UiSlotScope):UiScopeInfo {
  return {...parent,inDefinition:false,scopedSlot:true,propTypes:Object.fromEntries(scope.props.map(prop=>[prop.name,prop.type])),stateTypes:Object.fromEntries(Object.entries(scope.state??{}).map(([key,decl])=>[key,decl.type])),scopedOutputs:scope.outputs??[],scopedConditions:scope.conditions??{}};
}
