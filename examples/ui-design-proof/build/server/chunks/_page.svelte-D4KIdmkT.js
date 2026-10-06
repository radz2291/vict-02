import { b as ensure_array_like, c as attr, e as escape_html, d as attr_style, f as derived, h as attr_class, i as clsx } from './index.js-DY7Rze5x.js';
import { S as SERVICE_STORE_KEY, s as serviceDocument, D as DocumentHost, a as SERVICE_SEED_REVISION, c as compileUiDocument, b as canonicalUiDocument, u as uiDiagnostic, e as DESIGN_STORE_FORMAT, f as defaultSemanticElementCatalog, g as validateUiDocument, d as designCatalogs, r as readContactFields, v as validateContact } from './service-document-qhvxONqo.js';

function cloneDocument(document2) {
  return JSON.parse(JSON.stringify(document2));
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
        const declarationIndex = declarations.findIndex((declaration) => declaration.property === command.property);
        if (command.value === void 0) {
          if (declarationIndex >= 0)
            declarations.splice(declarationIndex, 1);
        } else if (declarationIndex >= 0) {
          declarations[declarationIndex] = { property: command.property, value: command.value };
        } else {
          declarations.push({ property: command.property, value: command.value });
        }
        if (declarations.length === 0) {
          delete styleSources[sourceId];
          const sourceIndex = attached.indexOf(sourceId);
          if (sourceIndex >= 0)
            attached.splice(sourceIndex, 1);
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
  return {
    ok: true,
    document: working,
    revision: snapshot.revision,
    requestId: transaction.requestId
  };
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
          slots[name] = {
            name: fill.name,
            children: fill.children.filter((child) => child !== nodeId)
          };
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
  /** The stage returned by the most recent stageSave (commit ownership guard). */
  #pendingStage = void 0;
  #catalogs;
  constructor(snapshot, storedDocument, storedRevision, catalogs) {
    this.#working = snapshot;
    this.#storedRevision = storedRevision;
    this.#storedDocument = storedDocument;
    this.#catalogs = catalogs;
  }
  /** Open a session over a stored document + its stored revision. */
  static open(input) {
    const document2 = input.document;
    return new UiEditSession({ document: document2, revision: `${input.storedRevision}#0` }, cloneDocument(document2), input.storedRevision, input.catalogs ?? {
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
    return historyIdentity(this.#working.document) !== historyIdentity(this.#storedDocument);
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
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_EDIT_UNDO_CONFLICT", "Nothing to undo.", {
            expectedRevision: this.#working.revision,
            currentRevision: this.#working.revision
          })
        ]
      };
    }
    if (this.#working.document !== entry.after) {
      const currentDigest = historyIdentity(this.#working.document);
      const afterDigest = historyIdentity(entry.after);
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
    this.#working = {
      document: entry.before,
      revision: `${this.#storedRevision}#${this.#sequence}`
    };
    return { ok: true, revision: this.#working.revision, requestId: `undo:${entry.requestId}` };
  }
  /** Redo the most recently undone transaction. */
  redo() {
    const entry = this.#redoStack[this.#redoStack.length - 1];
    if (entry === void 0) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_EDIT_UNDO_CONFLICT", "Nothing to redo.", {
            expectedRevision: this.#working.revision,
            currentRevision: this.#working.revision
          })
        ]
      };
    }
    const currentDigest = historyIdentity(this.#working.document);
    const beforeDigest = historyIdentity(entry.before);
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
    this.#working = {
      document: entry.after,
      revision: `${this.#storedRevision}#${this.#sequence}`
    };
    return { ok: true, revision: this.#working.revision, requestId: `redo:${entry.requestId}` };
  }
  /**
   * Save with the expected-stored-revision guard. Advances the stored
   * revision deterministically (numeric revisions increment; otherwise a
   * `.r1`, `.r2`, … suffix is appended) and stamps the saved document's own
   * `revision` field so catalog pins can address exactly these bytes.
   *
   * Owns the save window for its whole duration: a nested save (e.g. from
   * inside an injected store callback) is refused before staging — it can
   * never supersede the window's stage or release its lock. The commit
   * outcome is returned truthfully; a refused commit is NOT reported as a
   * successful save.
   */
  save(input) {
    const staged = this.stageSave(input);
    if (!staged.ok)
      return staged;
    try {
      const committed = this.commitSave(staged.staged);
      if (!committed.ok)
        return { ok: false, issues: committed.issues };
      return {
        ok: true,
        storedRevision: staged.staged.storedRevision,
        document: staged.staged.document,
        contentDigest: staged.staged.contentDigest
      };
    } finally {
      this.releaseSaveWindow();
    }
  }
  /**
   * Two-phase save, stage: compute the saved bytes and next stored revision
   * WITHOUT mutating the session. The host persists the staged bytes first
   * (the store is the revision AUTHORITY); commitSave applies the stage only
   * after persistence succeeded, so a failed write preserves the working
   * document, dirty state, stored revision and undo/redo continuity.
   */
  stageSave(input) {
    if (this.#pendingStage !== void 0) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_EDIT_SAVE_IN_PROGRESS", "Save rejected: a save is already in progress on this session; nested saves are refused until it completes.", {
            expectedRevision: input.expectedStoredRevision,
            storedRevision: this.#storedRevision
          })
        ]
      };
    }
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
    const staged = {
      fromStoredRevision: this.#storedRevision,
      fromWorkingSequence: this.#sequence,
      storedRevision: nextStored,
      document: saved,
      contentDigest: canonicalUiDocument(saved).contentDigest
    };
    this.#pendingStage = staged;
    return { ok: true, staged };
  }
  /**
   * Release the save window when the OWNING save operation ends (success,
   * refused commit, failed or thrown write). Orchestrator-only: nested
   * stage/commit attempts during the window are refused and never touch the
   * lock. Idempotent; safe to call from a finally block.
   */
  releaseSaveWindow() {
    this.#pendingStage = void 0;
  }
  /**
   * Two-phase save, commit: apply a staged save after the host's persistence
   * succeeded. Guards, all checked BEFORE any mutation: (a) the staged object
   * must be this session's most recent stage (a stage from another session,
   * or a stale stage superseded by a later one, is rejected); (b) the stored
   * revision must not have moved since the stage; (c) the working session
   * must not have moved since the stage — an edit/undo/redo accepted between
   * stage and commit is PRESERVED and the commit is refused, so staged bytes
   * can never silently replace newer working state.
   *
   * If a host's persistence already wrote when the commit is refused, the
   * session truthfully keeps its pre-commit state (edits intact, older saved
   * baseline, still dirty): the host MUST reconcile by reopening from the
   * authoritative store — the session never claims the uncommitted baseline
   * was saved. `EditorBridge` prevents that situation by refusing edits for
   * the whole save window.
   */
  commitSave(staged) {
    if (staged !== this.#pendingStage) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_DOC_STALE_REVISION", "Commit rejected: this staged save does not belong to the current session state.", {
            expectedRevision: staged.fromStoredRevision,
            storedRevision: this.#storedRevision
          })
        ]
      };
    }
    if (staged.fromStoredRevision !== this.#storedRevision) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_DOC_STALE_REVISION", "Commit rejected: the stored revision moved since the save was staged.", {
            expectedRevision: staged.fromStoredRevision,
            storedRevision: this.#storedRevision
          })
        ]
      };
    }
    if (staged.fromWorkingSequence !== this.#sequence) {
      return {
        ok: false,
        issues: [
          uiDiagnostic("UI_DOC_STALE_REVISION", "Commit rejected: the working session moved since the save was staged; the intervening edits are preserved.", {
            expectedRevision: staged.fromStoredRevision,
            storedRevision: this.#storedRevision
          })
        ]
      };
    }
    this.#storedRevision = staged.storedRevision;
    this.#storedDocument = cloneDocument(staged.document);
    this.#working = {
      document: staged.document,
      revision: `${staged.storedRevision}#${this.#sequence + 1}`
    };
    this.#sequence += 1;
    this.#pendingStage = void 0;
    return { ok: true };
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
function historyIdentity(document2) {
  return canonicalUiDocument({ ...document2, revision: "" }).contentDigest;
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
      document: document2,
      catalogs,
      extensions = [],
      localState = {},
      view = {},
      record = {},
      selectedOccurrence,
      onSelect,
      dispatch,
      navigate,
      onRenderDiagnostic,
      ariaLabel = "Document canvas"
    } = $$props;
    const effectiveCatalogs = derived(() => catalogs ?? {
      elements: defaultSemanticElementCatalog(),
      actionIds: [],
      routeIds: []
    });
    const compiled = derived(() => {
      return compileUiDocument(document2, effectiveCatalogs().elements, extensions, {
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
        onRenderDiagnostic,
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
function resolveOccurrence(occurrenceKey, document2) {
  const parts = occurrenceKey.split("|");
  const documentId = parts[0] ?? "";
  const sourceNodeId = parts[1] ?? "";
  const rest = parts.slice(2);
  const instanceSegments = rest.filter(
    (segment) => segment.includes("@") && !segment.startsWith("portal:")
  );
  const portalSegments = rest.filter((segment) => segment.startsWith("portal:"));
  const instancePath = instanceSegments.map((segment) => {
    const at = segment.indexOf("@");
    return { sourceNodeId: segment.slice(0, at), definitionId: segment.slice(at + 1) };
  });
  const portalPath = portalSegments.map((segment) => {
    const [, portalNode, overlayId] = segment.split(":");
    return { sourceNodeId: portalNode ?? "", overlayId: overlayId ?? "" };
  });
  const repeatKeys = rest.filter(
    (segment) => !segment.includes("@") && !segment.startsWith("portal:")
  );
  const firstInstance = instanceSegments[0] ?? "";
  const owningDefinitionId = firstInstance === "" ? void 0 : firstInstance.split("@")[1] ?? void 0;
  const nodes = document2.nodes ?? {};
  return {
    sourceNodeId,
    instancePath,
    portalPath,
    owningDefinitionId,
    repeatKeys,
    node: documentId === String(document2.id) ? nodes[sourceNodeId] : void 0
  };
}
function Inspector($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      document: document2,
      selectedOccurrence,
      lastIssues = [],
      knownActionIds = [],
      knownRouteIds = [],
      styleConditions = [],
      readEffective
    } = $$props;
    let textValue = "";
    let styleProperty = "color";
    let styleValue = "";
    let useToken = false;
    let attributeName = "data-note";
    let attributeValue = "";
    let actionId = "";
    let styleTarget = "base";
    let stylePseudo = void 0;
    const report = derived(() => selectedOccurrence !== void 0 ? resolveOccurrence(selectedOccurrence, document2) : void 0);
    const node = derived(() => report()?.node);
    const nodeKind = derived(() => node()?.kind);
    const definitionInstanceCount = derived(() => {
      if (report()?.owningDefinitionId === void 0) return 0;
      let count = 0;
      for (const candidate of Object.values(document2.nodes ?? {})) {
        if (candidate.kind === "component" && candidate.definitionId === report().owningDefinitionId) {
          count += 1;
        }
      }
      return count;
    });
    const authoredOrigin = derived(() => {
      if (node() === void 0 || nodeKind() !== "element") return void 0;
      if (node().localStyle?.some((d) => d.property === styleProperty)) {
        return { layer: "Instance-local (base source)", conditioned: false };
      }
      for (const sourceId of node().styleSources ?? []) {
        const source = document2.styleSources?.[sourceId];
        if (source?.declarations.some((d) => d.property === styleProperty)) {
          const condition = source.conditionId ?? void 0;
          return {
            layer: `Attached style source${condition !== void 0 ? ` (${condition})` : ""}${source.pseudo !== void 0 ? ` :${source.pseudo}` : ""}`,
            conditioned: condition !== void 0
          };
        }
      }
      return void 0;
    });
    const effectiveValue = derived(() => {
      if (readEffective === void 0 || selectedOccurrence === void 0 || nodeKind() != "element") {
        return void 0;
      }
      return readEffective(selectedOccurrence, styleProperty);
    });
    $$renderer2.push(`<aside class="uv-inspector" aria-label="Inspector"><h2>Inspector</h2> `);
    if (report() === void 0 || node() === void 0) {
      $$renderer2.push(`<!--[0--><p>Select an element in the canvas to inspect its source.</p>`);
    } else {
      $$renderer2.push(`<!--[-1--><dl><dt>Source node</dt> <dd><code>${escape_html(report().sourceNodeId)}</code></dd> <dt>Kind</dt> <dd>${escape_html(nodeKind())}</dd> `);
      if (report().instancePath.length > 0) {
        $$renderer2.push(`<!--[0--><dt>Inside component</dt> <dd><!--[-->`);
        const each_array = ensure_array_like(report().instancePath);
        for (let index = 0, $$length = each_array.length; index < $$length; index++) {
          let step = each_array[index];
          if (index > 0) {
            $$renderer2.push(`<!--[0-->→`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <code>${escape_html(step.definitionId)}</code> (${escape_html(step.sourceNodeId)})`);
        }
        $$renderer2.push(`<!--]--> `);
        if (definitionInstanceCount() > 0) {
          $$renderer2.push(`<!--[0--><span class="uv-inspector-note">editing the SHARED definition — ${escape_html(definitionInstanceCount())}
              ${escape_html(definitionInstanceCount() === 1 ? "instance" : "instances")} update together</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></dd>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (report().portalPath.length > 0) {
        $$renderer2.push(`<!--[0--><dt>Portal ownership</dt> <dd>presented through <!--[-->`);
        const each_array_1 = ensure_array_like(report().portalPath);
        for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
          let step = each_array_1[index];
          if (index > 0) {
            $$renderer2.push(`<!--[0-->→`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <code>${escape_html(step.sourceNodeId)}</code> → <code>${escape_html(step.overlayId)}</code>`);
        }
        $$renderer2.push(`<!--]--> (rendering unsupported; ownership preserved)</dd>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (report().repeatKeys.length > 0) {
        $$renderer2.push(`<!--[0--><dt>Record keys</dt> <dd>${escape_html(report().repeatKeys.join(" → "))}</dd>`);
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
        $$renderer2.push(`<!--[0--><fieldset><legend>Style declaration</legend> <label>Applies to `);
        $$renderer2.select(
          {
            value: styleTarget,
            "aria-label": "Style target",
            onchange: (event) => {
              styleTarget = event.currentTarget.value;
            }
          },
          ($$renderer3) => {
            $$renderer3.option({ value: "base" }, ($$renderer4) => {
              $$renderer4.push(`Base styling`);
            });
            $$renderer3.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(styleConditions);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let condition = each_array_2[$$index_2];
              $$renderer3.option({ value: condition.id }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(condition.label)}`);
              });
            }
            $$renderer3.push(`<!--]-->`);
          }
        );
        $$renderer2.push(`</label> `);
        if (styleTarget !== "base") {
          $$renderer2.push(`<!--[0--><p class="uv-inspector-note">Editing <strong>${escape_html(styleConditions.find((c) => c.id === styleTarget)?.label ?? styleTarget)}</strong> styling — base styling is NOT changed (the rule applies only under that
            condition).</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <label>Pseudo state `);
        $$renderer2.select({ value: stylePseudo, "aria-label": "Pseudo state" }, ($$renderer3) => {
          $$renderer3.option({ value: void 0 }, ($$renderer4) => {
            $$renderer4.push(`— (none)`);
          });
          $$renderer3.option({ value: "hover" }, ($$renderer4) => {
            $$renderer4.push(`hover`);
          });
          $$renderer3.option({ value: "focus" }, ($$renderer4) => {
            $$renderer4.push(`focus`);
          });
          $$renderer3.option({ value: "active" }, ($$renderer4) => {
            $$renderer4.push(`active`);
          });
          $$renderer3.option({ value: "disabled" }, ($$renderer4) => {
            $$renderer4.push(`disabled`);
          });
        });
        $$renderer2.push(`</label> <label>Property <input type="text"${attr("value", styleProperty)} aria-label="Style property"/></label> `);
        if (authoredOrigin() !== void 0) {
          $$renderer2.push(`<!--[0--><p class="uv-inspector-note">Authored in: ${escape_html(authoredOrigin().layer)} `);
          if (effectiveValue() !== void 0) {
            $$renderer2.push(`<!--[0-->· effective value: <code>${escape_html(effectiveValue())}</code>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></p>`);
        } else if (effectiveValue() !== void 0) {
          $$renderer2.push(`<!--[1--><p class="uv-inspector-note">Not authored on this node — effective value: <code>${escape_html(effectiveValue())}</code> (cascade/inheritance/token).</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <label><input type="checkbox"${attr("checked", useToken, true)}/> Token value</label> `);
        {
          $$renderer2.push(`<!--[-1--><label>Value <input type="text"${attr("value", styleValue)} aria-label="Style value"/></label>`);
        }
        $$renderer2.push(`<!--]--> <button type="button">Apply style</button></fieldset> `);
        if (nodeKind() === "element") {
          $$renderer2.push(`<!--[0--><fieldset><legend>Attribute</legend> <label>Name <input type="text"${attr("value", attributeName)} aria-label="Attribute name"/></label> <label>Value <input type="text"${attr("value", attributeValue)} aria-label="Attribute value"/></label> <button type="button">Set attribute</button></fieldset> <fieldset><legend>Interaction (click)</legend> <label>Action id <input type="text"${attr("value", actionId)} list="uv-known-actions" aria-label="Action id"/></label> <datalist id="uv-known-actions"><!--[-->`);
          const each_array_4 = ensure_array_like(knownActionIds);
          for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
            let known = each_array_4[$$index_4];
            $$renderer2.option({ value: known }, ($$renderer3) => {
              $$renderer3.push(`${escape_html(known)}`);
            });
          }
          $$renderer2.push(`<!--]--></datalist> <button type="button">Connect action</button> `);
          if (knownRouteIds.length > 0) {
            $$renderer2.push(`<!--[0--><label>Navigate to route `);
            $$renderer2.select({ value: actionId, "aria-label": "Route id" }, ($$renderer3) => {
              $$renderer3.push(`<!--[-->`);
              const each_array_5 = ensure_array_like(knownRouteIds);
              for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
                let routeId = each_array_5[$$index_5];
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
      const each_array_6 = ensure_array_like(lastIssues);
      for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
        let issue = each_array_6[$$index_6];
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
  /**
   * True for the whole save window (stage → store ack → commit). Edits are
   * REFUSED during that window: a storage callback that re-entered the bridge
   * could otherwise accept an edit between stage and commit, which the commit
   * would then have to reject — discarding it or stranding the acknowledged
   * store against a stale baseline. One synchronous save window, no edits.
   */
  #saveInFlight = false;
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
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            "UI_EDIT_SAVE_IN_PROGRESS",
            "Edit refused: a save is being acknowledged; retry the edit after the save settles.",
            {}
          )
        ]
      };
    }
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
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
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
          uiDiagnostic(
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
    const stored = this.#store.load();
    if (stored.status === "empty") {
      return { ok: false, code: "UI_STORE_EMPTY", message: "No stored document exists." };
    }
    if (stored.status === "invalid") {
      return {
        ok: false,
        code: "UI_STORE_INVALID",
        message: stored.message,
        ...stored.overwritable !== void 0 ? { overwritable: stored.overwritable } : {},
        ...stored.storedRevision !== void 0 ? { storedRevision: stored.storedRevision } : {}
      };
    }
    this.#session = this.#session.reopen({
      document: stored.document,
      storedRevision: stored.storedRevision
    });
    this.#selectedOccurrence = void 0;
    this.#emit();
    return { ok: true, storedRevision: stored.storedRevision };
  }
}
function classifyStored(raw, format) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "unreadable", message: "stored authoring data is not valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null || parsed["format"] !== format) {
    return { kind: "unreadable", message: `stored payload is not '${format}'` };
  }
  const record = parsed;
  if (typeof record["document"] !== "object" || record["document"] === null || typeof record["storedRevision"] !== "string") {
    return {
      kind: "unreadable",
      message: "stored payload lacks a readable document or stored revision"
    };
  }
  return {
    kind: "envelope",
    document: record["document"],
    recordedRevision: record["storedRevision"]
  };
}
function createLocalStorageDocumentStore(storage, options) {
  const { key, format, seedStoredRevision } = options;
  const readRaw = () => {
    try {
      return { ok: true, raw: storage.getItem(key) };
    } catch (error) {
      return {
        ok: false,
        message: `storage unavailable: ${String(error instanceof Error ? error.message : error)}`
      };
    }
  };
  return {
    rawLoad() {
      const read = readRaw();
      if (!read.ok) return { status: "invalid", message: read.message, overwritable: false };
      if (read.raw === null) return { status: "empty" };
      const classified = classifyStored(read.raw, format);
      if (classified.kind === "unreadable") {
        return {
          status: "invalid",
          message: `${classified.message} (stored bytes preserved)`,
          overwritable: false
        };
      }
      return {
        status: "loaded",
        document: classified.document,
        storedRevision: classified.recordedRevision
      };
    },
    load() {
      const read = readRaw();
      if (!read.ok) {
        return { status: "invalid", message: read.message, overwritable: false };
      }
      if (read.raw === null) return { status: "empty" };
      const classified = classifyStored(read.raw, format);
      if (classified.kind === "unreadable") {
        return {
          status: "invalid",
          message: classified.message,
          overwritable: false
        };
      }
      return {
        status: "loaded",
        document: classified.document,
        storedRevision: classified.recordedRevision
      };
    },
    save(input) {
      const read = readRaw();
      if (!read.ok) return { ok: false, code: "UI_STORE_WRITE_FAILED", reason: read.message };
      let authoritative;
      if (read.raw !== null) {
        const classified = classifyStored(read.raw, format);
        if (classified.kind === "unreadable") {
          return {
            ok: false,
            code: "UI_STORE_CORRUPT",
            reason: `refusing to overwrite preserved data: ${classified.message}`
          };
        }
        authoritative = classified.recordedRevision;
      }
      const stale = authoritative === void 0 ? input.expectedStoredRevision !== seedStoredRevision : authoritative !== input.expectedStoredRevision;
      if (stale) {
        return {
          ok: false,
          code: "UI_DOC_STALE_REVISION",
          reason: `stored revision is ${authoritative ?? "absent (empty store)"}, editor expected ${input.expectedStoredRevision}`
        };
      }
      try {
        storage.setItem(
          key,
          JSON.stringify({
            format,
            document: input.document,
            storedRevision: input.newStoredRevision
          })
        );
      } catch (error) {
        return {
          ok: false,
          code: "UI_STORE_WRITE_FAILED",
          reason: `storage write failed: ${String(error instanceof Error ? error.message : error)}`
        };
      }
      return { ok: true, storedRevision: input.newStoredRevision };
    }
  };
}
const FIXTURE_STORE_KEY = "vict.u2.fixture.doc";
const fixtureDocument = (() => {
  const nodes = {
    "fx.root": {
      kind: "element",
      id: "fx.root",
      tag: "div",
      styleSources: ["fsrc.canvas"],
      children: ["fx.canvasTitle", "fx.graph", "fx.legend"]
    },
    "fx.canvasTitle": {
      kind: "element",
      id: "fx.canvasTitle",
      tag: "p",
      styleSources: ["fsrc.canvasTitle"],
      children: ["fx.canvasTitleText"]
    },
    "fx.canvasTitleText": {
      kind: "text",
      id: "fx.canvasTitleText",
      content: {
        type: "literal",
        value: "Fixture canvas — presentation sample (boxes and connectors carry no workflow semantics)"
      }
    },
    "fx.graph": {
      kind: "element",
      id: "fx.graph",
      tag: "div",
      styleSources: ["fsrc.graph"],
      children: [
        "fx.boxIntake",
        "fx.edgeIntakeTriage",
        "fx.boxTriage",
        "fx.edgeTriageReview",
        "fx.boxReview",
        "fx.edgeReviewArchive",
        "fx.boxArchive",
        "fx.boxNotesColumn"
      ]
    }
  };
  const spec = [
    { id: "fx.boxIntake", label: "Intake — requests arrive by post and online form", source: "fsrc.box" },
    { id: "fx.boxTriage", label: "Triage — two clerks sort the week’s pile into priority bands", source: "fsrc.box" },
    {
      id: "fx.boxReview",
      label: "Review panel — meets Thursdays; quorum is three including the chair",
      source: "fsrc.box"
    },
    {
      id: "fx.boxArchive",
      label: "Archive — closed cases are boxed, barcoded and stored for seven years",
      source: "fsrc.box"
    },
    {
      id: "fx.boxNotesColumn",
      label: "Margin notes — the fixture canvas is a PRESENTATION sample: shapes and labels only, no live operator controls",
      source: "fsrc.notes"
    }
  ];
  for (const item of spec) {
    const textId = `${item.id}Text`;
    nodes[item.id] = {
      kind: "element",
      id: item.id,
      tag: "div",
      styleSources: [item.source],
      children: [textId]
    };
    nodes[textId] = { kind: "text", id: textId, content: { type: "literal", value: item.label } };
  }
  const edges = [
    { id: "fx.edgeIntakeTriage", label: "sorted into" },
    { id: "fx.edgeTriageReview", label: "presented to" },
    { id: "fx.edgeReviewArchive", label: "closed to" }
  ];
  for (const edge of edges) {
    nodes[edge.id] = {
      kind: "element",
      id: edge.id,
      tag: "div",
      styleSources: ["fsrc.edge"],
      children: [`${edge.id}Text`]
    };
    nodes[`${edge.id}Text`] = {
      kind: "text",
      id: `${edge.id}Text`,
      content: { type: "literal", value: edge.label }
    };
  }
  nodes["fx.legend"] = {
    kind: "element",
    id: "fx.legend",
    tag: "div",
    styleSources: ["fsrc.legend"],
    children: ["fx.legendText"]
  };
  nodes["fx.legendText"] = {
    kind: "text",
    id: "fx.legendText",
    content: {
      type: "literal",
      value: "Reading the fixture: tall boxes are stages, thin bars are connectors. Try the narrow size — the column stacks and the labels wrap."
    }
  };
  return {
    schema: "vict.ui-document@1",
    id: "doc.fixture",
    revision: "1",
    root: "fx.root",
    tokens: {
      "color.ink": { id: "color.ink", value: "#20242c" },
      "color.muted": { id: "color.muted", value: "#667085" },
      "color.paper": { id: "color.paper", value: "#f6f7f9" },
      "color.card": { id: "color.card", value: "#ffffff" },
      "color.line": { id: "color.line", value: "#cdd3dd" },
      "color.accent": { id: "color.accent", value: "#33529f" },
      "space.sm": { id: "space.sm", value: "8px" },
      "space.md": { id: "space.md", value: "14px" },
      "space.lg": { id: "space.lg", value: "24px" },
      "radius.md": { id: "radius.md", value: "8px" }
    },
    conditions: {
      "cond.fxStack": { id: "cond.fxStack", kind: "media", query: "(max-width: 900px)" }
    },
    styleSources: {
      "fsrc.canvas": {
        id: "fsrc.canvas",
        declarations: [
          { property: "padding", value: { type: "token", id: "space.lg" } },
          { property: "color", value: { type: "token", id: "color.ink" } },
          { property: "font-family", value: { type: "text", value: "system-ui, sans-serif" } }
        ]
      },
      "fsrc.canvasTitle": {
        id: "fsrc.canvasTitle",
        declarations: [
          { property: "margin", value: { type: "text", value: "0 0 16px" } },
          { property: "color", value: { type: "token", id: "color.muted" } },
          { property: "font-size", value: { type: "text", value: "13px" } }
        ]
      },
      "fsrc.graph": {
        id: "fsrc.graph",
        declarations: [
          { property: "display", value: { type: "text", value: "grid" } },
          { property: "grid-template-columns", value: { type: "text", value: "minmax(260px, 1.4fr) 1fr" } },
          { property: "gap", value: { type: "token", id: "space.md" } },
          { property: "align-items", value: { type: "text", value: "start" } }
        ],
        conditionId: "cond.fxStack"
      },
      "fsrc.box": {
        id: "fsrc.box",
        declarations: [
          { property: "background", value: { type: "token", id: "color.card" } },
          { property: "border", value: { type: "text", value: "1px solid var(--ui-token-color_line)" } },
          { property: "border-left", value: { type: "text", value: "4px solid var(--ui-token-color_accent)" } },
          { property: "border-radius", value: { type: "token", id: "radius.md" } },
          { property: "padding", value: { type: "token", id: "space.md" } },
          { property: "font-size", value: { type: "text", value: "14px" } },
          { property: "line-height", value: { type: "text", value: "1.45" } },
          { property: "overflow-wrap", value: { type: "text", value: "anywhere" } }
        ]
      },
      "fsrc.notes": {
        id: "fsrc.notes",
        declarations: [
          { property: "background", value: { type: "token", id: "color.paper" } },
          { property: "border", value: { type: "text", value: "1px dashed var(--ui-token-color_line)" } },
          { property: "border-radius", value: { type: "token", id: "radius.md" } },
          { property: "padding", value: { type: "token", id: "space.md" } },
          { property: "font-size", value: { type: "text", value: "13px" } },
          { property: "color", value: { type: "token", id: "color.muted" } },
          { property: "grid-column", value: { type: "text", value: "2" } },
          { property: "grid-row", value: { type: "text", value: "1 / span 7" } }
        ]
      },
      "fsrc.edge": {
        id: "fsrc.edge",
        declarations: [
          { property: "display", value: { type: "text", value: "flex" } },
          { property: "align-items", value: { type: "text", value: "center" } },
          { property: "gap", value: { type: "text", value: "8px" } },
          { property: "color", value: { type: "token", id: "color.muted" } },
          { property: "font-size", value: { type: "text", value: "12px" } }
        ]
      },
      "fsrc.legend": {
        id: "fsrc.legend",
        declarations: [
          { property: "margin-top", value: { type: "token", id: "space.lg" } },
          { property: "font-size", value: { type: "text", value: "13px" } },
          { property: "color", value: { type: "token", id: "color.muted" } }
        ]
      }
    },
    componentDefinitions: {},
    assets: {},
    localState: {}
  };
})();
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const DOCUMENTS = [
      {
        id: "service",
        label: "Service page",
        seed: serviceDocument,
        storeKey: SERVICE_STORE_KEY
      },
      {
        id: "fixture",
        label: "Graph fixture",
        seed: fixtureDocument,
        storeKey: FIXTURE_STORE_KEY
      }
    ];
    function openBlade(doc) {
      {
        return { doc, bridge: stubBlade(doc), banner: null };
      }
    }
    function stubBlade(doc) {
      const memory = createLocalStorageDocumentStore({ getItem: () => null, setItem: () => void 0 }, {
        key: `ssr.${doc.id}`,
        format: DESIGN_STORE_FORMAT,
        seedStoredRevision: SERVICE_SEED_REVISION
      });
      return new EditorBridge({
        store: memory,
        initial: { document: doc.seed, storedRevision: SERVICE_SEED_REVISION }
      });
    }
    const blades = DOCUMENTS.map(openBlade);
    let currentId = "service";
    const current = derived(() => blades.find((blade) => blade.doc.id === currentId) ?? blades[0]);
    const state = derived(() => current()?.bridge.getSnapshot());
    let selectedOccurrence = void 0;
    let activity = [];
    let activityOpen = true;
    function log(kind, text) {
      const at = /* @__PURE__ */ new Date();
      const stamp = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:${String(at.getSeconds()).padStart(2, "0")}`;
      activity = [
        ...activity.slice(-80),
        { at: Date.now(), kind, text: `${stamp} ${text}` }
      ];
    }
    function select(occurrence) {
      selectedOccurrence = occurrence;
      log("info", `Selected ${occurrence}`);
    }
    const SIZES = [
      { id: "full", label: "Full width", width: "100%" },
      { id: "1024", label: "1024", width: "1024px" },
      { id: "390", label: "390 (phone)", width: "390px" },
      { id: "480", label: "480 container", width: "480px" }
    ];
    let sizeId = "full";
    const frameWidth = derived(() => SIZES.find((size) => size.id === sizeId)?.width ?? "100%");
    let inspectorWidth = 320;
    let contactOutcome = null;
    async function dispatch(actionId) {
      if (actionId === "design.submitContact") {
        const fields = readContactFields(document.body);
        contactOutcome = validateContact(fields);
        log(contactOutcome.status === "ok" ? "save" : "error", `Form: ${contactOutcome.heading}`);
        return contactOutcome;
      }
      return {
        status: "denied",
        heading: `Unknown action ${actionId}`,
        issues: []
      };
    }
    function navigate() {
    }
    const styleConditions = derived(() => Object.entries(current().doc.seed.conditions ?? {}).filter(([, condition]) => condition.kind === "media" || condition.kind === "container").map(([id, condition]) => ({
      id,
      label: condition.kind === "media" ? `Window: ${condition.query}` : `Container “${condition.name}”: ${condition.query}`
    })));
    function readEffective(occurrence, property) {
      return void 0;
    }
    $$renderer2.push(`<div class="wb"><div class="wb-body"><nav class="wb-rail" aria-label="Workbench navigation"><span class="wb-rail-heading">Documents</span> <!--[-->`);
    const each_array = ensure_array_like(DOCUMENTS);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let doc = each_array[$$index];
      $$renderer2.push(`<button type="button"${attr("aria-pressed", currentId === doc.id)}>${escape_html(doc.label)}</button>`);
    }
    $$renderer2.push(`<!--]--> <span class="wb-rail-heading">Edit</span> <button type="button"${attr("disabled", !state()?.canUndo, true)}>Undo</button> <button type="button"${attr("disabled", !state()?.canRedo, true)}>Redo</button> <button type="button">Save</button> <button type="button">Reload stored</button> <span class="wb-rail-heading">Status</span> <span style="padding: 0 10px; font-size: 12px; color: #a7b5ad">`);
    if (state()?.dirty) {
      $$renderer2.push(`<!--[0-->Unsaved changes`);
    } else {
      $$renderer2.push(`<!--[-1-->Saved`);
    }
    $$renderer2.push(`<!--]--> <br/> stored revision ${escape_html(state()?.storedRevision)}</span></nav> <div class="wb-main"><div class="wb-toolbar"><label>Preview size `);
    $$renderer2.select(
      {
        value: sizeId,
        onchange: (event) => sizeId = event.currentTarget.value
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(SIZES);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let size = each_array_1[$$index_1];
          $$renderer3.option({ value: size.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(size.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</label> <span style="color: #5c6b63">Sizing the frame never edits the source — container rules respond to the frame,
          media rules to the window.</span> `);
    if (current().banner !== null) {
      $$renderer2.push(`<!--[0--><span role="alert" style="color: #b3401f; font-weight: bold">⚠ ${escape_html(current().banner)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="wb-canvas-scroll"><div class="wb-canvas-frame"${attr_style(`width:${frameWidth()}; max-width:100%`)}>`);
    EditorCanvas($$renderer2, {
      document: current().bridge.document,
      catalogs: designCatalogs,
      selectedOccurrence,
      onSelect: select,
      dispatch,
      navigate,
      onRenderDiagnostic: (diagnostic) => log("error", `${diagnostic.code}: ${diagnostic.message}`),
      ariaLabel: `${current().doc.label} canvas`
    });
    $$renderer2.push(`<!----></div></div></div> <div class="wb-resizer" role="separator" aria-orientation="vertical" aria-label="Resize inspector (left and right arrows)" tabindex="0"></div> <div class="wb-inspector"${attr_style(`width:${inspectorWidth}px`)}>`);
    Inspector($$renderer2, {
      document: current().bridge.document,
      selectedOccurrence,
      styleConditions: styleConditions(),
      readEffective
    });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    HistoryPanel($$renderer2, {
      revision: state()?.revision ?? "",
      storedRevision: state()?.storedRevision ?? "",
      dirty: state()?.dirty ?? false,
      canUndo: state()?.canUndo ?? false,
      canRedo: state()?.canRedo ?? false
    });
    $$renderer2.push(`<!----></div></div> <div class="wb-activity"><div class="wb-activity-header"><strong>Activity</strong> `);
    if (contactOutcome !== null && currentId === "service") {
      $$renderer2.push(`<!--[0--><span role="status">Form: ${escape_html(contactOutcome.heading)}
          ${escape_html(contactOutcome.status === "denied" ? contactOutcome.issues.map((issue) => issue.message).join(" ") : contactOutcome.detail)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button type="button"${attr("aria-expanded", activityOpen)}>${escape_html("Hide")}</button></div> `);
    {
      $$renderer2.push(`<!--[0--><ul class="wb-activity-list" aria-live="polite"><!--[-->`);
      const each_array_2 = ensure_array_like([...activity].reverse());
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let entry = each_array_2[$$index_2];
        $$renderer2.push(`<li${attr("data-kind", entry.kind)}>${escape_html(entry.text)}</li>`);
      }
      $$renderer2.push(`<!--]--></ul>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-D4KIdmkT.js.map
