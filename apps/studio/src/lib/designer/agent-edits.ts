/** Cycle 1.1: a bounded palette vocabulary compiled to the manual editor's transactions. */
import { z } from 'zod';
import {
  applyUiEdit,
  canonicalUiDocument,
  isUiValueOfType,
  type UiNode,
  type UiDocument,
  type UiEditCommand,
} from '@victframework/ui';
import {
  insertRecipe,
  insertSubtree,
  insertRegisteredComponent,
  insertRegisteredElement,
  setBaseStyle,
  setConditionalStyle,
  allowConditionalStyles,
  defineStyleSource,
  attachStyleSource,
  detachStyleSource,
  removeStyleSource,
  StyleSourceEditError,
  wireNativeInput,
  interactiveSlotConflicts,
  compositionChildren,
  canInsertRecipe,
  literalTextTarget,
  resolveOccurrence,
  type EditorBridge,
  type TransactionDraft,
} from '@victframework/ui-editor';
import { screenRecipes } from './recipes.js';
import { authoringContract, installedAuthoringRegistry, installedAuthoringHostCapabilities, nodeDescriptor } from './authoring.js';
import { screenPlacementIssues } from './placement.js';
import { designerCatalogs, screenIssues, compileScreen, actionInputs } from './application.js';

const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_.:-]+$/)
  .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
const value = z.union([scalar, z.array(z.string().max(4000)).max(100), z.array(z.number().finite()).max(100)]);
const expression = z.union([
  z.object({ type: z.literal('literal'), value: scalar }).strict(),
  z.object({ type: z.literal('ref'), path: z.string().min(1).max(300) }).strict(),
]);
const content = {
  text: z.string().max(4000).optional(),
  headingLevel:z.number().int().min(1).max(6).optional(),
  attributes: z.record(id, scalar).optional(),
  props: z.record(id, value).optional(),
  styles: z.record(z.string().min(1).max(80), z.string().max(500)).optional(),
};
const position = { slotName: id.optional(), index: z.number().int().min(0).max(1000).optional() };
const styleValue=z.union([z.object({type:z.literal('text'),value:z.string().max(500)}).strict(),z.object({type:z.literal('token'),id}).strict(),z.object({type:z.literal('binding'),expression}).strict()]);
const styleDeclarations=z.array(z.object({property:z.string().min(1).max(80),value:styleValue}).strict()).max(20);
export const agentOperationSchema = z.discriminatedUnion('op', [
  z.object({op:z.literal('insert'),kind:z.enum(['element','text','component']),nodeId:id,parentId:id,
    tag:z.string().min(1).max(60).optional(),componentId:id.optional(),revision:id.optional(),
    expression:expression.optional(),...position,...content}).strict(),
  z
    .object({
      op: z.literal('add'),
      recipe: z.enum(screenRecipes.map(recipe => recipe.id) as [string, ...string[]]),
      nodeId: id,
      parentId: id,
      ...position,
      replacePlaceholder: z.boolean().optional(),
      ...content,
    })
    .strict(),
  z.object({ op: z.literal('declareState'), key: id.refine(value => /^[a-zA-Z0-9_-]+$/.test(value), 'Use a simple local state key.'), type: z.enum(['string','number','boolean','isoDate','isoTime','stringList','numberList']), initial: value }).strict(),
  z.object({op:z.literal('bindText'),nodeId:id,expression:expression.optional()}).strict(),
  z.object({op:z.literal('bindAttribute'),nodeId:id,name:id,expression:expression.optional()}).strict(),
  z.object({op:z.literal('declareToken'),id,value:z.string().min(1).max(500)}).strict(),
  z.object({op:z.literal('declareCondition'),id,kind:z.enum(['media','container']),query:z.string().min(1).max(500),name:id.optional()}).strict(),
  z.object({op:z.literal('defineStyleSource'),id,declarations:styleDeclarations,conditionId:id.optional(),pseudo:z.enum(['hover','focus','active','disabled']).optional(),replace:z.boolean().optional()}).strict(),
  z.object({op:z.literal('attachStyleSource'),nodeId:id,sourceId:id,index:z.number().int().min(0).max(1000).optional()}).strict(),
  z.object({op:z.literal('detachStyleSource'),nodeId:id,sourceId:id}).strict(),
  z.object({op:z.literal('removeStyleSource'),id}).strict(),
  z.object({op:z.literal('style'),nodeId:id,property:z.string().min(1).max(80),
    value:z.union([z.object({type:z.literal('text'),value:z.string().max(500)}).strict(),z.object({type:z.literal('token'),id}).strict(),z.object({type:z.literal('binding'),expression}).strict()]).optional(),
    conditionId:id.optional(),pseudo:z.enum(['hover','focus','active','disabled']).optional()}).strict(),
  z.object({ op: z.literal('wireInput'), nodeId: id, key: id.refine(value => /^[a-zA-Z0-9_-]+$/.test(value), 'Use a simple local state key.'), initial: scalar.optional() }).strict(),
  z.object({ op: z.literal('modify'), nodeId: id, ...content }).strict(),
  z.object({ op: z.literal('move'), nodeId: id, newParentId: id, ...position }).strict(),
  z.object({ op: z.literal('remove'), nodeId: id }).strict(),
  z.object({ op: z.literal('bind'), nodeId: id, prop: id, expression: expression.optional() }).strict(),
  z.object({ op: z.literal('connect'), nodeId: id, output: id, binding: z.union([
    z.object({ setState: z.object({ key: id, value: expression.optional() }).strict() }).strict(),
    z.object({ invokeAction: z.object({ actionId: id, input: z.record(id, expression).optional() }).strict() }).strict(),
  ]).optional() }).strict(),
]);
export const agentEditSchema = z
  .object({
    expectedRevision: z.string().min(1).max(160),
    reason: z.string().min(1).max(240),
    operations: z.array(agentOperationSchema).min(1).max(40),
  })
  .strict();
