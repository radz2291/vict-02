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
| `invalid-cases.json` | author-time diagnostics: unknown output, incompatible binding, `$output` misuse, undeclared slot, unknown action |
| `render-failures.json` | fail-closed render matrix: missing/competing/mismatched implementations, ABI mismatch, unsupported slots, stale and rejected emits |

Conventions:

- `$output` appears only inside `outputs[*].setState.value` /
  `outputs[*].invokeAction.input` expression scopes.
- Descriptors carry `abi: "vict.ui-component-abi@1"` whenever `outputs` is
  declared; implementations must match it exactly.
- Product state keys, action ids and input mappings appear only in the
  instance excerpts — never in descriptor metadata.
- Invalid fixtures list their expected diagnostic codes next to the excerpt.
