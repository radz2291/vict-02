# Independent bounded review

Reviewed candidate: `42e36ced00499009bfb3dd36a8295470304911ac`.
Verifier: fresh `setup_verifier`; no product source edits.

## Exact candidate verdict

**PASS, scoped presentation repair.** This is a valid implementation of the existing frozen bounds, subsequently superseded as the preferred solution by the owner's request to remove an artificial limit where justified. Passing this candidate does not establish that 2,048 is a necessary limit.

- Existing targeted regression: 1 passed, 19 deliberately skipped; exit 0. See `independent-targeted-vitest.log`.
- Independent AJV execution: 1 file / 1 test passed, exit 0. It tests both the recipe reference and complete edit payload: all 133 actual recipe names pass (266 positive probes); 683 malformed/prefix/suffix/separator/empty/nonstrings fail both routes (1,366 negative probes). Enum chunks are 64/64/5. Both recipe references resolve to the one definition.
- Actual read/edit schema capture passes. Edit presentation: depth 8, largest object 45 fields, largest array 64, longest string 141, total 15,711 serialized UTF-8 bytes. Read presentation: depth 6, largest object 21, largest array 18, longest string 129, total 1,598 bytes.
- Mastra presentation bounds, authoritative Studio admission and read schema have no diff from baseline. Current source SHA-256 hashes are in `independent-schema-result.json`. Product source was clean at this candidate; later untracked files are evidence.

## Provenance and necessity of 2,048

`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md` section 4 originally lists depth 8, per-object fields 64, arrays 64, string length 2,048, total serialized bytes 32,768 and capability description 1,024 as safe-capture bounds. `VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md` section 1.1 retains the 2,048 character limit while correcting total-size measurement to real deterministic serialized UTF-8 bytes. Initial implementation commit `6d359a8119fd785404a9cc78d204ec8df173f369` describes bounded inert metadata; it does not identify a provider-specific requirement at 2,048.

Within the inspected source, tests and contracts there is **no demonstrated downstream/API/security discontinuity at exactly 2,048**. It is an authored conservative threshold. The guard does have a resource role: `captureValue` rejects a very large leaf before `capturePresentationSchema` later calls `JSON.stringify` and measures the actual UTF-8 total. Unconditionally deleting the early guard would let an arbitrarily large string reach that allocation before refusal.

The narrow cleanup recommended under the owner's conditional authorization is to remove the independent 2,048 limit and retain a cheap early rejection when a leaf's JavaScript length exceeds `maxTotalBytes` (32,768). Such a leaf cannot possibly fit the same total serialized UTF-8 budget. Keep the exact aggregate 32,768-byte measurement and all unrelated plain-data, native-proxy, accessor, symbol, non-enumerable, prototype-key, depth, field, array, immutability and non-echoing guards. Keep the independent 1,024 capability-description contract. This is a recommendation, not an implemented or verified change.

Minimum affected validation: real Studio catalog regex longer than 2,048 accepted under the total budget; generic ASCII/CJK/escaped strings beyond the old threshold; exact total 32,768 pass and 32,769 refuse; huge single leaf refused before JSON serialization; unchanged adversarial capture/argument tests. Old fixtures that use `maxStringLength` should keep their intended historical 2,048/2,000 data explicitly rather than accidentally inflate or weaken their discriminator.

`packages/mastra/src/compatibility.ts` explicitly requires an implementation revision bump when execution semantics change. It records presentation acceptance changes for revisions 2 and 3, and includes the revision in the compatibility fingerprint and profile version. A change that admits schemas previously refused at tool construction should use **revision 4**, with pinned upstream Mastra versions unchanged. This does not imply publication or activation.

## Retained browser-evidence review

The saved graph source and Run DOM support three nodes, two connections, `uppercase` mode, saved revision `r1.r1`, and the preserved prior manual input `Manual coexistence after reboot` / output `Verified coexistence`. The popup metrics support actual iframe `vict-controls` ancestry. The three Chat DOM snapshots support retained draft text after hide/show and after Escape/reopen; the closed snapshot marks the Chat toggle active. These are retained-evidence checks only, not an independent browser observation, full accessibility certification or complete integrated acceptance.

## Verifier tooling failures retained

1. `independent-schema-check.log`: initial standalone vite-node runner could not resolve the Windows module path; no semantic result.
2. `independent-ajv-vitest.log`: `mergeConfig` concatenated test include arrays and accidentally began unrelated Studio tests, including canned-target transport fixtures. The verifier stopped this run immediately; its exec session completed exit 1. Its unreachable results are not candidate failures. This accidental harness may have attempted local fixture traffic; no actual provider/browser interaction or repaired-server restart/reconfiguration occurred. No broad process/listener inventory or server manipulation was used. The closed exec handle proves session completion, not an independent listener census.
3. `independent-ajv-single-file.log`: absolute Windows include did not find tests; no result.
4. Corrected relative include plus explicit file filter: `independent-ajv-relative-file.log`, 1 test passed; only the independent schema evidence test ran. The generated result's no-network limit describes this corrected schema check, not the aborted accidental fixture harness.

Integrated foundation verdict remains **HELD**. No live agent retry, production rebuild, server restart, provider switch, publication or owner acceptance follows from this review.
