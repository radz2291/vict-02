# Node-suite stress: owner-directed artificial-limit removal

31October2026. **Implementation in progress; not a verified or activated candidate.**
The preceding foundation readiness remains evidence of its exact earlier scope.

## Owner authority and architectural decision

During actual Campaign Foundry authoring the owner saw “Unavailable: the tool evidence budget was reached” and requested removing that artificial limit and inspecting similar limits: “We dont need that.” The owner then clarified that Mastra/VICT packages should own protections and Studio should be thin.

This authorizes removing arbitrary local task/evidence/content ceilings rather than replacing them with larger numbers. Shared behavior belongs in public VICT packages and their Mastra adapter; Studio selects the public policy, connects its authenticated session/source host, and displays lossless evidence. No alternate runtime, provider, storage authority or private Flow control adapter is introduced.

The local branch remains `codex/node-suite-stress-20261031`, from clean04339fa74c529dfe77c8f5c167a2dbd1aa388f3b. Product8d8 remains serving until a new candidate is built, independently checked and safely activated. The partial actual app is saved r1.r1 and exported under stress evidence before any product change. Original apps/drafts/builds are preserved. Local authority does not permit push, publication, main merge, milestone acceptance or Stage9 closure.

## Findings and intended disposition

| Area | Finding | Owner-directed change |
| --- | --- | --- |
| Inline tool evidence | 8000bytes per preview;160000bytes cumulative run budget discards later display payloads | Keep a compact display window only when the complete sanitized exchange is accessible; remove cumulative evidence loss. |
| Original exchange archive | 256k sanitized payload,4MB/run,32MB/global,512entries,30minute expiry; shape/string/depth truncation | Complete sanitized originals, nonexpiring during the service lifecycle, paged authenticated access and disk storage instead of unbounded RAM. No quota eviction. Actual I/O failure remains truthful. |
| Conversation retention | 24turn/30minute detail retention,256references,64page cache,100progress entries,12history messages/6k each; shared helper defaults240events | Preserve complete current-session transcript/details and originals; remove implicit compaction/expiry. Explicit consumer-chosen presentation windows remain opt-in. |
| Request/stream | 6k prompt,1.2MB request,2MB cumulative stream,300kframe and launcher2MB HTTP request | Remove task cutoffs; use actual upstream transport disabling mode and streaming backpressure, without dropping complete frames or growing an eager queue. |
| Agent lifecycle | Studio64steps/tools, fixed30minute/3minute deadlines; provider output caps | Explicit public versioned completion-or-cancel policy; real pinned Mastra stop conditions and abort, no hidden five-step fallback. Legacy explicitly bounded profiles retain exact old semantics. Actual provider limits still apply and are reported. |
| Studio authoring | 200k source/500source nodes,40operations/graph changes,4k scalar text and other arbitrary composition counts | Remove duplicate host quotas across admission, edits, preflight, reads, schemas and import; strict typed atomic source operations remain authoritative. |
| Public Flow | 1Mgraph/clipboard text,1000nodes/4000edges/128families/ports/parameters,50operations,128receipt/history eviction | Remove arbitrary collection/content/task ceilings consistently in schemas and implementations. Preserve receipt IDs/dedup for host lifetime rather than permit replay after eviction. |
| Lossless reads | 200k total offset ceilings and large-singleton contract bundle dead ends | Read to actual EOF with exact identity/digest/projection and continuation; page sizes are delivery chunks, not total-content ceilings. |
| Delivery/source traversal | Duplicate depth/node/string/array counters refuse valid larger structures | Complete iterative/cycle-aware traversal in shared packages; reject actual unsafe/nonserializable structures before durable completion. No partial result is relabeled complete. |

## Boundaries that are not artificial task quotas

Authorization/session/CSRF, exact source revision/digest/occurrence ownership, stale/draft protection, operation atomicity, real type/operator/identifier grammar, user-authored port capacity and cycle policy, command identity deduplication, secret redaction and no getter/thenable/replay-marker execution remain. These implement meaning or authority, rather than rationing a legitimate app's size or duration. Studio must consume these package/host contracts rather than recreate them.

Physical memory, disk availability, actual JavaScript/HTTP/provider encoding/context limits cannot be promised away. Failures there must be reported honestly, not hidden by truncation or claimed as successful completion. Compact preview/page windows are acceptable only with a complete retrievable original/continuation and no total cutoff.

## Verification and continuation

### Resumed independent challenge

