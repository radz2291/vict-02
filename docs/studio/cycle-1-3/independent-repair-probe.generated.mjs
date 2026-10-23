// packages/ui/src/canonical-error.ts
var CanonicalUiError = class extends Error {
  code;
  path;
  constructor(code, message, path) {
    super(`Canonical UI identity error (${code}): ${message}`);
    this.name = "CanonicalUiError";
    this.code = code;
    this.path = path;
  }
};

// packages/ui/src/sha256.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var rotr = (x, n) => x >>> n | x << 32 - n;
function sha256(message) {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const paddedLength = (bytes.length + 9 + 63 & ~63) >>> 0;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296), false);
  let h0 = 1779033703;
  let h1 = 3144134277;
  let h2 = 1013904242;
  let h3 = 2773480762;
  let h4 = 1359893119;
  let h5 = 2600822924;
  let h6 = 528734635;
  let h7 = 1541459225;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const wi15 = w[i - 15];
      const wi2 = w[i - 2];
      const s0 = rotr(wi15, 7) ^ rotr(wi15, 18) ^ wi15 >>> 3;
      const s1 = rotr(wi2, 17) ^ rotr(wi2, 19) ^ wi2 >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = h + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((word) => word.toString(16).padStart(8, "0")).join("");
}

// packages/ui/src/canonical.ts
var seen = /* @__PURE__ */ new Set();
function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}
function canonicalize(value, path = "(root)") {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalUiError("NON_CANONICAL_VALUE", `non-finite number at '${path}'`, path);
    }
    if (Object.is(value, -0)) {
      throw new CanonicalUiError("NON_CANONICAL_VALUE", `negative zero at '${path}' (use 0)`, path);
    }
    return value;
  }
  if (type === "bigint" || type === "function" || type === "symbol" || type === "undefined") {
    throw new CanonicalUiError(
      "NON_CANONICAL_VALUE",
      `the canonical serializable domain rejects ${type} at '${path}'`,
      path
    );
  }
  if (seen.has(value)) {
    throw new CanonicalUiError("CYCLIC_STRUCTURE", `cyclic structure at '${path}'`, path);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new CanonicalUiError("NON_CANONICAL_VALUE", `sparse array at '${path}'`, path);
      }
    }
    seen.add(value);
    try {
      return value.map((item2, index) => canonicalize(item2, `${path}[${index}]`));
    } finally {
      seen.delete(value);
    }
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalUiError(
      "NON_CANONICAL_VALUE",
      `unsupported prototype at '${path}' (plain data only)`,
      path
    );
  }
  const source = value;
  seen.add(value);
  try {
    const out = {};
    for (const key of Object.keys(source).sort()) {
      const item2 = source[key];
      if (item2 !== void 0) out[key] = canonicalize(item2, `${path}.${key}`);
    }
    return out;
  } finally {
    seen.delete(value);
  }
}
function canonicalUiDocument(document2) {
  const bytes = stableJson(document2);
  return { bytes, contentDigest: sha256(bytes) };
}

// packages/ui/src/semantic.ts
var GLOBAL_ATTRIBUTES = [
  "id",
  "title",
  "hidden",
  "role",
  "tabindex",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-hidden",
  "aria-expanded",
  "aria-current",
  "aria-live",
  "aria-disabled",
  "data-test-id"
];
var ELEMENTS = [
  // structure
  { tag: "div" },
  { tag: "section" },
  { tag: "header" },
  { tag: "footer" },
  { tag: "main" },
  { tag: "nav" },
  { tag: "article" },
  { tag: "aside" },
  // text
  { tag: "h1" },
  { tag: "h2" },
  { tag: "h3" },
  { tag: "h4" },
  { tag: "p" },
  { tag: "span" },
  { tag: "strong" },
  { tag: "em" },
  // lists
  { tag: "ul" },
  { tag: "ol" },
  { tag: "li" },
  // media placeholder (declared U1 limit: labeled placeholder only)
  { tag: "img", attributes: ["src", "alt", "width", "height"], leaf: true },
  // form essentials (U2: accessible-form support — submit suppression and
  // autocomplete/aria wiring are first-class attributes)
  { tag: "form", attributes: ["name", "novalidate", "aria-label"] },
  { tag: "label", attributes: ["for"] },
  {
    tag: "input",
    attributes: [
      "type",
      "name",
      "value",
      "placeholder",
      "required",
      "disabled",
      "checked",
      "min",
      "max",
      "step",
      "id",
      "autocomplete",
      "aria-label",
      "aria-describedby"
    ],
    leaf: true
  },
  {
    tag: "select",
    attributes: ["name", "required", "disabled"]
  },
  { tag: "option", attributes: ["value", "selected", "disabled"] },
  {
    tag: "textarea",
    attributes: [
      "name",
      "placeholder",
      "rows",
      "required",
      "disabled",
      "id",
      "aria-label",
      "aria-describedby"
    ],
    leaf: true
  },
  { tag: "fieldset" },
  { tag: "legend", leaf: true },
  // interactive
  { tag: "button", attributes: ["type", "name", "value", "disabled"] },
  { tag: "a", attributes: ["href", "target", "rel"] },
  // table (read-only display essentials)
  { tag: "table" },
  { tag: "thead" },
  { tag: "tbody" },
  { tag: "tr" },
  { tag: "th", attributes: ["scope"] },
  { tag: "td" }
];
function defaultSemanticElementCatalog() {
  return { elements: ELEMENTS, globalAttributes: [...GLOBAL_ATTRIBUTES] };
}

