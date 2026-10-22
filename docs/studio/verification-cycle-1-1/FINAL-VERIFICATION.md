# Cycle 1.1 independent verification — PASS WITH NON-BLOCKING FINDINGS

2026-10-22. Tested product candidate:
`8be9ce86dc981ae8c284b4f354a12a3afad8fc8e` on `codex/studio-cycle-1-1`.
The pushed candidate was independently compared to the remote before checkout.
Baseline `origin/main` stayed `d7401bef6e48330796c74ec00c86db9622d48cdf`;
Cycle authority/handoff is `f2492507ef298827324d5684da2660c26d973a75`.

**Cycle 1.1 is independently verified and ready for owner review.** This verdict
does not record owner acceptance, whole-Stage 9 verification/closure, merge to
main, publication, deployment or Cycle 1.2 authorization.

## Independence and exact source

The verifier used a fresh, separate checkout at the original pushed candidate,
then switched the same isolated checkout to the exact repaired candidate above.
Final evidence branch: `codex/studio-cycle-1-1-verification-final`.
Only `docs/studio/verification-cycle-1-1/**` was authored by the verifier.
`git diff 8be9ce8 -- apps packages package-lock.json` was empty after verification.
The verifier did not repair product source or award a verdict from builder claims.

Dependencies were reused through junctions to the builder's installed dependencies
and unchanged framework outputs; this was **not an independent npm installation or
framework rebuild**. Studio source, generated production output and browser
profiles were independent. The intended Studio-local Vitest 3.2.7 was used for
the final suite. A [verifier-only config](studio-reuse.config.ts) imports the
unchanged candidate test config and allows exactly the verifier and builder roots
through Vite's filesystem guard, required by the dependency junctions. No candidate
configuration was changed. The real browser ran the verifier's adapter-node
production build on `127.0.0.1:5592`; the actual bad-provider negative used isolated
port 5593. Owner/builder origins, saved documents and servers were preserved.

## Criterion results

| Criterion | Verdict and independently observed evidence |
| --- | --- |
| Existing VICT/Mastra execution | PASS. Source composes the existing profile registry, authenticated actor, turn service, capability bridge, exact quiet-write policy and pinned Mastra router. Live streams identify `VICT / Mastra` and provide real turn/profile identities; no alternative agent engine. |
| Blank registration and streamed visible edits | PASS. Real z.ai `glm-5.3-flash` built heading, section, three independently labelled inputs and catalog Register button in two acknowledged batches. Inputs have no shared demo value/change binding. [Journal](journey-browser.json), [source](registration-source.json), [screenshot](live-registration.png). |
| Current selected field | PASS. Clicked Email in the actual Layers tree. A live request changed only `input-email` placeholder to `Audit work email` and border color to `#4466aa`; every other authored node compared equal. |
| Add / move / remove | PASS. Live tools added `note-audit`, then moved that same node to section index 0 in a separate batch. A later turn removed only its text/container in one transaction. Proposal operations and acknowledgements are retained in the journal. |
| Same history and persistence | PASS. Manual Undo restored the removed note and Redo removed it. Save persisted `r1.r1` using the existing storage format. Reload and a fresh browser reopening the captured saved data matched the stored canonical document exactly. [Saved bytes](saved-source.json), [reopen/continuation](continuation-browser.json). No automatic Save occurred. |
| Invalid atomic transaction | PASS. Independently authored probes refuse a valid first operation followed by an invalid second operation without document/history effects; also reject forged digest/document/epoch, replay, executable attributes, prototype keys and undeclared commands. [Probes](independent.test.ts), [passing log](independent-probes-fixed.log). Editing source is byte-identical between original and repaired candidates. |
| Stale revision and ABA | PASS through real live requests. A manual rename refused the older proposal. Reloading the same saved content/revision changed the editor epoch and refused the pending proposal. Rename followed by Undo restored content but still refused the older proposal. [ABA evidence](aba-browser.json), [screenshot](live-aba-draft-refusals.png). |
| Draft guards | PASS. A dirty source draft blocks sending and retains the composer request. A source draft created after a real turn started refused the arriving proposal with `STUDIO_AGENT_DRAFT`, leaving source unchanged. Shared draft checks also cover property/data/rename; permanent UI tests exercise existing property/data draft behavior. |
| Acknowledgement after commit | PASS. Genuine pinned-Mastra integration tests observe the committed EditorBridge document before the edit tool returns success. Live proposals have matching successful receipts, revised working identities and visible canvas/source changes; each transaction shares manual Undo. |
| Disconnection and cancellation | PASS. Disconnected an actual live turn after acknowledgement; two locally applied edits remained visible, truthful feedback reported the interruption, and both edits were undoable back to the prior source. Stop-before-ack and cross-session refusal pass the genuine pinned-Mastra tests. |
| Failed provider | PASS. The actual configured z.ai/router path with the same requested model and a deliberately invalid test credential returned safe `STUDIO_AGENT_PROVIDER_FAILED` in 14.8 seconds, no proposal, zero edits and identical source. [Live failure](failed-provider-browser.json), [screenshot](actual-provider-failure.png). This is separate from the genuine pinned-Mastra **scripted provider failure after an acknowledged edit**, which preserved Undo in the suite; no real mid-turn upstream failure is claimed. Eight [independent seam probes](model-probes.json) additionally cover thrown errors, raw error chunks, rejected streams, hung promises/streams, pre-abort, valid chunks and consumer cancellation. |
| Authentication / Origin / CSRF | PASS. Real production HTTP probes cover absent session, missing/foreign Origin, absent CSRF, non-JSON variants, malformed JSON, closed-field spoof attempts and unknown acknowledgement. Bootstrap is authenticated and `no-store`; its session-bound CSRF nonce disclosure is intentional. [33-check matrix](http-boundary.json): 30 intended responses; three oversized-body transport findings below. |
| Credentials and browser boundary | PASS. The actual selected credential was absent from 44 generated client files and all scanned verifier text artifacts. Server-only loader/store markers were absent from the client. The launcher alone loads the selected temporary provider configuration; no external credential/configuration file was copied or changed. [Scan](credential-isolation.json). |
| Rendering and scope | PASS within the local-first cycle. Desktop form and chat are usable; phone viewport body width remains 390 at viewport 390. [Phone screenshot](phone.png). No new component family, backend authoring, framework source change, package publication or separate UI source was introduced. |

