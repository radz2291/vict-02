import { screenRecipes } from './recipes.js';

// JSON Schema describes the same closed subset validated again by Zod and the
// canonical editor. All user text is data; this guidance never grants authority.
const string = { type: 'string' };
const scalar = { $ref:'#/$defs/scalar' };
const identifier = { $ref:'#/$defs/identifier' };
const contentProperties = {
 text:{type:'string',maxLength:4000},headingLevel:{type:'integer',minimum:1,maximum:6},
 attributes:{$ref:'#/$defs/attributes'},props:{$ref:'#/$defs/props'},styles:{$ref:'#/$defs/styles'},
};
const recipePattern = `^(?:${screenRecipes.map(recipe => recipe.id.replaceAll('.', '\\.')).join('|')})$`;
const opSchema = (op: string, required: string[], properties: Record<string,unknown>) => ({ type:'object',additionalProperties:false,required:['op',...required],properties:{op:{const:op},...properties} });
const positionProperties = {slotName:identifier,index:{type:'integer',minimum:0,maximum:1000}};
const operationDefinitions = {
 insert:opSchema('insert',['kind','nodeId','parentId'],{kind:{enum:['element','text','component']},nodeId:identifier,parentId:identifier,...positionProperties,tag:{type:'string',minLength:1,maxLength:60},componentId:identifier,revision:identifier,expression:{$ref:'#/$defs/expression'},...contentProperties}),
 add:opSchema('add',['recipe','nodeId','parentId'],{recipe:{type:'string',pattern:recipePattern},nodeId:identifier,parentId:identifier,...positionProperties,replacePlaceholder:{type:'boolean'},...contentProperties}),
 modify:opSchema('modify',['nodeId'],{nodeId:identifier,...contentProperties}),
 move:opSchema('move',['nodeId','newParentId'],{nodeId:identifier,newParentId:identifier,...positionProperties}),
 remove:opSchema('remove',['nodeId'],{nodeId:identifier}),
 bind:opSchema('bind',['nodeId','prop'],{nodeId:identifier,prop:identifier,expression:{$ref:'#/$defs/expression'}}),
 connect:opSchema('connect',['nodeId','output'],{nodeId:identifier,output:identifier,binding:{$ref:'#/$defs/binding'}}),
 declareState:opSchema('declareState',['key','type','initial'],{key:{$ref:'#/$defs/stateKey'},type:{enum:['string','number','boolean','isoDate','isoTime','stringList','numberList']},initial:{$ref:'#/$defs/propValue'}}),
 bindText:opSchema('bindText',['nodeId'],{nodeId:identifier,expression:{$ref:'#/$defs/expression'}}),
 bindAttribute:opSchema('bindAttribute',['nodeId','name'],{nodeId:identifier,name:identifier,expression:{$ref:'#/$defs/expression'}}),
 declareToken:opSchema('declareToken',['id','value'],{id:identifier,value:{type:'string',minLength:1,maxLength:500}}),
 declareCondition:opSchema('declareCondition',['id','kind','query'],{id:identifier,kind:{enum:['media','container']},query:{type:'string',minLength:1,maxLength:500},name:identifier}),
 defineStyleSource:opSchema('defineStyleSource',['id','declarations'],{id:identifier,declarations:{$ref:'#/$defs/styleDeclarations'},conditionId:identifier,pseudo:{enum:['hover','focus','active','disabled']},replace:{type:'boolean'}}),
 attachStyleSource:opSchema('attachStyleSource',['nodeId','sourceId'],{nodeId:identifier,sourceId:identifier,index:{type:'integer',minimum:0,maximum:1000}}),
 detachStyleSource:opSchema('detachStyleSource',['nodeId','sourceId'],{nodeId:identifier,sourceId:identifier}),
 removeStyleSource:opSchema('removeStyleSource',['id'],{id:identifier}),
 style:opSchema('style',['nodeId','property'],{nodeId:identifier,property:{type:'string',minLength:1,maxLength:80},value:{$ref:'#/$defs/styleValue'},conditionId:identifier,pseudo:{enum:['hover','focus','active','disabled']}}),
 wireInput:opSchema('wireInput',['nodeId','key'],{nodeId:identifier,key:{$ref:'#/$defs/stateKey'},initial:scalar}),
};
// Flat guidance respects the existing bridge's depth-8 presentation bound.
// Zod's discriminated closed operation union remains authoritative.
export const editPresentation = {
  $defs: {
    ...operationDefinitions,
    operation: { oneOf:Object.keys(operationDefinitions).map(op=>({$ref:`#/$defs/${op}`})) },
    identifier:{type:'string',minLength:1,maxLength:160,pattern:'^[a-zA-Z0-9_.:-]+$',not:{enum:['__proto__','constructor','prototype']}},
    stateKey:{allOf:[{$ref:'#/$defs/identifier'},{pattern:'^[a-zA-Z0-9_-]+$'}]},
    scalar:{anyOf:[{type:'string',maxLength:4000},{type:'number'},{type:'boolean'}]},
    propValue:{anyOf:[{$ref:'#/$defs/scalar'},{$ref:'#/$defs/stringList'},{$ref:'#/$defs/numberList'}]},
    stringList:{type:'array',maxItems:100,items:{type:'string',maxLength:4000}},
    numberList:{type:'array',maxItems:100,items:{type:'number'}},
    attributes:{type:'object',propertyNames:{$ref:'#/$defs/identifier'},additionalProperties:{$ref:'#/$defs/scalar'}},
    props:{type:'object',propertyNames:{$ref:'#/$defs/identifier'},additionalProperties:{$ref:'#/$defs/propValue'}},
    styles:{type:'object',propertyNames:{type:'string',minLength:1,maxLength:80},additionalProperties:{type:'string',maxLength:500}},
    expression:{oneOf:[{$ref:'#/$defs/literalExpression'},{$ref:'#/$defs/refExpression'}]},
    styleValue:{oneOf:[{$ref:'#/$defs/styleText'},{$ref:'#/$defs/styleToken'},{$ref:'#/$defs/styleBinding'}]},
    styleDeclarations:{type:'array',minItems:0,maxItems:20,items:{$ref:'#/$defs/styleDeclaration'}},
    styleDeclaration:{type:'object',additionalProperties:false,required:['property','value'],properties:{property:{type:'string',minLength:1,maxLength:80},value:{$ref:'#/$defs/styleValue'}}},
    styleText:{type:'object',additionalProperties:false,required:['type','value'],properties:{type:{const:'text'},value:{type:'string',maxLength:500}}},
    styleToken:{type:'object',additionalProperties:false,required:['type','id'],properties:{type:{const:'token'},id:identifier}},
    styleBinding:{type:'object',additionalProperties:false,required:['type','expression'],properties:{type:{const:'binding'},expression:{$ref:'#/$defs/expression'}}},
    literalExpression:{type:'object',additionalProperties:false,required:['type','value'],properties:{type:{const:'literal'},value:{$ref:'#/$defs/scalar'}}},
    refExpression:{type:'object',additionalProperties:false,required:['type','path'],properties:{type:{const:'ref'},path:{type:'string',minLength:1,maxLength:300}}},
    binding: { oneOf:[{$ref:'#/$defs/stateBinding'},{$ref:'#/$defs/actionBinding'}] },
    stateBinding:{type:'object',additionalProperties:false,required:['setState'],properties:{setState:{$ref:'#/$defs/setState'}}},
    actionBinding:{type:'object',additionalProperties:false,required:['invokeAction'],properties:{invokeAction:{$ref:'#/$defs/invokeAction'}}},
    setState: { type:'object',additionalProperties:false,required:['key'],properties:{key:identifier,value:{$ref:'#/$defs/expression'}} },
    invokeAction: { type:'object',additionalProperties:false,required:['actionId'],properties:{actionId:identifier,input:{type:'object',propertyNames:{$ref:'#/$defs/identifier'},additionalProperties:{$ref:'#/$defs/expression'}}} },
  },
  type: 'object',
  additionalProperties: false,
  required: ['expectedRevision', 'reason', 'operations'],
  properties: {
    expectedRevision: {
      ...string,minLength:1,maxLength:160,
      description:
        'Copy studio_screen_read.expectedRevision exactly, including any # suffix. document.revision is source metadata and is not this editing token.',
    },
    reason:{type:'string',minLength:1,maxLength:240},
    operations: {
      type: 'array',
      minItems: 1,
      maxItems: 40,
      items: {
        $ref: '#/$defs/operation',
        type: 'object',
        additionalProperties: false,
        required: ['op'],
        properties: {
          op: { enum: Object.keys(operationDefinitions) },
          key: { ...string, description: 'declareState or wireInput only: simple unique local state key.' },
          type: { enum: ['string','number','boolean','isoDate','isoTime','stringList','numberList'] }, initial: {$ref:'#/$defs/propValue'},
          kind:{enum:['element','text','component','media','container']},tag:string,componentId:identifier,revision:identifier,
          id:identifier,name:identifier,query:string,property:string,value:{anyOf:[{$ref:'#/$defs/styleValue'},{type:'string',minLength:1,maxLength:500}]},conditionId:identifier,pseudo:{enum:['hover','focus','active','disabled']},
          declarations:{$ref:'#/$defs/styleDeclarations'},replace:{type:'boolean'},sourceId:identifier,
          replacePlaceholder: { type: 'boolean', description: 'add only: false explicitly preserves seeded slot children; default replaces an unchanged seed.' },
          recipe: {
            type: 'string',
            // A single enum would exceed the bridge's frozen 64-item bound.
            // The equivalent anchored pattern retains the complete finite vocabulary.
            pattern: `^(?:${screenRecipes.map(recipe => recipe.id.replaceAll('.', '\\.')).join('|')})$`,
          },
          nodeId: string,
          parentId: string,
          newParentId: string,
          slotName: string,
          index: { type: 'integer', minimum: 0 },
          prop: { ...string, description: 'bind only: declared component prop name.' },
          expression: { $ref: '#/$defs/expression', description: 'bind only; omit to reset.' },
          output: { ...string, description: 'connect only: declared component output name.' },
          binding: { $ref: '#/$defs/binding', description: 'connect only; omit to disconnect. Matching output/state types required.' },
          ...contentProperties,
        },
      },
    },
  },
};