// packages/ui-editor/src/bridge.ts
import {
  UiEditSession as UiEditSession2,
  applyUiEdit as applyUiEdit2,
  canonicalUiDocument as canonicalUiDocument2,
  uiDiagnostic as uiDiagnostic2
} from "@victframework/ui";
var EditorBridge = class {
  #session;
  #store;
  #catalogs;
  #validateDocument;
  #validatedRequests = /* @__PURE__ */ new Set();
  #selectedOccurrence = void 0;
  #listeners = /* @__PURE__ */ new Set();
  /**
   * True for the whole save window (stage → store ack → commit). Edits are
   * REFUSED during that window: a storage callback that re-entered the bridge
   * could otherwise accept an edit between stage and commit, which the commit
   * would then have to reject — discarding it or stranding the acknowledged
   * store against a stale baseline. One synchronous save window, no edits.
   */
  #saveInFlight = false;
  constructor(input) {
    const issues = input.validateDocument?.(input.initial.document) ?? [];
    if (issues.length) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
    this.#session = UiEditSession2.open({ ...input.initial, catalogs: input.catalogs });
    this.#store = input.store;
    this.#catalogs = input.catalogs;
    this.#validateDocument = input.validateDocument;
  }
  subscribe = (listener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getSnapshot = () => ({
    revision: this.#session.workingRevision,
    storedRevision: this.#session.storedRevision,
    dirty: this.#session.isDirty(),
    canUndo: this.#session.canUndo(),
    canRedo: this.#session.canRedo(),
    selectedOccurrence: this.#selectedOccurrence,
    contentDigest: canonicalUiDocument2(this.#session.document).contentDigest
  });
  #emit() {
    for (const listener of this.#listeners) listener();
  }
  get document() {
    return this.#session.document;
  }
  get session() {
    return this.#session;
  }
  /** The working snapshot for canvas rendering (plan recompiled by the host). */
  state() {
    return this.#session.state();
  }
  select(occurrence) {
    this.#selectedOccurrence = occurrence;
    this.#emit();
  }
  /** Apply one assembled transaction draft (expected revision = current working). */
  apply(draft) {
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic2(
            "UI_EDIT_SAVE_IN_PROGRESS",
            "Edit refused: a save is being acknowledged; retry the edit after the save settles.",
            {}
          )
        ]
      };
    }
    const transaction = {
      requestId: draft.requestId,
      expectedDocumentRevision: this.#session.workingRevision,
      ...draft.reason !== void 0 ? { reason: draft.reason } : {},
      commands: draft.commands
    };
    if (this.#validateDocument && !this.#validatedRequests.has(draft.requestId)) {
      const staged = applyUiEdit2(this.#session.state().working, transaction, this.#catalogs);
      if (!staged.ok) return staged;
      const issues = this.#validateDocument(staged.document);
      if (issues.length) return { ok: false, issues };
    }
    const outcome = this.#session.applyTransaction(transaction);
    if (outcome.ok) this.#validatedRequests.add(draft.requestId);
    this.#emit();
    return outcome;
  }
  undo() {
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic2(
            "UI_EDIT_SAVE_IN_PROGRESS",
            "Undo refused: a save is being acknowledged; retry after the save settles.",
            {}
          )
        ]
      };
    }
    const outcome = this.#session.undo();
    this.#emit();
    return outcome;
  }
  redo() {
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic2(
            "UI_EDIT_SAVE_IN_PROGRESS",
            "Redo refused: a save is being acknowledged; retry after the save settles.",
            {}
          )
        ]
      };
    }
    const outcome = this.#session.redo();
    this.#emit();
    return outcome;
  }
  /**
   * Two-phase expected-revision save: the session STAGES the saved bytes,
   * the store (the revision AUTHORITY) checks `expectedStoredRevision`
   * atomically with the write, and the session COMMITS only after the store
   * acknowledged. A failed, rejecting or thrown storage write leaves the
   * working document, dirty state, stored revision and undo/redo continuity
   * untouched; other storage failures are reported truthfully.
   */
  save() {
    const issues = this.#validateDocument?.(this.#session.document) ?? [];
    if (issues.length) return { ok: false, issues };
    const staged = this.#session.stageSave({
      expectedStoredRevision: this.#session.storedRevision
    });
    if (!staged.ok) return staged;
    let persisted;
    let commitFailure;
    this.#saveInFlight = true;
    try {
      persisted = this.#store.save({
        document: staged.staged.document,
        newStoredRevision: staged.staged.storedRevision,
        expectedStoredRevision: staged.staged.fromStoredRevision
      });
      if (persisted.ok) {
        const committed = this.#session.commitSave(staged.staged);
        if (!committed.ok) commitFailure = committed;
      }
    } catch (error) {
      return {
        ok: false,
        issues: [
          {
            code: "UI_STORE_WRITE_FAILED",
            message: `Storage write failed: ${String(error instanceof Error ? error.message : error)}`
          }
        ]
      };
    } finally {
      this.#saveInFlight = false;
      this.#session.releaseSaveWindow();
    }
    if (!persisted.ok) {
      return {
        ok: false,
        issues: [
          {
            code: persisted.code ?? "UI_STORE_WRITE_FAILED",
            message: persisted.reason
          }
        ]
      };
    }
    if (commitFailure !== void 0) {
      return commitFailure;
    }
    this.#emit();
    return {
      ok: true,
      storedRevision: staged.staged.storedRevision,
      document: staged.staged.document,
      contentDigest: staged.staged.contentDigest
    };
  }
  /**
   * Reload from the store: a FRESH session over the authoritative stored
   * bytes (history cleared). An empty or invalid store is reported — never
   * silently treated as a successful reopen.
   */
  reopen() {
    const stored2 = this.#store.load();
    if (stored2.status === "empty") {
      return { ok: false, code: "UI_STORE_EMPTY", message: "No stored document exists." };
    }
    if (stored2.status === "invalid") {
      return {
        ok: false,
        code: "UI_STORE_INVALID",
        message: stored2.message,
        ...stored2.overwritable !== void 0 ? { overwritable: stored2.overwritable } : {},
        ...stored2.storedRevision !== void 0 ? { storedRevision: stored2.storedRevision } : {}
      };
    }
    const issues = this.#validateDocument?.(stored2.document) ?? [];
    if (issues.length) return { ok: false, code: "UI_STORE_INVALID", message: issues.map((issue) => issue.message).join("\n") };
    this.#session = this.#session.reopen({
      document: stored2.document,
      storedRevision: stored2.storedRevision
    });
    this.#validatedRequests.clear();
    this.#selectedOccurrence = void 0;
    this.#emit();
    return { ok: true, storedRevision: stored2.storedRevision };
  }
};

// apps/studio/src/lib/designer/placement.ts
import { uiDiagnostic as uiDiagnostic3 } from "@victframework/ui";

// packages/ui-svelte/src/catalog/components/descriptors.ts
var ABI = ["vict.ui-component-abi@1"];
var catalogButtonDescriptor = {
  id: "vict.catalog.button",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "label", type: "string", default: "" },
    { name: "disabled", type: "boolean", default: false },
    { name: "loading", type: "boolean", default: false }
  ],
  outputs: [
    {
      name: "press",
      payload: "void",
      description: "Fires on activation while not disabled/loading."
    }
  ],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root"]
};
var catalogCheckboxDescriptor = {
  id: "vict.catalog.checkbox",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "checked", type: "boolean", default: false },
    { name: "indeterminate", type: "boolean", default: false }
  ],
  outputs: [
    {
      name: "checkedChange",
      payload: "boolean",
      description: "Fires when the user toggles the checkbox."
    }
  ],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root"],
  inspectionLimits: ["internal focus ring styling"]
};
var catalogSelectDescriptor = {
  id: "vict.catalog.select",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "options", type: "array" },
    { name: "value", type: "string", default: "" },
    { name: "disabled", type: "boolean", default: false }
  ],
  outputs: [
    {
      name: "valueChange",
      payload: "string",
      description: "Fires with the newly selected value."
    }
  ],
  rendererImplementationId: "vict.svelte.catalog",
  slots: ["items"],
  styleTargets: ["root", "content"]
};
var catalogDialogDescriptor = {
  id: "vict.catalog.dialog",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "title", type: "string", default: "" },
    { name: "open", type: "boolean", default: false }
  ],
  inspectionLimits: ["Focus management and closed internal parts are implementation-owned."],
  outputs: [
    {
      name: "openChange",
      payload: "boolean",
      description: "Fires for open requests and Escape/overlay closes."
    }
  ],
  slots: ["body"],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root", "trigger"]
};
var catalogAppShellDescriptor = {
  id: "vict.catalog.appshell",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "title", type: "string", default: "" },
    { name: "navigation", type: "array" },
    { name: "path", type: "string", default: "" },
    { name: "navigationMode", type: "string", default: "sidebar" },
    { name: "navigationAt", type: "string", default: "small" }
  ],
  outputs: [],
  slots: ["content"],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root"]
};
var catalogSwitchDescriptor = {
  id: "vict.catalog.switch",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "checked", type: "boolean", default: false }
  ],
  outputs: [
    {
      name: "checkedChange",
      payload: "boolean",
      description: "Fires when the user flips the switch."
    }
  ],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root"]
};
var catalogToggleDescriptor = {
  id: "vict.catalog.toggle",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "pressed", type: "boolean", default: false }
  ],
  outputs: [
    {
      name: "pressedChange",
      payload: "boolean",
      description: "Fires when the user presses or releases the toggle."
    }
  ],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root"]
};
var catalogRadioGroupDescriptor = {
  id: "vict.catalog.radio-group",
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: [...ABI],
  props: [
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "options", type: "array" },
    { name: "value", type: "string", default: "" }
  ],
  outputs: [
    {
      name: "valueChange",
      payload: "string",
      description: "Fires with the newly selected value."
    }
  ],
  rendererImplementationId: "vict.svelte.catalog",
  styleTargets: ["root"]
};
var b1CatalogDescriptors = [
  catalogButtonDescriptor,
  catalogCheckboxDescriptor,
  catalogSelectDescriptor,
  catalogDialogDescriptor,
  catalogAppShellDescriptor,
  catalogSwitchDescriptor,
  catalogToggleDescriptor,
  catalogRadioGroupDescriptor
];