The live registration turn was `turn-a5b996ca-309b-4c99-a6fb-7032c0578ee2`;
selected-field turn `turn-77a9e6b2-0c2a-41a8-8251-98ad67cda890`.
Profile identity:
`v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d`.
Complete turn identities and streamed events are in the journals.

## Checks and findings

- **PASS:** own production build, scoped TypeScript check, and all **132 tests / 22
  files** using Studio Vitest 3.2.7. Final suite duration 181.45 seconds. Logs:
  [build](repaired-production-build.log), [typecheck](repaired-typecheck.log),
  [full suite](repaired-studio-tests-allowed-roots.log).
- **Low V-2 — retained:** each oversized 256001-byte JSON request to start,
  cancellation and acknowledgement resets the adapter-node socket rather than
  delivering the helper's intended HTTP 413. The body is refused before effectful
  handling; no authority or partial-edit bypass was observed. The likely cause is
  cancelling the request-body reader before sending the refusal response. Stable
  oversized-request feedback remains follow-up work; this does not block Cycle 1.1.
- **Timing observation — retained:** provider-failure-after-ack took 57 seconds and
  Stop-before-ack 19 seconds in this loaded independent suite. Both completed and
  passed; focused builder runs were faster. The direct host abort/failure race and
  fencing repair is present. No responsiveness/performance guarantee is established.
- **Inherited observation — retained:** the builder observed direct canvas input
  clicks selecting the enclosing section. Exact field selection through Layers
  worked in this independent browser. Framework bytes are unchanged; broad pointer
  selection polish is not claimed. Existing Svelte warnings and happy-dom's
  unconfigured bootstrap connection diagnostics remain in the passing test log.
- No blocking finding remains on the repaired candidate. The original native
  production loader defect is closed by an independently rebuilt, bootstrapped and
  live-exercised production bundle with the four existing pinned Mastra runtime
  dependencies declared directly by Studio.

## Retained failures and limits

Original candidate `9c3675c42fc28f719b7052932177eb8461db5a30` remains **FAIL**.
Its pushed independent evidence remains on `codex/studio-cycle-1-1-verification`
at `31a3a357c95ea9243be58341a44230b56a1e0d88`; the
[original assessment](ORIGINAL-CANDIDATE.md) is preserved. The builder's provider
rejection/Stop liveness failures and subsequent direct-host-race repair remain
part of the recorded lineage.

Verifier recovery history is preserved, not relabelled as passing first runs:
root-only dependency reuse initially selected Vitest 4; an ENOSPC run stopped at
61 passing tests; two local-Vitest runs hit Vite's external-realpath filesystem
guard until the explicit two-root allowance was added. No builder framework output
had disappeared: that initial diagnosis was corrected. The first live driver
completed registration but Puppeteer's later `Network.getResponseBody` lookup
expired; fetch-clone stream capture replaced that collector. The next driver
completed all edit/history steps but incorrectly compared pre-save revision `r1`
to legitimate saved revision `r1.r1`. That assertion was corrected, and saved-byte
reopen was independently demonstrated in the continuation. All related logs and
screenshots remain. Earlier probe invocation/duplicate-fixture mistakes remain
described in the original assessment. No product source was altered to accommodate
these environment or harness failures.

Real-provider success, actual invalid-credential failure and live disconnection are
demonstrated. Provider failure specifically after a committed edit is deterministic
model evidence through real pinned Mastra, not a claim of a real upstream outage.
Chat/turn state is ephemeral; restart recovery, production deployment readiness,
collaboration and performance guarantees remain outside this cycle.

Next allowed action: deliver this exact candidate and independent evidence for
owner review, retaining the non-blocking findings. Owner acceptance and any later
cycle remain separate decisions.