/** Shared safe refusal guidance for browser preparation and provider contract validation. */
export function agentEditDiagnostics(error:z.ZodError,input?:unknown) {
 const operations=input && typeof input==='object' && Array.isArray((input as {operations?:unknown}).operations) ? (input as {operations:unknown[]}).operations : [];
 const shape:Record<string,string>={insert:'insert(kind:element|text|component,nodeId,parentId,tag?|componentId+revision|text/expression?,slotName?,index?)',bindText:'bindText(nodeId,expression?)',bindAttribute:'bindAttribute(nodeId,name,expression?)',style:'style(nodeId,property,value?:text|token|binding,conditionId?,pseudo?)',declareToken:'declareToken(id,value)',declareCondition:'declareCondition(id,kind:media|container,query,name?)',add:'add(recipe,nodeId,parentId,slotName?,index?,text?,headingLevel?,attributes?,props?,styles?)',modify:'modify(nodeId,text?,headingLevel?,attributes?,props?,styles?)',move:'move(nodeId,newParentId,slotName?,index?)',remove:'remove(nodeId)',bind:'bind(nodeId,prop,expression?)',connect:'connect(nodeId,output,binding?)',declareState:'declareState(key,type:string|number|boolean|isoDate|isoTime|stringList|numberList,initial:matchingValue)',wireInput:'wireInput(nodeId,key,initial?)'};
 Object.assign(shape,{defineStyleSource:'defineStyleSource(id,declarations:[{property,value:text|token|binding}],conditionId?,pseudo?,replace?:boolean)',attachStyleSource:'attachStyleSource(nodeId,sourceId,index?)',detachStyleSource:'detachStyleSource(nodeId,sourceId)',removeStyleSource:'removeStyleSource(id)'});
 return error.issues.slice(0,8).map(issue=>{
  const operation=typeof issue.path[1]==='number' ? issue.path[1] : undefined;
  const rawPath=issue.path.join('.');const path=rawPath.length>500 ? rawPath.slice(0,470)+'[path truncated]' : rawPath;let expected='';
  if(path.includes('.expression'))expected='Expected exactly {type:"literal",value:scalar} OR {type:"ref",path:"state.key"}; no extra fields. Example: {"type":"ref","path":"state.accepted"}.';
  else if(path.includes('.binding'))expected='Expected {setState:{key,value?:literalOrRef}} OR {invokeAction:{actionId,input?:{field:literalOrRef}}}; no extra fields. Example: {"setState":{"key":"accepted"}}.';
  else if(path.includes('.props'))expected='Expected a property record of scalar values or homogeneous string[]/number[] (max100). Example: {"options":["one","two"]}; mixed lists and object arrays are unsupported.';
  else if(path.endsWith('.initial'))expected='Expected a matching canonical scalar or homogeneous string[]/number[]; date/time strings must be valid ISO values.';
  else if(path.includes('.attributes'))expected='Expected string (max4000), finite number, or boolean. Native expressions use bindAttribute or wireInput.';
  else if(path.includes('.declarations'))expected='Expected 0 to 20 ordered {property,value:{type:"text",value:string}|{type:"token",id}|{type:"binding",expression:literalOrRef}} declarations.';
  else if(operation!==undefined){const value=operations[operation];const op=value && typeof value==='object' ? (value as {op?:unknown}).op : undefined;expected=typeof op==='string' && shape[op] ? 'Expected '+shape[op]+'.' : 'Expected a declared registered insertion, source edit, typed-state, binding or presentation operation.';}
  return {...(operation===undefined ? {} : {operation}),path,message:(expected+' '+issue.message).trim().slice(0,700)};
 });
}
export type AgentEdit = z.infer<typeof agentEditSchema>;
export interface AgentCursor {
  documentId: string;
  revision: string;
  digest: string;
  epoch: string;
}
export interface AgentProposal {
  proposalId: string;
  cursor: AgentCursor;
  edit: AgentEdit;
  resultDigest: string;
}
export type EditFailure = { ok: false; code: string; message: string; diagnostics?: readonly { operation?: number; path: string; message: string; [key:string]:unknown }[]; diagnosticsTruncated?: boolean };
export type EditReceipt = EditFailure | { ok: true; revision: string; digest: string };
export const failure = (code: string, message: string): EditFailure => ({
  ok: false,
  code,
  message,
});

