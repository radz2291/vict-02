# Scoped graph source ownership repair — builder evidence

Baseline: 4c40cc656328c50d16d28492ae5245bf509ccb6e. See GRAPH-BASELINE-RED.md for the retained three failing baseline observations.

## Implemented ownership

- Resolve graph bindings in lexical source scope through elements, portals, repeats, conditional branches, ordinary/scoped fills and custom definitions. A scoped fill replaces the state namespace. Identical state names never authorize a document-level fallback. Ambiguous reused source fails closed.
- Only explicit bidirectional, document-owned graph bindings enter the document runtime mirror. A read-only consumer still constrains the grammar of values written to the same actual owner.
- Literal graph agent edits change the literal source. Private scoped graph agent edits change that slot declaration's authored initial; runtime edits remain occurrence-local and use local graph history.
- Controlled scoped graph agent edits require an explicit outer-to-inner occurrenceRoute. Every containing workspace revision and selected graph-node ID is checked. The selected node gets a validated parameter override; family defaults and sibling instances are retained. Two nested levels are exercised. Missing/stale/mismatched routes refuse atomically.
- Graph host capability and model semantics come from public graphAuthoringContract registrations. Ordinary controls inside graph bodies require no graph-specific adapter.

Controlled occurrence routes currently support the public graph2 node-parameter body contract. A graph1/legacy controlled body is explicitly refused by this new nested route rather than reinterpreted. Existing direct graph1 and graph2 edits retain their exact grammar. Saved document and graph schemas are unchanged; the agent operation's optional occurrenceRoute is a versioned authoring contract extension maintained by the integrator.

## Executed checks

From apps/studio:

`node node_modules/vitest/vitest.mjs run tests/graph-scoped-ownership.test.ts tests/flow-typed-authoring.test.ts tests/flow-workspace-authoring.test.ts`

Initial ownership/compatibility pass: 13/13 (7 new ownership, 2 existing typed, 4 existing workspace). Two further targeted ownership tests were then added.

`node node_modules/vitest/vitest.mjs run tests/graph-scoped-bridge.test.ts tests/graph-scoped-ownership.test.ts tests/graph-runtime-refusal.test.ts`

Final affected run: 12/12 (9 ownership, 2 mounted bridge, 1 existing refusal), exit 0. This overlaps the earlier run and is not an additive total. Studio TypeScript: `node node_modules/typescript/bin/tsc --noEmit -p apps/studio/tsconfig.json`, exit 0 after the test import/type corrections described below.

The mounted Studio bridge uses real EditorBridge, graphRuntimeChanged, graphHistoryFor, screenStore, public agent prepare/apply validation and the portable source importer. It proves an ordinary nested Evidence URL input, explicit agent nested label edit, keyboard movement, nested undo plus shared undo/redo, save, actual bridge reopen with rendered field retention, and import roundtrip. Outer position remains unchanged. The private repeated case proves one occurrence moves while its sibling stays fixed, local undo works with empty canonical history, save does not promote runtime interaction to defaults, and an explicit agent template-initial edit remounts both scoped occurrences and participates in canonical Undo. Existing RenderNode keyed scope behavior supplies that remount; no shared renderer patch was necessary.

## Failed observations retained

- The first mounted private case passed behavior but its final equality expected source revision 1 after save; the established store correctly returned r1.r1. The assertion now checks all content while allowing the explicit saved revision change.
- Importing the package's TypeScript diagnostic fixture also pulled existing mutable-fixture assignments against readonly public types into Studio's stricter TypeScript project. Replaced that cross-project import with an explicit serialized JSON copy of the existing fixture. That JSON is a diagnostic test artifact, never owner data or actual-agent evidence.
- A mount export type annotation and an untyped test callback were corrected. Final TypeScript passes. Earlier environmental runner/dist and three behavior baseline failures remain in GRAPH-BASELINE-RED.md.
- Tests print inherited renderer accessibility/state-capture warnings. This repair makes no blanket accessibility pass claim.

## Evidence limits

These are source and mounted diagnostic-fixture demonstrations of the Studio bridge. They do not prove actual Studio-agent product authoring, browser usability, physical devices, current serving-build behavior or owner acceptance. The independent exact-candidate verifier must challenge the integrated result. Existing owner applications, browser storage and drafts were never opened or modified by these tests; happy-dom storage is disposable.
