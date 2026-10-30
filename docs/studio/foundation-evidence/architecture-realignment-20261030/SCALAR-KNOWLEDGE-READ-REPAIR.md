# Scalar public knowledge read — builder record

Source predecessor: a61396cb3bf20e3f10d62a89a716feafdd91d6e3.
This addresses the new actual rich-node discovery failure; it does not replace
the retained failed run or award actual-agent composition success.

## Demonstrated gap and scope

The actual minimal source read/edit succeeded. The richer one-node request was
stopped after repeated read refusals: 18 calls, 10 refused, zero applied edits,
179.9 seconds of partial browser measurements. Safe diagnostics identify complex
components/includeExamples and offset/expectedBodyIdentities fields. Failed raw
arguments remain unavailable before validated invocation. The model's claim that
the transport stringifies inputs is not established by this evidence.

Source inspection confirms a separate usability dead end: retained `component`
reads accept only a recipe string, and resolve the historical unpinned component
default. A bare workspace identity returns revision 1; an `id@2` string is not a
recipe identity. Complete exact component semantics previously required the
batched `contracts.components` array and object-based paging identities.

## Implemented public path

First read:

```json
{"section":"knowledge","kind":"component","key":"vict.flow.workspace@2","projection":"guidance"}
```

Data grammar:

```json
{"section":"knowledge","kind":"data","key":"vict.flow-graph@2","projection":"examples"}
```

Continuation is only `{"section":"knowledge","cursor":"<returned nextCursor>"}`.
The placeholder above documents the API; it is not a fabricated live token.
`nextCursor:null` ends paging. The versioned bounded token binds kind, exact key,
projection, body identity and validated integer range. It is a read cursor, not a
credential, signature or execution authority. Cross-key/kind/projection,
malformed/stale tokens refuse. No legacy numeric/string/object input is coerced.
Explicit offset or limit is refused on this scalar path, even if equal to an old
default. Legacy read defaults, per-field Zod errors and strict batch shapes remain.

Exact bodies derive from the installed public registry and exported
`authoringContractBody`/`authoringDataContracts`. Component projections share one
helper with the legacy batch path and are byte-identical. Data grammar bodies
remain distinct from component contracts and do not enter the component knowledge
cache. Component pages retain the existing items/contractJson/bodyIdentity/range
shape; existing complete-range tracking can retain them. Dependencies are explicit
exact references, not silently preloaded or declared complete. No app source,
prepared application, Flow-specific path or new execution authority was added.

The read presentation now exposes immediate root field definitions as well as
the same `$defs` and closed section branches. This is a lossless passive
model-facing readability improvement, not a claim that an adapter defect was
proven. The serialized compatible-adapter test proves definitions are unchanged
on the wire; the existing presentation capture/byte guards remain satisfied.

The scalar schema does not inject offset/limit defaults into parsed scalar
queries, preserving parse idempotency through contract parsing, invocation and
agentContext. Local defaulting is applied only after admission for internal
legacy section calculations. No schema union collapses detailed legacy invalid
field paths into a generic invalid_union error.

## Checks and limits

- Initial affected run: 32/32 (new scalar 6, retained legacy contract 10,
  authoring-discovery 16), exit 0.
- Final passive-schema/adapter run: 17/17 (new scalar 6, retained contract 10,
  compatible-adapter 1), exit 0. The runs overlap; do not sum them.
- Studio TypeScript: exit 0 after correcting only the new test's Ajv options
  annotation using the existing project's typing pattern. Initial failure remains
  in scalar-knowledge-typecheck-initial-red.log.
- Changed scalar helper/read/classification/tests ESLint: exit 0.
- `git diff --check`: clean.

Tests cover exact revision 2 and unchanged unpinned revision 1 behavior; strict
legacy types; irrelevant scalar fields; parse idempotency; exact guidance/examples
and data reconstruction; complete-only component knowledge; no data-cache alias;
cross-key/kind/projection/stale/malformed cursor refusals; passive schema bounds;
and actual compatible-request serialization using mock fetch only.

Parent integration owns read capability/input revision 7, model instructions and
profile revisions, server knowledge retention and feedback. No provider, browser,
serving process, owner app/draft or account configuration was touched by this
builder. Independent exact-candidate review, build/activation and new actual-agent
proof remain required. The new path's usability is not established by these tests.