/** Preserve useful canonical detail without forwarding arbitrary compiler payloads. */
export function canonicalEditFailure(issues:readonly {code:string;message:string;[key:string]:unknown}[],operation?:number,target?:{nodeId:string;property:string}):EditFailure {
  type Issue={code:string;message:string;[key:string]:unknown};
  const leaves:{issue:Issue;commandIndex?:number;envelopeCode?:string}[]=[];
  let visited=0;let truncated=false;
  function collect(issue:Issue,depth=0,commandIndex?:number,envelopeCode?:string){
    if(leaves.length>=6||visited>=40){truncated=true;return;}visited++;
    const index=typeof issue.commandIndex==='number'?issue.commandIndex:commandIndex;
    // The canonical edit boundary already retains its authoritative causes.
    // Unwrap only that known envelope; never forward arbitrary nested payloads.
    if(issue.code==='UI_EDIT_VALIDATION_FAILED'&&Array.isArray(issue.diagnostics)&&issue.diagnostics.length){
      if(depth<3){
        const before=leaves.length;
        for(const child of issue.diagnostics.slice(0,20))if(child&&typeof child==='object'&&typeof child.code==='string'&&typeof child.message==='string')collect(child,depth+1,index,envelopeCode??issue.code);
        if(issue.diagnostics.length>20)truncated=true;
        if(leaves.length>before)return;
      }else truncated=true;
    }
    leaves.push({issue,...(index===undefined?{}:{commandIndex:index}),...(envelopeCode?{envelopeCode}:{})});
  }
  for(const issue of issues.slice(0,20))collect(issue);
  if(issues.length>20)truncated=true;
  const diagnostics=leaves.map(({issue,commandIndex,envelopeCode})=>{
    const details:Record<string,unknown>={...(target?{nodeId:target.nodeId,property:target.property}:{})};
    for(const key of ['documentId','nodeId','parentId','definitionId','extensionId','prop','property','output','stateKey','expected','actual','target','slot','slotName','hostCode','styleSourceId','reference']) {
      const item=issue[key];if(typeof item==='string')details[key]=item.slice(0,300);else if(typeof item==='number'||typeof item==='boolean')details[key]=item;
    }
    if(typeof details.nodeId==='string')details.sourcePath=`nodes.${details.nodeId}`;
    return {...details,...(operation===undefined?{}:{operation}),...(commandIndex===undefined?{}:{commandIndex}),...(envelopeCode?{envelopeCode}:{}),code:issue.code,
      path:typeof issue.path==='string'?issue.path.slice(0,500):typeof issue.nodeId==='string'?`nodes.${issue.nodeId}`:operation===undefined?'document':`operations.${operation}`,
      message:issue.message.slice(0,700)};
  });
  return {...failure('STUDIO_AGENT_VALIDATION',`${operation===undefined?'Edit':`Operation ${operation}`} rejected: `+diagnostics.map(issue=>`${issue.code}: ${issue.message}`).join('; ').slice(0,1800)),diagnostics,...(truncated?{diagnosticsTruncated:true}:{})};
}

