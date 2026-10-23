// packages/ui/src/document.ts
var UI_DOCUMENT_SCHEMA = "vict.ui-document@1";
var UI_RENDER_PLAN_SCHEMA = "vict.ui-render-plan@1";

// packages/ui/src/values.ts
var ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var ISO_TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;
function isIsoCalendarDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = month === 2 ? year % 4 === 0 && year % 100 !== 0 || year % 400 === 0 ? 29 : 28 : month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
  return day <= daysInMonth;
}
function isIsoClockTime(value) {
  if (!ISO_TIME_PATTERN.test(value)) return false;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  const second = value.length >= 6 ? Number(value.slice(6, 8)) : 0;
  return hour < 24 && minute < 60 && second < 60;
}
function isUiValueType(type) {
  return type === "string" || type === "number" || type === "boolean" || type === "stringList" || type === "numberList" || type === "isoDate" || type === "isoTime";
}
function isUiValueOfType(value, type) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "stringList":
      return Array.isArray(value) && Array.from(value).every((member) => typeof member === "string");
    case "numberList":
      return Array.isArray(value) && Array.from(value).every((member) => typeof member === "number" && Number.isFinite(member));
    case "isoDate":
      return typeof value === "string" && (value === "" || isIsoCalendarDate(value));
    case "isoTime":
      return typeof value === "string" && (value === "" || isIsoClockTime(value));
    default:
      return false;
  }
}

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
      return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
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
      const item = source[key];
      if (item !== void 0) out[key] = canonicalize(item, `${path}.${key}`);
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

// packages/ui/src/diagnostics.ts
function uiDiagnostic(code, message, details = {}) {
  return { code, message, severity: severityFor(code), ...details };
}
var WARNING_CODES = /* @__PURE__ */ new Set([
  "UI_DOC_UNSUPPORTED_FEATURE",
  "UI_STYLE_PROPERTY_UNSUPPORTED"
]);
function severityFor(code) {
  return WARNING_CODES.has(code) ? "warning" : "error";
}
function hasErrors(diagnostics) {
  return diagnostics.some((d) => d.severity === "error");
}

