/**
 * Independent plan-level falsification of the N1 repair (candidate 83ba87f).
 * Imports the BUILT package the browser actually loads (packages/ui/dist).
 * Attacks beyond the builder's own pinned test.
 */
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
} from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u2/packages/ui/dist/index.js';

function baseDoc() {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.falsify',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': { kind: 'element', id: 'n.root', tag: 'main', children: ['n.a', 'n.b'] },
      'def.card': { kind: 'element', id: 'def.card', tag: 'article', children: [] },
      'n.a': { kind: 'component', id: 'n.a', definitionId: 'def.card' },
      'n.b': { kind: 'component', id: 'n.b', definitionId: 'def.card' },
    },
    componentDefinitions: {
      'def.card': { id: 'def.card', revision: '1', root: 'def.card', props: [], slots: {} },
    },
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}
const decl = (p, v) => ({ property: p, value: { type: 'text', value: v } });

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// A1: def-body localStyle pink (shared), instance blue override -> instance blue wins, sibling stays pink
{
  const d = baseDoc();
  d.nodes['def.card'].localStyle = [decl('background-color', 'pink')];
  d.nodes['n.a'].localStyle = [decl('background-color', 'blue')];
  const r = compileUiDocument(d, defaultSemanticElementCatalog());
  check('A1 compiles', r.ok);
  if (r.ok) {
    const rules = r.plan.style.rules;
    const inLayer = (layer, sel, val) =>
      rules.some(
        (x) =>
          x.layer === layer &&
          x.selector.includes(sel) &&
          JSON.stringify(x.declarations).includes(val),
      );
    check(
      'A1 shared pink is componentBase (NOT local)',
      inLayer('componentBase', 'def_card', '"pink"') && !inLayer('local', 'def_card', '"pink"'),
    );
    check('A1 instance blue is local', inLayer('local', 'n_a', '"blue"'));
    const layers = r.plan.style.layers;
    check(
      'A1 frozen layer order local>componentBase',
      layers.indexOf('local') > layers.indexOf('componentBase'),
    );
  }
}
// A2: instance localStyle must beat instance source-layer override on the same node
{
  const d = baseDoc();
  d.styleSources['src.x'] = { id: 'src.x', declarations: [decl('border-left', '4px solid red')] };
  d.nodes['n.a'].styleSources = ['src.x'];
  d.nodes['n.a'].localStyle = [decl('background-color', 'blue')];
  const r = compileUiDocument(d, defaultSemanticElementCatalog());
  check('A2 compiles', r.ok);
  if (r.ok) {
    const layers = r.plan.style.layers;
    check('A2 local after source', layers.indexOf('local') > layers.indexOf('source'));
    check(
      'A2 source rule is layer source',
      r.plan.style.rules.some((x) => x.layer === 'source' && x.selector.includes('n_a')),
    );
  }
}
// A3: SHARED localStyle (componentBase) vs instance source-layer override -> source wins
{
  const d = baseDoc();
  d.nodes['def.card'].localStyle = [decl('background-color', 'blue')];
  d.styleSources['src.acc'] = {
    id: 'src.acc',
    declarations: [decl('background-color', 'tinted'), decl('border-left', '4px solid teal')],
  };
  d.nodes['n.a'].styleSources = ['src.acc'];
  const r = compileUiDocument(d, defaultSemanticElementCatalog());
  check('A3 compiles', r.ok);
  if (r.ok) {
    const rules = r.plan.style.rules;
    const sharedBlueBase = rules.some(
      (x) => x.layer === 'componentBase' && JSON.stringify(x.declarations).includes('"blue"'),
    );
    const tintSource = rules.some(
      (x) => x.layer === 'source' && JSON.stringify(x.declarations).includes('tinted'),
    );
    check('A3 shared body localStyle -> componentBase', sharedBlueBase);
    check('A3 instance src.accent-override -> source layer', tintSource);
    check(
      'A3 layers: source after componentBase',
      r.plan.style.layers.indexOf('source') > r.plan.style.layers.indexOf('componentBase'),
    );
  }
}
// A4: definition-body styleSource also maps to componentBase; instance source stays source
{
  const d = baseDoc();
  d.styleSources['src.def'] = { id: 'src.def', declarations: [decl('padding', '12px')] };
  d.styleSources['src.inst'] = { id: 'src.inst', declarations: [decl('padding', '40px')] };
  d.nodes['def.card'].styleSources = ['src.def'];
  d.nodes['n.a'].styleSources = ['src.inst'];
  const r = compileUiDocument(d, defaultSemanticElementCatalog());
  check('A4 compiles', r.ok);
  if (r.ok) {
    const rules = r.plan.style.rules;
    check(
      'A4 def-body styleSource -> componentBase',
      rules.some(
        (x) => x.layer === 'componentBase' && JSON.stringify(x.declarations).includes('12px'),
      ),
    );
    check(
      'A4 instance styleSource -> source (not componentBase)',
      rules.some((x) => x.layer === 'source' && JSON.stringify(x.declarations).includes('40px')) &&
        !rules.some(
          (x) => x.layer === 'componentBase' && JSON.stringify(x.declarations).includes('40px'),
        ),
    );
  }
}
// A5: REVERSE authoring order (shared edit AFTER instance exists is the N1 repro; also shared FIRST)
{
  for (const order of ['instance-first', 'shared-first']) {
    const d = baseDoc();
    d.nodes['def.card'].localStyle = [decl('background-color', 'blue')];
    d.nodes['n.a'].localStyle = [decl('background-color', 'pink')];
    if (order === 'shared-first') {
      d.nodes['n.root'].children = ['n.b', 'n.a'];
    }
    const r = compileUiDocument(d, defaultSemanticElementCatalog());
    check(`A5 ${order} compiles`, r.ok);
    if (r.ok) {
      const localSel = r.plan.style.rules.filter((x) => x.layer === 'local').map((x) => x.selector);
      check(
        `A5 ${order}: exactly one local rule (instance pink only)`,
        localSel.length === 1 && localSel[0].includes('n_a'),
      );
    }
  }
}
// A6: localStyle on a node INSIDE a definition body (nested) -> componentBase (spec: shared presentation)
{
  const d = baseDoc();
  d.nodes['def.card'].children = ['def.inner'];
  d.nodes['def.inner'] = { kind: 'element', id: 'def.inner', tag: 'div', children: [] };
  d.nodes['def.inner'].localStyle = [decl('color', 'green')];
  d.componentDefinitions['def.card'].root = 'def.card';
  const r = compileUiDocument(d, defaultSemanticElementCatalog());
  check('A6 compiles', r.ok);
  if (r.ok) {
    const rules = r.plan.style.rules;
    check(
      'A6 nested definition-body localStyle -> componentBase',
      rules.some(
        (x) => x.layer === 'componentBase' && JSON.stringify(x.declarations).includes('green'),
      ) &&
        !rules.some((x) => x.layer === 'local' && JSON.stringify(x.declarations).includes('green')),
    );
  }
}
console.log(failures === 0 ? 'ALL PLAN-LEVEL CHECKS PASSED' : `${failures} PLAN-LEVEL FAILURES`);
process.exit(failures === 0 ? 0 : 1);
