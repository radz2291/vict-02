# Presentation string bound amendment — 2026-10-28

Status: owner-authorized narrow amendment; executable implementation and independent verification follow separately. Scope is local candidate only; no release, push, deployment, provider or server authority.

## Authority and evidence

The owner instructed: "if its an artificial limit, just remove it" (2026-10-28, Sentinel_369083c1215081919b941a48ef61a022). The delegated clarification requires provenance review and preservation of necessary resource/security constraints, with no blanket relaxation.

The original model-facing capability-schema contract §4 chose a 2,048-character bound for each presentation string alongside structural and aggregate bounds. The audit-remediation contract §1.1 explicitly retained it while repairing total serialized UTF-8 accounting. Neither document, source history (introduction 6d359a8), nor the checked code identifies a provider/protocol restriction or a distinct security boundary at exactly 2,048 characters. It is a conservative local allocation threshold. Its general early-rejection purpose is real: total serialization currently occurs after passive capture, so removing all early string protection could allocate an enormous JSON string before the aggregate check.

At foundation baseline d7aeecf8176d78f4e7864a386ac1ff207cb4b871 the actual Studio-agent turn failed before model generation because its real expanded recipe regex exceeded 2,048 characters. The existing regression reproduced this exact failure. Candidate 42e36ced00499009bfb3dd36a8295470304911ac encoded the same vocabulary as bounded enum groups and passed scoped tests; it is retained historical evidence, superseded by this owner-directed cleaner repair.

## Amended rule

Remove the independent 2,048-character presentation-string constraint and its `PRESENTATION_BOUNDS.maxStringLength` member. A presentation string greater than the existing `maxTotalBytes` (32,768) in UTF-16 code units is refused before serialization: each code unit necessarily requires at least one byte in JSON UTF-8, so such a string cannot fit the aggregate budget. This is an early impossibility check derived from the unchanged aggregate bound, not a new independent content-length rule. The final exact deterministic serialized UTF-8 measurement remains authoritative, counting keys, escaping, punctuation and containers.

All other bounds and passive-capture protections remain: depth 8, object/array size 64, safe keys, prototype/proxy/accessor/function/symbol/non-enumerable refusal, deterministic immutable snapshots, and separate 1,024-character capability descriptions. Contract.parse remains sole argument authority. Raw-argument guards, effect/approval/fencing rules and delivery-snapshot limits are unchanged. No provider security/network/authentication control changes.

Restore Studio's direct anchored recipe vocabulary instead of keeping the enum workaround. Prove the real expanded catalog fits the aggregate budget and rejects unknown recipe names. Test >2,048-character schema strings through actual provider-facing tool construction, immutable capture and unchanged parsing; retain exact 32,768-byte pass / 32,769-byte refusal, UTF-8/escaping cases, and early huge-leaf rejection without raw-value echo. Bump the Mastra adapter revision to identify changed admitted presentation semantics; no package version or publication is implied.

Historical contracts and failed observations remain intact. This amendment supersedes only their per-presentation-string 2,048 rule for subsequent implementation. Integrated actual-agent proof still requires the repaired candidate loaded through the supported same-environment server handoff.