// packages/ui/src/expressions.ts
var PRIMITIVES = /* @__PURE__ */ new Set(["string", "number", "boolean"]);
function literalType(value) {
  if (value === null) return "null";
  return typeof value;
}
function typesCompatible(expected, actual) {
  if (expected === actual) return true;
  if (expected === "any" || actual === "any" || actual === "unknown") return true;
  if (actual === "null") return true;
  if (expected === "array") return actual === "array" || actual === "stringList" || actual === "numberList";
  return PRIMITIVES.has(expected) && PRIMITIVES.has(actual) && expected === actual;
}
function splitRef(path) {
  return path.split(".");
}
function checkExpression(expression, catalogs2, scope, documentId, nodeId) {
  const issues = [];
  const walk = (expr, localScope) => {
    switch (expr.type) {
      case "literal":
        return literalType(expr.value);
      case "ref": {
        return checkRef(expr.path, catalogs2, localScope, documentId, nodeId, issues);
      }
      case "compare": {
        const left = walk(expr.left, localScope);
        const right = walk(expr.right, localScope);
        if (left !== "unknown" && right !== "unknown" && left !== "null" && right !== "null" && !typesCompatible(left, right)) {
          issues.push(
            uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Comparison compares ${left} with ${right}.`, {
              documentId,
              nodeId,
              expected: left,
              actual: right
            })
          );
        }
        return "boolean";
      }
      case "boolean": {
        for (const term of expr.terms) {
          const termType = walk(term, localScope);
          if (termType !== "boolean" && termType !== "unknown" && termType !== "any") {
            issues.push(
              uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Boolean operator requires boolean terms.`, {
                documentId,
                nodeId,
                expected: "boolean",
                actual: termType
              })
            );
          }
        }
        return "boolean";
      }
      case "conditionalValue": {
        const whenType = walk(expr.when, localScope);
        if (whenType !== "boolean" && whenType !== "unknown" && whenType !== "any") {
          issues.push(
            uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Condition must be boolean.`, {
              documentId,
              nodeId,
              expected: "boolean",
              actual: whenType
            })
          );
        }
        const thenType = walk(expr.then, localScope);
        walk(expr.otherwise, localScope);
        return thenType;
      }
      case "op": {
        if (catalogs2.opNames !== void 0 && !catalogs2.opNames.includes(expr.name)) {
          issues.push(
            uiDiagnostic(
              "UI_EXPR_UNKNOWN_REFERENCE",
              `Registered operation '${expr.name}' is not declared by the catalogs.`,
              { documentId, nodeId, path: `op:${expr.name}` }
            )
          );
        }
        for (const arg of expr.args) walk(arg, localScope);
        return "unknown";
      }
    }
  };
  walk(expression, scope);
  return issues;
}
function checkRef(path, catalogs2, scope, documentId, nodeId, issues) {
  const parts = splitRef(path);
  const head = parts[0];
  const unknown = () => {
    issues.push(
      uiDiagnostic(
        "UI_EXPR_UNKNOWN_REFERENCE",
        `Reference '${path}' does not resolve in this scope.`,
        {
          documentId,
          nodeId,
          path
        }
      )
    );
    return "unknown";
  };
  if (head === "view" || head === "record") {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_SCOPE_VIOLATION",
          `view/record data is not visible inside a definition registry (use typed props).`,
          { documentId, nodeId, scope: path }
        )
      );
      return "unknown";
    }
    const fields = catalogs2.viewFields ?? {};
    const fieldType = parts.length === 2 ? fields[parts[1]] : void 0;
    if (fieldType === void 0) return unknown();
    return fieldType;
  }
  if (head === "repeat") {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_SCOPE_VIOLATION",
          `repeat items are not visible inside a definition registry (use typed props).`,
          { documentId, nodeId, scope: path }
        )
      );
      return "unknown";
    }
    if (parts.length !== 3) return unknown();
    const itemType = scope.repeatItems[parts[1]];
    if (itemType === void 0) return unknown();
    const fieldType = itemType[parts[2]];
    if (fieldType === void 0) return unknown();
    return fieldType;
  }
  if (head === "prop") {
    if (!scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_SCOPE_VIOLATION",
          `prop.* is only visible inside a component definition registry (typed props).`,
          { documentId, nodeId, scope: path }
        )
      );
      return "unknown";
    }
    if (parts.length !== 2) return unknown();
    return scope.propTypes === void 0 ? "any" : scope.propTypes[parts[1]] ?? unknown();
  }
  if (head === "state") {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_SCOPE_VIOLATION",
          `document-level state is not visible inside a definition registry (use typed props).`,
          { documentId, nodeId, scope: path }
        )
      );
      return "unknown";
    }
    if (parts.length !== 2) return unknown();
    return catalogs2.stateTypes === void 0 ? "any" : catalogs2.stateTypes[parts[1]] ?? unknown();
  }
  if (head === "token") {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_SCOPE_VIOLATION",
          `token.* is a document-level scope, not visible inside a definition registry.`,
          { documentId, nodeId, scope: path }
        )
      );
      return "unknown";
    }
    return "string";
  }
  if (head === "$output") {
    if (scope.output === void 0) {
      issues.push(
        uiDiagnostic(
          "UI_COMPONENT_OUTPUT_PAYLOAD_INVALID",
          `'$output' resolves only inside output binding value/input expressions.`,
          { documentId, nodeId, path }
        )
      );
      return "unknown";
    }
    if (scope.output === "void" || parts.length !== 1) {
      issues.push(uiDiagnostic("UI_COMPONENT_OUTPUT_PAYLOAD_INVALID", "This output has no addressable payload.", { documentId, nodeId, path }));
      return "unknown";
    }
    if (scope.output === "unknown") return "unknown";
    return scope.output;
  }
  return unknown();
}
function checkExpressionTarget(expression, expected, catalogs2, scope, documentId, nodeId, code = "UI_EXPR_TYPE_MISMATCH") {
  const issues = checkExpression(expression, catalogs2, scope, documentId, nodeId);
  if (expected === "array" && expression.type !== "ref") {
    issues.push(uiDiagnostic("UI_COMPONENT_BINDING_INCOMPATIBLE", "Structured array props require a reference to declared array data.", { documentId, nodeId }));
    return issues;
  }
  const reject = (actual) => issues.push(uiDiagnostic(
    code,
    `Expression expects ${expected}; received ${actual}.`,
    { documentId, nodeId, expected, actual }
  ));
  const inspect = (expr) => {
    if (expr.type === "conditionalValue") {
      inspect(expr.then);
      inspect(expr.otherwise);
      return;
    }
    if (expr.type === "literal") {
      if ((expected === "isoDate" || expected === "isoTime") && typeof expr.value === "string" && !isUiValueOfType(expr.value, expected)) {
        issues.push(uiDiagnostic("UI_DOC_INVALID_LITERAL", `Literal is not a valid ${expected}.`, { documentId, nodeId, expected }));
        return;
      }
      if (expected === "array" || !isUiValueOfType(expr.value, expected)) reject(expr.value === null ? "null" : typeof expr.value);
      return;
    }
    if (expected === "array" && expr.type !== "ref") {
      reject(expr.type);
      return;
    }
    let actual = "unknown";
    if (expr.type === "ref") actual = checkRef(expr.path, catalogs2, scope, documentId, nodeId, []);
    if (expr.type === "boolean" || expr.type === "compare") actual = "boolean";
    if (actual !== "unknown" && actual !== "any" && !typesCompatible(expected, actual)) reject(actual);
  };
  inspect(expression);
  return issues;
}
function repeatExpressionFields(collection, fields = {}) {
  if (collection.type !== "ref") return {};
  const [namespace, name, extra] = collection.path.split(".");
  if (namespace !== "view" && namespace !== "record" || !name || extra !== void 0) return {};
  const prefix = `${name}.`;
  return Object.fromEntries(Object.entries(fields).filter(([field]) => field.startsWith(prefix)).map(([field, type]) => [field.slice(prefix.length), type]));
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
function allowedAttributes(catalog, tag) {
  const def = catalog.elements.find((element) => element.tag === tag);
  return /* @__PURE__ */ new Set([...catalog.globalAttributes, ...def?.attributes ?? [], "data-*"]);
}
function isAllowedAttribute(catalog, tag, name) {
  if (name.startsWith("data-")) return true;
  return allowedAttributes(catalog, tag).has(name);
}
function isKnownElement(catalog, tag) {
  return catalog.elements.some((element) => element.tag === tag);
}
function isLeafElement(catalog, tag) {
  return catalog.elements.find((element) => element.tag === tag)?.leaf === true;
}

// packages/ui/src/validate.ts
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function registryOf(document2, key) {
  const value = document2[key];
  return isPlainObject(value) ? value : {};
}
function validateUiDocument(input, catalogs2) {
  const issues = [];
  if (!isPlainObject(input)) {
    return [
      uiDiagnostic("UI_DOC_UNKNOWN_SCHEMA", "A UI document must be a plain object.", {
        schema: "(not an object)",
        supported: [UI_DOCUMENT_SCHEMA]
      })
    ];
  }
  const document2 = input;
  if (document2.schema !== UI_DOCUMENT_SCHEMA) {
    issues.push(
      uiDiagnostic("UI_DOC_UNKNOWN_SCHEMA", `Unsupported UI document schema.`, {
        schema: String(document2.schema),
        supported: [UI_DOCUMENT_SCHEMA]
      })
    );
    return issues;
  }
  if (!nonEmptyString(document2.id)) {
    issues.push(
      uiDiagnostic("UI_DOC_REFERENCE_DANGLING", "A UI document must declare a non-empty id.", {
        documentId: String(document2.id ?? ""),
        reference: "document.id"
      })
    );
  }
  if (!nonEmptyString(document2.revision)) {
    issues.push(
      uiDiagnostic(
        "UI_DOC_REFERENCE_DANGLING",
        "A UI document must declare a non-empty revision.",
        {
          documentId: String(document2.id ?? ""),
          reference: "document.revision"
        }
      )
    );
  }
  if (!nonEmptyString(document2.root)) {
    issues.push(
      uiDiagnostic("UI_DOC_REFERENCE_DANGLING", "A UI document must declare a root node id.", {
        documentId: String(document2.id ?? ""),
        reference: "document.root"
      })
    );
    return issues;
  }
  const docRecord = document2;
  const nodes = registryOf(docRecord, "nodes");
  const definitions = registryOf(docRecord, "componentDefinitions");
  const styleSources = registryOf(docRecord, "styleSources");
  const tokens = registryOf(docRecord, "tokens");
  const conditions = registryOf(docRecord, "conditions");
  const localState = registryOf(docRecord, "localState");
  const stateTypes = {};
  for (const [key, declaration] of Object.entries(localState)) {
    if (isPlainObject(declaration) && typeof declaration.type === "string" && isUiValueType(declaration.type)) stateTypes[key] = declaration.type;
  }
  catalogs2 = { ...catalogs2, stateTypes };
  const ctx = { document: document2, catalogs: catalogs2, issues };
  const documentId = String(document2.id);
  const knownIds = /* @__PURE__ */ new Set();
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!isPlainObject(node) || !nonEmptyString(node.id)) {
      issues.push(
        uiDiagnostic("UI_DOC_UNKNOWN_NODE", "Every node entry must be an object with an id.", {
          documentId,
          nodeId,
          missingChildId: nodeId
        })
      );
      continue;
    }
    if (node.id !== nodeId) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_DUPLICATE_NODE_ID",
          `Node registry key '${nodeId}' does not match the node's own id '${node.id}'.`,
          { documentId, nodeId }
        )
      );
    }
    if (knownIds.has(node.id)) {
      issues.push(
        uiDiagnostic("UI_DOC_DUPLICATE_NODE_ID", `Node id '${node.id}' is registered twice.`, {
          documentId,
          nodeId: node.id
        })
      );
    }
    knownIds.add(node.id);
  }
  const childRefsOf = (node) => {
    switch (node.kind) {
      case "element":
        return node.children;
      case "portal":
        return node.children;
      case "repeat":
        return [node.templateRoot];
      case "slot":
        return node.fallback ?? [];
      default:
        return [];
    }
  };
  const definitionSlotFillChildren = (node) => node.kind === "component" && node.slots !== void 0 ? Object.entries(node.slots).map(([slot, fill]) => ({ slot, children: fill.children })) : [];
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const path = [];
  const innerRepeatScope = (node, scope) => ({
    repeatItems: {
      ...scope.repeatItems,
      [node.itemName]: repeatItemFields(ctx, node.collection)
    },
    inDefinition: scope.inDefinition
  });
  const visit = (nodeId, scope) => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      issues.push(
        uiDiagnostic("UI_DOC_CYCLE", "Containment cycle in the node tree.", {
          documentId,
          path: [...path.slice(cycleStart === -1 ? 0 : cycleStart), nodeId]
        })
      );
      return;
    }
    const node = nodes[nodeId];
    if (node === void 0) {
      issues.push(
        uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Referenced node '${nodeId}' does not exist.`, {
          documentId,
          nodeId: path[path.length - 1] ?? String(document2.root),
          missingChildId: nodeId
        })
      );
      return;
    }
    visiting.add(nodeId);
    path.push(nodeId);
    validateNode(ctx, node, scope, nodes);
    if (node.kind === "repeat") {
      const inner = innerRepeatScope(node, scope);
      visit(node.templateRoot, inner);
    } else {
      for (const childId of childRefsOf(node)) visit(childId, scope);
    }
    for (const fill of definitionSlotFillChildren(node)) {
      for (const childId of fill.children) visit(childId, scope);
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  visit(String(document2.root), { repeatItems: {}, inDefinition: false });
  for (const definition of Object.values(definitions)) {
    const defScope = { repeatItems: {}, inDefinition: true, propTypes: Object.fromEntries((definition.props ?? []).map((prop) => [prop.name, prop.type])) };
    const stack = [{ id: definition.root, scope: defScope }];
    const defSeen = /* @__PURE__ */ new Set();
    while (stack.length > 0) {
      const entry = stack.pop();
      const nodeId = entry.id;
      if (defSeen.has(nodeId)) continue;
      defSeen.add(nodeId);
      const node = nodes[nodeId];
      if (node === void 0) {
        issues.push(
          uiDiagnostic(
            "UI_DOC_UNKNOWN_NODE",
            `Definition body references missing node '${nodeId}'.`,
            {
              documentId,
              nodeId: definition.root,
              missingChildId: nodeId
            }
          )
        );
        continue;
      }
      validateNode(ctx, node, entry.scope, nodes);
      if (node.kind === "repeat") {
        stack.push({ id: node.templateRoot, scope: innerRepeatScope(node, entry.scope) });
      } else if (node.kind === "element" || node.kind === "portal") {
        for (const childId of node.children) stack.push({ id: childId, scope: entry.scope });
      } else if (node.kind === "slot") {
        for (const childId of node.fallback ?? []) stack.push({ id: childId, scope: entry.scope });
      } else if (node.kind === "conditional") {
        for (const branch of node.branches) {
          for (const childId of branch.children) stack.push({ id: childId, scope: entry.scope });
        }
      }
      if (node.kind === "component" && node.slots !== void 0) {
        for (const fill of Object.values(node.slots)) {
          for (const childId of fill.children) stack.push({ id: childId, scope: entry.scope });
        }
      }
      visited.add(nodeId);
    }
  }
  const ownerCount = /* @__PURE__ */ new Map();
  const countOwner = (ownerId, owned) => {
    for (const childId of owned ?? []) {
      ownerCount.set(childId, (ownerCount.get(childId) ?? 0) + 1);
      void ownerId;
    }
  };
  for (const node of Object.values(nodes)) {
    if (node.kind === "element" || node.kind === "portal") countOwner(node.id, node.children);
    else if (node.kind === "repeat") countOwner(node.id, [node.templateRoot]);
    else if (node.kind === "slot") countOwner(node.id, node.fallback);
    else if (node.kind === "conditional") {
      for (const branch of node.branches) countOwner(node.id, branch.children);
    } else if (node.kind === "component" && node.slots !== void 0) {
      for (const fill of Object.values(node.slots)) countOwner(node.id, fill.children);
    }
  }
  for (const definition of Object.values(definitions)) {
    countOwner(definition.id, [definition.root]);
    for (const slot of Object.values(definition.slots ?? {})) {
      countOwner(definition.id, slot.fallback);
    }
  }
  for (const [ownedId, count] of ownerCount) {
    if (count > 1) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNKNOWN_NODE",
          `Node '${ownedId}' has ${count} owners; every node has exactly one source parent.`,
          {
            documentId,
            nodeId: ownedId,
            missingChildId: ownedId
          }
        )
      );
    }
  }
  for (const [definitionId, definition] of Object.entries(definitions)) {
    validateDefinition(ctx, definitionId, definition, styleSources, conditions);
  }
  const defVisiting = /* @__PURE__ */ new Set();
  const defDone = /* @__PURE__ */ new Set();
  const defPath = [];
  const walkDefinition = (id) => {
    if (defDone.has(id)) return;
    if (defVisiting.has(id)) {
      const start = defPath.indexOf(id);
      issues.push(
        uiDiagnostic("UI_DOC_CYCLE", "Definition-level expansion cycle.", {
          documentId,
          path: defPath.slice(start === -1 ? 0 : start).concat(id)
        })
      );
      return;
    }
    const definition = definitions[id];
    if (definition === void 0) return;
    defVisiting.add(id);
    defPath.push(id);
    for (const nodeId of collectNodeSubtree(definition.root, nodes, /* @__PURE__ */ new Set())) {
      const node = nodes[nodeId];
      if (node?.kind === "component" && definitions[node.definitionId] !== void 0) {
        walkDefinition(node.definitionId);
      }
    }
    defPath.pop();
    defVisiting.delete(id);
    defDone.add(id);
  };
  for (const id of Object.keys(definitions)) walkDefinition(id);
  for (const [tokenId, token] of Object.entries(tokens)) {
    if (!isPlainObject(token) || !nonEmptyString(token.value)) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_UNKNOWN_REFERENCE",
          `Token '${tokenId}' must declare a string value.`,
          {
            documentId,
            nodeId: document2.root,
            path: `token.${tokenId}`
          }
        )
      );
    }
  }
  for (const [sourceId, source] of Object.entries(styleSources)) {
    if (!isPlainObject(source)) continue;
    for (const declaration of source.declarations ?? []) {
      validateStyleDeclaration(ctx, declaration, String(sourceId), String(document2.root), tokens);
    }
  }
  for (const [conditionId, condition] of Object.entries(conditions)) {
    validateCondition(ctx, conditionId, condition, localState);
  }
  for (const [key, decl] of Object.entries(localState)) {
    if (!isPlainObject(decl)) {
      issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", "Local state must declare a typed initial value.", { documentId, nodeId: document2.root, stateKey: key }));
      continue;
    }
    const type = decl.type;
    const initial = decl.initial;
    if (typeof type !== "string" || !isUiValueType(type)) {
      issues.push(
        uiDiagnostic(
          "UI_EXPR_TYPE_MISMATCH",
          `Local state '${key}' declares a type outside the vocabulary.`,
          {
            documentId,
            nodeId: document2.root,
            expected: String(type),
            actual: Array.isArray(initial) ? "array" : typeof initial
          }
        )
      );
      continue;
    }
    if (!isUiValueOfType(initial, type)) {
      if ((type === "isoDate" || type === "isoTime") && typeof initial === "string") {
        issues.push(
          uiDiagnostic(
            "UI_DOC_INVALID_LITERAL",
            `Local state '${key}' initial is not a valid ${type === "isoDate" ? "ISO date (YYYY-MM-DD)" : "ISO time (HH:MM[:SS])"} literal.`,
            { documentId, nodeId: document2.root, type, valueKind: type }
          )
        );
      } else {
        issues.push(
          uiDiagnostic(
            "UI_EXPR_TYPE_MISMATCH",
            `Local state '${key}' initial value does not match its type.`,
            {
              documentId,
              nodeId: document2.root,
              expected: type,
              actual: Array.isArray(initial) ? "array" : typeof initial
            }
          )
        );
      }
    }
  }
  return issues;
}
function collectNodeSubtree(root, nodes, into) {
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop();
    if (into.has(id)) continue;
    into.add(id);
    const node = nodes[id];
    if (node === void 0) continue;
    if (node.kind === "element" || node.kind === "portal") stack.push(...node.children);
    if (node.kind === "repeat") stack.push(node.templateRoot);
    if (node.kind === "slot") stack.push(...node.fallback ?? []);
    if (node.kind === "component" && node.slots !== void 0) {
      for (const fill of Object.values(node.slots)) stack.push(...fill.children);
    }
  }
  return into;
}
function validateOutputBindings(ctx, node, scope) {
  const outputs = node.outputs;
  if (outputs === void 0) return;
  const { catalogs: catalogs2, issues } = ctx;
  const documentId = String(ctx.document.id);
  const localState = registryOf(
    ctx.document,
    "localState"
  );
  const outputScope = { ...scope, output: "unknown" };
  for (const [outputName, binding] of Object.entries(outputs)) {
    if (outputName.length === 0) {
      issues.push(
        uiDiagnostic(
          "UI_COMPONENT_OUTPUT_UNKNOWN",
          `An output binding needs a non-empty output name.`,
          { documentId, nodeId: node.id, output: outputName }
        )
      );
    }
    if ("setState" in binding) {
      const target = localState[binding.setState.key];
      if (target === void 0) {
        issues.push(
          uiDiagnostic(
            "UI_COMPONENT_BINDING_INCOMPATIBLE",
            `Output binding targets undeclared state key '${binding.setState.key}'.`,
            { documentId, nodeId: node.id, output: outputName, stateKey: binding.setState.key }
          )
        );
      }
      if (binding.setState.value !== void 0) {
        issues.push(
          ...checkExpression(binding.setState.value, catalogs2, outputScope, documentId, node.id)
        );
      }
    } else if ("invokeAction" in binding) {
      if (catalogs2.actionIds !== void 0 && !catalogs2.actionIds.includes(binding.invokeAction.actionId)) {
        issues.push(
          uiDiagnostic(
            "UI_DOC_UNKNOWN_PRODUCT_REFERENCE",
            `Output binding references undeclared action '${binding.invokeAction.actionId}'.`,
            {
              documentId,
              nodeId: node.id,
              output: outputName,
              kind: "action",
              ref: binding.invokeAction.actionId
            }
          )
        );
      }
      for (const expression of Object.values(binding.invokeAction.input ?? {})) {
        issues.push(...checkExpression(expression, catalogs2, outputScope, documentId, node.id));
      }
    }
  }
}
function validateNode(ctx, node, scope, nodes) {
  const { document: document2, catalogs: catalogs2, issues } = ctx;
  const docRecord = document2;
  const documentId = String(document2.id);
  switch (node.kind) {
    case "element": {
      if (!isKnownElement(catalogs2.elements, node.tag)) {
        issues.push(
          uiDiagnostic("UI_DOC_UNKNOWN_ELEMENT", `Element tag '${node.tag}' is not registered.`, {
            documentId,
            nodeId: node.id,
            tag: node.tag
          })
        );
        break;
      }
      for (const name of Object.keys(node.attributes ?? {})) {
        if (!isAllowedAttribute(catalogs2.elements, node.tag, name)) {
          issues.push(
            uiDiagnostic(
              "UI_DOC_UNKNOWN_ATTRIBUTE",
              `Attribute '${name}' is not declared for element '${node.tag}'.`,
              { documentId, nodeId: node.id, tag: node.tag, attribute: name }
            )
          );
        }
      }
      if (isLeafElement(catalogs2.elements, node.tag) && node.children.length > 0) {
        issues.push(
          uiDiagnostic(
            "UI_DOC_UNKNOWN_NODE",
            `Element '${node.tag}' is a leaf and cannot own children.`,
            {
              documentId,
              nodeId: node.children[0],
              missingChildId: node.children[0]
            }
          )
        );
      }
      for (const attribute of Object.entries(node.attributes ?? {})) {
        if (typeof attribute[1] === "object" && attribute[1] !== null) {
          issues.push(
            ...checkExpression(attribute[1], catalogs2, scope, documentId, node.id)
          );
        }
      }
      for (const interaction of node.interactions ?? []) {
        validateInteraction(ctx, node.id, interaction, scope);
      }
      validatePresentation(ctx, node, scope);
      break;
    }
    case "text": {
      if (node.content.type === "expression") {
        issues.push(
          ...checkExpression(node.content.expression, catalogs2, scope, documentId, node.id)
        );
      } else if (typeof node.content.value !== "string") {
        issues.push(
          uiDiagnostic("UI_EXPR_TYPE_MISMATCH", "Literal text content must be a string.", {
            documentId,
            nodeId: node.id,
            expected: "string",
            actual: typeof node.content.value
          })
        );
      }
      break;
    }
    case "component": {
      validateOutputBindings(ctx, node, scope);
      const definition = registryOf(docRecord, "componentDefinitions")[node.definitionId];
      if (definition === void 0) {
        issues.push(
          uiDiagnostic(
            "UI_DOC_UNKNOWN_COMPONENT",
            `Component definition '${node.definitionId}' is not stored in this document (extension resolution is the compiler's obligation).`,
            { documentId, nodeId: node.id, definitionId: node.definitionId }
          )
        );
        break;
      }
      for (const [propName, expression] of Object.entries(node.props ?? {})) {
        const typeIssue = checkExpression(expression, catalogs2, scope, documentId, node.id);
        issues.push(...typeIssue);
        const propDecl = definition.props?.find(
          (candidate) => candidate.name === propName
        );
        if (propDecl === void 0) {
          issues.push(
            uiDiagnostic(
              "UI_DOC_UNKNOWN_PROP",
              `Definition '${node.definitionId}' declares no prop '${propName}'.`,
              { documentId, nodeId: node.id, definitionId: node.definitionId, prop: propName }
            )
          );
          continue;
        }
        issues.push(...checkExpressionTarget(
          expression,
          propDecl.type,
          catalogs2,
          scope,
          documentId,
          node.id
        ));
      }
      for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
        const declared = definition.slots?.[slotName];
        if (declared === void 0) {
          issues.push(
            uiDiagnostic(
              "UI_DOC_UNKNOWN_COMPONENT",
              `Definition '${node.definitionId}' declares no slot '${slotName}'.`,
              { documentId, nodeId: node.id, definitionId: `${node.definitionId}#${slotName}` }
            )
          );
        }
        for (const childId of fill.children) {
          const child = nodes[childId];
          if (child === void 0) {
            issues.push(
              uiDiagnostic(
                "UI_DOC_UNKNOWN_NODE",
                `Slot fill references missing node '${childId}'.`,
                {
                  documentId,
                  nodeId: node.id,
                  missingChildId: childId
                }
              )
            );
            continue;
          }
          validateNode(ctx, child, scope, nodes);
        }
      }
      for (const [slotName, declaredSlot2] of Object.entries(
        definition.slots ?? {}
      )) {
        if (declaredSlot2.required !== true) continue;
        const fill = node.slots?.[slotName];
        if (fill === void 0 || fill.children.length === 0) {
          issues.push(
            uiDiagnostic(
              "UI_DOC_REQUIRED_SLOT_MISSING",
              `Instance of '${node.definitionId}' leaves required slot '${slotName}' unfilled.`,
              { documentId, nodeId: node.id, definitionId: node.definitionId, slot: slotName }
            )
          );
        }
      }
      break;
    }
    case "repeat": {
      const collectionType = checkExpressionTypeOf(ctx, node.collection, scope, node.id, "array");
      if (collectionType !== "array" && collectionType !== "unknown" && collectionType !== "any") {
        issues.push(
          uiDiagnostic("UI_EXPR_TYPE_MISMATCH", "A repeat collection must resolve to an array.", {
            documentId,
            nodeId: node.id,
            expected: "array",
            actual: collectionType
          })
        );
      }
      const innerScope = {
        repeatItems: {
          ...scope.repeatItems,
          [node.itemName]: repeatItemFields(ctx, node.collection)
        },
        inDefinition: scope.inDefinition
      };
      issues.push(...checkExpression(node.key, catalogs2, innerScope, documentId, node.id));
      break;
    }
    case "conditional": {
      for (const branch of node.branches) {
        if (branch.when !== void 0) {
          const condition = registryOf(docRecord, "conditions")[branch.when];
          if (condition === void 0) {
            issues.push(
              uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Branch references unknown condition.`, {
                documentId,
                conditionId: branch.when
              })
            );
          } else if (condition.kind !== "localState") {
            issues.push(
              uiDiagnostic(
                "UI_STYLE_CONDITION_UNKNOWN",
                "A conditional branch requires a localState condition (media conditions belong to style rules).",
                { documentId, conditionId: branch.when }
              )
            );
          } else {
            const when = condition.when;
            if (when !== void 0) {
              issues.push(...checkExpression(when, catalogs2, scope, documentId, node.id));
            }
          }
        }
        for (const childId of branch.children) {
          const child = nodes[childId];
          if (child === void 0) {
            issues.push(
              uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Branch references missing node '${childId}'.`, {
                documentId,
                nodeId: node.id,
                missingChildId: childId
              })
            );
            continue;
          }
          validateNode(ctx, child, scope, nodes);
        }
      }
      break;
    }
    case "slot": {
      if (!scope.inDefinition) {
        issues.push(
          uiDiagnostic(
            "UI_EXPR_SCOPE_VIOLATION",
            "Slot placeholders are only valid inside a component definition body.",
            { documentId, nodeId: node.id, scope: "slot:outside-definition" }
          )
        );
      }
      break;
    }
    case "portal": {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNSUPPORTED_FEATURE",
          "Portal rendering is pending beyond the U1 slice.",
          {
            documentId,
            nodeId: node.id,
            feature: "portal"
          }
        )
      );
      break;
    }
  }
}
function repeatItemFields(ctx, collection) {
  return repeatExpressionFields(collection, ctx.catalogs.viewFields);
}
function checkExpressionTypeOf(ctx, expression, scope, nodeId, _expected) {
  const issues = [];
  const catalogs2 = ctx.catalogs;
  issues.push(...checkExpression(expression, catalogs2, scope, String(ctx.document.id), nodeId));
  ctx.issues.push(...issues);
  return inferType(expression, catalogs2, scope);
}
function inferType(expression, catalogs2, scope) {
  switch (expression.type) {
    case "literal":
      return expression.value === null ? "null" : typeof expression.value;
    case "ref": {
      const parts = expression.path.split(".");
      const head = parts[0];
      if ((head === "view" || head === "record") && parts.length === 2) {
        return (catalogs2.viewFields ?? {})[parts[1]] ?? "unknown";
      }
      if (head === "repeat" && parts.length === 3) {
        return scope.repeatItems[parts[1]]?.[parts[2]] ?? "unknown";
      }
      if (head === "token") return "string";
      if (head === "prop" && scope.inDefinition) return "any";
      if (head === "state" && !scope.inDefinition) return "any";
      return "unknown";
    }
    case "compare":
    case "boolean":
      return "boolean";
    case "conditionalValue":
      return inferType(expression.then, catalogs2, scope);
    case "op":
      return "unknown";
  }
}
function validateInteraction(ctx, nodeId, interaction, scope) {
  const { document: document2, catalogs: catalogs2, issues } = ctx;
  const docRecord = document2;
  const documentId = String(document2.id);
  if (interaction.action === "invokeAction") {
    if (catalogs2.actionIds !== void 0 && !catalogs2.actionIds.includes(interaction.actionId)) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNKNOWN_PRODUCT_REFERENCE",
          `Interaction references undeclared action '${interaction.actionId}'.`,
          { documentId, nodeId, kind: "action", ref: interaction.actionId }
        )
      );
    }
    const input = interaction.input;
    for (const expression of Object.values(input ?? {})) {
      issues.push(...checkExpression(expression, catalogs2, scope, documentId, nodeId));
    }
  } else if (interaction.action === "navigate") {
    if (catalogs2.routeIds !== void 0 && !catalogs2.routeIds.includes(interaction.routeId)) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNKNOWN_PRODUCT_REFERENCE",
          `Interaction references undeclared route '${interaction.routeId}'.`,
          { documentId, nodeId, kind: "route", ref: interaction.routeId }
        )
      );
    }
    const params = interaction.params;
    for (const expression of Object.values(params ?? {})) {
      issues.push(...checkExpression(expression, catalogs2, scope, documentId, nodeId));
    }
  } else if (interaction.action === "setState") {
    const localState = registryOf(docRecord, "localState");
    if (localState[interaction.key] === void 0) {
      issues.push(
        uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `setState targets undeclared state key.`, {
          documentId,
          nodeId,
          path: `state.${interaction.key}`
        })
      );
    }
    if (interaction.value !== void 0) {
      issues.push(
        ...checkExpression(interaction.value, catalogs2, scope, documentId, nodeId)
      );
    }
  }
}
function validatePresentation(ctx, node, scope) {
  const { document: document2, catalogs: catalogs2, issues } = ctx;
  const docRecord = document2;
  const documentId = String(document2.id);
  const styleSources = registryOf(docRecord, "styleSources");
  for (const sourceId of node.styleSources ?? []) {
    if (styleSources[sourceId] === void 0) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_REFERENCE_DANGLING",
          `Style source '${String(sourceId)}' does not exist.`,
          {
            documentId,
            nodeId: node.id,
            reference: `styleSource:${String(sourceId)}`
          }
        )
      );
    }
  }
  for (const declaration of node.localStyle ?? []) {
    validateStyleDeclaration(ctx, declaration, node.id, node.id, registryOf(docRecord, "tokens"));
    if (declaration.value !== void 0 && typeof declaration.value === "object" && declaration.value.type === "binding") {
      issues.push(
        ...checkExpression(declaration.value.expression, catalogs2, scope, documentId, node.id)
      );
    }
  }
}
function validateStyleDeclaration(ctx, declaration, owner, nodeId, tokens) {
  const { document: document2, issues } = ctx;
  const documentId = String(document2.id);
  if (!nonEmptyString(declaration.property)) {
    issues.push(
      uiDiagnostic("UI_STYLE_PROPERTY_UNSUPPORTED", `Style declaration needs a property name.`, {
        documentId,
        nodeId,
        property: String(declaration.property ?? "")
      })
    );
    return;
  }
  const value = declaration.value;
  if (value === void 0 || typeof value !== "object") {
    issues.push(
      uiDiagnostic("UI_STYLE_PROPERTY_UNSUPPORTED", `Style value must be a typed value.`, {
        documentId,
        nodeId,
        property: String(declaration.property)
      })
    );
    return;
  }
  if (value.type === "token" && tokens[value.id] === void 0) {
    issues.push(
      uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `Style value references unknown token.`, {
        documentId,
        nodeId,
        path: `token.${String(value.id)}`
      })
    );
  }
  void owner;
}
function validateCondition(ctx, conditionId, condition, localState) {
  const { document: document2, catalogs: catalogs2, issues } = ctx;
  const docRecord = document2;
  const documentId = String(document2.id);
  void docRecord;
  if (!isPlainObject(condition)) {
    issues.push(
      uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Condition '${conditionId}' must be an object.`, {
        documentId,
        conditionId
      })
    );
    return;
  }
  const kind = condition.kind;
  if (kind === "media") {
    const query = condition.query;
    if (typeof query !== "string" || !isBoundedMediaQuery(query)) {
      issues.push(
        uiDiagnostic(
          "UI_STYLE_CONDITION_UNKNOWN",
          `Media condition query is not a bounded width query.`,
          {
            documentId,
            conditionId
          }
        )
      );
    }
    return;
  }
  if (kind === "localState") {
    const when = condition.when;
    if (when === void 0) {
      issues.push(
        uiDiagnostic(
          "UI_STYLE_CONDITION_UNKNOWN",
          `localState condition needs a when expression.`,
          {
            documentId,
            conditionId
          }
        )
      );
      return;
    }
    issues.push(
      ...checkExpression(
        when,
        catalogs2,
        { repeatItems: {}, inDefinition: false },
        documentId,
        document2.root
      )
    );
    void localState;
    return;
  }
}
function isBoundedMediaQuery(query) {
  const clause = /^\(\s*(min|max)-width\s*:\s*\d+(?:\.\d+)?px\s*\)$/;
  const parts = query.split(" and ").map((part) => part.trim());
  if (parts.length === 0) return false;
  return parts.every((part) => clause.test(part));
}
function validateDefinition(ctx, definitionId, definition, styleSources, conditions) {
  const { document: document2, issues } = ctx;
  const docRecord = document2;
  const documentId = String(document2.id);
  if (!nonEmptyString(definition.revision)) {
    issues.push(
      uiDiagnostic("UI_DOC_UNKNOWN_COMPONENT", `Definition '${definitionId}' needs a revision.`, {
        documentId,
        nodeId: document2.root,
        definitionId
      })
    );
  }
  const nodes = registryOf(docRecord, "nodes");
  if (nodes[definition.root] === void 0) {
    issues.push(
      uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Definition '${definitionId}' root does not exist.`, {
        documentId,
        nodeId: definition.root,
        missingChildId: definition.root
      })
    );
  }
  if (definition.baseStyle !== void 0 && styleSources[definition.baseStyle] === void 0) {
    issues.push(
      uiDiagnostic("UI_DOC_REFERENCE_DANGLING", `Definition base style does not exist.`, {
        documentId,
        nodeId: definition.root,
        reference: `styleSource:${definition.baseStyle}`
      })
    );
  }
  for (const prop of definition.props ?? []) {
    if (prop.default !== void 0 && (prop.type === "array" || !isUiValueOfType(prop.default, prop.type))) {
      issues.push(uiDiagnostic(
        prop.type === "isoDate" || prop.type === "isoTime" ? "UI_DOC_INVALID_LITERAL" : "UI_EXPR_TYPE_MISMATCH",
        `Invalid default for prop '${prop.name}'.`,
        { documentId, nodeId: definition.root, expected: prop.type, actual: typeof prop.default }
      ));
    }
  }
  for (const [variant, ref] of Object.entries(definition.variants ?? {})) {
    if (conditions[ref.conditionId] === void 0) {
      issues.push(
        uiDiagnostic(
          "UI_STYLE_CONDITION_UNKNOWN",
          `Variant '${variant}' references unknown condition.`,
          {
            documentId,
            conditionId: ref.conditionId
          }
        )
      );
    } else {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNSUPPORTED_FEATURE",
          "Component variants are pending beyond the U1 slice.",
          { documentId, feature: `variant:${definitionId}:${variant}` }
        )
      );
    }
  }
}

