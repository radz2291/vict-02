# Decisions and evidence

Date: 5 October 2026
Preserve prior decisions and failures. Distinguish owner decisions from technical design proposals.

## D-01 — one Studio product, separate foundation ownership

Owner context: “Stage 9 actually are proposing a studio, but it is a VICT native Studio”; “I want the UI foundation to be great first. Then I revisit Stage 9 Studio development, but that's gonna be handled by a different agent.”

Disposition: this work delivers reusable UI foundation, authoring modules, reference proofs and an integration handoff. The other agent owns the complete Studio application and subsequent integration.

The owner replied “Good” after this split was explained. This supersedes the earlier proposal's wording that could imply this session delivers a separate complete Studio authoring application. It does not erase Stage 9's operator evidence or declare visual authoring already implemented.

Affected records: PRODUCT-ARCHITECTURE, STAGES, HANDOFF, STATE.

## D-02 — governance and pack preparation

Owner asked: “Good. do you know how do we work? from govern-project-agents.. can you explain so i can verify”, then “Do you need to prepare any documentation packs?”, then “Ok lets start”.

Disposition: prepare the project-specific execution pack and its bounded U0 contract work. Use one stage manager, independent challenge, repair/re-verification and truthful state. Do not invent owner approval of every future implementation stage.

This delivered first handoff stops at U0. Later stages remain proposed delivery slices; their actual authority is recorded in subsequent accepted handoffs.

## D-03 — actual UI with simulated implementation

Owner vision: quickly create the actual application UI, use stubs/demo implementations to review product understanding, then progressively implement machinery without discarding the UI.

Disposition: one canonical source and renderer, contract-bound simulation, truthful per-operation coverage and specific durable replacement proof. Preserve UI when contracts remain compatible; product discoveries may require deliberate changes and must be disclosed.

## T-01 — versioned canonical UI attachment (technical candidate)

Observation: closed application @1/@2 schemas and versioned identity reject unknown UI-document fields. Application Release checks applicationVersion against the compiled plan.

Proposed choice: an opt-in @3 application/identity shape, screen document reference, explicit compile catalog and reachable source hashes. This is not an existing capability. U0 verifies names and exact public boundaries locally and freezes the choice.

Alternatives considered: unattached editor file (reject: misses canonical source/identity); arbitrary generated Svelte (reject: hides editable truth); opaque component with UI source only in mutable props/registry (reject as foundation: does not establish canonical generalized authoring and identity).

Affected records: CONTRACTS §1, A-03, U0-03 and U1-01.

## T-02 — neutral dependency direction (technical candidate)

Observation: SDK depends on UI; application imports SDK and UI. Neutral UI must not import SDK/application/runtime to resolve semantics.

Proposed choice: explicit structurally typed semantic/extension catalogs passed to neutral UI compile, with joint identity/reference validation in application compilation. Svelte stays at the renderer/editor boundary. U0 verifies the full dependency graph.

## E-01 — read-only repository reconnaissance

Repository: radz2291/vict-02.
Live main on 5 October 2026: `4d2df037d8a82d36c60bf1bff16919650643ce22`.

Sources inspected through authenticated read-only repository access:
- Root AGENTS.md and package.json.
- docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md.
- docs/governance/VICT-STAGE-09-STATE.md and formal closure record.
- docs/VICT-SYSTEM-REFERENCE.md, including APP-019 and simulation description.
- apps/studio/src/lib/application/definition.ts and the generic VitApp host.
- packages/sdk/src/application.ts and package.json.
- packages/application/src/compile.ts, release.ts, data.ts and public index.
- packages/ui/src/index.ts, composition.ts and package.json.
- packages/ui-svelte/package.json.

Observed claims: Stage 9 is an existing native operator consumer and explicitly excludes visual application authoring; formal closure is recorded. General current composition has a bounded stack/split vocabulary. Application source/identity/release and data-adapter boundaries are explicit.