// packages/ui-svelte/src/catalog/components/b2-descriptors.ts
function descriptor(name, props, outputs, slots, styleTargets = ["root"]) {
  return { id: `vict.catalog.${name}`, revision: "1", abi: "vict.ui-component-abi@1", events: ["vict.ui-component-abi@1"], rendererImplementationId: "vict.svelte.catalog", props, outputs, slots, styleTargets };
}
var b2CatalogDescriptors = [
  descriptor("select-multiple", [{ name: "values", type: "stringList", default: [] }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }, { name: "options", type: "array" }], [{ name: "valuesChange", payload: "stringList" }], ["items"], ["root", "content"]),
  descriptor("select-item", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }], [], ["content"]),
  descriptor("combobox", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }, { name: "options", type: "array" }, { name: "search", type: "string", default: "" }], [{ name: "valueChange", payload: "string" }, { name: "searchChange", payload: "string" }], ["items"], ["root", "content"]),
  descriptor("combobox-multiple", [{ name: "values", type: "stringList", default: [] }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }, { name: "options", type: "array" }, { name: "search", type: "string", default: "" }], [{ name: "valuesChange", payload: "stringList" }, { name: "searchChange", payload: "string" }], ["items"], ["root", "content"]),
  descriptor("combobox-item", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }], [], ["content"]),
  descriptor("toggle-group", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }, { name: "options", type: "array" }], [{ name: "valueChange", payload: "string" }], ["items"], ["root"]),
  descriptor("toggle-group-multiple", [{ name: "values", type: "stringList", default: [] }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }, { name: "options", type: "array" }], [{ name: "valuesChange", payload: "stringList" }], ["items"], ["root"]),
  descriptor("toggle-group-item", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }], [], ["content"]),
  descriptor("accordion", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }], [{ name: "valueChange", payload: "string" }], ["items"], ["root"]),
  descriptor("accordion-multiple", [{ name: "values", type: "stringList", default: [] }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }], [{ name: "valuesChange", payload: "stringList" }], ["items"], ["root"]),
  descriptor("accordion-item", [{ name: "value", type: "string", default: "" }, { name: "label", type: "string", default: "" }, { name: "disabled", type: "boolean", default: false }], [], ["trigger", "content"])
];

// packages/ui-svelte/src/catalog/components/b3-descriptors.ts
var label = { name: "label", type: "string", default: "" };
var disabled = { name: "disabled", type: "boolean", default: false };
var help = ["help"];
var numericProps = [label, { name: "value", type: "number", default: 0 }, { name: "min", type: "number", default: 0 }, { name: "max", type: "number", default: 100 }];
var dateProps = [
  label,
  disabled,
  { name: "locale", type: "string", default: "en-GB" },
  { name: "min", type: "isoDate", default: "" },
  { name: "max", type: "isoDate", default: "" },
  { name: "placeholder", type: "isoDate", default: "" },
  { name: "readonly", type: "boolean", default: false },
  { name: "required", type: "boolean", default: false }
];
var calendarProps = [
  { name: "weekStartsOn", type: "number", default: 1 },
  { name: "numberOfMonths", type: "number", default: 1 }
];
var openProps = [{ name: "open", type: "boolean", default: false }];
var openOutputs = [{ name: "openChange", payload: "boolean" }];
function descriptor2(slug, props, outputs, slots = help, styleTargets = ["root"]) {
  return { id: `vict.catalog.${slug}`, revision: "1", abi: "vict.ui-component-abi@1", events: ["vict.ui-component-abi@1"], rendererImplementationId: "vict.svelte.catalog", props, outputs, slots, styleTargets };
}
var catalogSliderDescriptor = descriptor2("slider", [
  label,
  disabled,
  { name: "value", type: "numberList", default: [] },
  { name: "min", type: "number", default: 0 },
  { name: "max", type: "number", default: 100 },
  { name: "step", type: "number", default: 1 },
  { name: "orientation", type: "string", default: "horizontal" }
], [{ name: "valueChange", payload: "numberList" }, { name: "valueCommit", payload: "numberList" }]);
var catalogMeterDescriptor = descriptor2("meter", numericProps, [], ["content", "help"]);
var catalogProgressDescriptor = descriptor2("progress", [...numericProps, { name: "indeterminate", type: "boolean", default: false }], [], ["content", "help"]);
var catalogPaginationDescriptor = descriptor2("pagination", [
  label,
  { name: "page", type: "number", default: 1 },
  { name: "count", type: "number", default: 0 },
  { name: "perPage", type: "number", default: 10 },
  { name: "siblingCount", type: "number", default: 1 }
], [{ name: "pageChange", payload: "number" }]);
var single = [{ name: "value", type: "isoDate", default: "" }];
var singleOutputs = [{ name: "valueChange", payload: "isoDate" }];
var range = [{ name: "start", type: "isoDate", default: "" }, { name: "end", type: "isoDate", default: "" }];
var rangeOutputs = [{ name: "startChange", payload: "isoDate" }, { name: "endChange", payload: "isoDate" }];
var catalogDateFieldDescriptor = descriptor2("date-field", [...dateProps, ...single], singleOutputs);
var catalogDatePickerDescriptor = descriptor2("date-picker", [...dateProps, ...single, ...calendarProps, ...openProps], [...singleOutputs, ...openOutputs], ["help", "content"], ["root", "content"]);
var catalogCalendarDescriptor = descriptor2("calendar", [...dateProps.filter((prop) => prop.name !== "required"), ...single, ...calendarProps], singleOutputs);
var catalogTimeFieldDescriptor = descriptor2("time-field", [
  label,
  disabled,
  { name: "value", type: "isoTime", default: "" },
  { name: "min", type: "isoTime", default: "" },
  { name: "max", type: "isoTime", default: "" },
  { name: "placeholder", type: "isoTime", default: "" },
  { name: "locale", type: "string", default: "en-GB" },
  { name: "hourCycle", type: "number", default: 24 },
  { name: "granularity", type: "string", default: "minute" },
  { name: "readonly", type: "boolean", default: false },
  { name: "required", type: "boolean", default: false }
], [{ name: "valueChange", payload: "isoTime" }]);
var catalogDateRangeFieldDescriptor = descriptor2("date-range-field", [...dateProps, ...range], rangeOutputs);
var catalogDateRangePickerDescriptor = descriptor2("date-range-picker", [...dateProps, ...range, ...calendarProps, ...openProps], [...rangeOutputs, ...openOutputs], ["help", "content"], ["root", "content"]);
var catalogRangeCalendarDescriptor = descriptor2("range-calendar", [
  ...dateProps.filter((prop) => prop.name !== "required"),
  ...range,
  ...calendarProps,
  { name: "minDays", type: "number", default: 1 },
  { name: "maxDays", type: "number", default: 0 }
], rangeOutputs);
var b3CatalogDescriptors = [catalogSliderDescriptor, catalogMeterDescriptor, catalogProgressDescriptor, catalogPaginationDescriptor, catalogDateFieldDescriptor, catalogDatePickerDescriptor, catalogCalendarDescriptor, catalogTimeFieldDescriptor, catalogDateRangeFieldDescriptor, catalogDateRangePickerDescriptor, catalogRangeCalendarDescriptor];

