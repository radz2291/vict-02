# Independent mainline integration review — 2 November 2026

**PASS — scoped mainline integration of the exact candidate below.** No unresolved
integration blocker remains within this reviewed scope. Recheck remote main and
obey ordinary server protections before the normal fast-forward update.

Independent verifier: `/root/mainline_independent_verifier`, a fresh agent that did
not repair the audited product. Its changes are limited to its own evidence and
public-consumer challenge fixtures. The verifier commit is the commit containing
this report; the integrator's final delivery record must bind its full SHA.

Tested candidate: **f7ef931628454c40a47136aea2b2e54119f9b507**.
Delivery anchor: **ed771858fb1d3a28783d320785a3cab1bbe3f341**.
Main before integration: **d7401bef6e48330796c74ec00c86db9622d48cdf**.

This is a scoped integration verdict, not a new whole-foundation,
whole-repository, Stage 9 or Milestone 2 pass. The original independent Option 2
verdict remains attributed to **20e26253f0ec6aab20f480c1b3e537e2282938d8**.
The later test-repair and caption follow-ups retain integrator verification.

## Ancestry, content and authority

The fetched main is an ancestor of the delivery and candidate. Initial delivery
comparison independently returned zero main-only / 557 delivery-only commits,
7,981 changed paths (7,882 added / 99 modified, no deletes). The inherited
Studio/UI and kernel/runtime/SDK/Mastra changes were inspected as delivery
history, including turn-policy compatibility, ordered replay/publication,
cancellation and presentation/validation feedback. No GitHub workflow changed;
the manual release workflows must not run for this integration.

All 35 workspace manifests were independently compared with their lockfile
workspace entries; versions and dependency/peer/optional/dev declarations match.
Structure/Flow/Editor source scans found no Studio-private imports. Shared
Structure retains derived presentation/projection ownership; canonical editing,
history, application effects, transient state and durable data do not move into it.

The integration adds four bounded production-file repairs and eight test-file
repairs/regressions relative to the delivered product. It changes no package
manifest, lockfile, provider configuration, schema or component ABI. The candidate
is suitable for a normal fast-forward, subject to the integrator's immediate
remote-main recheck and ordinary server protections. No reset, forced update,
history rewrite, package publication or runtime activation is approved here.

## Findings and resolution

1. Three delivered UI-editor tests had stale quota/event assumptions or a single
   catalog-wide timeout. The builder moved formerly capped valid values into
   explicit acceptance coverage, preserved malformed-token/history/atomicity
   checks, dispatched F10 through the actual owning document, and parameterized
   all catalog descriptors without increasing the per-case timeout. Independent
   test-diff review found no removed behavior checks.
2. Seven additional Studio expectations used an obsolete metadata budget, an old
   capture callback signature, old drawer controls or parent-document queries of
   iframe-owned content. Repairs preserve complete schema equality, the live
   cancellation signal, actual runtime-state echo, draft identity, saved/canonical
   source and focus/shortcut checks. The previously repaired 12 cases remain
   repaired and pass in the final affected suite.
3. The iframe-aware modal challenge uncovered a real defect: a hidden embedded
   application's portal remained alive and Bits' global body lock affected
   Studio. The builder repaired `CatalogPortal.svelte` to observe the same-origin
   embedding chain and `CatalogDialog.svelte` to use the existing refcounted
   application-viewport lock for isolated content. Pinned Bits parts, focus,
   controlled outputs, dismissal and standalone behavior remain.
4. A typed fixture error exposed a second real compatibility defect. Public
   compilation and `UiEditSession.open` already admit historical native changes
   without a fallback; Structure then dereferenced the missing expression. The
   builder guarded only absent fallback projection/description, preserving the
   Updates relation, existing admission and exact canonical data. It did not
   reject historical source or invent a fallback.

The verifier identified and challenged these findings; the builder repaired them.
No production source was silently changed by the verifier. Initial failures and
harness diagnostics remain in the evidence directory.

## Independent executions and artifact checks

- At the earlier test-repair checkpoint, [five focused files / 89 tests passed](independent-focused.log),
  covering the three editor repairs and independent stream replay/backlog cases.
  These overlap the builder's suites and are not added to their totals.
- The earlier installed consumer's [original five cases passed independently](independent-installed-consumer.log).
  Its nine archives and installed files were independently recomputed in
  [the earlier audit](independent-artifact-audit.json). Seven earlier/current
  archives were identical; 33 members in two fresh archives differed only in
  CRLF/LF bytes. No blanket historical artifact-equality claim follows.
- The independent public [iframe challenge failed four cases on the old archives](independent-iframe-old-red.log).
  The separate [historical-fallback challenge failed on the admitted source](independent-fallback-old-red.log).
  Both used installed public exports without Studio imports or source aliases.
