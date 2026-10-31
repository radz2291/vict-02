/** Additive graph@3 contracts. Retained @1/@2 metadata is never widened. */
import {graphDocumentSchemaV2,graphClipboardSchemaV2,graphOperationSchemasV2,type GraphJsonSchema} from './graph-schemas.js';
const record=(properties:Record<string,GraphJsonSchema>,required=Object.keys(properties)):GraphJsonSchema=>({type:'object',properties,required,additionalProperties:false});
const freeze=<T>(value:T):T=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const graphEdgeAppearanceSchema=freeze(record({
 route:{enum:['bezier','straight','orthogonal']},pattern:{enum:['solid','dash','dot']},
 color:{type:'string',pattern:'^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|token:[a-z][a-z0-9-]*)$'},
 width:{type:'number',exclusiveMinimum:0},startArrow:{enum:['none','arrow','closed']},endArrow:{enum:['none','arrow','closed']},
},[]));
const oldEdge=graphDocumentSchemaV2.properties!.edges!.items!;
const edge=record({...oldEdge.properties,appearance:graphEdgeAppearanceSchema},oldEdge.required as string[]);
const list=(items:GraphJsonSchema):GraphJsonSchema=>({type:'array',items});
export const graphDocumentSchemaV3=freeze({...graphDocumentSchemaV2,$id:'urn:vict:flow-graph:3',$comment:'Typed graph@2 topology and parameters, with portable static canvas defaults and edge appearance overrides. No execution semantics.',properties:{...graphDocumentSchemaV2.properties,schema:{const:'vict.flow-graph@3'},edges:list(edge),edgeDefaults:graphEdgeAppearanceSchema}});
export const graphClipboardSchemaV3=freeze({...graphClipboardSchemaV2,properties:{...graphClipboardSchemaV2.properties,schema:{const:'vict.flow-clipboard@3'},edges:list(edge),edgeDefaults:graphEdgeAppearanceSchema}});
const operation=(type:string,properties:Record<string,GraphJsonSchema>):GraphJsonSchema=>record({type:{const:type},...properties});
export const graphOperationSchemasV3=freeze({...graphOperationSchemasV2,
 connect:operation('connect',{edge:record(edge.properties as Record<string,GraphJsonSchema>,['source','sourcePort','target','targetPort'])}),
 setEdgeDefaults:operation('setEdgeDefaults',{appearance:graphEdgeAppearanceSchema}),
 setEdgeAppearance:operation('setEdgeAppearance',{edgeId:oldEdge.properties!.id!,appearance:graphEdgeAppearanceSchema}),
 clearEdgeAppearance:operation('clearEdgeAppearance',{edgeId:oldEdge.properties!.id!}),
});
export const graphOperationsSchemaV3=freeze({$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:vict:flow-operations:3',type:'array',minItems:1,items:{oneOf:Object.values(graphOperationSchemasV3)}} satisfies GraphJsonSchema);