export function documentCursor(document: UiDocument, revision: string, epoch: string): AgentCursor {
  return {
    documentId: document.id,
    revision,
    digest: canonicalUiDocument(document).contentDigest,
    epoch,
  };
}

export function prepareAgentEdit(
  document: UiDocument,
  cursor: AgentCursor,
  input: unknown,
  requestId: string,
): EditFailure | { ok: true; draft: TransactionDraft; document: UiDocument; digest: string } {
  const parsed = agentEditSchema.safeParse(input);
  if (!parsed.success) return { ...failure('STUDIO_AGENT_INVALID_EDIT', 'Use the exact operation fields. No edits applied.'), diagnostics:agentEditDiagnostics(parsed.error,input) };
  if (
    document.id !== cursor.documentId ||
    canonicalUiDocument(document).contentDigest !== cursor.digest
  )
    return failure(
      'UI_DOC_STALE_REVISION',
      'The screen changed. Read the current screen before requesting another edit.',
    );
  if (parsed.data.expectedRevision !== cursor.revision)
    return failure(
      'STUDIO_AGENT_REVISION_MISMATCH',
      `The edit supplied the wrong working revision. Read the screen and copy expectedRevision exactly: ${JSON.stringify(cursor.revision)}. document.revision is source metadata, not the editing revision. This request applied no edits.`,
    );
  let working = document;
  const commands: UiEditCommand[] = [];
  let activeOperation:number|undefined;
  try {
    for (const [operationIndex, operation] of parsed.data.operations.entries()) {
      activeOperation=operationIndex;
      const next: UiEditCommand[] = [];
      let inserted:readonly UiNode[]=[];
      if(operation.op==='insert') {
        if(Object.hasOwn(working.nodes,operation.nodeId))return failure('STUDIO_AGENT_NODE_EXISTS','Use a fresh node identity.');
        if(operation.kind==='element') {
          if(!operation.tag || !designerCatalogs.elements.elements.some(item=>item.tag===operation.tag))return failure('STUDIO_AGENT_ELEMENT','Use an exact tag from read section elements.');
          if(operation.componentId||operation.revision||operation.expression)return failure('STUDIO_AGENT_INSERT_SHAPE','Element insertion takes tag, attributes and optional literal text, not component identity/expression.');
          const definition=designerCatalogs.elements.elements.find(item=>item.tag===operation.tag)!;
          if(definition.leaf&&operation.text!==undefined)return failure('STUDIO_AGENT_INSERT_SHAPE','This registered native element is leaf-only.');
          inserted=[{kind:'element',id:operation.nodeId,tag:operation.tag,children:operation.text===undefined?[]:[`${operation.nodeId}-text`]},
            ...(operation.text===undefined?[]:[{kind:'text' as const,id:`${operation.nodeId}-text`,content:{type:'literal' as const,value:operation.text}}])];
        } else if(operation.kind==='text') {
          if(operation.tag||operation.componentId||operation.revision||operation.attributes||operation.props||operation.headingLevel||operation.styles)return failure('STUDIO_AGENT_INSERT_SHAPE','Text insertion takes text or expression and its parent/slot position.');
          if(operation.text!==undefined&&operation.expression)return failure('STUDIO_AGENT_INSERT_SHAPE','Choose literal text or a text expression.');
          inserted=[{kind:'text',id:operation.nodeId,content:operation.expression?{type:'expression',expression:operation.expression}:{type:'literal',value:operation.text??''}}];
        } else {
          const contract=operation.componentId&&operation.revision?authoringContract(operation.componentId,operation.revision):undefined;
          if(!installedAuthoringRegistry.ok||!contract)return failure('STUDIO_AGENT_COMPONENT_NOT_FOUND','Supply an exact installed componentId and revision from contracts discovery.');
          if(!['standalone','part'].includes(contract.eligibility.kind))return failure('STUDIO_AGENT_COMPONENT_UNAVAILABLE',contract.eligibility.reason??'This registration needs unavailable host support.');
          if(operation.tag||operation.expression||operation.text!==undefined||operation.attributes||operation.headingLevel)return failure('STUDIO_AGENT_INSERT_SHAPE','Registered components take componentId/revision and declared props/slots, not native text/tag fields.');
          inserted=[{kind:'component',id:operation.nodeId,definitionId:contract.descriptor.id,revision:contract.descriptor.revision,props:{},slots:{}}];
        }
        const target={nodeId:operation.parentId,slotName:operation.slotName,index:operation.index};
        if(operation.kind==='component')next.push(...insertRegisteredComponent({requestId,registry:installedAuthoringRegistry,nodeId:operation.nodeId,definitionId:operation.componentId!,revision:operation.revision!,target,hostCapabilities:installedAuthoringHostCapabilities}).commands);
        else if(operation.kind==='element')next.push(...insertRegisteredElement({requestId,catalog:designerCatalogs.elements,nodeId:operation.nodeId,tag:operation.tag!,text:operation.text,target}).commands);
        else next.push(...insertSubtree(requestId,inserted,target).commands);
      }
      if (operation.op === 'add') {
        const recipe = screenRecipes.find((recipe) => recipe.id === operation.recipe)!;
        if (!canInsertRecipe(recipe, working, { nodeId: operation.parentId, slotName: operation.slotName }))
          return failure('STUDIO_AGENT_COMPONENT_CONTEXT', 'This component part requires a compatible parent and declared slot. Read the recipe placements.');
        next.push(
          ...insertRecipe(requestId, recipe, working, operation.nodeId, {
            nodeId: operation.parentId,
            slotName: operation.slotName,
            index: operation.index,
          }).commands,
        );
        if (operation.replacePlaceholder !== false && operation.slotName) {
          const parent = working.nodes[operation.parentId];
          if (parent?.kind === 'component') {
            const parentRecipe = screenRecipes.find(recipe => recipe.id === parent.definitionId.replace('vict.catalog.', ''));
            const seeded = parentRecipe?.create(parent.id) ?? [];
            const root = seeded[0];
            const children = root?.kind === 'component' ? root.slots?.[operation.slotName]?.children ?? [] : [];
            const current = parent.slots?.[operation.slotName]?.children ?? [];
            const seedMap = new Map(seeded.map(node => [node.id,node]));
            const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([,child]) => !(child && typeof child === 'object' && Object.keys(child).length === 0)).sort(([a],[b]) => a.localeCompare(b)).map(([key,child]) => [key,normalized(child)])) : value;
            const unchanged = (nodeId: string): boolean => !!working.nodes[nodeId] && JSON.stringify(normalized(working.nodes[nodeId])) === JSON.stringify(normalized(seedMap.get(nodeId))) && compositionChildren(working.nodes[nodeId]!).every(unchanged);
            if (children.length && JSON.stringify(current) === JSON.stringify(children) && children.every(unchanged)) {
              next.unshift(...children.map(nodeId => ({ op: 'remove' as const, nodeId, detachFromParent: true })));
            }
          }
        }
      }
      if (operation.op === 'declareState') {
        if (Object.hasOwn(working.localState, operation.key)) return failure('STUDIO_AGENT_STATE_EXISTS', 'State already exists. Read state and bind its exact key; use a fresh key for an independent field.');
        if (!isUiValueOfType(operation.initial,operation.type)) return {...failure('STUDIO_AGENT_STATE_TYPE','The starting value must match the declared canonical type, including valid ISO date/time or a homogeneous list.'),diagnostics:[{operation:operationIndex,path:`operations.${operationIndex}.initial`,message:`Expected ${operation.type}.`,expected:operation.type,actual:Array.isArray(operation.initial)?'array':typeof operation.initial}]};
        next.push({ op: 'replaceDocument', document: { ...working, localState: { ...working.localState, [operation.key]: { key: operation.key, type: operation.type, initial: operation.initial } } } });
      }
      if (operation.op === 'wireInput') next.push(...wireNativeInput({ requestId, document: working, nodeId: operation.nodeId, key: operation.key, initial: operation.initial }).commands);
      if(operation.op==='bindText')next.push({op:'bindExpression',nodeId:operation.nodeId,target:{kind:'text'},expression:operation.expression});
      if(operation.op==='bindAttribute')next.push({op:'bindExpression',nodeId:operation.nodeId,target:{kind:'attribute',name:operation.name},expression:operation.expression});
      if(operation.op==='declareToken'){
        if(Object.hasOwn(working.tokens,operation.id))return failure('STUDIO_AGENT_TOKEN_EXISTS','Token already exists; use a fresh ID.');
        next.push({op:'replaceDocument',document:{...working,tokens:{...working.tokens,[operation.id]:{id:operation.id,value:operation.value}}}});
      }
      if(operation.op==='declareCondition'){
        if(Object.hasOwn(working.conditions,operation.id))return failure('STUDIO_AGENT_CONDITION_EXISTS','Condition already exists; use a fresh ID.');
        if(operation.kind==='container'&&!operation.name)return failure('STUDIO_AGENT_CONDITION','Container conditions require a declared container name.');
        const condition=operation.kind==='media'?{id:operation.id,kind:'media' as const,query:operation.query}:{id:operation.id,kind:'container' as const,query:operation.query,name:operation.name!};
        next.push({op:'replaceDocument',document:{...working,conditions:{...working.conditions,[operation.id]:condition}}});
      }
      if(operation.op==='style'){
        if(operation.conditionId||operation.pseudo) {
          next.push(...allowConditionalStyles(requestId,working,operation.nodeId,operation.conditionId,operation.pseudo).commands);
          next.push(...setConditionalStyle({requestId,nodeId:operation.nodeId,property:operation.property,value:operation.value,conditionId:operation.conditionId,pseudo:operation.pseudo}).commands);
        } else next.push(...setBaseStyle(working,{requestId,nodeId:operation.nodeId,property:operation.property,value:operation.value}).commands);
      }
      if(operation.op==='defineStyleSource')next.push(...defineStyleSource({requestId,document:working,source:{id:operation.id,declarations:operation.declarations,...(operation.conditionId?{conditionId:operation.conditionId}:{}),...(operation.pseudo?{pseudo:operation.pseudo}:{})},replace:operation.replace}).commands);
      if(operation.op==='attachStyleSource')next.push(...attachStyleSource({requestId,document:working,nodeId:operation.nodeId,sourceId:operation.sourceId,index:operation.index}).commands);
      if(operation.op==='detachStyleSource')next.push(...detachStyleSource({requestId,document:working,nodeId:operation.nodeId,sourceId:operation.sourceId}).commands);
      if(operation.op==='removeStyleSource')next.push(...removeStyleSource({requestId,document:working,sourceId:operation.id}).commands);
      if (operation.op === 'move') {
        const node = working.nodes[operation.nodeId];
        const recipe = node?.kind === 'component' ? screenRecipes.find(recipe => recipe.id === node.definitionId.replace('vict.catalog.', '')) : undefined;
        if (recipe && !canInsertRecipe(recipe, working, { nodeId: operation.newParentId, slotName: operation.slotName }))
          return failure('STUDIO_AGENT_COMPONENT_CONTEXT', 'This component part cannot move outside its compatible parent slot.');
        next.push({
          op: 'move',
          nodeId: operation.nodeId,
          newParentId: operation.newParentId,
          slotName: operation.slotName,
          index: operation.index,
        });
      }
      if (operation.op === 'remove')
        next.push({ op: 'remove', nodeId: operation.nodeId, detachFromParent: true });
      if (operation.op === 'bind' || operation.op === 'connect') {
        const node = working.nodes[operation.nodeId];
        const descriptor = nodeDescriptor(node);
        const supported = operation.op === 'bind' ? descriptor?.props.map(prop => prop.name) : descriptor?.outputs?.map(output => output.name);
        const field = operation.op === 'bind' ? operation.prop : operation.output;
        if (!supported?.includes(field)) return { ...failure('STUDIO_AGENT_PROPERTY', `Operation ${operationIndex}: unsupported ${operation.op === 'bind' ? 'prop' : 'output'} ${field}. Supported: ${supported?.join(', ') || '(none)'}. Native fields use wireInput.`), diagnostics: [{ operation: operationIndex, path: `operations.${operationIndex}.${operation.op === 'bind' ? 'prop' : 'output'}`, message: `Expected one of: ${supported?.join(', ') || '(none)'}` }] };
      }
      if (operation.op === 'bind')
        next.push({ op: 'bindExpression', nodeId: operation.nodeId, target: { kind: 'prop', name: operation.prop }, expression: operation.expression });
      if (operation.op === 'connect')
        next.push({ op: 'setOutputBinding', nodeId: operation.nodeId, output: operation.output, binding: operation.binding });
      if (operation.op === 'add' || operation.op === 'modify' || operation.op==='insert') {
        // Recipe IDs are known, so a fresh recipe's direct text child is addressable
        // before the assembled transaction is applied.
        const fresh =
          operation.op === 'add'
            ? screenRecipes
                .find((recipe) => recipe.id === operation.recipe)!
                .create(operation.nodeId)
            : inserted;
        if (operation.text !== undefined && operation.op!=='insert') {
          const target = literalTextTarget(working, operation.nodeId);
          const textId = fresh.find((node) => node.kind === 'text')?.id ?? target?.nodeId;
          if (!textId)
            return failure(
              'STUDIO_AGENT_TEXT_TARGET',
              'This element has no direct literal text. Use attributes or component props.',
            );
          if (target?.prop)
            next.push({
              op: 'bindExpression',
              nodeId: textId,
              target: { kind: 'prop', name: target.prop },
              expression: { type: 'literal', value: operation.text },
            });
          else
            next.push({
              op: 'setProperty',
              nodeId: textId,
              property: 'textLiteral',
              value: operation.text,
            });
        }
        if(operation.headingLevel !== undefined) {
          const node=operation.op === 'add'||operation.op==='insert' ? fresh[0] : working.nodes[operation.nodeId];
          if(node?.kind !== 'element' || !/^h[1-6]$/.test(node.tag)) return failure('STUDIO_AGENT_HEADING_TARGET','headingLevel requires an h1–h6 element. Use the heading recipe or modify an existing heading.');
          next.push({op:'setProperty',nodeId:operation.nodeId,property:'tag',value:`h${operation.headingLevel}`});
        }
        for (const [name, value] of Object.entries(operation.attributes ?? {}))
          next.push({
            op: 'setAttribute',
            nodeId: operation.nodeId,
            name,
            value: typeof value === 'string' ? value : { type: 'literal', value },
          });
        for (const [name, value] of Object.entries(operation.props ?? {})) {
          if (Array.isArray(value)) {
            // Lists are canonical typed state values, never expression literals.
            const staged = next.length ? applyUiEdit({ document: working, revision: cursor.revision },
              { requestId, expectedDocumentRevision: cursor.revision, commands: next }, designerCatalogs)
              : { ok: true as const, document: working };
            if (!staged.ok) return canonicalEditFailure(staged.issues,operationIndex);
            const node = staged.document.nodes[operation.nodeId];
            const descriptor = nodeDescriptor(node);
            const prop = descriptor?.props.find(prop => prop.name === name);
            if (!prop || (prop.type !== 'stringList' && prop.type !== 'numberList') || !isUiValueOfType(value, prop.type))
              return failure('STUDIO_AGENT_VALIDATION', 'Use a homogeneous list matching the declared property type.');
            const current = node?.kind === 'component' ? node.props?.[name] : undefined;
            const boundKey = current?.type === 'ref' && current.path.startsWith('state.') ? current.path.slice(6) : undefined;
            const key = boundKey && staged.document.localState[boundKey]?.type === prop.type ? boundKey
              : `catalog_${operation.nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${name}`;
            const existing = staged.document.localState[key];
            if (existing && key !== boundKey) return failure('STUDIO_AGENT_VALIDATION', 'A local value already owns that identity; choose a different node ID.');
            next.push({ op: 'replaceDocument', document: { ...staged.document, localState: {
              ...staged.document.localState, [key]: { key, type: prop.type, initial: value },
            } } });
            next.push({ op: 'bindExpression', nodeId: operation.nodeId, target: { kind: 'prop', name }, expression: { type: 'ref', path: `state.${key}` } });
            continue;
          }
          next.push({
            op: 'bindExpression',
            nodeId: operation.nodeId,
            target: { kind: 'prop', name },
            expression: { type: 'literal', value },
          });
        }
        for (const [property, value] of Object.entries(operation.styles ?? {}))
          next.push(...setBaseStyle(working,{requestId,nodeId:operation.nodeId,property,value:{type:'text',value}}).commands);
      }
      if (!next.length) return failure('STUDIO_AGENT_EMPTY_EDIT', 'Supply a property to modify.');
      const result = applyUiEdit(
        { document: working, revision: cursor.revision },
        { requestId, expectedDocumentRevision: cursor.revision, commands: next },
        designerCatalogs,
      );
      if (!result.ok) return canonicalEditFailure(result.issues,operationIndex,operation.op==='style'?{nodeId:operation.nodeId,property:operation.property}:undefined);
      working = result.document;
      commands.push(...next);
    }
    // Neutral authoring deliberately returns partial plans with component diagnostics.
    // An agent completion must not promote those error diagnostics to a valid edit.
    const existingConflicts = new Set(interactiveSlotConflicts(document).map(issue => issue.id));
    const addedConflicts = interactiveSlotConflicts(working).filter(issue => !existingConflicts.has(issue.id));
    if (addedConflicts.length) return { ...failure('STUDIO_AGENT_INTERACTIVE_SLOT','A trigger/action/cancel slot already supplies a button. Use text or noninteractive content.'), diagnostics:addedConflicts.map(issue => ({path:`nodes.${issue.nodeId}`,message:`${issue.parentId}.${issue.slot} already owns the interactive trigger.`})) };
    const compiled = compileScreen(working);
    const issues = [
      ...screenPlacementIssues(working,document),
      ...screenIssues(working),
      ...(compiled.ok ? Object.values(compiled.plan.documentPlans ?? {}).flatMap(plan =>
        plan.diagnostics.filter(issue => issue.severity === 'error')) : []),
    ];
    if (issues.length) return canonicalEditFailure(issues);
    if (JSON.stringify(working).length > 200_000 || Object.keys(working.nodes).length > 500)
      return failure('STUDIO_AGENT_LIMIT', 'This screen exceeds the Cycle 1.1 editing limit.');
    return {
      ok: true,
      draft: { requestId, reason: parsed.data.reason, commands },
      document: working,
      digest: canonicalUiDocument(working).contentDigest,
    };
  } catch(error) {
    if(error instanceof StyleSourceEditError){
      const op=activeOperation===undefined?undefined:parsed.data.operations[activeOperation]?.op;
      const field=error.field==='sourceId'&&(op==='defineStyleSource'||op==='removeStyleSource')?'id':error.field;
      return {...failure(error.code,error.message.slice(0,700)),diagnostics:[{operation:activeOperation,path:`operations.${activeOperation}.${field}`,message:error.message.slice(0,700),...(error.nodeId?{nodeId:error.nodeId}:{}),...(error.sourceId?{styleSourceId:error.sourceId}:{})}]};
    }
    return failure(
      'STUDIO_AGENT_INVALID_EDIT',
      'The edit could not be validated. The screen was preserved.',
    );
  }
}