- The same four-file public fixture ([iframe cases](independent-public-fixture/iframe-dialog.test.ts),
  [fallback case](independent-public-fixture/missing-fallback.test.ts),
  [host](independent-public-fixture/Fixture.svelte) and
  [configuration](independent-public-fixture/vitest.config.mjs))
  were installed alongside the final consumer, without rewriting its original
  nine fixture files. **[All five independent cases passed](independent-public-green.log)**:
  hidden/inert/detached embedding lifetime and restoration; parent/sibling control
  usability; local two-modal lock reference counting; Tab/ShiftTab, Escape,
  reopen and controlled close; admitted fallback-free projection and canonical
  preservation. The four old iframe cases and the additional old fallback case
  were challenged in separate red runs before this combined green run.
- **[The final Studio focused challenge passed 16 cases in two files](independent-studio-final.log)**,
  including the repaired portal lifecycle, standalone behavior, semantic
  projection, historical fallback and canonical preservation. These overlap the
  builder's 167-case affected suite.
- **[Final independent artifact audit PASS](independent-final-artifact-audit.json)**:
  nine archive SHAs and source trees, all 656 tar/installed members (647
  nonmanifest files and nine manifests), nine public manifest semantics and nine
  original fixture hashes match. All installed package paths stay inside the
  isolated consumer. [The audit script](independent-audit-artifacts.py) is retained.
  Consumer report SHA256:
  `120449f02bf68e5164faec9cf252bdbb09efb91bb932922aeee124bafc6cd3ed`.

The public iframe fixtures model only Happy DOM's missing same-origin
`Window.frameElement` link and restore it after unmount. They do not force portal
visibility, lock state, canonical state or event results. They are DOM/lifecycle
checks, not painted-browser, physical-device or native hit-testing proof.
An initial fixture catalog-factory invocation error and plain-CLI quoting/Svelte
loader limitations are retained as harness diagnostics, not product failures or
Node-only Structure-consumer evidence.

Raw terminal receipts retain CRLF, terminal blank lines and whitespace from
rendered-HTML diagnostics. Git's default whitespace check reports those bytes;
they were not normalized. The verifier's source/report/script diff check is
separate from that raw-evidence preservation.

## Builder evidence independently challenged

The final affected Studio suite passes **34 files / 167 cases**, including nested
graph ownership, sibling isolation, canonical history, Structure behavior and
the repaired keyboard/caption cases. The inherited core/backend/renderer scope
passes **58 files / 445 cases**, and Flow passes **39 files / 209 cases** at the
iframe-repair checkpoint; their relevant source remains unchanged by the final
Structure-only repair. Counts are separate scopes, not a whole-repository total.

The 21-package root build passed on the iframe-repair candidate. The other 20
package trees/build inputs remain equal; Structure received a fresh check after
its final helper edits. The build-only precursor correctly has no consumer PASS:
its individual package fields distinguish these origins. Its root-build summary
sentence about equal package inputs must be read with this Structure exception,
not as a fresh root build of changed Structure. All nine archives were freshly
packed for the final candidate; the existing consumer driver reused these
same-candidate successful build/pack checks and freshly installed, ran its five
DOM cases and production-built the consumer. This is not historical-tar reuse.

Studio TypeScript, designer/Svelte checking and AI package checking pass. The
explicit final isolated production-build receipt is complete and exit zero on
`f7ef931628454c40a47136aea2b2e54119f9b507`; the verifier inspected the final raw
log and candidate-bound exit record before issuing this PASS. Package build
evidence hashes and per-package source-tree attribution were independently
recomputed. No build was activated.

Retained warnings include the existing five Svelte diagnostics, fixture warnings,
shortcut notices, experimental SQLite, upstream circular/unused imports and
large chunks. Installation's inherited posthog-node engine mismatch and npm 11
optional install-script notices remain disclosed. Failed initial test runs are
not accepted current failures. Unrun unrelated repository suites are not claimed
green, and historical unrelated failures are not reclassified by this review.

## Runtime protection and preserved decisions

The verifier independently compared both earlier and final before/after runtime records:
all 398 installed build files, listener PID **1668**, its start time and four
recorded public configuration files were equal. All executions used the isolated
integration checkout or physical installed consumers. No browser/storage API,
running launcher, provider request, saved application, draft or conversation was
changed. Saved-work protection is noninterference, not a fresh saved-data export
comparison. The final runtime record still matches the original before record.

The bounded closures stand. Stage 9 remains open. Milestone 2 remains paused with
requirements retained until explicit owner resumption. Speed investigation and
optimization remain deferred pending TORI integration; slowness remains open,
neither resolved nor waived. The current Studio agent stays available until its
replacement meets the recorded integration requirements and is verified.

Mainline integration records a future TORI dependency baseline only. It does not
start TORI, resume Milestone 2, authorize speed work, activate this build or
publish packages. After normal remote-main integration, equality/ancestry checks,
documentation reconciliation and reporting, stop.