// packages/ui/src/compile.ts
var UI_COMPONENT_ABI = "vict.ui-component-abi@1";
function isUiComponentPlanDiagnostic(issue, document2, extensions) {
  if (!["UI_COMPONENT_OUTPUT_UNKNOWN", "UI_COMPONENT_OUTPUT_PAYLOAD_INVALID", "UI_COMPONENT_BINDING_INCOMPATIBLE"].includes(issue.code)) return false;
  const node = typeof issue.nodeId === "string" ? document2.nodes?.[issue.nodeId] : void 0;
  return node?.kind === "component" && document2.componentDefinitions?.[node.definitionId] === void 0 && extensions.some((descriptor2) => descriptor2.id === node.definitionId);
}
function compileUiDocument(document2, semanticCatalog, extensions = [], catalogs2 = {}) {
  const validation = validateUiDocument(document2, {
    elements: semanticCatalog,
    ...catalogs2.actionIds !== void 0 ? { actionIds: catalogs2.actionIds } : { actionIds: [] },
    ...catalogs2.routeIds !== void 0 ? { routeIds: catalogs2.routeIds } : { routeIds: [] },
    ...catalogs2.viewFields !== void 0 ? { viewFields: catalogs2.viewFields } : {},
    ...catalogs2.opNames !== void 0 ? { opNames: catalogs2.opNames } : {},
    stateTypes: catalogs2.stateTypes
  });
  const hasFieldCatalog = catalogs2.viewFields !== void 0;
  const isDeferredProductRef = (issue) => !hasFieldCatalog && issue.code === "UI_EXPR_UNKNOWN_REFERENCE" && typeof issue.path === "string" && (issue.path.startsWith("view.") || issue.path.startsWith("record."));
  const structural = validation.filter(
    (issue) => issue.code !== "UI_DOC_UNKNOWN_COMPONENT" && !(issue.code === "UI_DOC_UNKNOWN_PRODUCT_REFERENCE" && (issue.kind === "action" ? catalogs2.actionIds === void 0 : issue.kind === "route" ? catalogs2.routeIds === void 0 : true)) && issue.code !== "UI_DOC_UNSUPPORTED_FEATURE" && !isDeferredProductRef(issue) && !isUiComponentPlanDiagnostic(issue, document2, extensions)
  );
  const deferredRefs = validation.filter(isDeferredProductRef);
  if (hasErrors(structural)) {
    return { ok: false, issues: structural };
  }
  catalogs2 = { ...catalogs2, stateTypes: Object.fromEntries(Object.entries(document2.localState ?? {}).map(([key, decl]) => [key, decl.type])) };
  const { bytes, contentDigest } = canonicalUiDocument(document2);
  void bytes;
  const documentId = String(document2.id);
  const issues = validation.filter((issue) => issue.severity === "warning" || isUiComponentPlanDiagnostic(issue, document2, extensions));
  const rules = [];
  const sourceMap = [];
  const extensionRefs = [];
  const nodes = document2.nodes ?? {};
  const definitions = document2.componentDefinitions ?? {};
  const extensionById = new Map(extensions.map((extension) => [extension.id, extension]));
  const docHash = sha256(documentId).slice(0, 8);
  const classFor = (nodeId) => `uv-${docHash}-${nodeId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const tokenDeclarations = Object.entries(
    document2.tokens ?? {}
  ).map(([tokenId, token]) => ({
    // CSS custom-property-safe name (declared token ids may contain dots)
    property: `--ui-token-${tokenId.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    value: { type: "literal", value: token.value }
  }));
  if (tokenDeclarations.length > 0) {
    rules.push({
      ruleId: `${docHash}-tokens`,
      layer: "token",
      selector: ":root",
      declarations: tokenDeclarations
    });
  }
  const compileStyleDeclarations = (declarations, ruleId, layer, selector, gating) => {
    if (declarations === void 0 || declarations.length === 0) return void 0;
    let mediaConditionId;
    let containerConditionId;
    if (gating?.conditionId !== void 0) {
      const condition = (document2.conditions ?? {})[gating.conditionId];
      if (condition === void 0) {
        issues.push(
          uiDiagnostic(
            "UI_STYLE_CONDITION_UNKNOWN",
            `Unknown style condition '${gating.conditionId}'.`,
            {
              documentId,
              conditionId: gating.conditionId
            }
          )
        );
        return void 0;
      }
      if (condition.kind === "media") mediaConditionId = condition.id;
      else if (condition.kind === "container") containerConditionId = condition.id;
      else {
        issues.push(
          uiDiagnostic(
            "UI_DOC_UNSUPPORTED_FEATURE",
            `Style condition kind '${condition.kind}' is unsupported; the conditioned rule is dropped (declared limitation).`,
            { documentId, feature: `condition:${condition.kind}` }
          )
        );
        return void 0;
      }
    }
    const compiled = declarations.map((declaration) => {
      let value;
      if (declaration.value.type === "text") {
        value = { type: "literal", value: declaration.value.value };
      } else if (declaration.value.type === "token") {
        value = { type: "token", id: declaration.value.id };
      } else {
        value = { type: "expression", expression: declaration.value.expression };
      }
      return { property: declaration.property, value };
    });
    rules.push({
      ruleId,
      layer,
      // The pseudo suffix travels in `rule.pseudo`; the RENDERER composes
      // `.class:pseudo` after its own escaping (a pseudo colon is selector
      // syntax — escaping it makes the rule unmatchable, see F1).
      selector,
      ...mediaConditionId !== void 0 ? { mediaConditionId } : {},
      ...containerConditionId !== void 0 ? { containerConditionId } : {},
      ...gating?.pseudo !== void 0 ? { pseudo: gating.pseudo } : {},
      declarations: compiled
    });
    return ruleId;
  };
  const occurrenceKey = (nodeId, instancePath) => [documentId, nodeId, ...instancePath].join("|");
  let definitionExpansionGuard = 0;
  const compileNode = (nodeId, scope) => {
    const node = nodes[nodeId];
    if (node === void 0) {
      return {
        kind: "unsupported",
        nodeId,
        occurrenceKey: occurrenceKey(nodeId, scope.instancePath),
        feature: "missing-node",
        children: []
      };
    }
    const key = occurrenceKey(nodeId, scope.instancePath);
    sourceMap.push({
      occurrenceKey: key,
      documentId,
      sourceNodeId: nodeId,
      componentInstancePath: [...scope.instancePath]
    });
    switch (node.kind) {
      case "element": {
        const styleRuleIds = [];
        for (const sourceId of node.styleSources ?? []) {
          const source = (document2.styleSources ?? {})[sourceId];
          const ruleId = compileStyleDeclarations(
            source?.declarations,
            `${classFor(nodeId)}-s${styleRuleIds.length}`,
            // Frozen cascade: style sources INSIDE a definition body are part
            // of the shared component presentation (component base layer);
            // sources attached at an INSTANCE site are the instance-override
            // layer ('source') and therefore win over the shared base.
            scope.inDefinition ? "componentBase" : "source",
            `.${classFor(nodeId)}`,
            { conditionId: source?.conditionId, pseudo: source?.pseudo }
          );
          if (ruleId !== void 0) styleRuleIds.push(ruleId);
        }
        const localRuleId = compileStyleDeclarations(
          node.localStyle,
          `${classFor(nodeId)}-l`,
          // Frozen cascade: a localStyle INSIDE a definition body is part of
          // the shared component presentation (component base layer) - it
          // must never compete with (let alone override, by CSS order) an
          // INSTANCE's localStyle, which is the innermost 'local' layer.
          scope.inDefinition ? "componentBase" : "local",
          `.${classFor(nodeId)}`
        );
        if (localRuleId !== void 0) styleRuleIds.push(localRuleId);
        const attributes = Object.entries(node.attributes ?? {}).map(([name, value]) => ({
          name,
          value: resolveAttributeValue(value)
        }));
        return {
          kind: "element",
          nodeId,
          occurrenceKey: key,
          tag: node.tag,
          attributes,
          classes: [...node.classes ?? [], classFor(nodeId)],
          styleRuleIds,
          interactions: (node.interactions ?? []).map(extractInteraction),
          children: node.children.map((childId) => compileNode(childId, scope))
        };
      }
      case "text":
        return {
          kind: "text",
          nodeId,
          occurrenceKey: key,
          content: node.content.type === "literal" ? { type: "literal", value: node.content.value } : { type: "expression", expression: node.content.expression }
        };
      case "component": {
        const definition = definitions[node.definitionId];
        if (definition === void 0) {
          const withId = extensions.filter((extension) => extension.id === node.definitionId);
          if (withId.length === 0) {
            issues.push(
              uiDiagnostic("EXTENSION_UNAVAILABLE", `Neither definition nor extension resolves.`, {
                extensionId: node.definitionId
              })
            );
            return {
              kind: "unsupported",
              nodeId,
              occurrenceKey: key,
              feature: "unresolved-component",
              children: []
            };
          }
          const current = extensionById.get(node.definitionId);
          const effectiveRevision = node.revision ?? current.revision;
          const matches = withId.filter((entry) => entry.revision === effectiveRevision);
          if (matches.length > 1) issues.push(uiDiagnostic(
            "UI_COMPONENT_REVISION_UNRESOLVED",
            "Competing descriptors have the same effective identity.",
            { documentId, nodeId, extensionId: node.definitionId, revision: effectiveRevision }
          ));
          const descriptor2 = matches.length === 1 ? matches[0] : void 0;
          if (descriptor2 === void 0) {
            issues.push(
              uiDiagnostic(
                "UI_COMPONENT_REVISION_UNRESOLVED",
                `Instance pin (${node.definitionId}, ${effectiveRevision}) matches no registered descriptor revision.`,
                { documentId, nodeId, extensionId: node.definitionId, revision: effectiveRevision }
              )
            );
            extensionRefs.push({ extensionId: node.definitionId, revision: effectiveRevision });
            return {
              kind: "extension",
              nodeId,
              occurrenceKey: key,
              extensionId: node.definitionId,
              revision: effectiveRevision,
              propDecls: [],
              propValues: node.props ?? {}
            };
          }
          const compiledExtension = compileExtensionInstance(
            node,
            descriptor2,
            effectiveRevision,
            key,
            documentId,
            document2,
            { ...catalogs2, elements: semanticCatalog },
            (childId) => compileNode(childId, { ...scope, instancePath: [...scope.instancePath, `${nodeId}@${node.definitionId}`] }),
            { inDefinition: scope.inDefinition, repeatItems: scope.repeatItems ?? {}, propTypes: scope.propTypes }
          );
          issues.push(...compiledExtension.issues);
          extensionRefs.push({ extensionId: descriptor2.id, revision: effectiveRevision });
          const styleRuleIds2 = [];
          if ((node.localStyle?.length ?? 0) > 0 || (node.styleSources?.length ?? 0) > 0 || (node.classes?.length ?? 0) > 0) {
            if ((descriptor2.styleTargets?.length ?? 0) === 0) issues.push(uiDiagnostic(
              "UI_COMPONENT_BINDING_INCOMPATIBLE",
              "This component declares no editable style target.",
              { documentId, nodeId, feature: "component-style" }
            ));
          }
          for (const sourceId of node.styleSources ?? []) {
            const source = document2.styleSources[sourceId];
            const id = compileStyleDeclarations(
              source?.declarations,
              `${classFor(nodeId)}-s${styleRuleIds2.length}`,
              scope.inDefinition ? "componentBase" : "source",
              `.${classFor(nodeId)}`,
              { conditionId: source?.conditionId, pseudo: source?.pseudo }
            );
            if (id !== void 0) styleRuleIds2.push(id);
          }
          const localId = compileStyleDeclarations(node.localStyle, `${classFor(nodeId)}-l`, scope.inDefinition ? "componentBase" : "local", `.${classFor(nodeId)}`);
          if (localId !== void 0) styleRuleIds2.push(localId);
          return { ...compiledExtension.instruction, classes: [...node.classes ?? [], classFor(nodeId)], styleRuleIds: styleRuleIds2, styleTargets: descriptor2.styleTargets ?? [] };
        }
        definitionExpansionGuard += 1;
        if (definitionExpansionGuard > 256) {
          issues.push(
            uiDiagnostic("UI_DOC_CYCLE", "Definition expansion exceeded the safety bound.", {
              documentId,
              path: [node.definitionId]
            })
          );
          definitionExpansionGuard -= 1;
          return {
            kind: "unsupported",
            nodeId,
            occurrenceKey: key,
            feature: "expansion-bound",
            children: []
          };
        }
        const body = compileNode(definition.root, {
          inDefinition: true,
          propTypes: Object.fromEntries(definition.props.map((prop) => [prop.name, prop.type])),
          instancePath: [...scope.instancePath, `${nodeId}@${node.definitionId}`]
        });
        definitionExpansionGuard -= 1;
        const slots = {};
        for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
          slots[slotName] = fill.children.map((childId) => compileNode(childId, scope));
        }
        const styleRuleIds = [];
        for (const sourceId of node.styleSources ?? []) {
          const instanceSource = (document2.styleSources ?? {})[sourceId];
          const instanceRuleId = compileStyleDeclarations(
            instanceSource?.declarations,
            `${classFor(nodeId)}-s${styleRuleIds.length}`,
            "source",
            `.${classFor(nodeId)}`,
            { conditionId: instanceSource?.conditionId, pseudo: instanceSource?.pseudo }
          );
          if (instanceRuleId !== void 0) styleRuleIds.push(instanceRuleId);
        }
        if (definition.baseStyle !== void 0) {
          const base = (document2.styleSources ?? {})[definition.baseStyle];
          const ruleId = compileStyleDeclarations(
            base?.declarations,
            `${classFor(nodeId)}-b`,
            "componentBase",
            `.${classFor(nodeId)}`
          );
          if (ruleId !== void 0) styleRuleIds.push(ruleId);
        }
        const localRuleId = compileStyleDeclarations(
          node.localStyle,
          `${classFor(nodeId)}-l`,
          "local",
          `.${classFor(nodeId)}`
        );
        if (localRuleId !== void 0) styleRuleIds.push(localRuleId);
        return {
          kind: "component",
          nodeId,
          occurrenceKey: key,
          definitionId: node.definitionId,
          definitionRevision: node.revision ?? definition.revision,
          propDecls: definition.props,
          propValues: node.props ?? {},
          classes: [...node.classes ?? [], classFor(nodeId)],
          body,
          slots,
          styleRuleIds
        };
      }
      case "repeat":
        return {
          kind: "repeat",
          nodeId,
          occurrenceKey: key,
          collection: node.collection,
          key: node.key,
          itemName: node.itemName,
          template: compileNode(node.templateRoot, { ...scope, repeatItems: { ...scope.repeatItems, [node.itemName]: repeatExpressionFields(node.collection, catalogs2.viewFields) } })
        };
      case "conditional":
        return {
          kind: "conditional",
          nodeId,
          occurrenceKey: key,
          branches: node.branches.map((branch) => ({
            ...branch.when !== void 0 ? { when: branch.when } : {},
            children: branch.children.map((childId) => compileNode(childId, scope))
          }))
        };
      case "slot":
        return {
          kind: "slot",
          nodeId,
          occurrenceKey: key,
          name: node.name,
          required: node.required === true,
          fallback: (node.fallback ?? []).map((childId) => compileNode(childId, scope))
        };
      case "portal":
        issues.push(
          uiDiagnostic(
            "UI_DOC_UNSUPPORTED_FEATURE",
            "Portal rendering is unsupported; its logical child ownership stays in occurrence provenance (U2-02).",
            {
              documentId,
              nodeId,
              feature: "portal"
            }
          )
        );
        return {
          kind: "unsupported",
          nodeId,
          occurrenceKey: key,
          feature: "portal",
          children: node.children.map(
            (childId) => (
              // Occurrence identity carries the portal ownership segment so a
              // node presented through a portal keeps its LOGICAL owner in
              // provenance even while the visual placement is unsupported.
              compileNode(childId, {
                inDefinition: scope.inDefinition,
                instancePath: [...scope.instancePath, `portal:${nodeId}:${node.target.overlayId}`]
              })
            )
          )
        };
    }
  };
  const structure = [
    compileNode(String(document2.root), { inDefinition: false, instancePath: [] })
  ];
  const conditions = Object.values(document2.conditions ?? {});
  const repeats = [];
  const collectRepeats = (instruction) => {
    if (instruction.kind === "repeat") {
      repeats.push({ nodeId: instruction.nodeId, itemName: instruction.itemName });
      collectRepeats(instruction.template);
    } else if (instruction.kind === "element") {
      instruction.children.forEach(collectRepeats);
    } else if (instruction.kind === "component") {
      collectRepeats(instruction.body);
      Object.values(instruction.slots).forEach((children) => children.forEach(collectRepeats));
    } else if (instruction.kind === "extension") {
      Object.values(instruction.slots ?? {}).forEach((children) => children.forEach(collectRepeats));
    } else if (instruction.kind === "conditional") {
      instruction.branches.forEach((branch) => branch.children.forEach(collectRepeats));
    } else if (instruction.kind === "slot") {
      instruction.fallback.forEach(collectRepeats);
    } else if (instruction.kind === "unsupported") {
      instruction.children.forEach(collectRepeats);
    }
  };
  structure.forEach(collectRepeats);
  const expansionErrors = issues.filter((issue) => issue.code === "UI_DOC_CYCLE");
  if (hasErrors(expansionErrors)) return { ok: false, issues: expansionErrors };
  const plan = {
    schema: UI_RENDER_PLAN_SCHEMA,
    documentId,
    revision: String(document2.revision),
    sourceDigest: contentDigest,
    diagnostics: [...issues, ...deferredRefs].map((issue) => isDeferredProductRef(issue) ? { ...issue, severity: "warning" } : issue),
    structure,
    style: {
      rules,
      layers: ["token", "componentBase", "componentVariant", "source", "local"]
    },
    dynamic: { repeats, conditions },
    extensions: extensionRefs,
    sourceMap
  };
  return { ok: true, plan };
}
function isDeferredFieldReference(issue, catalogs2) {
  return catalogs2.viewFields === void 0 && issue.code === "UI_EXPR_UNKNOWN_REFERENCE" && typeof issue.path === "string" && (issue.path.startsWith("view.") || issue.path.startsWith("record."));
}
function compileExtensionInstance(node, descriptor2, effectiveRevision, occurrenceKey, documentId, document2, catalogs2, compileChild, lexicalScope) {
  const issues = [];
  const hasOutputs = (descriptor2.outputs?.length ?? 0) > 0;
  const hasSlots = (descriptor2.slots?.length ?? 0) > 0;
  const isComponentAbi = descriptor2.abi !== void 0 || hasOutputs || hasSlots;
  if (isComponentAbi && (descriptor2.abi !== UI_COMPONENT_ABI || descriptor2.events?.length !== 1 || descriptor2.events[0] !== UI_COMPONENT_ABI)) {
    issues.push(
      uiDiagnostic(
        "UI_COMPONENT_ABI_UNSUPPORTED",
        `Descriptor '${descriptor2.id}' declares component-ABI surface without a consistent ${UI_COMPONENT_ABI} marker/abi pair.`,
        { documentId, nodeId: node.id, extensionId: descriptor2.id, revision: effectiveRevision }
      )
    );
  }
  const rejectedProps = [];
  for (const [propName, expression] of Object.entries(node.props ?? {})) {
    const propDecl = descriptor2.props.find((candidate) => candidate.name === propName);
    if (propDecl === void 0) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNKNOWN_PROP",
          `Descriptor '${descriptor2.id}' declares no prop '${propName}'.`,
          { documentId, nodeId: node.id, definitionId: descriptor2.id, prop: propName }
        )
      );
      continue;
    }
    const propIssues = checkExpressionTarget(expression, propDecl.type, catalogs2, lexicalScope, documentId, node.id);
    issues.push(...propIssues);
    if (propIssues.some((issue) => issue.severity === "error" && !isDeferredFieldReference(issue, catalogs2))) rejectedProps.push(propName);
  }
  for (const prop of descriptor2.props) {
    if (prop.default !== void 0 && (prop.type === "array" || !isUiValueOfType(prop.default, prop.type))) {
      issues.push(uiDiagnostic(prop.type === "isoDate" || prop.type === "isoTime" ? "UI_DOC_INVALID_LITERAL" : "UI_EXPR_TYPE_MISMATCH", `Invalid default for prop '${prop.name}'.`, { documentId, nodeId: node.id, expected: prop.type, actual: typeof prop.default }));
    }
  }
  const outputDecls = isComponentAbi ? descriptor2.outputs ?? [] : void 0;
  const authoredBindings = node.outputs ?? {};
  const acceptedBindings = {};
  for (const [outputName, binding] of Object.entries(authoredBindings)) {
    const issueStart = issues.length;
    if (outputDecls === void 0) {
      issues.push(uiDiagnostic("UI_COMPONENT_ABI_UNSUPPORTED", "Output bindings require a component ABI descriptor.", { documentId, nodeId: node.id, extensionId: descriptor2.id }));
      break;
    }
    const decl = outputDecls.find((candidate) => candidate.name === outputName);
    if (decl === void 0) {
      issues.push(
        uiDiagnostic(
          "UI_COMPONENT_OUTPUT_UNKNOWN",
          `Descriptor '${descriptor2.id}' declares no output '${outputName}'.`,
          { documentId, nodeId: node.id, extensionId: descriptor2.id, output: outputName }
        )
      );
      continue;
    }
    if ("setState" in binding) {
      const stateDecl = (document2.localState ?? {})[binding.setState.key];
      if (stateDecl === void 0) {
        issues.push(uiDiagnostic(
          "UI_COMPONENT_BINDING_INCOMPATIBLE",
          "Output binding targets undeclared state.",
          { documentId, nodeId: node.id, output: outputName, stateKey: binding.setState.key }
        ));
      } else {
        if (decl.payload === "void" || stateDecl.type !== decl.payload) {
          issues.push(
            uiDiagnostic(
              "UI_COMPONENT_BINDING_INCOMPATIBLE",
              `Output '${outputName}' payload ${decl.payload} is incompatible with state '${binding.setState.key}' type ${stateDecl.type}.`,
              {
                documentId,
                nodeId: node.id,
                output: outputName,
                payload: decl.payload,
                stateKey: binding.setState.key,
                stateType: stateDecl.type
              }
            )
          );
        } else if (binding.setState.value !== void 0) {
          issues.push(
            ...checkBindingExpression(
              binding.setState.value,
              stateDecl.type,
              decl.payload,
              catalogs2,
              documentId,
              node.id,
              lexicalScope
            )
          );
        }
      }
    } else if ("invokeAction" in binding) {
      const inputTypes = catalogs2.actionInputs?.[binding.invokeAction.actionId];
      for (const [inputName, expression] of Object.entries(binding.invokeAction.input ?? {})) {
        if (inputTypes === void 0) {
          issues.push(
            ...checkBindingExpression(
              expression,
              void 0,
              decl.payload,
              catalogs2,
              documentId,
              node.id,
              lexicalScope
            )
          );
          continue;
        }
        const expected = inputTypes[inputName];
        if (expected === void 0) {
          issues.push(
            uiDiagnostic(
              "UI_COMPONENT_BINDING_INCOMPATIBLE",
              `Action '${binding.invokeAction.actionId}' declares no input '${inputName}'.`,
              {
                documentId,
                nodeId: node.id,
                output: outputName,
                actionId: binding.invokeAction.actionId,
                input: inputName
              }
            )
          );
          continue;
        }
        issues.push(
          ...checkBindingExpression(
            expression,
            expected,
            decl.payload,
            catalogs2,
            documentId,
            node.id,
            lexicalScope
          )
        );
      }
    }
    const invalid = issues.slice(issueStart).some((issue) => issue.severity === "error" && !isDeferredFieldReference(issue, catalogs2));
    if (!invalid) acceptedBindings[outputName] = binding;
  }
  const slots = {};
  for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
    if (!(descriptor2.slots ?? []).includes(slotName)) {
      issues.push(
        uiDiagnostic(
          "UI_DOC_UNKNOWN_COMPONENT",
          `Descriptor '${descriptor2.id}' declares no slot '${slotName}'.`,
          { documentId, nodeId: node.id, definitionId: `${descriptor2.id}#${slotName}` }
        )
      );
      continue;
    }
    slots[slotName] = fill.children.map(compileChild);
  }
  const instruction = {
    kind: "extension",
    nodeId: node.id,
    occurrenceKey,
    extensionId: descriptor2.id,
    revision: effectiveRevision,
    propDecls: descriptor2.props,
    propValues: node.props ?? {},
    ...rejectedProps.length > 0 ? { rejectedProps } : {},
    ...outputDecls !== void 0 ? { outputDecls } : {},
    ...outputDecls !== void 0 ? { outputBindings: acceptedBindings } : {},
    ...Object.keys(slots).length > 0 ? { slots } : {}
  };
  return { instruction, issues };
}
function resolveAttributeValue(value) {
  if (typeof value === "string") return { type: "literal", value };
  return { type: "expression", expression: value };
}
function extractInteraction(interaction) {
  const base = { on: interaction.on };
  if (interaction.action === "invokeAction") {
    return {
      ...base,
      action: "invokeAction",
      actionId: interaction.actionId,
      params: interaction.input ?? {}
    };
  }
  if (interaction.action === "navigate") {
    return {
      ...base,
      action: "navigate",
      routeId: interaction.routeId,
      params: interaction.params ?? {}
    };
  }
  return {
    ...base,
    action: "setState",
    stateKey: interaction.key,
    params: { value: interaction.value }
  };
}
function checkBindingExpression(expression, expected, payloadType, catalogs2, documentId, nodeId, lexicalScope) {
  const scope = { ...lexicalScope, output: payloadType };
  return expected === void 0 ? checkExpression(expression, catalogs2, scope, documentId, nodeId) : checkExpressionTarget(expression, expected, catalogs2, scope, documentId, nodeId, "UI_COMPONENT_BINDING_INCOMPATIBLE");
}

