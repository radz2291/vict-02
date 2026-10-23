# Cycle 1.3 — owner review: upstream presentation fidelity

2026-10-23. The owner compared the Message example with `https://www.shadcn-svelte.com/docs/ai-elements/message`, supplied its screenshot, and raised concern that other components may also differ. This expands the bounded Copy appearance review into an audit of all 21 selected AI Elements patterns against their immutable official baseline, `huntabyte/shadcn-svelte@b10f153250b18abfccf49a06e1c4c68945edffa5`.

Current status: **HELD FOR OWNER-REVIEW FINDINGS — full presentation fidelity audit and repairs in progress.** Prior independent PASS on `e6fa5f976b71150d8c334d4a2bd973fd4a653012` proves its documented behavior/provenance/coverage; it did not establish visual fidelity for every pattern. That limitation is now explicit. The initial icon-only candidate `9dc95271e3e2b0b00f0f8a4832ee06d44d513989` is committed/pushed but is not the final repair or a new verified gate. Preserve it and all earlier observations.

## Authority and baseline

Continue in the existing isolated branch/worktree `codex/studio-cycle-1-3`, based on clean, remote-equal delivery `e7644b13b1ed263c4beda8359ead6d3d1dfa088b`. `origin/main` remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Owner instructions authorize the original complete upstream-derived family and the present review corrections. Allowed paths remain the specialist AI package, its public consumer showcase, affected Studio presentation integration, bounded checks/evidence and current status documentation. No unrelated canonical/runtime/backend or Flow semantics changes.

## Audit and correction requirements

For every pattern, compare the actual official example composition and styled dependency components with the public VICT composition and visible showcase. Record omitted structure, spacing, icons, action placement, interactive states, and content treatment. Distinguish concrete defects or unnecessary redesign from explicit host adaptations (typed data/callbacks, source identity and safe content), theme differences, and backend-dependent affordances. Presence of an export or a rendering fixture is not visual-fidelity evidence.

Correct avoidable presentation drift using the existing pinned upstream components, design tokens and composition patterns. Keep neutral VICT/canonical transport/validation/history authoritative. Retain the safe Markdown boundary and honest host callbacks; do not invent backend support to activate an upstream example. Preserve compatible public data contracts where possible. Any necessary dependency/source closure expansion must be pinned, attributed and independently checked, not silently copied from mutable latest. Record meaningful adaptations and omissions instead of claiming pixel identity across different themes and host containers.

The user-visible Message example already establishes a concrete mismatch: our plain text Copy action and added author labels differ from the official tooltip-equipped compact ghost icon actions and aligned message/footer composition. Correct the shared pattern and default conversation consistently, including an actual Copy action on user bubbles. Edit/retry/feedback require their real host callbacks.

After corrections: serialize build/type checks due low local disk/memory; install updated packed artifacts in the separate existing consumer; verify representative desktop/mobile states, focus/keyboard/tooltips, clipboard success/reset/failure and all repaired pattern interactions. Collect before/reference/after evidence for the full family and obtain an independent exact-candidate verdict. Update report/coverage language and current pointers before declaring readiness again. Original failed evidence and earlier PASS remain in history.

Owner 5591/5593 listeners, tabs, unsaved work, saved screens and provider files remain untouched. The separately owned 5594/5595 previews can be rebuilt/restarted after the corrections. No merge, publication, deployment, Cycle1.4, Milestone2, owner acceptance or Stage9 closure.

## Pattern comparison register

### Subsequent runtime findings and complete-showcase request

The first corrected candidate `efbafcc41317d18ea6609c490f149452de8a98b0` passed strict AI checking, Studio/packed-consumer builds, a fresh26-assertion Studio composer replay, independently checked immutable reference hashes and core21-pattern browser/state checks. The independent browser found two remaining presentation issues before a new readiness verdict: Studio's surrounding ControlScope imposed40px minimum height/padding on the28px message action, and the grouped model footer introduced unnecessary wrapping. Diagnostic-only CSS injection established the ControlScope cause; that is not a production pass. Scoped button reset and footer layout corrections require the subsequent build/replay. Initial dropdown animation timing failures and all captures are retained.

The owner then requested that **all UI newly created/modified in Cycle1.3 be visible in the showcase**. This authorizes the complete authenticated `/showcase` hub and a public building-block gallery. The hub contains the21 AI patterns,19 shared visual primitive families (95 unique contextual parts, with aliases/types/utilities inventoried separately), public Flow, and all83 actual Designer recipes plus real Inspector/Composer/Layers/Data/Structure controls in a disposable memory-only sandbox. The standalone packed consumer retains no Studio source imports: its generated83-entry metadata index links to the authenticated live examples. No owner localStorage, saved screens or current canvas is read or written by the sandbox. Existing live-provider integration remains explicitly available in the ordinary Studio workspace rather than faked inside a presentation example.

The three builder source audits, exact reference manifests, primitive inventory, source warnings/repairs, before/after captures and final independent matrix are under `cycle-1-3/upstream-fidelity/`. Final status remains HELD until the combined correction and complete showcase have passed their affected checks and independent gate.

Pending: Chat, Message, Prompt Input; Chain of Thought, Plan, Task, Queue, Reasoning, Subagent, Tool, Terminal, Test Results, Stack Trace; Checkpoint, Confirmation, Context, File Tree, Inline Citation, Model Selector, Sources, Suggestion. Builder audit records and final independent evidence will replace this pending register with explicit dispositions, never inferred from pattern counts.
