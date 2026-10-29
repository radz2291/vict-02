import {describe,it,expect} from 'vitest';
import Ajv from 'ajv';
import {canonicalUiDocument,type UiDocument} from '@victframework/ui';
import {newScreen} from '../src/lib/designer/application.js';
import {agentEditSchema,documentCursor,prepareAgentEdit,type AgentEdit} from '../src/lib/designer/agent-edits.js';
import {editPresentation} from '../src/lib/designer/agent-edit-presentation.js';
import {effectiveNodeCapabilities} from '../src/lib/designer/agent-discovery.js';
const ajvOptions:NonNullable<ConstructorParameters<typeof Ajv>[0]>&{strict:boolean}={strict:false};
const presented=new Ajv(ajvOptions).compile(editPresentation);
function request(source:UiDocument,operations:AgentEdit['operations']){const cursor=documentCursor(source,source.revision,'classes-epoch');return prepareAgentEdit(source,cursor,{expectedRevision:cursor.revision,reason:'Canonical classes through ordinary authoring',operations},crypto.randomUUID());}
describe('generic Studio class authoring',()=>{
 it('authors classes through insert/add/modify, preserves on omission and explicitly clears with []',()=>{
  const source=newScreen('Classes','agent-classes');
  const first=request(source,[{op:'insert',kind:'element',nodeId:'header',parentId:'screen',tag:'header',classes:['vict-graph-drag-handle','brand:active','作品']},{op:'add',recipe:'section',nodeId:'section',parentId:'screen',classes:['project-section']},{op:'insert',kind:'component',nodeId:'button',parentId:'section',componentId:'vict.catalog.button',revision:'1',classes:['project-button']}]);
  expect(first.ok,JSON.stringify(first)).toBe(true);if(!first.ok)return;
  expect(first.document.nodes.header.classes).toEqual(['vict-graph-drag-handle','brand:active','作品']);expect(first.document.nodes.section.classes).toEqual(['project-section']);expect(first.document.nodes.button.classes).toEqual(['project-button']);
  const omitted=request(first.document,[{op:'modify',nodeId:'header',attributes:{'aria-label':'Project heading'}}]);expect(omitted.ok).toBe(true);if(!omitted.ok)return;expect(omitted.document.nodes.header.classes).toEqual(first.document.nodes.header.classes);
  const clear=request(omitted.document,[{op:'modify',nodeId:'header',classes:[]}]);expect(clear.ok).toBe(true);if(!clear.ok)return;expect(clear.document.nodes.header.classes).toEqual([]);expect(JSON.parse(JSON.stringify(clear.document)).nodes.button.classes).toEqual(['project-button']);
  expect(effectiveNodeCapabilities(first.document.nodes.header)).toMatchObject({presentation:{classes:{supported:true,operation:'modify',field:'classes',emptyClears:true,value:['vict-graph-drag-handle','brand:active','作品']}}});
 });
 it('exposes the same class-list grammar in model presentation and authoritative input',()=>{
  const valid=[[],['😀'.repeat(256)],['ブランド','md:grid-cols-[1fr_2fr]','nodrag','nopan','nowheel']];const invalid=[['two words'],['tab\tword'],['line\nword'],['nul\0word'],[''],Array(101).fill('x'),['x'.repeat(257)],['😀'.repeat(257)],['okay',1]];
  for(const classes of valid){const value={expectedRevision:'r1',reason:'Classes',operations:[{op:'modify',nodeId:'header',classes}]};expect(agentEditSchema.safeParse(value).success).toBe(true);expect(presented(value)).toBe(true);}
  for(const classes of invalid){const value={expectedRevision:'r1',reason:'Classes',operations:[{op:'modify',nodeId:'header',classes}]};expect(agentEditSchema.safeParse(value).success,JSON.stringify(classes)).toBe(false);expect(presented(value),JSON.stringify(classes)).toBe(false);}
 });
 it('refuses malformed classes atomically and does not reinterpret old attributes.class admission',()=>{
  const source=newScreen('Classes','class-refusal'),before=canonicalUiDocument(source).contentDigest;
  const result=request(source,[{op:'theme',role:'accent',value:'#123456'},{op:'insert',kind:'element',nodeId:'invalid',parentId:'screen',tag:'div',classes:['two words']}]);expect(result.ok).toBe(false);expect(canonicalUiDocument(source).contentDigest).toBe(before);
  const old=request(source,[{op:'insert',kind:'element',nodeId:'old',parentId:'screen',tag:'div',attributes:{class:'historical-attribute'}}]);expect(old).toMatchObject({ok:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:expect.arrayContaining([expect.objectContaining({code:'UI_DOC_UNKNOWN_ATTRIBUTE'})])});
  expect(effectiveNodeCapabilities(source.nodes.screen)).toMatchObject({presentation:{classes:{guidance:expect.stringContaining('not attributes.class')}}});
 });
});
