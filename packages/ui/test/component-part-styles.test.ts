import {describe,it,expect} from 'vitest';
import {applyUiEdit,canonicalUiDocument,compileUiDocument,defaultSemanticElementCatalog,validateUiDocument,type UiDocument,type UiExtensionDescriptor} from '../src/index.js';

const descriptor:UiExtensionDescriptor={id:'test.parts',revision:'1',props:[],slots:[],outputs:[],abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],styleTargets:['trigger','content'],rendererImplementationId:'test.parts'};
const source=():UiDocument=>({schema:'vict.ui-document@1',id:'parts',revision:'1',root:'card',nodes:{card:{kind:'component',id:'card',definitionId:descriptor.id,revision:'1'}},componentDefinitions:{},tokens:{},styleSources:{},conditions:{},assets:{},localState:{}});
const catalogs={elements:defaultSemanticElementCatalog(),extensions:[descriptor]};
describe('explicit semantic component part presentation',()=>{
  it('changes only the selected part, participates in canonical identity and preserves the original snapshot',()=>{
    const before=source();
    const edited=applyUiEdit({document:before,revision:'1'},{requestId:'part',expectedDocumentRevision:'1',commands:[{op:'setPartStyleDeclaration',nodeId:'card',part:'content',property:'background',value:{type:'text',value:'#182030'}}]},catalogs);
    expect(edited.ok).toBe(true);if(!edited.ok)return;
    expect(before.nodes.card?.partStyles).toBeUndefined();
    expect(canonicalUiDocument(edited.document).contentDigest).not.toBe(canonicalUiDocument(before).contentDigest);
    const compiled=compileUiDocument(edited.document,catalogs.elements,[descriptor]);
    expect(compiled.ok).toBe(true);if(!compiled.ok)return;
    const node=compiled.plan.structure[0];if(node?.kind!=='extension')throw Error('expected registered component');
    expect(node.partClasses?.content).toMatch(/part-/);
    expect(node.partClasses?.trigger).toBeUndefined();
    expect(compiled.plan.style.rules.find(rule=>rule.selector===`.${node.partClasses?.content}`)?.declarations).toEqual([{property:'background',value:{type:'literal',value:'#182030'}}]);
  });
  it('refuses unknown parts atomically and retains old primary-only source behavior',()=>{
    const before=source();
    const result=applyUiEdit({document:before,revision:'1'},{requestId:'bad',expectedDocumentRevision:'1',commands:[{op:'setStyleDeclaration',nodeId:'card',property:'color',value:{type:'text',value:'red'}},{op:'setPartStyleDeclaration',nodeId:'card',part:'invented',property:'color',value:{type:'text',value:'blue'}}]},catalogs);
    expect(result.ok).toBe(false);expect(before.nodes.card?.localStyle).toBeUndefined();
    const old=compileUiDocument(before,catalogs.elements,[descriptor]);expect(old.ok).toBe(true);if(old.ok&&old.plan.structure[0]?.kind==='extension')expect(old.plan.structure[0].partClasses).toBeUndefined();
  });
  it('supports reusable part rules and pseudo/condition styles without altering base presentation',()=>{
    const before={...source(),conditions:{phone:{id:'phone',kind:'media' as const,query:'(max-width: 600px)'}}};
    const result=applyUiEdit({document:before,revision:'1'},{requestId:'focus',expectedDocumentRevision:'1',commands:[{op:'setPartStyleDeclaration',nodeId:'card',part:'content',property:'color',value:{type:'text',value:'white'},pseudo:'focus',conditionId:'phone'}]},catalogs);
    expect(result.ok).toBe(true);if(!result.ok)return;
    const compiled=compileUiDocument(result.document,catalogs.elements,[descriptor]);expect(compiled.ok).toBe(true);if(compiled.ok)expect(compiled.plan.style.rules).toEqual(expect.arrayContaining([expect.objectContaining({pseudo:'focus',mediaConditionId:'phone'})]));
    expect(result.document.nodes.card?.localStyle).toBeUndefined();
  });
  it('validates direct serialized part data and missing references rather than silently ignoring it',()=>{
    const invalid={...source(),nodes:{card:{...source().nodes.card!,partStyles:{content:{styleSources:['missing']}}}}};
    expect(validateUiDocument(invalid,catalogs).some(issue=>issue.code==='UI_DOC_REFERENCE_DANGLING')).toBe(true);
    const unknown={...source(),nodes:{card:{...source().nodes.card!,partStyles:{invented:{localStyle:[{property:'color',value:{type:'text' as const,value:'red'}}]}}}}};
    const compiled=compileUiDocument(unknown,catalogs.elements,[descriptor]);expect(compiled.ok).toBe(false);
  });
});
describe('versioned application theme',()=>{
  it('emits explicit semantic markers only for authored roles',()=>{
    const plain=compileUiDocument(source(),catalogs.elements,[descriptor]);expect(plain.ok).toBe(true);if(!plain.ok)return;
    expect(plain.plan.style.rules.flatMap(rule=>rule.declarations).some(declaration=>declaration.property.startsWith('--vict-theme-'))).toBe(false);
    const themed=compileUiDocument({...source(),theme:{schema:'vict.ui-theme@1',roles:{text:'#123456',accent:'#234567',accentText:'#fafafa'}}},catalogs.elements,[descriptor]);expect(themed.ok).toBe(true);if(!themed.ok)return;
    const declarations=themed.plan.style.rules.find(rule=>rule.selector===':root')?.declarations;
    expect(declarations).toEqual(expect.arrayContaining([
      {property:'--vict-theme-text',value:{type:'literal',value:'#123456'}},
      {property:'--vict-theme-accent',value:{type:'literal',value:'#234567'}},
      {property:'--vict-theme-accent-text',value:{type:'literal',value:'#fafafa'}},
    ]));
    expect(declarations?.some(declaration=>declaration.property==='--vict-theme-surface')).toBe(false);
  });
  it('compiles coherent semantic aliases on scoped roots and changes canonical identity',()=>{
    const before=source();
    const result=applyUiEdit({document:before,revision:'1'},{requestId:'theme',expectedDocumentRevision:'1',commands:[{op:'setThemeRole',role:'surface',value:'#182030'},{op:'setThemeRole',role:'text',value:'#fafafa'}]},catalogs);
    expect(result.ok).toBe(true);if(!result.ok)return;
    const compiled=compileUiDocument(result.document,catalogs.elements,[descriptor]);expect(compiled.ok).toBe(true);if(!compiled.ok)return;
    const roles=compiled.plan.style.rules.find(rule=>rule.selector===':root')?.declarations;
    expect(roles).toEqual(expect.arrayContaining([{property:'--vict-theme-surface',value:{type:'literal',value:'#182030'}},{property:'--vict-color-surface',value:{type:'literal',value:'#182030'}},{property:'--background',value:{type:'literal',value:'#182030'}},{property:'--foreground',value:{type:'literal',value:'#fafafa'}}]));
    expect(canonicalUiDocument(result.document).contentDigest).not.toBe(canonicalUiDocument(before).contentDigest);
  });
  it('refuses unknown roles, executable markup and malformed schema',()=>{
    for(const theme of [{schema:'wrong',roles:{}},{schema:'vict.ui-theme@1',roles:{madeUp:'red'}},{schema:'vict.ui-theme@1',roles:{surface:'red;} body{color:black'}}]){
      expect(validateUiDocument({...source(),theme},catalogs).some(issue=>issue.code==='UI_DOC_INVALID_LITERAL')).toBe(true);
    }
  });
});
