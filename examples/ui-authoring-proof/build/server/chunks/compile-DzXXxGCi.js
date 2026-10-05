import { h as head, k as element, i as derived, b as ensure_array_like, f as attr_class, j as clsx, c as attr, l as attributes, e as escape_html } from './index.js-BVAQDQEm.js';

function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
const widths = ["standard", "wide", "full"];
const densities = ["comfortable", "compact"];
const APPLICATION_COMPOSITION_CHOICES = {
  navigation: ["sidebar", "top", "none"],
  contentWidth: widths,
  density: densities,
  /** nested `responsive.navigationAt` member */
  "responsive.navigationAt": ["small", "medium"]
};
const PAGE_COMPOSITION_CHOICES = {
  contentWidth: widths,
  density: densities,
  supportingWidth: ["narrow", "standard"],
  stackAt: ["small", "medium", "large"]
};
const REGION_PRESENTATION_CHOICES = {
  size: ["full", "main", "aside"],
  appearance: ["plain", "panel"],
  flow: ["stack", "inline"]
};
const LAYOUT_MODES = ["stack", "split"];
function validateObject(value, path, rules, nestedResponsive = false) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return [{ path, message: "Composition must be an object." }];
  }
  const issues = [];
  for (const key of Object.keys(value).sort()) {
    const member = value[key];
    const memberPath = path + "." + key;
    if (nestedResponsive && key === "responsive") {
      issues.push(...validateObject(member, memberPath, {
        navigationAt: [...APPLICATION_COMPOSITION_CHOICES["responsive.navigationAt"]]
      }));
    } else if (!Object.hasOwn(rules, key)) {
      issues.push({ path: memberPath, message: "Unknown composition choice." });
    } else if (typeof member !== "string" || !rules[key]?.includes(member)) {
      issues.push({ path: memberPath, message: "Invalid composition choice." });
    }
  }
  return issues;
}
function validateApplicationComposition(value, path = "composition") {
  return validateObject(value, path, {
    navigation: APPLICATION_COMPOSITION_CHOICES["navigation"],
    contentWidth: APPLICATION_COMPOSITION_CHOICES["contentWidth"],
    density: APPLICATION_COMPOSITION_CHOICES["density"]
  }, true);
}
function validatePageComposition(value, path = "composition") {
  return validateObject(value, path, {
    contentWidth: PAGE_COMPOSITION_CHOICES["contentWidth"],
    density: PAGE_COMPOSITION_CHOICES["density"],
    supportingWidth: PAGE_COMPOSITION_CHOICES["supportingWidth"],
    stackAt: PAGE_COMPOSITION_CHOICES["stackAt"]
  });
}
function validateLayoutMode(value, path = "layoutMode") {
  return LAYOUT_MODES.includes(value) ? [] : [{ path, message: "Invalid screen layoutMode." }];
}
function validateRegionPresentation(value, path = "region") {
  return validateObject(value, path, {
    size: REGION_PRESENTATION_CHOICES["size"],
    appearance: REGION_PRESENTATION_CHOICES["appearance"],
    flow: REGION_PRESENTATION_CHOICES["flow"]
  });
}
const ACTION_FEEDBACK_OUTCOMES = [
  "success",
  "validation",
  "denied",
  "failure"
];
function validateActionFeedback(value, path = "feedback") {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return [{ path, message: "Action feedback must be an object." }];
  return Object.keys(value).sort().flatMap((key) => {
    const text = value[key];
    return !ACTION_FEEDBACK_OUTCOMES.includes(key) || typeof text !== "string" || text.trim().length === 0 ? [
      {
        path: path + "." + key,
        message: "Action feedback must declare a supported outcome with non-empty text."
      }
    ] : [];
  });
}
const UI_DOCUMENT_SCHEMA = "vict.ui-document@1";
const UI_RENDER_PLAN_SCHEMA = "vict.ui-render-plan@1";
class CanonicalUiError extends Error {
  code;
  path;
  constructor(code, message, path) {
    super(`Canonical UI identity error (${code}): ${message}`);
    this.name = "CanonicalUiError";
    this.code = code;
    this.path = path;
  }
}
const K$1 = new Uint32Array([
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
const rotr$1 = (x, n) => x >>> n | x << 32 - n;
function sha256$1(message) {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const paddedLength = (bytes.length + 9 + 63 & -64) >>> 0;
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
      const s0 = rotr$1(wi15, 7) ^ rotr$1(wi15, 18) ^ wi15 >>> 3;
      const s1 = rotr$1(wi2, 17) ^ rotr$1(wi2, 19) ^ wi2 >>> 10;
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
      const S1 = rotr$1(e, 6) ^ rotr$1(e, 11) ^ rotr$1(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = h + S1 + ch + K$1[i] + w[i] >>> 0;
      const S0 = rotr$1(a, 2) ^ rotr$1(a, 13) ^ rotr$1(a, 22);
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
const seen = /* @__PURE__ */ new Set();
function stableJson$1(value) {
  return JSON.stringify(canonicalize$1(value));
}
function canonicalize$1(value, path = "(root)") {
  if (value === null)
    return null;
  const type = typeof value;
  if (type === "string" || type === "boolean")
    return value;
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
    throw new CanonicalUiError("NON_CANONICAL_VALUE", `the canonical serializable domain rejects ${type} at '${path}'`, path);
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
      return value.map((item, index) => canonicalize$1(item, `${path}[${index}]`));
    } finally {
      seen.delete(value);
    }
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalUiError("NON_CANONICAL_VALUE", `unsupported prototype at '${path}' (plain data only)`, path);
  }
  const source = value;
  seen.add(value);
  try {
    const out = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== void 0)
        out[key] = canonicalize$1(item, `${path}.${key}`);
    }
    return out;
  } finally {
    seen.delete(value);
  }
}
function canonicalUiDocument(document) {
  const bytes = stableJson$1(document);
  return { bytes, contentDigest: sha256$1(bytes) };
}
function orderUiDocumentIdentityEntries(entries) {
  const byKey = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = `${entry.documentId}\0${entry.revision}`;
    const existing = byKey.get(key);
    if (existing !== void 0 && existing.contentDigest !== entry.contentDigest) {
      throw new CanonicalUiError("REVISION_COLLISION", `two entries for (${entry.documentId}, ${entry.revision}) disagree on contentDigest`, `${entry.documentId}@${entry.revision}`);
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.documentId !== b.documentId)
      return a.documentId < b.documentId ? -1 : 1;
    return a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0;
  });
}
function uiDiagnostic(code, message, details = {}) {
  return { code, message, severity: severityFor(code), ...details };
}
const WARNING_CODES = /* @__PURE__ */ new Set([
  "UI_DOC_UNSUPPORTED_FEATURE",
  "UI_STYLE_PROPERTY_UNSUPPORTED"
]);
function severityFor(code) {
  return WARNING_CODES.has(code) ? "warning" : "error";
}
function hasErrors(diagnostics) {
  return diagnostics.some((d) => d.severity === "error");
}
const PRIMITIVES = /* @__PURE__ */ new Set(["string", "number", "boolean"]);
function literalType(value) {
  if (value === null)
    return "null";
  return typeof value;
}
function typesCompatible(expected, actual) {
  if (expected === actual)
    return true;
  if (expected === "any" || actual === "any" || actual === "unknown")
    return true;
  if (actual === "null")
    return true;
  if (expected === "array")
    return actual === "array";
  return PRIMITIVES.has(expected) && PRIMITIVES.has(actual) && expected === actual;
}
function splitRef(path) {
  return path.split(".");
}
function checkExpression(expression, catalogs, scope, documentId, nodeId) {
  const issues = [];
  const walk = (expr, localScope) => {
    switch (expr.type) {
      case "literal":
        return literalType(expr.value);
      case "ref": {
        return checkRef(expr.path, catalogs, localScope, documentId, nodeId, issues);
      }
      case "compare": {
        const left = walk(expr.left, localScope);
        const right = walk(expr.right, localScope);
        if (left !== "unknown" && right !== "unknown" && left !== "null" && right !== "null" && !typesCompatible(left, right)) {
          issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Comparison compares ${left} with ${right}.`, {
            documentId,
            nodeId,
            expected: left,
            actual: right
          }));
        }
        return "boolean";
      }
      case "boolean": {
        for (const term of expr.terms) {
          const termType = walk(term, localScope);
          if (termType !== "boolean" && termType !== "unknown" && termType !== "any") {
            issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Boolean operator requires boolean terms.`, {
              documentId,
              nodeId,
              expected: "boolean",
              actual: termType
            }));
          }
        }
        return "boolean";
      }
      case "conditionalValue": {
        const whenType = walk(expr.when, localScope);
        if (whenType !== "boolean" && whenType !== "unknown" && whenType !== "any") {
          issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Condition must be boolean.`, {
            documentId,
            nodeId,
            expected: "boolean",
            actual: whenType
          }));
        }
        const thenType = walk(expr.then, localScope);
        walk(expr.otherwise, localScope);
        return thenType;
      }
      case "op": {
        if (catalogs.opNames !== void 0 && !catalogs.opNames.includes(expr.name)) {
          issues.push(uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `Registered operation '${expr.name}' is not declared by the catalogs.`, { documentId, nodeId, path: `op:${expr.name}` }));
        }
        for (const arg of expr.args)
          walk(arg, localScope);
        return "unknown";
      }
    }
  };
  walk(expression, scope);
  return issues;
}
function checkRef(path, catalogs, scope, documentId, nodeId, issues) {
  const parts = splitRef(path);
  const head2 = parts[0];
  const unknown = () => {
    issues.push(uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `Reference '${path}' does not resolve in this scope.`, {
      documentId,
      nodeId,
      path
    }));
    return "unknown";
  };
  if (head2 === "view" || head2 === "record") {
    if (scope.inDefinition) {
      issues.push(uiDiagnostic("UI_EXPR_SCOPE_VIOLATION", `view/record data is not visible inside a definition registry (use typed props).`, { documentId, nodeId, scope: path }));
      return "unknown";
    }
    const fields = catalogs.viewFields ?? {};
    const fieldType = parts.length === 2 ? fields[parts[1]] : void 0;
    if (fieldType === void 0)
      return unknown();
    return fieldType;
  }
  if (head2 === "repeat") {
    if (scope.inDefinition) {
      issues.push(uiDiagnostic("UI_EXPR_SCOPE_VIOLATION", `repeat items are not visible inside a definition registry (use typed props).`, { documentId, nodeId, scope: path }));
      return "unknown";
    }
    if (parts.length !== 3)
      return unknown();
    const itemType = scope.repeatItems[parts[1]];
    if (itemType === void 0)
      return unknown();
    const fieldType = itemType[parts[2]];
    if (fieldType === void 0)
      return unknown();
    return fieldType;
  }
  if (head2 === "prop") {
    if (!scope.inDefinition) {
      issues.push(uiDiagnostic("UI_EXPR_SCOPE_VIOLATION", `prop.* is only visible inside a component definition registry (typed props).`, { documentId, nodeId, scope: path }));
      return "unknown";
    }
    return "any";
  }
  if (head2 === "state") {
    if (scope.inDefinition) {
      issues.push(uiDiagnostic("UI_EXPR_SCOPE_VIOLATION", `document-level state is not visible inside a definition registry (use typed props).`, { documentId, nodeId, scope: path }));
      return "unknown";
    }
    return "any";
  }
  if (head2 === "token") {
    if (scope.inDefinition) {
      issues.push(uiDiagnostic("UI_EXPR_SCOPE_VIOLATION", `token.* is a document-level scope, not visible inside a definition registry.`, { documentId, nodeId, scope: path }));
      return "unknown";
    }
    return "string";
  }
  return unknown();
}
function evaluateExpression(expression, values, ops = {}) {
  switch (expression.type) {
    case "literal":
      return expression.value;
    case "ref": {
      const parts = splitRef(expression.path);
      const head2 = parts[0];
      if ((head2 === "view" || head2 === "record") && parts.length === 2) {
        const bag = head2 === "view" ? values.view : values.record;
        return bag?.[parts[1]];
      }
      if (head2 === "repeat" && parts.length === 3) {
        if (values.repeatItem !== void 0 && values.repeatItem.name === parts[1]) {
          return values.repeatItem.value[parts[2]];
        }
        return void 0;
      }
      if (head2 === "prop" && parts.length === 2)
        return values.props?.[parts[1]];
      if (head2 === "state" && parts.length === 2)
        return values.state?.[parts[1]];
      if (head2 === "token" && parts.length === 2)
        return values.tokens?.[parts[1]];
      return void 0;
    }
    case "compare": {
      const left = evaluateExpression(expression.left, values, ops);
      const right = evaluateExpression(expression.right, values, ops);
      switch (expression.op) {
        case "eq":
          return left === right;
        case "ne":
          return left !== right;
        case "lt":
          return left < right;
        case "lte":
          return left <= right;
        case "gt":
          return left > right;
        case "gte":
          return left >= right;
      }
      return void 0;
    }
    case "boolean": {
      const evaluated = expression.terms.map((term) => Boolean(evaluateExpression(term, values, ops)));
      if (expression.op === "not")
        return !evaluated[0];
      if (expression.op === "and")
        return evaluated.every(Boolean);
      return evaluated.some(Boolean);
    }
    case "conditionalValue":
      return Boolean(evaluateExpression(expression.when, values, ops)) ? evaluateExpression(expression.then, values, ops) : evaluateExpression(expression.otherwise, values, ops);
    case "op": {
      const op = ops[expression.name];
      if (op === void 0)
        return void 0;
      return op(expression.args.map((arg) => evaluateExpression(arg, values, ops)));
    }
  }
}
const GLOBAL_ATTRIBUTES = [
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
const ELEMENTS = [
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
  // form essentials
  { tag: "form", attributes: ["name"] },
  { tag: "label", attributes: ["for"] },
  {
    tag: "input",
    attributes: ["type", "name", "value", "placeholder", "required", "disabled", "checked", "min", "max", "step"],
    leaf: true
  },
  {
    tag: "select",
    attributes: ["name", "required", "disabled"]
  },
  { tag: "option", attributes: ["value", "selected", "disabled"] },
  { tag: "textarea", attributes: ["name", "placeholder", "rows", "required", "disabled"], leaf: true },
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
  const def = catalog.elements.find((element2) => element2.tag === tag);
  return /* @__PURE__ */ new Set([...catalog.globalAttributes, ...def?.attributes ?? [], "data-*"]);
}
function isAllowedAttribute(catalog, tag, name) {
  if (name.startsWith("data-"))
    return true;
  return allowedAttributes(catalog, tag).has(name);
}
function isKnownElement(catalog, tag) {
  return catalog.elements.some((element2) => element2.tag === tag);
}
function isLeafElement(catalog, tag) {
  return catalog.elements.find((element2) => element2.tag === tag)?.leaf === true;
}
function isPlainObject$2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function registryOf(document, key) {
  const value = document[key];
  return isPlainObject$2(value) ? value : {};
}
function validateUiDocument(input, catalogs) {
  const issues = [];
  if (!isPlainObject$2(input)) {
    return [
      uiDiagnostic("UI_DOC_UNKNOWN_SCHEMA", "A UI document must be a plain object.", {
        schema: "(not an object)",
        supported: [UI_DOCUMENT_SCHEMA]
      })
    ];
  }
  const document = input;
  if (document.schema !== UI_DOCUMENT_SCHEMA) {
    issues.push(uiDiagnostic("UI_DOC_UNKNOWN_SCHEMA", `Unsupported UI document schema.`, {
      schema: String(document.schema),
      supported: [UI_DOCUMENT_SCHEMA]
    }));
    return issues;
  }
  if (!nonEmptyString(document.id)) {
    issues.push(uiDiagnostic("UI_DOC_REFERENCE_DANGLING", "A UI document must declare a non-empty id.", {
      documentId: String(document.id ?? ""),
      reference: "document.id"
    }));
  }
  if (!nonEmptyString(document.revision)) {
    issues.push(uiDiagnostic("UI_DOC_REFERENCE_DANGLING", "A UI document must declare a non-empty revision.", {
      documentId: String(document.id ?? ""),
      reference: "document.revision"
    }));
  }
  if (!nonEmptyString(document.root)) {
    issues.push(uiDiagnostic("UI_DOC_REFERENCE_DANGLING", "A UI document must declare a root node id.", {
      documentId: String(document.id ?? ""),
      reference: "document.root"
    }));
    return issues;
  }
  const docRecord = document;
  const nodes = registryOf(docRecord, "nodes");
  const definitions = registryOf(docRecord, "componentDefinitions");
  const styleSources = registryOf(docRecord, "styleSources");
  const tokens = registryOf(docRecord, "tokens");
  const conditions = registryOf(docRecord, "conditions");
  const localState = registryOf(docRecord, "localState");
  const ctx = { document, catalogs, issues };
  const documentId = String(document.id);
  const knownIds = /* @__PURE__ */ new Set();
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!isPlainObject$2(node) || !nonEmptyString(node.id)) {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", "Every node entry must be an object with an id.", {
        documentId,
        nodeId,
        missingChildId: nodeId
      }));
      continue;
    }
    if (node.id !== nodeId) {
      issues.push(uiDiagnostic("UI_DOC_DUPLICATE_NODE_ID", `Node registry key '${nodeId}' does not match the node's own id '${node.id}'.`, { documentId, nodeId }));
    }
    if (knownIds.has(node.id)) {
      issues.push(uiDiagnostic("UI_DOC_DUPLICATE_NODE_ID", `Node id '${node.id}' is registered twice.`, {
        documentId,
        nodeId: node.id
      }));
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
    if (visited.has(nodeId))
      return;
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      issues.push(uiDiagnostic("UI_DOC_CYCLE", "Containment cycle in the node tree.", {
        documentId,
        path: [...path.slice(cycleStart === -1 ? 0 : cycleStart), nodeId]
      }));
      return;
    }
    const node = nodes[nodeId];
    if (node === void 0) {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Referenced node '${nodeId}' does not exist.`, {
        documentId,
        nodeId: path[path.length - 1] ?? String(document.root),
        missingChildId: nodeId
      }));
      return;
    }
    visiting.add(nodeId);
    path.push(nodeId);
    validateNode(ctx, node, scope, nodes);
    if (node.kind === "repeat") {
      const inner = innerRepeatScope(node, scope);
      visit(node.templateRoot, inner);
    } else {
      for (const childId of childRefsOf(node))
        visit(childId, scope);
    }
    for (const fill of definitionSlotFillChildren(node)) {
      for (const childId of fill.children)
        visit(childId, scope);
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  visit(String(document.root), { repeatItems: {}, inDefinition: false });
  for (const definition of Object.values(definitions)) {
    const defScope = { repeatItems: {}, inDefinition: true };
    const stack = [{ id: definition.root, scope: defScope }];
    const defSeen = /* @__PURE__ */ new Set();
    while (stack.length > 0) {
      const entry = stack.pop();
      const nodeId = entry.id;
      if (defSeen.has(nodeId))
        continue;
      defSeen.add(nodeId);
      const node = nodes[nodeId];
      if (node === void 0) {
        issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Definition body references missing node '${nodeId}'.`, {
          documentId,
          nodeId: definition.root,
          missingChildId: nodeId
        }));
        continue;
      }
      validateNode(ctx, node, entry.scope, nodes);
      if (node.kind === "repeat") {
        stack.push({ id: node.templateRoot, scope: innerRepeatScope(node, entry.scope) });
      } else if (node.kind === "element" || node.kind === "portal") {
        for (const childId of node.children)
          stack.push({ id: childId, scope: entry.scope });
      } else if (node.kind === "slot") {
        for (const childId of node.fallback ?? [])
          stack.push({ id: childId, scope: entry.scope });
      } else if (node.kind === "conditional") {
        for (const branch of node.branches) {
          for (const childId of branch.children)
            stack.push({ id: childId, scope: entry.scope });
        }
      }
      if (node.kind === "component" && node.slots !== void 0) {
        for (const fill of Object.values(node.slots)) {
          for (const childId of fill.children)
            stack.push({ id: childId, scope: entry.scope });
        }
      }
      visited.add(nodeId);
    }
  }
  const ownerCount = /* @__PURE__ */ new Map();
  const countOwner = (ownerId, owned) => {
    for (const childId of owned ?? []) {
      ownerCount.set(childId, (ownerCount.get(childId) ?? 0) + 1);
    }
  };
  for (const node of Object.values(nodes)) {
    if (node.kind === "element" || node.kind === "portal")
      countOwner(node.id, node.children);
    else if (node.kind === "repeat")
      countOwner(node.id, [node.templateRoot]);
    else if (node.kind === "slot")
      countOwner(node.id, node.fallback);
    else if (node.kind === "conditional") {
      for (const branch of node.branches)
        countOwner(node.id, branch.children);
    } else if (node.kind === "component" && node.slots !== void 0) {
      for (const fill of Object.values(node.slots))
        countOwner(node.id, fill.children);
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
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Node '${ownedId}' has ${count} owners; every node has exactly one source parent.`, {
        documentId,
        nodeId: ownedId,
        missingChildId: ownedId
      }));
    }
  }
  for (const [definitionId, definition] of Object.entries(definitions)) {
    validateDefinition(ctx, definitionId, definition, styleSources, conditions);
  }
  const defVisiting = /* @__PURE__ */ new Set();
  const defDone = /* @__PURE__ */ new Set();
  const defPath = [];
  const walkDefinition = (id) => {
    if (defDone.has(id))
      return;
    if (defVisiting.has(id)) {
      const start = defPath.indexOf(id);
      issues.push(uiDiagnostic("UI_DOC_CYCLE", "Definition-level expansion cycle.", {
        documentId,
        path: defPath.slice(start === -1 ? 0 : start).concat(id)
      }));
      return;
    }
    const definition = definitions[id];
    if (definition === void 0)
      return;
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
  for (const id of Object.keys(definitions))
    walkDefinition(id);
  for (const [tokenId, token] of Object.entries(tokens)) {
    if (!isPlainObject$2(token) || !nonEmptyString(token.value)) {
      issues.push(uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `Token '${tokenId}' must declare a string value.`, {
        documentId,
        nodeId: document.root,
        path: `token.${tokenId}`
      }));
    }
  }
  for (const [sourceId, source] of Object.entries(styleSources)) {
    if (!isPlainObject$2(source))
      continue;
    for (const declaration of source.declarations ?? []) {
      validateStyleDeclaration(ctx, declaration, String(sourceId), String(document.root), tokens);
    }
  }
  for (const [conditionId, condition] of Object.entries(conditions)) {
    validateCondition(ctx, conditionId, condition);
  }
  for (const [key, decl] of Object.entries(localState)) {
    if (!isPlainObject$2(decl))
      continue;
    const type = decl.type;
    const initial = decl.initial;
    const matches = type === "string" && typeof initial === "string" || type === "number" && typeof initial === "number" || type === "boolean" && typeof initial === "boolean";
    if (!matches) {
      issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Local state '${key}' initial value does not match its type.`, {
        documentId,
        nodeId: document.root,
        expected: String(type),
        actual: typeof initial
      }));
    }
  }
  return issues;
}
function collectNodeSubtree(root, nodes, into) {
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop();
    if (into.has(id))
      continue;
    into.add(id);
    const node = nodes[id];
    if (node === void 0)
      continue;
    if (node.kind === "element" || node.kind === "portal")
      stack.push(...node.children);
    if (node.kind === "repeat")
      stack.push(node.templateRoot);
    if (node.kind === "slot")
      stack.push(...node.fallback ?? []);
    if (node.kind === "component" && node.slots !== void 0) {
      for (const fill of Object.values(node.slots))
        stack.push(...fill.children);
    }
  }
  return into;
}
function validateNode(ctx, node, scope, nodes) {
  const { document, catalogs, issues } = ctx;
  const docRecord = document;
  const documentId = String(document.id);
  switch (node.kind) {
    case "element": {
      if (!isKnownElement(catalogs.elements, node.tag)) {
        issues.push(uiDiagnostic("UI_DOC_UNKNOWN_ELEMENT", `Element tag '${node.tag}' is not registered.`, {
          documentId,
          nodeId: node.id,
          tag: node.tag
        }));
        break;
      }
      for (const name of Object.keys(node.attributes ?? {})) {
        if (!isAllowedAttribute(catalogs.elements, node.tag, name)) {
          issues.push(uiDiagnostic("UI_DOC_UNKNOWN_ATTRIBUTE", `Attribute '${name}' is not declared for element '${node.tag}'.`, { documentId, nodeId: node.id, tag: node.tag, attribute: name }));
        }
      }
      if (isLeafElement(catalogs.elements, node.tag) && node.children.length > 0) {
        issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Element '${node.tag}' is a leaf and cannot own children.`, { documentId, nodeId: node.children[0], missingChildId: node.children[0] }));
      }
      for (const attribute of Object.entries(node.attributes ?? {})) {
        if (typeof attribute[1] === "object" && attribute[1] !== null) {
          issues.push(...checkExpression(attribute[1], catalogs, scope, documentId, node.id));
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
        issues.push(...checkExpression(node.content.expression, catalogs, scope, documentId, node.id));
      } else if (typeof node.content.value !== "string") {
        issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", "Literal text content must be a string.", {
          documentId,
          nodeId: node.id,
          expected: "string",
          actual: typeof node.content.value
        }));
      }
      break;
    }
    case "component": {
      const definition = registryOf(docRecord, "componentDefinitions")[node.definitionId];
      if (definition === void 0) {
        issues.push(uiDiagnostic("UI_DOC_UNKNOWN_COMPONENT", `Component definition '${node.definitionId}' is not stored in this document (extension resolution is the compiler's obligation).`, { documentId, nodeId: node.id, definitionId: node.definitionId }));
        break;
      }
      for (const [propName, expression] of Object.entries(node.props ?? {})) {
        const typeIssue = checkExpression(expression, catalogs, scope, documentId, node.id);
        issues.push(...typeIssue);
        const propDecl = definition.props?.find((candidate) => candidate.name === propName);
        if (propDecl !== void 0 && expression.type === "literal") {
          const actual = expression.value === null ? "null" : typeof expression.value;
          if (actual !== "null" && actual !== propDecl.type) {
            issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", `Prop '${propName}' expects ${propDecl.type}.`, {
              documentId,
              nodeId: node.id,
              expected: propDecl.type,
              actual
            }));
          }
        }
      }
      for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
        const declared = definition.slots?.[slotName];
        if (declared === void 0) {
          issues.push(uiDiagnostic("UI_DOC_UNKNOWN_COMPONENT", `Definition '${node.definitionId}' declares no slot '${slotName}'.`, { documentId, nodeId: node.id, definitionId: `${node.definitionId}#${slotName}` }));
        }
        for (const childId of fill.children) {
          const child = nodes[childId];
          if (child === void 0) {
            issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Slot fill references missing node '${childId}'.`, {
              documentId,
              nodeId: node.id,
              missingChildId: childId
            }));
            continue;
          }
          validateNode(ctx, child, scope, nodes);
        }
      }
      break;
    }
    case "repeat": {
      const collectionType = checkExpressionTypeOf(ctx, node.collection, scope, node.id);
      if (collectionType !== "array" && collectionType !== "unknown" && collectionType !== "any") {
        issues.push(uiDiagnostic("UI_EXPR_TYPE_MISMATCH", "A repeat collection must resolve to an array.", {
          documentId,
          nodeId: node.id,
          expected: "array",
          actual: collectionType
        }));
      }
      const innerScope = {
        repeatItems: {
          ...scope.repeatItems,
          [node.itemName]: repeatItemFields(ctx, node.collection)
        },
        inDefinition: scope.inDefinition
      };
      issues.push(...checkExpression(node.key, catalogs, innerScope, documentId, node.id));
      break;
    }
    case "conditional": {
      for (const branch of node.branches) {
        if (branch.when !== void 0) {
          const condition = registryOf(docRecord, "conditions")[branch.when];
          if (condition === void 0) {
            issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Branch references unknown condition.`, {
              documentId,
              conditionId: branch.when
            }));
          } else if (condition.kind !== "localState") {
            issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", "A conditional branch requires a localState condition (media conditions belong to style rules).", { documentId, conditionId: branch.when }));
          } else {
            const when = condition.when;
            if (when !== void 0) {
              issues.push(...checkExpression(when, catalogs, scope, documentId, node.id));
            }
          }
        }
        for (const childId of branch.children) {
          const child = nodes[childId];
          if (child === void 0) {
            issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Branch references missing node '${childId}'.`, {
              documentId,
              nodeId: node.id,
              missingChildId: childId
            }));
            continue;
          }
          validateNode(ctx, child, scope, nodes);
        }
      }
      break;
    }
    case "slot": {
      if (!scope.inDefinition) {
        issues.push(uiDiagnostic("UI_EXPR_SCOPE_VIOLATION", "Slot placeholders are only valid inside a component definition body.", { documentId, nodeId: node.id, scope: "slot:outside-definition" }));
      }
      break;
    }
    case "portal": {
      issues.push(uiDiagnostic("UI_DOC_UNSUPPORTED_FEATURE", "Portal rendering is pending beyond the U1 slice.", {
        documentId,
        nodeId: node.id,
        feature: "portal"
      }));
      break;
    }
  }
}
function repeatItemFields(ctx, collection) {
  if (collection.type !== "ref")
    return {};
  const parts = collection.path.split(".");
  if (parts[0] !== "view" && parts[0] !== "record" || parts.length !== 2)
    return {};
  const fields = ctx.catalogs.viewFields ?? {};
  const prefix = `${parts[1]}.`;
  const itemFields = {};
  for (const [name, type] of Object.entries(fields)) {
    if (name.startsWith(prefix))
      itemFields[name.slice(prefix.length)] = type;
  }
  return itemFields;
}
function checkExpressionTypeOf(ctx, expression, scope, nodeId, _expected) {
  const issues = [];
  const catalogs = ctx.catalogs;
  issues.push(...checkExpression(expression, catalogs, scope, String(ctx.document.id), nodeId));
  ctx.issues.push(...issues);
  return inferType(expression, catalogs, scope);
}
function inferType(expression, catalogs, scope) {
  switch (expression.type) {
    case "literal":
      return expression.value === null ? "null" : typeof expression.value;
    case "ref": {
      const parts = expression.path.split(".");
      const head2 = parts[0];
      if ((head2 === "view" || head2 === "record") && parts.length === 2) {
        return (catalogs.viewFields ?? {})[parts[1]] ?? "unknown";
      }
      if (head2 === "repeat" && parts.length === 3) {
        return scope.repeatItems[parts[1]]?.[parts[2]] ?? "unknown";
      }
      if (head2 === "token")
        return "string";
      if (head2 === "prop" && scope.inDefinition)
        return "any";
      if (head2 === "state" && !scope.inDefinition)
        return "any";
      return "unknown";
    }
    case "compare":
    case "boolean":
      return "boolean";
    case "conditionalValue":
      return inferType(expression.then, catalogs, scope);
    case "op":
      return "unknown";
  }
}
function validateInteraction(ctx, nodeId, interaction, scope) {
  const { document, catalogs, issues } = ctx;
  const docRecord = document;
  const documentId = String(document.id);
  if (interaction.action === "invokeAction") {
    if (catalogs.actionIds !== void 0 && !catalogs.actionIds.includes(interaction.actionId)) {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_PRODUCT_REFERENCE", `Interaction references undeclared action '${interaction.actionId}'.`, { documentId, nodeId, kind: "action", ref: interaction.actionId }));
    }
    const input = interaction.input;
    for (const expression of Object.values(input ?? {})) {
      issues.push(...checkExpression(expression, catalogs, scope, documentId, nodeId));
    }
  } else if (interaction.action === "navigate") {
    if (catalogs.routeIds !== void 0 && !catalogs.routeIds.includes(interaction.routeId)) {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_PRODUCT_REFERENCE", `Interaction references undeclared route '${interaction.routeId}'.`, { documentId, nodeId, kind: "route", ref: interaction.routeId }));
    }
    const params = interaction.params;
    for (const expression of Object.values(params ?? {})) {
      issues.push(...checkExpression(expression, catalogs, scope, documentId, nodeId));
    }
  } else if (interaction.action === "setState") {
    const localState = registryOf(docRecord, "localState");
    if (localState[interaction.key] === void 0) {
      issues.push(uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `setState targets undeclared state key.`, {
        documentId,
        nodeId,
        path: `state.${interaction.key}`
      }));
    }
    if (interaction.value !== void 0) {
      issues.push(...checkExpression(interaction.value, catalogs, scope, documentId, nodeId));
    }
  }
}
function validatePresentation(ctx, node, scope) {
  const { document, catalogs, issues } = ctx;
  const docRecord = document;
  const documentId = String(document.id);
  const styleSources = registryOf(docRecord, "styleSources");
  for (const sourceId of node.styleSources ?? []) {
    if (styleSources[sourceId] === void 0) {
      issues.push(uiDiagnostic("UI_DOC_REFERENCE_DANGLING", `Style source '${String(sourceId)}' does not exist.`, {
        documentId,
        nodeId: node.id,
        reference: `styleSource:${String(sourceId)}`
      }));
    }
  }
  for (const declaration of node.localStyle ?? []) {
    validateStyleDeclaration(ctx, declaration, node.id, node.id, registryOf(docRecord, "tokens"));
    if (declaration.value !== void 0 && typeof declaration.value === "object" && declaration.value.type === "binding") {
      issues.push(...checkExpression(declaration.value.expression, catalogs, scope, documentId, node.id));
    }
  }
}
function validateStyleDeclaration(ctx, declaration, owner, nodeId, tokens) {
  const { document, issues } = ctx;
  const documentId = String(document.id);
  if (!nonEmptyString(declaration.property)) {
    issues.push(uiDiagnostic("UI_STYLE_PROPERTY_UNSUPPORTED", `Style declaration needs a property name.`, {
      documentId,
      nodeId,
      property: String(declaration.property ?? "")
    }));
    return;
  }
  const value = declaration.value;
  if (value === void 0 || typeof value !== "object") {
    issues.push(uiDiagnostic("UI_STYLE_PROPERTY_UNSUPPORTED", `Style value must be a typed value.`, {
      documentId,
      nodeId,
      property: String(declaration.property)
    }));
    return;
  }
  if (value.type === "token" && tokens[value.id] === void 0) {
    issues.push(uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `Style value references unknown token.`, {
      documentId,
      nodeId,
      path: `token.${String(value.id)}`
    }));
  }
}
function validateCondition(ctx, conditionId, condition, localState) {
  const { document, catalogs, issues } = ctx;
  const documentId = String(document.id);
  if (!isPlainObject$2(condition)) {
    issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Condition '${conditionId}' must be an object.`, {
      documentId,
      conditionId
    }));
    return;
  }
  const kind = condition.kind;
  if (kind === "media") {
    const query = condition.query;
    if (typeof query !== "string" || !isBoundedMediaQuery(query)) {
      issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Media condition query is not a bounded width query.`, {
        documentId,
        conditionId
      }));
    }
    return;
  }
  if (kind === "localState") {
    const when = condition.when;
    if (when === void 0) {
      issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `localState condition needs a when expression.`, {
        documentId,
        conditionId
      }));
      return;
    }
    issues.push(...checkExpression(when, catalogs, { repeatItems: {}, inDefinition: false }, documentId, document.root));
    return;
  }
}
function isBoundedMediaQuery(query) {
  const clause = /^\(\s*(min|max)-width\s*:\s*\d+(?:\.\d+)?px\s*\)$/;
  const parts = query.split(" and ").map((part) => part.trim());
  if (parts.length === 0)
    return false;
  return parts.every((part) => clause.test(part));
}
function validateDefinition(ctx, definitionId, definition, styleSources, conditions) {
  const { document, issues } = ctx;
  const docRecord = document;
  const documentId = String(document.id);
  if (!nonEmptyString(definition.revision)) {
    issues.push(uiDiagnostic("UI_DOC_UNKNOWN_COMPONENT", `Definition '${definitionId}' needs a revision.`, {
      documentId,
      nodeId: document.root,
      definitionId
    }));
  }
  const nodes = registryOf(docRecord, "nodes");
  if (nodes[definition.root] === void 0) {
    issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Definition '${definitionId}' root does not exist.`, {
      documentId,
      nodeId: definition.root,
      missingChildId: definition.root
    }));
  }
  if (definition.baseStyle !== void 0 && styleSources[definition.baseStyle] === void 0) {
    issues.push(uiDiagnostic("UI_DOC_REFERENCE_DANGLING", `Definition base style does not exist.`, {
      documentId,
      nodeId: definition.root,
      reference: `styleSource:${definition.baseStyle}`
    }));
  }
  for (const [variant, ref] of Object.entries(definition.variants ?? {})) {
    if (conditions[ref.conditionId] === void 0) {
      issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Variant '${variant}' references unknown condition.`, {
        documentId,
        conditionId: ref.conditionId
      }));
    } else {
      issues.push(uiDiagnostic("UI_DOC_UNSUPPORTED_FEATURE", "Component variants are pending beyond the U1 slice.", { documentId, feature: `variant:${definitionId}:${variant}` }));
    }
  }
}
function compileUiDocument(document, semanticCatalog, extensions = [], catalogs = {}) {
  const validation = validateUiDocument(document, {
    elements: semanticCatalog,
    ...catalogs.actionIds !== void 0 ? { actionIds: catalogs.actionIds } : { actionIds: [] },
    ...catalogs.routeIds !== void 0 ? { routeIds: catalogs.routeIds } : { routeIds: [] },
    ...catalogs.viewFields !== void 0 ? { viewFields: catalogs.viewFields } : {},
    ...catalogs.opNames !== void 0 ? { opNames: catalogs.opNames } : {}
  });
  const hasFieldCatalog = catalogs.viewFields !== void 0;
  const isDeferredProductRef = (issue) => !hasFieldCatalog && issue.code === "UI_EXPR_UNKNOWN_REFERENCE" && typeof issue.path === "string" && (issue.path.startsWith("view.") || issue.path.startsWith("record."));
  const structural = validation.filter((issue) => issue.code !== "UI_DOC_UNKNOWN_COMPONENT" && issue.code !== "UI_DOC_UNKNOWN_PRODUCT_REFERENCE" && issue.code !== "UI_DOC_UNSUPPORTED_FEATURE" && !isDeferredProductRef(issue));
  const deferredRefs = validation.filter(isDeferredProductRef);
  if (hasErrors(structural)) {
    return { ok: false, issues: structural };
  }
  const { contentDigest } = canonicalUiDocument(document);
  const documentId = String(document.id);
  const issues = validation.filter((issue) => issue.severity === "warning");
  const rules = [];
  const sourceMap = [];
  const extensionRefs = [];
  const nodes = document.nodes ?? {};
  const definitions = document.componentDefinitions ?? {};
  const extensionById = new Map(extensions.map((extension) => [extension.id, extension]));
  const docHash = sha256$1(documentId).slice(0, 8);
  const classFor = (nodeId) => `uv-${docHash}-${nodeId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const tokenDeclarations = Object.entries(document.tokens ?? {}).map(([tokenId, token]) => ({
    property: `--ui-token-${tokenId}`,
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
  const compileStyleDeclarations = (declarations, ruleId, layer, selector, mediaConditionId) => {
    if (declarations === void 0 || declarations.length === 0)
      return void 0;
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
    rules.push({ ruleId, layer, selector, ...mediaConditionId !== void 0 ? { mediaConditionId } : {}, declarations: compiled });
    return ruleId;
  };
  const occurrenceKey2 = (nodeId, instancePath) => [documentId, nodeId, ...instancePath].join("|");
  let definitionExpansionGuard = 0;
  const compileNode = (nodeId, scope) => {
    const node = nodes[nodeId];
    if (node === void 0) {
      return {
        kind: "unsupported",
        nodeId,
        occurrenceKey: occurrenceKey2(nodeId, scope.instancePath),
        feature: "missing-node",
        children: []
      };
    }
    const key = occurrenceKey2(nodeId, scope.instancePath);
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
          const source = (document.styleSources ?? {})[sourceId];
          const ruleId = compileStyleDeclarations(source?.declarations, `${classFor(nodeId)}-s${styleRuleIds.length}`, "source", `.${classFor(nodeId)}`, source?.conditionId);
          if (ruleId !== void 0)
            styleRuleIds.push(ruleId);
        }
        const localRuleId = compileStyleDeclarations(node.localStyle, `${classFor(nodeId)}-l`, "local", `.${classFor(nodeId)}`);
        if (localRuleId !== void 0)
          styleRuleIds.push(localRuleId);
        const attributes2 = Object.entries(node.attributes ?? {}).map(([name, value]) => ({
          name,
          value: resolveAttributeValue(value)
        }));
        return {
          kind: "element",
          nodeId,
          occurrenceKey: key,
          tag: node.tag,
          attributes: attributes2,
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
          const extension = extensionById.get(node.definitionId);
          if (extension === void 0) {
            issues.push(uiDiagnostic("EXTENSION_UNAVAILABLE", `Neither definition nor extension resolves.`, {
              extensionId: node.definitionId
            }));
            return {
              kind: "unsupported",
              nodeId,
              occurrenceKey: key,
              feature: "unresolved-component",
              children: []
            };
          }
          extensionRefs.push({ extensionId: extension.id, revision: extension.revision });
          return {
            kind: "extension",
            nodeId,
            occurrenceKey: key,
            extensionId: extension.id,
            revision: extension.revision,
            propDecls: extension.props,
            propValues: node.props ?? {}
          };
        }
        definitionExpansionGuard += 1;
        if (definitionExpansionGuard > 256) {
          issues.push(uiDiagnostic("UI_DOC_CYCLE", "Definition expansion exceeded the safety bound.", {
            documentId,
            path: [node.definitionId]
          }));
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
          instancePath: [...scope.instancePath, `${nodeId}@${node.definitionId}`]
        });
        definitionExpansionGuard -= 1;
        const slots = {};
        for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
          slots[slotName] = fill.children.map((childId) => compileNode(childId, scope));
        }
        const styleRuleIds = [];
        if (definition.baseStyle !== void 0) {
          const base = (document.styleSources ?? {})[definition.baseStyle];
          const ruleId = compileStyleDeclarations(base?.declarations, `${classFor(nodeId)}-b`, "componentBase", `.${classFor(nodeId)}`);
          if (ruleId !== void 0)
            styleRuleIds.push(ruleId);
        }
        const localRuleId = compileStyleDeclarations(node.localStyle, `${classFor(nodeId)}-l`, "local", `.${classFor(nodeId)}`);
        if (localRuleId !== void 0)
          styleRuleIds.push(localRuleId);
        return {
          kind: "component",
          nodeId,
          occurrenceKey: key,
          definitionId: node.definitionId,
          definitionRevision: node.revision ?? definition.revision,
          propDecls: definition.props,
          propValues: node.props ?? {},
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
          template: compileNode(node.templateRoot, scope)
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
        issues.push(uiDiagnostic("UI_DOC_UNSUPPORTED_FEATURE", "Portal rendering is pending beyond the U1 slice.", {
          documentId,
          nodeId,
          feature: "portal"
        }));
        return {
          kind: "unsupported",
          nodeId,
          occurrenceKey: key,
          feature: "portal",
          children: node.children.map((childId) => compileNode(childId, scope))
        };
    }
  };
  const structure = [compileNode(String(document.root), { instancePath: [] })];
  const conditions = Object.values(document.conditions ?? {});
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
    } else if (instruction.kind === "conditional") {
      instruction.branches.forEach((branch) => branch.children.forEach(collectRepeats));
    } else if (instruction.kind === "slot") {
      instruction.fallback.forEach(collectRepeats);
    } else if (instruction.kind === "unsupported") {
      instruction.children.forEach(collectRepeats);
    }
  };
  structure.forEach(collectRepeats);
  const plan = {
    schema: UI_RENDER_PLAN_SCHEMA,
    documentId,
    revision: String(document.revision),
    sourceDigest: contentDigest,
    diagnostics: [...issues, ...deferredRefs],
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
function resolveAttributeValue(value) {
  if (typeof value === "string")
    return { type: "literal", value };
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
    return { ...base, action: "navigate", routeId: interaction.routeId, params: interaction.params ?? {} };
  }
  return { ...base, action: "setState", stateKey: interaction.key, params: { value: interaction.value } };
}
function toScopeValues(scope) {
  return {
    ...scope.view !== void 0 ? { view: scope.view } : {},
    ...scope.record !== void 0 ? { record: scope.record } : {},
    ...scope.props !== void 0 ? { props: scope.props } : {},
    state: scope.state,
    tokens: scope.tokens,
    ...scope.repeatItem !== void 0 ? { repeatItem: scope.repeatItem } : {}
  };
}
const DEFAULT_UI_OPS = {
  concat: (args) => args.map((arg) => String(arg ?? "")).join("")
};
function resolveValue(value, scope) {
  if (value.type === "literal") return value.value;
  if (value.type === "token") return scope.tokens[value.id];
  return evaluateExpression(value.expression, toScopeValues(scope), DEFAULT_UI_OPS);
}
function occurrenceKey(baseKey, repeatKeys) {
  if (repeatKeys.length === 0) return baseKey;
  return `${baseKey}|${repeatKeys.join("|")}`;
}
function conditionsOf(plan) {
  return Object.fromEntries(plan.dynamic.conditions.map((condition) => [condition.id, condition]));
}
function evaluateCondition(conditionId, conditions, scope) {
  const condition = conditions[conditionId];
  if (condition === void 0 || condition.kind !== "localState") return false;
  return Boolean(evaluateExpression(condition.when, toScopeValues(scope)));
}
const escapeCss = (selector) => selector.replace(/[^A-Za-z0-9_-]/g, "\\$&");
function styleRulesToCss(plan, rootClass) {
  const conditions = conditionsOf(plan);
  const layerOrder = plan.style.layers;
  const escapedRoot = escapeCss(rootClass);
  const sorted = [...plan.style.rules].sort(
    (a, b) => layerOrder.indexOf(a.layer) - layerOrder.indexOf(b.layer)
  );
  const mediaBuckets = /* @__PURE__ */ new Map();
  const plain = [];
  for (const rule of sorted) {
    const lines = [];
    for (const declaration of rule.declarations) {
      if (declaration.value.type === "literal") {
        lines.push(`  ${declaration.property}: ${String(declaration.value.value)};`);
      } else if (declaration.value.type === "token") {
        lines.push(`  ${declaration.property}: var(--ui-token-${declaration.value.id});`);
      }
    }
    const declarations = lines.join("\n");
    if (declarations === "") continue;
    const selector = rule.selector === ":root" ? `.${escapedRoot}` : `.${escapedRoot} ${escapeCss(rule.selector)}`;
    const css2 = `${selector} {
${declarations}
}`;
    if (rule.mediaConditionId !== void 0) {
      const condition = conditions[rule.mediaConditionId];
      const query = condition?.kind === "media" ? condition.query : void 0;
      if (query === void 0) {
        plain.push(css2);
        continue;
      }
      const bucket = mediaBuckets.get(query) ?? [];
      bucket.push(css2);
      mediaBuckets.set(query, bucket);
    } else {
      plain.push(css2);
    }
  }
  let css = plain.join("\n\n");
  for (const [query, rules] of mediaBuckets) {
    css += `

@media ${query} {
${rules.join("\n\n")}
}`;
  }
  return css;
}
function rootClassFor(plan) {
  const docHash = plan.documentId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `uv-root-${docHash}-${plan.revision.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}
function asRecord(value) {
  return typeof value === "object" && value !== null ? value : {};
}
function evaluatedComponentProps(instruction, scope) {
  const out = {};
  for (const declaration of instruction.propDecls) {
    const declared = instruction.propValues[declaration.name];
    out[declaration.name] = declared !== void 0 ? resolveValue({ type: "expression", expression: declared }, scope) : declaration.default;
  }
  return out;
}
function RenderNode($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      instruction,
      plan,
      scope,
      instancePath,
      repeatKeys,
      slotFills,
      dispatch,
      navigate,
      setState,
      selectOccurrence
    } = $$props;
    const conditions = derived(() => conditionsOf(plan));
    const occ = derived(() => occurrenceKey(instruction.occurrenceKey, repeatKeys));
    const evaluatedAttributes = derived(() => {
      if (instruction.kind !== "element") return {};
      const out = {};
      for (const attribute of instruction.attributes) {
        out[attribute.name] = resolveValue(attribute.value, scope);
      }
      return out;
    });
    const branchChildren = derived(() => {
      if (instruction.kind !== "conditional") return [];
      for (const branch of instruction.branches) {
        if (branch.when === void 0) return branch.children;
        if (evaluateCondition(branch.when, conditions(), scope)) return branch.children;
      }
      return [];
    });
    if (instruction.kind === "element") {
      $$renderer2.push("<!--[0-->");
      const children = instruction.children;
      element(
        $$renderer2,
        instruction.tag,
        () => {
          $$renderer2.push(`${attributes({
            ...evaluatedAttributes(),
            class: clsx(instruction.classes.join(" ")),
            "data-ui-node": instruction.nodeId,
            "data-ui-occ": occ()
          })}`);
        },
        () => {
          $$renderer2.push(`<!--[-->`);
          const each_array = ensure_array_like(children);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let child = each_array[$$index];
            RenderNode($$renderer2, {
              instruction: child,
              plan,
              scope,
              instancePath,
              repeatKeys,
              slotFills,
              dispatch,
              navigate,
              setState,
              selectOccurrence
            });
          }
          $$renderer2.push(`<!--]-->`);
        }
      );
    } else if (instruction.kind === "text") {
      $$renderer2.push("<!--[1-->");
      if (instruction.content.type === "literal") {
        $$renderer2.push(`<!--[0-->${escape_html(instruction.content.value)}`);
      } else {
        $$renderer2.push(`<!--[-1-->${escape_html(String(resolveValue(
          {
            type: "expression",
            expression: instruction.content.expression
          },
          scope
        ) ?? ""))}`);
      }
      $$renderer2.push(`<!--]-->`);
    } else if (instruction.kind === "component") {
      $$renderer2.push("<!--[2-->");
      const bodyScope = { ...scope, props: evaluatedComponentProps(instruction, scope) };
      const childPath = [
        ...instancePath,
        `${instruction.nodeId}@${instruction.definitionId}`
      ];
      RenderNode($$renderer2, {
        instruction: instruction.body,
        plan,
        scope: bodyScope,
        instancePath: childPath,
        repeatKeys,
        slotFills: instruction.slots,
        dispatch,
        navigate,
        setState,
        selectOccurrence
      });
    } else if (instruction.kind === "extension") {
      $$renderer2.push("<!--[3-->");
      const extensionProps = evaluatedComponentProps(instruction, scope);
      $$renderer2.push(`<div class="uv-extension-placeholder"${attr("data-ui-node", instruction.nodeId)}${attr("data-ui-occ", occ())}${attr("data-extension-id", instruction.extensionId)} role="img"${attr("aria-label", `Extension ${instruction.extensionId} (renderer pending in U1)`)}><span>Extension ${escape_html(instruction.extensionId)}</span> <pre>${escape_html(JSON.stringify(extensionProps))}</pre></div>`);
    } else if (instruction.kind === "repeat") {
      $$renderer2.push("<!--[4-->");
      const rows = resolveValue({ type: "expression", expression: instruction.collection }, scope);
      if (Array.isArray(rows)) {
        $$renderer2.push(`<!--[0--><!--[-->`);
        const each_array_1 = ensure_array_like(rows);
        for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
          let row = each_array_1[index];
          const rowKey = String(resolveValue({ type: "expression", expression: instruction.key }, {
            ...scope,
            repeatItem: { name: instruction.itemName, value: asRecord(row) }
          }) ?? index);
          const itemScope = {
            ...scope,
            repeatItem: { name: instruction.itemName, value: asRecord(row) }
          };
          RenderNode($$renderer2, {
            instruction: instruction.template,
            plan,
            scope: itemScope,
            instancePath,
            repeatKeys: [...repeatKeys, rowKey],
            slotFills,
            dispatch,
            navigate,
            setState,
            selectOccurrence
          });
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push(`<!--[-1--><span class="uv-error"${attr("data-ui-occ", occ())}>repeat collection is not an array</span>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else if (instruction.kind === "conditional") {
      $$renderer2.push(`<!--[5--><!--[-->`);
      const each_array_2 = ensure_array_like(branchChildren());
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let child = each_array_2[$$index_2];
        RenderNode($$renderer2, {
          instruction: child,
          plan,
          scope,
          instancePath,
          repeatKeys,
          slotFills,
          dispatch,
          navigate,
          setState,
          selectOccurrence
        });
      }
      $$renderer2.push(`<!--]-->`);
    } else if (instruction.kind === "slot") {
      $$renderer2.push("<!--[6-->");
      const fill = slotFills[instruction.name];
      if (fill !== void 0 && fill.length > 0) {
        $$renderer2.push(`<!--[0--><!--[-->`);
        const each_array_3 = ensure_array_like(fill);
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let child = each_array_3[$$index_3];
          RenderNode($$renderer2, {
            instruction: child,
            plan,
            scope,
            instancePath,
            repeatKeys,
            slotFills: {},
            dispatch,
            navigate,
            setState,
            selectOccurrence
          });
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push(`<!--[-1--><!--[-->`);
        const each_array_4 = ensure_array_like(instruction.fallback);
        for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
          let child = each_array_4[$$index_4];
          RenderNode($$renderer2, {
            instruction: child,
            plan,
            scope,
            instancePath,
            repeatKeys,
            slotFills,
            dispatch,
            navigate,
            setState,
            selectOccurrence
          });
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    } else if (instruction.kind === "unsupported") {
      $$renderer2.push(`<!--[7--><div class="uv-unsupported"${attr("data-ui-node", instruction.nodeId)}${attr("data-ui-occ", occ())} role="note">Unsupported feature: ${escape_html(instruction.feature)} <!--[-->`);
      const each_array_5 = ensure_array_like(instruction.children);
      for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
        let child = each_array_5[$$index_5];
        RenderNode($$renderer2, {
          instruction: child,
          plan,
          scope,
          instancePath,
          repeatKeys,
          slotFills,
          dispatch,
          navigate,
          setState,
          selectOccurrence
        });
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function DocumentHost($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      plan,
      view = {},
      record = {},
      localState = {},
      dispatch,
      navigate,
      selectOccurrence,
      resetSignal,
      as = "div",
      ariaLabel
    } = $$props;
    function initialValues() {
      const bag = {};
      for (const [key, decl] of Object.entries(localState)) {
        bag[key] = decl.initial;
      }
      return bag;
    }
    let stateBag = initialValues();
    function setState(key, value) {
      if (localState[key] === void 0) return;
      stateBag[key] = value;
    }
    const tokens = derived(() => Object.fromEntries((plan.style.rules.find((rule) => rule.layer === "token")?.declarations ?? []).map((declaration) => [
      declaration.property.replace("--ui-token-", ""),
      declaration.value.type === "literal" ? String(declaration.value.value) : ""
    ])));
    const scope = derived(() => ({ view, record, state: stateBag, tokens: tokens() }));
    const rootClass = derived(() => rootClassFor(plan));
    const css = derived(() => styleRulesToCss(plan, rootClass()));
    head("1ymag6l", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`${html(`<style data-ui-style="${rootClass()}">${css()}</style>`)}`);
    });
    element(
      $$renderer2,
      as,
      () => {
        $$renderer2.push(`${attr_class(clsx(rootClass()))}${attr("data-ui-document", plan.documentId)}${attr("data-ui-revision", plan.revision)}${attr("aria-label", ariaLabel)}`);
      },
      () => {
        $$renderer2.push(`<!---->`);
        {
          $$renderer2.push(`<!--[-->`);
          const each_array = ensure_array_like(plan.structure);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let instruction = each_array[$$index];
            RenderNode($$renderer2, {
              instruction,
              plan,
              scope: scope(),
              instancePath: [],
              repeatKeys: [],
              slotFills: {},
              dispatch,
              navigate,
              setState,
              selectOccurrence
            });
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
class ContractDefinitionError extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.name = "ContractDefinitionError";
    this.code = code;
    this.details = details;
  }
}
const OFFICIAL_CONTRACT_BRAND = Symbol.for("vict.official-contract");
function defineContract(definition) {
  validateContractIdentity(definition.id, definition.revision);
  if (typeof definition.parse !== "function") {
    throw new ContractDefinitionError("MISSING_CONTRACT_PARSE", `Contract '${definition.id}' must provide a parse function.`);
  }
  const contract = {
    id: definition.id,
    revision: definition.revision,
    expected: definition.expected ?? definition.id,
    // Inert presentation data (declared only): copied by reference into
    // the frozen contract. It is never executed and is never consulted by
    // `parse`; presentation consumers capture it fail-closed at tool
    // construction (bounded inert snapshot).
    ...definition.descriptiveJsonSchema !== void 0 ? { descriptiveJsonSchema: definition.descriptiveJsonSchema } : {},
    parse: (input) => definition.parse(input)
  };
  Object.defineProperty(contract, OFFICIAL_CONTRACT_BRAND, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false
  });
  return Object.freeze(contract);
}
function validateContractIdentity(id, revision) {
  if (typeof id !== "string" || id.length === 0) {
    throw new ContractDefinitionError("EMPTY_CONTRACT_ID", "Contract id must be a non-empty string.");
  }
  if (typeof revision !== "string" || revision.length === 0) {
    throw new ContractDefinitionError("INVALID_CONTRACT_REVISION", `Contract '${id}' must declare a non-empty revision string (e.g. revision: '1').`, { contractId: id });
  }
}
function safeIssueMessage(code, path, expected, received) {
  const at = "the root value";
  switch (code) {
    case "invalid_type":
      return `Expected ${expected} at ${at}, received ${received}.`;
    case "invalid_literal":
      return `Expected the literal value at ${at} to match the schema, received ${received}.`;
    case "invalid_enum_value":
      return `Value at ${at} is not one of the allowed options, received ${received}.`;
    case "too_small":
      return `Value at ${at} is too small, received ${received}.`;
    case "too_big":
      return `Value at ${at} is too big, received ${received}.`;
    case "unrecognized_keys":
      return `Unrecognized key(s) at ${at}.`;
    case "invalid_union":
      return `Value at ${at} did not match any allowed shape, received ${received}.`;
    case "invalid_string":
      return `String at ${at} does not satisfy the expected format, received ${received}.`;
    case "invalid_date":
      return `Value at ${at} is not a valid date, received ${received}.`;
    default:
      return `Validation failed (${code}) at ${at}, received ${received}.`;
  }
}
function describeReceived$1(value) {
  if (value === void 0) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
      return `string(${value.length})`;
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "function":
      return "function";
    default:
      return Array.isArray(value) ? `array(${value.length})` : "object";
  }
}
defineContract({
  id: "vict.neutral.json",
  revision: "1",
  expected: "any canonical JSON value (null, boolean, finite number, string, array, plain object)",
  parse: (input) => {
    if (isCanonicalJson(input)) {
      return { ok: true, value: input };
    }
    return {
      ok: false,
      issues: [
        {
          code: "invalid_type",
          path: "(root)",
          message: safeIssueMessage("invalid_type", "(root)", "a canonical JSON value", describeNonJson(input))
        }
      ]
    };
  }
});
function describeNonJson(input) {
  if (input === void 0)
    return "undefined";
  if (typeof input === "function")
    return "function";
  if (typeof input === "symbol")
    return "symbol";
  if (typeof input === "bigint")
    return "bigint";
  if (typeof input === "number")
    return "non-finite number";
  if (input instanceof Date)
    return "Date";
  return "non-JSON value";
}
function isCanonicalJson(value) {
  if (value === null)
    return true;
  const type = typeof value;
  if (type === "string" || type === "boolean")
    return true;
  if (type === "number")
    return Number.isFinite(value);
  if (type !== "object")
    return false;
  if (Array.isArray(value)) {
    return value.every(isCanonicalJson);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    return false;
  for (const key of Object.keys(value)) {
    if (!isCanonicalJson(value[key])) {
      return false;
    }
  }
  return true;
}
function readPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return void 0;
    }
    current = current[segment];
  }
  return current;
}
function parseErrorSignal(input, prefix = []) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_type",
          path: formatIssuePath(prefix),
          message: `Expected an error-signal object at ${formatIssuePath(prefix) === "(root)" ? "the root value" : `'${formatIssuePath(prefix)}'`}, received ${describeReceived$1(input)}.`,
          expected: "object",
          received: describeReceived$1(input)
        }
      ]
    };
  }
  const candidate = input;
  const issues = [];
  const expect = (path, condition, expectation) => {
    if (!condition) {
      const display = formatIssuePath([...prefix, ...path]);
      issues.push({
        code: "invalid_type",
        path: display,
        message: `Expected ${expectation} at ${display === "(root)" ? "the root value" : `'${display}'`}, received ${describeReceived$1(readPath(input, path))}.`,
        expected: expectation,
        received: describeReceived$1(readPath(input, path))
      });
    }
  };
  expect(["code"], typeof candidate["code"] === "string" && candidate["code"].length > 0, "a non-empty string");
  expect(["message"], typeof candidate["message"] === "string", "a string");
  const cause = candidate["cause"];
  if (cause !== void 0 && cause !== null) {
    const causeResult = parseErrorSignal(cause, [...prefix, "cause"]);
    if (!causeResult.ok) {
      issues.push(...causeResult.issues);
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, value: input };
}
function formatIssuePath(segments) {
  if (segments.length === 0) {
    return "(root)";
  }
  let out = "";
  for (const segment of segments) {
    out = out.length === 0 ? segment : `${out}.${segment}`;
  }
  return out;
}
defineContract({
  id: "vict.error-signal",
  revision: "1",
  expected: "A structured Vict error signal routed over an error edge",
  parse: parseErrorSignal
});
const AGENT_STREAM_EVENT_KINDS = [
  "response.started",
  "text.delta",
  "content.completed",
  "tool.requested",
  "tool.started",
  "tool.awaiting_approval",
  "tool.completed",
  "tool.failed",
  "memory.updated",
  "usage.updated",
  "response.completed",
  "response.failed",
  "response.cancelled"
];
const KIND_FIELDS = {
  "response.started": { fields: /* @__PURE__ */ new Set(["kind"]), transient: false },
  "text.delta": { fields: /* @__PURE__ */ new Set(["kind", "delta"]), transient: true },
  "content.completed": { fields: /* @__PURE__ */ new Set(["kind", "contentRef"]), transient: false },
  "tool.requested": { fields: /* @__PURE__ */ new Set(["kind", "toolCallId", "toolName"]), transient: false },
  "tool.started": { fields: /* @__PURE__ */ new Set(["kind", "toolCallId", "toolName"]), transient: false },
  "tool.awaiting_approval": {
    fields: /* @__PURE__ */ new Set(["kind", "toolCallId", "toolName"]),
    transient: false
  },
  "tool.completed": { fields: /* @__PURE__ */ new Set(["kind", "toolCallId", "toolName"]), transient: false },
  "tool.failed": {
    fields: /* @__PURE__ */ new Set(["kind", "toolCallId", "toolName", "code"]),
    transient: false
  },
  "memory.updated": { fields: /* @__PURE__ */ new Set(["kind", "threadId"]), transient: false },
  "usage.updated": { fields: /* @__PURE__ */ new Set(["kind", "usage"]), transient: false },
  "response.completed": { fields: /* @__PURE__ */ new Set(["kind"]), transient: false },
  "response.failed": { fields: /* @__PURE__ */ new Set(["kind", "code"]), transient: false },
  "response.cancelled": { fields: /* @__PURE__ */ new Set(["kind"]), transient: false }
};
AGENT_STREAM_EVENT_KINDS.filter((kind) => !KIND_FIELDS[kind].transient);
AGENT_STREAM_EVENT_KINDS.filter((kind) => KIND_FIELDS[kind].transient);
const APPLICATION_DEFINITION_SCHEMA = "vict.application@1";
const APPLICATION_DEFINITION_SCHEMA_V2 = "vict.application@2";
const APPLICATION_DEFINITION_SCHEMA_V3 = "vict.application@3";
const APPLICATION_IDENTITY_SCHEMA_V3 = "vict.application-identity@3";
const RESOURCE_DEFINITION_SCHEMA = "vict.resource@1";
const THEME_TOKEN_NAMES = [
  "color.bg",
  "color.surface",
  "color.text",
  "color.textMuted",
  "color.accent",
  "color.accentContrast",
  "color.border",
  "color.danger",
  "color.warning",
  "color.success",
  "color.info",
  "color.focusRing",
  "font.family",
  "font.sizeBase",
  "spacing.unit",
  "radius.base",
  "density",
  "elevation.low",
  "elevation.high"
];
function isPlainObject$1(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectComponentReferences(document) {
  const references = /* @__PURE__ */ new Set();
  const nodes = document.nodes ?? {};
  for (const node of Object.values(nodes)) {
    if (isPlainObject$1(node) && node.kind === "component" && typeof node.definitionId === "string") {
      references.add(node.definitionId);
    }
  }
  return [...references];
}
function resolveUiAttachments(input) {
  const issues = [];
  const warnings = [];
  const byKey = /* @__PURE__ */ new Map();
  const docFacts = [];
  const entries = input.uiDocuments ?? [];
  for (const [index, entry] of entries.entries()) {
    const candidate = entry?.document;
    if (!isPlainObject$1(candidate)) {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_SCHEMA", `Catalog entry ${index} is not a document object.`, {
        schema: "(not an object)",
        supported: ["vict.ui-document@1"]
      }));
      continue;
    }
    const documentId = typeof candidate.id === "string" ? candidate.id : "";
    const revision = typeof candidate.revision === "string" ? candidate.revision : "";
    if (candidate.schema !== "vict.ui-document@1" || documentId === "" || revision === "") {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_SCHEMA", `Catalog entry ${index} is not a vict.ui-document@1.`, {
        schema: String(candidate.schema),
        supported: ["vict.ui-document@1"]
      }));
      continue;
    }
    const { contentDigest } = canonicalUiDocument(candidate);
    const key = `${documentId}\0${revision}`;
    const existing = byKey.get(key);
    if (existing !== void 0) {
      if (existing.digest !== contentDigest) {
        issues.push(uiDiagnostic("UI_DOC_REVISION_COLLISION", `Competing catalog entries for (${documentId}, ${revision}) disagree on contentDigest.`, {
          documentId,
          revision,
          digestA: existing.digest,
          digestB: contentDigest,
          authority: "catalog"
        }));
      }
      continue;
    }
    const document = candidate;
    byKey.set(key, { document, digest: contentDigest });
    docFacts.push({
      key: `${documentId}@${revision}`,
      document,
      digest: contentDigest,
      references: collectComponentReferences(document),
      ownDefinitionIds: new Set(Object.keys(document.componentDefinitions ?? {}))
    });
  }
  for (const pin of input.uiDocumentPins ?? []) {
    if (!isPlainObject$1(pin) || typeof pin.documentId !== "string")
      continue;
    const key = `${pin.documentId}\0${String(pin.revision)}`;
    const entry = byKey.get(key);
    if (entry !== void 0 && entry.digest !== pin.contentDigest) {
      issues.push(uiDiagnostic("UI_DOC_REVISION_COLLISION", `Supplied pin for (${pin.documentId}, ${String(pin.revision)}) does not match the catalog entry digest.`, {
        documentId: pin.documentId,
        revision: String(pin.revision),
        digestA: entry.digest,
        digestB: pin.contentDigest,
        authority: "pin"
      }));
    }
  }
  const application = input.application;
  const screens = Array.isArray(application?.screens) ? application?.screens : [];
  for (const screen of screens) {
    if (!isPlainObject$1(screen))
      continue;
    const screenId = typeof screen.id === "string" ? screen.id : "";
    const uiDocument = screen.uiDocument;
    const found = [
      ...uiDocument !== void 0 ? ["uiDocument"] : [],
      ...screen.layout !== void 0 ? ["layout"] : [],
      ...screen.layoutMode !== void 0 ? ["layoutMode"] : [],
      ...screen.composition !== void 0 ? ["composition"] : []
    ];
    if (found.length !== 1) {
      issues.push(uiDiagnostic("UI_APP_PRESENTATION_MODE_INVALID", found.length === 0 ? "A @3 screen must declare exactly one presentation mode (none found)." : "A @3 screen must declare exactly one presentation mode (several found).", { screenId, found }));
      continue;
    }
    if (uiDocument === void 0)
      continue;
    const documentId = typeof uiDocument.documentId === "string" ? uiDocument.documentId : "";
    const revision = typeof uiDocument.revision === "string" ? uiDocument.revision : "";
    if (documentId === "" || revision === "") {
      issues.push(uiDiagnostic("UI_APP_PRESENTATION_MODE_INVALID", "A document-mode screen reference needs non-empty documentId and revision strings.", { screenId, found: ["uiDocument(malformed)"] }));
      continue;
    }
    const key = `${documentId}\0${revision}`;
    if (byKey.get(key) === void 0) {
      issues.push(uiDiagnostic("UI_DOC_REFERENCE_DANGLING", `Screen reference does not resolve in the catalog.`, {
        documentId,
        screenId,
        reference: `${documentId}@${revision}`
      }));
    }
  }
  const allDefinitionIds = /* @__PURE__ */ new Set();
  for (const fact of docFacts) {
    for (const definitionId of fact.ownDefinitionIds)
      allDefinitionIds.add(definitionId);
  }
  const extensionIds = [];
  for (const extension of input.uiExtensions ?? []) {
    if (isPlainObject$1(extension) && typeof extension.id === "string" && typeof extension.revision === "string" && typeof extension.rendererImplementationId === "string") {
      allDefinitionIds.add(extension.id);
      extensionIds.push(extension.id);
    } else {
      issues.push(uiDiagnostic("UI_DOC_UNKNOWN_PRODUCT_REFERENCE", "A uiExtensions entry is not a well-formed extension descriptor (id/revision/rendererImplementationId).", { documentId: "", nodeId: "", kind: "extension", ref: "(descriptor)" }));
    }
  }
  const catalogsFor = () => ({
    elements: defaultSemanticElementCatalog(),
    actionIds: input.actionIds,
    routeIds: input.routeIds,
    ...input.viewFields !== void 0 ? { viewFields: input.viewFields } : {}
  });
  const documentPlans = {};
  const extensionRegistry = (input.uiExtensions ?? []).filter((extension) => {
    if (!isPlainObject$1(extension))
      return false;
    const candidate = extension;
    return typeof candidate.id === "string" && typeof candidate.revision === "string" && typeof candidate.rendererImplementationId === "string";
  });
  for (const fact of docFacts) {
    const validation = validateUiDocument(fact.document, catalogsFor());
    const fatal = validation.filter((issue) => issue.severity === "error" && !(issue.code === "UI_DOC_UNKNOWN_COMPONENT" && typeof issue.definitionId === "string" && allDefinitionIds.has(issue.definitionId)));
    if (fatal.length > 0) {
      issues.push(...fatal);
      continue;
    }
    const compiled = compileUiDocument(fact.document, catalogsFor().elements, extensionRegistry, {
      actionIds: input.actionIds,
      routeIds: input.routeIds,
      ...input.viewFields !== void 0 ? { viewFields: input.viewFields } : {}
    });
    if (!compiled.ok) {
      issues.push(...compiled.issues);
      continue;
    }
    documentPlans[fact.key] = compiled.plan;
    warnings.push(...compiled.plan.diagnostics);
    for (const reference of compiled.plan.extensions)
      extensionIds.push(reference.extensionId);
  }
  const definitionOwner = /* @__PURE__ */ new Map();
  for (const fact of docFacts) {
    for (const definitionId of fact.ownDefinitionIds) {
      definitionOwner.set(`${fact.key}#${definitionId}`, fact.key);
    }
  }
  const defEdges = /* @__PURE__ */ new Map();
  const addEdge = (from, to) => {
    const set = defEdges.get(from) ?? /* @__PURE__ */ new Set();
    set.add(to);
    defEdges.set(from, set);
  };
  for (const fact of docFacts) {
    for (const definitionId of fact.references) {
      const target = `${fact.key}#${definitionId}`;
      if (definitionOwner.has(target)) {
        continue;
      }
      for (const [nodeId, owner] of definitionOwner) {
        if (nodeId.endsWith(`#${definitionId}`) && owner !== fact.key) {
          addEdge(`${fact.key}#${definitionId}`, nodeId);
        }
      }
    }
    const nodes = fact.document.nodes ?? {};
    for (const definitionId of fact.ownDefinitionIds) {
      const definition = (fact.document.componentDefinitions ?? {})[definitionId];
      const rootId = definition?.root;
      if (typeof rootId !== "string")
        continue;
      fact.document.nodes ?? {};
      const seen2 = /* @__PURE__ */ new Set();
      const stack2 = [rootId];
      while (stack2.length > 0) {
        const nodeId = stack2.pop();
        if (seen2.has(nodeId))
          continue;
        seen2.add(nodeId);
        const node = nodes[nodeId];
        if (!isPlainObject$1(node))
          continue;
        if (node.kind === "element" || node.kind === "portal") {
          for (const child of node.children ?? []) {
            stack2.push(child);
          }
        } else if (node.kind === "repeat") {
          stack2.push(node.templateRoot);
        } else if (node.kind === "slot") {
          for (const child of node.fallback ?? []) {
            stack2.push(child);
          }
        } else if (node.kind === "conditional") {
          for (const branch of node.branches ?? []) {
            for (const child of branch.children ?? [])
              stack2.push(child);
          }
        } else if (node.kind === "component" && node.definitionId !== void 0) {
          const target = `${fact.key}#${node.definitionId}`;
          if (definitionOwner.has(target)) {
            addEdge(`${fact.key}#${definitionId}`, target);
          } else {
            for (const [nodeIdB, owner] of definitionOwner) {
              if (nodeIdB.endsWith(`#${node.definitionId}`) && owner !== fact.key) {
                addEdge(`${fact.key}#${definitionId}`, nodeIdB);
              }
            }
          }
        }
      }
    }
  }
  const IN_STACK = /* @__PURE__ */ new Set();
  const DONE = /* @__PURE__ */ new Set();
  const stack = [];
  const dfs = (node) => {
    if (DONE.has(node))
      return;
    if (IN_STACK.has(node)) {
      const start = stack.indexOf(node);
      issues.push(uiDiagnostic("UI_DOC_CYCLE", "Cycle in the structural expansion graph.", {
        documentId: definitionOwner.get(node)?.split("@")[0] ?? "",
        path: stack.slice(start === -1 ? 0 : start).concat(node)
      }));
      return;
    }
    IN_STACK.add(node);
    stack.push(node);
    for (const next of defEdges.get(node) ?? [])
      dfs(next);
    stack.pop();
    IN_STACK.delete(node);
    DONE.add(node);
  };
  for (const node of definitionOwner.keys())
    dfs(node);
  let identityEntries = [];
  try {
    identityEntries = orderUiDocumentIdentityEntries(docFacts.map((fact) => ({
      documentId: fact.document.id,
      revision: String(fact.document.revision),
      contentDigest: fact.digest
    })));
  } catch (error) {
    issues.push(uiDiagnostic("UI_DOC_REVISION_COLLISION", "Identity entries disagree on contentDigest.", {
      documentId: "",
      revision: "",
      digestA: String(error.message),
      digestB: "",
      authority: "catalog"
    }));
  }
  return {
    issues,
    warnings,
    identityEntries,
    documentPlans,
    extensionIds: [...new Set(extensionIds)]
  };
}
const K = new Uint32Array([
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
const rotr = (x, n) => x >>> n | x << 32 - n;
function sha256(message) {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const paddedLength = (bytes.length + 9 + 63 & -64) >>> 0;
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
const APPLICATION_FIELDS = /* @__PURE__ */ new Set([
  "schema",
  "id",
  "revision",
  "name",
  "routes",
  "screens",
  "views",
  "forms",
  "actions",
  "resources",
  "components",
  "compatibility",
  "theme"
]);
const ROUTE_FIELDS = /* @__PURE__ */ new Set(["id", "path", "screenId", "nav"]);
const ROUTE_FIELDS_V2 = /* @__PURE__ */ new Set([...ROUTE_FIELDS, "redirect"]);
const NAV_FIELDS = /* @__PURE__ */ new Set(["label", "group", "order"]);
const SCREEN_FIELDS = /* @__PURE__ */ new Set(["id", "title", "layout", "states"]);
const SCREEN_FIELDS_V2 = /* @__PURE__ */ new Set([
  ...SCREEN_FIELDS,
  "breadcrumbs",
  "layoutMode",
  "composition"
]);
const SCREEN_FIELDS_V3 = /* @__PURE__ */ new Set([...SCREEN_FIELDS_V2, "uiDocument"]);
const REGION_FIELDS = /* @__PURE__ */ new Set(["name", "surfaces"]);
const STATES_FIELDS = /* @__PURE__ */ new Set([
  "loading",
  "empty",
  "validation",
  "denied",
  "failure"
]);
const STATES_FIELDS_V2 = /* @__PURE__ */ new Set([...STATES_FIELDS, "stale", "partial"]);
const VIEW_FIELDS = /* @__PURE__ */ new Set([
  "viewId",
  "resourceId",
  "resourceRevision",
  "fields",
  "filters",
  "sort",
  "emptyMessage"
]);
const FORM_FIELDS = /* @__PURE__ */ new Set([
  "formId",
  "resourceId",
  "resourceRevision",
  "inputContractId",
  "inputContractRevision",
  "fields",
  "submitActionId"
]);
const FORM_FIELD_FIELDS = /* @__PURE__ */ new Set(["name", "label", "required", "widget"]);
const ACTION_BASE_FIELDS = /* @__PURE__ */ new Set(["kind", "id", "revision"]);
const ACTION_FIELDS = /* @__PURE__ */ new Map([
  ["local", /* @__PURE__ */ new Set([...ACTION_BASE_FIELDS, "inputContractId"])],
  ["navigation", /* @__PURE__ */ new Set([...ACTION_BASE_FIELDS, "routeId"])],
  [
    "query",
    /* @__PURE__ */ new Set([
      ...ACTION_BASE_FIELDS,
      "resourceId",
      "resourceRevision",
      "inputContractId",
      "inputContractRevision",
      "outputContractId",
      "outputContractRevision"
    ])
  ],
  [
    "mutation",
    /* @__PURE__ */ new Set([
      ...ACTION_BASE_FIELDS,
      "resourceId",
      "resourceRevision",
      "op",
      "inputContractId",
      "inputContractRevision",
      "outputContractId",
      "outputContractRevision"
    ])
  ],
  [
    "capability",
    /* @__PURE__ */ new Set([
      ...ACTION_BASE_FIELDS,
      "capabilityId",
      "capabilityRevision",
      "inputContractId",
      "inputContractRevision",
      "outputContractId",
      "outputContractRevision"
    ])
  ]
]);
const RESOURCE_REF_FIELDS = /* @__PURE__ */ new Set(["resourceId", "revision"]);
const COMPONENT_FIELDS = /* @__PURE__ */ new Set(["componentId", "revision"]);
const SURFACE_COMMON_FIELDS = /* @__PURE__ */ new Set(["role", "id"]);
const SURFACE_FIELDS = /* @__PURE__ */ new Map([
  ["text", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "content"])],
  ["view", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "viewId"])],
  ["form", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "formId"])],
  ["action", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "actionId", "label"])],
  ["component", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "componentId", "revision", "props", "input"])],
  ["states", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "viewId"])]
]);
const CONDITION_FIELDS = /* @__PURE__ */ new Set(["viewNonEmpty", "viewEmpty", "paramEquals"]);
const CONDITION_PARAM_EQUALS_FIELDS = /* @__PURE__ */ new Set(["name", "value"]);
const THEME_FIELDS = /* @__PURE__ */ new Set(["reference", "tokens"]);
const THEME_TOKEN_ASSIGNMENT_FIELDS = /* @__PURE__ */ new Set(["name", "value"]);
const DISABLED_CONDITION_FIELDS = /* @__PURE__ */ new Set(["paramMissing"]);
const BREADCRUMB_FIELDS = /* @__PURE__ */ new Set(["label", "routeId"]);
const STAGE04_SURFACE_FIELD_SETS = SURFACE_FIELDS;
const SURFACE_FIELDS_V2 = /* @__PURE__ */ new Map([
  [
    "text",
    /* @__PURE__ */ new Set([
      ...STAGE04_SURFACE_FIELD_SETS.get("text"),
      "level",
      "visibleWhen"
    ])
  ],
  [
    "view",
    /* @__PURE__ */ new Set([
      ...STAGE04_SURFACE_FIELD_SETS.get("view"),
      "visibleWhen",
      "rowDetail"
    ])
  ],
  [
    "form",
    /* @__PURE__ */ new Set([...STAGE04_SURFACE_FIELD_SETS.get("form"), "visibleWhen"])
  ],
  [
    "action",
    /* @__PURE__ */ new Set([
      ...STAGE04_SURFACE_FIELD_SETS.get("action"),
      "disabledWhen",
      "visibleWhen"
    ])
  ],
  [
    "component",
    /* @__PURE__ */ new Set([
      ...STAGE04_SURFACE_FIELD_SETS.get("component"),
      "visibleWhen"
    ])
  ],
  [
    "states",
    /* @__PURE__ */ new Set([...STAGE04_SURFACE_FIELD_SETS.get("states"), "visibleWhen"])
  ],
  [
    "list",
    /* @__PURE__ */ new Set([
      ...SURFACE_COMMON_FIELDS,
      "viewId",
      "titleField",
      "secondaryField",
      "emptyMessage",
      "visibleWhen"
    ])
  ],
  [
    "table",
    /* @__PURE__ */ new Set([
      ...SURFACE_COMMON_FIELDS,
      "viewId",
      "columns",
      "queryActionId",
      "rowAction",
      "rowDetail",
      "searchFields",
      "filterFields",
      "pageSize",
      "emptyMessage",
      "visibleWhen"
    ])
  ],
  [
    "detail",
    /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "viewId", "fields", "emptyMessage", "visibleWhen"])
  ],
  [
    "chart",
    /* @__PURE__ */ new Set([
      ...SURFACE_COMMON_FIELDS,
      "viewId",
      "kind",
      "xField",
      "yField",
      "summary",
      "title",
      "visibleWhen"
    ])
  ],
  ["status", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "value", "field", "tones", "visibleWhen"])],
  ["count", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "viewId", "label", "visibleWhen"])],
  ["tabs", /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "tabs", "visibleWhen"])],
  [
    "dialog",
    /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "title", "triggerLabel", "content", "visibleWhen"])
  ],
  [
    "drawer",
    /* @__PURE__ */ new Set([...SURFACE_COMMON_FIELDS, "title", "triggerLabel", "content", "visibleWhen"])
  ],
  [
    "conversation",
    /* @__PURE__ */ new Set([
      ...SURFACE_COMMON_FIELDS,
      "viewId",
      "messageField",
      "authorField",
      "participantField",
      "sendActionId",
      "input",
      "inputLabel",
      "inputPlaceholder",
      "emptyMessage",
      "visibleWhen"
    ])
  ]
]);
const TAB_FIELDS = /* @__PURE__ */ new Set(["name", "label", "surfaces"]);
const TABLE_COLUMN_FIELDS = /* @__PURE__ */ new Set([
  "field",
  "label",
  "sortable",
  "componentId",
  "revision",
  "props"
]);
const TABLE_ROW_ACTION_FIELDS = /* @__PURE__ */ new Set(["actionId", "label", "input"]);
const TABLE_ROW_DETAIL_FIELDS = /* @__PURE__ */ new Set(["routeId", "label", "param"]);
const SORT_ENTRY_FIELDS = /* @__PURE__ */ new Set(["field", "direction"]);
const SORT_DIRECTIONS = /* @__PURE__ */ new Set(["asc", "desc"]);
const STATUS_TONES = /* @__PURE__ */ new Set([
  "success",
  "warning",
  "danger",
  "info",
  "neutral"
]);
const CHART_KINDS = /* @__PURE__ */ new Set(["bar", "line"]);
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;
const THEME_TOKEN_VALUE_SAFE = /^[^{};<>]*$/;
const RESOURCE_DEF_FIELDS = /* @__PURE__ */ new Set([
  "schema",
  "id",
  "revision",
  "identity",
  "fields",
  "inputContract",
  "outputContract",
  "relationships",
  "queries",
  "mutations",
  "presentation",
  "authorization"
]);
const RESOURCE_FIELD_FIELDS = /* @__PURE__ */ new Set(["name", "type", "required", "label"]);
const RESOURCE_FIELD_TYPES = /* @__PURE__ */ new Set([
  "string",
  "number",
  "boolean",
  "date",
  "json"
]);
const VALUE_LIKE_FIELD_NAMES = /* @__PURE__ */ new Set([
  "secrets",
  "secret",
  "secretValue",
  "configuration",
  "config",
  "credentials",
  "password",
  "token",
  "apiKey"
]);
({
  /** Closed values enforced by validation. */
  closedValues: {
    actionKinds: /* @__PURE__ */ new Set([...ACTION_FIELDS.keys()]),
    surfaceRolesV1: new Set(SURFACE_FIELDS.keys()),
    surfaceRolesV2: new Set(SURFACE_FIELDS_V2.keys())
  }
});
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isValidIdentifier(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function entryKeyLabel(value) {
  return typeof value === "string" ? value : describeReceivedType(value);
}
function describeReceived(value) {
  return value === void 0 ? "absent" : describeReceivedType(value);
}
function requireIdentifierMember(collector, container, key, path, subject) {
  const value = container[key];
  if (typeof value !== "string" || value.length === 0) {
    collector.add("APPLICATION_EMPTY_ID", `${subject} must be a non-empty string (received ${describeReceived(value)}).`, path);
    return false;
  }
  if (!isValidIdentifier(value)) {
    collector.add("APPLICATION_INVALID_IDENTIFIER", `${subject} must not be whitespace-only.`, path);
    return false;
  }
  return true;
}
function requireRevisionMember(collector, container, key, path, subject) {
  const value = container[key];
  if (typeof value !== "string" || value.length === 0) {
    collector.add("APPLICATION_EMPTY_REVISION", `${subject} must be a non-empty string (received ${describeReceived(value)}).`, path);
    return false;
  }
  if (!isValidIdentifier(value)) {
    collector.add("APPLICATION_INVALID_IDENTIFIER", `${subject} must not be whitespace-only.`, path);
    return false;
  }
  return true;
}
function requireNonEmptyStringMember(collector, container, key, path, subject, code = "APPLICATION_REQUIRED_MEMBER") {
  const value = container[key];
  if (typeof value !== "string" || value.length === 0) {
    collector.add(code, `${subject} must be a non-empty string (received ${describeReceived(value)}).`, path);
    return false;
  }
  return true;
}
function requireDisplayStringMember(collector, container, key, path, subject, code = "APPLICATION_REQUIRED_MEMBER") {
  const value = container[key];
  if (typeof value !== "string" || value.length === 0) {
    collector.add(code, `${subject} must be a non-empty string (received ${describeReceived(value)}).`, path);
    return false;
  }
  if (value.trim().length === 0) {
    collector.add(code, `${subject} must not be whitespace-only.`, path);
    return false;
  }
  return true;
}
class Collector {
  #issues = [];
  add(code, message, path) {
    this.#issues.push({ code, message, ...path !== void 0 ? { path } : {} });
  }
  unknownFields(value, allowed, path, code = "APPLICATION_UNKNOWN_FIELD") {
    const names = Object.keys(value).filter((key) => !allowed.has(key)).sort();
    for (const key of names) {
      if (VALUE_LIKE_FIELD_NAMES.has(key)) {
        this.add("APPLICATION_EMBEDDED_VALUE_FIELD", `Field '${key}' at '${path}' looks like an embedded configuration/secret value; application manifests declare references only, never resolved values.`, `${path}.${key}`);
        continue;
      }
      this.add(code, `Unknown field '${key}' at '${path}': the application schema is closed and does not accept it.`, `${path}.${key}`);
    }
  }
  sorted() {
    return [...this.#issues].sort((a, b) => {
      const pathA = a.path ?? "";
      const pathB = b.path ?? "";
      if (pathA === pathB) {
        return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
      }
      return pathA < pathB ? -1 : 1;
    });
  }
}
function collectCanonicalInputIssues(input) {
  const collector = new Collector();
  const seen2 = /* @__PURE__ */ new Set();
  const reject = (path, reason) => {
    collector.add("APPLICATION_NON_CANONICAL_VALUE", `The canonical input boundary rejects ${reason} at '${path}'; definition inputs must be plain, own-enumerable canonical data.`, path);
  };
  const walk = (value, path) => {
    if (value === null) {
      return;
    }
    const type = typeof value;
    if (type === "string" || type === "boolean") {
      return;
    }
    if (type === "number") {
      if (!Number.isFinite(value)) {
        reject(path, "a non-finite number (NaN and Infinity are outside the canonical domain)");
      } else if (Object.is(value, -0)) {
        reject(path, "negative zero (use 0)");
      }
      return;
    }
    if (type === "undefined") {
      return;
    }
    if (type === "bigint") {
      reject(path, "a BigInt value (declare a number or string instead)");
      return;
    }
    if (type === "function") {
      reject(path, "a function value");
      return;
    }
    if (type === "symbol") {
      reject(path, "a symbol value");
      return;
    }
    if (seen2.has(value)) {
      reject(path, "a cyclic structure");
      return;
    }
    let descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      reject(path, "a value whose property descriptors could not be inspected (hostile or revoked proxy)");
      return;
    }
    if (Array.isArray(value)) {
      const array = value;
      seen2.add(array);
      try {
        for (const key of Reflect.ownKeys(descriptors)) {
          const descriptor = descriptors[key];
          if (typeof key === "symbol") {
            reject(`${path}[(symbol)]`, "a symbol-keyed array property");
            continue;
          }
          if (key === "length") {
            continue;
          }
          if (descriptor.get !== void 0 || descriptor.set !== void 0) {
            reject(`${path}[${key}]`, "an accessor array element");
            continue;
          }
          if (!isCanonicalArrayIndex(key, array.length)) {
            reject(`${path}.${key}`, "an unsupported additional array property");
            continue;
          }
          if (!descriptor.enumerable) {
            reject(`${path}[${key}]`, "a non-enumerable array element");
          }
        }
        for (let index = 0; index < array.length; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(descriptors, String(index))) {
            reject(`${path}[${index}]`, "a sparse array slot (declare an explicit null instead)");
            continue;
          }
          let item;
          try {
            item = array[index];
          } catch {
            reject(`${path}[${index}]`, "an array element that could not be read (hostile getter or proxy)");
            continue;
          }
          if (item === void 0) {
            reject(`${path}[${index}]`, "an undefined array element (declare an explicit null)");
            continue;
          }
          walk(item, `${path}[${index}]`);
        }
      } finally {
        seen2.delete(array);
      }
      return;
    }
    let proto;
    try {
      proto = Object.getPrototypeOf(value);
    } catch {
      reject(path, "a value whose prototype could not be inspected (hostile or revoked proxy)");
      return;
    }
    if (proto !== Object.prototype && proto !== null) {
      reject(path, "an object with an unsupported prototype");
      return;
    }
    seen2.add(value);
    try {
      for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key];
        if (typeof key === "symbol") {
          reject(`${path}[(symbol)]`, "a symbol-keyed declaration field");
          continue;
        }
        if (descriptor.get !== void 0 || descriptor.set !== void 0) {
          reject(`${path}.${key}`, "an accessor declaration field");
          continue;
        }
        if (!descriptor.enumerable) {
          reject(`${path}.${key}`, "a non-enumerable declaration field");
          continue;
        }
        let item;
        try {
          item = value[key];
        } catch {
          reject(path, `the field '${key}' could not be read (hostile getter or proxy)`);
          continue;
        }
        walk(item, `${path}.${key}`);
      }
    } finally {
      seen2.delete(value);
    }
  };
  walk(input.application, "application");
  walkCollection(input.resources, "resources", walk);
  if (input.contracts !== void 0)
    walkCollection(input.contracts, "contracts", walk);
  if (input.capabilities !== void 0)
    walkCollection(input.capabilities, "capabilities", walk);
  if (input.components !== void 0)
    walkCollection(input.components, "components", walk);
  if (input.uiDocuments !== void 0)
    walkCollection(input.uiDocuments, "uiDocuments", walk);
  if (input.uiDocumentPins !== void 0)
    walkCollection(input.uiDocumentPins, "uiDocumentPins", walk);
  if (input.uiExtensions !== void 0)
    walkCollection(input.uiExtensions, "uiExtensions", walk);
  return collector.sorted();
}
function walkCollection(items, label, walk) {
  if (Array.isArray(items)) {
    walk(items, label);
  }
}
function isCanonicalArrayIndex(key, length) {
  if (!/^(0|[1-9][0-9]*)$/.test(key)) {
    return false;
  }
  return Number(key) < length;
}
class CanonicalIdentityError extends Error {
  code;
  path;
  constructor(code, message, path) {
    super(message);
    this.name = "CanonicalIdentityError";
    this.code = code;
    this.path = path;
  }
}
function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}
function canonicalize(value, path = "(root)") {
  if (value === null) {
    return null;
  }
  const type = typeof value;
  if (type === "string" || type === "boolean") {
    return value;
  }
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects the non-finite number ${String(value)} at '${path}'.`, path);
    }
    if (Object.is(value, -0)) {
      throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects negative zero at '${path}' (use 0).`, path);
    }
    return value;
  }
  if (type === "bigint") {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects a BigInt at '${path}' (declare a number or string instead).`, path);
  }
  if (type === "function") {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects a function at '${path}'.`, path);
  }
  if (type === "symbol") {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects a symbol at '${path}'.`, path);
  }
  if (type === "undefined") {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects undefined at '${path}' (omit the field or use null).`, path);
  }
  if (value instanceof Date) {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects a Date object at '${path}' (declare an ISO string instead).`, path);
  }
  const seen2 = canonicalSeenStack;
  if (seen2.has(value)) {
    throw new CanonicalIdentityError("CYCLIC_STRUCTURE", `The value at '${path}' is part of a cyclic structure; cyclic values cannot be canonicalized.`, path);
  }
  if (Array.isArray(value)) {
    try {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects a sparse array at '${path}'.`, path);
        }
      }
    } catch (error) {
      if (error instanceof CanonicalIdentityError) {
        throw error;
      }
      throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The array at '${path}' could not be inspected (hostile getter or proxy); identity inputs must be plain data.`, path);
    }
    seen2.add(value);
    try {
      return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
    } finally {
      seen2.delete(value);
    }
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The canonical serializable domain rejects an object with an unsupported prototype at '${path}'.`, path);
  }
  const source = value;
  let keys;
  try {
    keys = Object.keys(source);
  } catch {
    throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `The value at '${path}' could not be enumerated (hostile getter or proxy); identity inputs must be plain data.`, path);
  }
  seen2.add(value);
  try {
    const out = {};
    for (const key of keys.sort()) {
      let item;
      try {
        item = source[key];
      } catch {
        throw new CanonicalIdentityError("NON_CANONICAL_VALUE", `Reading field '${key}' at '${path}' threw (hostile getter); identity inputs must be plain data.`, `${path}.${key}`);
      }
      if (item !== void 0) {
        out[key] = canonicalize(item, `${path}.${key}`);
      }
    }
    return out;
  } finally {
    seen2.delete(value);
  }
}
const canonicalSeenStack = /* @__PURE__ */ new Set();
function sha256Hex(payload) {
  return sha256(payload);
}
const APPLICATION_IDENTITY_SCHEMA = "vict.application-identity@1";
const APPLICATION_IDENTITY_SCHEMA_V2 = "vict.application-identity@2";
function identitySchemaFor(applicationSchema) {
  if (applicationSchema === "vict.application@3")
    return APPLICATION_IDENTITY_SCHEMA_V3;
  return applicationSchema === "vict.application@2" ? APPLICATION_IDENTITY_SCHEMA_V2 : APPLICATION_IDENTITY_SCHEMA;
}
function canonicalApplicationManifest(application) {
  const byId = (items, key) => [...items].sort((a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  const screens = byId(application.screens, (screen) => screen.id).map((screen) => ({
    ...screen
    // Regions are ordered layout semantics; surfaces are ordered semantics.
    // Region NAMES form a set within a screen; keep declared order (they are
    // validated unique) — sorting them would discard layout intent.
  }));
  return {
    schema: application.schema,
    id: application.id,
    revision: application.revision,
    ...application.name !== void 0 ? { name: application.name } : {},
    ...application.composition !== void 0 ? { composition: application.composition } : {},
    routes: [...application.routes].map((route) => ({ ...route })),
    screens,
    ...application.views !== void 0 ? { views: byId(application.views, (view) => view.viewId).map((view) => ({ ...view })) } : {},
    ...application.forms !== void 0 ? { forms: byId(application.forms, (form) => form.formId).map((form) => ({ ...form })) } : {},
    actions: byId(application.actions, (action) => action.id).map((action) => ({ ...action })),
    resources: byId(application.resources.map((entry) => ({ ...entry })), (entry) => entry.resourceId),
    ...application.components !== void 0 ? {
      components: [...application.components].map((entry) => ({ ...entry })).sort((a, b) => (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0) || (a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0))
    } : {},
    ...application.compatibility !== void 0 ? { compatibility: { ...application.compatibility } } : {},
    ...application.theme !== void 0 ? { theme: application.theme } : {}
  };
}
function computeApplicationVersion(input) {
  const { application } = input;
  const providedResources = new Map(input.resources.map((entry) => [entry.id, entry]));
  const referencedResources = application.resources.map((reference) => {
    const resource = providedResources.get(reference.resourceId);
    return {
      resourceId: reference.resourceId,
      revision: resource?.revision ?? reference.revision
    };
  }).sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);
  const referencedViews = (application.views ?? []).map((view) => ({ viewId: view.viewId, revision: view.resourceRevision })).sort((a, b) => a.viewId < b.viewId ? -1 : a.viewId > b.viewId ? 1 : 0);
  const referencedActions = application.actions.map((action) => ({ actionId: action.id, revision: action.revision })).sort((a, b) => a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0);
  const referencedComponents = [...application.components ?? []].map((entry) => ({ ...entry })).sort((a, b) => (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0) || (a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0));
  return `v1_${sha256Hex(stableJson({
    schema: identitySchemaFor(application.schema),
    applicationSchema: application.schema,
    manifest: canonicalApplicationManifest(application),
    referencedResources,
    referencedViews,
    referencedActions,
    referencedComponents,
    // A-03: the hashed payload gains the UI document identities for @3
    // applications only — @1/@2 payloads stay byte-identical to their
    // historical form. Entries arrive deduplicated and code-point sorted.
    ...application.schema === APPLICATION_DEFINITION_SCHEMA_V3 && input.uiDocuments !== void 0 ? { uiDocuments: input.uiDocuments } : {}
  }))}`;
}
function buildViewFieldCatalog(declaredViews, providedResources) {
  const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  const viewFields = {};
  const resourceFieldsOf = (resourceId) => {
    const resource = providedResources.get(resourceId);
    const fields = resource !== void 0 && Array.isArray(resource.fields) ? resource.fields : [];
    return fields.filter(isRecord);
  };
  const registerFields = (fields, prefix, projected) => {
    for (const field of fields) {
      const name = field["name"];
      if (typeof name !== "string")
        continue;
      if (prefix === "" && projected !== null && !projected.includes(name))
        continue;
      const type = field["type"];
      viewFields[`${prefix}${name}`] = type === "number" ? "number" : type === "boolean" ? "boolean" : type === "json" ? "array" : "string";
    }
  };
  for (const view of declaredViews) {
    if (!isRecord(view))
      continue;
    const resourceId = view.resourceId;
    if (typeof resourceId !== "string")
      continue;
    const resource = providedResources.get(resourceId);
    if (resource === void 0)
      continue;
    const fields = resourceFieldsOf(resourceId);
    const projected = Array.isArray(view.fields) && view.fields.length > 0 ? view.fields : null;
    registerFields(fields, "", projected);
    for (const field of fields) {
      const name = field["name"];
      const type = field["type"];
      if (typeof name !== "string" || type !== "json")
        continue;
      const child = providedResources.get(name) ?? [...providedResources.values()].find((candidate) => `${candidate.id}s` === name);
      if (child !== void 0) {
        registerFields(resourceFieldsOf(child.id), `${name}.`, null);
      }
    }
  }
  return viewFields;
}
function compileApplication(input) {
  try {
    const structuralIssues = collectCanonicalInputIssues(input);
    if (structuralIssues.length > 0) {
      return { ok: false, issues: structuralIssues };
    }
    const collector = new Collector();
    const surfaceResolutions = [];
    const routeScreenResolutions = [];
    const application = input.application;
    const isV2 = application.schema === "vict.application@2";
    const isV3 = application.schema === APPLICATION_DEFINITION_SCHEMA_V3;
    const v2ish = isV2 || isV3;
    const routeFields = isV2 || isV3 ? ROUTE_FIELDS_V2 : ROUTE_FIELDS;
    const screenFields = isV3 ? SCREEN_FIELDS_V3 : isV2 ? SCREEN_FIELDS_V2 : SCREEN_FIELDS;
    const statesFields = isV2 || isV3 ? STATES_FIELDS_V2 : STATES_FIELDS;
    if (!isPlainObject(application)) {
      return {
        ok: false,
        issues: [
          { code: "APPLICATION_EMPTY_ID", message: "Application definition must be an object." }
        ]
      };
    }
    collector.unknownFields(application, isV2 || isV3 ? /* @__PURE__ */ new Set([...APPLICATION_FIELDS, "composition"]) : APPLICATION_FIELDS, "application");
    if (v2ish && application.composition !== void 0) {
      for (const issue of validateApplicationComposition(application.composition, "application.composition")) {
        collector.add("INVALID_UI_COMPOSITION", issue.message, issue.path);
      }
    }
    if (typeof application.schema !== "string") {
      collector.add("APPLICATION_UNKNOWN_SCHEMA", "Application definition must declare its schema marker.", "application.schema");
    } else if (application.schema !== APPLICATION_DEFINITION_SCHEMA && application.schema !== APPLICATION_DEFINITION_SCHEMA_V2 && application.schema !== APPLICATION_DEFINITION_SCHEMA_V3) {
      collector.add("APPLICATION_UNKNOWN_SCHEMA", `Application schema '${String(application.schema)}' is not supported by this compiler.`, "application.schema");
    }
    if (typeof application.id !== "string" || application.id.length === 0) {
      collector.add("APPLICATION_EMPTY_ID", "Application id must be a non-empty string.", "application.id");
    } else if (!isValidIdentifier(application.id)) {
      collector.add("APPLICATION_INVALID_IDENTIFIER", "Application id must not be whitespace-only.", "application.id");
    }
    if (typeof application.revision !== "string" || application.revision.length === 0) {
      collector.add("APPLICATION_EMPTY_REVISION", "Application revision must be a non-empty string.", "application.revision");
    } else if (!isValidIdentifier(application.revision)) {
      collector.add("APPLICATION_INVALID_IDENTIFIER", "Application revision must not be whitespace-only.", "application.revision");
    }
    for (const key of ["routes", "screens", "actions", "resources"]) {
      if (!Array.isArray(application[key])) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Application definition must declare a ${key} array (received ${describeReceived(application[key])}).`, `application.${key}`);
      }
    }
    for (const key of ["views", "forms", "components"]) {
      const value = application[key];
      if (value !== void 0 && !Array.isArray(value)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Application ${key} must be an array when declared (received ${describeReceived(value)}).`, `application.${key}`);
      }
    }
    if (application.compatibility !== void 0 && isPlainObject(application.compatibility) && !requireNonEmptyStringMember(collector, application.compatibility, "applicationSchema", "application.compatibility.applicationSchema", "Application compatibility applicationSchema")) {
    }
    const routes = Array.isArray(application.routes) ? application.routes : [];
    const screens = Array.isArray(application.screens) ? application.screens : [];
    const declaredActions = Array.isArray(application.actions) ? application.actions : [];
    const declaredResources = Array.isArray(application.resources) ? application.resources : [];
    const declaredViews = Array.isArray(application.views) ? application.views : [];
    const declaredForms = Array.isArray(application.forms) ? application.forms : [];
    const declaredComponents = Array.isArray(application.components) ? application.components : [];
    const providedResources = /* @__PURE__ */ new Map();
    for (const [resourceIndex, resource] of input.resources.entries()) {
      if (!isPlainObject(resource)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Resource definitions must be plain objects (received ${describeReceivedType(resource)}).`, `resources[${resourceIndex}]`);
        continue;
      }
      collector.unknownFields(resource, RESOURCE_DEF_FIELDS, `resources[${resource.id}]`);
      if (typeof resource.schema !== "string" || resource.schema !== RESOURCE_DEFINITION_SCHEMA) {
        collector.add("APPLICATION_UNKNOWN_SCHEMA", `Resource '${entryKeyLabel(resource.id)}' must declare the '${RESOURCE_DEFINITION_SCHEMA}' schema marker.`, `resources[${entryKeyLabel(resource.id)}].schema`);
      }
      const resourceIdValid = requireIdentifierMember(collector, resource, "id", `resources[${entryKeyLabel(resource.id)}].id`, "Resource id");
      const resourceRevisionValid = requireRevisionMember(collector, resource, "revision", `resources[${entryKeyLabel(resource.id)}].revision`, "Resource revision");
      if (!isPlainObject(resource.identity)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Resource identity must declare an identity key object (received ${describeReceived(resource.identity)}).`, `resources[${entryKeyLabel(resource.id)}].identity`);
      } else {
        requireNonEmptyStringMember(collector, resource.identity, "key", `resources[${entryKeyLabel(resource.id)}].identity.key`, "Resource identity key");
      }
      if (!Array.isArray(resource.fields)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Resource fields must be an array (received ${describeReceived(resource.fields)}).`, `resources[${entryKeyLabel(resource.id)}].fields`);
      } else {
        for (const [fieldIndex, field] of resource.fields.entries()) {
          if (!isPlainObject(field)) {
            collector.add("APPLICATION_REQUIRED_MEMBER", `Resource field declarations must be plain objects (received ${describeReceivedType(field)}).`, `resources[${entryKeyLabel(resource.id)}].fields[${fieldIndex}]`);
            continue;
          }
          collector.unknownFields(field, RESOURCE_FIELD_FIELDS, `resources[${resource.id}].fields[${field.name}]`);
          requireIdentifierMember(collector, field, "name", `resources[${entryKeyLabel(resource.id)}].fields[${fieldIndex}].name`, "Resource field name");
          if (typeof field.type !== "string" || !RESOURCE_FIELD_TYPES.has(field.type)) {
            collector.add("APPLICATION_REQUIRED_MEMBER", `Resource field type must be one of: string, number, boolean, date, json (received ${describeReceived(field.type)}).`, `resources[${entryKeyLabel(resource.id)}].fields[${fieldIndex}].type`);
          }
        }
      }
      if (resourceIdValid && resourceRevisionValid) {
        if (providedResources.has(resource.id)) {
          collector.add("DUPLICATE_RESOURCE_REFERENCE", `Resource '${resource.id}' is provided more than once.`, `resources[${resource.id}]`);
          continue;
        }
        providedResources.set(resource.id, resource);
      }
    }
    const providedContracts = /* @__PURE__ */ new Map();
    for (const [contractIndex, contract] of (input.contracts ?? []).entries()) {
      const idValid = requireIdentifierMember(collector, contract, "id", `contracts[${contractIndex}].id`, "Contract registry id");
      const revisionValid = requireRevisionMember(collector, contract, "revision", `contracts[${contractIndex}].revision`, "Contract registry revision");
      if (idValid && revisionValid) {
        providedContracts.set(contract.id, contract.revision);
      }
    }
    const providedCapabilities = /* @__PURE__ */ new Map();
    for (const [capabilityIndex, capability] of (input.capabilities ?? []).entries()) {
      const idValid = requireIdentifierMember(collector, capability, "id", `capabilities[${capabilityIndex}].id`, "Capability registry id");
      const revisionValid = requireRevisionMember(collector, capability, "revision", `capabilities[${capabilityIndex}].revision`, "Capability registry revision");
      if (idValid && revisionValid) {
        providedCapabilities.set(capability.id, capability.revision);
      }
    }
    const providedComponents = /* @__PURE__ */ new Map();
    for (const [componentIndex, component] of (input.components ?? []).entries()) {
      const idValid = requireIdentifierMember(collector, component, "componentId", `components[${componentIndex}].componentId`, "Component registry id");
      const revisionValid = requireRevisionMember(collector, component, "revision", `components[${componentIndex}].revision`, "Component registry revision");
      if (idValid && revisionValid) {
        providedComponents.set(component.componentId, component.revision);
      }
    }
    const routeIds = /* @__PURE__ */ new Set();
    const routePaths = /* @__PURE__ */ new Set();
    const redirectTargets = /* @__PURE__ */ new Map();
    for (const route of routes) {
      if (!isPlainObject(route)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Route declarations must be plain objects (received ${describeReceivedType(route)}).`, `application.routes[${entryKeyLabel(route?.id)}]`);
        continue;
      }
      const routePath = `application.routes[${entryKeyLabel(route.id)}]`;
      collector.unknownFields(route, routeFields, routePath);
      const idValid = requireIdentifierMember(collector, route, "id", `${routePath}.id`, "Route id");
      if (idValid) {
        if (routeIds.has(route.id)) {
          collector.add("DUPLICATE_ROUTE_ID", `Route id '${route.id}' is declared more than once.`, routePath);
        }
        routeIds.add(route.id);
      }
      const pathValid = typeof route.path === "string";
      if (!pathValid) {
        collector.add("ROUTE_PATH_INVALID", `Route ${idValid ? `'${route.id}' ` : ""}must declare a path string (received ${describeReceived(route.path)}).`, `${routePath}.path`);
      } else {
        if (routePaths.has(route.path)) {
          collector.add("DUPLICATE_ROUTE_PATH", `Route path '${route.path}' is declared more than once.`, routePath);
        }
        routePaths.add(route.path);
      }
      if (v2ish) {
        if (typeof route.path !== "string" || !route.path.startsWith("/")) {
          collector.add("ROUTE_PATH_INVALID", `Route '${route.id}' path must start with '/'.`, `application.routes[${route.id}].path`);
        } else {
          const segments = route.path.slice(1).split("/").filter((segment) => segment.length > 0);
          const paramNames = /* @__PURE__ */ new Set();
          for (const segment of segments) {
            const isParam = segment.startsWith(":");
            const name = isParam ? segment.slice(1) : segment;
            if (name.length === 0 || !PATH_SEGMENT.test(name)) {
              collector.add("ROUTE_PATH_INVALID", `Route '${route.id}' path segment '${segment}' is not a valid static segment or ':name' parameter.`, `application.routes[${route.id}].path`);
            } else if (isParam) {
              if (paramNames.has(name)) {
                collector.add("ROUTE_PATH_INVALID", `Route '${route.id}' path declares the parameter ':${name}' more than once.`, `application.routes[${route.id}].path`);
              }
              paramNames.add(name);
            }
          }
        }
        if (route.redirect !== void 0) {
          if (typeof route.redirect !== "string" || route.redirect.length === 0) {
            collector.add("ROUTE_REDIRECT_INVALID", `Route '${route.id}' redirect must be a non-empty route id when present.`, `application.routes[${route.id}].redirect`);
          } else {
            redirectTargets.set(route.id, route.redirect);
          }
          if (route.screenId !== void 0) {
            collector.add("ROUTE_REDIRECT_INVALID", `Route '${route.id}' declares both a redirect and a screen; a redirect route renders no screen.`, `application.routes[${route.id}].screenId`);
          }
        }
      }
      if (route.nav !== void 0) {
        if (!isPlainObject(route.nav)) {
          collector.add("APPLICATION_REQUIRED_MEMBER", `Route nav must be an object when declared (received ${describeReceivedType(route.nav)}).`, `${routePath}.nav`);
        } else {
          collector.unknownFields(route.nav, NAV_FIELDS, `${routePath}.nav`);
          requireDisplayStringMember(collector, route.nav, "label", `${routePath}.nav.label`, `Route ${idValid ? `'${route.id}' ` : ""}nav label`);
          if (route.nav.order !== void 0 && (typeof route.nav.order !== "number" || !Number.isFinite(route.nav.order) || Object.is(route.nav.order, -0))) {
            collector.add("APPLICATION_NON_CANONICAL_VALUE", `Route '${route.id}' nav.order must be a finite number (received ${describeReceivedType(route.nav.order)}).`, `${routePath}.nav.order`);
          }
        }
      }
      routeScreenResolutions.push((collector2, screens2) => {
        if (v2ish && route.redirect !== void 0) {
          return;
        }
        if (route.screenId === void 0) {
          collector2.add("ROUTE_SCREEN_REQUIRED", `Route '${route.id}' must declare a screen${v2ish ? " or a redirect" : ""}.`, `application.routes[${route.id}].screenId`);
          return;
        }
        if (!screens2.has(route.screenId)) {
          collector2.add("UNKNOWN_ROUTE_SCREEN", `Route '${route.id}' targets unknown screen '${route.screenId}'.`, `application.routes[${route.id}].screenId`);
        }
      });
    }
    if (v2ish && redirectTargets.size > 0) {
      for (const [sourceId, firstTarget] of redirectTargets) {
        let current = firstTarget;
        const visited = /* @__PURE__ */ new Set([sourceId]);
        let ok = true;
        for (let hop = 0; hop <= redirectTargets.size + 1; hop += 1) {
          if (!routeIds.has(current)) {
            collector.add("ROUTE_REDIRECT_INVALID", `Route '${sourceId}' redirects to unknown route '${current}'.`, `application.routes[${sourceId}].redirect`);
            ok = false;
            break;
          }
          if (visited.has(current)) {
            collector.add("ROUTE_REDIRECT_CYCLE", `Route '${sourceId}' takes part in a redirect cycle.`, `application.routes[${sourceId}].redirect`);
            ok = false;
            break;
          }
          visited.add(current);
          const next = redirectTargets.get(current);
          if (next === void 0) {
            break;
          }
          current = next;
        }
        if (ok && visited.size > redirectTargets.size + 1) {
          collector.add("ROUTE_REDIRECT_CYCLE", `Route '${sourceId}' takes part in a redirect cycle.`, `application.routes[${sourceId}].redirect`);
        }
      }
    }
    const screensById = /* @__PURE__ */ new Map();
    const surfaceIds = /* @__PURE__ */ new Set();
    for (const screen of screens) {
      if (!isPlainObject(screen)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Screen declarations must be plain objects (received ${describeReceivedType(screen)}).`, `application.screens[${entryKeyLabel(screen?.id)}]`);
        continue;
      }
      const screenPath = `application.screens[${entryKeyLabel(screen.id)}]`;
      collector.unknownFields(screen, screenFields, screenPath);
      const screenIdValid = requireIdentifierMember(collector, screen, "id", `${screenPath}.id`, "Screen id");
      if (screenIdValid) {
        if (screensById.has(screen.id)) {
          collector.add("DUPLICATE_SCREEN_ID", `Screen id '${screen.id}' is declared more than once.`, screenPath);
          continue;
        }
        screensById.set(screen.id, screen);
      }
      requireDisplayStringMember(collector, screen, "title", `${screenPath}.title`, "Screen title");
      if (v2ish && screen.composition !== void 0) {
        for (const issue of validatePageComposition(screen.composition, screenPath + ".composition")) {
          collector.add("INVALID_UI_COMPOSITION", issue.message, issue.path);
        }
      }
      if (screen.layoutMode !== void 0) {
        for (const issue of validateLayoutMode(screen.layoutMode, screenPath + ".layoutMode")) {
          collector.add("INVALID_SURFACE_DECLARATION", issue.message, issue.path);
        }
      }
      if (v2ish && screen.breadcrumbs !== void 0) {
        for (const [index, crumb] of screen.breadcrumbs.entries()) {
          collector.unknownFields(crumb, BREADCRUMB_FIELDS, `application.screens[${screen.id}].breadcrumbs[${index}]`);
          requireDisplayStringMember(collector, crumb, "label", `application.screens[${screen.id}].breadcrumbs[${index}].label`, `Breadcrumb ${index} of screen '${screen.id}' label`, "INVALID_SURFACE_DECLARATION");
          if (crumb.routeId !== void 0 && !routeIds.has(crumb.routeId)) {
            collector.add("UNKNOWN_BREADCRUMB_ROUTE", `Breadcrumb ${index} of screen '${screen.id}' references unknown route '${crumb.routeId}'.`, `application.screens[${screen.id}].breadcrumbs[${index}].routeId`);
          }
        }
      }
      const screenIsDocumentMode = isV3 && screen.uiDocument !== void 0;
      if (!Array.isArray(screen.layout) && !screenIsDocumentMode) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Screen layout must be an array (received ${describeReceived(screen.layout)}).`, `${screenPath}.layout`);
      } else if (Array.isArray(screen.layout)) {
        const regionNames = /* @__PURE__ */ new Set();
        for (const region of screen.layout) {
          if (!isPlainObject(region)) {
            collector.add("APPLICATION_REQUIRED_MEMBER", `Layout region declarations must be plain objects (received ${describeReceivedType(region)}).`, `${screenPath}.layout[${entryKeyLabel(region?.name)}]`);
            continue;
          }
          const regionPath = `${screenPath}.layout[${entryKeyLabel(region.name)}]`;
          collector.unknownFields(region, v2ish ? /* @__PURE__ */ new Set([...REGION_FIELDS, "size", "appearance", "flow"]) : REGION_FIELDS, regionPath);
          const presentation = Object.fromEntries(["size", "appearance", "flow"].filter((key) => region[key] !== void 0).map((key) => [key, region[key]]));
          for (const issue of validateRegionPresentation(presentation, regionPath)) {
            collector.add("INVALID_SURFACE_DECLARATION", issue.message, issue.path);
          }
          const regionName = region.name;
          const regionNameValid = requireDisplayStringMember(collector, region, "name", `${regionPath}.name`, "Region name");
          if (regionNameValid && typeof regionName === "string") {
            if (regionNames.has(regionName)) {
              collector.add("DUPLICATE_REGION_NAME", `Region '${regionName}' is declared more than once on screen '${screen.id}'.`, regionPath);
            }
            regionNames.add(regionName);
          }
          if (!Array.isArray(region.surfaces)) {
            collector.add("APPLICATION_REQUIRED_MEMBER", `Region surfaces must be an array (received ${describeReceived(region.surfaces)}).`, `${regionPath}.surfaces`);
            continue;
          }
          for (const surface of region.surfaces) {
            collectSurface(collector, surface, screenPath, surfaceIds, surfaceResolutions, v2ish);
          }
        }
      }
      const states = screen.states;
      if (states !== void 0) {
        if (!isPlainObject(states)) {
          collector.add("APPLICATION_REQUIRED_MEMBER", `Screen states must be an object when declared (received ${describeReceivedType(states)}).`, `${screenPath}.states`);
        } else {
          collector.unknownFields(states, statesFields, `${screenPath}.states`);
          for (const [name, surface] of Object.entries(states)) {
            if (surface !== void 0) {
              collectSurface(collector, surface, `${screenPath}.states.${name}`, surfaceIds, surfaceResolutions, v2ish);
            }
          }
        }
      }
    }
    for (const routeCheck of routeScreenResolutions) {
      routeCheck(collector, screensById);
    }
    const viewIds = /* @__PURE__ */ new Set();
    const viewsById = /* @__PURE__ */ new Map();
    for (const view of declaredViews) {
      collector.unknownFields(view, VIEW_FIELDS, `application.views[${entryKeyLabel(view.viewId)}]`);
      const viewIdValid = requireIdentifierMember(collector, view, "viewId", `application.views[${entryKeyLabel(view.viewId)}].viewId`, "View id");
      if (viewIdValid) {
        if (viewIds.has(view.viewId)) {
          collector.add("DUPLICATE_VIEW_ID", `View '${view.viewId}' is declared more than once.`, `application.views[${view.viewId}]`);
          continue;
        }
        viewIds.add(view.viewId);
        viewsById.set(view.viewId, view);
      }
      const resourceIdValid = requireIdentifierMember(collector, view, "resourceId", `application.views[${entryKeyLabel(view.viewId)}].resourceId`, "View resourceId");
      const resourceRevisionValid = requireRevisionMember(collector, view, "resourceRevision", `application.views[${entryKeyLabel(view.viewId)}].resourceRevision`, "View resourceRevision");
      if (resourceIdValid && resourceRevisionValid) {
        collectResourceReference(collector, application, view.resourceId, view.resourceRevision, providedResources, `application.views[${view.viewId}]`);
      }
      for (const field of view.fields ?? []) {
        checkCatalogueField(collector, providedResources.get(view.resourceId), field, `application.views[${view.viewId}].fields`);
      }
      if (view.filters !== void 0) {
        const filtersPath = `application.views[${entryKeyLabel(view.viewId)}].filters`;
        if (!isPlainObject(view.filters)) {
          collector.add("INVALID_VIEW_DECLARATION", `View '${view.viewId}' filters must be a plain object when declared (received ${describeReceivedType(view.filters)}).`, filtersPath);
        } else {
          collector.unknownFields(view.filters, new Set(Object.keys(view.filters)), filtersPath);
          for (const [key, value] of Object.entries(view.filters)) {
            checkCatalogueField(collector, providedResources.get(view.resourceId), key, filtersPath);
            const validValue = typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
            if (!validValue) {
              collector.add("INVALID_VIEW_DECLARATION", `View '${view.viewId}' filter '${key}' must be a string, number, or boolean.`, `${filtersPath}.${key}`);
            }
          }
        }
      }
      if (view.sort !== void 0) {
        const sortPath = `application.views[${entryKeyLabel(view.viewId)}].sort`;
        if (!Array.isArray(view.sort)) {
          collector.add("INVALID_VIEW_DECLARATION", `View '${view.viewId}' sort must be an array when declared (received ${describeReceivedType(view.sort)}).`, sortPath);
        } else {
          for (const [sortIndex, entry] of view.sort.entries()) {
            const entryPath = `${sortPath}[${sortIndex}]`;
            if (!isPlainObject(entry)) {
              collector.add("INVALID_VIEW_DECLARATION", `View '${view.viewId}' sort entries must be plain objects (received ${describeReceivedType(entry)}).`, entryPath);
              continue;
            }
            collector.unknownFields(entry, SORT_ENTRY_FIELDS, entryPath);
            checkCatalogueField(collector, providedResources.get(view.resourceId), entry.field, `${entryPath}.field`);
            if (!SORT_DIRECTIONS.has(entry.direction)) {
              collector.add("INVALID_VIEW_DECLARATION", `View '${view.viewId}' sort direction must be 'asc' or 'desc'.`, `${entryPath}.direction`);
            }
          }
        }
      }
    }
    const formIds = /* @__PURE__ */ new Set();
    const formsById = /* @__PURE__ */ new Map();
    const formActionResolutions = [];
    for (const form of declaredForms) {
      collector.unknownFields(form, FORM_FIELDS, `application.forms[${entryKeyLabel(form.formId)}]`);
      const formIdValid = requireIdentifierMember(collector, form, "formId", `application.forms[${entryKeyLabel(form.formId)}].formId`, "Form id");
      if (formIdValid) {
        if (formIds.has(form.formId)) {
          collector.add("DUPLICATE_FORM_ID", `Form '${form.formId}' is declared more than once.`, `application.forms[${form.formId}]`);
          continue;
        }
        formIds.add(form.formId);
        formsById.set(form.formId, form);
      }
      const formPath = `application.forms[${entryKeyLabel(form.formId)}]`;
      const resourceIdValid = requireIdentifierMember(collector, form, "resourceId", `${formPath}.resourceId`, "Form resourceId");
      const resourceRevisionValid = requireRevisionMember(collector, form, "resourceRevision", `${formPath}.resourceRevision`, "Form resourceRevision");
      if (resourceIdValid && resourceRevisionValid) {
        collectResourceReference(collector, application, form.resourceId, form.resourceRevision, providedResources, `application.forms[${form.formId}]`);
      }
      const inputContractValid = requireIdentifierMember(collector, form, "inputContractId", `${formPath}.inputContractId`, "Form inputContractId");
      if (inputContractValid) {
        checkContractReference(collector, providedContracts, form.inputContractId, form.inputContractRevision, `application.forms[${form.formId}].inputContractId`);
      }
      if (!Array.isArray(form.fields)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Form fields must be an array (received ${describeReceived(form.fields)}).`, `${formPath}.fields`);
      } else {
        for (const field of form.fields) {
          if (!isPlainObject(field)) {
            collector.add("APPLICATION_REQUIRED_MEMBER", `Form field declarations must be plain objects (received ${describeReceivedType(field)}).`, `${formPath}.fields[?]`);
            continue;
          }
          const fieldPath = `${formPath}.fields[${entryKeyLabel(field.name)}]`;
          collector.unknownFields(field, v2ish ? /* @__PURE__ */ new Set([...FORM_FIELD_FIELDS, "options"]) : FORM_FIELD_FIELDS, fieldPath);
          if (field.widget === "select") {
            if (!v2ish || !Array.isArray(field.options) || field.options.length === 0) {
              collector.add("INVALID_SURFACE_DECLARATION", "Select fields require @2 and nonempty options.", fieldPath + ".options");
            } else {
              const values = /* @__PURE__ */ new Set();
              for (const option of field.options) {
                if (!isPlainObject(option)) {
                  collector.add("INVALID_SURFACE_DECLARATION", "Select options must be objects.", fieldPath + ".options");
                  continue;
                }
                collector.unknownFields(option, /* @__PURE__ */ new Set(["value", "label"]), fieldPath + ".options");
                requireDisplayStringMember(collector, option, "value", fieldPath + ".options.value", "Option value");
                requireDisplayStringMember(collector, option, "label", fieldPath + ".options.label", "Option label");
                if (typeof option.value === "string") {
                  if (values.has(option.value))
                    collector.add("INVALID_SURFACE_DECLARATION", "Select option values must be unique.", fieldPath + ".options");
                  values.add(option.value);
                }
              }
            }
          } else if (field.options !== void 0) {
            collector.add("INVALID_SURFACE_DECLARATION", "Options are only valid for select fields.", fieldPath + ".options");
          }
          requireIdentifierMember(collector, field, "name", `${fieldPath}.name`, "Form field name");
          requireDisplayStringMember(collector, field, "label", `${fieldPath}.label`, "Form field label");
          checkCatalogueField(collector, providedResources.get(form.resourceId), field.name, `${formPath}.fields`);
        }
      }
      const submitActionValid = requireIdentifierMember(collector, form, "submitActionId", `${formPath}.submitActionId`, "Form submitActionId");
      if (submitActionValid) {
        formActionResolutions.push((issueCollector, actionsMap) => {
          if (!actionsMap.has(form.submitActionId)) {
            issueCollector.add("UNKNOWN_FORM_ACTION", `Form '${form.formId}' submitActionId references unknown action '${form.submitActionId}'.`, `${formPath}.submitActionId`);
          }
        });
      }
    }
    const actionIds = /* @__PURE__ */ new Set();
    const actionsById = /* @__PURE__ */ new Map();
    for (const action of declaredActions) {
      if (!isPlainObject(action)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Action declarations must be plain objects (received ${describeReceivedType(action)}).`, `application.actions[${entryKeyLabel(action?.id)}]`);
        continue;
      }
      const actionPath = `application.actions[${entryKeyLabel(action.id)}]`;
      collector.unknownFields(action, v2ish ? /* @__PURE__ */ new Set([...ACTION_FIELDS.get(action.kind) ?? ACTION_BASE_FIELDS, "feedback"]) : ACTION_FIELDS.get(action.kind) ?? ACTION_BASE_FIELDS, actionPath);
      if (v2ish && action.feedback !== void 0) {
        for (const issue of validateActionFeedback(action.feedback, actionPath + ".feedback")) {
          collector.add("INVALID_ACTION_FEEDBACK", issue.message, issue.path);
        }
      }
      const actionIdValid = requireIdentifierMember(collector, action, "id", `${actionPath}.id`, "Action id");
      requireRevisionMember(collector, action, "revision", `${actionPath}.revision`, "Action revision");
      if (actionIdValid) {
        if (actionIds.has(action.id)) {
          collector.add("DUPLICATE_ACTION_ID", `Action '${action.id}' is declared more than once.`, actionPath);
          continue;
        }
        actionIds.add(action.id);
        actionsById.set(action.id, action);
      }
      if (!ACTION_FIELDS.has(action.kind)) {
        collector.add("UNKNOWN_SURFACE_ROLE", `Action '${action.id}' declares unknown kind '${String(action.kind)}'.`, `${actionPath}.kind`);
        continue;
      }
      if (action.kind === "navigation") {
        const routeIdValid = requireIdentifierMember(collector, action, "routeId", `${actionPath}.routeId`, "Navigation action routeId");
        if (routeIdValid && !routeIds.has(action.routeId)) {
          collector.add("UNKNOWN_ROUTE_REFERENCE", `Navigation action '${action.id}' targets unknown route '${action.routeId}'.`, `${actionPath}.routeId`);
        }
      } else if (action.kind === "query" || action.kind === "mutation") {
        const resourceIdValid = requireIdentifierMember(collector, action, "resourceId", `${actionPath}.resourceId`, "Action resourceId");
        const resourceRevisionValid = requireRevisionMember(collector, action, "resourceRevision", `${actionPath}.resourceRevision`, "Action resourceRevision");
        if (resourceIdValid && resourceRevisionValid) {
          collectResourceReference(collector, application, action.resourceId, action.resourceRevision, providedResources, `application.actions[${action.id}]`);
        }
        if (action.kind === "mutation") {
          const opValid = requireNonEmptyStringMember(collector, action, "op", `${actionPath}.op`, "Mutation action op");
          if (opValid && !isValidIdentifier(action.op)) {
            collector.add("APPLICATION_INVALID_IDENTIFIER", "Mutation action op must not be whitespace-only.", `${actionPath}.op`);
          }
          const resource = providedResources.get(action.resourceId);
          const declared = opValid && resource?.mutations?.some((mutation) => mutation.op === action.op);
          if (opValid && resource !== void 0 && action.resourceRevision === resource.revision && !declared) {
            collector.add("MUTATION_NOT_DECLARED", `Mutation action '${action.id}' uses op '${action.op}' which resource '${action.resourceId}' does not declare.`, `${actionPath}.op`);
          }
          const inputContractValid = requireIdentifierMember(collector, action, "inputContractId", `${actionPath}.inputContractId`, "Mutation action inputContractId");
          if (inputContractValid) {
            checkContractReference(collector, providedContracts, action.inputContractId, action.inputContractRevision, `application.actions[${action.id}].inputContractId`);
          }
        }
        if (action.kind === "query" && action.inputContractId !== void 0) {
          checkContractReference(collector, providedContracts, action.inputContractId, action.inputContractRevision, `application.actions[${action.id}].inputContractId`);
        }
        if (action.outputContractId !== void 0) {
          checkContractReference(collector, providedContracts, action.outputContractId, action.outputContractRevision, `application.actions[${action.id}].outputContractId`);
        }
      } else if (action.kind === "capability") {
        const capabilityIdValid = requireIdentifierMember(collector, action, "capabilityId", `${actionPath}.capabilityId`, "Capability action capabilityId");
        const capabilityRevisionValid = requireRevisionMember(collector, action, "capabilityRevision", `${actionPath}.capabilityRevision`, "Capability action capabilityRevision");
        const expectedRevision = capabilityIdValid ? providedCapabilities.get(action.capabilityId) : void 0;
        if (capabilityIdValid && expectedRevision === void 0) {
          collector.add("UNKNOWN_CAPABILITY_REFERENCE", `Capability action '${action.id}' references unknown capability '${action.capabilityId}'.`, `${actionPath}.capabilityId`);
        } else if (capabilityRevisionValid && expectedRevision !== action.capabilityRevision) {
          collector.add("CAPABILITY_REVISION_MISMATCH", `Capability action '${action.id}' references capability '${action.capabilityId}' revision '${action.capabilityRevision}' but the runtime declares '${expectedRevision}'.`, `${actionPath}.capabilityRevision`);
        }
        const inputContractValid = requireIdentifierMember(collector, action, "inputContractId", `${actionPath}.inputContractId`, "Capability action inputContractId");
        if (inputContractValid) {
          checkContractReference(collector, providedContracts, action.inputContractId, action.inputContractRevision, `application.actions[${action.id}].inputContractId`);
        }
        if (action.outputContractId !== void 0) {
          checkContractReference(collector, providedContracts, action.outputContractId, action.outputContractRevision, `application.actions[${action.id}].outputContractId`);
        }
      } else if (action.kind === "local") {
        if (action.inputContractId !== void 0) {
          checkContractReference(collector, providedContracts, action.inputContractId, void 0, `application.actions[${action.id}].inputContractId`);
        }
      }
    }
    for (const formActionResolution of formActionResolutions) {
      formActionResolution(collector, actionsById);
    }
    const resourceReferences = /* @__PURE__ */ new Set();
    for (const reference of declaredResources) {
      if (!isPlainObject(reference)) {
        collector.add("APPLICATION_REQUIRED_MEMBER", `Resource references must be plain objects (received ${describeReceivedType(reference)}).`, `application.resources[${entryKeyLabel(reference?.resourceId)}]`);
        continue;
      }
      const referencePath = `application.resources[${entryKeyLabel(reference.resourceId)}]`;
      collector.unknownFields(reference, RESOURCE_REF_FIELDS, referencePath);
      const referenceIdValid = requireIdentifierMember(collector, reference, "resourceId", `${referencePath}.resourceId`, "Resource reference id");
      const referenceRevisionValid = requireRevisionMember(collector, reference, "revision", `${referencePath}.revision`, "Resource reference revision");
      if (!referenceIdValid) {
        continue;
      }
      if (resourceReferences.has(reference.resourceId)) {
        collector.add("DUPLICATE_RESOURCE_REFERENCE", `Resource '${reference.resourceId}' is referenced more than once.`, referencePath);
        continue;
      }
      resourceReferences.add(reference.resourceId);
      if (!referenceRevisionValid) {
        continue;
      }
      const provided = providedResources.get(reference.resourceId);
      if (provided === void 0) {
        collector.add("UNKNOWN_RESOURCE", `Application references resource '${reference.resourceId}' which was not provided.`, referencePath);
      } else if (provided.revision !== reference.revision) {
        collector.add("RESOURCE_REVISION_MISMATCH", `Application references resource '${reference.resourceId}' revision '${reference.revision}' but the provided definition is '${provided.revision}'.`, referencePath);
      } else {
        for (const [role, contractId] of [
          ["input", provided.inputContract],
          ["output", provided.outputContract]
        ]) {
          if (contractId !== void 0 && !providedContracts.has(contractId)) {
            collector.add("UNKNOWN_CONTRACT_REFERENCE", `Resource '${reference.resourceId}' ${role} contract '${contractId}' is unknown.`, `resources[${reference.resourceId}]`);
          }
        }
      }
    }
    const componentRefs = /* @__PURE__ */ new Map();
    for (const component of declaredComponents) {
      const componentPath = `application.components[${entryKeyLabel(component.componentId)}]`;
      collector.unknownFields(component, COMPONENT_FIELDS, componentPath);
      const componentIdValid = requireIdentifierMember(collector, component, "componentId", `${componentPath}.componentId`, "Component reference id");
      const componentRevisionValid = requireRevisionMember(collector, component, "revision", `${componentPath}.revision`, "Component reference revision");
      if (!componentIdValid) {
        continue;
      }
      if (componentRefs.has(component.componentId)) {
        collector.add("DUPLICATE_COMPONENT_REFERENCE", `Component '${component.componentId}' is referenced more than once.`, componentPath);
        continue;
      }
      if (componentRevisionValid) {
        componentRefs.set(component.componentId, component.revision);
      }
      const provided = providedComponents.get(component.componentId);
      if (provided === void 0) {
        collector.add("UNKNOWN_COMPONENT_REFERENCE", `Application references component '${component.componentId}' which is not in the registry.`, componentPath);
      } else if (componentRevisionValid && provided !== component.revision) {
        collector.add("COMPONENT_REVISION_MISMATCH", `Application references component '${component.componentId}' revision '${component.revision}' but the registry declares '${provided}'.`, componentPath);
      }
    }
    if (v2ish && application.theme !== void 0) {
      if (typeof application.theme !== "string" && !isPlainObject(application.theme)) {
        collector.add("INVALID_THEME_TOKEN", `The theme declaration must be a reference string or an object (received ${describeReceivedType(application.theme)}).`, "application.theme");
      }
    }
    if (v2ish && application.theme !== void 0 && isPlainObject(application.theme)) {
      const theme = application.theme;
      const themeFields = THEME_FIELDS;
      collector.unknownFields(theme, themeFields, "application.theme");
      if (theme.reference !== void 0 && (typeof theme.reference !== "string" || theme.reference.trim().length === 0)) {
        collector.add("INVALID_THEME_TOKEN", "The theme reference must be a non-empty, non-whitespace string when present.", "application.theme.reference");
      }
      if (theme.tokens !== void 0) {
        if (!Array.isArray(theme.tokens)) {
          collector.add("INVALID_THEME_TOKEN", "Theme tokens must be an array of { name, value } assignments against the closed token vocabulary.", "application.theme.tokens");
        } else {
          const seenTokens = /* @__PURE__ */ new Set();
          for (const [index, assignment] of theme.tokens.entries()) {
            const path = `application.theme.tokens[${index}]`;
            collector.unknownFields(assignment, THEME_TOKEN_ASSIGNMENT_FIELDS, path);
            if (typeof assignment.name !== "string" || !THEME_TOKEN_NAMES.includes(assignment.name)) {
              collector.add("INVALID_THEME_TOKEN", "Theme token name is outside the closed semantic token vocabulary.", `${path}.name`);
            } else if (seenTokens.has(assignment.name)) {
              collector.add("INVALID_THEME_TOKEN", `Theme token '${assignment.name}' is assigned more than once.`, `${path}.name`);
            } else {
              seenTokens.add(assignment.name);
            }
            if (typeof assignment.value !== "string" || assignment.value.length === 0 || assignment.value.length > 200 || !THEME_TOKEN_VALUE_SAFE.test(assignment.value) || /url\s*\(/i.test(assignment.value) || /@\s*import/i.test(assignment.value) || /expression\s*\(/i.test(assignment.value)) {
              collector.add("INVALID_THEME_TOKEN_VALUE", "Theme token values must be short plain CSS variable values; CSS structure, url(), imports, and expressions are rejected.", `${path}.value`);
            }
          }
        }
      }
    }
    let uiIdentityEntries = [];
    let uiDocumentPlans = {};
    let uiDocumentMeta = {};
    let uiDiagnostics = [];
    if (isV3) {
      const attachments = resolveUiAttachments({
        application,
        ...input.uiDocuments !== void 0 ? { uiDocuments: input.uiDocuments } : {},
        ...input.uiDocumentPins !== void 0 ? { uiDocumentPins: input.uiDocumentPins } : {},
        ...input.uiExtensions !== void 0 ? { uiExtensions: input.uiExtensions } : {},
        actionIds: declaredActions.map((action) => isPlainObject(action) && typeof action.id === "string" ? action.id : "").filter((id) => id !== ""),
        routeIds: routes.map((route) => isPlainObject(route) && typeof route.id === "string" ? route.id : "").filter((id) => id !== ""),
        viewFields: buildViewFieldCatalog(declaredViews, providedResources)
      });
      const fatalUi = attachments.issues;
      if (fatalUi.length > 0) {
        return { ok: false, issues: collector.sorted(), uiIssues: fatalUi };
      }
      uiIdentityEntries = attachments.identityEntries;
      uiDocumentPlans = attachments.documentPlans;
      uiDocumentMeta = Object.fromEntries(Object.entries(attachments.documentPlans).map(([key, plan2]) => [
        key,
        { documentId: plan2.documentId, revision: plan2.revision, contentDigest: plan2.sourceDigest }
      ]));
      uiDiagnostics = attachments.warnings;
    }
    const routeParams = /* @__PURE__ */ new Set();
    for (const route of Array.isArray(application.routes) ? application.routes : []) {
      const path = route.path;
      if (typeof path !== "string")
        continue;
      for (const segment of path.split("/")) {
        if (segment.startsWith(":") && segment.length > 1)
          routeParams.add(segment.slice(1));
      }
    }
    const resourceFields = /* @__PURE__ */ new Set();
    for (const resource of providedResources.values()) {
      if (Array.isArray(resource.fields)) {
        for (const field of resource.fields) {
          if (typeof field?.name === "string")
            resourceFields.add(field.name);
        }
      }
    }
    for (const resolution of surfaceResolutions) {
      resolution(collector, {
        viewsById,
        formsById,
        actionsById,
        routeIds,
        routeParams,
        resourceFields,
        componentRefs,
        resources: providedResources
      });
    }
    const issues = collector.sorted();
    if (issues.length > 0) {
      return { ok: false, issues };
    }
    let manifest;
    let applicationVersion;
    try {
      manifest = deepFreeze(cloneForFreeze(canonicalApplicationManifest(application)));
      applicationVersion = computeApplicationVersion({
        application,
        resources: input.resources,
        ...isV3 ? { uiDocuments: uiIdentityEntries } : {}
      });
    } catch (error) {
      if (error instanceof CanonicalIdentityError) {
        return {
          ok: false,
          issues: [
            {
              code: "APPLICATION_NON_CANONICAL_VALUE",
              message: error.message,
              ...error.path !== "(root)" ? { path: error.path } : {}
            }
          ]
        };
      }
      return {
        ok: false,
        issues: [
          {
            code: "APPLICATION_COMPILATION_FAILED",
            message: "The application definition could not be canonicalized; identity inputs must be plain, finite, acyclic data."
          }
        ]
      };
    }
    const componentsFrozen = deepFreeze([...application.components ?? []].map(cloneForFreeze));
    const screensFrozen = {};
    for (const screen of application.screens) {
      screensFrozen[screen.id] = deepFreezeClone(screen);
    }
    const viewsFrozen = {};
    for (const view of application.views ?? []) {
      viewsFrozen[view.viewId] = deepFreezeClone(view);
    }
    const formsFrozen = {};
    for (const form of application.forms ?? []) {
      formsFrozen[form.formId] = deepFreezeClone(form);
    }
    const actionsFrozen = {};
    for (const action of application.actions) {
      actionsFrozen[action.id] = deepFreezeClone(action);
    }
    const resourcesFrozen = {};
    for (const reference of application.resources) {
      const resource = providedResources.get(reference.resourceId);
      if (resource !== void 0) {
        resourcesFrozen[resource.id] = deepFreezeClone(resource);
      }
    }
    const routesFrozen = deepFreeze(application.routes.map((route) => ({
      route: cloneForFreeze(route),
      screen: route.screenId !== void 0 ? cloneForFreeze(screensById.get(route.screenId)) : null
    })));
    const applicationId = application.id;
    const applicationRevision = application.revision;
    const applicationVersionCaptured = applicationVersion;
    const uiDocumentsCaptured = deepFreezeClone(uiDocumentMeta);
    const documentPlansCaptured = deepFreezeClone(uiDocumentPlans);
    const uiDiagnosticsCaptured = deepFreezeClone(uiDiagnostics);
    const plan = Object.freeze({
      applicationId,
      applicationRevision,
      applicationVersion: applicationVersionCaptured,
      manifest,
      routes: routesFrozen,
      screens: Object.freeze(screensFrozen),
      views: Object.freeze(viewsFrozen),
      forms: Object.freeze(formsFrozen),
      actions: Object.freeze(actionsFrozen),
      resources: Object.freeze(resourcesFrozen),
      components: componentsFrozen,
      ...isV3 ? {
        uiDocuments: Object.freeze(uiDocumentsCaptured),
        documentPlans: Object.freeze(documentPlansCaptured),
        uiDiagnostics: Object.freeze(uiDiagnosticsCaptured)
      } : {},
      toJSON() {
        return {
          applicationId,
          applicationRevision,
          applicationVersion: applicationVersionCaptured,
          manifest,
          routes: routesFrozen,
          screens: screensFrozen,
          views: viewsFrozen,
          forms: formsFrozen,
          actions: actionsFrozen,
          resources: resourcesFrozen,
          components: componentsFrozen,
          ...isV3 ? {
            uiDocuments: uiDocumentsCaptured,
            documentPlans: documentPlansCaptured,
            uiDiagnostics: uiDiagnosticsCaptured
          } : {}
        };
      }
    });
    return { ok: true, plan };
  } catch (error) {
    if (error instanceof CanonicalIdentityError) {
      return {
        ok: false,
        issues: [
          {
            code: "APPLICATION_NON_CANONICAL_VALUE",
            message: error.message,
            ...error.path !== "(root)" ? { path: error.path } : {}
          }
        ]
      };
    }
    return {
      ok: false,
      issues: [
        {
          code: "APPLICATION_COMPILATION_FAILED",
          message: "The application definition could not be processed (hostile getter, proxy, or invalid prototype); compilation fails safely with this structured diagnostic."
        }
      ]
    };
  }
}
function resolveSurfaceLater(surface, path, resolutions) {
  if (!isPlainObject(surface)) {
    return;
  }
  resolutions.push((collector, maps) => {
    switch (surface.role) {
      case "view":
      case "states": {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        if (surface.role === "view") {
          collectRowDetailIssues(collector, maps, surface, path);
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "form": {
        if (!maps.formsById.has(surface.formId)) {
          collector.add("UNKNOWN_FORM_REFERENCE", `Surface '${surface.id}' references unknown form '${surface.formId}'.`, `${path}.formId`);
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "action": {
        if (!maps.actionsById.has(surface.actionId)) {
          collector.add("UNKNOWN_ACTION_REFERENCE", `Action surface '${surface.id}' references unknown action '${surface.actionId}'.`, `${path}.actionId`);
        }
        requireDisplayStringMember(collector, surface, "label", `${path}.label`, `Action surface '${surface.id}' label`, "INVALID_SURFACE_DECLARATION");
        if (surface.disabledWhen !== void 0) {
          collector.unknownFields(surface.disabledWhen, DISABLED_CONDITION_FIELDS, `${path}.disabledWhen`);
          if (typeof surface.disabledWhen.paramMissing !== "string" || surface.disabledWhen.paramMissing.length === 0) {
            collector.add("INVALID_SURFACE_DISABLED_CONDITION", `Action surface '${surface.id}' disabledWhen.paramMissing must be a non-empty route-parameter name.`, `${path}.disabledWhen`);
          }
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "component": {
        const surfaceRevisionValid = requireRevisionMember(collector, surface, "revision", `${path}.revision`, `Component surface '${surface.id}' revision`);
        const declared = maps.componentRefs.get(surface.componentId);
        if (declared === void 0) {
          collector.add("UNKNOWN_COMPONENT_REFERENCE", `Component surface '${surface.id}' references unknown component '${surface.componentId}'.`, `${path}.componentId`);
        } else if (surfaceRevisionValid && declared !== surface.revision) {
          collector.add("COMPONENT_REVISION_MISMATCH", `Component surface '${surface.id}' references component '${surface.componentId}' revision '${surface.revision}' but the application declares '${declared}'.`, `${path}.revision`);
        }
        collectComponentSourceIssues(collector, maps, surface.id, surface.props, surface.input, path);
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "text": {
        requireDisplayStringMember(collector, surface, "content", `${path}.content`, `Text surface '${surface.id}' content`, "INVALID_SURFACE_DECLARATION");
        if (surface.level !== void 0 && (typeof surface.level !== "number" || !Number.isSafeInteger(surface.level) || surface.level < 1 || surface.level > 6)) {
          collector.add("INVALID_SURFACE_DECLARATION", `Text surface '${surface.id}' level must be an integer between 1 and 6 when present.`, `${path}.level`);
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "list": {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        const titleFieldValid = requireNonEmptyStringMember(collector, surface, "titleField", `${path}.titleField`, `List surface '${surface.id}' titleField`, "INVALID_SURFACE_DECLARATION");
        collectViewFieldIssues(collector, maps, surface.id, surface.viewId, [
          ...titleFieldValid ? [["titleField", surface.titleField]] : [],
          ["secondaryField", surface.secondaryField]
        ], path);
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "table": {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        collectRowDetailIssues(collector, maps, surface, path);
        if (surface.pageSize !== void 0 && (typeof surface.pageSize !== "number" || !Number.isSafeInteger(surface.pageSize) || surface.pageSize <= 0)) {
          collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' pageSize must be a positive safe integer when present.`, `${path}.pageSize`);
        }
        if (surface.rowAction !== void 0) {
          const rowActionPath = `${path}.rowAction`;
          if (!isPlainObject(surface.rowAction)) {
            collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' rowAction must be a plain object (received ${describeReceivedType(surface.rowAction)}).`, rowActionPath);
          } else {
            collector.unknownFields(surface.rowAction, TABLE_ROW_ACTION_FIELDS, rowActionPath);
            if (typeof surface.rowAction.actionId !== "string" || surface.rowAction.actionId.length === 0) {
              collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' rowAction.actionId must be a non-empty string.`, `${rowActionPath}.actionId`);
            } else {
              const rowAction = maps.actionsById.get(surface.rowAction.actionId);
              if (rowAction === void 0) {
                collector.add("UNKNOWN_ACTION_REFERENCE", `Table surface '${surface.id}' references unknown row action '${surface.rowAction.actionId}'.`, `${rowActionPath}.actionId`);
              } else if (rowAction.kind === "local") {
                collector.add("INVALID_ACTION_BINDING", `Table surface '${surface.id}' rowAction must reference a server or navigation action; '${surface.rowAction.actionId}' is a local action.`, `${rowActionPath}.actionId`);
              }
            }
            if (typeof surface.rowAction.label !== "string" || surface.rowAction.label.trim().length === 0) {
              collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' rowAction.label must be a non-empty string.`, `${rowActionPath}.label`);
            }
            if (surface.rowAction.input !== void 0) {
              if (!isPlainObject(surface.rowAction.input)) {
                collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' rowAction.input must be a plain object (received ${describeReceivedType(surface.rowAction.input)}).`, `${rowActionPath}.input`);
              } else {
                collector.unknownFields(surface.rowAction.input, new Set(Object.keys(surface.rowAction.input)), `${rowActionPath}.input`);
                collectViewFieldIssues(collector, maps, surface.id, surface.viewId, Object.entries(surface.rowAction.input).map(([name, rowField]) => [`rowAction.input.${name}`, rowField]), path);
              }
            }
          }
        }
        if (surface.columns !== void 0) {
          for (const [index, column] of surface.columns.entries()) {
            const columnPath = `${path}.columns[${index}]`;
            collector.unknownFields(column, TABLE_COLUMN_FIELDS, columnPath);
            if (!isPlainObject(column)) {
              collector.add("INVALID_TABLE_DECLARATION", `Table columns must be plain objects (received ${describeReceivedType(column)}).`, columnPath);
              continue;
            }
            requireNonEmptyStringMember(collector, column, "field", `${columnPath}.field`, `Table surface '${surface.id}' column field`, "INVALID_TABLE_DECLARATION");
            if (column.componentId !== void 0) {
              const cellRevisionValid = requireRevisionMember(collector, column, "revision", `${columnPath}.revision`, `Table surface '${surface.id}' cell component revision`);
              const declaredCell = maps.componentRefs.get(column.componentId);
              if (declaredCell === void 0) {
                collector.add("UNKNOWN_COMPONENT_REFERENCE", `Table surface '${surface.id}' column '${column.field}' references unknown component '${column.componentId}'.`, `${columnPath}.componentId`);
              } else if (cellRevisionValid && declaredCell !== column.revision) {
                collector.add("COMPONENT_REVISION_MISMATCH", `Table surface '${surface.id}' column '${column.field}' references component '${column.componentId}' revision '${column.revision}' but the application declares '${declaredCell}'.`, `${columnPath}.revision`);
              }
              if (column.props !== void 0) {
                if (!isPlainObject(column.props)) {
                  collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' column '${column.field}' props must be a plain object (received ${describeReceivedType(column.props)}).`, `${columnPath}.props`);
                } else {
                  collector.unknownFields(column.props, new Set(Object.keys(column.props)), `${columnPath}.props`);
                  collectViewFieldIssues(collector, maps, surface.id, surface.viewId, Object.entries(column.props).map(([propName, rowField]) => [`columns[${index}].props.${propName}`, rowField]), path);
                }
              }
            } else if (column.revision !== void 0 || column.props !== void 0) {
              collector.add("INVALID_TABLE_DECLARATION", `Table surface '${surface.id}' column '${String(column.field ?? index)}' declares cell-component members without componentId.`, columnPath);
            }
          }
          collectViewFieldIssues(collector, maps, surface.id, surface.viewId, surface.columns.map((column, index) => [`columns[${index}].field`, column.field]), path);
        }
        if (surface.searchFields !== void 0) {
          collectViewFieldIssues(collector, maps, surface.id, surface.viewId, surface.searchFields.map((field, index) => [`searchFields[${index}]`, field]), path);
        }
        if (surface.filterFields !== void 0) {
          collectViewFieldIssues(collector, maps, surface.id, surface.viewId, surface.filterFields.map((field, index) => [`filterFields[${index}]`, field]), path);
        }
        if (surface.queryActionId !== void 0) {
          const action = maps.actionsById.get(surface.queryActionId);
          if (action === void 0) {
            collector.add("UNKNOWN_ACTION_REFERENCE", `Table surface '${surface.id}' references unknown query action '${surface.queryActionId}'.`, `${path}.queryActionId`);
          } else if (action.kind !== "query") {
            collector.add("INVALID_ACTION_BINDING", `Table surface '${surface.id}' queryActionId must reference a query action; '${surface.queryActionId}' is a '${action.kind}' action.`, `${path}.queryActionId`);
          }
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "detail": {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        collectViewFieldIssues(collector, maps, surface.id, surface.viewId, (surface.fields ?? []).map((field, index) => [`fields[${index}]`, field]), path);
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "chart": {
        if (typeof surface.kind !== "string" || !CHART_KINDS.has(surface.kind)) {
          collector.add("INVALID_CHART_DECLARATION", `Chart surface '${surface.id}' kind must be one of: bar, line.`, `${path}.kind`);
        }
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        requireDisplayStringMember(collector, surface, "summary", `${path}.summary`, `Chart surface '${surface.id}' summary`, "INVALID_CHART_DECLARATION");
        const chartFields = [];
        if (requireNonEmptyStringMember(collector, surface, "xField", `${path}.xField`, `Chart surface '${surface.id}' xField`, "INVALID_CHART_DECLARATION")) {
          chartFields.push(["xField", surface.xField]);
        }
        if (requireNonEmptyStringMember(collector, surface, "yField", `${path}.yField`, `Chart surface '${surface.id}' yField`, "INVALID_CHART_DECLARATION")) {
          chartFields.push(["yField", surface.yField]);
        }
        collectViewFieldIssues(collector, maps, surface.id, surface.viewId, chartFields, path);
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "status": {
        if (surface.value !== void 0 && surface.field !== void 0) {
          collector.add("INVALID_STATUS_DECLARATION", `Status surface '${surface.id}' must declare a static value or a record field, not both.`, path);
        }
        if (surface.value === void 0 && surface.field === void 0) {
          collector.add("INVALID_STATUS_DECLARATION", `Status surface '${surface.id}' must declare either a static value or a record field.`, path);
        }
        if (surface.tones !== void 0) {
          for (const [value, tone] of Object.entries(surface.tones)) {
            if (value.length === 0 || !STATUS_TONES.has(tone)) {
              collector.add("INVALID_STATUS_DECLARATION", `Status surface '${surface.id}' declares an invalid tone mapping.`, `${path}.tones`);
              break;
            }
          }
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "count": {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        if (surface.label !== void 0 && typeof surface.label !== "string") {
          collector.add("INVALID_SURFACE_DECLARATION", `Count surface '${surface.id}' label must be a string when declared.`, `${path}.label`);
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "tabs": {
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "dialog":
      case "drawer": {
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case "conversation": {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' references unknown view '${surface.viewId}'.`, `${path}.viewId`);
        }
        const conversationFields = [];
        if (requireNonEmptyStringMember(collector, surface, "messageField", `${path}.messageField`, `Conversation surface '${surface.id}' messageField`, "INVALID_CONVERSATION_DECLARATION")) {
          conversationFields.push(["messageField", surface.messageField]);
        }
        if (requireNonEmptyStringMember(collector, surface, "authorField", `${path}.authorField`, `Conversation surface '${surface.id}' authorField`, "INVALID_CONVERSATION_DECLARATION")) {
          conversationFields.push(["authorField", surface.authorField]);
        }
        requireDisplayStringMember(collector, surface, "inputLabel", `${path}.inputLabel`, `Conversation surface '${surface.id}' inputLabel`, "INVALID_CONVERSATION_DECLARATION");
        conversationFields.push(["participantField", surface.participantField]);
        collectViewFieldIssues(collector, maps, surface.id, surface.viewId, conversationFields, path);
        collectComponentSourceIssues(collector, maps, surface.id, void 0, surface.input, path);
        const sendAction = maps.actionsById.get(surface.sendActionId);
        if (sendAction === void 0) {
          collector.add("UNKNOWN_ACTION_REFERENCE", `Conversation surface '${surface.id}' references unknown send action '${surface.sendActionId}'.`, `${path}.sendActionId`);
        } else if (sendAction.kind !== "mutation" && sendAction.kind !== "capability") {
          collector.add("INVALID_ACTION_BINDING", `Conversation surface '${surface.id}' sendActionId must reference a mutation or capability action; '${surface.sendActionId}' is a '${sendAction.kind}' action.`, `${path}.sendActionId`);
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
    }
  });
}
function collectConditionIssues(collector, surface, path, maps) {
  const condition = surface.visibleWhen;
  if (condition === void 0) {
    return;
  }
  collector.unknownFields(condition, CONDITION_FIELDS, `${path}.visibleWhen`);
  const declared = ["viewNonEmpty", "viewEmpty", "paramEquals"].filter((key) => condition[key] !== void 0);
  if (declared.length !== 1) {
    collector.add("INVALID_SURFACE_CONDITION", `Surface '${surface.id}' visibleWhen must declare exactly one condition (viewNonEmpty, viewEmpty, or paramEquals).`, `${path}.visibleWhen`);
    return;
  }
  if (condition.viewNonEmpty !== void 0) {
    if (!maps.viewsById.has(condition.viewNonEmpty)) {
      collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' visibleWhen references unknown view '${condition.viewNonEmpty}'.`, `${path}.visibleWhen.viewNonEmpty`);
    }
  } else if (condition.viewEmpty !== void 0) {
    if (!maps.viewsById.has(condition.viewEmpty)) {
      collector.add("UNKNOWN_VIEW_REFERENCE", `Surface '${surface.id}' visibleWhen references unknown view '${condition.viewEmpty}'.`, `${path}.visibleWhen.viewEmpty`);
    }
  } else if (condition.paramEquals !== void 0) {
    collector.unknownFields(condition.paramEquals, CONDITION_PARAM_EQUALS_FIELDS, `${path}.visibleWhen.paramEquals`);
    if (typeof condition.paramEquals.name !== "string" || condition.paramEquals.name.length === 0 || typeof condition.paramEquals.value !== "string") {
      collector.add("INVALID_SURFACE_CONDITION", `Surface '${surface.id}' visibleWhen.paramEquals must declare a non-empty parameter name and a string value.`, `${path}.visibleWhen.paramEquals`);
    }
  }
}
function isComponentSourceShape(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value;
  const keys = Object.keys(record);
  if (keys.length !== 1)
    return false;
  const key = keys[0];
  const member = record[key];
  return (key === "param" || key === "record" || key === "view") && typeof member === "string" && member.length > 0;
}
function collectComponentSourceIssues(collector, maps, surfaceId, props, input, path) {
  const checkSource = (source, sourcePath) => {
    if (!isComponentSourceShape(source)) {
      collector.add("INVALID_COMPONENT_SOURCE", `Component surface '${surfaceId}' source at '${sourcePath.replace(`${path}.`, "")}' must be a closed route-context binding: exactly one of { param }, { record } or { view } with a non-empty string value. Expressions and executable code are not part of the vocabulary.`, sourcePath);
      return;
    }
    const entries = Object.entries(source);
    const kind = entries[0]?.[0] ?? "";
    const name = entries[0]?.[1] ?? "";
    if (kind === "param" && maps.routeParams.size > 0 && !maps.routeParams.has(name)) {
      collector.add("INVALID_COMPONENT_SOURCE", `Component surface '${surfaceId}' references route parameter '${name}' which no declared route declares.`, sourcePath);
    }
    if (kind === "view" && !maps.viewsById.has(name)) {
      collector.add("UNKNOWN_VIEW_REFERENCE", `Component surface '${surfaceId}' references unknown view '${name}'.`, sourcePath);
    }
    if (kind === "record" && maps.resourceFields.size > 0 && !maps.resourceFields.has(name)) {
      collector.add("UNKNOWN_FIELD", `Component surface '${surfaceId}' record binding references field '${name}' which no declared resource catalogue defines.`, sourcePath);
    }
  };
  if (props !== void 0) {
    if (!isPlainObject(props)) {
      collector.add("INVALID_COMPONENT_SOURCE", `Component surface '${surfaceId}' props must be a plain object (received ${describeReceivedType(props)}).`, `${path}.props`);
    } else {
      for (const [name, value] of Object.entries(props)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          continue;
        }
        checkSource(value, `${path}.props.${name}`);
      }
    }
  }
  if (input !== void 0) {
    if (!isPlainObject(input)) {
      collector.add("INVALID_COMPONENT_SOURCE", `Component surface '${surfaceId}' input must be a plain object (received ${describeReceivedType(input)}).`, `${path}.input`);
    } else {
      for (const [field, source] of Object.entries(input)) {
        checkSource(source, `${path}.input.${field}`);
      }
    }
  }
}
function collectViewFieldIssues(collector, maps, surfaceId, viewId, fields, path) {
  const view = maps.viewsById.get(viewId);
  if (view === void 0) {
    return;
  }
  const resource = maps.resources.get(view.resourceId);
  for (const [fieldPath, fieldName] of fields) {
    if (fieldName === void 0) {
      continue;
    }
    const inProjection = view.fields === void 0 || view.fields.includes(fieldName);
    const inCatalogue = resource === void 0 || !Array.isArray(resource.fields) || resource.fields.some((f) => f.name === fieldName);
    if (!inProjection || !inCatalogue) {
      collector.add("UNKNOWN_FIELD", `Surface '${surfaceId}' field '${fieldName}' is not part of view '${viewId}' or the bound resource catalogue.`, `${path}.${fieldPath}`);
    }
  }
}
function collectRowDetailIssues(collector, maps, surface, path) {
  const binding = surface.rowDetail;
  if (binding === void 0) {
    return;
  }
  const bindingPath = `${path}.rowDetail`;
  if (!isPlainObject(binding)) {
    collector.add("INVALID_SURFACE_DECLARATION", `Surface '${surface.id}' rowDetail must be a plain object (received ${describeReceivedType(binding)}).`, bindingPath);
    return;
  }
  collector.unknownFields(binding, TABLE_ROW_DETAIL_FIELDS, bindingPath);
  const bindingObject = binding;
  if (typeof bindingObject.routeId !== "string" || bindingObject.routeId.length === 0) {
    collector.add("INVALID_SURFACE_DECLARATION", `Surface '${surface.id}' rowDetail.routeId must be a non-empty string.`, `${bindingPath}.routeId`);
  } else if (!maps.routeIds.has(bindingObject.routeId)) {
    collector.add("UNKNOWN_ROUTE_REFERENCE", `Surface '${surface.id}' rowDetail references unknown route '${bindingObject.routeId}'.`, `${bindingPath}.routeId`);
  } else if (bindingObject.param !== void 0 && isPlainObject(bindingObject.param)) {
    const declaredParams = bindingObject.param;
    for (const name of Object.keys(declaredParams)) {
      if (!maps.routeParams.has(name)) {
        collector.add("INVALID_SURFACE_DECLARATION", `Surface '${surface.id}' rowDetail param '${name}' is not a declared route path parameter.`, `${bindingPath}.param.${name}`);
      }
    }
  }
  if (bindingObject.label !== void 0 && (typeof bindingObject.label !== "string" || bindingObject.label.trim().length === 0)) {
    collector.add("INVALID_SURFACE_DECLARATION", `Surface '${surface.id}' rowDetail.label must be a non-empty string when present.`, `${bindingPath}.label`);
  }
  if (bindingObject.param === void 0) {
    return;
  }
  if (!isPlainObject(bindingObject.param)) {
    collector.add("INVALID_SURFACE_DECLARATION", `Surface '${surface.id}' rowDetail.param must be a plain object (received ${describeReceivedType(bindingObject.param)}).`, `${bindingPath}.param`);
    return;
  }
  collector.unknownFields(bindingObject.param, new Set(Object.keys(bindingObject.param)), `${bindingPath}.param`);
  collectViewFieldIssues(collector, maps, surface.id, surface.viewId, Object.entries(bindingObject.param).map(([name, rowField]) => [`rowDetail.param.${name}`, rowField]), path);
}
function collectComponentPropsIssues(collector, surfaceId, props, path) {
  if (props === null || typeof props !== "object" || Array.isArray(props)) {
    collector.add("INVALID_SURFACE_DECLARATION", `Component surface '${surfaceId}' props must be a plain object of primitive values when present (received ${describeReceivedType(props)}).`, path);
    return;
  }
  const source = props;
  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    const inDomain = typeof value === "string" || typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0) || typeof value === "boolean" || // Declared route-context source bindings (@2) are closed plain
    // objects ({ param } / { record } / { view }); their shape is
    // validated by collectComponentSourceIssues.
    isComponentSourceShape(value);
    if (!inDomain) {
      collector.add("INVALID_SURFACE_DECLARATION", `Component surface '${surfaceId}' prop values must be strings, finite numbers (excluding negative zero), or booleans (received ${describeReceived(value)}).`, `${path}.${key}`);
    }
  }
}
function collectSurface(collector, surface, screenPath, surfaceIds, resolutions, isV2 = false) {
  if (!isPlainObject(surface)) {
    collector.add("INVALID_SURFACE_DECLARATION", `Surface declarations must be plain objects (received ${describeReceivedType(surface)}).`, `${screenPath}.surfaces`);
    return;
  }
  const path = `${screenPath} (surface '${entryKeyLabel(surface.id)}')`;
  const allowed = (isV2 ? SURFACE_FIELDS_V2 : SURFACE_FIELDS).get(surface.role);
  if (allowed === void 0) {
    collector.add("UNKNOWN_SURFACE_ROLE", `Surface '${String(surface.id)}' declares unknown role '${String(surface.role)}'.`, `${screenPath}.surfaces[${String(surface.id)}]`);
    return;
  }
  const surfaceIdValid = requireIdentifierMember(collector, surface, "id", `${path}.id`, "Surface id");
  if (surfaceIdValid) {
    if (surfaceIds.has(surface.id)) {
      collector.add("DUPLICATE_SURFACE_ID", `Surface id '${surface.id}' is declared more than once.`, path);
    }
    surfaceIds.add(surface.id);
  }
  collector.unknownFields(surface, allowed, path);
  if (surface.role === "component" && surface.props !== void 0) {
    collectComponentPropsIssues(collector, entryKeyLabel(surface.id), surface.props, `${path}.props`);
  }
  if (isV2 && surface.visibleWhen !== void 0) {
    if (typeof surface.visibleWhen !== "object" || surface.visibleWhen === null) {
      collector.add("INVALID_SURFACE_CONDITION", `Surface '${surface.id}' visibleWhen must be an object with exactly one condition.`, `${path}.visibleWhen`);
    }
  }
  if (isV2) {
    if (surface.role === "tabs") {
      if (!Array.isArray(surface.tabs) || surface.tabs.length === 0) {
        collector.add("INVALID_TABS_DECLARATION", `Tabs surface '${surface.id}' must declare a non-empty tabs array.`, `${path}.tabs`);
      } else {
        const tabNames = /* @__PURE__ */ new Set();
        for (const [index, tab] of surface.tabs.entries()) {
          const tabPath = `${path}.tabs[${index}]`;
          if (!isPlainObject(tab)) {
            collector.add("INVALID_TABS_DECLARATION", `Tab declarations must be plain objects (received ${describeReceivedType(tab)}).`, tabPath);
            continue;
          }
          collector.unknownFields(tab, TAB_FIELDS, tabPath);
          if (typeof tab.name !== "string" || tab.name.length === 0) {
            collector.add("INVALID_TABS_DECLARATION", `Tab ${index} of surface '${surface.id}' must declare a non-empty name.`, `${tabPath}.name`);
          } else if (tabNames.has(tab.name)) {
            collector.add("DUPLICATE_TAB_NAME", `Tab name '${tab.name}' is declared more than once on surface '${surface.id}'.`, `${tabPath}.name`);
          } else {
            tabNames.add(tab.name);
          }
          requireDisplayStringMember(collector, tab, "label", `${tabPath}.label`, `Tab ${index} of surface '${surface.id}' label`, "INVALID_TABS_DECLARATION");
          if (Array.isArray(tab.surfaces)) {
            for (const nested of tab.surfaces) {
              collectSurface(collector, nested, `${path}.tabs[${index}]`, surfaceIds, resolutions, true);
            }
          } else {
            collector.add("INVALID_TABS_DECLARATION", `Tab ${index} of surface '${surface.id}' must declare a surfaces array (received ${describeReceived(tab.surfaces)}).`, `${tabPath}.surfaces`);
          }
        }
      }
    } else if (surface.role === "dialog" || surface.role === "drawer") {
      requireDisplayStringMember(collector, surface, "title", `${path}.title`, `${surface.role} surface '${surface.id}' title`, "INVALID_SURFACE_DECLARATION");
      requireDisplayStringMember(collector, surface, "triggerLabel", `${path}.triggerLabel`, `${surface.role} surface '${surface.id}' triggerLabel`, "INVALID_SURFACE_DECLARATION");
      if (!Array.isArray(surface.content) || surface.content.length === 0) {
        collector.add("INVALID_SURFACE_DECLARATION", `${surface.role} surface '${surface.id}' must declare non-empty content surfaces.`, `${path}.content`);
      } else {
        for (const nested of surface.content) {
          collectSurface(collector, nested, path, surfaceIds, resolutions, true);
        }
      }
    }
  }
  resolveSurfaceLater(surface, path, resolutions);
}
function collectResourceReference(collector, application, resourceId, resourceRevision, provided, path) {
  const declared = Array.isArray(application.resources) ? application.resources.find((entry) => entry.resourceId === resourceId) : void 0;
  if (declared === void 0) {
    collector.add("UNKNOWN_RESOURCE_REFERENCE", `'${path}' references resource '${resourceId}' that the application does not declare.`, path);
    return;
  }
  if (declared.revision !== resourceRevision) {
    collector.add("RESOURCE_REVISION_MISMATCH", `'${path}' binds resource '${resourceId}' revision '${resourceRevision}' but the application declares '${declared.revision}'.`, path);
    return;
  }
  const providedResource = provided.get(resourceId);
  if (providedResource !== void 0 && providedResource.revision !== resourceRevision) {
    collector.add("RESOURCE_REVISION_MISMATCH", `'${path}' binds resource '${resourceId}' revision '${resourceRevision}' but the provided definition is '${providedResource.revision}'.`, path);
  }
}
function checkCatalogueField(collector, resource, fieldName, path) {
  const name = typeof fieldName === "string" ? fieldName : fieldName?.name;
  if (resource === void 0) {
    return;
  }
  if (typeof name !== "string" || !Array.isArray(resource.fields)) {
    return;
  }
  if (!resource.fields.some((field) => field.name === name)) {
    collector.add("UNKNOWN_FIELD", `Field '${name}' is not in the explicit field catalogue of resource '${resource.id}'.`, path);
  }
}
function checkContractReference(collector, provided, contractId, expectedRevision, path) {
  const revision = provided.get(contractId);
  if (revision === void 0) {
    collector.add("UNKNOWN_CONTRACT_REFERENCE", `Contract reference '${contractId}' is unknown.`, path);
    return;
  }
  if (expectedRevision !== void 0 && expectedRevision !== revision) {
    collector.add("CONTRACT_REVISION_MISMATCH", `Contract '${contractId}' reference expects revision '${expectedRevision}' but the registry declares '${revision}'.`, path);
  }
}
function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    Object.freeze(value);
    return value;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
    Object.freeze(value);
  }
  return value;
}
function cloneForFreeze(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      out.push(cloneForFreeze(item));
    }
    return out;
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = cloneForFreeze(item);
    }
    return out;
  }
  return value;
}
function deepFreezeClone(value) {
  return deepFreeze(cloneForFreeze(value));
}
function describeReceivedType(value) {
  if (value === null)
    return "null";
  if (Array.isArray(value))
    return "array";
  return typeof value;
}
const APPLICATION_ISSUE_CODE_FLAGS = {
  APPLICATION_UNKNOWN_FIELD: true,
  APPLICATION_EMBEDDED_VALUE_FIELD: true,
  APPLICATION_EMPTY_ID: true,
  APPLICATION_EMPTY_REVISION: true,
  APPLICATION_INVALID_IDENTIFIER: true,
  APPLICATION_REQUIRED_MEMBER: true,
  APPLICATION_NON_CANONICAL_VALUE: true,
  APPLICATION_COMPILATION_FAILED: true,
  APPLICATION_UNKNOWN_SCHEMA: true,
  DUPLICATE_ROUTE_ID: true,
  DUPLICATE_ROUTE_PATH: true,
  DUPLICATE_SCREEN_ID: true,
  DUPLICATE_REGION_NAME: true,
  DUPLICATE_SURFACE_ID: true,
  DUPLICATE_VIEW_ID: true,
  DUPLICATE_FORM_ID: true,
  DUPLICATE_ACTION_ID: true,
  DUPLICATE_RESOURCE_REFERENCE: true,
  DUPLICATE_COMPONENT_REFERENCE: true,
  DUPLICATE_TAB_NAME: true,
  UNKNOWN_ROUTE_SCREEN: true,
  UNKNOWN_ROUTE_REFERENCE: true,
  UNKNOWN_VIEW_REFERENCE: true,
  UNKNOWN_FORM_REFERENCE: true,
  UNKNOWN_ACTION_REFERENCE: true,
  UNKNOWN_FORM_ACTION: true,
  UNKNOWN_RESOURCE_REFERENCE: true,
  UNKNOWN_RESOURCE: true,
  RESOURCE_REVISION_MISMATCH: true,
  UNKNOWN_FIELD: true,
  UNKNOWN_CONTRACT_REFERENCE: true,
  CONTRACT_REVISION_MISMATCH: true,
  UNKNOWN_CAPABILITY_REFERENCE: true,
  CAPABILITY_REVISION_MISMATCH: true,
  UNKNOWN_COMPONENT_REFERENCE: true,
  COMPONENT_REVISION_MISMATCH: true,
  INVALID_COMPONENT_SOURCE: true,
  UNKNOWN_SURFACE_ROLE: true,
  MUTATION_NOT_DECLARED: true,
  ROUTE_PATH_INVALID: true,
  ROUTE_REDIRECT_INVALID: true,
  ROUTE_REDIRECT_CYCLE: true,
  ROUTE_SCREEN_REQUIRED: true,
  UNKNOWN_BREADCRUMB_ROUTE: true,
  INVALID_SURFACE_CONDITION: true,
  INVALID_SURFACE_DISABLED_CONDITION: true,
  INVALID_THEME_TOKEN: true,
  INVALID_THEME_TOKEN_VALUE: true,
  INVALID_ACTION_FEEDBACK: true,
  INVALID_UI_COMPOSITION: true,
  INVALID_SURFACE_DECLARATION: true,
  INVALID_VIEW_DECLARATION: true,
  INVALID_TABLE_DECLARATION: true,
  INVALID_CHART_DECLARATION: true,
  INVALID_STATUS_DECLARATION: true,
  INVALID_TABS_DECLARATION: true,
  INVALID_CONVERSATION_DECLARATION: true,
  INVALID_ACTION_BINDING: true
};
Object.freeze(Object.keys(APPLICATION_ISSUE_CODE_FLAGS));
const inspectionResource = {
  schema: "vict.resource@1",
  id: "inspection",
  revision: "1",
  identity: { key: "id" },
  fields: [
    { name: "id", type: "string", required: true, label: "Id" },
    { name: "title", type: "string", required: true, label: "Title" },
    { name: "status", type: "string", required: true, label: "Status" },
    { name: "technician", type: "string", required: true, label: "Technician" },
    { name: "supervisor", type: "string", required: true, label: "Supervisor" },
    { name: "submittedAt", type: "date", label: "Submitted" },
    { name: "decidedAt", type: "date", label: "Decided" },
    { name: "rejectionReason", type: "string", label: "Rejection reason" },
    { name: "domainRevision", type: "number", required: true, label: "Domain revision" },
    // Joined child collections materialized by the adapter (disclosed U1
    // decision: the view projection exposes findings/evidence so the
    // document can bind them; the scalar domain fields are §1.1 unchanged).
    { name: "findings", type: "json", label: "Findings" },
    { name: "evidence", type: "json", label: "Evidence" },
    { name: "activity", type: "json", label: "Activity" }
  ],
  mutations: [
    {
      op: "approve",
      effect: "irreversible",
      inputContractId: "c.decision",
      outputContractId: "c.decision",
      permissions: ["qlt.inspection.approve"]
    },
    {
      op: "reject",
      effect: "irreversible",
      inputContractId: "c.decision",
      outputContractId: "c.decision",
      permissions: ["qlt.inspection.reject"]
    },
    {
      op: "revise",
      effect: "write",
      inputContractId: "c.decision",
      outputContractId: "c.decision",
      permissions: ["qlt.inspection.revise"]
    }
  ],
  authorization: {}
};
const findingResource = {
  schema: "vict.resource@1",
  id: "finding",
  revision: "1",
  identity: { key: "id" },
  fields: [
    { name: "id", type: "string", required: true, label: "Id" },
    { name: "inspectionId", type: "string", required: true, label: "Inspection" },
    { name: "severity", type: "string", required: true, label: "Severity" },
    { name: "description", type: "string", required: true, label: "Description" }
  ],
  authorization: {}
};
const evidenceResource = {
  schema: "vict.resource@1",
  id: "evidence",
  revision: "1",
  identity: { key: "id" },
  fields: [
    { name: "id", type: "string", required: true, label: "Id" },
    { name: "inspectionId", type: "string", required: true, label: "Inspection" },
    { name: "label", type: "string", required: true, label: "Label" },
    { name: "kind", type: "string", required: true, label: "Kind" }
  ],
  authorization: {}
};
const activityResource = {
  schema: "vict.resource@1",
  id: "activity",
  revision: "1",
  identity: { key: "id" },
  fields: [
    { name: "id", type: "string", required: true, label: "Id" },
    { name: "inspectionId", type: "string", required: true, label: "Inspection" },
    { name: "at", type: "date", required: true, label: "At" },
    { name: "actor", type: "string", required: true, label: "Actor" },
    { name: "entry", type: "string", required: true, label: "Entry" }
  ],
  authorization: {}
};
const inspectionDetailDocument = {
  schema: "vict.ui-document@1",
  id: "doc.inspection-detail",
  revision: "1",
  root: "n.root",
  nodes: {
    "n.root": {
      kind: "element",
      id: "n.root",
      tag: "section",
      classes: ["detail"],
      styleSources: ["ss.detailLayout", "ss.detailNarrow"],
      children: ["n.header", "n.columns", "n.actions"]
    },
    "n.header": {
      kind: "element",
      id: "n.header",
      tag: "header",
      localStyle: [
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "align-items", value: { type: "text", value: "baseline" } },
        { property: "gap", value: { type: "token", id: "space.md" } },
        { property: "border-bottom", value: { type: "text", value: "1px solid #d9dde3" } }
      ],
      children: ["n.title", "n.status"]
    },
    "n.title": {
      kind: "element",
      id: "n.title",
      tag: "h1",
      children: ["n.titleText"]
    },
    "n.titleText": {
      kind: "text",
      id: "n.titleText",
      content: { type: "expression", expression: { type: "ref", path: "record.title" } }
    },
    "n.status": {
      kind: "element",
      id: "n.status",
      tag: "span",
      attributes: { "data-status": { type: "ref", path: "record.status" }, role: "status" },
      localStyle: [
        { property: "font-weight", value: { type: "text", value: "600" } },
        { property: "color", value: { type: "token", id: "color.accent" } }
      ],
      children: ["n.statusText"]
    },
    "n.statusText": {
      kind: "text",
      id: "n.statusText",
      content: { type: "expression", expression: { type: "ref", path: "record.status" } }
    },
    "n.columns": {
      kind: "element",
      id: "n.columns",
      tag: "div",
      styleSources: ["ss.columns"],
      children: ["n.findingsSection", "n.sideRail"]
    },
    "n.findingsSection": {
      kind: "element",
      id: "n.findingsSection",
      tag: "section",
      attributes: { "aria-label": "Findings" },
      children: ["n.findingsHeading", "n.findingsList"]
    },
    "n.findingsHeading": {
      kind: "element",
      id: "n.findingsHeading",
      tag: "h2",
      children: ["n.findingsHeadingText"]
    },
    "n.findingsHeadingText": {
      kind: "text",
      id: "n.findingsHeadingText",
      content: { type: "literal", value: "Findings" }
    },
    "n.findingsList": {
      kind: "element",
      id: "n.findingsList",
      tag: "ul",
      localStyle: [
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "flex-direction", value: { type: "text", value: "column" } },
        { property: "gap", value: { type: "token", id: "space.sm" } }
      ],
      children: ["n.findingsRepeat"]
    },
    "n.findingsRepeat": {
      kind: "repeat",
      id: "n.findingsRepeat",
      collection: { type: "ref", path: "view.findings" },
      key: { type: "ref", path: "repeat.finding.description" },
      itemName: "finding",
      templateRoot: "n.findingCard"
    },
    "n.findingCard": {
      kind: "component",
      id: "n.findingCard",
      definitionId: "def.findingCard",
      props: {
        severity: { type: "ref", path: "repeat.finding.severity" },
        description: { type: "ref", path: "repeat.finding.description" }
      }
    },
    // def.findingCard body (prop scope: severity/description)
    "n.card": {
      kind: "element",
      id: "n.card",
      tag: "article",
      attributes: { "aria-label": { type: "ref", path: "prop.description" } },
      children: ["n.cardSeverity", "n.cardDescription"]
    },
    "n.cardSeverity": {
      kind: "element",
      id: "n.cardSeverity",
      tag: "strong",
      children: ["n.cardSeverityText"]
    },
    "n.cardSeverityText": {
      kind: "text",
      id: "n.cardSeverityText",
      content: {
        type: "expression",
        expression: {
          type: "conditionalValue",
          when: {
            type: "compare",
            op: "eq",
            left: { type: "ref", path: "prop.severity" },
            right: { type: "literal", value: "high" }
          },
          then: { type: "literal", value: "HIGH severity" },
          otherwise: { type: "ref", path: "prop.severity" }
        }
      }
    },
    "n.cardDescription": {
      kind: "text",
      id: "n.cardDescription",
      content: { type: "expression", expression: { type: "ref", path: "prop.description" } }
    },
    "n.sideRail": {
      kind: "element",
      id: "n.sideRail",
      tag: "aside",
      attributes: { "aria-label": "Evidence and activity" },
      localStyle: [
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "flex-direction", value: { type: "text", value: "column" } },
        { property: "gap", value: { type: "token", id: "space.md" } }
      ],
      children: ["n.evidenceHeading", "n.evidenceList"]
    },
    "n.evidenceHeading": {
      kind: "element",
      id: "n.evidenceHeading",
      tag: "h2",
      children: ["n.evidenceHeadingText"]
    },
    "n.evidenceHeadingText": {
      kind: "text",
      id: "n.evidenceHeadingText",
      content: { type: "literal", value: "Evidence" }
    },
    "n.evidenceList": {
      kind: "element",
      id: "n.evidenceList",
      tag: "ul",
      children: ["n.evidenceRepeat"]
    },
    "n.evidenceRepeat": {
      kind: "repeat",
      id: "n.evidenceRepeat",
      collection: { type: "ref", path: "view.evidence" },
      key: { type: "ref", path: "repeat.evidenceItem.label" },
      itemName: "evidenceItem",
      templateRoot: "n.evidenceViewer"
    },
    "n.evidenceViewer": {
      kind: "component",
      id: "n.evidenceViewer",
      definitionId: "ext.evidenceViewer",
      props: { label: { type: "ref", path: "repeat.evidenceItem.label" } }
    },
    "n.actions": {
      kind: "element",
      id: "n.actions",
      tag: "div",
      attributes: { role: "group", "aria-label": "Decision" },
      localStyle: [
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "gap", value: { type: "token", id: "space.md" } }
      ],
      children: ["n.approveButton", "n.activityHeading", "n.activityList"]
    },
    "n.approveButton": {
      kind: "element",
      id: "n.approveButton",
      tag: "button",
      attributes: { type: "button", "aria-label": "Approve inspection" },
      interactions: [
        {
          on: "click",
          action: "invokeAction",
          actionId: "inspection.approve",
          input: {
            id: { type: "ref", path: "record.id" },
            expectedDomainRevision: { type: "ref", path: "record.domainRevision" }
          }
        }
      ],
      children: ["n.approveLabel"]
    },
    "n.approveLabel": {
      kind: "text",
      id: "n.approveLabel",
      content: { type: "literal", value: "Approve inspection" }
    },
    "n.activityHeading": {
      kind: "element",
      id: "n.activityHeading",
      tag: "h2",
      children: ["n.activityHeadingText"]
    },
    "n.activityHeadingText": {
      kind: "text",
      id: "n.activityHeadingText",
      content: { type: "literal", value: "Activity" }
    },
    "n.activityList": {
      kind: "element",
      id: "n.activityList",
      tag: "ul",
      children: ["n.activityRepeat"]
    },
    "n.activityRepeat": {
      kind: "repeat",
      id: "n.activityRepeat",
      collection: { type: "ref", path: "view.activity" },
      key: { type: "ref", path: "repeat.activityItem.entry" },
      itemName: "activityItem",
      templateRoot: "n.activityItem"
    },
    "n.activityItem": {
      kind: "element",
      id: "n.activityItem",
      tag: "li",
      children: ["n.activityText"]
    },
    "n.activityText": {
      kind: "text",
      id: "n.activityText",
      content: {
        type: "expression",
        expression: {
          type: "op",
          name: "concat",
          args: [
            { type: "ref", path: "repeat.activityItem.actor" },
            { type: "literal", value: ": " },
            { type: "ref", path: "repeat.activityItem.entry" }
          ]
        }
      }
    }
  },
  componentDefinitions: {
    "def.findingCard": {
      id: "def.findingCard",
      revision: "1",
      root: "n.card",
      props: [
        { name: "severity", type: "string", default: "low" },
        { name: "description", type: "string", default: "" }
      ],
      slots: {},
      baseStyle: "ss.findingCard"
    }
  },
  styleSources: {
    "ss.detailLayout": {
      id: "ss.detailLayout",
      declarations: [
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "flex-direction", value: { type: "text", value: "column" } },
        { property: "gap", value: { type: "token", id: "space.lg" } },
        { property: "max-width", value: { type: "text", value: "960px" } }
      ]
    },
    "ss.detailNarrow": {
      id: "ss.detailNarrow",
      conditionId: "cond.narrow",
      declarations: [{ property: "max-width", value: { type: "text", value: "100%" } }]
    },
    "ss.columns": {
      id: "ss.columns",
      declarations: [
        { property: "display", value: { type: "text", value: "grid" } },
        { property: "grid-template-columns", value: { type: "text", value: "2fr 1fr" } },
        { property: "gap", value: { type: "token", id: "space.lg" } }
      ]
    },
    "ss.findingCard": {
      id: "ss.findingCard",
      declarations: [
        { property: "border", value: { type: "text", value: "1px solid #d9dde3" } },
        { property: "border-radius", value: { type: "token", id: "radius.md" } },
        { property: "padding", value: { type: "token", id: "space.md" } },
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "flex-direction", value: { type: "text", value: "column" } },
        { property: "gap", value: { type: "token", id: "space.xs" } }
      ]
    }
  },
  tokens: {
    "space.xs": { id: "space.xs", value: "4px" },
    "space.sm": { id: "space.sm", value: "8px" },
    "space.md": { id: "space.md", value: "16px" },
    "space.lg": { id: "space.lg", value: "24px" },
    "color.accent": { id: "color.accent", value: "#0a6c96" },
    "radius.md": { id: "radius.md", value: "8px" }
  },
  conditions: {
    "cond.narrow": { id: "cond.narrow", kind: "media", query: "(max-width: 700px)" }
  },
  assets: {},
  localState: {
    showDetails: { key: "showDetails", type: "boolean", initial: false }
  }
};
const evidenceViewerExtension = {
  id: "ext.evidenceViewer",
  revision: "1",
  props: [{ name: "label", type: "string", default: "" }],
  events: [],
  slots: [],
  styleTargets: [],
  rendererImplementationId: "impl.evidenceViewer.placeholder",
  inspectionLimits: ["image-refs render as labeled placeholders in U1-U3"]
};
const inspectionApplication = {
  schema: APPLICATION_DEFINITION_SCHEMA_V3,
  id: "app.inspection",
  revision: "1",
  name: "Inspection proof",
  routes: [
    { id: "queue", path: "/", screenId: "s.queue" },
    { id: "detail", path: "/inspections/:id", screenId: "s.detail" }
  ],
  screens: [
    {
      id: "s.queue",
      title: "Inspection queue",
      layout: [
        { name: "main", surfaces: [{ role: "text", id: "t.queue", content: "Inspection queue" }] }
      ]
    },
    {
      id: "s.detail",
      title: "Inspection detail",
      uiDocument: { documentId: "doc.inspection-detail", revision: "1" }
    }
  ],
  views: [
    {
      viewId: "v.inspections",
      resourceId: "inspection",
      resourceRevision: "1",
      fields: ["id", "title", "status", "domainRevision", "findings", "evidence", "activity"]
    },
    {
      viewId: "v.activity",
      resourceId: "activity",
      resourceRevision: "1",
      fields: ["entry", "actor"]
    }
  ],
  actions: [
    {
      kind: "query",
      id: "inspection.list",
      revision: "1",
      resourceId: "inspection",
      resourceRevision: "1",
      inputContractId: "c.unit",
      inputContractRevision: "1",
      outputContractId: "c.unit",
      outputContractRevision: "1"
    },
    {
      kind: "mutation",
      id: "inspection.approve",
      revision: "1",
      resourceId: "inspection",
      resourceRevision: "1",
      op: "approve",
      inputContractId: "c.unit",
      inputContractRevision: "1",
      outputContractId: "c.unit",
      outputContractRevision: "1"
    }
  ],
  resources: [
    { resourceId: "inspection", revision: "1" },
    { resourceId: "finding", revision: "1" },
    { resourceId: "evidence", revision: "1" },
    { resourceId: "activity", revision: "1" }
  ],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V3 }
};
let cached;
function inspectionPlan() {
  if (cached !== void 0) return cached;
  const result = compileApplication({
    application: inspectionApplication,
    resources: [inspectionResource, findingResource, evidenceResource, activityResource],
    contracts: [
      { id: "c.unit", revision: "1" },
      { id: "c.decision", revision: "1" }
    ],
    uiDocuments: [{ document: inspectionDetailDocument }],
    uiExtensions: [evidenceViewerExtension]
  });
  if (!result.ok) {
    throw new Error(
      `inspection application failed to compile: ${JSON.stringify({ issues: result.issues, ui: result.uiIssues }, null, 1)}`
    );
  }
  const detailKey = "doc.inspection-detail@1";
  const detailPlan = result.plan.documentPlans?.[detailKey];
  if (detailPlan === void 0) {
    throw new Error("the compiled plan carries no detail document plan");
  }
  cached = { plan: result.plan, detailPlan };
  return cached;
}

export { DocumentHost as D, inspectionDetailDocument as a, compileUiDocument as b, canonicalUiDocument as c, defaultSemanticElementCatalog as d, inspectionPlan as i, uiDiagnostic as u, validateUiDocument as v };
//# sourceMappingURL=compile-DzXXxGCi.js.map
