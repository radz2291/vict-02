# VICT — Stage 8 Closure Follow-Up Register (2026-09-29)

> **Document type:** the dated register of follow-up items scheduled by
> the Stage 8 owner closure
> (`docs/governance/VICT-STAGE-08-G4-CLOSURE-2026-09-29.md`, v0.4.33,
> reference §0.39). Items are scheduled, NOT authorized for immediate
> execution: each requires its own owner planning/gating decision in the
> track that picks it up (formal UI track, platform track, or
> tooling/release-test hygiene). Amendments are made by new dated
> records appended below; filed items are never edited in place.

## Formal UI / platform track (from owner dispositions D-6 and D-7)

| ID | Item | Source | Scope note |
| --- | --- | --- | --- |
| FT-1 | **Definition-driven table-cell link** — add `columns[].link { routeId, paramField, label? }` OR `rowNavigation { routeId, paramField }` to the table surface grammar (F6 reconciliation §6 options A/B), so a row-scoped link to a record-edit route is expressible definition-only; then drop the `cmp.task-edit-link@1` island from this application class. | D-6 owner disposition (2026-09-29); F6 reconciliation §5–§6; G4 audit §5.1 | Auditor-verified impossibility on the shipped `0.4.0-rc.1` interfaces (columns = text-or-island; `rowAction` dispatch-only; `UiShellLink` menu-level only). Requires a platform release; separately gated. |
| FT-2 | **Chart windowing** — add a windowing field (e.g. last-N-days) to the built-in `role:'chart'` surface so the TaskLedger brief's "last 14 days" qualifier is expressible; pair with the **legacy pre-`count` event-row backfill decision** (production migration; currently aggregates as zero buckets). | D-7 owner disposition (2026-09-29); G4 audit §5.3 | Until landed, the TaskLedger brief remains **not fully satisfied** on the 14-day-windowing point; do not describe it as met. |

## Tooling / release-test hygiene (from G4 findings F-A, F-B)

| ID | Item | Source | Scope note |
| --- | --- | --- | --- |
| FT-3 | **Ladder-ordering / fresh-worktree precondition** — document (or reorder) that the repository verification ladder's `npm test` requires built workspace `dist/` outputs; a fresh worktree ladders red in child-process/spawn suites (G4 run A; same class G2 host-b disclosed and superseded in its own run 1). | G4 audit §3.1 run A, finding F-A | Tooling hygiene; no behavior change asserted. |
| FT-4 | **`scripts/test/release-authority.test.mjs` timeout hygiene** — three tests default-timeout at 5000 ms under full-suite load on Windows (pass 65/65 in isolation with a 60 s bound); the "evidence can neither FORGE nor DENY registry presence" test performs a LIVE registry probe whose verdict is load-sensitive (flipped once under load; same fail-closed family as the release workflow's timed-out read-only verify). Raise/parameterize the bounds or isolate the probe. | G4 audit §3.1, finding F-B | Release-test hygiene only; no Stage 8 or product code. |

## Platform track (from G4 finding F-D)

| ID | Item | Source | Scope note |
| --- | --- | --- | --- |
| FT-5 | **Builder-forwarded platform observations** — (a) generated `application-server.ts` carries 2 pre-existing `tsc --noEmit` strict errors no toolchain checks; (b) `appdata-sqlite` accepts only create/update/delete verbs while `ResourceDefinition` advertises declared domain verbs (forced the exact two-field `update` shape); (c) the host double-validates contract output (contracts must be idempotent over their own output — undocumented); (d) SDK `CapabilityDefinition.description` is rejected by the runtime's closed registry schema. | G4 audit §6 F-D; builder RESULT §7; fresh-proof record §6 | Honest forwardings, recorded verbatim by the builder; no silent workaround was applied. |

## Observations (recorded; no action scheduled)

| ID | Item | Source |
| --- | --- | --- |
| OBS-1 | **F-C** — one G4 full-suite run exited 1 via a vitest worker teardown crash ("Worker forks emitted error … Worker exited unexpectedly") **after** all 2733 tests had passed. Recorded as the observed worker-teardown/environment event; no code defect; no action scheduled. | G4 audit §3.1 rerun C, finding F-C |
| OBS-2 | `/favicon.ico` 404 in the TaskLedger app (cosmetic; rejected finding F-E). | G4 audit §6 F-E |
| OBS-3 | BLD-001 qualification: Claude Code and human builder-host paths were not exercised in Stage 8 (Pi and Codex were). No onboarding work scheduled; recorded so future host adoption starts from an honest baseline. | Closure record §3 |

## Status

All items: **SCHEDULED — not started.** No item is authorized to begin
automatically by the Stage 8 closure; each track's next increment picks
items up under its own owner decision.

*Filed 2026-09-29 by the owner closure. Amendments: append new dated
records below.*
