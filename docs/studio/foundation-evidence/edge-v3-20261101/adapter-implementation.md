# Studio graph3 adapter candidate

Isolated branch `codex/studio-edge-v3-adapter-20261101`, starting at
`f328ee17aa01e49f3f2a34ed14f0f5e709cc0211`. Current owner instruction authorizes
the canvas-default/per-connection edge feature, explicit migration of the same
saved application, and this thin Studio integration. Public Flow implementation
is a separate agent-owned candidate. Historical graph1/graph2 grammars and
identities remain package-owned and frozen. Local origin/main is
`d7401bef6e48330796c74ec00c86db9622d48cdf`; no push or activation is authorized.

## Integration boundary

Studio selects the installed public parser and patch dispatcher by exact
`graphAuthoringContract` model version, including controlled containing graph3
occurrences. Public operation schemas provide tool shape admission and knowledge;
Studio adds no graph topology, renderer or appearance engine. The existing
installed authoring registry consumes new package registrations automatically.

The explicit `migrateGraph` tool operation accepts `targets`, each with an exact
workspace source-node ID, original target revision, and optional original
outer-to-inner occurrence route. It validates every original source and revision
before composing a candidate. A shared workspace source component requires all
affected controlled occurrences; incomplete siblings, duplicate source addresses,
wrong routes and stale cursors refuse the entire operation.

Migration follows declared source ownership and typed graph parameters only.
It calls public `migrateGraphV2ToV3`, composes nested strings first with existing
public containing-graph operations, then migrates the current outer graph so
earlier inner changes cannot be overwritten by a stale snapshot. Only revisions
advanced inside this synchronous candidate assembly are refreshed; original
cursors are not relaxed. Graph migration retains each current graph revision;
normal containing `setParameter` writes advance their containing revisions.

Public `graphMigrationV2ToV3.componentRevisions` metadata selects exact identity
changes. Context components change only within affected nearest-workspace source
contexts. Shared context components also used by an untouched workspace refuse.
Untargeted workspaces, family defaults, other string values and private state are
not guessed or rewritten. New graph3 writes exist temporarily on an isolated
candidate while identities are assembled; only the completed ordinary canonical
`replaceDocument` transaction is admitted, validated and recorded by EditorBridge.
There is no raw-source replacement tool or replacement graph runtime.

The normal proposal/digest/revision/ACK and source-history fences remain. The
integrator owns new edit-input/capability and instruction/profile revisions before
any actual-agent activation; this branch does not modify the central server pins.

Import media inventory uses the public graph2/graph3 parsers for exact typed
workspace contexts. The existing actual saved/export roundtrip helper recognizes
both schemas through the normal installed Flow public entry, records graph
schema counts, edge defaults and complete edges, and emits receipt schema
`vict.actual-node-suite-roundtrip@2`. It never constructs or rewrites the app.
Historical receipts remain unchanged. A schema2-only input is not graph3 evidence.

## Verification provenance

Own dependency install:718 packages (`adapter-npm-ci.log`); inherited PostHog
Node-version warning retained.573 unchanged dependency artifact files,
5,371,252 bytes, were copied read-only from the integrator checkout after its
package source diff against the exact starting SHA was empty. Every copied byte
was SHA256 compared; `adapter-dependency-artifacts.json` records all paths/hashes.
This is reuse, not a fresh dependency build. Public resolutions remain in this
isolated checkout: Flow exports its documented `src/index.ts`, UI uses own copied
dist, and UI-editor exports own source. No private source alias or root dist write
was used. Fresh integrated packed-consumer evidence remains integrator-owned.

Focused tests are diagnostic fixtures, distinct from actual-agent/native evidence.
Actual CampaignFoundry saved-source/export migration, native interaction, final
production build and independent gate are separate integrator-owned checks. No
provider/browser calls, root-app injection, owner-data change, service activation,
push, main merge, publication or acceptance occurred in this adapter work.

## Builder checks

Public Flow source candidate `0e73b1181e52e0233cf4cdfd2972d00258f9b208`
was cherry-picked as `30734d37` into this isolated checkout before dependent
checks. No uncommitted public source or private source alias was used.

- Public Flow package check:0 errors /5 inherited warnings (`adapter-flow-check.log`).
- New migration suite:11/11 PASS (`adapter-migration-first.log`).
- Affected source ownership, genuine mounted bridge, runtime rollback, history,
  import and knowledge regression:58/58 PASS across7 files (`adapter-regression.log`),
  including the11 new cases. Existing Svelte and shortcut warnings are retained.
- Studio TypeScript:PASS (`adapter-typecheck-final.log`). Initial readonly route
  assignability errors in new test-input types are retained in
  `adapter-typecheck-first.log`; the internal operation input now matches Zod's
  mutable JSON array type. No runtime behavior changed for this correction.
- New migration helper/test targeted ESLint:PASS (`adapter-lint.log`).
- All other changed adapter sources and the roundtrip script ESLint:PASS
  (`adapter-changed-lint.log`).
- Actual roundtrip script JavaScript syntax check:PASS.

Reproduction from `apps/studio`:

```text
npx vitest run tests/graph-v3-migration.test.ts tests/graph-scoped-ownership.test.ts tests/graph-scoped-bridge.test.ts tests/graph-runtime-refusal.test.ts tests/graph-history-source-policy.test.ts tests/source-import.test.ts tests/agent-knowledge-read.test.ts
npx tsc --noEmit
```

These builder checks do not supply an independent verdict or actual graph3 agent
proof. Next allowed action: integrate the public and adapter candidates, pin the
new edit/instruction/profile protocol, build, independently verify, then carry out
the authorized actual-agent/native continuation using the owner's current source.
