/**
 * F2 validator probe — U4 catalog recalibration repair.
 *
 * Reproduces local-state validation of the widened value vocabulary
 * ('stringList' | 'numberList' | 'isoDate' | 'isoTime') against the ACTUAL
 * legacy validator. The pinned legacy implementation (commit 952d92d) and
 * the tested candidate base (b05d016) are byte-identical for
 * packages/ui/src/** (verified: `git diff --stat 952d92d b05d016 --
 * packages/ui/src/` is empty), so importing the worktree source imports
 * the pinned legacy validator bytes.
 *
 * Run: npx tsx u4-f2-validator-probe.mjs  (from this directory)
 */
import { validateUiDocument } from '../vict-02-u4-catalog-repair/packages/ui/src/validate.ts';
import { defaultSemanticElementCatalog } from '../vict-02-u4-catalog-repair/packages/ui/src/semantic.ts';
import { UI_DOCUMENT_SCHEMA } from '../vict-02-u4-catalog-repair/packages/ui/src/document.ts';

const CATALOGS = { elements: defaultSemanticElementCatalog(), actionIds: ['demo.save'] };

function docWith(localState) {
  return {
    schema: UI_DOCUMENT_SCHEMA,
    id: 'doc.f2probe',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': { kind: 'element', id: 'n.root', tag: 'section', children: ['n.h'] },
      'n.h': { kind: 'element', id: 'n.h', tag: 'h1', children: [] },
    },
    localState,
  };
}

const cases = [
  { name: 'C0 control: string/string', type: 'string', initial: 'x' },
  { name: 'C1 stringList', type: 'stringList', initial: [] },
  { name: 'C2 numberList', type: 'numberList', initial: [] },
  { name: 'C3 isoDate', type: 'isoDate', initial: '2026-01-31' },
  { name: 'C4 isoTime', type: 'isoTime', initial: '09:30' },
];

let failures = 0;
for (const c of cases) {
  const key = Object.keys(docWith({ k: { type: c.type, initial: c.initial } }).localState)[0];
  const diags = validateUiDocument(docWith({ k: { type: c.type, initial: c.initial } }), CATALOGS);
  const mismatch = diags.filter((d) => d.code === 'UI_EXPR_TYPE_MISMATCH');
  const verdict = mismatch.length > 0 ? 'REJECTED' : 'ACCEPTED';
  if (c.name.startsWith('C0') && mismatch.length > 0) failures++;
  if (!c.name.startsWith('C0') && mismatch.length === 0) failures++;
  console.log(`${c.name}: ${verdict}`);
  for (const d of mismatch) {
    console.log(`  code=${d.code} message=${JSON.stringify(d.message)}`);
    console.log(`  diagnostic=${JSON.stringify(d)}`);
  }
}
console.log(failures === 0 ? 'PROBE OK: control accepted; all four widened types rejected by the legacy validator (UI_EXPR_TYPE_MISMATCH)' : `PROBE UNEXPECTED: ${failures} deviation(s)`);
console.log('Evidence limits: validator-level only (no renderer/browser run); render-side host check is DocumentHost.svelte:95 typeof comparison (cited, not executed here).');
