import { UI_CLASS_LIST_LIMIT,UI_CLASS_NAME_LIMIT,UI_CLASS_NAME_PATTERN } from '@victframework/ui';
import { screenRecipes } from './recipes.js';
import {graphEditDefinitions,graphEditChangesPresentation} from './graph-edit-schema.js';

// JSON Schema describes the same closed subset validated again by Zod and the
// canonical editor. All user text is data; this guidance never grants authority.
const string = { type: 'string' };
const scalar = { $ref:'#/$defs/scalar' };
const identifier = { $ref:'#/$defs/identifier' };
const contentProperties = {
 classes:{$ref:'#/$defs/classList',description:'Canonical authored DOM class tokens. Omit to preserve; [] clears. Use this field rather than attributes.class, which the renderer overrides.'},
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
 when:opSchema('when',['nodeId','wrapperId','conditionId'],{nodeId:identifier,wrapperId:identifier,conditionId:identifier}),
 slotScope:opSchema('slotScope',['nodeId','slot'],{nodeId:identifier,slot:identifier,scope:{$ref:'#/$defs/slotScope'}}),
 editGraph:opSchema('editGraph',['nodeId','expectedGraphRevision','changes'],{nodeId:identifier,expectedGraphRevision:{type:'integer',minimum:0},changes:{...graphEditChangesPresentation,description:'Exact workspace revision selects graph1 or graph2 semantics. Read registry dataContracts for the versioned graph and operation grammar.'}}),
 theme:opSchema('theme',['role'],{role:{enum:['surface','text','textMuted','border','accent','accentText','highlight','highlightText','focusRing','disabledSurface','disabledText','elevation']},value:{type:'string',maxLength:500}}),
 style:opSchema('style',['nodeId','property'],{nodeId:identifier,part:identifier,property:{type:'string',minLength:1,maxLength:80},value:{$ref:'#/$defs/styleValue'},conditionId:identifier,pseudo:{enum:['hover','focus','active','disabled']}}),
 wireInput:opSchema('wireInput',['nodeId','key'],{nodeId:identifier,key:{$ref:'#/$defs/stateKey'},initial:scalar}),
};
// Flat guidance respects the existing bridge's depth-8 presentation bound.
// Zod's discriminated closed operation union remains authoritative.
export const editPresentation = {
  $defs: {
    ...graphEditDefinitions,
    ...operationDefinitions,
    operation: { oneOf:Object.keys(operationDefinitions).map(op=>({$ref:`#/$defs/${op}`})) },
    identifier:{type:'string',minLength:1,maxLength:160,pattern:'^[a-zA-Z0-9_.:-]+$',not:{enum:['__proto__','constructor','prototype']}},
    stateKey:{allOf:[{$ref:'#/$defs/identifier'},{pattern:'^[a-zA-Z0-9_-]+$'}]},
    scalar:{anyOf:[{type:'string',maxLength:4000},{type:'number'},{type:'boolean'}]},
    propValue:{anyOf:[{$ref:'#/$defs/scalar'},{$ref:'#/$defs/stringList'},{$ref:'#/$defs/numberList'}]},
    stringList:{type:'array',maxItems:100,items:{type:'string',maxLength:4000}},
    numberList:{type:'array',maxItems:100,items:{type:'number'}},
    classList:{type:'array',maxItems:UI_CLASS_LIST_LIMIT,items:{type:'string',minLength:1,maxLength:UI_CLASS_NAME_LIMIT,pattern:UI_CLASS_NAME_PATTERN}},
    attributes:{type:'object',propertyNames:{$ref:'#/$defs/identifier'},additionalProperties:{$ref:'#/$defs/scalar'}},
    props:{type:'object',propertyNames:{$ref:'#/$defs/identifier'},additionalProperties:{$ref:'#/$defs/propValue'}},
    styles:{type:'object',propertyNames:{type:'string',minLength:1,maxLength:80},additionalProperties:{type:'string',maxLength:500}},
    expression:{description:'Existing pure expression grammar; bounded to depth 8 and 100 nodes.',oneOf:[{$ref:'#/$defs/literalExpression'},{$ref:'#/$defs/refExpression'},{$ref:'#/$defs/compareExpression'},{$ref:'#/$defs/booleanExpression'},{$ref:'#/$defs/conditionalExpression'},{$ref:'#/$defs/opExpression'}]},
    compareExpression:{type:'object',additionalProperties:false,required:['type','op','left','right'],properties:{type:{const:'compare'},op:{enum:['eq','ne','lt','lte','gt','gte']},left:{$ref:'#/$defs/expression'},right:{$ref:'#/$defs/expression'}}},
    booleanExpression:{type:'object',additionalProperties:false,required:['type','op','terms'],properties:{type:{const:'boolean'},op:{enum:['and','or','not']},terms:{type:'array',minItems:1,maxItems:20,items:{$ref:'#/$defs/expression'}}}},
    conditionalExpression:{type:'object',additionalProperties:false,required:['type','when','then','otherwise'],properties:{type:{const:'conditionalValue'},when:{$ref:'#/$defs/expression'},then:{$ref:'#/$defs/expression'},otherwise:{$ref:'#/$defs/expression'}}},
    opExpression:{type:'object',additionalProperties:false,required:['type','name','args'],properties:{type:{const:'op'},name:identifier,args:{type:'array',maxItems:20,items:{$ref:'#/$defs/expression'}}}},
    valueType:{enum:['string','number','boolean','isoDate','isoTime','stringList','numberList']},
    scopeName:{type:'string',minLength:1,maxLength:160,pattern:'^[A-Za-z_][A-Za-z0-9_-]*$',not:{enum:['__proto__','prototype','constructor']}},
    slotScope:{type:'object',additionalProperties:false,required:['schema','props'],properties:{schema:{const:'vict.ui-slot-scope@1'},props:{type:'array',maxItems:100,items:{$ref:'#/$defs/scopeProp'}},state:{type:'object',propertyNames:{$ref:'#/$defs/scopeName'},additionalProperties:{$ref:'#/$defs/scopeState'}},conditions:{type:'object',propertyNames:{$ref:'#/$defs/scopeName'},additionalProperties:{$ref:'#/$defs/expression'}},outputs:{type:'array',maxItems:100,items:{$ref:'#/$defs/scopeOutput'}}}},
    scopeProp:{type:'object',additionalProperties:false,required:['name','type'],properties:{name:{$ref:'#/$defs/scopeName'},type:{enum:['string','number','boolean','isoDate','isoTime','stringList','numberList','array']},default:{$ref:'#/$defs/propValue'}}},
    scopeState:{type:'object',additionalProperties:false,required:['key','type','initial'],properties:{key:{$ref:'#/$defs/scopeName'},type:{$ref:'#/$defs/valueType'},initial:{$ref:'#/$defs/propValue'},controlled:{type:'boolean'}}},
    scopeOutput:{type:'object',additionalProperties:false,required:['name','payload'],properties:{name:{$ref:'#/$defs/scopeName'},payload:{enum:['void','string','number','boolean','isoDate','isoTime','stringList','numberList']},description:{type:'string',maxLength:1000}}},
    styleValue:{oneOf:[{$ref:'#/$defs/styleText'},{$ref:'#/$defs/styleToken'},{$ref:'#/$defs/styleBinding'}]},
    styleDeclarations:{type:'array',minItems:0,maxItems:20,items:{$ref:'#/$defs/styleDeclaration'}},
    styleDeclaration:{type:'object',additionalProperties:false,required:['property','value'],properties:{property:{type:'string',minLength:1,maxLength:80},value:{$ref:'#/$defs/styleValue'}}},
    styleText:{type:'object',additionalProperties:false,required:['type','value'],properties:{type:{const:'text'},value:{type:'string',maxLength:500}}},
    styleToken:{type:'object',additionalProperties:false,required:['type','id'],properties:{type:{const:'token'},id:identifier}},
    styleBinding:{type:'object',additionalProperties:false,required:['type','expression'],properties:{type:{const:'binding'},expression:{$ref:'#/$defs/expression'}}},
    literalExpression:{type:'object',additionalProperties:false,required:['type','value'],properties:{type:{const:'literal'},value:{anyOf:[{$ref:'#/$defs/scalar'},{type:'null'}]}}},
    refExpression:{type:'object',additionalProperties:false,required:['type','path'],properties:{type:{const:'ref'},path:{type:'string',minLength:1,maxLength:300}}},
    binding: { oneOf:[{$ref:'#/$defs/stateBinding'},{$ref:'#/$defs/actionBinding'},{$ref:'#/$defs/emitBinding'}] },
    emitBinding:{type:'object',additionalProperties:false,required:['emit'],properties:{emit:{$ref:'#/$defs/emit'}}},
    emit:{type:'object',additionalProperties:false,required:['output'],properties:{output:{$ref:'#/$defs/scopeName'},value:{$ref:'#/$defs/expression'}}},
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
      items: {$ref:'#/$defs/operation'},
    },
  },
};

