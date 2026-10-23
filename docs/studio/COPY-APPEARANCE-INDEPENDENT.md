# Cycle 1.3 Copy appearance â€” independent verification

2026-10-23. Bounded owner-review presentation repair. This review does not reopen unrelated canonical, provider or Flow behavior and does not confer owner acceptance or Stage 9 closure.

## Review basis and retained progression

Prior delivery `e7644b13b1ed263c4beda8359ead6d3d1dfa088b` carries the independent Cycle 1.3 PASS for product `e6fa5f976b71150d8c334d4a2bd973fd4a653012`. The first icon-only candidate `9dc95271e3e2b0b00f0f8a4832ee06d44d513989` was source-reviewed: two presentation files changed, original Markdown clipboard values retained, success state follows a resolved clipboard write, and callback-only pattern does not fabricate success. No runtime PASS was issued for that candidate.

The owner then supplied the official Message screenshot and asked about the visual difference. That supersedes the initial 32px icon-only approach with a bounded message-composition repair. Independently checked [official Message documentation](https://www.shadcn-svelte.com/docs/ai-elements/message): ghost icon-sm actions, tooltips, user footer aligned to the message end, assistant footer without horizontal padding, and compact content spacing. The existing VICT theme is retained. Unsupported Edit/Retry/feedback operations must not be invented to mimic example controls.

The prepared independent runtime probe will cover native clipboard exact text, successful-state reset, denied clipboard writes, keyboard focus/tooltips, user and assistant copy, narrow viewport containment, and honest callback-only Message behavior in the packed consumer. Prior real-provider and canonical-edit evidence carries only where source comparison confirms unchanged scope.

## Expanded full-family review

The owner subsequently questioned the other components' fidelity. Authority now includes `CYCLE-1-3-UPSTREAM-FIDELITY.md` at `aa62577`. Readiness is **HELD** for the full 21-pattern audit; a narrow Copy pass cannot restore it. The previous count of 21 populated cards and complete styled dependency closure does not prove 21 faithful compositions. In particular, the former ChainOfThought/Plan/Task aliases and Terminal-to-Tool wrapper require distinct comparison of structure, state, status, actions and content. Pinned Task documentation explicitly distinguishes emerging observed steps from a Plan's pending steps and progress counter.

The independent reference set contains all 21 immutable docs pages and every referenced demo variant, including their SHA-256 hashes: `cycle-1-3/copy-appearance/independent-reference/manifest.json`. An initial probe assumed examples existed in the styled registry JSON directory and received HTTP 404; the immutable Git tree established their actual `docs/src/lib/registry/examples/*.svelte` paths. This was a corrected reference-location assumption, not a product failure. Styled UI dependencies remain pinned Rhea registry payloads.

Final criteria: each pattern needs an explicit primary-reference comparison and meaningful secondary-state dispositions; inspect structure, spacing, icons, status, action placement and content rather than count exports. Separate actual necessary host/canonical/safety adaptations from theme/container differences and avoidable presentation drift. Verify comparable-width visible states and keyboard/interaction behavior after the exact-candidate build. Unsupported tutorial transport may be omitted with an explicit disposition; a missing visual/state affordance is not excused merely by mentioning backend integration.

Current verdict: **HELD**, awaiting corrected full-family candidate and rebuilt runtime. No browser probe has run for this repair at this point. The prepared copy probe now expects 28px actions, styled keyboard tooltips and user copy; its final fixture selectors/text still need reconciliation with the frozen showcase before execution. Earlier Cycle 1.3 findings, failures and accepted scope remain in `CYCLE-1-3-INDEPENDENT.md`.

## Final disposition

The narrow icon-only proposal remained superseded. The completed full-family gate is recorded in `UPSTREAM-FIDELITY-INDEPENDENT.md` for product `8eb96dd8bcf7cfadd973e1f4fae7d11706a32797`. Final actual Studio/packed/Message Copy checks pass 23/23, including native clipboard source, keyboard/tooltip, success reset, failure and mobile behavior. The original 30×40 Studio leak, its diagnostic injection and the Windows CRLF oracle correction remain preserved in `cycle-1-3/copy-appearance/`. No separate icon-only acceptance is claimed.
