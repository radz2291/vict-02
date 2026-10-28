# Independent direct string-amendment verification

Candidate: `20fb566221a13eb7c68653f299f45c6222666c69`.
Prior amendment-only commit: `7152a897cb6b61f8fa32a2db9c60b99ca1f24cab`, verified ancestor.
Verdict: **PASS - scoped direct presentation-string amendment**. Integrated acceptance remains **HELD**.

The verifier authored no product source. A single explicitly filtered evidence test used the committed Studio source-Mastra alias configuration; its test include list was replaced directly. One file / one test passed, exit 0, 46.78 seconds including imports. No broad framework/Studio suite was repeated. No browser, provider, server, build or dist action occurred.

Independent checks establish:

- The actual restored Studio regex is 2,180 characters and its complete edit presentation is 17,850 serialized UTF-8 bytes. New framework capture accepts it and the read presentation. All 133 real catalog names pass complete JSON-Schema payload validation. 679 malformed/prefix/suffix/separator/empty/nonstrings reject. All 133 additional trailing-line-feed probes also reject; no presentation finding was observed.
- ASCII, CJK, supplementary Unicode and escaped-quote strings beyond the old 2,048 threshold pass when their complete schema fits the unchanged aggregate budget. Exactly 32,768 serialized bytes passes; 32,769 refuses. Unicode/escaped strings within the early character threshold but beyond the UTF-8 aggregate budget refuse.
- A huge leaf refuses before `JSON.stringify` is called, without echoing the canary. Native proxy/accessor challenges invoke zero traps/getters; prototype-named keys still refuse.
- A genuine bridge tool exposes a description longer than 2,048 through its provider-facing schema. The captured nested data remains frozen and unaffected by subsequent source mutation. Its Standard Schema validator delegates to the authoritative contract for permitted/refused values; two parses and zero capability invocations are recorded.
- Adapter revision is 4 with unchanged exact Mastra dependency versions. Studio's presentation source equals the original pre-workaround baseline. Product source remained clean at the candidate during verification.

`string-amendment-independent-result.json` records exact candidate/amendment SHAs, counts and source SHA-256 hashes. `string-amendment-independent.log` retains the executed result and five inherited Svelte warnings. Its initial printed verdict text anticipated a possible inherited regex finding; the actual findings array was empty. The evidence JSON and test reporting text were corrected afterward to reflect the successful observations; no assertions or product bytes changed, and no duplicate run was needed for that wording correction.

The source/provenance review confirms this is the owner-authorized narrow amendment: remove the separate 2,048 threshold, retain an early impossibility check derived from the 32,768 aggregate budget, retain exact deterministic UTF-8 accounting and all other passive-capture protections. The earlier enum workaround and verifier tooling failures remain preserved in their original evidence files; they are not the current implementation.

Live actual-agent composition is still unproven on the new candidate because the preserved running production build has not loaded this repair. A supported same-environment rebuild/relaunch and retry of the failed zero-edit trial are separate next actions. No owner acceptance, publication, merge, push or deployment follows from this scoped PASS.
