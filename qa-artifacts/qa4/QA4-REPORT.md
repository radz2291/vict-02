# UI P4 — QA Verification Report

- **Codex branch verified:** `codex/ui-foundation-p4` at `3fe339ccf9becf255a6778243ce3370f9ef1670f` (local == origin; commit `feat(ui): migrate remaining surface presentation to ui-svelte`)
- **QA branch:** `qa/ui-foundation-p4` (worktree `vict-02-qa-ui-p4`), based exactly on the P4 SHA
- **Untouched:** `main`, all Stage 8 branches/worktrees, the Codex P1–P4 branches and worktrees, all previous QA branches
- **Result: P4 is ready for architectural closure** after three bounded QA fixes (two accessibility, one label-geometry presentation fix — details below). No Codex foundation correction is required for the P4 scope.
- Release-set 13→15 work, merge, and publication remain untouched.

---

## 1. Environment

- Full workspace `npm ci` + `npm run build` in the QA worktree; all package `dist/` outputs present.
- Real-browser loop: headless Chrome via puppeteer-core (same discovery as the reference app's browser suite), plus axe-core scans.
- Suites on the QA branch (with QA fixes applied):
  - renderer project **63/63** (includes the updated chart-accessibility assertion);
  - reference-app suite **62/62** (real Chrome + axe, built adapter-node server);
  - full unit project **2104/2106** — the 2 failures are `scripts/test/trusted-publishing.test.mjs`'s frozen 13-package release-inventory assertions: the P4 line carries 15 releasable packages, and the release-set 13→15 expansion is the known separate governance work deliberately NOT touched by this QA pass (the QA diff touches no script and no package.json, so the failures are identical on the pristine P4 SHA).
- The reference-app suite self-build path fails on a COLD tree (both `build/` and `.svelte-kit/` absent) with `server exited early: 1` — reproduced identically on the pristine P4 SHA and with the QA fixes; with `.svelte-kit/` present (or any prior build) it is green. Root cause: the suite invokes `npx vite build` directly, skipping the `svelte-kit sync` that the package script performs. Pre-existing test-tooling nuance, documented in Warnings; not a P4 regression and not fixed here (outside the presentation/a11y fix policy).

## 2. Defects found and fixed on the QA branch (bounded, presentation/a11y only)

### D1 — Chart: interactive "Data table" nested inside `role="img"` (axe `nested-interactive`, SERIOUS; `aria-allowed-role`, minor)
**File:** `packages/ui-svelte/src/Chart.svelte`.
The `<figure>` carried `role="img"` + `aria-label={summary}` while containing the interactive `<details><summary>Data table</summary>…` disclosure. In any real browser+AT combination the figure was exposed as a single image with focusable interactive content inside it (axe: `nested-interactive` ×6 charts, serious; `aria-allowed-role` minor). happy-dom and the DOM suite never see this.

**Fix (inversion of the accessible-alternative pattern, same contract):** the figure is now a NAMED GROUP (`aria-label={summary}`, no role override) and the SVG itself is the named image (`role="img" aria-label={summary}`, `aria-hidden` removed). The declared summary remains the accessible name in both places; glyph text inside the SVG is presentational under `role=img`; the Data table disclosure is no longer nested inside any image role. Props and chart semantics untouched. The DOM test in `renderer.test.ts` was updated to assert the corrected shape.

**Verified:** axe reports zero violations on `/charts` (and every other scanned screen) after the fix; the packed-consumer bundles contain the fix; the shipped reference app's dashboard chart was re-built and re-verified (`figRole=null, svgRole=img`).

### D2 — Conversation feed: keyboard users could not scroll the message region (axe `scrollable-region-focusable`, SERIOUS) + duplicate conversation landmarks (`landmark-unique`, moderate)
**File:** `packages/ui-svelte/src/Conversation.svelte`.
The feed is a contained scroll region (`.vict-conversation` has `max-height: 60vh; overflow-y: auto`) but was not focusable, so keyboard users could not scroll a long message feed (axe serious, one per conversation panel). Additionally the panel `<section aria-label="Conversation">` made every conversation on a screen a same-named landmark (axe moderate with >1 conversation).

**Fix:** the feed is now `role="region"` + `tabindex="0"` (with the same documented `svelte-ignore` used by DataView/RecordsTable) named `Messages — <inputLabel>`, using the compiler-required, app-declared composer label so multiple conversations on one screen keep distinct region names. The panel section lost its hardcoded aria-label (it is no longer a landmark; the labelled feed region and the labelled input carry the structure). No behavioral change to sends, focus, or layout.

**Verified:** axe zero violations on `/conversation` with FOUR simultaneous conversation panels (ok/empty/denied/throwing) and on `/rec` with a conversation inside a drawer; keyboard focus reaches and scrolls the feed; the reference app's single conversation announces "Messages — Message".

### D3 — Chart: last category label clipped at the SVG edge on line charts
**File:** `packages/ui-svelte/src/Chart.svelte` (presentation only).
Line charts anchor their first/last points to the plot edges; the edge category labels used `text-anchor="middle"`, so the last label extended past the viewBox and was clipped by the SVG (`point-12` rendered as `point-1` — visible in the pre-fix screenshot series).

**Fix:** pure label-placement correction — first point label anchors `start`, last anchors `end`, middle labels unchanged (single-point charts stay centered). Bar labels were already band-centered and unaffected. No geometry, data, or chart-contract change.

**Verified:** live measurement — zero label bounding boxes outside the SVG at desktop and 320px; `point-12` fully visible; harness check added permanently (`chart many points: NO category label clips at the svg edge`).

## 3. Text and headings (§1)

- Declared `level` 1–6 emits exactly `h1`–`h6`; unleveled text renders `p` (verified per-surface in real Chrome, harness `/headings`).
- The only heading source is the compiler-validated closed vocabulary (`headingTagForLevel` returns null outside 1–6 → `p`), and `Text.svelte` independently enforces the closed tag set (`{p,h1..h6}`, fallback `p`) — defense in depth; the `level` value never reaches the DOM as a tag name.
- **No HTML/tag injection path:** a text surface whose content contains `<b>`, `<img onerror=…>`, `<script>…` renders as escaped TEXT with zero element children; no handler fires (checked `window.__qaXss`/`__qaXssScript` canaries). Content crosses as a Svelte text interpolation only.
- Long content and long unbroken tokens wrap inside the container at 320px; document overflow stays zero.
- Heading outline (harness): shell `h1` (screen title) followed by declared levels in monotonic order. OBSERVATION (application-declared, not a UI defect): a declared level-1 text surface coexists with the shell h1; the shipped reference app declares only levels 2 and 3, and its live outline is `H1` → `H2` (`H1 Vict Reference Application`, `H2 Local workspace overview…`) — sensible.
- Application heading semantics were not changed (no contract defect).

## 4. Read-only DataView (§2)

Exercised at 1280 / 430 / 380 / 320 in real Chrome (harness `/widgets`, 8 columns with long text + unbroken ids):

- Column headers correspond to values (8 declared fields, `th[scope=col]`, header i ↔ cell i; first row carries the unbroken id).
- Empty view renders the empty-state feedback (`p[data-state=empty]`, "Nothing here yet.") and no table.
- Long text and unbroken tokens wrap inside cells (`overflow-wrap: anywhere`); nothing escapes the region at any width.
- Contained horizontal scrolling at every width: `overflow-x: auto; overscroll-behavior-x: contain`; full scroll-right leaves `document.scrollWidth == clientWidth` (no document-level overflow anywhere).
- Keyboard: the region is `role="region"` + `aria-label="Data table"` + `tabindex="0"`; focusing it and scrolling was verified at all four widths; axe `scrollable-region-focusable` silent.
- Screen-reader semantics remain table + labelled region.
- Screenshots captured initial + horizontally scrolled at 1280/430/380/320 and inspected.
- The role remains separate from `RecordsTable` (query/search/sort/paging): `Surface.svelte` still routes `role: 'table'` → `TableAdapter` → RecordsTable, `role: 'view'` → DataView. No responsibility merge.

## 5. List (§3)

- Title-only items, title + secondary items (`title — secondary`), empty state (feedback, no `<ul>`), semantic `ul > li`.
- Long titles and long secondary values wrap; unbroken identifiers wrap at 320px; items stack with the grid gap (8px measured); no document overflow.
- Screenshots desktop + 320 inspected.

## 6. Detail (§4)

- Normal records: `dl` with `div > dt + dd` rows, all fields in declared order.
- Empty/nonexistent record: declared empty feedback ("This record does not exist."), also verified nested inside tabs (`/rec/missing`).
- Long values, unbroken JSON (`{"mode":"fast",…}`), and unbroken tokens wrap inside the panel at 320px — **P3's clip fix is not regressed** (dl right edge ≤ panel right edge measured live; JSON dd renders multi-line).
- Many fields (8–10), desktop grid layout and ≤520px stacked layout both verified.
- Screenshots desktop + 320 inspected.

## 7. Chart (§5)

Both `bar` and `line` variants, real SVG inspected visually and geometrically:

| Case | Result |
| --- | --- |
| Several points (bar 5 / line 6) | PASS — bar heights `h = v/max·plotH` (±1px), baselines on axis; line first/last points anchored to plot edges; path + circles correct |
| Zero points | PASS — no bars/circles/path; gridlines + axis labels render; empty data table |
| One point | PASS — single centered circle at `plotW/2`, path present, table row matches |
| Long category labels | Renders; label width vs band measured (159px vs 115px band) — density documented below; no clipping after D3 |
| Large values (1,250,000) | PASS — scale normalizes; max bar = full plot height |
| Zero values | Renders as clamped 1px baseline nub; data table keeps the true `0` — documented limitation |
| Negative values (−400) | **Clamped to a 1px baseline nub — existing geometry limitation, documented and escalated (see Chart findings)**; data table keeps the true value |
| Narrow widths (320) | PASS — viewBox scaling keeps everything inside the figure; no document overflow (labels scale down proportionally; the data table carries exact values) |
| Many points (12) | PASS — 12 circles; adjacent-label overlap measured (2 touches at desktop) — density documented below; no clipping after D3 |

**Accessible alternative (after D1 fix):** figure = named group; SVG = named image (`role="img"` + declared summary — compiler-required non-empty, so the name is always meaningful); "Data table" `<details>` exposes label/value pairs; table headers equal the declared `xField`/`yField`; table rows correspond 1:1 with rendered bars/points (verified programmatically in harness, reference app, and both packed consumers).

**Chart findings (documented, NOT fixed — would redefine chart semantics, escalated per policy):**
1. **Negative values clamp to baseline.** `maxValue = max(1, …)` and `Math.max(0, v/max)` mean negative values render as zero-height nubs and never extend below the axis. The application contract CAN supply negatives (numeric fields pass through `chartPoints`), so real data can hit this. A faithful rendering needs a sign-aware baseline/axis minimum — a chart-semantics decision for the owner/Codex, not a local fix. The accessible data table already exposes true values, so no data is hidden from AT users.
2. **Zero values share the 1px nub** with negatives (indistinguishable glyphs; table distinguishes them). Same escalation.
3. **Y-axis tick labels are `Math.round(fraction·max)` approximations** — e.g. max=1 renders `1,1,1,0,0`; max=5 renders `5,4,3,1,0`; large maxima render long (potentially clipped) tick labels. Cosmetic; a real tick algorithm is chart-semantics work.
4. **Dense category labels** overlap slightly at 12 points (2 adjacent touches at desktop) and scale down at 320px. Standard density tradeoff; the data table carries exact values.

No charting dependency was added.

## 8. Conversation (§6) — high-priority behavioral check

Harness (four panels: ok / empty-feed / denied / throwing boundaries) and the SHIPPED reference app (real SQLite, real Vict capability run producing the assistant reply, network-level `/api/act` observation, request-interception hold for the race):

| Check | Harness | Refapp (real runtime) |
| --- | --- | --- |
| Initial messages render (author · participant meta, user/assistant classes) | PASS | PASS |
| Empty state | PASS | PASS ("No messages yet — say hello! …") |
| Whitespace-only send blocked (disabled button + submit does nothing) | PASS | PASS (0 network posts) |
| Text trimmed before dispatch | PASS (`"  Hello browser QA  "` → `"Hello browser QA"`) | PASS (payload observed on the wire) |
| Send disabled while in flight (`disabled` + `aria-busy` + "Sending…") | PASS | PASS |
| Rapid multi-submit dispatches exactly once | PASS (double) | PASS (triple, network evidence: 1 POST) |
| Success clears the draft | PASS | PASS |
| Success invalidates/refetches; new message appears | PASS | PASS — user message AND real Vict-run assistant reply both appear |
| Denied send keeps the draft; declared denial surfaces (`role=alert`) | PASS (DATA_UNAUTHORIZED → denied-state) | n/a (deployment grants messages.write; denial path proven in harness and by the P3 dialog denial) |
| Thrown dispatcher failure keeps the draft; SAFE renderer failure surfaces; raw error never in DOM | PASS (`PRIVATE-CANARY-QA4` absent from page HTML) | PASS (contract rejection of a 2001-char send → validation-state, draft byte-identical) |
| Composer focus preserved/restored | PASS (button-click and keyboard paths) | PASS |
| Typing continues correctly after refetch | PASS | PASS |
| **Race: draft edited during in-flight send** — cleared ONLY when current trimmed draft == sent text | PASS — (a) edited-during-flight draft survives success; (b) trimmed-equal edit IS cleared; (c) cleared-then-retyped drafts behave | PASS — draft edited during a held REAL POST survives the success; the message still lands after release |
| Mobile 320/380 | PASS (panel fits, composer on one row) | PASS (320 + 380 screenshots) |
| Long messages + unbroken strings wrap safely; feed stays a usable contained scroll region | PASS (feed scrolls, page never overflows) | PASS (long message sent and refetched, wraps inside panel) |
| Keyboard scrollability of the feed | PASS (after D2 fix; axe clean) | PASS |

## 9. Custom component slot (§7)

- Resolvable custom component renders through the slot; props reach it UNCHANGED (string/number/boolean asserted via rendered data attributes: `workspace health island` / `7` / `true`), in the harness, at 320px, inside a dialog overlay, and in both packed consumers (consumer-side island implementation).
- Unresolved component produces SAFE feedback: mounting a host whose registry lacks the declared component renders the structured failure panel (`role=alert`, "Component 'cmp.ghost' is not registered.") — screenshot captured; never a crash, never a raw error.
- Registry authority remains in `renderer-svelte`: `Surface.svelte` calls `registry.resolve` (from `@victframework/application/renderer`); `ui-svelte/ComponentSlot.svelte` imports nothing registry-related (it renders a snippet inside a styled div).
- Custom component layout does not break the surrounding shell at mobile widths (320px island in dialog: fits the dialog panel, document overflow zero).

## 10. Cross-role nesting (§8)

Exercised through the existing recursion path in real Chrome:

- detail inside tabs (record + empty state both) — PASS
- list + read-only view + empty states inside a dialog overlay — PASS
- chart (empty) inside a dialog — PASS
- conversation inside a drawer (sends through the boundary, refetches) + empty list in the same drawer — PASS
- custom component inside dialog and drawer — PASS
- nested dialog inside drawer (P3 path) still functions — PASS (P3 regression suite 62/62 re-verified)
- Recursive surface interpretation confirmed working for every P4 role in overlay and tab content.

## 11. Ownership audit (§9)

Inspected `renderer-svelte` after P4:

- Remaining files are exactly the expected adapter/controller set: `Surface.svelte` (recursive interpretation), `TableAdapter.svelte`, `FormSurface.svelte`, `OverlaySurface.svelte`, `VitApp.svelte`, `mount.svelte.ts`, `logic.ts` (route/action/theme normalization), `presentation.ts` (data→display normalization), `index.ts`, `svelte-shims.d.ts`, `theme.css`.
- **No second production implementation of migrated P4 presentation remains:** zero `<style>` blocks and zero `style=` attributes (except the theme-variable injection) across renderer `.svelte` files; the only renderer class names are shell markers (`vict-app`, `vict-host`, `vict-region`, `vict-states-marker`). `ChartSurface.svelte` and `ConversationSurface.svelte` are deleted.
- `theme.css` is now ONLY the compatibility stylesheet entry point: one comment + `@import '@victframework/ui-svelte/styles.css'` (verified in the repo and inside the packed+installed package). The legacy `.vict-card`/`.vict-table`/conversation/chart rules were removed and are referenced nowhere in the repository.
- No P5 retirement work was started.

## 12. Packed consumer proof (§10)

- Packed from the QA worktree (including QA fixes): `contracts`, `sdk`, `application`, `ui`, `ui-svelte`, `renderer-svelte` — all 0.3.1 (tarballs committed under `qa-artifacts/qa4/packed/` for reproduction).
- Two consumers created in a FRESH temp dir OUTSIDE the repository (no workspace resolution possible): `consumer-compat` (imports `@victframework/renderer-svelte/theme.css`) and `consumer-direct` (imports `@victframework/ui-svelte/styles.css`). Identical app: generic `VitApp` + the compiled P4 harness plan (real SDK compiler; every P4 role) + consumer-side in-memory boundary + consumer-side island registered through the component registry.
- Per variant: `npm install` from the tarballs — installed versions exactly 0.3.1; lockfile contains no monorepo leakage; installed `theme.css` is only the compatibility entry; `vite build` succeeds; emitted CSS (17,319 bytes, identical file hash both variants) contains ALL migrated P4 markers (`.vict-text`, `.vict-data-view`, `.vict-list-item`, `.vict-detail dd`, `.vict-figure`, `.vict-chart`, `.vict-conversation`, containment + wrap fixes) and each per-component signature is defined EXACTLY ONCE (no duplicate style implementation).
- Real-browser runtime (Chrome, built `vite preview`) — **40/40 consumer checks across both variants**: host mounts; heading tags + escaped text; DataView region/table/correspondence; list/detail/empty states; bar (5 bars, table correspondence), line (6 circles + path), empty chart; QA a11y fix present in the packed bundle (svg `role=img`, figure group); conversation send → trimmed dispatch → refetch → cleared draft; consumer-side island receives unchanged props; route changes AND data updates propagate WITHOUT remounting (same tagged host node across navigations); DataView @320 contained scroll with zero document overflow.
- **SSR/client builds succeed:** client via vite (both consumers) and SSR via the built reference application (SvelteKit adapter-node): the server-rendered HTML contains the chart figure + named SVG + gridlines, and the conversation feed region + input + Send button BEFORE hydration.
- Screenshots per variant: `c-widgets`, `c-widgets-320`, `c-charts`, `c-chart-many`, `c-slot` (compat + direct).

## 13. Screenshots (committed under `qa-artifacts/qa4/`)

- `shots-harness/` (25): headings 320; dataview 1280/430/380/320 initial + scrolled; list desktop/320; detail desktop/320; charts desktop top/bottom + 320; conversation desktop messages/sending/failure + 320; slot desktop + unresolved feedback + overlay 320; nesting drawer 1280 + empty-detail 380. All visually inspected — including the scrolled dataview states (not just "no overflow" assertions).
- `shots-refapp/` (8): conversation empty/messages/rejected/320/380; dashboard chart on real seeded data; drawer island; detail 320.
- `shots-consumer-compat/` + `shots-consumer-direct/` (5 each): widgets, widgets 320, charts, many-point chart, slot.
- Accessibility: axe-core scans (Vict host scope) on `/headings`, `/widgets`, `/charts`, `/conversation` (with messages), `/slots`, `/rec` (after drawer interaction) at desktop and phone widths — **zero violations** after D1/D2.

## 14. Warnings / remaining limitations

1. **Chart geometry limitations (escalated, not fixed):** negative/zero values clamp to baseline nubs; approximate y-tick labels; dense-label overlap at 12+ points. Faithful negative-value rendering and a real tick algorithm require chart-semantics decisions (contract/geometry) — owner/Codex conversation, per the fix policy. The accessible data table always carries true values.
2. **Reference-app suite cold self-build:** `npx vite build` invoked directly by `browser.test.ts` (without the package script's `svelte-kit sync`) produces a server that exits 1 on a fully cold tree in this Windows environment; green whenever `.svelte-kit/` exists (standard flow). Pre-existing tooling nuance, identical on the pristine P4 SHA.
3. `scripts/test/trusted-publishing.test.mjs` fails 2/55 assertions on this branch (release inventory frozen at 13 packages while the P4 line carries 15) — the known release-set 13→15 governance work, deliberately kept separate; the QA diff provably touches no inventory input (no scripts, no package.json changes).
4. Multiple same-titled conversation regions on one screen are distinct via the app-declared composer label; an app declaring two conversations with IDENTICAL `inputLabel`s would reintroduce a moderate duplicate-landmark name. A per-conversation display name would be a neutral-contract expansion (owner decision, noted for Codex).
5. The reference app's global action feedback ("Done." / denied / failed) persists across client-side route changes (pre-existing VitApp design, re-confirmed here on P4 screens). Unchanged by P4; noted for completeness.
6. Windows-only tooling note: npm is invoked through its JS CLI entry (`npm-cli.js`) by the drivers, since `npm.cmd` fails with "stdout is not a tty" when spawned with redirected output.

## 15. Drivers (reproducible, committed)

- `qa-harness.mjs` — **76/76** checks against `harness/` (vite dev, port 5201; plan compiled by `harness/scripts/emit-plan.mts` through the real SDK compiler; `harness/src/Harness.svelte` in-memory boundary with driver-controlled send timing). Results: `harness-results.json`.
- `qa-refapp.mjs` — **18/18** checks against the BUILT reference application (fresh SQLite per run, network-level dispatch observation, request-interception hold for the race). Results: `refapp-results.json`.
- `qa-consumer.mjs` — **40/40** checks (pack → clean temp install → build → CSS inspection → preview → real browser × 2 variants) + 3 SSR checks. Results: `consumer-results.json`.

## 16. Verdict

**P4 ready for architectural closure.** All P4-migrated presentation (text/headings, read-only DataView, list, detail, chart bar+line, conversation, custom component slot) is verified in real browsers against the compiled-plan harness, the shipped reference application (real runtime + real Vict runs), and two packed 0.3.1 consumers (both styling paths) — with zero axe violations on the changed roles. The three QA fixes are bounded presentation/accessibility corrections that do not touch `vict.application@2`, application/action/data authority, the neutral UI contract, chart semantics (escalated items documented instead), custom-component registry semantics, or recursive application traversal. Nothing here requires a Codex foundation correction. Release-set 13→15 work, merge, and publication remain untouched.