// packages/ui-svelte/src/catalog/components/b4-descriptors.ts
var b4CatalogDescriptors = [
  {
    "id": "vict.catalog.dropdown-menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.context-menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.menubar",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "loop",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "menus"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.checkbox-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": false
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": false
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "checkedChange",
        "payload": "boolean"
      },
      {
        "name": "indeterminateChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.checkbox-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "values",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "valuesChange",
        "payload": "stringList"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.radio-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.radio-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.separator",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [],
    "outputs": [],
    "slots": [],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.context-menu.checkbox-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": false
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": false
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "checkedChange",
        "payload": "boolean"
      },
      {
        "name": "indeterminateChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.checkbox-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "values",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "valuesChange",
        "payload": "stringList"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.radio-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.radio-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.separator",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [],
    "outputs": [],
    "slots": [],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.menubar.checkbox-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": false
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": false
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "checkedChange",
        "payload": "boolean"
      },
      {
        "name": "indeterminateChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.checkbox-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "values",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "valuesChange",
        "payload": "stringList"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.radio-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.radio-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.separator",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [],
    "outputs": [],
    "slots": [],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.command",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "search",
        "type": "string",
        "default": ""
      },
      {
        "name": "placeholder",
        "type": "string",
        "default": ""
      },
      {
        "name": "loop",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      },
      {
        "name": "searchChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items",
      "empty"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.command.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "keywords",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.command.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "orientation",
        "type": "string",
        "default": "horizontal"
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "openOnHover",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [],
    "slots": [
      "trigger",
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu.link",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "href",
        "type": "string",
        "default": ""
      },
      {
        "name": "active",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "activate",
        "payload": "void"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "orientation",
        "type": "string",
        "default": "horizontal"
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  }
];

// packages/ui-svelte/src/catalog/components/b5-descriptors.ts
var identity = {
  revision: "1",
  abi: "vict.ui-component-abi@1",
  events: ["vict.ui-component-abi@1"],
  rendererImplementationId: "vict.svelte.catalog"
};
var catalogAvatarDescriptor = {
  ...identity,
  id: "vict.catalog.avatar",
  props: [
    { name: "src", type: "string", default: "" },
    { name: "alt", type: "string", default: "" },
    { name: "fallback", type: "string", default: "" },
    { name: "delayMs", type: "number", default: 0 }
  ],
  outputs: [],
  slots: ["fallback"],
  styleTargets: ["root", "image", "fallback"]
};
var catalogAspectRatioDescriptor = {
  ...identity,
  id: "vict.catalog.aspect-ratio",
  props: [
    { name: "ratio", type: "number", default: 1 }
  ],
  outputs: [],
  slots: ["content"],
  styleTargets: ["root"]
};
var catalogSeparatorDescriptor = {
  ...identity,
  id: "vict.catalog.separator",
  props: [
    { name: "orientation", type: "string", default: "horizontal" },
    { name: "decorative", type: "boolean", default: false }
  ],
  outputs: [],
  slots: [],
  styleTargets: ["root"]
};
var catalogLabelDescriptor = {
  ...identity,
  id: "vict.catalog.label",
  props: [
    { name: "for", type: "string", default: "" },
    { name: "label", type: "string", default: "" }
  ],
  outputs: [],
  slots: ["content"],
  styleTargets: ["root"]
};
var catalogScrollAreaDescriptor = {
  ...identity,
  id: "vict.catalog.scroll-area",
  props: [
    { name: "type", type: "string", default: "hover" },
    { name: "direction", type: "string", default: "ltr" },
    { name: "hideDelay", type: "number", default: 600 },
    { name: "horizontal", type: "boolean", default: false }
  ],
  outputs: [],
  slots: ["content"],
  styleTargets: ["root", "viewport"]
};
var catalogToolbarDescriptor = {
  ...identity,
  id: "vict.catalog.toolbar",
  props: [
    { name: "label", type: "string", default: "Tools" },
    { name: "orientation", type: "string", default: "horizontal" },
    { name: "loop", type: "boolean", default: true }
  ],
  outputs: [],
  slots: ["tools"],
  styleTargets: ["root"]
};
var catalogToolbarButtonDescriptor = {
  ...identity,
  id: "vict.catalog.toolbar-button",
  props: [
    { name: "label", type: "string", default: "" },
    { name: "disabled", type: "boolean", default: false }
  ],
  outputs: [
    { name: "press", payload: "void" }
  ],
  slots: ["content"],
  styleTargets: ["root"]
};
var catalogLinkPreviewDescriptor = {
  ...identity,
  id: "vict.catalog.link-preview",
  props: [
    { name: "open", type: "boolean", default: false },
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "title", type: "string", default: "" },
    { name: "description", type: "string", default: "" },
    { name: "href", type: "string", default: "" },
    { name: "openDelay", type: "number", default: 700 },
    { name: "closeDelay", type: "number", default: 300 },
    { name: "side", type: "string", default: "bottom" },
    { name: "sideOffset", type: "number", default: 8 }
  ],
  outputs: [
    { name: "openChange", payload: "boolean" }
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger"]
};
var catalogTooltipDescriptor = {
  ...identity,
  id: "vict.catalog.tooltip",
  props: [
    { name: "open", type: "boolean", default: false },
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "title", type: "string", default: "" },
    { name: "description", type: "string", default: "" },
    { name: "delay", type: "number", default: 700 },
    { name: "side", type: "string", default: "bottom" },
    { name: "sideOffset", type: "number", default: 8 }
  ],
  outputs: [
    { name: "openChange", payload: "boolean" }
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger"]
};
var catalogPopoverDescriptor = {
  ...identity,
  id: "vict.catalog.popover",
  props: [
    { name: "open", type: "boolean", default: false },
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "title", type: "string", default: "" },
    { name: "description", type: "string", default: "" },
    { name: "side", type: "string", default: "bottom" },
    { name: "sideOffset", type: "number", default: 8 }
  ],
  outputs: [
    { name: "openChange", payload: "boolean" }
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger"]
};
var catalogAlertDialogDescriptor = {
  ...identity,
  id: "vict.catalog.alert-dialog",
  props: [
    { name: "open", type: "boolean", default: false },
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "" },
    { name: "title", type: "string", default: "" },
    { name: "description", type: "string", default: "" },
    { name: "cancelLabel", type: "string", default: "Cancel" },
    { name: "confirmLabel", type: "string", default: "Confirm" }
  ],
  outputs: [
    { name: "openChange", payload: "boolean" },
    { name: "confirm", payload: "void" }
  ],
  slots: ["trigger", "body", "cancel", "action"],
  styleTargets: ["root", "trigger", "cancel", "action"]
};
var catalogTabsDescriptor = {
  ...identity,
  id: "vict.catalog.tabs",
  props: [
    { name: "value", type: "string", default: "" },
    { name: "label", type: "string", default: "Sections" },
    { name: "orientation", type: "string", default: "horizontal" },
    { name: "activationMode", type: "string", default: "automatic" },
    { name: "loop", type: "boolean", default: false },
    { name: "disabled", type: "boolean", default: false }
  ],
  outputs: [
    { name: "valueChange", payload: "string" }
  ],
  slots: ["tabs", "panels"],
  styleTargets: ["root", "list"]
};
var catalogTabsTriggerDescriptor = {
  ...identity,
  id: "vict.catalog.tabs-trigger",
  props: [
    { name: "value", type: "string", default: "" },
    { name: "label", type: "string", default: "" },
    { name: "disabled", type: "boolean", default: false }
  ],
  outputs: [],
  slots: ["content"],
  styleTargets: ["root"]
};
var catalogTabsPanelDescriptor = {
  ...identity,
  id: "vict.catalog.tabs-panel",
  props: [
    { name: "value", type: "string", default: "" }
  ],
  outputs: [],
  slots: ["content"],
  styleTargets: ["root"]
};
var catalogCollapsibleDescriptor = {
  ...identity,
  id: "vict.catalog.collapsible",
  props: [
    { name: "open", type: "boolean", default: false },
    { name: "disabled", type: "boolean", default: false },
    { name: "label", type: "string", default: "Details" }
  ],
  outputs: [
    { name: "openChange", payload: "boolean" }
  ],
  slots: ["trigger", "content"],
  styleTargets: ["root", "trigger", "content"]
};
var b5CatalogDescriptors = [
  catalogAvatarDescriptor,
  catalogAspectRatioDescriptor,
  catalogSeparatorDescriptor,
  catalogLabelDescriptor,
  catalogScrollAreaDescriptor,
  catalogToolbarDescriptor,
  catalogToolbarButtonDescriptor,
  catalogLinkPreviewDescriptor,
  catalogTooltipDescriptor,
  catalogPopoverDescriptor,
  catalogAlertDialogDescriptor,
  catalogTabsDescriptor,
  catalogTabsTriggerDescriptor,
  catalogTabsPanelDescriptor,
  catalogCollapsibleDescriptor
];

