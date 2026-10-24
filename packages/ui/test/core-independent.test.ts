import { describe, it, expect } from 'vitest';
import { createUiAuthoringRegistry, authoringSemanticIssues, type UiAuthoringRegistration, type UiAuthoringPackage, type UiDocument, type UiNode } from '../src/index.js';

const registration = (id: string, extra: Partial<UiAuthoringRegistration> = {}): UiAuthoringRegistration => ({
 descriptor: { id, revision: '1', props: [{ name: 'value', type: 'string', default: '' }], slots: ['tabs','panels'], outputs: [], abi: 'vict.ui-component-abi@1', events: ['vict.ui-component-abi@1'], rendererImplementationId: 'test' },
 label: id, family: 'test', category: 'test', purpose: 'Independent challenge', eligibility: { kind: 'standalone' }, ...extra,
});
const install = (registrations: UiAuthoringRegistration[]) => {
 const pkg: UiAuthoringPackage = { schema: 'vict.ui-authoring@1', packageName: '@test/independent', packageVersion: '1', registrations, exportDispositions: [] };
 return createUiAuthoringRegistry([pkg], registrations.map(r => ({extensionId:r.descriptor.id,revision:r.descriptor.revision,rendererImplementationId:'test',abi:r.descriptor.abi,slots:r.descriptor.slots})));
};
const doc = (nodes: UiNode[]): UiDocument => ({schema:'vict.ui-document@1',id:'independent',revision:'r1',root:'outer',nodes:Object.fromEntries(nodes.map(n=>[n.id,n])),componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:{}});
describe('independent product challenge', () => {
 it('does not count a nested provider part as a required part owned by its outer provider', () => {
  const tabs = registration('tabs', {rules:[{kind:'requiredParts',slot:'tabs',definitionIds:['trigger']},{kind:'requiredParts',slot:'panels',definitionIds:['panel']},{kind:'pairedValues',left:{slot:'tabs',definitionIds:['trigger'],property:'value'},right:{slot:'panels',definitionIds:['panel'],property:'value'}}]});
  const registry = install([tabs,registration('trigger'),registration('panel')]);
  const source = doc([
   {kind:'component',id:'outer',definitionId:'tabs',slots:{tabs:{name:'tabs',children:['inner']},panels:{name:'panels',children:['outer-panel']}}},
   {kind:'component',id:'inner',definitionId:'tabs',slots:{tabs:{name:'tabs',children:['inner-trigger']},panels:{name:'panels',children:['inner-panel']}}},
   {kind:'component',id:'outer-panel',definitionId:'panel',props:{value:{type:'literal',value:'a'}}},
   {kind:'component',id:'inner-trigger',definitionId:'trigger',props:{value:{type:'literal',value:'a'}}},
   {kind:'component',id:'inner-panel',definitionId:'panel',props:{value:{type:'literal',value:'a'}}},
  ]);
  expect(authoringSemanticIssues(source,registry).some(issue=>issue.nodeId==='outer'&&issue.hostCode==='UI_AUTHORING_REQUIRED_PART'&&issue.severity==='error')).toBe(true);
 });
 it('rejects required-part metadata whose provider slot and referenced child contract do not exist', () => {
  const malformed=registration('bad',{rules:[{kind:'requiredParts',slot:'not-declared',definitionIds:['missing-child']}]});
  expect(install([malformed]).ok).toBe(false);
 });
 it('rejects paired metadata whose slots and child identity properties do not exist', () => {
  const malformed=registration('bad',{rules:[{kind:'pairedValues',left:{slot:'not-declared',definitionIds:['child'],property:'missing'},right:{slot:'also-missing',definitionIds:['child'],property:'missing'}}]});
  expect(install([malformed,registration('child')]).ok).toBe(false);
 });
});
