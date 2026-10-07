// U4 amendment compatibility probe — resolver-level, disposable.
// Exercises the EXACT legacy bytes of packages/ui-svelte/src/document/extensions.ts
// extracted from commit 952d92da5131d6ab595b45b3bf18bc7ce3b3466d (combined
// verified implementation). No production file is modified.
import { resolveSvelteExtension } from './extensions.legacy.mjs';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync('./checkbox-valid.json', 'utf8'));
const descriptorFromFixture = fixture.descriptor;

const legacyImpl = (id, revision, rid) => ({
  extensionId: id,
  revision,
  rendererImplementationId: rid,
  component: function Dummy() {},
});

const instruction = (id, revision) => ({
  kind: 'extension',
  nodeId: 'n1',
  occurrenceKey: 'n1',
  extensionId: id,
  revision,
  propDecls: [],
  propValues: {},
});

const results = [];
const record = (name, expected, resolution) => {
  results.push({ name, expected, got: resolution });
};

// ---- Case 1: ORIGINAL COUNTEREXAMPLE (frozen fixture descriptor, as-is) ----
// Descriptor carries abi + outputs, NO events/slots -> legacy resolver must
// ACCEPT it (proving abi/outputs are invisible to the legacy gate).
{
  const d = descriptorFromFixture;
  const res = resolveSvelteExtension(
    instruction(d.id, d.revision),
    [d],
    [legacyImpl(d.id, d.revision, d.rendererImplementationId)],
  );
  record(
    'C1 original fixture descriptor (abi+outputs, no events/slots)',
    'ok:true  (ACCEPTED — the defect this repair closes)',
    res.ok ? 'ok:true  ACCEPTED' : `ok:false ${res.diagnostic.code}`,
  );
}

// ---- Case 2: REPAIRED REQUIREMENT — same descriptor + ABI marker in events --
{
  const d = { ...descriptorFromFixture, events: ['vict.ui-component-abi@1'] };
  const res = resolveSvelteExtension(
    instruction(d.id, d.revision),
    [d],
    [legacyImpl(d.id, d.revision, d.rendererImplementationId)],
  );
  record(
    'C2 same descriptor + events:["vict.ui-component-abi@1"]',
    'ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED (legacy rejection gate)',
    res.ok ? 'ok:true  ACCEPTED' : `ok:false ${res.diagnostic.code}`,
  );
}

// ---- Case 3: legacy props-only descriptor — unchanged legacy path -----------
{
  const d = {
    id: 'legacy.widget',
    revision: '1',
    props: [{ name: 'label', type: 'string' }],
    rendererImplementationId: 'vict-svelte',
  };
  const res = resolveSvelteExtension(
    instruction(d.id, d.revision),
    [d],
    [legacyImpl(d.id, d.revision, d.rendererImplementationId)],
  );
  record(
    'C3 legacy props-only descriptor (no events/slots/abi/outputs)',
    'ok:true  (unchanged legacy behavior preserved)',
    res.ok ? 'ok:true  ACCEPTED' : `ok:false ${res.diagnostic.code}`,
  );
}

// ---- Case 4 (control): legacy untyped-event descriptor — already rejected ---
{
  const d = {
    id: 'legacy.events',
    revision: '1',
    props: [],
    events: ['change'],
    rendererImplementationId: 'vict-svelte',
  };
  const res = resolveSvelteExtension(
    instruction(d.id, d.revision),
    [d],
    [legacyImpl(d.id, d.revision, d.rendererImplementationId)],
  );
  record(
    'C4 legacy descriptor declaring untyped event "change"',
    'ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED (existing fail-closed)',
    res.ok ? 'ok:true  ACCEPTED' : `ok:false ${res.diagnostic.code}`,
  );
}

// ---- Case 5 (control): missing implementation --------------------------------
{
  const d = descriptorFromFixture;
  const res = resolveSvelteExtension(instruction(d.id, d.revision), [d], []);
  record(
    'C5 fixture descriptor, no implementation registered',
    'ok:false UI_RENDER_EXTENSION_UNAVAILABLE',
    res.ok ? 'ok:true  ACCEPTED' : `ok:false ${res.diagnostic.code}`,
  );
}

const expectedOutcome = {
  C1: 'ok:true  ACCEPTED',
  C2: 'ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
  C3: 'ok:true  ACCEPTED',
  C4: 'ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
  C5: 'ok:false UI_RENDER_EXTENSION_UNAVAILABLE',
};
let pass = 0;
for (const r of results) {
  const strict = r.got.trim() === expectedOutcome[r.name.slice(0, 2)];
  if (strict) pass++;
  console.log(`${strict ? 'PASS' : 'FAIL'}  ${r.name}`);
  console.log(`      expected: ${r.expected}`);
  console.log(`      got:      ${r.got}`);
}
console.log(`\nPROBE RESULT: ${pass}/${results.length} expectations met`);
console.log(
  'Legacy resolver bytes: git show 952d92da5131d6ab595b45b3bf18bc7ce3b3466d:packages/ui-svelte/src/document/extensions.ts (unmodified)',
);
