/**
 * Centralized, type-aware form-value model for the `form` role.
 *
 * This module is the SINGLE canonical value-normalization policy shared by
 * create and edit forms: every conversion happens at the DECLARED widget
 * boundary, driven only by the field/widget metadata of the neutral
 * definition. The renderer never infers types from field names and never
 * lets an input event decide the submitted type — a prefilled value acquires
 * its declared type through the same policy as user-edited input.
 *
 * Policy (HIGH-05-A remediation):
 * - `number` widgets carry finite numbers. Prefilled numeric values convert
 *   back to numbers without user interaction; `0` stays `0` (distinguishable
 *   from empty/absent). Invalid numeric input NEVER becomes NaN, infinity,
 *   or a silently coerced value — it stays a field-local error and blocks
 *   the dispatch entirely.
 * - `boolean` widgets carry booleans; `false` is a legitimate value.
 * - `date`, `text`, and `json` widgets carry strings (their documented
 *   domains). Empty optional numbers follow the declared absent semantics
 *   (the key is omitted — never dispatched as `''`); empty optional
 *   string-domain values are dispatched as `''`, matching the declared
 *   contract semantics for string fields.
 * - Required fields that end up empty produce a local, field-associated
 *   error. Conversion failures NEVER dispatch a malformed mutation and
 *   NEVER echo hostile values (unsupported prefill types render as the
 *   empty display state, not as `String(value)`).
 *
 * The module is framework-neutral and unit-testable; `FormSurface.svelte`
 * binds the raw widget-boundary state and calls into it for prefill and
 * submit conversion.
 */

/** The closed declared widget vocabulary (matches the SDK FormField union). */
export type FormWidgetKind = 'text' | 'number' | 'boolean' | 'date' | 'json';

const WIDGET_KINDS: readonly string[] = ['text', 'number', 'boolean', 'date', 'json'];

/**
 * Resolve the declared widget kind for a field. Unknown/unsupported widget
 * hints fail safe as `text` (a string control) — never a guessed type.
 */
export function widgetKind(widget: unknown): FormWidgetKind {
  return typeof widget === 'string' && WIDGET_KINDS.includes(widget)
    ? (widget as FormWidgetKind)
    : 'text';
}

/**
 * Strict decimal-number text: optional sign, digits with optional fraction
 * and optional exponent. Deliberately NOT `Number()`'s full grammar — hex,
 * `Infinity`, `NaN`, and underscore forms are refused, so conversion can
 * never silently produce a non-finite value.
 */
const PLAIN_NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** The raw widget-boundary state: what the controls actually hold. */
export interface FormState {
  /** Raw text of text/number/date/json controls (string-boundary state). */
  readonly text: Record<string, string>;
  /** Checked state of boolean controls. */
  readonly checked: Record<string, boolean>;
}

/** Field metadata the model needs (the compiled plan's declared fields). */
export interface FormFieldMeta {
  readonly name: string;
  readonly required?: boolean;
  readonly widget?: unknown;
}

/** Local, field-associated conversion errors (renderer-generated text only). */
export type FormFieldErrors = Readonly<Record<string, string>>;

export interface FormSubmitOutcome {
  readonly ok: boolean;
  /** Canonical typed payload (only when `ok`). */
  readonly payload?: Record<string, unknown>;
  /** Field-associated errors (only when `!ok`). */
  readonly fieldErrors?: FormFieldErrors;
}

/** Renderer-generated, safe, non-echoing local validation messages. */
export const FIELD_ERROR_REQUIRED = 'This field is required.';
export const FIELD_ERROR_NUMERIC = 'Enter a valid number.';

/**
 * Convert a prefilled record into the declared widget-boundary state.
 * Every declared field gets an entry (empty display state when the stored
 * value is absent or unsupported) — the state is always complete, so a
 * submit never depends on an input event having occurred.
 */
export function prefillFormState(
  fields: readonly FormFieldMeta[],
  values: Readonly<Record<string, unknown>>,
): FormState {
  const text: Record<string, string> = {};
  const checked: Record<string, boolean> = {};
  for (const field of fields) {
    const kind = widgetKind(field.widget);
    const value = values[field.name];
    if (kind === 'boolean') {
      checked[field.name] = value === true || value === 'true';
      continue;
    }
    if (kind === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        // Exact round-trip: the strict decimal grammar re-parses this to the
        // same finite number at submit time (no user interaction needed).
        text[field.name] = String(value);
      } else if (typeof value === 'string' && PLAIN_NUMERIC.test(value.trim())) {
        text[field.name] = value.trim();
      } else {
        // Absent, non-finite, or hostile values fail safe as the empty
        // display state — never `String(value)`, never NaN.
        text[field.name] = '';
      }
      continue;
    }
    // text / date / json: the declared domain is a string.
    if (typeof value === 'string') {
      text[field.name] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      text[field.name] = String(value);
    } else if (typeof value === 'boolean') {
      text[field.name] = String(value);
    } else {
      // Hostile/unsupported stored values are never echoed.
      text[field.name] = '';
    }
  }
  return { text, checked };
}

/**
 * Convert the widget-boundary state into the canonical typed payload for
 * the declared fields. Returns a field-associated error map instead of a
 * payload when any conversion fails — the caller must not dispatch.
 */
export function toSubmitPayload(
  fields: readonly FormFieldMeta[],
  state: FormState,
): FormSubmitOutcome {
  const payload: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};
  for (const field of fields) {
    const kind = widgetKind(field.widget);
    const required = field.required === true;
    if (kind === 'boolean') {
      // false is a value, not an absence.
      payload[field.name] = state.checked[field.name] === true;
      continue;
    }
    const raw = state.text[field.name] ?? '';
    if (raw.trim() === '') {
      if (required) {
        fieldErrors[field.name] = FIELD_ERROR_REQUIRED;
      } else if (kind === 'number') {
        // Optional empty number: declared absent semantics — the key is
        // omitted, never dispatched as '' (a string) or NaN.
        continue;
      } else {
        // Optional empty string-domain value: dispatched as '' (the
        // declared contract semantics for text/date/json fields).
        payload[field.name] = '';
      }
      continue;
    }
    if (kind === 'number') {
      if (!PLAIN_NUMERIC.test(raw.trim()) || !Number.isFinite(Number(raw.trim()))) {
        fieldErrors[field.name] = FIELD_ERROR_NUMERIC;
        continue;
      }
      payload[field.name] = Number(raw.trim());
      continue;
    }
    payload[field.name] = raw;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, payload };
}