An attempted packages/application/src/definition.ts read returned unavailable; the actual definition is packages/sdk/src/application.ts. No claim rests on the unavailable path.

No shell clone/build/test/browser/registry verification occurred here. Remote file observations are not local checkout evidence. The unshared separate HTML Studio prototype has not been inspected.

Pinned source root:
https://github.com/radz2291/vict-02/tree/4d2df037d8a82d36c60bf1bff16919650643ce22

## Pack review ledger

Reviewer: independent fresh-context agent /root/pack_review. The reviewer did not author or repair the candidate. Documentation adequacy was challenged against pinned source and the exact file-hash manifests.

| Candidate | Manifest SHA-256 | Verdict and disposition |
| --- | --- | --- |
| 01 | 8d2683a2a1aae7740755326af597eeed16b4a7a44cfdaf4a9d60cd8b76318e6d | PASS WITH NON-BLOCKING FINDINGS; one MINOR F-01 collision-comparison-authority ambiguity |
| 02 | db369614c97119762995480d3ad277b92d21e2eb812739d770bc16bf2df6b15a | PASS — documentation only; F-01 RESOLVED through independent affected review |

F-01: the original contract promised rejection of same-revision/different-byte source without naming comparison authority. Repair: CONTRACTS §1 now checks competing explicit catalog entries or supplied immutable pins, states that one current input without history cannot prove a historical collision, and keeps revision enforcement in the explicit authoring/session boundary. U1-01 now specifies the catalog/pinned collision negative.

The candidate 02 reviewer confirmed all nine file digests, exact manifest hash and a diff restricted to those two clarifications plus manifest values. No scope, authority or source-identity regression was found. Original finding/report and both manifests are preserved: [review 01](reviews/PACK-REVIEW-01.md), [review 02](reviews/PACK-REVIEW-02.md), [manifest 01](reviews/candidate-01.json), [manifest 02](reviews/candidate-02.json).

Post-review changes: truthful result metadata in README, STATE and this ledger; copies of reports/manifests; final content inventory/archive. These reporting/packaging bytes are outside candidate 02's independently reviewed snapshot. The architecture/contracts/stages/handoff/agent-entry/start instruction retain the reviewed bytes. Root validates final links, content hashes and archive integrity; it does not call that a second independent review.

This evidence is separate from U0 repository freeze and U1–U4 implementation gates. No repository candidate/verifier SHA or runtime pass is invented.

## U0 installation record (2026-10-06, local repository)

The pack was installed verbatim into `docs/ui-foundation/` of the isolated branch `codex/ui-foundation-u0` at base `4d2df037d8a82d36c60bf1bff16919650643ce22`. The six `docs/ui-foundation` documents, `AGENTS.addendum.md` and the two preserved review reports with both candidate manifests matched the pack `HASHES.json` inventory byte-for-byte at copy time. README and START-HERE remain pack-delivery aids and were not installed.

Installed-copy repairs (made before candidate review, recorded here):

- The four pack-review links in the ledger above were rewritten from pack-relative `../../reviews/…` paths to the installed `reviews/…` locations so links resolve inside the repository. Report and manifest bytes are unchanged.
- `STATE.md` is updated in place per its update discipline as U0 proceeds; its delivered opening bytes remain in pack review lineage (candidate 02 digest `8f7aeda86896ef83669e394e9a48e527f5db849a3e0fb880642a2f36bb05a963`).

## Future evidence entry format

Identity: repository, branch, full base/candidate/reviewer SHAs, environment and contract pins.
Claims: criterion ID with PASS/FAIL/NOT DEMONSTRATED and direct evidence.
Reproduction: commands, inputs, fixture versions, screenshots/browser sizes or API behavior.
Findings: severity, effect, owner, fix/carry decision, next check.
Verdict: independent conclusion and exact audited snapshot.
Repair: prior failure, fix commit, affected checks and new verifier snapshot.
Authority: next accepted action; never derive it from an agent's own proposal.