// packages/ui/src/edit.ts
function cloneDocument(document2) {
  return JSON.parse(JSON.stringify(document2));
}
function isPlainObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function applyUiEdit(snapshot, transaction, catalogs2) {
  const issues = [];
  if (transaction.expectedDocumentRevision !== snapshot.revision) {
    return {
      ok: false,
      issues: [
        uiDiagnostic("UI_DOC_STALE_REVISION", "The transaction targets a stale revision.", {
          expectedRevision: transaction.expectedDocumentRevision,
          storedRevision: snapshot.revision
        })
      ]
    };
  }
  if (!Array.isArray(transaction.commands) || transaction.commands.length === 0) {
    return {
      ok: false,
      issues: [
        uiDiagnostic("UI_EDIT_VALIDATION_FAILED", "A transaction needs at least one command.", {
          commandIndex: 0,
          diagnostics: []
        })
      ]
    };
  }
  const working = cloneDocument(snapshot.document);
  const doc = working;
  doc.nodes = { ...doc.nodes ?? {} };
  doc.componentDefinitions = { ...doc.componentDefinitions ?? {} };
  doc.styleSources = { ...doc.styleSources ?? {} };
  doc.tokens = { ...doc.tokens ?? {} };
  doc.conditions = { ...doc.conditions ?? {} };
  doc.localState = { ...doc.localState ?? {} };
  transaction.commands.forEach((command, commandIndex) => {
    const fail = (message, diagnostics = []) => {
      issues.push(
        uiDiagnostic("UI_EDIT_VALIDATION_FAILED", message, { commandIndex, diagnostics })
      );
    };
    switch (command.op) {
      case "replaceDocument": {
        if (!isPlainObject2(command.document) || command.document.schema !== UI_DOCUMENT_SCHEMA || command.document.id !== working.id || command.document.revision !== working.revision || typeof command.document.root !== "string" || ![
          "nodes",
          "componentDefinitions",
          "styleSources",
          "tokens",
          "conditions",
          "assets",
          "localState"
        ].every(
          (key) => isPlainObject2(command.document[key])
        )) {
          fail("Source replacement must retain the document schema, id and revision.");
          return;
        }
        for (const key of Object.keys(working))
          delete working[key];
        Object.assign(working, cloneDocument(command.document));
        return;
      }
      case "insert": {
        const parent = doc.nodes[command.parentId];
        if (parent === void 0) {
          fail(`Insert parent '${command.parentId}' does not exist.`);
          return;
        }
        if (ownedChildren(parent, command.slotName) === void 0 || !declaredSlot(parent, command.slotName, working, catalogs2)) {
          fail(`Insert parent '${command.parentId}' cannot own children (${parent.kind}).`);
          return;
        }
        const node = command.node;
        if (typeof node !== "object" || node === null || Array.isArray(node) || typeof node.id !== "string" || node.id.length === 0) {
          fail("Inserted node needs a non-empty id.");
          return;
        }
        if (doc.nodes[node.id] !== void 0) {
          fail(`Node id '${node.id}' already exists.`, [
            uiDiagnostic("UI_DOC_DUPLICATE_NODE_ID", `Node id '${node.id}' already exists.`, {
              documentId: String(working.id),
              nodeId: node.id
            })
          ]);
          return;
        }
        const children = [...ownedChildren(parent, command.slotName)];
        const index = command.index ?? children.length;
        if (index < 0 || index > children.length) {
          fail(`Insert index ${String(command.index)} out of range.`);
          return;
        }
        children.splice(index, 0, node.id);
        doc.nodes[node.id] = node;
        const updatedParent = withOwnedChildren(parent, children, command.slotName);
        doc.nodes[updatedParent.id] = updatedParent;
        return;
      }
      case "move": {
        const node = doc.nodes[command.nodeId];
        const newParent = doc.nodes[command.newParentId];
        if (node === void 0 || newParent === void 0) {
          fail("Move source or target does not exist.");
          return;
        }
        if (command.nodeId === working.root || ownedChildren(newParent, command.slotName) === void 0 || !declaredSlot(newParent, command.slotName, working, catalogs2)) {
          fail(`Move target '${command.newParentId}' cannot own children.`);
          return;
        }
        if (command.nodeId === command.newParentId) {
          fail("A node cannot become its own parent.");
          return;
        }
        if (subtreeContains(doc.nodes, command.nodeId, command.newParentId)) {
          fail("Move would create a containment cycle.", [
            uiDiagnostic("UI_DOC_CYCLE", "Move would create a containment cycle.", {
              documentId: String(working.id),
              path: [command.nodeId, command.newParentId]
            })
          ]);
          return;
        }
        detach(doc.nodes, command.nodeId);
        const destination = doc.nodes[command.newParentId];
        const children = [...ownedChildren(destination, command.slotName)];
        const index = command.index ?? children.length;
        if (index < 0 || index > children.length) {
          fail(`Move index ${String(command.index)} out of range.`);
          return;
        }
        children.splice(index, 0, command.nodeId);
        const updatedTarget = withOwnedChildren(destination, children, command.slotName);
        doc.nodes[updatedTarget.id] = updatedTarget;
        return;
      }
      case "remove": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0) {
          fail(`Remove target '${command.nodeId}' does not exist.`);
          return;
        }
        if (command.nodeId === working.root) {
          fail("The root node cannot be removed.");
          return;
        }
        if (command.detachFromParent === true) detach(doc.nodes, command.nodeId);
        const remaining = collectReferences(doc, command.nodeId);
        if (remaining.length > 0) {
          fail(`Node '${command.nodeId}' is still referenced.`, [
            uiDiagnostic(
              "UI_EDIT_REFERENCE_REMAINS",
              `Node '${command.nodeId}' is still referenced.`,
              {
                nodeId: command.nodeId,
                remainingRefs: remaining
              }
            )
          ]);
          return;
        }
        detach(doc.nodes, command.nodeId);
        const subtree = collectNodeSubtree2(doc.nodes, command.nodeId);
        delete doc.nodes[command.nodeId];
        for (const ownedId of subtree) {
          const stillReferenced = collectReferences(doc, ownedId);
          if (stillReferenced.length === 0 && ownedId !== working.root) {
            delete doc.nodes[ownedId];
          }
        }
        delete doc.nodes[command.nodeId];
        return;
      }
      case "setProperty": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0) {
          fail(`setProperty target '${command.nodeId}' does not exist.`);
          return;
        }
        if (command.property === "tag" && node.kind === "element") {
          doc.nodes[node.id] = { ...node, tag: command.value };
        } else if (command.property === "textLiteral" && node.kind === "text") {
          const content = { type: "literal", value: command.value };
          doc.nodes[node.id] = { ...node, content };
        } else if (command.property === "itemName" && node.kind === "repeat") {
          doc.nodes[node.id] = { ...node, itemName: command.value };
        } else if (command.property === "definitionId" && node.kind === "component") {
          doc.nodes[node.id] = { ...node, definitionId: command.value };
        } else if (command.property === "slotName" && node.kind === "slot") {
          doc.nodes[node.id] = { ...node, name: command.value };
        } else {
          fail(`setProperty ${command.property} does not apply to node kind.`);
        }
        return;
      }
      case "setAttribute": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0 || node.kind !== "element") {
          fail("setAttribute requires an element node.");
          return;
        }
        const attributes = { ...node.attributes ?? {} };
        if (command.value === void 0) delete attributes[command.name];
        else attributes[command.name] = command.value;
        doc.nodes[node.id] = { ...node, attributes };
        return;
      }
      case "setStyleDeclaration": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0) {
          fail("setStyleDeclaration target does not exist.");
          return;
        }
        const localStyle = [...node.localStyle ?? []];
        const existingIndex = localStyle.findIndex(
          (declaration) => declaration.property === command.property
        );
        if (command.value === void 0) {
          if (existingIndex >= 0) localStyle.splice(existingIndex, 1);
        } else if (existingIndex >= 0) {
          localStyle[existingIndex] = { property: command.property, value: command.value };
        } else {
          localStyle.push({ property: command.property, value: command.value });
        }
        doc.nodes[node.id] = { ...node, localStyle };
        return;
      }
      case "setConditionalStyle": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0 || node.kind !== "element") {
          fail("setConditionalStyle requires an element node.");
          return;
        }
        if (command.conditionId !== void 0 && doc.conditions[command.conditionId] === void 0) {
          fail(`Unknown condition '${command.conditionId}'.`);
          return;
        }
        const sourceId = `src.${command.nodeId}.${command.conditionId ?? "always"}.${command.pseudo ?? "plain"}`;
        const styleSources = { ...doc.styleSources ?? {} };
        const attached = [...node.styleSources ?? []];
        const existing = styleSources[sourceId];
        const declarations = existing === void 0 ? [] : [...existing.declarations];
        const declarationIndex = declarations.findIndex(
          (declaration) => declaration.property === command.property
        );
        if (command.value === void 0) {
          if (declarationIndex >= 0) declarations.splice(declarationIndex, 1);
        } else if (declarationIndex >= 0) {
          declarations[declarationIndex] = { property: command.property, value: command.value };
        } else {
          declarations.push({ property: command.property, value: command.value });
        }
        if (declarations.length === 0) {
          delete styleSources[sourceId];
          const sourceIndex = attached.indexOf(sourceId);
          if (sourceIndex >= 0) attached.splice(sourceIndex, 1);
        } else if (existing === void 0) {
          styleSources[sourceId] = {
            id: sourceId,
            declarations,
            ...command.conditionId !== void 0 ? { conditionId: command.conditionId } : {},
            ...command.pseudo !== void 0 ? { pseudo: command.pseudo } : {}
          };
          attached.push(sourceId);
        } else {
          styleSources[sourceId] = { ...existing, declarations };
        }
        doc.styleSources = styleSources;
        doc.nodes[node.id] = {
          ...node,
          ...attached.length > 0 ? { styleSources: attached } : { styleSources: void 0 }
        };
        return;
      }
      case "setConditionState": {
        const condition = doc.conditions[command.conditionId];
        if (condition === void 0) {
          fail(`Condition '${command.conditionId}' does not exist.`);
          return;
        }
        doc.conditions[command.conditionId] = { ...condition, ...command.patch };
        return;
      }
      case "bindExpression": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0) {
          fail("bindExpression target does not exist.");
          return;
        }
        if (command.target.kind === "text") {
          if (node.kind !== "text") {
            fail("text binding requires a text node.");
            return;
          }
          if (command.expression === void 0) {
            fail("text binding needs an expression.");
            return;
          }
          const content = { type: "expression", expression: command.expression };
          doc.nodes[node.id] = { ...node, content };
          return;
        }
        if (command.target.kind === "attribute") {
          if (node.kind !== "element") {
            fail("attribute binding requires an element node.");
            return;
          }
          const attributes = { ...node.attributes ?? {} };
          if (command.expression === void 0) delete attributes[command.target.name];
          else attributes[command.target.name] = command.expression;
          doc.nodes[node.id] = { ...node, attributes };
          return;
        }
        if (node.kind !== "component") {
          fail("prop binding requires a component node.");
          return;
        }
        const props = { ...node.props ?? {} };
        if (command.expression === void 0) delete props[command.target.name];
        else props[command.target.name] = command.expression;
        doc.nodes[node.id] = { ...node, props };
        return;
      }
      case "connectInteraction": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0) {
          fail("connectInteraction target does not exist.");
          return;
        }
        const interactions = [...node.interactions ?? []];
        if (command.remove !== void 0) {
          const filtered2 = interactions.filter((candidate) => candidate.on !== command.remove?.on);
          doc.nodes[node.id] = { ...node, interactions: filtered2 };
          return;
        }
        if (command.interaction === void 0) {
          fail("connectInteraction needs an interaction or a removal.");
          return;
        }
        const filtered = interactions.filter(
          (candidate) => candidate.on !== command.interaction?.on
        );
        filtered.push(command.interaction);
        doc.nodes[node.id] = { ...node, interactions: filtered };
        return;
      }
      case "createComponentDefinition": {
        const definition = command.definition;
        if (!isPlainObject2(definition) || typeof definition.id !== "string" || typeof definition.revision !== "string" || typeof definition.root !== "string" || doc.nodes[definition.root] === void 0) {
          fail(
            "createComponentDefinition needs a definition with an id, revision and an existing root."
          );
          return;
        }
        if (doc.componentDefinitions[definition.id] !== void 0) {
          fail(`Definition '${definition.id}' already exists.`);
          return;
        }
        doc.componentDefinitions[definition.id] = definition;
        return;
      }
      case "updateComponentDefinition": {
        const definition = doc.componentDefinitions[command.definitionId];
        if (definition === void 0) {
          fail(`Definition '${command.definitionId}' does not exist.`);
          return;
        }
        doc.componentDefinitions[command.definitionId] = { ...definition, ...command.patch };
        return;
      }
      case "fillSlot": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0 || node.kind !== "component") {
          fail("fillSlot requires a component node.");
          return;
        }
        for (const childId of command.children) {
          if (doc.nodes[childId] === void 0) {
            fail(`Slot fill references missing node '${childId}'.`);
            return;
          }
        }
        const slots = {};
        for (const [name, fill] of Object.entries(node.slots ?? {})) {
          slots[name] = { name: fill.name, children: [...fill.children] };
        }
        slots[command.slotName] = { name: command.slotName, children: [...command.children] };
        doc.nodes[node.id] = { ...node, slots };
        return;
      }
      case "setOutputBinding": {
        const node = doc.nodes[command.nodeId];
        if (node === void 0 || node.kind !== "component") {
          fail("setOutputBinding requires a component node.");
          return;
        }
        if (command.output.length === 0) {
          fail("setOutputBinding needs a non-empty output name.");
          return;
        }
        const outputs = { ...node.outputs ?? {} };
        if (command.binding === void 0) delete outputs[command.output];
        else outputs[command.output] = command.binding;
        doc.nodes[node.id] = {
          ...node,
          ...Object.keys(outputs).length > 0 ? { outputs } : { outputs: void 0 }
        };
        return;
      }
      default:
        fail("Unknown command.");
    }
  });
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  const validation = validateUiDocument(working, catalogs2 ?? emptyCatalogs()).filter(
    (issue) => !isDeferredProductReference(issue) && !isUiComponentPlanDiagnostic(issue, working, catalogs2?.extensions ?? [])
  );
  if (validation.some((issue) => issue.severity === "error")) {
    return {
      ok: false,
      issues: [
        uiDiagnostic("UI_EDIT_VALIDATION_FAILED", "The resulting document does not validate.", {
          commandIndex: transaction.commands.length - 1,
          diagnostics: validation.filter((issue) => issue.severity === "error")
        })
      ]
    };
  }
  if (catalogs2?.extensions !== void 0) {
    const compiled = compileUiDocument(working, catalogs2.elements, catalogs2.extensions, catalogs2);
    if (!compiled.ok) return { ok: false, issues: compiled.issues };
  }
  return {
    ok: true,
    document: working,
    revision: snapshot.revision,
    requestId: transaction.requestId
  };
}
function isDeferredProductReference(issue) {
  if (issue.code === "UI_DOC_UNKNOWN_PRODUCT_REFERENCE") return true;
  if (issue.code === "UI_DOC_UNKNOWN_COMPONENT") return true;
  if (issue.code === "UI_EXPR_UNKNOWN_REFERENCE" && typeof issue.path === "string") {
    return issue.path.startsWith("view.") || issue.path.startsWith("record.") || issue.path.startsWith("repeat.");
  }
  return false;
}
function emptyCatalogs() {
  return {
    elements: { elements: [], globalAttributes: ["role", "aria-label", "data-test-id"] }
  };
}
function subtreeContains(nodes, ancestorId, maybeDescendantId) {
  return collectNodeSubtree2(nodes, ancestorId).has(maybeDescendantId);
}
function declaredSlot(node, slotName, document2, catalogs2) {
  if (slotName === void 0) return true;
  if (node.kind !== "component") return false;
  const definition = document2.componentDefinitions[node.definitionId];
  if (definition) return Object.hasOwn(definition.slots, slotName);
  const descriptor2 = catalogs2?.extensions?.find(
    (entry) => entry.id === node.definitionId && (node.revision === void 0 || entry.revision === node.revision)
  );
  return descriptor2?.slots?.includes(slotName) ?? false;
}
function ownedChildren(node, slotName) {
  if (slotName !== void 0)
    return node.kind === "component" && slotName.length > 0 ? node.slots?.[slotName]?.children ?? [] : void 0;
  return node.kind === "element" || node.kind === "portal" ? node.children : void 0;
}
function withOwnedChildren(node, children, slotName) {
  if (node.kind === "component" && slotName !== void 0)
    return {
      ...node,
      slots: { ...node.slots, [slotName]: { name: slotName, children } }
    };
  return { ...node, children };
}
function detach(nodes, nodeId) {
  for (const node of Object.values(nodes)) {
    if (node.kind === "element" || node.kind === "portal") {
      if (node.children.includes(nodeId)) {
        nodes[node.id] = {
          ...node,
          children: node.children.filter((child) => child !== nodeId)
        };
      }
    } else if (node.kind === "repeat" && node.templateRoot === nodeId) {
      nodes[node.id] = { ...node, templateRoot: "" };
    } else if (node.kind === "slot" && (node.fallback ?? []).includes(nodeId)) {
      nodes[node.id] = {
        ...node,
        fallback: node.fallback.filter((child) => child !== nodeId)
      };
    } else if (node.kind === "conditional") {
      let changed = false;
      const branches = node.branches.map((branch) => {
        if (branch.children.includes(nodeId)) {
          changed = true;
          return { ...branch, children: branch.children.filter((child) => child !== nodeId) };
        }
        return branch;
      });
      if (changed) nodes[node.id] = { ...node, branches };
    } else if (node.kind === "component" && node.slots !== void 0) {
      let changed = false;
      const slots = {};
      for (const [name, fill] of Object.entries(node.slots)) {
        if (fill.children.includes(nodeId)) {
          changed = true;
          slots[name] = {
            name: fill.name,
            children: fill.children.filter((child) => child !== nodeId)
          };
        } else {
          slots[name] = fill;
        }
      }
      if (changed) nodes[node.id] = { ...node, slots };
    }
  }
}
function collectReferences(doc, nodeId) {
  const refs = [];
  for (const node of Object.values(doc.nodes)) {
    if (node.id === nodeId) continue;
    if (node.kind === "element" || node.kind === "portal") {
      if (node.children.includes(nodeId)) refs.push(`${node.id}.children`);
    } else if (node.kind === "repeat") {
      if (node.templateRoot === nodeId) refs.push(`${node.id}.templateRoot`);
    } else if (node.kind === "slot") {
      if ((node.fallback ?? []).includes(nodeId)) refs.push(`${node.id}.fallback`);
    } else if (node.kind === "conditional") {
      node.branches.forEach((branch, index) => {
        if (branch.children.includes(nodeId)) refs.push(`${node.id}.branches.${index}`);
      });
    } else if (node.kind === "component" && node.slots !== void 0) {
      for (const [name, fill] of Object.entries(node.slots)) {
        if (fill.children.includes(nodeId)) refs.push(`${node.id}.slots.${name}`);
      }
    }
  }
  for (const definition of Object.values(doc.componentDefinitions)) {
    if (definition.root === nodeId) refs.push(`${definition.id}.root`);
    for (const [slotName, slot] of Object.entries(definition.slots ?? {})) {
      if ((slot.fallback ?? []).includes(nodeId))
        refs.push(`${definition.id}.slots.${slotName}.fallback`);
    }
  }
  return refs;
}
function collectNodeSubtree2(nodes, rootId) {
  const into = /* @__PURE__ */ new Set();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (into.has(id)) continue;
    into.add(id);
    const node = nodes[id];
    if (node === void 0) continue;
    if (node.kind === "element" || node.kind === "portal") stack.push(...node.children);
    else if (node.kind === "repeat") stack.push(node.templateRoot);
    else if (node.kind === "slot") stack.push(...node.fallback ?? []);
    else if (node.kind === "conditional")
      node.branches.forEach((branch) => stack.push(...branch.children));
    else if (node.kind === "component" && node.slots !== void 0) {
      for (const fill of Object.values(node.slots)) stack.push(...fill.children);
    }
  }
  return into;
}

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

