# Independent Inspector/Layers experience recheck — round 2

7 October 2026. **Bounded verdict: PASS WITH NON-BLOCKING FINDINGS.** The round-1 M1/M2/M3 failures and L1 warning are repaired and independently rechecked. No remaining in-scope blocker was found. Existing broad Svelte-check failures remain a manager-owned integration finding. Owner experience acceptance remains **PENDING**; this slice neither accepts the compiler repair nor closes U2.

Exact tested candidate: `d0ba90cfcd5efead2b7c7c82d37a2ed29483d715`, branch `codex/ui-foundation-u2-inspector-ux`. Original bounded base: `83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff`. Failed round-1 candidate: `4d7b0670186a04411a51234d361bb8c9ef65fea1`; its report/evidence remain preserved, not relabeled as passing. Independent detached checkout: `C:/Users/RZ1/Desktop/RZ/vict-02-u2-ux-recheck`. Remote branch SHA independently matched the repair candidate.

The same independent evaluator performed affected re-verification; it authored no implementation repair. Own npm dependency installation, own Chrome processes, own review servers on 5198 and supplemental canonical-fixture server on 5199. Candidate packages/examples unchanged. Added evidence only within `docs/ui-foundation/u2-ux/independent-review/`. Retained round-1 files were not overwritten. New evidence is in `round2/`, with separately named `round2-challenge.mjs` and `round2-adversarial.mjs` beside this report.

## Repairs rechecked

| Finding | Independent recheck and verdict |
| --- | --- |
| M1 — hidden roving focus after collapse | **PASS.** Select Introduction child, click Collapse Introduction. Exactly one visible tab stop remains: Introduction. Move focus to history controls, press actual Tab repeatedly: keyboard reentry reaches `review\|hero`. Right expands, Right enters child, Enter selects exact `review\|eyebrow`; Inspector and Layers match. `round2/journeys.json`, collapsed-tree.png. |
| M2 — lost navigation params | **PASS.** Fresh canonical fixture contains `params.id={op:'literal',value:'keep-param'}`. Same-route route.a reconnect and changed-route route.b reconnect both retain the expression; apply returns success. Action reconnect retains its input expression. `round2/adversarial.json`, behavior.png. |
| M3 — stale effective measurements after resizing | **PASS.** Heading actual32 at390 viewport, then actual52 and displayed Browser now52 after returning1440. Preview480 retains actual/display52. Card padding actual/display16 at480;37 atFull;16 at390;37 atFull. Every size switch reports No unsaved changes. `round2/journeys.json`, container-480.png. |
| L1 — new canvas-reference warning | **PASS.** Production build and broad Svelte check no longer emit the dedicated-host canvas warning. Broad check warnings reduce5→4; all remaining diagnostics belong to unchanged files. |

Additional repair checks: Advanced Attribute name type populates existing `button` value. Authored `royalblue` remains named in text field, while swatch #4169e1 matches actual rgb(65,105,225). `setConditionalStyle` is available as a function through the public module import. `round2/extras.json` records these observations with0 page exceptions.

## Repeated founder journeys and visual review

The primary full journey was repeated against this exact candidate. Heading literal changed to Independent founder heading and size52px reached the actual canvas. Shared background changed all3 cards; instance background changed only the first. Padding top37 used the common numeric control, with Undo24/Redo37. Save acknowledged revision2; full browser reload and Reopen saved retained heading, size, shared/instance colors and spacing. Inherited color explanation was explicitly opened, followed by override rgb(17,34,51) and Reset restoring rgb(37,51,70). Exact Layers selection and keyboard synchronization passed. Condition target/reset retained the separate shared source instead of pretending Reset erased it. These are all **PASS** within the bounded supported semantics.

Fresh selected-element captures exist at1440×900,1024×768,390×844 and480 container. Selected-1024, selected-390, instance-selected-1440, container-480 and collapsed-tree were visually inspected. Hierarchy, spacing, secondary provenance text and visible focus remain coherent; fields/reset buttons stay contained. Mobile uses the intentional panel tabs. Long selected host metadata wraps in the supplemental390 capture without clipping controls; measured horizontal page width remains390. The480 canvas responds to its named container condition. Effective measurements now agree with the actual DOM while authored controls retain their source values.

Completed primary, supplemental binding and extra-control browser probes each recorded **0 page exceptions**. This is independent real-browser/module experience evidence, not a human founder acceptance decision.

## Independent checks

| Check | Result |
| --- | --- |
| Own `npm ci --ignore-scripts` | PASS; existing engine/audit observations unchanged |
| Contracts/UI/SDK/application dependency builds | PASS |
| Root `npx tsc --noEmit` | PASS |
| `npx vitest run --project renderer` |120/120 PASS,17 files |
| `npm run test -w ui-design-proof` |12/12 PASS |
| `npm run build -w ui-design-proof` |PASS; retained renderer/workbench accessibility warnings, no new host warning |
| Broad `npx svelte-check --tsconfig examples/ui-design-proof/tsconfig.check.json` |**FAIL**,23 errors/4 warnings in4 unchanged files; preserved `round2/broad-svelte.txt` |

Relevant unit70 and integration4 passed independently at round1; affected renderer and design tests were rerun after repairs. No repeat claim is made for the unchanged suites. Build stdout is preserved in round2/build.txt. The broad red check is not converted into a green result by the passing root TypeScript or build checks.

## Residual findings and limits

The broad Svelte errors remain manager-owned: EditorCanvas missing UiRenderPlan import, generated $app/environment declaration coverage and workbench `$state` shadow/type problems. Existing renderer/workbench accessibility warnings also remain. These pre-existing items prevent describing the entire repository as clean, but no diagnostics remain in the redesigned modules or dedicated review route. Owner: overall U2 manager; next check: repair and verify the combined integrated candidate.

Supported scope remains shared source edits and instance component-wrapper style edits; inner-element instance overrides and instance text replacement are unavailable and disclosed. Authored-versus-browser values are separated; a measured value alone does not identify the browser's winning cascade origin. Conditions author real rules without simulating pseudo state. Supplemental behavior fixture supplies declared route/action IDs and bindings; the everyday review fixture has no live backend. Full Studio integration and repeat/portal-product acceptance are outside this slice's verdict.

One failed round2 harness attempt is preserved in round2/failed-journeys.json: Vite optimization/build navigation restarted the browser execution context while waiting for canvas. It contained no completed journey and no page exception. The evaluator reran the full fresh browser journey after build/optimization settled; the completed run above is the basis of this verdict. This environment failure is retained separately from round1 product failures.

Next permitted action: owner/manager reviews this exact candidate and bounded handoff, integrates within its separately authorized track and verifies the combined result. Any source change after this SHA requires affected recheck. A later evidence-only commit may carry this report, but it must preserve implementation bytes and identify this tested SHA. No acceptance, U2 closure, main merge, publication or deployment is authorized by this verdict.