// audit:catalogs
var catalogDescriptors = [...b1CatalogDescriptors, ...b2CatalogDescriptors, ...b3CatalogDescriptors, ...b4CatalogDescriptors, ...b5CatalogDescriptors];

// apps/studio/src/lib/designer/recipes.ts
var styles = (values) => Object.entries(values).map(([property, value]) => ({
  property,
  value: { type: "text", value }
}));
function textElement(id, tag, text, values = {}) {
  return [
    { kind: "element", id, tag, children: [`${id}-text`], localStyle: styles(values) },
    { kind: "text", id: `${id}-text`, content: { type: "literal", value: text } }
  ];
}
function component(id, family, props) {
  return [{ kind: "component", id, definitionId: `vict.catalog.${family}`, props }];
}
var literal = (value) => ({ type: "literal", value });
var basicRecipes = [
  {
    id: "section",
    label: "Section",
    description: "A vertical container for nested content",
    create: (id) => [
      {
        kind: "element",
        id,
        tag: "section",
        attributes: { "aria-label": "Section" },
        children: [],
        localStyle: styles({
          display: "flex",
          "flex-direction": "column",
          gap: "16px",
          padding: "24px",
          "min-height": "100px",
          "background-color": "#f5f7fb",
          "border-radius": "12px"
        })
      }
    ]
  },
  {
    id: "row",
    label: "Row",
    description: "Arrange children side by side, with wrapping",
    create: (id) => [
      {
        kind: "element",
        id,
        tag: "div",
        children: [],
        localStyle: styles({
          display: "flex",
          "flex-wrap": "wrap",
          gap: "16px",
          "align-items": "center",
          "min-height": "60px"
        })
      }
    ]
  },
  {
    id: "heading",
    label: "Heading",
    description: "A clear title for your screen",
    create: (id) => textElement(id, "h1", "Make something useful.", {
      "font-size": "32px",
      "font-weight": "600",
      "line-height": "1.2",
      margin: "0"
    })
  },
  {
    id: "text",
    label: "Text",
    description: "Supporting copy or a state-bound value",
    create: (id) => textElement(id, "p", "Give your screen a little context.", {
      "font-size": "16px",
      "line-height": "1.6",
      margin: "0",
      color: "#647187"
    })
  },
  {
    id: "input",
    label: "Text input",
    description: "Accessible input connected to message state",
    create: (id) => [
      {
        kind: "element",
        id,
        tag: "input",
        children: [],
        attributes: {
          type: "text",
          "aria-label": "Message",
          placeholder: "Your message",
          value: { type: "ref", path: "state.message" }
        },
        interactions: [
          {
            on: "change",
            action: "setState",
            key: "message",
            value: { type: "ref", path: "state.message" }
          }
        ],
        localStyle: styles({
          padding: "12px",
          "border-radius": "8px",
          border: "1px solid #cbd3e1",
          "font-size": "16px",
          width: "100%",
          "box-sizing": "border-box"
        })
      }
    ]
  },
  {
    id: "button",
    label: "Button",
    description: "Catalog \xB7 declared press action",
    create: (id) => component(id, "button", {
      label: literal("Continue"),
      loading: { type: "ref", path: "state.busy" }
    })
  },
  {
    id: "checkbox",
    label: "Checkbox",
    description: "Catalog \xB7 boolean value and output",
    create: (id) => component(id, "checkbox", { label: literal("I agree to continue"), checked: literal(false) })
  },
  {
    id: "switch",
    label: "Switch",
    description: "Catalog \xB7 a labeled on/off control",
    create: (id) => component(id, "switch", { label: literal("Enable notifications"), checked: literal(false) })
  },
  {
    id: "dialog",
    label: "Dialog",
    description: "Catalog \xB7 compose the body slot",
    create: (id) => seedNodes(id, { family: "dialog", props: { title: "More details", open: false }, slots: { body: [copy("Add your details here.")] } })
  },
  {
    id: "separator",
    label: "Separator",
    description: "Catalog \xB7 a quiet visual divider",
    create: (id) => component(id, "separator", { orientation: literal("horizontal"), decorative: literal(true) })
  }
];
var copy = (text) => ({ text });
var item = (family, label2 = "First option", value = "first") => ({ family, props: { label: label2, value } });
var seed = (family) => {
  const props = {};
  const slots = {};
  const descriptor3 = catalogDescriptors.find((d) => d.id === `vict.catalog.${family}`);
  for (const prop of descriptor3.props) if (prop.type === "stringList" || prop.type === "numberList") props[prop.name] = prop.default ?? [];
  if (descriptor3.props.some((p) => p.name === "label")) props.label = title(family);
  if (descriptor3.props.some((p) => p.name === "title")) props.title = title(family);
  if (descriptor3.props.some((p) => p.name === "description")) props.description = "Add your own content.";
  if (family === "avatar") {
    props.fallback = "VI";
    props.alt = "Profile";
  }
  if (family === "slider") props.value = [25];
  if (family === "meter" || family === "progress") props.value = 40;
  if (family === "pagination") props.count = 100;
  if (family === "label") props.label = "Field label";
  if (family === "link-preview" || family === "navigation-menu.link") props.href = "#";
  if (family === "time-field") props.value = "09:00";
  if (["date-field", "date-picker", "calendar"].includes(family)) props.value = "2026-10-23";
  if (["date-range-field", "date-range-picker", "range-calendar"].includes(family)) {
    props.start = "2026-10-23";
    props.end = "2026-10-25";
  }
  if (/^(select|combobox|toggle-group)(-multiple)?$/.test(family)) {
    const child = family.replace("-multiple", "") + "-item";
    slots.items = [item(child), item(child, "Second option", "second")];
  }
  if (family === "accordion" || family === "accordion-multiple") slots.items = [seed("accordion-item")];
  if (family === "accordion-item") {
    props.value = "first";
    props.label = "Details";
    slots.content = [copy("Expandable content")];
  }
  if (family === "tabs") {
    props.value = "first";
    slots.tabs = [item("tabs-trigger", "First tab")];
    slots.panels = [{ family: "tabs-panel", props: { value: "first" }, slots: { content: [copy("Tab content")] } }];
  }
  if (family === "tabs-trigger" || family === "tabs-panel") props.value = "first";
  if (family === "tabs-panel") slots.content = [copy("Tab content")];
  if (family === "toolbar") slots.tools = [{ family: "toolbar-button", props: { label: "Action" } }];
  if (family === "menubar") slots.menus = [seed("menubar.menu")];
  if (family === "menubar.menu") {
    props.value = "file";
    props.label = "File";
    slots.items = [item("menubar.item", "New item")];
  }
  if (["dropdown-menu", "context-menu"].includes(family)) slots.items = [item(`${family}.item`, "New item")];
  if (/^(dropdown-menu|context-menu|menubar)\.(sub|group|checkbox-group|radio-group)$/.test(family)) {
    const prefix = family.split(".")[0];
    const child = family.endsWith("checkbox-group") ? "checkbox-item" : family.endsWith("radio-group") ? "radio-item" : "item";
    slots.items = [item(`${prefix}.${child}`)];
  }
  if (family === "command" || family === "command.group") slots.items = [item("command.item", "Choose an action")];
  if (family === "command") props.placeholder = "Search actions\u2026";
  if (family === "navigation-menu" || family === "navigation-menu.sub") slots.items = [seed("navigation-menu.item")];
  if (family === "navigation-menu.item") {
    props.value = "first";
    slots.content = [seed("navigation-menu.link")];
  }
  if (["aspect-ratio", "scroll-area", "collapsible", "popover", "link-preview"].includes(family)) slots.content = [copy("Your content")];
  if (family === "alert-dialog") slots.body = [copy("Review this local preview action before continuing.")];
  return { family, props, slots };
};
function title(family) {
  return family.replace(/[.-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function seedNodes(rootId, source, state = {}) {
  if (source.text !== void 0) return textElement(rootId, "p", source.text);
  const descendants = [];
  const slots = Object.fromEntries(Object.entries(source.slots ?? {}).map(([name, children]) => {
    const ids = children.map((child, index) => {
      const id = `${rootId}-${name}-${index + 1}`;
      descendants.push(...seedNodes(id, child, state));
      return id;
    });
    return [name, { name, children: ids }];
  }));
  const descriptor3 = catalogDescriptors.find((entry) => entry.id === `vict.catalog.${source.family}`);
  const props = {};
  const outputs = {};
  for (const [name, value] of Object.entries(source.props ?? {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      props[name] = { type: "literal", value };
    } else {
      const prop = descriptor3.props.find((prop2) => prop2.name === name);
      if (prop.type !== "stringList" && prop.type !== "numberList") throw Error("A recipe list needs a typed presentation value.");
      const key = `catalog_${rootId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${name}`;
      state[key] = { key, type: prop.type, initial: value };
      props[name] = { type: "ref", path: `state.${key}` };
      const output = descriptor3.outputs?.find((output2) => output2.name === `${name}Change` && output2.payload === prop.type);
      if (output) outputs[output.name] = { setState: { key } };
    }
  }
  return [{
    kind: "component",
    id: rootId,
    definitionId: `vict.catalog.${source.family}`,
    props,
    ...Object.keys(outputs).length ? { outputs } : {},
    ...Object.keys(slots).length ? { slots } : {}
  }, ...descendants];
}
function placements(family) {
  const under = (parents, slotName) => parents.map((parent) => ({ definitionId: `vict.catalog.${parent}`, slotName }));
  if (family === "select-item") return under(["select", "select-multiple"], "items");
  if (family === "combobox-item") return under(["combobox", "combobox-multiple"], "items");
  if (family === "toggle-group-item") return under(["toggle-group", "toggle-group-multiple"], "items");
  if (family === "accordion-item") return under(["accordion", "accordion-multiple"], "items");
  if (family === "tabs-trigger") return under(["tabs"], "tabs");
  if (family === "tabs-panel") return under(["tabs"], "panels");
  if (family === "toolbar-button") return under(["toolbar"], "tools");
  if (family === "menubar.menu") return under(["menubar"], "menus");
  if (/^(dropdown-menu|context-menu|menubar)\./.test(family)) {
    const prefix = family.split(".")[0];
    if (family.endsWith(".radio-item")) return under([`${prefix}.radio-group`], "items");
    const parents = [prefix === "menubar" ? "menubar.menu" : prefix, `${prefix}.sub`, `${prefix}.group`];
    if (family.endsWith(".checkbox-item")) parents.push(`${prefix}.checkbox-group`);
    return under(parents, "items");
  }
  if (family === "command.item" || family === "command.group") return under(["command", "command.group"], "items");
  if (family === "navigation-menu.item" || family === "navigation-menu.sub") return under(["navigation-menu", "navigation-menu.sub"], "items");
  if (family === "navigation-menu.link") return under(["navigation-menu.item"], "content");
  return void 0;
}
var existing = new Set(basicRecipes.map((recipe) => recipe.id));
var catalogRecipes = catalogDescriptors.filter((descriptor3) => !["vict.catalog.radio-group", "vict.catalog.appshell"].includes(descriptor3.id)).map((descriptor3) => descriptor3.id.replace("vict.catalog.", "")).filter((family) => !existing.has(family)).map((family) => ({
  id: family,
  label: title(family),
  description: `Catalog \xB7 ${placements(family) ? "part for a compatible component slot" : "editable properties, declared slots and events"}`,
  placements: placements(family),
  create: (id) => seedNodes(id, seed(family)),
  initialState: (id) => {
    const state = {};
    seedNodes(id, seed(family), state);
    return state;
  }
}));
var screenRecipes = [...basicRecipes, ...catalogRecipes];

// apps/studio/src/lib/designer/placement.ts
var rules = new Map(screenRecipes.flatMap((recipe) => {
  const node = recipe.placements && recipe.create("placement-rule")[0];
  return node?.kind === "component" ? [[node.definitionId, recipe.placements]] : [];
}));
function screenPlacementIssues(document2) {
  const issues = [];
  function visit(id, context, fills, ancestors, path) {
    if (ancestors.has(id)) return;
    const node = document2.nodes[id];
    if (!node) return;
    const nextAncestors = /* @__PURE__ */ new Set([...ancestors, id]);
    const children = (ids, nextContext = context, nextFills = fills) => ids.forEach((child, index) => visit(child, nextContext, nextFills, nextAncestors, `${path}/${index}:${child}`));
    if (node.kind === "component") {
      const placements2 = rules.get(node.definitionId);
      if (placements2) {
        const provider = [...context].reverse().find((entry) => placements2.some((placement) => placement.definitionId === entry.definitionId));
        if (!provider || !placements2.some((placement) => placement.definitionId === provider.definitionId && placement.slotName === provider.slotName)) {
          issues.push(uiDiagnostic3(
            "UI_EDIT_VALIDATION_FAILED",
            `${node.definitionId} (${node.id}) requires its declared component context and slot. Keep this part aside or place it inside a compatible composition.`,
            { hostCode: "STUDIO_COMPONENT_CONTEXT", documentId: document2.id, nodeId: node.id, path }
          ));
        }
      }
      const definition = document2.componentDefinitions[node.definitionId];
      if (definition) {
        const localFills = {};
        for (const [name, fill] of Object.entries(node.slots ?? {})) localFills[name] = { children: fill.children, scope: fills };
        children([definition.root], context, localFills);
      } else {
        for (const [slotName, fill] of Object.entries(node.slots ?? {}))
          children(fill.children, [...context, { definitionId: node.definitionId, slotName }]);
      }
    } else if (node.kind === "element" || node.kind === "portal") children(node.children);
    else if (node.kind === "conditional") node.branches.forEach((branch) => children(branch.children));
    else if (node.kind === "repeat") children([node.templateRoot]);
    else if (node.kind === "slot") {
      const fill = fills[node.name];
      if (fill?.children.length) children(fill.children, context, fill.scope);
      else children(node.fallback ?? []);
    }
  }
  visit(document2.root, [], {}, /* @__PURE__ */ new Set(), document2.root);
  return issues;
}

// packages/ui-editor/src/inspector-ux.ts
function nodeLabel(document2, id, labels = {}) {
  if (labels.nodes?.[id]) return labels.nodes[id];
  const node = document2.nodes[id];
  if (!node) return "Unavailable element";
  if (node.kind === "text")
    return node.content.type === "literal" ? node.content.value || "Empty text" : "Bound text";
  if (node.kind === "component") {
    if (labels.definitions?.[node.definitionId]) return labels.definitions[node.definitionId];
    for (const name of ["label", "title", "alt"]) {
      const expression = node.props?.[name];
      if (expression?.type === "literal" && typeof expression.value === "string" && expression.value.trim())
        return expression.value;
    }
    const family = node.definitionId.startsWith("vict.catalog.") ? node.definitionId.slice("vict.catalog.".length).split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") : "Component";
    const value = node.props?.value;
    return value?.type === "literal" && typeof value.value === "string" && value.value.trim() ? `${family} \xB7 ${value.value}` : family;
  }
  if (node.kind === "element") {
    const accessible = node.attributes?.["aria-label"];
    if (typeof accessible === "string" && accessible) return accessible;
    const role = {
      h1: "Heading",
      h2: "Heading",
      h3: "Heading",
      p: "Paragraph",
      button: "Button",
      a: "Link",
      section: "Section",
      article: "Card",
      main: "Page",
      div: node.localStyle?.some(
        (d) => d.property === "display" && d.value.type === "text" && d.value.value === "flex"
      ) ? node.localStyle?.some(
        (d) => d.property === "flex-direction" && d.value.type === "text" && d.value.value === "column"
      ) ? "Stack" : "Row" : "Container",
      input: "Input",
      form: "Form",
      nav: "Navigation"
    }[node.tag] ?? node.tag;
    const text = node.children.map((child) => document2.nodes[child]).find((child) => child?.kind === "text");
    return text?.kind === "text" && text.content.type === "literal" && text.content.value ? `${role} \xB7 ${text.content.value}` : role;
  }
  return {
    repeat: "Repeated content",
    conditional: "Conditional content",
    slot: "Slot",
    portal: "Overlay"
  }[node.kind] ?? node.kind;
}
var styleGroups = [
  {
    title: "Typography",
    controls: [
      { property: "font-size", label: "Text size", kind: "number" },
      { property: "color", label: "Text color", kind: "color" },
      { property: "font-family", label: "Font family", kind: "text" },
      {
        property: "font-weight",
        label: "Weight",
        kind: "choice",
        options: ["400", "500", "600", "700", "800"]
      },
      { property: "line-height", label: "Line height", kind: "number" },
      {
        property: "text-align",
        label: "Text alignment",
        kind: "segments",
        options: ["left", "center", "right", "justify"]
      }
    ]
  },
  {
    title: "Fill & border",
    controls: [
      { property: "background-color", label: "Background", kind: "color" },
      { property: "border-color", label: "Border color", kind: "color" },
      { property: "border-width", label: "Border width", kind: "number" },
      {
        property: "border-style",
        label: "Border style",
        kind: "choice",
        options: ["none", "solid", "dashed", "dotted"]
      },
      { property: "border-radius", label: "Corner radius", kind: "number" }
    ]
  },
  {
    title: "Size & spacing",
    controls: [
      ...["width", "height", "min-width", "max-width"].map((property) => ({
        property,
        label: property.replace("-", " "),
        kind: "number"
      })),
      { property: "gap", label: "Gap between children", kind: "number" }
    ]
  },
  {
    title: "Layout",
    controls: [
      {
        property: "display",
        label: "Layout",
        kind: "choice",
        options: ["block", "flex", "grid", "inline", "none"]
      },
      {
        property: "flex-direction",
        label: "Direction",
        kind: "segments",
        options: ["row", "column", "row-reverse", "column-reverse"]
      },
      {
        property: "flex-wrap",
        label: "Wrapping",
        kind: "segments",
        options: ["nowrap", "wrap", "wrap-reverse"]
      },
      {
        property: "align-items",
        label: "Align children",
        kind: "segments",
        options: ["start", "center", "end", "stretch"]
      },
      {
        property: "justify-content",
        label: "Distribute children",
        kind: "segments",
        options: ["start", "center", "end", "space-between", "space-around"]
      },
      { property: "grid-template-columns", label: "Grid columns", kind: "text" }
    ]
  }
];

// packages/ui-editor/src/composition.ts
function compositionChildren(node) {
  return node.kind === "element" || node.kind === "portal" ? node.children : node.kind === "component" ? Object.values(node.slots ?? {}).flatMap((fill) => fill.children) : [];
}
function compositionTargets(document2, descriptors, exclude, labels = {}) {
  const excluded = /* @__PURE__ */ new Set();
  const walk = (id) => {
    if (excluded.has(id)) return;
    excluded.add(id);
    const node = document2.nodes[id];
    if (node) compositionChildren(node).forEach(walk);
  };
  if (exclude) walk(exclude);
  return Object.values(document2.nodes).filter((node) => !excluded.has(node.id)).flatMap((node) => {
    if (node.kind === "element" && [
      "main",
      "section",
      "div",
      "article",
      "aside",
      "header",
      "footer",
      "nav",
      "form",
      "fieldset",
      "ul",
      "ol",
      "li"
    ].includes(node.tag))
      return [
        {
          nodeId: node.id,
          label: node.id === document2.root ? "Screen" : compositionName(document2, node.id, labels)
        }
      ];
    if (node.kind === "component")
      return (descriptors.find((d) => d.id === node.definitionId)?.slots ?? []).map(
        (slotName) => ({
          nodeId: node.id,
          slotName,
          label: `${compositionName(document2, node.id, labels)} / ${slotName.replace(/^./, (c) => c.toUpperCase())}`
        })
      );
    return [];
  });
}
function compositionName(document2, id, labels = {}) {
  const name = nodeLabel(document2, id, labels);
  const peers = Object.keys(document2.nodes).filter(
    (key) => nodeLabel(document2, key, labels) === name
  );
  return peers.length > 1 ? `${name} ${peers.indexOf(id) + 1}` : name;
}
function moveRelative(document2, nodeId, anchorId, placement, descriptors) {
  if (nodeId === anchorId || nodeId === document2.root) return void 0;
  const targets = compositionTargets(document2, descriptors, nodeId);
  if (placement === "inside") {
    const matches = targets.filter((target) => target.nodeId === anchorId);
    if (matches.length !== 1) return void 0;
    return { op: "move", nodeId, newParentId: anchorId, slotName: matches[0].slotName };
  }
  const parent = compositionParent(document2, anchorId);
  if (!parent || !targets.some(
    (target) => target.nodeId === parent.nodeId && target.slotName === parent.slotName
  ))
    return void 0;
  let index = parent.children.indexOf(anchorId) + (placement === "after" ? 1 : 0);
  const current = compositionParent(document2, nodeId);
  if (current?.nodeId === parent.nodeId && current.slotName === parent.slotName && current.children.indexOf(nodeId) < index)
    index--;
  return { op: "move", nodeId, newParentId: parent.nodeId, slotName: parent.slotName, index };
}
function compositionParent(document2, nodeId) {
  for (const node of Object.values(document2.nodes)) {
    if ((node.kind === "element" || node.kind === "portal") && node.children.includes(nodeId))
      return { nodeId: node.id, children: node.children };
    if (node.kind === "component") {
      for (const [slotName, fill] of Object.entries(node.slots ?? {}))
        if (fill.children.includes(nodeId))
          return { nodeId: node.id, slotName, children: fill.children };
    }
  }
  return void 0;
}
function detachSlotContent(requestId, document2, nodeId) {
  const parent = compositionParent(document2, nodeId);
  if (!parent?.slotName || document2.nodes[parent.nodeId]?.kind !== "component") return void 0;
  return {
    requestId,
    reason: "Keep slot content aside",
    commands: [
      {
        op: "fillSlot",
        nodeId: parent.nodeId,
        slotName: parent.slotName,
        children: parent.children.filter((id) => id !== nodeId)
      }
    ]
  };
}

// <stdin>
var catalogs = { elements: defaultSemanticElementCatalog(), extensions: catalogDescriptors };
var document = { schema: "vict.ui-document@1", id: "independent", revision: "r1", root: "screen", nodes: { screen: { id: "screen", kind: "element", tag: "main", children: ["select", "section"] }, section: { id: "section", kind: "element", tag: "section", children: [] }, select: { id: "select", kind: "component", definitionId: "vict.catalog.select-multiple", props: {}, slots: { items: { name: "items", children: ["item", "other"] } } }, item: { id: "item", kind: "component", definitionId: "vict.catalog.select-item", props: { value: { type: "literal", value: "one" } } }, other: { id: "other", kind: "component", definitionId: "vict.catalog.select-item", props: { value: { type: "literal", value: "two" } } } }, componentDefinitions: {}, styleSources: {}, assets: {}, tokens: {}, conditions: {}, localState: {} };
var stored = { document, storedRevision: "r1" };
var store = { load: () => ({ status: "loaded", ...stored }), save: (i) => {
  stored = { document: i.document, storedRevision: i.newStoredRevision };
  return { ok: true, storedRevision: i.newStoredRevision };
} };
var bridge = new EditorBridge({ catalogs, store, initial: stored, validateDocument: screenPlacementIssues });
var records = [];
var check = (name, pass, data = {}) => {
  records.push({ name, pass, ...data });
  if (!pass) throw Error(name);
};
check("valid contextual initial source", !screenPlacementIssues(document).length);
var before = canonicalUiDocument(document).contentDigest;
var badMove = moveRelative(document, "item", "screen", "inside", catalogDescriptors);
var denied = bridge.apply({ requestId: "bad", commands: [badMove] });
check("shared move command refused before source/history", !denied.ok && canonicalUiDocument(bridge.document).contentDigest === before && !bridge.getSnapshot().canUndo, { issues: denied.issues });
var detach = bridge.apply(detachSlotContent("detach", bridge.document, "item"));
check("keep aside remains legal", detach.ok);
var aside = canonicalUiDocument(bridge.document).contentDigest;
check("reuse into wrong parent refused", !bridge.apply({ requestId: "reuse-bad", commands: [{ op: "move", nodeId: "item", newParentId: "screen" }] }).ok && canonicalUiDocument(bridge.document).contentDigest === aside);
check("reuse into compatible slot allowed", bridge.apply({ requestId: "reuse-good", commands: [{ op: "move", nodeId: "item", newParentId: "select", slotName: "items" }] }).ok);
check("valid Undo and Redo remain usable", bridge.undo().ok && bridge.redo().ok);
var saved = bridge.save();
check("valid save/reopen preserved", saved.ok && bridge.reopen().ok);
var invalid = { ...document, nodes: { ...document.nodes, screen: { ...document.nodes.screen, children: ["select", "section", "item"] }, select: { ...document.nodes.select, slots: { items: { name: "items", children: ["other"] } } } } };
check("invalid source replace refused", !bridge.apply({ requestId: "source-bad", commands: [{ op: "replaceDocument", document: invalid }] }).ok);
stored = { document: invalid, storedRevision: "bad-r" };
check("invalid external saved source reopen refused", !bridge.reopen().ok);
var wrapped = { ...document, nodes: { ...document.nodes, select: { ...document.nodes.select, slots: { items: { name: "items", children: ["wrapper", "other"] } } }, wrapper: { id: "wrapper", kind: "element", tag: "div", children: ["item"] } } };
check("neutral wrapper retains provider", !screenPlacementIssues(wrapped).length);
var wrongWrapper = { ...wrapped, nodes: { ...wrapped.nodes, select: { ...wrapped.nodes.select, slots: { items: { name: "items", children: ["other"] } } }, section: { ...wrapped.nodes.section, children: ["wrapper"] } } };
check("neutral wrapper cannot conceal invalid parent", screenPlacementIssues(wrongWrapper).length > 0);
var local = { ...document, componentDefinitions: { Local: { id: "Local", revision: "1", root: "template", props: [], slots: {} } }, nodes: { ...document.nodes, select: { ...document.nodes.select, slots: { items: { name: "items", children: ["instance", "other"] } } }, template: { id: "template", kind: "element", tag: "div", children: ["item"] }, instance: { id: "instance", kind: "component", definitionId: "Local", props: {} } } };
check("local definition inherits valid caller context", !screenPlacementIssues(local).length);
var localBad = { ...local, nodes: { ...local.nodes, select: { ...local.nodes.select, slots: { items: { name: "items", children: ["other"] } } }, section: { ...local.nodes.section, children: ["instance"] } } };
check("same local definition refuses invalid caller context", screenPlacementIssues(localBad).length > 0);
console.log(JSON.stringify(records));
var stdin_default = records;
export {
  stdin_default as default
};
