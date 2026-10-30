import {graphOperationSchemasV1,graphOperationSchemasV2,graphOperationsSchemaV1,graphOperationsSchemaV2,graphStructuralProblems,type GraphJsonSchema} from '@victframework/ui-flow-svelte';

/** Hoist nested structural rules into local definitions. This preserves the exact
 * public grammar within the existing bounded presentation-depth contract. */
const definitions:Record<string,{$defs:Record<string,unknown>}>= {},known=new Map<string,string>();
function reference(rule:GraphJsonSchema):{$ref:string} {
  const signature=JSON.stringify(rule),prior=known.get(signature);
  if(prior)return {$ref:prior};
  const bucket=`g${Math.floor(known.size/48)}`,name=`s${known.size}`;
  const pointer=`#/$defs/${bucket}/$defs/${name}`;known.set(signature,pointer);
  const body:Record<string,unknown>={...rule};
  for(const field of ['properties','$defs'] as const)if(rule[field])body[field]=Object.fromEntries(Object.entries(rule[field]!).map(([key,child])=>[key,reference(child)]));
  for(const field of ['items','propertyNames','not'] as const)if(rule[field])body[field]=reference(rule[field]!);
  if(typeof rule.additionalProperties==='object')body.additionalProperties=reference(rule.additionalProperties);
  for(const field of ['oneOf','anyOf'] as const)if(rule[field])body[field]=rule[field]!.map(reference);
  (definitions[bucket]??={$defs:{}}).$defs[name]=body;return {$ref:pointer};
}
export const graphEditChangesPresentation=reference({anyOf:[graphOperationSchemasV1,graphOperationSchemasV2].map(operations=>({type:'array',minItems:1,maxItems:40,items:{oneOf:Object.values(operations)}}))});
export const graphEditDefinitions:Readonly<Record<string,unknown>>=definitions;
/** Shape admission for the public tool; exact workspace version and semantic
 * topology/domain checks still run against canonical source before an edit. */
export function graphEditShapeValid(operations:unknown):boolean {
  return !graphStructuralProblems(graphOperationsSchemaV1,operations,'changes').length||!graphStructuralProblems(graphOperationsSchemaV2,operations,'changes').length;
}
