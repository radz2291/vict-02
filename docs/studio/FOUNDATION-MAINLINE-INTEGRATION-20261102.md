# Authoring Foundation mainline integration — 2 November 2026

## Authority and candidate preparation

The owner explicitly authorized integration of the completed Authoring Foundation and documentation reconciliation into main, through isolated candidate preparation, independent verification, necessary integration repairs and normal mainline update. This supersedes the prior documentation-only stop solely for this integration. It does not authorize runtime activation, deployment, publication, TORI implementation, Milestone 2 resumption, speed optimization or features.

Fetched repository: `https://github.com/radz2291/vict-02.git`. Remote main is `d7401bef6e48330796c74ec00c86db9622d48cdf`; delivery is `ed771858fb1d3a28783d320785a3cab1bbe3f341` on `codex/structure-shared-completion-20261101`. The delivery checkout was clean. Worktree inventory was inspected without changing other worktrees, including the older local main checkout. Integration uses isolated branch `codex/authoring-foundation-mainline-20261102` in `C:\Users\RZ1\.codex\worktrees\vict-foundation-mainline-20261102`.

Main is an ancestor of delivery: zero main-only commits, 557 delivery-only commits. There are no intervening main changes or merge conflicts. A normal fast-forward is preferred. The full delivery changes 7,981 paths, including 7,000 Studio documentation/evidence paths, 280 Studio paths, shared UI packages and inherited kernel/runtime/SDK/Mastra changes. These are retained delivery history, not new integration features. Root package/build ladder, package lock and Vitest configuration changed; no GitHub workflow changed. The release workflows are manual and are not invoked. GitHub's main branch read reports protection disabled and no required status checks; server rules still govern the eventual normal push.

No product changes follow source `2de11bc7719984f23341852b1cc8b9985ff81adf` in the delivered documentation commits. Historical actual-agent, native and device evidence can therefore be reused at its original source identity and scope; this is not fresh browser/provider/device proof. Original independent Option 2 verdict remains attributed to `20e26253f0ec6aab20f480c1b3e537e2282938d8`, with later test-repair/caption follow-ups attributed to integrator verification.

## Verification plan and boundary

Fresh checks run only in the isolated checkout: locked dependency installation, root shared-package build ladder, Studio type checks and production build, graph ownership/sibling/history regressions, Structure and repaired keyboard/caption behavior, inherited backend boundary regressions and an installed public-package consumer. Exact candidate and raw evidence will be pinned before independent challenge. No whole-repository or fresh whole-foundation pass is inferred from these scoped checks.

The running Studio, installed build, saved applications/assets/conversations/drafts and provider configuration must remain untouched. Read-only before/after fingerprints record the protected runtime location. No historical launcher or activation script is executed.

## Integration test reconciliation

Tested integration candidate: **58e7296f553325be25d7bb3adb9067e58eef57e0**, following preparation **4e3fe2d545422eb2efb893f7c26da9d9caeb4d9d**. The root build began at the preparation commit and completed after the test-only repair commit; production source, manifests, TypeScript configuration and build scripts are equal between them. That fresh build result is carried to the repaired candidate on exact build-input equality, not mislabeled as a second build.

The first expanded regression run found three failures in delivered UI-editor tests, not the previously repaired 12 Studio cases. Original failed logs are retained. A correctly scoped rerun reproduced the stale class assertion. Investigation found no corresponding production defect:

- Class validation deliberately removed numeric quotas. Formerly capped valid 257-character/Unicode tokens and 101-entry lists now have explicit acceptance checks; malformed empty, whitespace, NUL and nonstring refusal checks, atomicity, history and persistence checks remain.
- Floating tools listen on their owning document to support iframe ownership. The old synthetic F10 event was dispatched directly to window without bubbling. The fixture now dispatches from the actual canvas with bubbling, retaining focus restoration, Escape, visibility and unchanged-source assertions.
- Catalog coverage iterated the entire enlarged catalog inside one five-second case. Parameterizing by descriptor preserves all property/output/page assertions and the normal per-case timeout, while reporting the failing descriptor individually. No timeout is increased in the repaired test.

These are integration test repairs only. Production source, runtime behavior and package manifests are unchanged. Independent verification must challenge the repaired candidate rather than reuse the initial candidate's verdict.

## Initial candidate verification evidence (superseded by iframe repair)

Evidence is retained under [mainline integration evidence](foundation-evidence/mainline-integration-20261102/). The preserved initial broad run had three failures / 638 passes / three skips; the corrected scoped run reproduced the class expectation failure. Those observations are retained, not counted as current accepted failures. A timing diagnostic overlapped fixture editing and is supporting diagnosis only; final verdicts use the committed candidate.

