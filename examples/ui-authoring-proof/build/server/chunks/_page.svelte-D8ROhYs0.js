import { h as head, e as escape_html, c as attr, b as ensure_array_like, f as attr_class, j as clsx, i as derived } from './index.js-BVAQDQEm.js';
import { i as inspectionPlan, a as inspectionDetailDocument, c as canonicalUiDocument, D as DocumentHost, b as compileUiDocument, d as defaultSemanticElementCatalog, u as uiDiagnostic, v as validateUiDocument } from './compile-DzXXxGCi.js';

function cloneDocument(document) {
  return JSON.parse(JSON.stringify(document));
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function applyUiEdit(snapshot, transaction, catalogs) {
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
      issues: [uiDiagnostic("UI_EDIT_VALIDATION_FAILED", "A transaction needs at least one command.", { commandIndex: 0, diagnostics: [] })]
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
      issues.push(uiDiagnostic("UI_EDIT_VALIDATION_FAILED", message, { commandIndex, diagnostics }));
    };
    switch (command.op) {
      case "insert": {
        const parent = doc.nodes[command.parentId];
        if (parent === void 0) {
          fail(`Insert parent '${command.parentId}' does not exist.`);
          return;
        }
        if (parent.kind !== "element" && parent.kind !== "portal") {
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
        const children = [...parent.children];
        const index = command.index ?? children.length;
        if (index < 0 || index > children.length) {
          fail(`Insert index ${String(command.index)} out of range.`);
          return;
        }
        children.splice(index, 0, node.id);
        doc.nodes[node.id] = node;
        const updatedParent = parent.kind === "element" ? { ...parent, children } : { ...parent, children };
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
        if (newParent.kind !== "element" && newParent.kind !== "portal") {
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
        const children = [...newParent.children];
        const index = command.index ?? children.length;
        if (index < 0 || index > children.length) {
          fail(`Move index ${String(command.index)} out of range.`);
          return;
        }
        children.splice(index, 0, command.nodeId);
        const updatedTarget = newParent.kind === "element" ? { ...newParent, children } : { ...newParent, children };
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
        const remaining = collectReferences(doc, command.nodeId);
        if (remaining.length > 0) {
          fail(`Node '${command.nodeId}' is still referenced.`, [
            uiDiagnostic("UI_EDIT_REFERENCE_REMAINS", `Node '${command.nodeId}' is still referenced.`, {
              nodeId: command.nodeId,
              remainingRefs: remaining
            })
          ]);
          return;
        }
        detach(doc.nodes, command.nodeId);
        for (const ownedId of collectNodeSubtree(doc.nodes, command.nodeId)) {
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
        if (command.value === void 0)
          delete attributes[command.name];
        else
          attributes[command.name] = command.value;
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
        const existingIndex = localStyle.findIndex((declaration) => declaration.property === command.property);
        if (command.value === void 0) {
          if (existingIndex >= 0)
            localStyle.splice(existingIndex, 1);
        } else if (existingIndex >= 0) {
          localStyle[existingIndex] = { property: command.property, value: command.value };
        } else {
          localStyle.push({ property: command.property, value: command.value });
        }
        doc.nodes[node.id] = { ...node, localStyle };
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
          if (command.expression === void 0)
            delete attributes[command.target.name];
          else
            attributes[command.target.name] = command.expression;
          doc.nodes[node.id] = { ...node, attributes };
          return;
        }
        if (node.kind !== "component") {
          fail("prop binding requires a component node.");
          return;
        }
        const props = { ...node.props ?? {} };
        if (command.expression === void 0)
          delete props[command.target.name];
        else
          props[command.target.name] = command.expression;
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
        const filtered = interactions.filter((candidate) => candidate.on !== command.interaction?.on);
        filtered.push(command.interaction);
        doc.nodes[node.id] = { ...node, interactions: filtered };
        return;
      }
      case "createComponentDefinition": {
        const definition = command.definition;
        if (!isPlainObject(definition) || typeof definition.id !== "string" || typeof definition.revision !== "string" || typeof definition.root !== "string" || doc.nodes[definition.root] === void 0) {
          fail("createComponentDefinition needs a definition with an id, revision and an existing root.");
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
      default:
        fail("Unknown command.");
    }
  });
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  const validation = validateUiDocument(working, catalogs ?? emptyCatalogs()).filter((issue) => !isDeferredProductReference(issue));
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
  return { ok: true, document: working, revision: snapshot.revision, requestId: transaction.requestId };
}
function isDeferredProductReference(issue) {
  if (issue.code === "UI_DOC_UNKNOWN_PRODUCT_REFERENCE")
    return true;
  if (issue.code === "UI_DOC_UNKNOWN_COMPONENT")
    return true;
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
  return collectNodeSubtree(nodes, ancestorId).has(maybeDescendantId);
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
      if (changed)
        nodes[node.id] = { ...node, branches };
    } else if (node.kind === "component" && node.slots !== void 0) {
      let changed = false;
      const slots = {};
      for (const [name, fill] of Object.entries(node.slots)) {
        if (fill.children.includes(nodeId)) {
          changed = true;
          slots[name] = { name: fill.name, children: fill.children.filter((child) => child !== nodeId) };
        } else {
          slots[name] = fill;
        }
      }
      if (changed)
        nodes[node.id] = { ...node, slots };
    }
  }
}
function collectReferences(doc, nodeId) {
  const refs = [];
  for (const node of Object.values(doc.nodes)) {
    if (node.id === nodeId)
      continue;
    if (node.kind === "element" || node.kind === "portal") {
      if (node.children.includes(nodeId))
        refs.push(`${node.id}.children`);
    } else if (node.kind === "repeat") {
      if (node.templateRoot === nodeId)
        refs.push(`${node.id}.templateRoot`);
    } else if (node.kind === "slot") {
      if ((node.fallback ?? []).includes(nodeId))
        refs.push(`${node.id}.fallback`);
    } else if (node.kind === "conditional") {
      node.branches.forEach((branch, index) => {
        if (branch.children.includes(nodeId))
          refs.push(`${node.id}.branches.${index}`);
      });
    } else if (node.kind === "component" && node.slots !== void 0) {
      for (const [name, fill] of Object.entries(node.slots)) {
        if (fill.children.includes(nodeId))
          refs.push(`${node.id}.slots.${name}`);
      }
    }
  }
  for (const definition of Object.values(doc.componentDefinitions)) {
    if (definition.root === nodeId)
      refs.push(`${definition.id}.root`);
    for (const [slotName, slot] of Object.entries(definition.slots ?? {})) {
      if ((slot.fallback ?? []).includes(nodeId))
        refs.push(`${definition.id}.slots.${slotName}.fallback`);
    }
  }
  return refs;
}
function collectNodeSubtree(nodes, rootId) {
  const into = /* @__PURE__ */ new Set();
  const stack = [rootId];
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
    else if (node.kind === "repeat")
      stack.push(node.templateRoot);
    else if (node.kind === "slot")
      stack.push(...node.fallback ?? []);
    else if (node.kind === "conditional")
      node.branches.forEach((branch) => stack.push(...branch.children));
    else if (node.kind === "component" && node.slots !== void 0) {
      for (const fill of Object.values(node.slots))
        stack.push(...fill.children);
    }
  }
  return into;
}
class UiEditSession {
  #working;
  #storedRevision;
  #storedDocument;
  #undoStack = [];
  #redoStack = [];
  #idempotency = /* @__PURE__ */ new Map();
  #sequence = 0;
  #catalogs;
  constructor(snapshot, storedDocument, storedRevision, catalogs) {
    this.#working = snapshot;
    this.#storedRevision = storedRevision;
    this.#storedDocument = storedDocument;
    this.#catalogs = catalogs;
  }
  /** Open a session over a stored document + its stored revision. */
  static open(input) {
    const document = input.document;
    return new UiEditSession({ document, revision: `${input.storedRevision}#0` }, cloneDocument(document), input.storedRevision, input.catalogs ?? {
      elements: defaultSemanticElementCatalog(),
      // Product references are the JOINT compiler's obligation (API-SPEC
      // §2.2 rule 4): an unconfigured session does not fail transactions
      // over them.
      actionIds: void 0,
      routeIds: void 0
    });
  }
  /** Convenience alias matching the proposed session API name. */
  static loadSnapshot(input) {
    return UiEditSession.open(input);
  }
  get workingRevision() {
    return this.#working.revision;
  }
  get document() {
    return this.#working.document;
  }
  get storedRevision() {
    return this.#storedRevision;
  }
  isDirty() {
    return canonicalUiDocument(this.#working.document).contentDigest !== canonicalUiDocument(this.#storedDocument).contentDigest;
  }
  canUndo() {
    return this.#undoStack.length > 0;
  }
  canRedo() {
    return this.#redoStack.length > 0;
  }
  /** Apply one transaction (idempotent per requestId within this session). */
  applyTransaction(transaction) {
    const recorded = this.#idempotency.get(transaction.requestId);
    if (recorded !== void 0) {
      const fingerprint = fingerprintOf(transaction);
      if (recorded.fingerprint === fingerprint) {
        if (this.#working.revision === recorded.revision) {
          this.#working = { document: recorded.document, revision: recorded.revision };
          return { ok: true, revision: recorded.revision, requestId: transaction.requestId };
        }
        return {
          ok: false,
          issues: [
            uiDiagnostic("UI_EDIT_REQUEST_CONFLICT", "Replayed request no longer applies to the current revision.", {
              requestId: transaction.requestId
            })
          ]
        };
      }
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_EDIT_REQUEST_CONFLICT", "requestId reuse with a different payload.", {
            requestId: transaction.requestId
          })
        ]
      };
    }
    const result = applyUiEdit(this.#working, transaction, this.#catalogs);
    if (!result.ok) {
      return { ok: false, issues: result.issues };
    }
    const before = this.#working.document;
    this.#sequence += 1;
    const nextRevision = `${this.#storedRevision}#${this.#sequence}`;
    this.#working = { document: result.document, revision: nextRevision };
    this.#undoStack = [
      ...this.#undoStack,
      { requestId: transaction.requestId, before, after: result.document }
    ];
    this.#redoStack = [];
    this.#idempotency.set(transaction.requestId, {
      fingerprint: fingerprintOf(transaction),
      document: result.document,
      revision: nextRevision
    });
    return { ok: true, revision: nextRevision, requestId: transaction.requestId };
  }
  /** Undo the last accepted transaction. */
  undo() {
    const entry = this.#undoStack[this.#undoStack.length - 1];
    if (entry === void 0) {
      return { ok: false, issues: [uiDiagnostic("UI_EDIT_UNDO_CONFLICT", "Nothing to undo.", { expectedRevision: this.#working.revision, currentRevision: this.#working.revision })] };
    }
    if (this.#working.document !== entry.after) {
      const currentDigest = canonicalUiDocument(this.#working.document).contentDigest;
      const afterDigest = canonicalUiDocument(entry.after).contentDigest;
      if (currentDigest !== afterDigest) {
        return {
          ok: false,
          issues: [
            uiDiagnostic("UI_EDIT_UNDO_CONFLICT", "Current source diverged from the undo point.", {
              expectedRevision: entry.after ? this.#working.revision : this.#working.revision,
              currentRevision: this.#working.revision
            })
          ]
        };
      }
    }
    this.#undoStack = this.#undoStack.slice(0, -1);
    this.#redoStack = [...this.#redoStack, entry];
    this.#sequence += 1;
    this.#working = { document: entry.before, revision: `${this.#storedRevision}#${this.#sequence}` };
    return { ok: true, revision: this.#working.revision, requestId: `undo:${entry.requestId}` };
  }
  /** Redo the most recently undone transaction. */
  redo() {
    const entry = this.#redoStack[this.#redoStack.length - 1];
    if (entry === void 0) {
      return { ok: false, issues: [uiDiagnostic("UI_EDIT_UNDO_CONFLICT", "Nothing to redo.", { expectedRevision: this.#working.revision, currentRevision: this.#working.revision })] };
    }
    const currentDigest = canonicalUiDocument(this.#working.document).contentDigest;
    const beforeDigest = canonicalUiDocument(entry.before).contentDigest;
    if (this.#working.document !== entry.before && currentDigest !== beforeDigest) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_EDIT_UNDO_CONFLICT", "Current source diverged from the redo point.", {
            expectedRevision: this.#working.revision,
            currentRevision: this.#working.revision
          })
        ]
      };
    }
    this.#redoStack = this.#redoStack.slice(0, -1);
    this.#undoStack = [...this.#undoStack, entry];
    this.#sequence += 1;
    this.#working = { document: entry.after, revision: `${this.#storedRevision}#${this.#sequence}` };
    return { ok: true, revision: this.#working.revision, requestId: `redo:${entry.requestId}` };
  }
  /**
   * Save with the expected-stored-revision guard. Advances the stored
   * revision deterministically (numeric revisions increment; otherwise a
   * `.r1`, `.r2`, … suffix is appended) and stamps the saved document's own
   * `revision` field so catalog pins can address exactly these bytes.
   */
  save(input) {
    if (input.expectedStoredRevision !== this.#storedRevision) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_DOC_STALE_REVISION", "Save rejected: the stored revision moved.", {
            expectedRevision: input.expectedStoredRevision,
            storedRevision: this.#storedRevision
          })
        ]
      };
    }
    const nextStored = advanceStoredRevision(this.#storedRevision);
    const saved = { ...this.#working.document, revision: nextStored };
    this.#storedRevision = nextStored;
    this.#storedDocument = cloneDocument(saved);
    this.#working = { document: saved, revision: `${nextStored}#${this.#sequence + 1}` };
    this.#sequence += 1;
    return {
      ok: true,
      storedRevision: nextStored,
      document: saved,
      contentDigest: canonicalUiDocument(saved).contentDigest
    };
  }
  /** Reopen a fresh session over stored bytes (history cleared). */
  reopen(input) {
    return UiEditSession.open(input);
  }
  /** Structural snapshot for inspector surfaces. */
  state() {
    return {
      working: this.#working,
      storedRevision: this.#storedRevision,
      storedDocument: this.#storedDocument,
      dirty: this.isDirty(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }
}
function fingerprintOf(transaction) {
  return canonicalUiDocument({
    expectedDocumentRevision: transaction.expectedDocumentRevision,
    reason: transaction.reason,
    commands: transaction.commands
  }).contentDigest;
}
function advanceStoredRevision(storedRevision) {
  if (/^\d+$/.test(storedRevision))
    return String(Number(storedRevision) + 1);
  const match = /\.r(\d+)$/.exec(storedRevision);
  if (match !== null) {
    return `${storedRevision.slice(0, -match[0].length)}.r${Number(match[1]) + 1}`;
  }
  return `${storedRevision}.r1`;
}
function EditorCanvas($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      document,
      catalogs,
      extensions = [],
      localState = {},
      view = {},
      record = {},
      selectedOccurrence,
      onSelect,
      dispatch,
      navigate,
      ariaLabel = "Document canvas"
    } = $$props;
    const effectiveCatalogs = derived(() => catalogs ?? {
      elements: defaultSemanticElementCatalog(),
      actionIds: [],
      routeIds: []
    });
    const compiled = derived(() => {
      return compileUiDocument(document, effectiveCatalogs().elements, extensions, {
        ...effectiveCatalogs().actionIds !== void 0 ? { actionIds: effectiveCatalogs().actionIds } : {},
        ...effectiveCatalogs().routeIds !== void 0 ? { routeIds: effectiveCatalogs().routeIds } : {},
        ...effectiveCatalogs().viewFields !== void 0 ? { viewFields: effectiveCatalogs().viewFields } : {}
      });
    });
    function handleSelect(occurrence) {
      onSelect(occurrence);
    }
    const canvasClasses = derived(() => selectedOccurrence !== void 0 ? "uv-canvas uv-canvas-has-selection" : "uv-canvas");
    if (compiled().ok) {
      $$renderer2.push(`<!--[0--><div${attr_class(clsx(canvasClasses()))}>`);
      $$renderer2.push(`<style>
      .uv-canvas [data-ui-occ]:hover {
        outline: 1px dashed var(--ui-editor-hover, #7aa7ff);
        cursor: pointer;
      }
    </style>`);
      $$renderer2.push(` `);
      if (selectedOccurrence !== void 0) {
        $$renderer2.push(`<!--[0--><style>
        .uv-canvas [data-ui-occ='{escapeSelector(selectedOccurrence)}'] {
          outline: 2px solid var(--ui-editor-selected, #2b6cff);
          outline-offset: 1px;
        }
      </style>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      DocumentHost($$renderer2, {
        plan: compiled().plan,
        view,
        record,
        localState,
        dispatch,
        navigate,
        selectOccurrence: handleSelect,
        ariaLabel
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><div class="uv-canvas-error" role="alert">The working document does not compile: <ul><!--[-->`);
      const each_array = ensure_array_like(compiled().issues);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let issue = each_array[$$index];
        $$renderer2.push(`<li>${escape_html(issue.code)}: ${escape_html(issue.message)}</li>`);
      }
      $$renderer2.push(`<!--]--></ul></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function HistoryPanel($$renderer, $$props) {
  let {
    revision,
    storedRevision,
    dirty,
    canUndo,
    canRedo
  } = $$props;
  $$renderer.push(`<section class="uv-history" aria-label="History"><h2>History</h2> <p>Working <code>${escape_html(revision)}</code> · stored <code>${escape_html(storedRevision)}</code> `);
  if (dirty) {
    $$renderer.push(`<!--[0--><strong>(unsaved)</strong>`);
  } else {
    $$renderer.push(`<!--[-1--><span>(saved)</span>`);
  }
  $$renderer.push(`<!--]--></p> <div class="uv-history-actions"><button type="button"${attr("disabled", !canUndo, true)} aria-label="Undo">Undo</button> <button type="button"${attr("disabled", !canRedo, true)} aria-label="Redo">Redo</button> <button type="button"${attr("disabled", !dirty, true)} aria-label="Save">Save</button> <button type="button" aria-label="Reload stored document">Reload stored</button></div></section>`);
}
function resolveOccurrence(occurrenceKey, document) {
  const parts = occurrenceKey.split("|");
  const documentId = parts[0] ?? "";
  const sourceNodeId = parts[1] ?? "";
  const rest = parts.slice(2);
  const instanceSegments = rest.filter((segment) => segment.includes("@"));
  const repeatKeys = rest.filter((segment) => !segment.includes("@"));
  const firstInstance = instanceSegments[0] ?? "";
  const owningDefinitionId = firstInstance === "" ? void 0 : firstInstance.split("@")[1] ?? void 0;
  const nodes = document.nodes ?? {};
  return {
    sourceNodeId,
    owningDefinitionId,
    repeatKeys,
    node: documentId === String(document.id) ? nodes[sourceNodeId] : void 0
  };
}
function Inspector($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      document,
      selectedOccurrence,
      lastIssues = [],
      knownActionIds = [],
      knownRouteIds = []
    } = $$props;
    let textValue = "";
    let styleProperty = "color";
    let styleValue = "";
    let useToken = false;
    let attributeName = "data-note";
    let attributeValue = "";
    let actionId = "";
    const report = derived(() => selectedOccurrence !== void 0 ? resolveOccurrence(selectedOccurrence, document) : void 0);
    const node = derived(() => report()?.node);
    const nodeKind = derived(() => node()?.kind);
    $$renderer2.push(`<aside class="uv-inspector" aria-label="Inspector"><h2>Inspector</h2> `);
    if (report() === void 0 || node() === void 0) {
      $$renderer2.push(`<!--[0--><p>Select an element in the canvas to inspect its source.</p>`);
    } else {
      $$renderer2.push(`<!--[-1--><dl><dt>Source node</dt> <dd><code>${escape_html(report().sourceNodeId)}</code></dd> <dt>Kind</dt> <dd>${escape_html(nodeKind())}</dd> `);
      if (report().owningDefinitionId !== void 0) {
        $$renderer2.push(`<!--[0--><dt>Definition</dt> <dd><code>${escape_html(report().owningDefinitionId)}</code> (instance)</dd>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (report().repeatKeys.length > 0) {
        $$renderer2.push(`<!--[0--><dt>Record keys</dt> <dd>${escape_html(report().repeatKeys.join(", "))}</dd>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></dl> `);
      if (nodeKind() === "text") {
        $$renderer2.push(`<!--[0--><label>Text <input type="text"${attr("value", textValue)} aria-label="Text content"/></label> <button type="button">Apply text</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (nodeKind() === "element" || nodeKind() === "component") {
        $$renderer2.push(`<!--[0--><fieldset><legend>Style declaration (instance-local)</legend> <label>Property <input type="text"${attr("value", styleProperty)} aria-label="Style property"/></label> <label><input type="checkbox"${attr("checked", useToken, true)}/> Token value</label> `);
        {
          $$renderer2.push(`<!--[-1--><label>Value <input type="text"${attr("value", styleValue)} aria-label="Style value"/></label>`);
        }
        $$renderer2.push(`<!--]--> <button type="button">Apply style</button></fieldset> `);
        if (nodeKind() === "element") {
          $$renderer2.push(`<!--[0--><fieldset><legend>Attribute</legend> <label>Name <input type="text"${attr("value", attributeName)} aria-label="Attribute name"/></label> <label>Value <input type="text"${attr("value", attributeValue)} aria-label="Attribute value"/></label> <button type="button">Set attribute</button></fieldset> <fieldset><legend>Interaction (click)</legend> <label>Action id <input type="text"${attr("value", actionId)} list="uv-known-actions" aria-label="Action id"/></label> <datalist id="uv-known-actions"><!--[-->`);
          const each_array_1 = ensure_array_like(knownActionIds);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let known = each_array_1[$$index_1];
            $$renderer2.option({ value: known }, ($$renderer3) => {
              $$renderer3.push(`${escape_html(known)}`);
            });
          }
          $$renderer2.push(`<!--]--></datalist> <button type="button">Connect action</button> `);
          if (knownRouteIds.length > 0) {
            $$renderer2.push(`<!--[0--><label>Navigate to route `);
            $$renderer2.select({ value: actionId, "aria-label": "Route id" }, ($$renderer3) => {
              $$renderer3.push(`<!--[-->`);
              const each_array_2 = ensure_array_like(knownRouteIds);
              for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                let routeId = each_array_2[$$index_2];
                $$renderer3.option({ value: routeId }, ($$renderer4) => {
                  $$renderer4.push(`${escape_html(routeId)}`);
                });
              }
              $$renderer3.push(`<!--]-->`);
            });
            $$renderer2.push(`</label> <button type="button">Connect navigation</button>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></fieldset>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    if (lastIssues.length > 0) {
      $$renderer2.push(`<!--[0--><div class="uv-inspector-issues" role="alert">Last change rejected (source unchanged): <ul><!--[-->`);
      const each_array_3 = ensure_array_like(lastIssues);
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let issue = each_array_3[$$index_3];
        $$renderer2.push(`<li>${escape_html(issue.code)}: ${escape_html(issue.message)}</li>`);
      }
      $$renderer2.push(`<!--]--></ul></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></aside>`);
  });
}
class EditorBridge {
  #session;
  #store;
  #selectedOccurrence = void 0;
  #listeners = /* @__PURE__ */ new Set();
  constructor(input) {
    this.#session = UiEditSession.open(input.initial);
    this.#store = input.store;
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
    contentDigest: canonicalUiDocument(this.#session.document).contentDigest
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
    const outcome = this.#session.applyTransaction({
      requestId: draft.requestId,
      expectedDocumentRevision: this.#session.workingRevision,
      ...draft.reason !== void 0 ? { reason: draft.reason } : {},
      commands: draft.commands
    });
    this.#emit();
    return outcome;
  }
  undo() {
    const outcome = this.#session.undo();
    this.#emit();
    return outcome;
  }
  redo() {
    const outcome = this.#session.redo();
    this.#emit();
    return outcome;
  }
  /** Expected-revision save through the host's store port. */
  save() {
    const result = this.#session.save({ expectedStoredRevision: this.#session.storedRevision });
    if (!result.ok) return result;
    const persisted = this.#store.save({
      document: result.document,
      newStoredRevision: result.storedRevision
    });
    if (!persisted.ok) {
      return { ok: false, issues: [{ code: "UI_DOC_STALE_REVISION", message: persisted.reason }] };
    }
    this.#emit();
    return result;
  }
  /** Reload from the store: a FRESH session over stored bytes (history cleared). */
  reopen() {
    const stored = this.#store.load();
    if (stored === void 0) return false;
    this.#session = this.#session.reopen({
      document: stored.document,
      storedRevision: stored.storedRevision
    });
    this.#selectedOccurrence = void 0;
    this.#emit();
    return true;
  }
}
let sessionCounter = 0;
class PreviewSession {
  id;
  scenario;
  actor;
  coverage;
  #runtime;
  #onStale;
  #delay;
  #state;
  #stale = false;
  constructor(options) {
    sessionCounter += 1;
    this.id = `preview-session-${sessionCounter}`;
    this.scenario = options.scenario;
    this.actor = options.actorId ? options.scenario.actors.find((actor) => actor.actorId === options.actorId) ?? options.scenario.actors[0] : options.scenario.actors[0];
    this.#runtime = options.runtime;
    this.#onStale = options.onStale;
    this.#delay = options.delay ?? ((ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    }));
    this.#state = this.freshState();
    this.coverage = this.computeCoverage();
  }
  #freshToken() {
    return Symbol(this.id);
  }
  freshState() {
    const rows = /* @__PURE__ */ new Map();
    for (const [resourceId, seeded] of Object.entries(this.scenario.seeds.domain.rows)) {
      rows.set(resourceId, seeded.map((row) => ({ ...row })));
    }
    return { token: this.#freshToken(), rows };
  }
  computeCoverage() {
    return this.scenario.operations.map((operation) => {
      if (operation.implementation === "unavailable") {
        return { op: operation.op, implementation: operation.implementation, available: false, reason: "declared unavailable" };
      }
      const isCapability = !operation.op.includes(":");
      if (isCapability) {
        const registered = this.#runtime?.snapshotDoubles().has(operation.op) ?? false;
        return {
          op: operation.op,
          implementation: operation.implementation,
          available: registered,
          reason: registered ? "registered double" : "no registered double"
        };
      }
      return { op: operation.op, implementation: operation.implementation, available: true, reason: "simulated adapter" };
    });
  }
  /** Diagnostics for every declared-but-unavailable operation. */
  coverageDiagnostics() {
    return this.coverage.filter((entry) => !entry.available).map((entry) => uiDiagnostic("SCENARIO_COVERAGE_MISSING", `Operation '${entry.op}' has no implementation in this scenario.`, {
      op: entry.op,
      implementation: "unavailable"
    }));
  }
  /** True while this session is the current one (not reset). */
  get isLive() {
    return !this.#stale;
  }
  /** Current fencing token (opaque). */
  get token() {
    return this.#state.token;
  }
  /** Seeded rows snapshot (read-only view for dependent views). */
  rows(resourceId) {
    return this.#state.rows.get(resourceId) ?? [];
  }
  /**
   * Run one declared scenario operation. `op` is either a capability id
   * (registered double, per the runtime port) or `resourceId:dataOp` for
   * data operations through the simulated adapter.
   */
  async run(op, input) {
    const token = this.#state.token;
    const operation = this.scenario.operations.find((candidate) => candidate.op === op);
    if (operation === void 0 || operation.implementation === "unavailable") {
      return {
        ok: false,
        sessionId: this.id,
        code: "SCENARIO_COVERAGE_MISSING",
        message: `Operation '${op}' is not implemented in this scenario; nothing ran.`,
        diagnostic: uiDiagnostic("SCENARIO_COVERAGE_MISSING", `Operation '${op}' has no implementation.`, {
          op,
          implementation: "unavailable"
        })
      };
    }
    if (!operation.op.includes(":")) {
      const permissionRoot = operation.op;
      const opRoot = permissionRoot.split(".").slice(0, 2).join(".");
      const permitted = this.actor.permissions.includes("*") || this.actor.permissions.includes(permissionRoot) || this.actor.permissions.some((permission) => {
        const segments = permission.split(".");
        const tail = segments.slice(-2).join(".");
        return tail === opRoot || permission === permissionRoot;
      });
      if (!permitted && this.actor.permissions.length > 0) {
        return {
          ok: false,
          sessionId: this.id,
          code: "OPERATION_DENIED",
          message: `Actor '${this.actor.actorId}' lacks permission for '${op}'.`,
          diagnostic: uiDiagnostic("OPERATION_DENIED", "Permission denied by the preview actor policy.", {
            op,
            actor: this.actor.actorId,
            reason: "missing permission"
          })
        };
      }
    }
    if (operation.op.includes(":")) {
      return this.#runDataOp(operation, token, input);
    }
    return this.#runCapabilityOp(operation, token, input);
  }
  async #settle(token, delayMs, produce) {
    if (delayMs !== void 0 && delayMs > 0) {
      await this.#delay(delayMs);
    }
    if (token !== this.#state.token) {
      this.#onStale?.({ sessionId: this.id, supersededBy: this.id });
      return {
        ok: false,
        sessionId: this.id,
        code: "SESSION_STALE",
        message: "The session was reset while this operation was in flight; the result was dropped.",
        diagnostic: uiDiagnostic("SESSION_STALE", "Result fenced by a newer session.", {
          sessionId: this.id,
          supersededBy: this.id
        })
      };
    }
    return produce();
  }
  async #runCapabilityOp(operation, token, input) {
    const doubles = this.#runtime?.snapshotDoubles() ?? /* @__PURE__ */ new Map();
    const invoke = doubles.get(operation.op);
    if (invoke === void 0) {
      return {
        ok: false,
        sessionId: this.id,
        code: "SCENARIO_COVERAGE_MISSING",
        message: `No registered double for capability '${operation.op}'; the real handler was NOT invoked.`,
        diagnostic: uiDiagnostic("SCENARIO_COVERAGE_MISSING", "Missing required double.", {
          op: operation.op,
          implementation: "unavailable"
        })
      };
    }
    return this.#settle(token, operation.outcome?.delayMs, () => {
      if (operation.outcome?.kind === "failure") {
        return {
          ok: false,
          sessionId: this.id,
          code: operation.outcome.code ?? "SIMULATED_FAILURE",
          message: operation.outcome.message ?? "The simulated operation failed (declared outcome)."
        };
      }
      if (operation.outcome?.kind === "denied") {
        return {
          ok: false,
          sessionId: this.id,
          code: "OPERATION_DENIED",
          message: operation.outcome.message ?? "The simulated operation was denied.",
          diagnostic: uiDiagnostic("OPERATION_DENIED", "Denied by declared scenario outcome.", {
            op: operation.op,
            actor: this.actor.actorId,
            reason: operation.outcome.code ?? "declared"
          })
        };
      }
      const raw = invoke(input);
      return { ok: true, sessionId: this.id, value: raw };
    });
  }
  async #runDataOp(operation, token, input) {
    const [resourceId, dataOp] = operation.op.split(":");
    return this.#settle(token, operation.outcome?.delayMs, () => {
      const outcome = operation.outcome;
      if (outcome?.kind === "failure") {
        return {
          ok: false,
          sessionId: this.id,
          code: outcome.code ?? "SIMULATED_FAILURE",
          message: outcome.message ?? "The simulated data operation failed (declared outcome)."
        };
      }
      if (outcome?.kind === "denied") {
        return {
          ok: false,
          sessionId: this.id,
          code: "OPERATION_DENIED",
          message: outcome.message ?? "Denied.",
          diagnostic: uiDiagnostic("OPERATION_DENIED", "Denied by declared scenario outcome.", {
            op: operation.op,
            actor: this.actor.actorId,
            reason: outcome.code ?? "declared"
          })
        };
      }
      const rows = this.#state.rows.get(resourceId) ?? [];
      if (dataOp === "list") {
        return { ok: true, sessionId: this.id, value: { rows } };
      }
      if (dataOp === "get") {
        const id = input?.id;
        const row = rows.find((candidate) => candidate["id"] === id);
        if (row === void 0) {
          return {
            ok: false,
            sessionId: this.id,
            code: "DATA_UNKNOWN_IDENTITY",
            message: `No '${resourceId}' row '${String(id)}'.`
          };
        }
        return { ok: true, sessionId: this.id, value: { row } };
      }
      if (dataOp === "mutate") {
        return this.mutateRow(resourceId, operation, input);
      }
      return {
        ok: false,
        sessionId: this.id,
        code: "DATA_UNSUPPORTED_QUERY",
        message: `Unsupported data op '${dataOp}'.`
      };
    });
  }
  mutateRow(resourceId, operation, input) {
    const rows = this.#state.rows.get(resourceId) ?? [];
    const payload = input ?? {};
    const index = rows.findIndex((candidate) => candidate["id"] === payload.id);
    if (index === -1) {
      return {
        ok: false,
        sessionId: this.id,
        code: "DATA_UNKNOWN_IDENTITY",
        message: `No '${resourceId}' row '${String(payload.id)}'.`
      };
    }
    const current = rows[index];
    if (payload.expectedDomainRevision !== void 0 && current["domainRevision"] !== payload.expectedDomainRevision) {
      return {
        ok: false,
        sessionId: this.id,
        code: "DOMAIN_CONFLICT",
        message: `Domain revision moved (expected ${String(payload.expectedDomainRevision)}, actual ${String(current["domainRevision"])}); state unchanged.`,
        diagnostic: uiDiagnostic("DOMAIN_CONFLICT", "Stale decision.", {
          op: operation.op,
          expectedDomainRevision: payload.expectedDomainRevision,
          actualDomainRevision: current["domainRevision"]
        })
      };
    }
    const next = {
      ...current,
      ...payload.input ?? {},
      domainRevision: Number(current["domainRevision"] ?? 0) + 1
    };
    const updated = [...rows];
    updated[index] = next;
    this.#state.rows.set(resourceId, updated);
    return { ok: true, sessionId: this.id, value: { row: next } };
  }
  /**
   * Reset: a NEW session identity with fresh seeds and a fresh double
   * snapshot; every in-flight operation of THIS session becomes stale.
   */
  reset() {
    this.#stale = true;
    const next = new PreviewSession({
      scenario: this.scenario,
      actorId: this.actor.actorId,
      ...this.#runtime !== void 0 ? { runtime: this.#runtime } : {},
      ...this.#onStale !== void 0 ? { onStale: this.#onStale } : {},
      ...this.#delay !== void 0 ? { delay: this.#delay } : {}
    });
    return next;
  }
}
function createPreviewSession(options) {
  return new PreviewSession(options);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      void inspectionPlan();
    }
    let storedDocument = structuredClone(inspectionDetailDocument);
    let storedRevision = "1";
    const store = {
      load: () => ({ document: storedDocument, storedRevision }),
      save: (input) => {
        storedDocument = input.document;
        storedRevision = input.newStoredRevision;
        return { ok: true, storedRevision };
      }
    };
    const bridge = new EditorBridge({ store, initial: { document: storedDocument, storedRevision } });
    let workingDocument = bridge.document;
    let bridgeState = bridge.getSnapshot();
    let lastIssues = [];
    const scenarios = {
      normal: {
        schema: "vict.ui-scenario@1",
        scenarioId: "scn.normal",
        references: {
          application: { id: "app.inspection", revision: "1" },
          documents: { "doc.inspection-detail": "1" }
        },
        seeds: {
          domain: {
            rows: {
              inspection: [
                {
                  id: "i-101",
                  title: "Cold-chain compressor room",
                  status: "submitted",
                  domainRevision: 3
                }
              ]
            }
          }
        },
        actors: [
          {
            actorId: "s.hart",
            role: "supervisor",
            permissions: ["qlt.inspection.approve"]
          }
        ],
        operations: [
          {
            op: "inspection.approve",
            implementation: "simulated",
            outcome: { kind: "success" }
          },
          {
            op: "inspection:mutate",
            implementation: "simulated",
            outcome: { kind: "success" }
          }
        ],
        resetBoundary: "session"
      },
      missingCoverage: {
        schema: "vict.ui-scenario@1",
        scenarioId: "scn.missing",
        references: {
          application: { id: "app.inspection", revision: "1" },
          documents: { "doc.inspection-detail": "1" }
        },
        seeds: {
          domain: {
            rows: {
              inspection: [
                {
                  id: "i-101",
                  title: "Cold-chain compressor room",
                  status: "submitted",
                  domainRevision: 3
                }
              ]
            }
          }
        },
        actors: [
          {
            actorId: "s.hart",
            role: "supervisor",
            permissions: ["qlt.inspection.approve"]
          }
        ],
        operations: [{ op: "inspection.approve", implementation: "unavailable" }],
        resetBoundary: "session"
      },
      latency: {
        schema: "vict.ui-scenario@1",
        scenarioId: "scn.latency",
        references: {
          application: { id: "app.inspection", revision: "1" },
          documents: { "doc.inspection-detail": "1" }
        },
        seeds: {
          domain: {
            rows: {
              inspection: [
                {
                  id: "i-101",
                  title: "Cold-chain compressor room",
                  status: "submitted",
                  domainRevision: 3
                }
              ]
            }
          }
        },
        actors: [
          {
            actorId: "s.hart",
            role: "supervisor",
            permissions: ["qlt.inspection.approve"]
          }
        ],
        operations: [
          {
            op: "inspection.approve",
            implementation: "simulated",
            outcome: { kind: "success", delayMs: 800 }
          },
          {
            op: "inspection:mutate",
            implementation: "simulated",
            outcome: { kind: "success" }
          }
        ],
        resetBoundary: "session"
      }
    };
    createPreviewSession({ scenario: scenarios.normal });
    let previewNote = "Scenario ready. Approve runs against the simulated double.";
    const workingPlan = derived(() => compileUiDocument(workingDocument, defaultSemanticElementCatalog(), [], {
      actionIds: ["inspection.approve"],
      routeIds: ["queue", "detail"],
      viewFields: {
        title: "string",
        status: "string",
        findings: "array",
        "findings.severity": "string",
        "findings.description": "string",
        evidence: "array",
        "evidenceItem.label": "string",
        activity: "array",
        "activityItem.entry": "string",
        "activityItem.actor": "string"
      }
    }));
    let selectedOccurrence = void 0;
    const selectedReport = derived(() => selectedOccurrence === void 0 ? void 0 : resolveSelected(selectedOccurrence, workingDocument));
    function resolveSelected(occurrence, document) {
      const parts = occurrence.split("|");
      const nodeId = parts[1] ?? "";
      const nodes = document.nodes ?? {};
      const instanceSegments = parts.slice(2).filter((segment) => segment.includes("@"));
      return {
        nodeId,
        kind: nodes[nodeId]?.kind ?? "(missing)",
        owningDefinition: instanceSegments[0]?.split("@")[1],
        node: nodes[nodeId]
      };
    }
    head("1d4i12f", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`<style>
    .studio {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      padding: 16px;
      font-family: system-ui, sans-serif;
      color: #1c2430;
    }
    .studio-canvas {
      border: 1px solid #d9dde3;
      border-radius: 8px;
      padding: 16px;
      min-height: 400px;
      overflow: auto;
    }
    .studio-side {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .studio-panel {
      border: 1px solid #d9dde3;
      border-radius: 8px;
      padding: 12px;
    }
    .studio-panel h2 {
      font-size: 1rem;
      margin: 0 0 8px;
    }
    .studio-note {
      font-size: 0.85rem;
      color: #5b6572;
    }
    .scenario-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 8px 0;
    }
    .scenario-button {
      font: inherit;
      font-size: 0.85rem;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #93a1b3;
      background: white;
      cursor: pointer;
    }
    .preview-note {
      font-size: 0.85rem;
      padding: 8px;
      border-radius: 6px;
      background: #eef2f7;
      min-height: 2.4em;
    }
    @media (max-width: 900px) {
      .studio {
        grid-template-columns: 1fr;
      }
    }
  </style>`);
    });
    $$renderer2.push(`<main class="studio"><section class="studio-canvas" aria-label="Authoring canvas"><h1 class="studio-panel">Studio — inspection detail (working document)</h1> <p class="studio-note">Click an element to select its source occurrence. Edits go through exported transactional
      commands; the canvas renders the working document through the same renderer as the product.</p> `);
    EditorCanvas($$renderer2, {
      document: workingDocument,
      selectedOccurrence,
      onSelect: (occurrence) => {
        selectedOccurrence = occurrence;
        bridge.select(occurrence);
      },
      dispatch: async () => ({ ok: true }),
      navigate: () => void 0,
      view: {
        findings: [
          { description: "Seal wear beyond tolerance", severity: "high" },
          { description: "Label fade on shutoff valve", severity: "low" }
        ],
        evidence: [{ label: "Compressor seal photo" }],
        activity: [{ entry: "Inspection submitted", actor: "t.nguyen" }]
      },
      record: { title: "Cold-chain compressor room", status: "submitted" },
      localState: workingDocument.localState,
      ariaLabel: "Inspection detail canvas"
    });
    $$renderer2.push(`<!----> <p class="studio-note">Last command round trip: ${escape_html("—")} (budget ≤ 100 ms) `);
    if (workingPlan().ok) {
      $$renderer2.push(`<!--[0-->· working plan compiled: ${escape_html(workingPlan().plan.sourceDigest.slice(0, 12))}…`);
    } else {
      $$renderer2.push(`<!--[-1-->· working plan DOES NOT COMPILE (shown in canvas)`);
    }
    $$renderer2.push(`<!--]--></p></section> <aside class="studio-side"><div class="studio-panel">`);
    HistoryPanel($$renderer2, {
      revision: bridgeState.revision,
      storedRevision: bridgeState.storedRevision,
      dirty: bridgeState.dirty,
      canUndo: bridgeState.canUndo,
      canRedo: bridgeState.canRedo
    });
    $$renderer2.push(`<!----></div> <div class="studio-panel">`);
    Inspector($$renderer2, {
      document: workingDocument,
      selectedOccurrence,
      lastIssues,
      knownActionIds: ["inspection.approve"],
      knownRouteIds: ["queue", "detail"]
    });
    $$renderer2.push(`<!----> <div class="scenario-row"><button type="button" class="scenario-button"${attr("disabled", selectedReport()?.nodeId === void 0, true)}>Quick edit: text</button> <button type="button" class="scenario-button"${attr("disabled", selectedReport()?.nodeId === void 0, true)}>Quick edit: accent color</button></div></div> <div class="studio-panel" aria-label="Preview"><h2>Preview (simulated)</h2> <div class="scenario-row"><!--[-->`);
    const each_array = ensure_array_like(Object.keys(scenarios));
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let name = each_array[$$index];
      $$renderer2.push(`<button type="button" class="scenario-button">${escape_html(name)}</button>`);
    }
    $$renderer2.push(`<!--]--> <button type="button" class="scenario-button">Run approve</button></div> <p class="preview-note" role="status">${escape_html(previewNote)}</p></div></aside></main>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-D8ROhYs0.js.map
