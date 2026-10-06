import { j as head, k as element, b as ensure_array_like, h as attr_class, i as clsx, c as attr, f as derived, l as attributes, e as escape_html } from './index.js-DY7Rze5x.js';

function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
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
const seen = /* @__PURE__ */ new Set();
function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}
function canonicalize(value, path = "(root)") {
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
      return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
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
        out[key] = canonicalize(item, `${path}.${key}`);
    }
    return out;
  } finally {
    seen.delete(value);
  }
}
function canonicalUiDocument(document) {
  const bytes = stableJson(document);
  return { bytes, contentDigest: sha256(bytes) };
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
      "step"
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
    attributes: ["name", "placeholder", "rows", "required", "disabled"],
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
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function registryOf(document, key) {
  const value = document[key];
  return isPlainObject(value) ? value : {};
}
function validateUiDocument(input, catalogs) {
  const issues = [];
  if (!isPlainObject(input)) {
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
    if (!isPlainObject(node) || !nonEmptyString(node.id)) {
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
    if (!isPlainObject(token) || !nonEmptyString(token.value)) {
      issues.push(uiDiagnostic("UI_EXPR_UNKNOWN_REFERENCE", `Token '${tokenId}' must declare a string value.`, {
        documentId,
        nodeId: document.root,
        path: `token.${tokenId}`
      }));
    }
  }
  for (const [sourceId, source] of Object.entries(styleSources)) {
    if (!isPlainObject(source))
      continue;
    for (const declaration of source.declarations ?? []) {
      validateStyleDeclaration(ctx, declaration, String(sourceId), String(document.root), tokens);
    }
  }
  for (const [conditionId, condition] of Object.entries(conditions)) {
    validateCondition(ctx, conditionId, condition);
  }
  for (const [key, decl] of Object.entries(localState)) {
    if (!isPlainObject(decl))
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
        issues.push(uiDiagnostic("UI_DOC_UNKNOWN_NODE", `Element '${node.tag}' is a leaf and cannot own children.`, {
          documentId,
          nodeId: node.children[0],
          missingChildId: node.children[0]
        }));
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
        if (propDecl === void 0) {
          issues.push(uiDiagnostic("UI_DOC_UNKNOWN_PROP", `Definition '${node.definitionId}' declares no prop '${propName}'.`, { documentId, nodeId: node.id, definitionId: node.definitionId, prop: propName }));
          continue;
        }
        if (expression.type === "literal") {
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
      for (const [slotName, declaredSlot] of Object.entries(definition.slots ?? {})) {
        if (declaredSlot.required !== true)
          continue;
        const fill = node.slots?.[slotName];
        if (fill === void 0 || fill.children.length === 0) {
          issues.push(uiDiagnostic("UI_DOC_REQUIRED_SLOT_MISSING", `Instance of '${node.definitionId}' leaves required slot '${slotName}' unfilled.`, { documentId, nodeId: node.id, definitionId: node.definitionId, slot: slotName }));
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
  if (!isPlainObject(condition)) {
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
  const docHash = sha256(documentId).slice(0, 8);
  const classFor = (nodeId) => `uv-${docHash}-${nodeId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const tokenDeclarations = Object.entries(document.tokens ?? {}).map(([tokenId, token]) => ({
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
    if (declarations === void 0 || declarations.length === 0)
      return void 0;
    let mediaConditionId;
    let containerConditionId;
    if (gating?.conditionId !== void 0) {
      const condition = (document.conditions ?? {})[gating.conditionId];
      if (condition === void 0) {
        issues.push(uiDiagnostic("UI_STYLE_CONDITION_UNKNOWN", `Unknown style condition '${gating.conditionId}'.`, {
          documentId,
          conditionId: gating.conditionId
        }));
        return void 0;
      }
      if (condition.kind === "media")
        mediaConditionId = condition.id;
      else if (condition.kind === "container")
        containerConditionId = condition.id;
      else {
        issues.push(uiDiagnostic("UI_DOC_UNSUPPORTED_FEATURE", `Style condition kind '\${condition.kind}' is unsupported; the conditioned rule is dropped (declared limitation).`, { documentId, feature: `condition:\${condition.kind}` }));
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
      selector: gating?.pseudo !== void 0 ? `\${selector}:\${gating.pseudo}` : selector,
      ...mediaConditionId !== void 0 ? { mediaConditionId } : {},
      ...containerConditionId !== void 0 ? { containerConditionId } : {},
      ...gating?.pseudo !== void 0 ? { pseudo: gating.pseudo } : {},
      declarations: compiled
    });
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
          const ruleId = compileStyleDeclarations(source?.declarations, `${classFor(nodeId)}-s\${styleRuleIds.length}`, "source", `.\${classFor(nodeId)}`, { conditionId: source?.conditionId, pseudo: source?.pseudo });
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
          inDefinition: true,
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
          classes: [classFor(nodeId)],
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
        issues.push(uiDiagnostic("UI_DOC_UNSUPPORTED_FEATURE", "Portal rendering is unsupported; its logical child ownership stays in occurrence provenance (U2-02).", {
          documentId,
          nodeId,
          feature: "portal"
        }));
        return {
          kind: "unsupported",
          nodeId,
          occurrenceKey: key,
          feature: "portal",
          children: node.children.map((childId) => (
            // Occurrence identity carries the portal ownership segment so a
            // node presented through a portal keeps its LOGICAL owner in
            // provenance even while the visual placement is unsupported.
            compileNode(childId, {
              inDefinition: scope.inDefinition,
              instancePath: [...scope.instancePath, `portal:${nodeId}:${node.target.overlayId}`]
            })
          ))
        };
    }
  };
  const structure = [
    compileNode(String(document.root), { inDefinition: false, instancePath: [] })
  ];
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
function uniqueRepeatKeys(keys, nodeId, reportDiagnostic) {
  const seen2 = /* @__PURE__ */ new Map();
  return keys.map((key) => {
    const count = seen2.get(key) ?? 0;
    seen2.set(key, count + 1);
    if (count === 0) return key;
    reportDiagnostic?.({
      code: "UI_RENDER_DUPLICATE_KEY",
      message: `Duplicate repeat key '${key}' in repeat '${nodeId}' — occurrence identity made unique (key#dup${count}).`,
      detail: { nodeId, key, duplicateIndex: count }
    });
    return `${key}#dup${count}`;
  });
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
const escapeCss = (selector) => {
  let out = "";
  for (let index = 0; index < selector.length; index += 1) {
    const ch = selector[index];
    const isSafe = ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch >= "0" && ch <= "9" || ch === "_" || ch === "-";
    const isLeadingDot = index === 0 && ch === ".";
    if (isSafe || isLeadingDot) {
      out += ch;
    } else {
      out += String.fromCharCode(92);
      out += ch;
    }
  }
  return out;
};
function styleRulesToCss(plan, rootClass) {
  const conditions = conditionsOf(plan);
  const layerOrder = plan.style.layers;
  const escapedRoot = escapeCss(rootClass);
  const sorted = [...plan.style.rules].sort(
    (a, b) => layerOrder.indexOf(a.layer) - layerOrder.indexOf(b.layer)
  );
  const mediaBuckets = /* @__PURE__ */ new Map();
  const containerBuckets = /* @__PURE__ */ new Map();
  const plain = [];
  for (const rule of sorted) {
    const lines = [];
    for (const declaration of rule.declarations) {
      if (declaration.value.type === "literal") {
        lines.push(`  ${declaration.property}: ${String(declaration.value.value)};`);
      } else if (declaration.value.type === "token") {
        lines.push(
          `  ${declaration.property}: var(--ui-token-${sanitizeTokenId(declaration.value.id)});`
        );
      }
    }
    const declarations = lines.join("\n");
    if (declarations === "") continue;
    const selector = rule.selector === ":root" ? `.${escapedRoot}` : `.${escapedRoot} ${escapeCss(rule.selector)}`;
    const css2 = `${selector} {
${declarations}
}`;
    if (rule.containerConditionId !== void 0) {
      const condition = conditions[rule.containerConditionId];
      if (condition?.kind === "container") {
        const bucket = containerBuckets.get(`${condition.name} ${condition.query}`) ?? [];
        bucket.push(css2);
        containerBuckets.set(`${condition.name} ${condition.query}`, bucket);
        continue;
      }
      plain.push(css2);
    } else if (rule.mediaConditionId !== void 0) {
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
  for (const [containerQuery, rules] of containerBuckets) {
    css += `

@container ${containerQuery} {
${rules.join("\n\n")}
}`;
  }
  return css;
}
function sanitizeTokenId(id) {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
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
      selectOccurrence,
      reportDiagnostic,
      extraClass
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
            class: clsx([
              ...instruction.classes,
              ...extraClass !== void 0 ? [extraClass] : []
            ].join(" ")),
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
              selectOccurrence,
              reportDiagnostic,
              extraClass: void 0
            });
          }
          $$renderer2.push(`<!--]-->`);
        }
      );
    } else if (instruction.kind === "text") {
      $$renderer2.push(`<!--[1--><span class="uv-text"${attr("data-ui-node", instruction.nodeId)}${attr("data-ui-occ", occ())} style="display: contents">`);
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
      $$renderer2.push(`<!--]--></span>`);
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
        selectOccurrence,
        extraClass: instruction.classes[0]
      });
    } else if (instruction.kind === "extension") {
      $$renderer2.push("<!--[3-->");
      const extensionProps = evaluatedComponentProps(instruction, scope);
      $$renderer2.push(`<div class="uv-extension-placeholder"${attr("data-ui-node", instruction.nodeId)}${attr("data-ui-occ", occ())}${attr("data-extension-id", instruction.extensionId)} role="img"${attr("aria-label", `Extension ${instruction.extensionId} (renderer pending in U1)`)}><span>Extension ${escape_html(instruction.extensionId)}</span> <pre>${escape_html(JSON.stringify(extensionProps))}</pre></div>`);
    } else if (instruction.kind === "repeat") {
      $$renderer2.push("<!--[4-->");
      const rows = resolveValue({ type: "expression", expression: instruction.collection }, scope);
      if (Array.isArray(rows)) {
        $$renderer2.push("<!--[0-->");
        const resolvedRowKeys = rows.map((row, index) => String(resolveValue({ type: "expression", expression: instruction.key }, {
          ...scope,
          repeatItem: { name: instruction.itemName, value: asRecord(row) }
        }) ?? index));
        const uniqueRowKeys = uniqueRepeatKeys(resolvedRowKeys, instruction.nodeId, reportDiagnostic);
        $$renderer2.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(rows);
        for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
          let row = each_array_1[index];
          const itemScope = {
            ...scope,
            repeatItem: { name: instruction.itemName, value: asRecord(row) }
          };
          RenderNode($$renderer2, {
            instruction: instruction.template,
            plan,
            scope: itemScope,
            instancePath,
            repeatKeys: [...repeatKeys, uniqueRowKeys[index]],
            slotFills,
            dispatch,
            navigate,
            setState,
            selectOccurrence,
            reportDiagnostic
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
          selectOccurrence,
          reportDiagnostic
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
            selectOccurrence,
            reportDiagnostic
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
            selectOccurrence,
            reportDiagnostic
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
          selectOccurrence,
          reportDiagnostic
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
      onRenderDiagnostic,
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
    head("1701yyw", $$renderer2, ($$renderer3) => {
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
              selectOccurrence,
              reportDiagnostic: onRenderDiagnostic
            });
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!---->`);
      }
    );
  });
}
const designCatalogs = {
  elements: defaultSemanticElementCatalog(),
  actionIds: ["design.submitContact"],
  routeIds: [],
  viewFields: {}
};
function readContactFields(container) {
  const read = (id) => container.querySelector(`#${CSS.escape(id)}`)?.value?.trim() ?? "";
  return {
    name: read("svc.fieldName"),
    email: read("svc.fieldEmail"),
    message: read("svc.fieldMessage")
  };
}
function validateContact(fields) {
  const issues = [];
  if (fields.name === "") issues.push({ field: "svc.fieldName", message: "Enter your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    issues.push({ field: "svc.fieldEmail", message: "Enter an email address in the name@example.org form." });
  }
  if (fields.message.length < 12) {
    issues.push({
      field: "svc.fieldMessage",
      message: "Tell us a little more — at least 12 characters."
    });
  }
  if (issues.length > 0) {
    return {
      status: "denied",
      heading: "The request was not sent yet:",
      issues
    };
  }
  return {
    status: "ok",
    heading: "Request sent (simulated).",
    detail: `Thanks ${fields.name} — this proof does not store anything, but a reply would reach ${fields.email} within two working days.`
  };
}
const SERVICE_STORE_KEY = "vict.u2.service.doc";
const DESIGN_STORE_FORMAT = "vict.design-store@1";
const SERVICE_SEED_REVISION = "1";
const serviceDocument = {
  schema: "vict.ui-document@1",
  id: "doc.northwind",
  revision: "1",
  root: "svc.root",
  tokens: {
    "color.accent": { id: "color.accent", value: "#1f6f54" },
    "color.accent-soft": { id: "color.accent-soft", value: "#e7f2ec" },
    "color.ink": { id: "color.ink", value: "#1c2a24" },
    "color.muted": { id: "color.muted", value: "#5c6b63" },
    "color.paper": { id: "color.paper", value: "#faf7f2" },
    "color.card": { id: "color.card", value: "#ffffff" },
    "color.line": { id: "color.line", value: "#d9d2c5" },
    "space.xs": { id: "space.xs", value: "4px" },
    "space.sm": { id: "space.sm", value: "8px" },
    "space.md": { id: "space.md", value: "16px" },
    "space.lg": { id: "space.lg", value: "32px" },
    "radius.md": { id: "radius.md", value: "10px" }
  },
  conditions: {
    "cond.narrow": { id: "cond.narrow", kind: "media", query: "(max-width: 700px)" },
    "cond.page": {
      id: "cond.page",
      kind: "container",
      name: "page-frame",
      query: "(min-width: 720px)"
    }
  },
  styleSources: {
    "src.page-base": {
      id: "src.page-base",
      declarations: [
        { property: "margin", value: { type: "text", value: "0 auto" } },
        { property: "max-width", value: { type: "text", value: "1080px" } },
        { property: "padding", value: { type: "text", value: "0 clamp(16px, 4vw, 40px) 96px" } },
        { property: "color", value: { type: "token", id: "color.ink" } },
        {
          property: "font-family",
          value: { type: "text", value: 'Georgia, "Times New Roman", serif' }
        },
        { property: "line-height", value: { type: "text", value: "1.6" } }
      ]
    },
    "src.hero-base": {
      id: "src.hero-base",
      declarations: [
        { property: "padding", value: { type: "text", value: "72px 0 24px" } },
        { property: "position", value: { type: "text", value: "relative" } }
      ]
    },
    "src.hero-title": {
      id: "src.hero-title",
      declarations: [
        { property: "font-size", value: { type: "text", value: "clamp(34px, 5vw, 56px)" } },
        { property: "margin", value: { type: "text", value: "0 0 12px" } },
        { property: "line-height", value: { type: "text", value: "1.1" } },
        { property: "letter-spacing", value: { type: "text", value: "-0.5px" } }
      ]
    },
    "src.hero-title-narrow": {
      id: "src.hero-title-narrow",
      declarations: [
        { property: "font-size", value: { type: "text", value: "30px" } },
        { property: "letter-spacing", value: { type: "text", value: "0" } }
      ],
      conditionId: "cond.narrow"
    },
    "src.hero-tag": {
      id: "src.hero-tag",
      declarations: [
        { property: "font-size", value: { type: "text", value: "19px" } },
        { property: "color", value: { type: "token", id: "color.muted" } },
        { property: "max-width", value: { type: "text", value: "56ch" } }
      ]
    },
    "src.overlap-wrap": {
      id: "src.overlap-wrap",
      declarations: [
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "justify-content", value: { type: "text", value: "flex-end" } }
      ]
    },
    "src.services-head": {
      id: "src.services-head",
      declarations: [
        { property: "font-size", value: { type: "text", value: "30px" } },
        { property: "margin", value: { type: "text", value: "56px 0 8px" } }
      ]
    },
    "src.grid": {
      id: "src.grid",
      declarations: [
        {
          property: "grid-template-columns",
          value: { type: "text", value: "repeat(3, minmax(0, 1fr))" }
        },
        { property: "gap", value: { type: "token", id: "space.md" } }
      ],
      conditionId: "cond.page"
    },
    "src.story-cols": {
      id: "src.story-cols",
      declarations: [
        { property: "display", value: { type: "text", value: "grid" } },
        {
          property: "grid-template-columns",
          value: { type: "text", value: "minmax(0, 1.6fr) minmax(240px, 1fr)" }
        },
        { property: "gap", value: { type: "token", id: "space.lg" } },
        { property: "margin-top", value: { type: "text", value: "56px" } }
      ],
      conditionId: "cond.page"
    },
    "src.story-copy": {
      id: "src.story-copy",
      declarations: [
        { property: "font-size", value: { type: "text", value: "17px" } },
        { property: "max-width", value: { type: "text", value: "62ch" } }
      ]
    },
    "src.sticky-aside": {
      id: "src.sticky-aside",
      declarations: [
        { property: "position", value: { type: "text", value: "sticky" } },
        { property: "top", value: { type: "text", value: "16px" } },
        { property: "align-self", value: { type: "text", value: "start" } }
      ],
      conditionId: "cond.page"
    },
    "src.contact-block": {
      id: "src.contact-block",
      declarations: [
        { property: "margin-top", value: { type: "text", value: "64px" } },
        { property: "padding", value: { type: "token", id: "space.lg" } },
        {
          property: "border",
          value: { type: "text", value: "1px solid var(--ui-token-color_line)" }
        },
        { property: "border-radius", value: { type: "token", id: "radius.md" } },
        { property: "background", value: { type: "token", id: "color.card" } }
      ]
    },
    "src.field-base": {
      id: "src.field-base",
      declarations: [
        { property: "display", value: { type: "text", value: "block" } },
        { property: "width", value: { type: "text", value: "100%" } },
        { property: "max-width", value: { type: "text", value: "420px" } },
        { property: "padding", value: { type: "text", value: "10px 12px" } },
        { property: "margin", value: { type: "text", value: "4px 0 14px" } },
        {
          property: "border",
          value: { type: "text", value: "1px solid var(--ui-token-color_line)" }
        },
        { property: "border-radius", value: { type: "text", value: "6px" } },
        { property: "font", value: { type: "text", value: "inherit" } }
      ]
    },
    "src.field-focus": {
      id: "src.field-focus",
      declarations: [
        {
          property: "outline",
          value: { type: "text", value: "2px solid var(--ui-token-color_accent)" }
        },
        { property: "outline-offset", value: { type: "text", value: "1px" } }
      ],
      pseudo: "focus"
    },
    "src.submit-base": {
      id: "src.submit-base",
      declarations: [
        { property: "background", value: { type: "token", id: "color.accent" } },
        { property: "color", value: { type: "text", value: "#ffffff" } },
        { property: "border", value: { type: "text", value: "none" } },
        { property: "border-radius", value: { type: "text", value: "6px" } },
        { property: "padding", value: { type: "text", value: "10px 20px" } },
        { property: "font", value: { type: "text", value: "inherit" } },
        { property: "cursor", value: { type: "text", value: "pointer" } }
      ]
    },
    "src.submit-hover": {
      id: "src.submit-hover",
      declarations: [{ property: "filter", value: { type: "text", value: "brightness(1.08)" } }],
      pseudo: "hover"
    },
    "src.label-base": {
      id: "src.label-base",
      declarations: [
        { property: "display", value: { type: "text", value: "block" } },
        { property: "font-weight", value: { type: "text", value: "bold" } },
        { property: "margin-top", value: { type: "text", value: "10px" } }
      ]
    },
    // Card definition sources (shared across every instance).
    "src.card-base": {
      id: "src.card-base",
      declarations: [
        { property: "background", value: { type: "token", id: "color.card" } },
        {
          property: "border",
          value: { type: "text", value: "1px solid var(--ui-token-color_line)" }
        },
        { property: "border-radius", value: { type: "token", id: "radius.md" } },
        { property: "padding", value: { type: "token", id: "space.md" } },
        { property: "display", value: { type: "text", value: "flex" } },
        { property: "flex-direction", value: { type: "text", value: "column" } },
        { property: "gap", value: { type: "text", value: "8px" } }
      ]
    },
    "src.card-hover": {
      id: "src.card-hover",
      declarations: [
        { property: "border-color", value: { type: "token", id: "color.accent" } },
        { property: "transform", value: { type: "text", value: "translateY(-1px)" } }
      ],
      pseudo: "hover"
    },
    "src.card-title": {
      id: "src.card-title",
      declarations: [
        { property: "margin", value: { type: "text", value: "0" } },
        { property: "font-size", value: { type: "text", value: "19px" } }
      ]
    },
    "src.card-body": {
      id: "src.card-body",
      declarations: [
        { property: "color", value: { type: "token", id: "color.muted" } },
        { property: "font-size", value: { type: "text", value: "15px" } }
      ]
    },
    "src.overlap-card": {
      id: "src.overlap-card",
      declarations: [
        { property: "margin-top", value: { type: "text", value: "-56px" } },
        { property: "width", value: { type: "text", value: "min(420px, 92%)" } },
        {
          property: "box-shadow",
          value: { type: "text", value: "0 10px 28px rgba(28, 42, 36, 0.16)" }
        }
      ]
    },
    "src.overlap-card-narrow": {
      id: "src.overlap-card-narrow",
      declarations: [{ property: "margin-top", value: { type: "text", value: "16px" } }],
      conditionId: "cond.narrow"
    },
    "src.accent-override": {
      id: "src.accent-override",
      declarations: [
        {
          property: "border-left",
          value: { type: "text", value: "4px solid var(--ui-token-color_accent)" }
        },
        { property: "background", value: { type: "token", id: "color.accent-soft" } }
      ]
    }
  },
  componentDefinitions: {
    "def.serviceCard": {
      id: "def.serviceCard",
      revision: "1",
      root: "svc.card",
      props: [],
      slots: { title: { required: true }, body: {} }
    }
  },
  nodes: {
    // Shared card definition body (stored once; instantiated four times).
    "svc.card": {
      kind: "element",
      id: "svc.card",
      tag: "article",
      styleSources: ["src.card-base", "src.card-hover"],
      children: ["svc.cardHeading", "svc.cardBodyWrap"]
    },
    "svc.cardHeading": {
      kind: "element",
      id: "svc.cardHeading",
      tag: "h3",
      styleSources: ["src.card-title"],
      children: ["svc.cardTitleSlot"]
    },
    "svc.cardTitleSlot": {
      kind: "slot",
      id: "svc.cardTitleSlot",
      name: "title",
      required: true
    },
    "svc.cardBodyWrap": {
      kind: "element",
      id: "svc.cardBodyWrap",
      tag: "div",
      styleSources: ["src.card-body"],
      children: ["svc.cardBodySlot"]
    },
    "svc.cardBodySlot": {
      kind: "slot",
      id: "svc.cardBodySlot",
      name: "body",
      fallback: ["svc.cardBodyFallback"]
    },
    "svc.cardBodyFallback": {
      kind: "text",
      id: "svc.cardBodyFallback",
      content: { type: "literal", value: "Talk to us about this during a survey." }
    },
    "svc.root": {
      kind: "element",
      id: "svc.root",
      tag: "main",
      attributes: { "data-page": "northwind-home" },
      styleSources: ["src.page-base"],
      children: ["svc.hero", "svc.overlapWrap", "svc.services", "svc.story", "svc.contact"]
    },
    "svc.hero": {
      kind: "element",
      id: "svc.hero",
      tag: "header",
      styleSources: ["src.hero-base"],
      children: ["svc.heroTitle", "svc.heroTag"]
    },
    "svc.heroTitle": {
      kind: "element",
      id: "svc.heroTitle",
      tag: "h1",
      styleSources: ["src.hero-title", "src.hero-title-narrow"],
      children: ["svc.heroTitleText"]
    },
    "svc.heroTitleText": {
      kind: "text",
      id: "svc.heroTitleText",
      content: { type: "literal", value: "Northwind Atelier" }
    },
    "svc.heroTag": {
      kind: "element",
      id: "svc.heroTag",
      tag: "p",
      styleSources: ["src.hero-tag"],
      children: ["svc.heroTagText"]
    },
    "svc.heroTagText": {
      kind: "text",
      id: "svc.heroTagText",
      content: {
        type: "literal",
        value: "Design-lead renovations for calm, durable homes — measured twice, built once, documented throughout."
      }
    },
    "svc.overlapWrap": {
      kind: "element",
      id: "svc.overlapWrap",
      tag: "div",
      styleSources: ["src.overlap-wrap"],
      children: ["svc.overlapCard"]
    },
    "svc.overlapCard": {
      kind: "component",
      id: "svc.overlapCard",
      definitionId: "def.serviceCard",
      styleSources: ["src.overlap-card", "src.overlap-card-narrow"],
      slots: {
        title: { name: "title", children: ["svc.overlapCardTitle"] },
        body: { name: "body", children: ["svc.overlapCardBody"] }
      }
    },
    "svc.overlapCardTitle": {
      kind: "text",
      id: "svc.overlapCardTitle",
      content: { type: "literal", value: "Spring survey week — two slots left" }
    },
    "svc.overlapCardBody": {
      kind: "text",
      id: "svc.overlapCardBody",
      content: {
        type: "literal",
        value: "Book a 90-minute atelier survey. You leave with a measured scope, a candid budget range, and a written condition report."
      }
    },
    "svc.services": {
      kind: "element",
      id: "svc.services",
      tag: "section",
      attributes: { "aria-labelledby": "svc.servicesHeading" },
      localStyle: [
        {
          property: "container-type",
          value: { type: "text", value: "inline-size" }
        },
        { property: "container-name", value: { type: "text", value: "page-frame" } }
      ],
      children: ["svc.servicesHeading", "svc.cardsGrid"]
    },
    "svc.servicesHeading": {
      kind: "element",
      id: "svc.servicesHeading",
      tag: "h2",
      styleSources: ["src.services-head"],
      children: ["svc.servicesHeadingText"]
    },
    "svc.servicesHeadingText": {
      kind: "text",
      id: "svc.servicesHeadingText",
      content: { type: "literal", value: "What we do" }
    },
    "svc.cardsGrid": {
      kind: "element",
      id: "svc.cardsGrid",
      tag: "div",
      styleSources: ["src.grid"],
      children: ["svc.cardKitchens", "svc.cardBathrooms", "svc.cardAdaptations"]
    },
    "svc.cardKitchens": {
      kind: "component",
      id: "svc.cardKitchens",
      definitionId: "def.serviceCard",
      slots: {
        title: { name: "title", children: ["svc.cardKitchensTitle"] },
        body: { name: "body", children: ["svc.cardKitchensBody"] }
      }
    },
    "svc.cardKitchensTitle": {
      kind: "text",
      id: "svc.cardKitchensTitle",
      content: { type: "literal", value: "Kitchens" }
    },
    "svc.cardKitchensBody": {
      kind: "text",
      id: "svc.cardKitchensBody",
      content: {
        type: "literal",
        value: "Rebuilt for how you actually cook: honest storage, quiet hardware, surfaces that survive a decade of Sundays."
      }
    },
    "svc.cardBathrooms": {
      kind: "component",
      id: "svc.cardBathrooms",
      definitionId: "def.serviceCard",
      slots: {
        title: { name: "title", children: ["svc.cardBathroomsTitle"] },
        body: { name: "body", children: ["svc.cardBathroomsBody"] }
      }
    },
    "svc.cardBathroomsTitle": {
      kind: "text",
      id: "svc.cardBathroomsTitle",
      content: { type: "literal", value: "Bathrooms" }
    },
    "svc.cardBathroomsBody": {
      kind: "text",
      id: "svc.cardBathroomsBody",
      content: {
        type: "literal",
        value: "Water where it should be, warmth where you want it. Accessible layouts designed in, never bolted on."
      }
    },
    // The intentional instance override: accent framing + tinted background.
    "svc.cardAdaptations": {
      kind: "component",
      id: "svc.cardAdaptations",
      definitionId: "def.serviceCard",
      styleSources: ["src.accent-override"],
      slots: {
        title: { name: "title", children: ["svc.cardAdaptationsTitle"] },
        body: { name: "body", children: ["svc.cardAdaptationsBody"] }
      }
    },
    "svc.cardAdaptationsTitle": {
      kind: "text",
      id: "svc.cardAdaptationsTitle",
      content: { type: "literal", value: "Adaptations" }
    },
    "svc.cardAdaptationsBody": {
      kind: "text",
      id: "svc.cardAdaptationsBody",
      content: {
        type: "literal",
        value: "Ageing-in-place retrofits with the same finishing standard as every other room — grab rails that look chosen, not added."
      }
    },
    "svc.story": {
      kind: "element",
      id: "svc.story",
      tag: "section",
      attributes: { "aria-labelledby": "svc.storyHeading" },
      styleSources: ["src.story-cols"],
      children: ["svc.storyMain", "svc.storyAside"]
    },
    "svc.storyMain": {
      kind: "element",
      id: "svc.storyMain",
      tag: "div",
      children: ["svc.storyHeading", "svc.storyCopyA", "svc.storyCopyB"]
    },
    "svc.storyHeading": {
      kind: "element",
      id: "svc.storyHeading",
      tag: "h2",
      styleSources: ["src.services-head"],
      children: ["svc.storyHeadingText"]
    },
    "svc.storyHeadingText": {
      kind: "text",
      id: "svc.storyHeadingText",
      content: { type: "literal", value: "How we work" }
    },
    "svc.storyCopyA": {
      kind: "element",
      id: "svc.storyCopyA",
      tag: "p",
      styleSources: ["src.story-copy"],
      children: ["svc.storyCopyAText"]
    },
    "svc.storyCopyAText": {
      kind: "text",
      id: "svc.storyCopyAText",
      content: {
        type: "literal",
        value: "Northwind began as a two-person carpentry workshop in 2011. We still keep one crew per project, one named lead, and a paper copy of every drawing on site — because decisions get made where the work happens."
      }
    },
    "svc.storyCopyB": {
      kind: "element",
      id: "svc.storyCopyB",
      tag: "p",
      styleSources: ["src.story-copy"],
      children: ["svc.storyCopyBText"]
    },
    "svc.storyCopyBText": {
      kind: "text",
      id: "svc.storyCopyBText",
      content: {
        type: "literal",
        value: "Surveys are candid. If a wall wants to stay standing, we say so; if a budget wants to stretch, we show you exactly where and why before a single cabinet is ordered."
      }
    },
    "svc.storyAside": {
      kind: "element",
      id: "svc.storyAside",
      tag: "aside",
      attributes: { "aria-label": "At a glance" },
      styleSources: ["src.sticky-aside"],
      children: ["svc.stickyCard"]
    },
    "svc.stickyCard": {
      kind: "component",
      id: "svc.stickyCard",
      definitionId: "def.serviceCard",
      slots: {
        title: { name: "title", children: ["svc.stickyCardTitle"] },
        body: { name: "body", children: ["svc.stickyCardBody"] }
      }
    },
    "svc.stickyCardTitle": {
      kind: "text",
      id: "svc.stickyCardTitle",
      content: { type: "literal", value: "Every project, documented" }
    },
    "svc.stickyCardBody": {
      kind: "text",
      id: "svc.stickyCardBody",
      content: {
        type: "literal",
        value: "Weekly photo logs, a live scope tracker, and one named lead from first sketch to final handover."
      }
    },
    "svc.contact": {
      kind: "element",
      id: "svc.contact",
      tag: "section",
      attributes: { "aria-labelledby": "svc.contactHeading" },
      styleSources: ["src.contact-block"],
      children: ["svc.contactHeading", "svc.contactIntro", "svc.form", "svc.formFeedbackNote"]
    },
    "svc.contactHeading": {
      kind: "element",
      id: "svc.contactHeading",
      tag: "h2",
      styleSources: ["src.services-head"],
      children: ["svc.contactHeadingText"]
    },
    "svc.contactHeadingText": {
      kind: "text",
      id: "svc.contactHeadingText",
      content: { type: "literal", value: "Request a quote" }
    },
    "svc.contactIntro": {
      kind: "element",
      id: "svc.contactIntro",
      tag: "p",
      styleSources: ["src.hero-tag"],
      children: ["svc.contactIntroText"]
    },
    "svc.contactIntroText": {
      kind: "text",
      id: "svc.contactIntroText",
      content: {
        type: "literal",
        value: "Tell us about your rooms and your timing. We answer within two working days with next steps — or an honest no."
      }
    },
    "svc.form": {
      kind: "element",
      id: "svc.form",
      tag: "form",
      attributes: { "aria-label": "Request a quote", novalidate: "novalidate" },
      interactions: [{ on: "submit", action: "invokeAction", actionId: "design.submitContact" }],
      children: [
        "svc.fieldNameLabel",
        "svc.fieldName",
        "svc.fieldEmailLabel",
        "svc.fieldEmail",
        "svc.fieldMessageLabel",
        "svc.fieldMessage",
        "svc.formRow"
      ]
    },
    "svc.fieldNameLabel": {
      kind: "element",
      id: "svc.fieldNameLabel",
      tag: "label",
      attributes: { for: "svc.fieldName" },
      styleSources: ["src.label-base"],
      children: ["svc.fieldNameLabelText"]
    },
    "svc.fieldNameLabelText": {
      kind: "text",
      id: "svc.fieldNameLabelText",
      content: { type: "literal", value: "Your name" }
    },
    "svc.fieldName": {
      kind: "element",
      id: "svc.fieldName",
      tag: "input",
      attributes: {
        type: "text",
        id: "svc.fieldName",
        name: "name",
        "aria-label": "Your name",
        "aria-describedby": "design-form-feedback",
        autocomplete: "name"
      },
      styleSources: ["src.field-base", "src.field-focus"],
      children: []
    },
    "svc.fieldEmailLabel": {
      kind: "element",
      id: "svc.fieldEmailLabel",
      tag: "label",
      attributes: { for: "svc.fieldEmail" },
      styleSources: ["src.label-base"],
      children: ["svc.fieldEmailLabelText"]
    },
    "svc.fieldEmailLabelText": {
      kind: "text",
      id: "svc.fieldEmailLabelText",
      content: { type: "literal", value: "Email address" }
    },
    "svc.fieldEmail": {
      kind: "element",
      id: "svc.fieldEmail",
      tag: "input",
      attributes: {
        type: "email",
        id: "svc.fieldEmail",
        name: "email",
        "aria-label": "Email address",
        "aria-describedby": "design-form-feedback",
        autocomplete: "email"
      },
      styleSources: ["src.field-base", "src.field-focus"],
      children: []
    },
    "svc.fieldMessageLabel": {
      kind: "element",
      id: "svc.fieldMessageLabel",
      tag: "label",
      attributes: { for: "svc.fieldMessage" },
      styleSources: ["src.label-base"],
      children: ["svc.fieldMessageLabelText"]
    },
    "svc.fieldMessageLabelText": {
      kind: "text",
      id: "svc.fieldMessageLabelText",
      content: { type: "literal", value: "What are you planning?" }
    },
    "svc.fieldMessage": {
      kind: "element",
      id: "svc.fieldMessage",
      tag: "textarea",
      attributes: {
        id: "svc.fieldMessage",
        name: "message",
        rows: "4",
        "aria-label": "What are you planning?",
        "aria-describedby": "design-form-feedback"
      },
      styleSources: ["src.field-base", "src.field-focus"],
      children: []
    },
    "svc.formRow": {
      kind: "element",
      id: "svc.formRow",
      tag: "div",
      children: ["svc.submitButton"]
    },
    "svc.submitButton": {
      kind: "element",
      id: "svc.submitButton",
      tag: "button",
      attributes: { type: "submit" },
      styleSources: ["src.submit-base", "src.submit-hover"],
      children: ["svc.submitLabel"]
    },
    "svc.submitLabel": {
      kind: "text",
      id: "svc.submitLabel",
      content: { type: "literal", value: "Send request" }
    },
    "svc.formFeedbackNote": {
      kind: "element",
      id: "svc.formFeedbackNote",
      tag: "p",
      styleSources: ["src.hero-tag"],
      children: ["svc.formFeedbackNoteText"]
    },
    "svc.formFeedbackNoteText": {
      kind: "text",
      id: "svc.formFeedbackNoteText",
      content: {
        type: "literal",
        value: "We use your details only to reply to this request. Nothing is stored on this page between visits unless you save your edits."
      }
    }
  }
};

export { DocumentHost as D, SERVICE_STORE_KEY as S, SERVICE_SEED_REVISION as a, canonicalUiDocument as b, compileUiDocument as c, designCatalogs as d, DESIGN_STORE_FORMAT as e, defaultSemanticElementCatalog as f, validateUiDocument as g, readContactFields as r, serviceDocument as s, uiDiagnostic as u, validateContact as v };
//# sourceMappingURL=service-document-qhvxONqo.js.map
