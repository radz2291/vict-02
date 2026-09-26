> Foundation owner review: from the repository root run `npm run foundation`, then open
> [Requests](http://127.0.0.1:5178/records) and [Conversation](http://127.0.0.1:5178/workspace).
> See [the checkpoint report](../../qa-artifacts/foundation-slice/README.md) and
> [component catalog](../../packages/ui-svelte/FOUNDATION-CATALOG.md).

# VICT UI Showcase — Owner Visual Acceptance App (P6D)

A runnable **product showroom + stress laboratory** for the VICT UI. Every
visible screen is authored through the normal VICT path:

**Application Definition → `@victframework/application` → `@victframework/ui` → `@victframework/ui-svelte`**

There are no handcrafted scenario pages and no showcase-specific design
system: the host adds zero product styling (the only stylesheet is the VICT
product stylesheet). The ONE custom component (`cmp.island@1`) exists
purely to prove the versioned component-registry slot.

## Launch (owner)

```bash
# from the repository root (this branch/worktree)
npm run dev --workspace ui-showcase
```

Open **http://localhost:5173** (Vite default; the terminal prints the exact
URL). All data is **deterministic** — fixed constants and formulas, fixed
timestamps — so every visit shows the same showcase. The server keeps
in-memory state; mutations persist until the process restarts.

A production-style run also works:

```bash
npm run build --workspace ui-showcase && node examples/ui-showcase/build
```

## Routes / scenarios

| Route | Scenario |
| --- | --- |
| `/` | Showcase home (links to every scenario) |
| `/ops` | **1 — Operations / CRUD** (Bahasa Malaysia product data; server-side table query, statuses, chart) |
| `/ops/tickets/new` | Create form — every widget, BM labels, server validation (try state `x`) |
| `/ops/tickets/OPS-1042` | Record detail — tabs, edit form (prefill), destructive dialog (real authorization denial), drawer |
| `/ops/tickets/OPS-1057` | Zero numeric prefill case (`0` stays `0`) |
| `/trading` | **2 — Trading workstation**: market overview (dense instruments table, volume chart, market-state badges) |
| `/trading/instruments/XAUUSD` (also `/eurusd`, `/btcusd`, or any symbol via `/trading/instruments/:symbol`) | Instrument detail — price summary, 32-point line + bar charts, signals, drawer |
| `/trading/rotation` | Rotation / breakout study — 48 signals, server query, **negative values in the bar chart (current clamp behaviour, deliberately exposed)** |
| `/agent` | **3 — AI coding agent**: sessions (statuses, big token counts) |
| `/agent/sessions/AGT-2201` | Agent workspace — real conversation (capability reply), files, approval dialog, failure demo, drawer |
| `/agent/parallel` | Parallel work — agents A/B/C in different states |
| `/quellight` | **4 — Quellight**: real BM conversation + focused world record |
| `/quellight/world` | Shared world — knowledge records, statuses, provenance drawer |
| `/quellight/world/QL-0047` | World entry detail — stale/conflict status, propose dialog, provenance |
| `/quellight/changes` | Proposed changes — pending/accepted/rejected/stale, decision dialog (demo) |
| `/workflow` | **5 — Workflow / governance**: five-stage instances |
| `/workflow/instances/WF-1042` | Instance detail — stage status, tabs, approval dialog, verification-failure demo, events |
| `/analytics` | **6 — Executive analytics**: KPIs, DataView grid, two charts, deals table, drawer |
| `/gallery` | **7 — Component gallery**: 12 tabs covering every current presentation capability |
| `/gallery/states/stale` | Stale application state (server-set) |
| `/gallery/states/partial` | Partial application state (server-set) |
| `/gallery/forms/prefilled` | Prefilled edit form demo |
| `/stress` | **8 — Stress Lab**: 30-column × 110-row table, unbroken long IDs, long BM sentences, empty strings, 12 long-named tabs, 55-message conversation, 22-field form with a very long validation message (type `tolak` in field 03), nested drawer → tabs → detail |
| `/stress/deep/l3/l4/l5` | Deep breadcrumb trail (6 levels) |
| `/stress/nav/n1` … `/stress/nav/n6` | Navigation stress group (long labels) |
| `/review` | **Owner Review** — what to inspect, section by section (scores nothing) |

Application-state demos on any data route: append `?demo=stale` or
`?demo=partial`. Validation/denied/failure/success demos: buttons in the
gallery (Feedback / App states tabs).

## Owner review brief

- **Review page**: `/review` lists the inspection areas (shell, navigation,
  typography, spacing/density, forms, tables, status language, overlays,
  charts, conversation, mobile, data-dense usage) with pointers.
- **Widths to inspect**: 1440, 1024, 768, 430, 380, 320.
- The Stress Lab and the 30-column table are intentionally uncomfortable —
  judge the current truth; nothing was softened.

## Sanity checks (this phase only)

```bash
npm run test --workspace ui-showcase   # definition/identity + DOM rendering + real-browser sanity (incl. axe smoke, overflow, screenshots)
npm run check --workspace ui-showcase  # svelte-kit sync + tsc
```

Screenshots (secondary evidence): `qa-artifacts/ui-showcase/*.png`
(captured by the browser test against the built server).