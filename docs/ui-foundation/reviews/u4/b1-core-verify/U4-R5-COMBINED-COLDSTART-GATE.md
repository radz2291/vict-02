# U4 ROUND-5 — INDEPENDENT COMBINED GATE: FRESH UNFAMILIAR-AGENT COLD START

- Candidate: commit `fe800369968489390428d3be7808b0799f9d944d` (branch `codex/ui-foundation-u4-combined-verify-05`)
- Reviewer: cold-start consumer agent, round 5, review-only (no code changes; this report is the only repo file written)
- Date: 2026-10-13
- Consumer "world": isolated packed copy at `C:\Users\RZ1\Desktop\RZ\u5-coldstart\u4-consumer` (outside all repo worktrees), produced by the README's documented pack step

## Verdict: **PASS, with friction** (5/7 steps clean PASS; 2 steps PASS with recorded friction that does not block the gate)

---

## Steps taken and per-step verdict

### Step 1 — COPY examples/u4-consumer outside the repo — PASS (with friction F-A)

Friction **F-A (README gap)**: the copied `examples/u4-consumer` directory contains **no `vendor/` tarballs** and cannot `npm install` on its own. The task brief assumed the copy is installable; the README's actual clean-install path starts one level earlier:

> "# from the repository root — packs the closure, isolates, verifies:
> node scripts/pack-u4-consumer.mjs"

I followed the copied README exactly and ran the packer from the candidate repo root. This is honest cold-start friction: a consumer given only `examples/u4-consumer` cannot begin without reading repo-level context. The README documents this path, so it is a **documentation-expectation gap, not a product defect**.

Packer friction **F-B (environment)**: the default isolated root `C:\Users\RZ1\Desktop\RZ\u4-consumer-isolated` was EBUSY-locked (leftover from a previous round), so the documented default command failed with `EBUSY: rmdir ...\u4-consumer-isolated\u4-consumer`. The packer honors `U4_ISOLATED_ROOT`; I redirected to a fresh dir.

Packer defect **F-C (real script bug, non-blocking)**: setting `U4_ISOLATED_ROOT` with **forward slashes** (`C:/Users/...`) makes isolation verification always report false "workspace link" violations and exit 1, because the env value is used verbatim in `real.startsWith(isolatedRoot)` (`scripts/pack-u4-consumer.mjs:24` does not `path.resolve` the env value). Passing a backslash path works. This bit me three times before diagnosis. Filed here as a finding for the owner; it does not affect the default documented invocation.

Final pack run (backslash root): `ISOLATED PACKED-ARTIFACT VERIFICATION: OK`, 10 tarballs, 5 built assets, 16/16 tests, zero isolation violations, tarball SHA-256 manifest recorded in `pack-manifest.json`.

### Step 2 — npm install from vendor tarballs + build — PASS

98 packages installed in the isolated copy resolving `@victframework/*` from `vendor/*.tgz` (`file:` deps), never workspace links. `vite build` succeeded: both entries emitted (`dist/index.html`, `dist/app.html`, 5 assets). Build leakage check (repo source paths in bundles) passed inside the packer.

### Step 3 — Both entries open — PASS

