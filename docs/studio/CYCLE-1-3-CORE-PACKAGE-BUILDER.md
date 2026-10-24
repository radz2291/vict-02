# Cycle 1.3 core package authoring — builder record

2026-10-24. Builder evidence only; no independent verdict or owner acceptance.
Architecture authority: [core authoring scope and AC-01–AC-03 remedies](CYCLE-1-3-CORE-AUTHORING.md), independently challenged before implementation. The stage manager owns candidate commit, integration, full checks and independent verification.

## Implemented package path

`@victframework/ui` exports a neutral `vict.ui-authoring@1` companion and package install shape referencing existing `UiExtensionDescriptor` values. It derives contracts, exact capability projections, package provenance, descriptor/knowledge/dependency digests, paginated family/category/search index and bounded selected bundles. Bundles explicitly report incomplete closure, pending IDs and budget cause. Known digests omit unchanged contract bodies. Source/application identities remain separate.

Production assembly enables `createUiAuthoringRegistry(packages, implementations, {requireCompatibility:true})`. It refuses missing descriptor/capability compatibility pins, same-revision drift, duplicate exact registrations, missing renderer dispositions/capabilities, missing dependencies, dependency cycles, invalid controlled pairs and unavailable provider/slot rules. Fixture-only assembly can remain explicitly unfrozen. The retained general baseline pins all 80 existing descriptors and relevant actual renderer capabilities. Existing descriptor/implementation identities are unchanged; new insertions pin exact revisions. The snapshot is release evidence, not an independently duplicated props schema.

Shared source rules cover provider context through wrappers and local-definition slot substitution, required parts, unique provider identities, paired parts, host prerequisites, controlled state and label guidance. Provable new errors refuse final atomic admission. Only newly introduced identity/pair/controlled/required-part rules can retain unchanged historical general-catalog violations as warnings; old provider-context and required-slot refusals remain strict. New specialist IDs do not inherit historical compatibility. Dynamic/repeated/conditional identities remain explicitly unresolved at source level.

`@victframework/ui-svelte` owns general-catalog metadata, serializable seeds and complete provider-wrapped examples. All 80 existing descriptors have dispositions: 78 standalone/part authoring registrations, plus AppShell and RadioGroup with explicit host prerequisites. Public package export paths receive dispositions; raw exports/helpers/styles do not automatically become authorable. Reusable fragments remap only structural IDs, state references and explicit semantic identity links. Menu identity values derive from insertion identities; matching tab keys and typed controlled state come from package-owned contracts. No dependency on `ui-editor` or Studio is introduced.

The actual catalog implementation install derives runtime semantic rules from the same registrations. `RenderNode` checks evaluated provider identities and paired parts before mounting ambiguous contexts, including dynamic values, repeats, conditionals and local component scopes. It renders bounded source-linked refusal feedback, rather than choosing a first duplicate. An actual DOM test demonstrates duplicate dynamic menubar values refusing presentation and recovery when the supplied value becomes unique. This is renderer test evidence, not an independent browser journey.

`@victframework/ui-editor` provides registered component/native insertion and package-seed recipe projection through existing canonical commands. Native insertion uses the active semantic catalog. Effective descriptor lookup matches compiler exact-pin/last-current rules in composition navigation and canonical slot edits. Recipe insertion affordances follow actual provider occurrences through wrappers and local-definition slot fills. `EditorBridge` passes previous source into its optional host policy, admits warning-only results, preserves final validation/history, and stages against the same default catalog as its session.

The neutral default semantic catalog now registers standard h5 and h6 in addition to h1–h4. No document schema change, script escape hatch, effect authority or automatic source migration is added.

## Checks

- Neutral and editor focused tests: **18/18 PASS**. Includes production-pin refusal, missing/cyclic registration, bounded 300-entry discovery, incomplete bundle refusal, selective dependent invalidation, changed descriptor revision with old cache identity retained, immutable same-revision refusal, semantic identities/pairs/uncertainty, h1–h6 compilation, registered insertion/history and wrapper/local-slot affordances.
- General package authoring tests: **6/6 PASS**; one explicit compatibility-generation test skipped during ordinary runs. All standalone/part examples compile against actual descriptors/renderer registrations. Typed seed state and exact export dispositions are checked.
- Affected renderer regression group (authoring, Component ABI, preflight and headings): **22/22 PASS**, with the explicit compatibility-generation case skipped.
- `tsc -p packages/ui/tsconfig.json`, `tsc -p packages/ui-editor/tsconfig.json`, and `tsc -p packages/ui-svelte/tsconfig.json --emitDeclarationOnly --outDir packages/ui-svelte/dist`: PASS.
- Root `tsc -p tsconfig.json --noEmit`: PASS after newly added test callback/literal annotations were repaired. Later integrated checks belong to the stage-manager report.

## Retained failed observations and repairs

1. Initial compatibility fixture generation used an `import.meta.url` URL that happy-dom/Vite presented with a non-file scheme. It refused filesystem write; changed to an explicit repository-relative resolved filesystem path, then generated the retained baseline and reran normal checks.
2. Initial editor fixture omitted the active semantic element catalog. Corrected the fixture. Its warning-only validation case also exposed bridge staging using an empty standalone catalog while the session used the default catalog; the bridge now uses the same default.
3. Initial source rules duplicated the tabs identity rule, causing false duplicate diagnostics. Removed the duplicate declaration.
4. Initial generic value inference treated ordinary menu-item output payloads as provider identities. The actual DOM recovery test exposed the overconstraint; identity rules now explicitly name the component families whose values have identity semantics. Root/sub controlled selection values and ordinary output payloads are not conflated.
5. Initial root TypeScript check found new test callback/literal typing errors. They were annotated; the later root check passed.

## Limits and pending integrated evidence

Labels and deliberately uncontrolled controls remain semantic guidance/warnings unless a contract explicitly requires otherwise. Source analysis cannot prove runtime uniqueness; evaluated rendering guards provide the complementary check. No general browser accessibility/professional-output claim follows from examples or these tests. Independent installation, integrated browser/provider journeys, specialist adapter evidence and final finding dispositions belong to the stage-manager/verifier evidence.

No owner tabs, saved/unsaved documents, provider configuration, old previews, publication or deployment were changed by this package task. No gate was self-accepted.