// independent-source-probe.ts
var document = { schema: "vict.ui-document@1", id: "independent", revision: "r1", root: "screen", nodes: { screen: { id: "screen", kind: "element", tag: "main", children: ["select"] }, select: { id: "select", kind: "component", definitionId: "vict.catalog.select-multiple", props: {}, slots: { items: { name: "items", children: ["item"] } } }, item: { id: "item", kind: "component", definitionId: "vict.catalog.select-item", props: { value: { type: "literal", value: "one" } } } }, componentDefinitions: {}, styleSources: {}, assets: {}, tokens: {}, conditions: {}, localState: {} };
var catalogs = { elements: defaultSemanticElementCatalog(), extensions: b2CatalogDescriptors };
var move = moveRelative(document, "item", "screen", "inside", b2CatalogDescriptors);
var result = applyUiEdit({ document, revision: "r1" }, { requestId: "probe", expectedDocumentRevision: "r1", commands: [move] }, catalogs);
var detached = applyUiEdit({ document, revision: "r1" }, { ...detachSlotContent("detach", document, "item"), expectedDocumentRevision: "r1" }, catalogs);
var reuse = detached.ok && applyUiEdit({ document: detached.document, revision: "r1" }, { requestId: "reuse", expectedDocumentRevision: "r1", commands: [{ op: "move", nodeId: "item", newParentId: "screen" }] }, catalogs);
console.log(JSON.stringify({ candidate: "17081fde966741a8ba60faf0661e588f96a5dda8", layerMove: move, layerAccepted: result.ok, layerIssues: result.issues, detachAccepted: detached.ok, reuseAccepted: reuse?.ok, reuseIssues: reuse?.issues, screen: result.ok && result.document.nodes.screen }, null, 2));