After the owner resolved the agent service usage restriction, independent review resumed against exact `41c7b4129ee0c72a80cb7ec29f4a10c4489eef07`. The reviewer independently installed dependencies, built the workspace and passed204 focused checks. It retained one failing concurrent-publication test: the shared runtime hub can invoke an asynchronous subscriber again before its preceding delivery settles. Studio currently serializes its own publication chain; that does not excuse the public package defect. A separate isolated repair is in progress. Review report commit: `84833648e728582bf6e9a0b36aece9d3204a54f2`; integrated verdict remains held.

The remaining capture audit found default512KiB/1600×1200 image ceilings, a2000-descendant scroll-capture refusal, resource-size ceilings and fixed capture/model deadlines. A separate isolated candidate is removing these arbitrary defaults, preserving actual visible-viewport geometry, source/owner freshness, image/resource validation and owner cancellation. Studio must pass the public capture signal and transport metadata without imposing a second quota. This candidate is not yet integrated, activated or verified.

Existing public hub replay/pending-buffer policies are different: they explicitly disclose lost transient replay or detach a saturated subscriber for authoritative recovery. These package-owned transport protections do not terminate a legitimate agent task or delete the complete sanitized tool archive. They remain in place while asynchronous delivery ordering is repaired.

Root workspace build and Studio TypeScript checks also passed at41c7. The old8d8 Studio is still serving. Browser control recovered using the documented controller reset; no PC restart was needed. On recovery, Campaign Foundry contained newer unsaved canvas positions. Its exact source was preserved before normal Save created **r1.r2**, followed by a supported export and screenshot (`10-recovered-*`). Continue that newer checkpoint, not the earlier r1.r1 export.

### Follow-up repairs and remaining integration

The first hub serialization repair (`2ba96b7e804fd2cdea4ac12ec8d76193fe6a851d`, integrated asd3133d38) independently passed45 runtime/SSE cases and3 pinned-adapter checks. Further independent challenge retained a separate replay-registration race delivering `[2,1,2]`; see verifier commit `3f1e09386a9bbd05383039512f7ae81cf1c96ca7` and `INDEPENDENT-2BA.md`. The preceding assumption that the existing pending bound was always recoverable also needed qualification: a fast reader with more than4096 historical events could overflow before receiving any cursor progress. This was an artificial effective replay ceiling, despite the intended transport policy.

The shared runtime successor `10fdf9d6383c3e6cd5d660f9f01eee573163e50d` (integrated as4f2060a1) streams historical pages before an ordered, deduplicated live handoff. The slow-subscriber queue remains an explicit package-owned recovery mechanism. Builder checks pass53 unique runtime/SSE cases and16 Mastra cases; independent successor review is still required. Failures and the initial recovery-policy assumption remain recorded rather than retroactively called passes.

Capture candidate `ba90c46b8c5fcbde606fb47b5d1dfa4c8f912990` is integrated asd830c7f0. Its94 focused checks and typechecks passed; its independent review is in progress. Complete selections/diagnostics and a genuine diagnostic failure acknowledgement are being repaired in a separate isolated candidate. That follow-up also removes the public UI's100-class/256-character editing quotas: these were explicitly resource bounds and contradicted already-unbounded source admission, rather than implement HTML token grammar. Nonempty tokens without ASCII whitespace or NUL remain required.

A fresh seven-package installed public-consumer proof passed from41c7 (`vict-realignment-consumer-pspM2d.json`). It predates the subsequent class-helper changes and does not include the changed UI-AI capture export. Final production/artifact verification must qualify the exact successor; this earlier proof is not silently relabeled as that result.

The runtime successor independently passed all three retained defect probes,62 runtime/SSE cases and3 pinned-Mastra cases at exact4f2060a1; installed public capture server-bundle qualification also passed. Review commit `ee5b68806fcda058471720067c65d97b57fa1798` and `INDEPENDENT-4F2060.md` retain scope and limitations. Complete selection/diagnostic/class candidate `98567f24037251ce1f6a636147131d88c9cc24bc` is now integrated ase0c042d2, with final protocol read10/edit9/start6/agent profile18/observer profile12 coordinated separately. Its28-test builder proof explicitly aliases local UI source; root must rebuild and verify actual installed artifacts. Production activation and actual Campaign continuation are still pending.

Use meaningful tests beyond previous thresholds plus negative ownership/type/security/cancellation checks and legacy identity compatibility. The shared Mastra delivery snapshot has already passed51focused tests across existing hostile-value/proto cases and new large/deep default delivery; this is a builder check, not independent approval. Do not sum overlapping suites.

After integrated independent verification, build/seal the exact candidate, preserve the existing389-file Studio build/proof inventory and all saved apps/drafts, activate through the established local path, then continue the SAME actual Campaign Foundry from its saved partial source. Verify full late-call evidence remains accessible and complete the complex app/native/save/portable stress task. Retain the original refusals, unavailable evidence and timing observations. No owner acceptance is inferred.
