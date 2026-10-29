# Scoped canonical slot instances

`vict.ui-slot-scope@1` is an explicit opt-in on a registered component slot. It does not change ordinary slot semantics or the historical component ABI. The descriptor and implementation both list `scopedSlots`; the canonical fill declares `scope`. Compilation carries this scope with its ordinary compiled children. Missing capability or compiled metadata fails closed.

A fill scope declares typed `props`, optional `state`, optional typed `outputs`, and optional named `conditions` expressions. Its normal VICT subtree is compiled once and may render at many stable keys. A specialist calls `io.scopedSlots[name]({key,props,state,onStateChange,onOutput})`. This invocation frame is code-owned and never serialized.

- Declared props are copied and checked; undeclared props are not exposed. Structured array inputs must be canonical serializable data and are deep copied.
- `state` declarations with `controlled:true` consume the supplied state snapshot. A typed write calls `onStateChange`; the specialist must validate and commit its own domain transaction. Missing supplied values use the declared initial value. Noncontrolled state belongs to the renderer instance and persists through ordinary rerenders. It resets when the stable key or declared scope contract changes.
- Body `setState` writes can target only the scoped state declarations. The root document state is not a fallback, even if it has the same key.
- A component output binding `{emit:{output,value?}}` routes a declared scoped output. Its payload follows the existing typed expression and `$output` rules. This creates no application action, backend or provider authority. Normal explicit application action bindings keep their existing dispatcher semantics.
- `conditions` names are lexical conditional-branch expressions, checked against this scope. They do not create global CSS conditions.
- Stable keys are namespaced in the renderer occurrence by their enclosing source occurrence. Source generations, removed instances and replaced frames fence callbacks. The registered specialist must supply unique, stable keys for simultaneous instances.

Stored local component definitions retain their existing props-only interface. They may be nested for presentation with explicit props; they do not inherit caller state or declare new output authority. Editable reusable node bodies in this iteration are canonical scoped subtrees containing normal registered controls, not a new hidden renderer or a new local-definition execution model.

The generic packages do not import graph models or graph adapters. Domain adapters own graph parameter mapping, transaction validation, connection rules and persistence; the same slot bridge is usable by other specialist components.
