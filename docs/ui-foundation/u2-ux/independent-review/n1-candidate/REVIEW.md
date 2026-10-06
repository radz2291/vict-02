# Independent N1 follow-up — retained failed candidate

Tested exact pushed code: **e5931cf30fd2c2cdb0d03a017d77c46b0f35ba31**, branch `codex/ui-foundation-u2-inspector-ux`. Detached independent checkout; source unchanged. Verdict: **FAIL**, bounded repair/recheck required. This does not accept the compiler gate or close U2.

## Findings

**M4 — live pseudo-state measurements remain stale (medium).** In the independently mounted real Canvas, select exact repeated row `review|row|a`, Style, Text size details. With the plain exact-occurrence hook, normal actual/annotation are17px. Native hover changes actual to41px while Browser now/input remain17. Focus actual51, annotation17; held native mouse actual71, annotation17. After click selection refresh and leaving/blurring, actual17 while annotation51. Editing pseudo destination is a different transition and cannot demonstrate this behavior. `live-pseudo.json`, `live-active.png`, and independently authored `Host.svelte`/`live-pseudo.mjs` preserve the reproduction. Candidate listens only to resize and reactive prop/edit destination changes. This violates the current Browser now claim for ordinary live states.

**L2 — visible Reset text exceeds its button (low).** Every ordinary Reset remains29px outer width/27px client width versus35px text scroll width at390,1024,1440. Text protrudes to the right; visible in `reset-390.png` and real-host `host-390.png`. Accessible property labels and native Reset operation work, but the new visible label requires adequate intrinsic width.

## Demonstrated passes

Independent historical negative control at83ba87 reproduces actual61px versus stale46px annotation. Original copy identity is verified after reversing only two import paths/newline normalization (`original-identity.txt`). Inspector is mounted before Canvas; hook performs no post-tick or host refresh workaround. Correct61px input is in `journeys.json`; invalid unitless61 first attempt is retained in `harness-unitless-original.json`, not counted as product evidence. Earlier missing repeat field catalog fixture error remains `failed.json`; corrected only the independent fixture.

Candidate passes native edit61/Undo46/Redo61; Reset reveals applicable attached32/Undo61/Redo32. Drafts prove existing `setStyleDeclaration` value omission, with unrelated declarations and attached source retained. Conditional edit29/Reset32/Undo29 uses existing `setConditionalStyle` value omission, retains original attached `titleNarrow`. Editing condition/pseudo destination changes and replacement callback are refreshed. Exact selected repeated rows report17px and31px independently. Component root occurrence `review|card|cardA@service` remains pink through shared blue edits; instance Reset reveals retained attached `instanceSeed` rgb187,221,204; Undo restores pink. CardB measures its own blue root. Save/full reload/reopen preserve edits and exact occurrence measurement. `journeys.json` contains28 observations and no browser exceptions.

Real review consumer at1440x900,1024x768,390x844 and390 preview container shows correct46→32→46 responsive measurements, authored46 separated from actual32. No horizontal viewport overflow; mobile Text size is within the first screen (y599–629 with details open). `host-spotcheck.json` and selected screenshots preserve measurements. This consumer supplies ResizeObserver/domVersion invalidation; arbitrary external/container changes with a nonreactive plain callback remain a documented host responsibility, not independently claimed supported by the reusable Inspector alone.

## Checks and limits

Independently performed exact e593: renderer123/123, affected Inspector4/4, root TypeScript, design TypeScript, design12/12, production build PASS. Broad design Svelte check remains RED; supported check config reports23errors/4warnings in4 unchanged files and is separately logged. The alternative generated SvelteKit config produced21errors/4warnings in3 unchanged files. Accidental root-wide Svelte scan was stopped after scanning unrelated workspace configs and is not a gate result. No new module errors appeared in the completed design scan; candidate build retains existing accessibility warnings. Checks are distinct from builder claims.

Prior ROUND-1, ROUND-2 and iteration2 reports remain preserved; their complete six-improvement suite is historical lineage, not a fresh exhaustive retest here. Current bounded review exercised Reset, source/history, exact selection, responsive measurement and live pseudo states. No actual founder participant observation, owner acceptance or U2 closure is claimed. Next allowed action: repair M4/L2 and independently recheck exact pushed candidate, then evidence-only handoff.