| Check | Result and scope |
| --- | --- |
| Locked isolated installation | PASS, 719 packages; all workspace links resolve inside the new integration checkout |
| Shared package build ladder | PASS, all 21 configured packages; build-input equality qualification above |
| Core/editor/backend regressions | PASS, 58 files / 445 tests, including all three repaired editor files, canonical transactions/history, stream ordering/replay/cancellation and deterministic offline adapter cases |
| Flow regressions | PASS, 39 files / 209 tests, including nested ownership, sibling isolation, connection behavior, coordinate frames and history |
| Studio checks and build | TypeScript, designer Svelte check and isolated production build PASS; standalone AI package Svelte check also PASS |
| Installed public consumer | PASS, five DOM cases and production build; nine public packages / 647 nonmanifest installed files match current packed inventories; no Studio imports or source aliases |
| Protected runtime | Before/after read-only fingerprints equal: 398 installed files, listener PID/start time and four checked configuration files; no browser/storage export is claimed |

The new consumer report is [mC6r2f](foundation-evidence/structure-shared-completion-20261101/vict-structure-consumer-mC6r2f.json), with source candidate `58e7296f553325be25d7bb3adb9067e58eef57e0`. Six package-build/artifact reuse decisions require equal tracked trees, every packed-file hash and the original archive SHA. UI-editor, Flow and Structure were freshly checked. Seven archive SHAs equal the earlier caption artifacts; Flow/Structure have 33 CRLF/LF-only member differences and were freshly packed, installed and tested. No equality to the old installed production build is claimed for the new isolated build. Earlier native/actual-agent/device evidence remains attributed to its original source and scope.

Retained warnings include the five existing Svelte warnings, fixture initial-value warnings, shortcut trigger warnings, experimental SQLite notices, upstream unused/circular imports and large production chunks. Installation also reports the inherited `posthog-node` Node engine mismatch on Node 22.13.1 and npm 11's unapproved optional install-script notices; installation and all recorded required builds succeed. No warning is silently declared repaired. No whole-repository suite was run; unrelated historical failures outside this gate are not reclassified. No provider call, fresh actual-agent demonstration, painted-browser check or device check is claimed.

## Expanded Studio findings and integration repair

The expanded Studio run at `58e7296f` produced eight failures / 158 passes across 34 files. The earlier repaired 12 cases did not recur. Seven additional expectations/fixtures were stale: a removed metadata-size quota, the capture callback's new cancellation signal, current persistent drawer controls, and reads of retained preview content now owned by the iframe. Repairs preserve executable schema equality, a live AbortSignal, draft element identity, canonical and saved source, exact runtime state (including a bound echo), and focus/shortcut assertions.

The iframe-aware modal test uncovered a real integration defect, retained in `portal-owner-classification.log`: while the frame was hidden for Structure, a dialog remained mounted in the application and Bits' global scroll lock set Studio's parent body to `pointer-events:none`. This is an integration repair, not grounds to reopen all bounded foundation acceptance.

Two shared production files are repaired. `CatalogPortal.svelte` now tracks same-origin embedding-frame ancestors, their owning documents, connection/visibility and resize/membership changes, with observer cleanup. `CatalogDialog.svelte` retains the pinned Bits parts, controlled outputs, focus and dismissal; for an isolated application document it disables Bits' global scroll lock and reuses the existing refcounted `lockOwnedDialogViewport` during mounted content lifetime. Standalone behavior retains the original Bits lock. No component ABI, canonical editing/history, effect, data, provider or dependency contract changes.

Fresh regression checks must verify local modal blocking, focus/dismissal, hidden/inert/detached lifetime and lock release in Studio and an installed public consumer. Happy DOM omits the browser's `Window.frameElement` property; the DOM fixtures model only that same-origin platform link, not visibility, modal rendering or lock outcomes. Failed fixture setup and incomplete diagnostics are retained. This evidence is not a new painted-browser proof.

The later production candidate therefore differs from `2de11bc7` in those two shared files. Earlier backend/graph and native/provider evidence can only carry its original attribution or justified unaffected-source equality; no global source/artifact equality to `2de11bc7` is asserted for the repaired candidate.

## Preserved status and stop condition

Bounded Authoring Foundation / Option 2 and follow-ups stay closed. Stage 9 stays open; Milestone 2 stays paused with requirements retained pending explicit owner resumption. Speed work stays deferred pending TORI integration, with measured slowness open. The current agent remains available until a TORI replacement meets the [future integration acceptance requirement](AUTHORING-FOUNDATION-CURRENT-STATUS.md#future-tori-integration-acceptance-requirement) and is verified. Mainline integration establishes a dependency baseline for future TORI work; it does not start that work. Stop after verified mainline delivery and reporting.
