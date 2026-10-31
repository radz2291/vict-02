# Completion and cancellation policy

The additive `vict.agent-turn-policy@2` declaration is explicit canonical data:

```json
{"schema":"vict.agent-turn-policy@2","mode":"until-completion-or-cancel"}
```

It opts into the pinned Mastra loop's public `stopWhen` control without a VICT
step/tool count ceiling. The adapter supplies `stopWhen: () => false` and the
governed abort signal. Omitting `maxSteps` alone would restore Mastra's five-step
default, so omission alone is not this policy. No large-number or numeric
infinity stand-in is serialized. Normal model completion, actual provider
failures and owner cancellation still end execution. Tool contracts, actor and
effect authority, approvals, identity and durable settlement remain enforced.

The original finite policy retains its exact shape, bounds and canonical
manifest. Its `maxSteps`, `maxToolCalls` and `onLimit: fail-closed` still mean the
same thing; mixed or unknown policy shapes refuse. The enclosing profile schema
and identity algorithm remain unchanged. New policy bytes participate in the
profile identity. Older compilers reject the new nested policy rather than
silently reading it as an old finite policy.

Adapter revision 5 implements this policy and awaited event delivery. A profile
bound to adapter revision 4 must be explicitly rebound to revision 5, producing
a new profile version, before using this adapter; the exact compatibility gate
continues to reject mismatches. Provider packages and model configuration are
unchanged. Optional generation token settings remain available to authors; the
Studio consumer no longer supplies an invented token count. Provider-reported
length termination remains a truthful failure and never executes partial JSON.

Event sinks may return a promise. The adapter and stream hub await delivery;
Studio uses the standard Web Streams writer and the provider seam pulls one
part per downstream demand. There is no aggregate Studio stream quota or eager
detached queue of writes. Synchronous hub subscribers retain their existing
`false`/`pull()` behavior. Callback return values never grant execution authority.

Studio selects the new policy and removes its duplicate source, prompt, history,
request and runtime duration quotas. Its source-cursor, draft, session/CSRF and
acknowledgement fences still apply. An acknowledgement waits for the actual
browser receipt or cancellation; an arbitrary elapsed time cannot manufacture a
commit or rejection. Explicit test-only deadline injection remains available to
test cancellation without waiting for production wall time. The adapter-node
launcher uses its documented `BODY_SIZE_LIMIT=Infinity` disabling configuration;
this is the upstream HTTP adapter's supported mode, not an agent count policy.
