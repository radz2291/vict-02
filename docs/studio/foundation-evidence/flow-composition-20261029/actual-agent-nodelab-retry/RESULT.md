# Direct Studio-agent retry — stopped after discovery refusals

Active product27788de9, evidence checkpointbdfbfaee. Built-in IAB control first
returned `browser.user is unavailable`. One local CUA JS-session reset and binding
the same browser2/tab6 restored observation without PC/app/server restart. Tab6
remained at login. Existing tab8 was signed in, displayed the saved incomplete
first trial, had an empty chat and no active request. Root used File/New screen
there; Chatwithme tab5 stayed untouched.

Root sent the unchanged ordinary product brief directly through Studio chat on
the fresh NodeLab — direct agent retry screen. No source was preloaded or repaired
through coding tools. Root stopped the single request through ordinary Stop when
repeated pre-invocation discovery failures continued with zero edits.

Terminal browser measurements:13 tool calls,9 refused,8 calls after refusal,
91.2seconds,0 receipt-derived edits,0 observations. Server completion receipt was
not received, so provider request/token counts are unavailable. No quota limit
was reported. Four successful reads reached flow palette, data-contract registry,
graph2 page0 and operations2 page0. Actual input diagnostics identify invalid_type
for components/includeExamples and offset; failed raw input types are unavailable.
Do not infer them from the diagnostic paths alone. Aggregated parser evaluations
are explicitly separate from tool-call identities/counts.

The agent acknowledged that contracts require typed arrays, but then continued
failing reads. The UI's individual failed-call details still say input unavailable
before validated invocation/no settled result. Public safe schema diagnostics are
present in Chat details. Source review must distinguish whether actionable safe
feedback reaches the model from whether UI receipts expose validated input; this
run alone does not establish the responsible cause.

The empty trial screen is saved r1.r1 to preserve its identity; saving did not
create an agent-authored app. Public timeline, terminal details, successful input
shape, measurements and screenshots are retained here. Original first-run failure
remains separately preserved. AR13-15 and actual-agent two-app/extensibility proof
remain open. No additional provider request is authorized merely by this report;
reproduce and repair a concrete defect before another bounded retry.

## Reproduced repair after this retained failure

The pinned actual Mastra Agent validates tools before returned Tool.execute.
That bypassed the earlier execution-local guard: an offline invalid-input probe
proved safe feedback reached the model, but upstream also appended raw arguments
to its error and logging. A direct Tool.execute test had missed this boundary.

The repair uses the documented Agent beforeToolCall hook. A WeakMap associates
only genuine opted-in VICT tool objects with the captured authoritative validator.
Invalid input returns closed safe refusal before upstream interpolation; valid
input proceeds unchanged through existing validation and governance. No parser
coercion, global patch, serialized callback, invocation or synthetic effect is
introduced. Host events classify refusal as failed, not a successful read.

Actual-executor single and concurrent regressions prove safe feedback reaches
the model, no raw canary in model errors or captured console surfaces, zero
invalid-call intent/invocation, and one successful invocation per correctly typed
retry. The three affected Mastra test files pass19/19; Mastra build passes.

Studio derives explicit JSON type hints from trusted schema declarations through
bounded local-reference resolution. Parser values/messages/expected fields never
supply hints. Sixteen focused tests pass, including strict malformed-input
rejection and offline compatible-adapter schema serialization. No adapter type
stripping or incorrect numeric nextOffset was reproduced. Pagination guidance now
explicitly says to copy numeric nextOffset and stop on null. Remote model
interpretation and the failed live argument representations remain unknown.

Designer types pass with zero errors/five existing warnings. The first full
Studio check exposed eight test typing errors (six iteration-introduced and two
older foundation issues). Bounded type-only fixture/assertion declarations resolve
them without weakening runtime assertions; full Studio TypeScript check passes.
Original failed check remains retained. Production activation and live effect of
these new feedback repairs are not established by the offline results.
