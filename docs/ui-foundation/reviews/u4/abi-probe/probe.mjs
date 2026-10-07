/**
 * U4 amendment compatibility probe — resolver-level, disposable (evidence
 * copy; production files unmodified). Evidence for amendment §3.2/§4.3.
 *
 * Exercises the EXACT legacy bytes of
 * packages/ui-svelte/src/document/extensions.ts extracted from commit
 * 952d92da5131d6ab595b45b3bf18bc7ce3b3466d (combined verified
 * implementation) — see extensions.legacy.ts in this directory.
 *
 * RUN (from this directory):
 *   npx esbuild extensions.legacy.ts --bundle --format=esm \
 *     --outfile=extensions.legacy.mjs \
 *     --external:svelte --external:@victframework/ui
 *   node probe.mjs
 *
 * Self-contained: the C1 counterexample descriptor is the PRE-REPAIR
 * checkbox-valid.json descriptor embedded verbatim below (as first frozen
 * at payload 68e166f3eeb27657ff5b28e21c255960256ccdc6 — abi + outputs, NO
 * events/slots). The repaired fixture now carries the events marker, so
 * the original counterexample input is preserved here, not read from the
 * fixture. Recorded outcomes: probe-output.txt (5/5).
 */
import { resolveSvelteExtension } from './extensions.legacy.mjs';

const MARKER = 'vict.ui-component-abi@1';

/** Pre-repair descriptor, verbatim from the first-frozen fixture. */
const ORIGINAL_DESCRIPTOR = {
  id: 'vict.catalog.checkbox',
  revision: '1',
  abi: MARKER,
  props: [
    { name: 'label', type: 'string', default: '' },
    { name: 'checked', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'checkedChange',
      payload: 'boolean',
      description: 'Fires when the user toggles the checkbox.',
    },
  ],
  rendererImplementationId: 'vict.svelte.catalog',
  inspectionLimits: ['internal focus ring styling'],
};

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

const outcomes = [];
const run = (id, name, descriptors, implementations) => {
  const d = descriptors.find((x) => x.id === 'vict.catalog.checkbox') ?? descriptors[0];
  const res = resolveSvelteExtension(instruction(d.id, d.revision), descriptors, implementations);
  outcomes.push({ id, name, got: res.ok ? 'ok:true ACCEPTED' : `ok:false ${res.diagnostic.code}` });
};

// C1: ORIGINAL ACCEPTED COUNTEREXAMPLE — abi+outputs, NO events/slots.
run('C1', 'original counterexample (abi+outputs, no events/slots)', [ORIGINAL_DESCRIPTOR], [
  legacyImpl(ORIGINAL_DESCRIPTOR.id, ORIGINAL_DESCRIPTOR.revision, ORIGINAL_DESCRIPTOR.rendererImplementationId),
]);

// C2: REPAIRED GATE — same descriptor + events ABI marker.
run('C2', 'same descriptor + events marker', [{ ...ORIGINAL_DESCRIPTOR, events: [MARKER] }], [
  legacyImpl(ORIGINAL_DESCRIPTOR.id, ORIGINAL_DESCRIPTOR.revision, ORIGINAL_DESCRIPTOR.rendererImplementationId),
]);

// C3: legacy props-only descriptor — unchanged legacy path.
run('C3', 'legacy props-only descriptor', [
  { id: 'legacy.widget', revision: '1', props: [{ name: 'label', type: 'string' }], rendererImplementationId: 'vict-svelte' },
], [legacyImpl('legacy.widget', '1', 'vict-svelte')]);

// C4 (control): legacy untyped-event descriptor — already rejected.
run('C4', 'legacy untyped-event descriptor', [
  { id: 'legacy.events', revision: '1', props: [], events: ['change'], rendererImplementationId: 'vict-svelte' },
], [legacyImpl('legacy.events', '1', 'vict-svelte')]);

// C5 (control): no implementation registered.
run('C5', 'no implementation registered', [ORIGINAL_DESCRIPTOR], []);

const expected = {
  C1: 'ok:true ACCEPTED',
  C2: 'ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
  C3: 'ok:true ACCEPTED',
  C4: 'ok:false UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED',
  C5: 'ok:false UI_RENDER_EXTENSION_UNAVAILABLE',
};
let pass = 0;
for (const o of outcomes) {
  const ok = o.got === expected[o.id];
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${o.id} ${o.name}`);
  console.log(`      expected: ${expected[o.id]}`);
  console.log(`      got:      ${o.got}`);
}
console.log(`\nPROBE RESULT: ${pass}/${outcomes.length} expectations met`);
console.log(
  'Legacy resolver bytes: git show 952d92da5131d6ab595b45b3bf18bc7ce3b3466d:packages/ui-svelte/src/document/extensions.ts (unmodified)',
);
