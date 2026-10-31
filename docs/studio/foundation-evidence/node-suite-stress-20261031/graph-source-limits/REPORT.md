# Graph and source authoring quota removal candidate

The owner requested removal of artificial task ceilings after the actual Campaign Foundry agent run stopped at an evidence budget. This lane removes graph/source/edit/read quotas; the parent and parallel lanes own evidence retention, provider execution policy, central protocol revisions and transport. The actual partial app remains preserved. No browser activation, provider call, owner-document edit or push occurred in this lane.

## Changes

- Studio no longer imposes 200,000 source characters, 500 source nodes, 40 edit operations or 40 graph changes. Its literal content, array, expression, scoped declaration, style, input-index and identity-length quotas are removed from admission and transmitted presentation together. Strict keys, canonical types, registered vocabulary and semantic validation remain authoritative.
- Before commit, the independent reviewer caught three additional 180,000-character checks in `graph-authoring.ts` that the builder's first numeric scan missed. A new genuine mounted Studio bridge regression reproduced the manual graph write refusal with a 180,001-character nested parameter, before these checks were removed. All three root-state/owned-source/patch checks are removed together; the regression also covers routed agent editing, save/reopen and portable import. The red callback rejection and later green result are retained separately.
- Public Flow graph@1/@2 validation, operations, clipboard and command paths no longer impose one million characters, 50 operations, or fixed family/node/edge/port/field/parameter/selection counts. Legacy text/label and clipboard-offset ceilings are removed consistently. Application-authored field bounds, options, port capacities and cycle policy still apply.
- Command receipts retain every ID for the explicit host lifecycle. Removing the 128-receipt admission limit does not evict IDs or permit replay. Default graph sessions retain history until explicit replacement/disposal; explicit consumer `maxHistory` remains an application policy option.
- Source/knowledge offsets accept nonnegative safe integers. Exact source cursors and knowledge body/digest/projection identities remain required. Pages remain bounded windows (20 inventory entries / 6,000 JSON characters); the total 200,000-character knowledge cutoff is removed. Legacy contract discovery no longer rejects a large singleton before paging its body. Shared contract bundles have no default total-byte/dependency-depth ceiling; explicit consumer budgets report pending/incomplete truthfully.
- Lexical graph ownership, media source inventory, scoped expression shape and renderer identity validation use complete iterative walks with cycle detection, replacing fixed visit/depth ceilings. Unknown/incomplete source authority is still refused; it is never promoted to document ownership or silently downgraded to private runtime. Repeat identity validation inspects all rows, including rows beyond the former 5,001-row slice.
- Studio source import delegates archive shape/count/byte/format/digest validation to the existing public media importer in a disposable memory store. Studio's duplicate 96 MiB bundle, 100-asset and 64 MiB aggregate envelopes are removed. Preparation remains side-effect-free and all-or-nothing for owner storage.

No saved document or graph schema migration is needed: previously valid data remains valid, while larger valid data becomes admissible. The public data-contract digests reflect the relaxed grammar. Central tool/profile revision changes are owned by the parallel server lane.

## Evidence and checks

`baseline-red.log` runs the six new public Flow regression cases against preserved source `84a80ecaa081b946619d3691b3dfcb3df034c23d`. The four relevant model/schema/command files are identical to the active starting candidate `04339fa74c529dfe77c8f5c167a2dbd1aa388f3b`. All six fail under the original quotas. History and receipt cases use otherwise small valid graphs, isolating the 100-history and 128-receipt boundaries. The initial probe setup tried a relative copy in the wrong worktree; its no-test result is separately retained in `baseline-setup-attempt.log` and is not product failure evidence.

Final checks are retained separately:

- Public Flow models, commands, clipboard, default history, scalar content and mounted composition: 53/53 pass.
- Shared UI authoring, scoped slots and forwarding: 31 pass / one existing skipped baseline-generation test. The added repeat test then passes 2/2, exercising both more than 5,000 ordinary instructions and 5,002 repeat rows with a late duplicate identity refusal.
- Studio initial affected source/read/ownership/import set: 65/65 pass. After the last read-identity/import delegation changes, 45 other policy/bridge cases and ten read-contract cases pass; one old read quota expectation fails, then the corrected eleven-case read-contract suite passes 11/11. No product fix is hidden by that expectation update.
- Studio TypeScript: exit 0. Flow Svelte check: zero errors / five inherited warnings. Narrow shared UI TypeScript build: exit 0. Changed-path whitespace check passes.
- After the reviewer's 180,000-character finding: the genuine bridge test is red with a refused manual write before removal; the repaired bridge/ownership/runtime/threshold set passes 21/21, and Studio TypeScript again exits 0. The final transmitted-schema smoke check passes 5/5.

New tests cover source beyond 500 nodes / 200,000 characters; edits beyond 40/50 operations; graph@1/@2 beyond 1 MiB, 128 families/ports/parameters, 1,000 nodes and 4,000 edges; clipboard round trips; history past 100; receipts past 128; literal text/list/style/expression counts; knowledge/source pages past 200,000; complete lexical inventory past 16,384 visits; deep scoped expressions; and late runtime duplicate identity rejection. Existing typed-value, stale revision, closed-shape, cycle, capacity, repeated/nested ownership, import-negative and real Studio bridge checks remain exercised.

Intermediate failed observations are retained. They include obsolete quota expectations, an incorrect test-only repeat compile signature, and a test assumption that boolean `not` already rejected multiple terms. That assumption was replaced with a real existing semantic type-negative case; this change does not redefine boolean semantics. These are distinct from the deliberately red baseline quota tests.

## Remaining boundaries

This is not a claim of unlimited machine memory, JavaScript stack/serialization capacity, rendering performance, provider context or platform resources. Public media archive protections remain in the media package. Canonical class-token grammar/list policy and the unrelated shared theme/required-parts declaration contracts were not silently changed. Actual scope, type, endpoint, application capacity, cycle, read-only, revision and command identity checks remain enforced. No new Studio runtime or specialist control adapter was added.

The suite fixtures establish diagnostic contract behavior. They do not replace the parent's eventual actual-agent completion, native browser interaction, supported export/import or independent candidate verdict.