/** Synchronous compare/validate/apply: no asynchronous gap before EditorBridge.apply. */
export function applyAgentProposal(
  bridge: EditorBridge,
  proposal: AgentProposal,
  epoch: string,
  draftBlocked: boolean,
): EditReceipt {
  if (draftBlocked)
    return failure(
      'STUDIO_AGENT_DRAFT',
      'Apply or cancel the pending property, data, rename or source draft, then send a new request.',
    );
  const current = documentCursor(bridge.document, bridge.getSnapshot().revision, epoch);
  if (JSON.stringify(current) !== JSON.stringify(proposal.cursor))
    return failure(
      'UI_DOC_STALE_REVISION',
      'The screen changed while the agent was working. No edit was applied; send a new request using the current screen.',
    );
  const prepared = prepareAgentEdit(bridge.document, current, proposal.edit, proposal.proposalId);
  if (!prepared.ok) return prepared;
  if (prepared.digest !== proposal.resultDigest)
    return failure(
      'STUDIO_AGENT_DIGEST',
      'The proposed result did not match validation. No edit was applied.',
    );
  const applied = bridge.apply(prepared.draft);
  if (!applied.ok)
    return failure(
      'STUDIO_AGENT_VALIDATION',
      'The editor refused this edit: ' + applied.issues.map((issue) => issue.code).join(', '),
    );
  const snapshot = bridge.getSnapshot();
  return { ok: true, revision: snapshot.revision, digest: snapshot.contentDigest };
}

export { agentContext, agentReadSchema, agentReadPresentation, agentCoverage } from './agent-reads.js';
