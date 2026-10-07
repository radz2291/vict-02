# Component-contract fixtures (contract examples — NOT runtime evidence)

Canonical document excerpts pinning the shape of
[U4-COMPONENT-AMENDMENT](../../U4-COMPONENT-AMENDMENT.md). They execute
nowhere and authorize nothing; they exist so the implementer, the
independent reviewer and the U4 gate share one exact interpretation of the
contract. JSON, not canonical document bytes — a real document embeds these
nodes inside a full `vict.ui-document@1`.

| File | Proves |
| --- | --- |
| `checkbox-valid.json` | two instances, distinct typed state bindings, reactive `checked` input, `checkedChange` → setState |
| `select-valid.json` | array-typed prop bound to a typed view-field reference (no array literals exist), `valueChange` → setState → declared action input |
| `button-action.json` | void `press` output → invokeAction with authored input mapping; `loading`/`disabled` reactive from state |
| `dialog-slot.json` | declared slot fill in instance scope; open-state loop; authored confirm child dispatching inside a catalog host; portal to ControlScope root |
| `appshell-content.json` | content slot fill; navigation/active/responsive from existing composition semantics |
| `invalid-cases.json` | author-time diagnostics: unknown output, incompatible binding (prop-side and output-side), wrong-typed prop literal, `$output` misuse, undeclared slot, unknown action (existing `UI_DOC_UNKNOWN_PRODUCT_REFERENCE` code, extended scope) |
| `abi-compat-probe.json` | the compatibility gate, chosen from verified legacy behavior: the ORIGINAL ACCEPTED COUNTEREXAMPLE (output-wired descriptor without the events marker — the legacy resolver accepts it, abi/outputs invisible) and the REPAIRED rejection (events marker → legacy `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`), plus controls; resolver-level reproduction on the exact `952d92d…` bytes — not a browser test |
| `render-failures.json` | fail-closed render/compile matrix: unresolvable instance revision pin (`UI_COMPONENT_REVISION_UNRESOLVED`), missing/competing/mismatched implementations, ABI mismatch, old plan artifact for an abi@1 descriptor (no `outputDecls`), unsupported slots, stale and rejected emits |

Conventions:

- `$output` appears only inside `outputs[*].setState.value` /
  `outputs[*].invokeAction.input` expression scopes.
- Descriptors carry `abi: "vict.ui-component-abi@1"` and the matching
  `events: ["vict.ui-component-abi@1"]` marker whenever `outputs` (or
  renderable slots) is declared; implementations must match `abi` exactly.
  The marker is the compatibility gate: legacy consumers reject any
  `events`-bearing descriptor with their existing diagnostic, so an
  output-wired instance can never render with its wiring silently dropped
  (amendment §3.2/§4.3; probe-verified on the `952d92d…` resolver bytes).
- Product state keys, action ids and input mappings appear only in the
  instance excerpts — never in descriptor metadata. The
  `applicationInputs.actionInputs` blocks illustrate the action-input
  catalog the application compiler derives from declared action contracts
  (amendment §3.5); they are not an application-schema field.
- Invalid fixtures list their expected diagnostic codes next to the excerpt.
  Codes marked "compile, built by the amendment" do not exist in today's
  validator; they exist at the contract level only.