`vite --port 5199` (dev, per README's documented `npm run dev`):
- `http://localhost:5199/` → HTTP 200, title `u4-consumer · authoring`, loads `/src/authoring/main.ts` (EditorCanvas/Inspector stack).
- `http://localhost:5199/app.html` → HTTP 200, title `u4-consumer · finished app`, loads `/src/app/main.ts` (DocumentHost replay; no authoring imports).
The packer additionally proved the production build contains both entries.

Caveat recorded honestly: this environment has no browser automation; entry verification is HTTP/served-module level, and the interactive clicks of step 4 were exercised programmatically (below), not with a mouse.

### Step 4 — Author → Undo → Redo → Save → Reload stored → find in finished app — PASS (programmatically)

No browser available, so I reproduced the Inspector's exact edit path in a scratch test (`test/coldstart-u5-scratch.test.ts`, written only in my isolated copy) using the same `EditorBridge` + `setTextLiteral` command the Inspector's "Apply text" button dispatches (`node_modules/@victframework/ui-editor/src/Inspector.svelte:287`):

1. Target selection identical to the Inspector: text node behind the `heading` element of `consumer.taskControls` (`content: {type:'literal', value:'Task review'}`).
2. Apply `setTextLiteral` → document contains `COLDSTART EDIT` ✔
3. `bridge.undo()` → edit gone ✔
4. `bridge.redo()` → edit restored ✔
5. `bridge.save()` → ok; `localStorage['u4-consumer.controls']` contains the edit ✔
6. `bridge.reopen()` ("Reload stored") → stored revision reopens with the edit ✔
7. Finished-app replay path: a second `createLocalStorageDocumentStore` on the same key `u4-consumer.controls` (mirroring `src/app/FinishedApp.svelte:15`) `rawLoad()`s status `loaded` with the saved edit present ✔

Result: `Tests 2 passed (2)`. The §6 loop holds end to end through the packed artifacts.

### Step 5 — Programmatic catalog consumption — PASS

Documented shape verified from a scratch import in the copy:

```ts
import { Button } from '@victframework/ui-svelte/catalog/button';
```

`typeof Button.Root === 'function'` and `typeof Button !== 'function'` (same for `Checkbox.Root`). README requirement 3 is **accurate**: families export bits-ui namespaces; there is no flat `<Button>`.

### Step 6 — npm test (contract suite) — PASS

Full suite in the isolated copy: **2 files, 18 tests, 18 passed** (16 contract tests + my 2 scratch tests). Covers compile of both seeded documents, negative fixtures R1–R7, amendment negatives, primitive compatibility, shell composition.

### Step 7 — Server cleanup — PASS

Dev server on port 5199 stopped and confirmed unreachable.

---

## README grading

Five documented "public requirements" (README section "Consuming the packed packages — public requirements"):

| # | Requirement | Present | Accurate | Sufficient | Note |
|---|---|---|---|---|---|
| 1 | Svelte-capable bundler required (sources shipped) | ✔ | ✔ | ✔ | Vite + vite-plugin-svelte worked |
| 2 | Exclude `@victframework/*` from optimizeDeps | ✔ | ✔ | ✔ | `vite.config.ts` list correct |
| 3 | Catalog namespace exports (`Button.Root`, no flat `<Button>`) | ✔ | ✔ | ✔ | Verified by import |
| 4 | `ControlScope` + `catalog.css` per entry | ✔ | ✔ (documented; not independently negative-tested this round) | ✔ | Both entries import them |
| 5 | Repo-root `npm run build` before packing | ✔ | ✔ | ✔ | Round-5 fix F14 held: no manual pre-build needed |

**Gaps / stale statements found (exact quotes):**

1. **G-A — README does not say the example copy alone is not installable.** Nothing in the README warns that `examples/u4-consumer` ships without `vendor/`; a consumer handed only the copy hits `npm install` failure before reaching the pack step. Quote of the only relevant text: "# from the repository root — packs the closure, isolates, verifies: node scripts/pack-u4-consumer.mjs" — accurate but assumes repo context the "clean consumer" framing disclaims.
2. **G-B — Default isolated root collision not documented.** The packer hard-deletes its default output `../u4-consumer-isolated` (`rmSync`) and fails hard (`EBUSY`) if any prior run's files are locked; the `U4_ISOLATED_ROOT` override is not mentioned anywhere in the README.
3. **G-C — `U4_ISOLATED_ROOT` forward-slash bug (script, not README).** `const isolatedRoot = process.env.U4_ISOLATED_ROOT ?? path.resolve(...)` uses the env value un-normalized; isolation verification then compares backslash realpaths against a forward-slash prefix and always fails. Recommend `path.resolve(process.env.U4_ISOLATED_ROOT)` and a README note.
4. No stale statements found: the round-1 FAIL status text was removed as claimed; the Status section correctly names this candidate and track.

**README overall: 4.5/5** — all five requirements present, accurate, sufficient; the gaps are operational (pack-path assumptions, isolation-root ergonomics) rather than product-truth errors.

## Findings summary for the owner

- **F-C (minor, code):** `U4_ISOLATED_ROOT` not path-resolved → false isolation violations with POSIX-style paths (`scripts/pack-u4-consumer.mjs:23-24`, check at ~line 111).
- **G-A (docs):** add one sentence to the README: the example copy alone has no `vendor/`; the pack step is mandatory and is the only documented entry.
- **G-B (docs):** document `U4_ISOLATED_ROOT` and the hard-delete of the default isolated root.
- No blocker-level findings. Nothing observed contradicts the §6 catalog proof or the isolation guarantees.
