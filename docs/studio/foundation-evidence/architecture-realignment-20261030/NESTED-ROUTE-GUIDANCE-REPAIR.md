# Controlled nested graph route guidance repair candidate

The actual agent's stopped Stage 5 trial demonstrated a discovery gap: it read
the available source and graph guidance, then guessed routes without an exact
documented example. The separate exact-route code check confirmed the existing
strict ownership path works; this candidate changes passive guidance only.

Product changes are limited to:

- `apps/studio/src/lib/designer/agent-edit-presentation.ts`: actual exposed schema
  annotations distinguish target workspace/revision from containing workspace,
  graph-model node and containing revision. A generic valid `defineNodeType`
  operation example uses outer-workspace/project-a/inner-workspace, ordered
  outer-to-inner route and deliberately different target/parent revisions.
- `packages/ui-flow-svelte/src/composition/knowledge.ts`: controlled string
  parameter ownership, exact generic route/transaction example, private runtime
  versus shared initial defaults, graph@1 containing-owner refusal, per-instance
  node type definitions, and fresh ancestor/document revisions after each accepted
  nested edit. No actual application IDs or source JSON are embedded.

`agent-edits.ts` is unchanged: the authoritative Zod parser, strict field sets,
admission, ownership, validation, runtime operations and ABI remain identical.
The manually authored passive schema is not generated from Zod descriptions;
unused Zod annotations were therefore not retained.

No input/capability/ABI revision bump is proposed: only nonvalidating `description`
and `examples` annotations changed, and the existing graph contract revisions and
all accepted shapes are unchanged. Package-owned guidance bodies change their
existing content-derived body identities; consumers must read fresh knowledge.
No new section, preload, source seed, migration, coercion or runtime repair exists.

Validation:

- Four focused test files, 17/17 passed: strict scoped ownership/multilevel routes,
  existing independent/completion schema checks, and the new executable exposed
  example check.
- The new test takes the shipped passive example through authoritative agent Zod,
  Ajv and public graph operation validation/application. It also captures the
  passive schema through the frozen presentation validator and enforces the
  existing 32,768-byte budget. It does not assert duplicated guidance text.
- Studio TypeScript, scoped ESLint and whitespace checks passed.
- Existing shared Svelte warnings remain in logs.

The initial test command was invoked through npm with arguments interpreted by
npm rather than Vitest; no tests were discovered. The corrected direct local
Vitest invocation passed the existing 16 tests. The first additional example test
then correctly caught an oversized 33,204-byte passive schema. Descriptions were
shortened and the structured example uses a minimal valid type definition; the
complete explanation remains in paged package knowledge. Both earlier logs and
the final 17/17 green log are retained.

Evidence files use the `nested-route-guidance-*` prefix in this directory.
No product build/activation, browser, provider, owner source or application state
was changed. Candidate is uncommitted pending parent review. Actual-agent retry
remains required to assess whether the new guidance resolves the observed gap.
