/**
 * `vict.application@3` — explicit UI attachment resolution (API-SPEC §2.2).
 *
 * Lives in `packages/application` because it resolves documents against the
 * SAME application/resources inputs as joint compilation. Rules:
 *
 * 1. every document-mode screen reference resolves to a catalog entry with
 *    equal (documentId, revision) — `UI_DOC_REFERENCE_DANGLING` otherwise;
 * 2. competing catalog entries for one key must agree on digest; a pin for
 *    a supplied key must match the entry digest — `UI_DOC_REVISION_COLLISION`;
 * 3. referenced documents validate cleanly; cycles in the STRUCTURAL
 *    EXPANSION GRAPH (U0 amendment A-01: only definition-level expansion
 *    can close a cycle; navigation and product references never do) are
 *    rejected with `UI_DOC_CYCLE`;
 * 4. product references resolve against the application inputs
 *    (`UI_DOC_UNKNOWN_PRODUCT_REFERENCE`);
 * 5. definition-registry scoping is enforced by `validateUiDocument`.
 *
 * Returns deterministic identity entries (A-03 ordering) and per-document
 * render plans for the compiled application plan.
 */

import {
  canonicalUiDocument,
  compileUiDocument,
  defaultSemanticElementCatalog,
  orderUiDocumentIdentityEntries,
  uiDiagnostic,
  validateUiDocument,
  type UiCatalogs,
  type UiDiagnostic,
  type UiDocument,
  type UiFieldTypes,
  isUiValueType,
  type UiValueType,
  type UiRenderPlan,
  type UiDocumentIdentityEntry,
  type UiExtensionDescriptor,
} from '@victframework/ui';

export interface UiDocumentCatalogEntryInput {
  readonly document: unknown;
}

export interface UiDocumentPinInput {
  readonly documentId: string;
  readonly revision: string;
  readonly contentDigest: string;
}

export interface ResolveUiAttachmentsInput {
  readonly application: unknown;
  readonly uiDocuments?: readonly UiDocumentCatalogEntryInput[];
  readonly uiDocumentPins?: readonly UiDocumentPinInput[];
  readonly uiExtensions?: readonly unknown[];
  /**
   * The contracts registry the application compile already loads
   * (`{id, revision}` entries); `deriveActionInputCatalog` resolves each
   * action's input-contract reference against it (fail-closed).
   */
  readonly contracts?: readonly unknown[];
  /** Declared application action ids (rule 4). */
  readonly actionIds: readonly string[];
  /** Declared application route ids (rule 4). */
  readonly routeIds: readonly string[];
  /** Typed view fields visible as `view.<field>` (rule 4). */
  readonly viewFields?: UiFieldTypes;
  /**
   * Declarative input types per contract (`contractId → { inputName →
   * primitive type }`), sourced from the application's own contract
   * declarations (amendment §3.5). The neutral contracts API carries
   * `parse` functions — declarative typing enters here or nowhere;
   * actions whose contract has no declared types contribute no input
   * typing (the dispatcher's contract checks stay the authority).
   */
  readonly contractInputTypes?: Readonly<Record<string, Readonly<Record<string, UiValueType>>>>;
}

/** Resolve passive field declarations from the exact input contract. Never execute parsers. */
export function deriveActionInputCatalog(
  actions: readonly unknown[], contracts: readonly unknown[] | undefined,
  /** @deprecated Use contract.presentationFields. Id-only fallback requires one registered revision. */
  legacyTypes: Readonly<Record<string, Readonly<Record<string, UiValueType>>>> = {},
): Readonly<Record<string, Readonly<Record<string, UiValueType>>>> {
  const catalog: Record<string, Readonly<Record<string, UiValueType>>> = {};
  for (const action of actions) {
    if (!isPlainObject(action) || typeof action.id !== 'string' || typeof action.inputContractId !== 'string') continue;
    const matching = (contracts ?? []).filter(contract => isPlainObject(contract) && contract.id === action.inputContractId &&
      (action.inputContractRevision === undefined || contract.revision === action.inputContractRevision));
    if (matching.length !== 1 || !isPlainObject(matching[0]) || typeof matching[0].revision !== 'string') continue;
    const contract = matching[0];
    const sameId = (contracts ?? []).filter(entry => isPlainObject(entry) && entry.id === contract.id);
    const fields = contract.presentationFields ?? legacyTypes[`${String(contract.id)}@${contract.revision}`]
      ?? (sameId.length === 1 ? legacyTypes[String(contract.id)] : undefined);
    if (!isPlainObject(fields)) continue; // absent: static shape unknown; runtime contract validation still required
    const entries = Object.entries(fields);
    if (!entries.every(([, type]) => typeof type === 'string' && isUiValueType(type))) continue;
    const types: Record<string, UiValueType> = {};
    for (const [name, type] of entries) if (typeof type === 'string' && isUiValueType(type)) types[name] = type;
    catalog[action.id] = Object.freeze(types);
  }
  return Object.freeze(catalog);
}

export interface ResolvedUiAttachments {
  /** Fatal diagnostics (errors). Warnings ride with the plans. */
  readonly issues: readonly UiDiagnostic[];
  /** Non-fatal diagnostics (warnings + deferred product-reference notes). */
  readonly warnings: readonly UiDiagnostic[];
  /** A-03 deterministic identity entries for the hashed payload. */
  readonly identityEntries: readonly UiDocumentIdentityEntry[];
  /** `${documentId}@${revision}` → compiled render plan. */
  readonly documentPlans: Readonly<Record<string, UiRenderPlan>>;
  /** Extension ids referenced by the compiled documents. */
  readonly extensionIds: readonly string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Collect component-instance references per document (for the expansion graph). */
interface DocFacts {
  readonly key: string;
  readonly document: UiDocument;
  readonly digest: string;
  /** definition ids instantiated by this document's instances/bodies (cross-ref edges). */
  readonly references: readonly string[];
  readonly ownDefinitionIds: ReadonlySet<string>;
}

function collectComponentReferences(document: UiDocument): readonly string[] {
  const references = new Set<string>();
  const nodes = (document.nodes ?? {}) as Record<string, { kind?: string; definitionId?: string }>;
  for (const node of Object.values(nodes)) {
    if (isPlainObject(node) && node.kind === 'component' && typeof node.definitionId === 'string') {
      references.add(node.definitionId);
    }
  }
  return [...references];
}

/** Resolve the explicit UI attachments. Never throws for invalid input. */
export function resolveUiAttachments(input: ResolveUiAttachmentsInput): ResolvedUiAttachments {
  const issues: UiDiagnostic[] = [];
  const warnings: UiDiagnostic[] = [];
  for (const contract of input.contracts ?? []) {
    if (!isPlainObject(contract) || contract.presentationFields === undefined) continue;
    const fields = contract.presentationFields;
    if (!isPlainObject(fields) || !Object.values(fields).every(type => typeof type === 'string' && isUiValueType(type))) {
      issues.push(uiDiagnostic('UI_COMPONENT_BINDING_INCOMPATIBLE', 'Declared action-input presentation types are invalid.', { documentId: '', nodeId: '', contractId: contract.id, revision: contract.revision }));
    }
  }

  // ---- shape + digests -----------------------------------------------------
  const byKey = new Map<string, { document: UiDocument; digest: string }>();
  const docFacts: DocFacts[] = [];
  const entries = input.uiDocuments ?? [];
  for (const [index, entry] of entries.entries()) {
    const candidate = entry?.document;
    if (!isPlainObject(candidate)) {
      issues.push(
        uiDiagnostic('UI_DOC_UNKNOWN_SCHEMA', `Catalog entry ${index} is not a document object.`, {
          schema: '(not an object)',
          supported: ['vict.ui-document@1'],
        }),
      );
      continue;
    }
    const documentId = typeof candidate.id === 'string' ? candidate.id : '';
    const revision = typeof candidate.revision === 'string' ? candidate.revision : '';
    if (candidate.schema !== 'vict.ui-document@1' || documentId === '' || revision === '') {
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNKNOWN_SCHEMA',
          `Catalog entry ${index} is not a vict.ui-document@1.`,
          {
            schema: String(candidate.schema),
            supported: ['vict.ui-document@1'],
          },
        ),
      );
      continue;
    }
    const { contentDigest } = canonicalUiDocument(candidate);
    const key = `${documentId}\u0000${revision}`;
    const existing = byKey.get(key);
    if (existing !== undefined) {
      if (existing.digest !== contentDigest) {
        issues.push(
          uiDiagnostic(
            'UI_DOC_REVISION_COLLISION',
            `Competing catalog entries for (${documentId}, ${revision}) disagree on contentDigest.`,
            {
              documentId,
              revision,
              digestA: existing.digest,
              digestB: contentDigest,
              authority: 'catalog',
            },
          ),
        );
      }
      continue;
    }
    const document = candidate as unknown as UiDocument;
    byKey.set(key, { document, digest: contentDigest });
    docFacts.push({
      key: `${documentId}@${revision}`,
      document,
      digest: contentDigest,
      references: collectComponentReferences(document),
      ownDefinitionIds: new Set(
        Object.keys((document.componentDefinitions ?? {}) as Record<string, unknown>),
      ),
    });
  }

  // ---- pins (rule 2) --------------------------------------------------------
  for (const pin of input.uiDocumentPins ?? []) {
    if (!isPlainObject(pin) || typeof pin.documentId !== 'string') continue;
    const key = `${pin.documentId}\u0000${String(pin.revision)}`;
    const entry = byKey.get(key);
    if (entry !== undefined && entry.digest !== pin.contentDigest) {
      issues.push(
        uiDiagnostic(
          'UI_DOC_REVISION_COLLISION',
          `Supplied pin for (${pin.documentId}, ${String(pin.revision)}) does not match the catalog entry digest.`,
          {
            documentId: pin.documentId,
            revision: String(pin.revision),
            digestA: entry.digest,
            digestB: pin.contentDigest,
            authority: 'pin',
          },
        ),
      );
    }
  }

  // ---- rule 1 + presentation-mode rule (§2.1) -------------------------------
  const application = input.application as { screens?: unknown } | undefined;
  const screens = Array.isArray(application?.screens) ? (application?.screens as unknown[]) : [];
  for (const screen of screens) {
    if (!isPlainObject(screen)) continue;
    const screenId = typeof screen.id === 'string' ? screen.id : '';
    const uiDocument = screen.uiDocument as
      { documentId?: unknown; revision?: unknown } | undefined;
    const found: string[] = [
      ...(uiDocument !== undefined ? ['uiDocument'] : []),
      ...(screen.layout !== undefined ? ['layout'] : []),
      ...(screen.layoutMode !== undefined ? ['layoutMode'] : []),
      ...(screen.composition !== undefined ? ['composition'] : []),
    ];
    // Exactly ONE presentation mode must be present.
    if (found.length !== 1) {
      issues.push(
        uiDiagnostic(
          'UI_APP_PRESENTATION_MODE_INVALID',
          found.length === 0
            ? 'A @3 screen must declare exactly one presentation mode (none found).'
            : 'A @3 screen must declare exactly one presentation mode (several found).',
          { screenId, found },
        ),
      );
      continue;
    }
    if (uiDocument === undefined) continue; // legacy screen — compile.ts validates the @2 fields
    const documentId = typeof uiDocument.documentId === 'string' ? uiDocument.documentId : '';
    const revision = typeof uiDocument.revision === 'string' ? uiDocument.revision : '';
    if (documentId === '' || revision === '') {
      issues.push(
        uiDiagnostic(
          'UI_APP_PRESENTATION_MODE_INVALID',
          'A document-mode screen reference needs non-empty documentId and revision strings.',
          { screenId, found: ['uiDocument(malformed)'] },
        ),
      );
      continue;
    }
    const key = `${documentId}\u0000${revision}`;
    if (byKey.get(key) === undefined) {
      issues.push(
        uiDiagnostic(
          'UI_DOC_REFERENCE_DANGLING',
          `Screen reference does not resolve in the catalog.`,
          {
            documentId,
            screenId,
            reference: `${documentId}@${revision}`,
          },
        ),
      );
    }
  }

  // ---- rule 3: per-document validation + expansion graph --------------------
  const allDefinitionIds = new Set<string>();
  for (const fact of docFacts) {
    for (const definitionId of fact.ownDefinitionIds) allDefinitionIds.add(definitionId);
  }
  const extensionIds: string[] = [];
  for (const extension of input.uiExtensions ?? []) {
    if (
      isPlainObject(extension) &&
      typeof extension.id === 'string' &&
      typeof extension.revision === 'string' &&
      typeof extension.rendererImplementationId === 'string'
    ) {
      allDefinitionIds.add(extension.id);
      extensionIds.push(extension.id);
    } else {
      issues.push(
        uiDiagnostic(
          'UI_DOC_UNKNOWN_PRODUCT_REFERENCE',
          'A uiExtensions entry is not a well-formed extension descriptor (id/revision/rendererImplementationId).',
          { documentId: '', nodeId: '', kind: 'extension', ref: '(descriptor)' },
        ),
      );
    }
  }

  const catalogsFor = (): UiCatalogs => ({
    elements: defaultSemanticElementCatalog(),
    actionIds: input.actionIds,
    routeIds: input.routeIds,
    ...(input.viewFields !== undefined ? { viewFields: input.viewFields } : {}),
  });

  const documentPlans: Record<string, UiRenderPlan> = {};
  const extensionRegistry: UiExtensionDescriptor[] = (input.uiExtensions ?? []).filter(
    (extension): extension is UiExtensionDescriptor => {
      if (!isPlainObject(extension)) return false;
      const candidate = extension as unknown as UiExtensionDescriptor;
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.revision === 'string' &&
        typeof candidate.rendererImplementationId === 'string'
      );
    },
  );
  for (const fact of docFacts) {
    const validation = validateUiDocument(fact.document, catalogsFor());
    // Component closure: unknown-in-own-document definitions are resolvable
    // when ANY catalog document or registered extension declares them; the
    // remaining unknowns stay fatal. Cross-document edges join the
    // expansion graph below (A-01).
    const fatal = validation.filter(
      (issue) =>
        issue.severity === 'error' &&
        !(
          issue.code === 'UI_DOC_UNKNOWN_COMPONENT' &&
          typeof issue.definitionId === 'string' &&
          allDefinitionIds.has(issue.definitionId)
        ),
    );
    if (fatal.length > 0) {
      issues.push(...fatal);
      continue;
    }
    const compiled = compileUiDocument(fact.document, catalogsFor().elements, extensionRegistry, {
      actionIds: input.actionIds,
      routeIds: input.routeIds,
      ...(input.viewFields !== undefined ? { viewFields: input.viewFields } : {}),
      actionInputs: deriveActionInputCatalog(
        Array.isArray((input.application as { actions?: unknown })?.actions)
          ? (input.application as { actions: readonly unknown[] }).actions
          : [],
        input.contracts,
        input.contractInputTypes,
      ),
    });
    if (!compiled.ok) {
      issues.push(...compiled.issues);
      continue;
    }
    documentPlans[fact.key] = compiled.plan;
    warnings.push(...compiled.plan.diagnostics);
    for (const reference of compiled.plan.extensions) extensionIds.push(reference.extensionId);
  }

  // ---- structural expansion graph (A-01) ------------------------------------
  // Nodes: `doc@rev` (document units) and `doc@rev#definitionId` (definition
  // units). Edges point AT definitions only, so cycles can occur only among
  // definitions: an instance in doc A resolving to a definition stored in
  // doc B creates A → B#def; a definition body instantiating another
  // definition creates defA → defB (same or cross document).
  const definitionOwner = new Map<string, string>(); // `${docKey}#${defId}` → docKey
  for (const fact of docFacts) {
    for (const definitionId of fact.ownDefinitionIds) {
      definitionOwner.set(`${fact.key}#${definitionId}`, fact.key);
    }
  }
  // adjacency among DEFINITION nodes
  const defEdges = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string): void => {
    const set = defEdges.get(from) ?? new Set<string>();
    set.add(to);
    defEdges.set(from, set);
  };
  for (const fact of docFacts) {
    for (const definitionId of fact.references) {
      const target = `${fact.key}#${definitionId}`;
      if (definitionOwner.has(target)) {
        // own-document definition: the document contains both sides — the
        // instantiation edge joins the graph as def→def below via bodies.
        continue;
      }
      // cross-document (or extension) reference — resolve the definition's owner
      for (const [nodeId, owner] of definitionOwner) {
        if (nodeId.endsWith(`#${definitionId}`) && owner !== fact.key) {
          addEdge(`${fact.key}#${definitionId}`, nodeId);
        }
      }
    }
    // definition-body instantiations (same + cross document)
    const nodes = (fact.document.nodes ?? {}) as Record<
      string,
      { kind?: string; definitionId?: string }
    >;
    for (const definitionId of fact.ownDefinitionIds) {
      const definition = (fact.document.componentDefinitions ??
        ({} as Record<string, { root?: string }>))[definitionId];
      const rootId = definition?.root;
      if (typeof rootId !== 'string') continue;
      const bodyNodes = (fact.document.nodes ?? {}) as Record<
        string,
        { kind?: string; definitionId?: string }
      >;
      void bodyNodes;
      const seen = new Set<string>();
      const stack = [rootId];
      while (stack.length > 0) {
        const nodeId = stack.pop() as string;
        if (seen.has(nodeId)) continue;
        seen.add(nodeId);
        const node = nodes[nodeId];
        if (!isPlainObject(node)) continue;
        if (node.kind === 'element' || node.kind === 'portal') {
          for (const child of (node as { children?: readonly string[] }).children ?? []) {
            stack.push(child);
          }
        } else if (node.kind === 'repeat') {
          stack.push((node as { templateRoot?: string }).templateRoot as string);
        } else if (node.kind === 'slot') {
          for (const child of (node as { fallback?: readonly string[] }).fallback ?? []) {
            stack.push(child);
          }
        } else if (node.kind === 'conditional') {
          for (const branch of (node as { branches?: readonly { children?: readonly string[] }[] })
            .branches ?? []) {
            for (const child of branch.children ?? []) stack.push(child);
          }
        } else if (node.kind === 'component' && node.definitionId !== undefined) {
          // instantiation edge from THIS definition
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
  // DFS cycle detection over definition nodes
  const IN_STACK = new Set<string>();
  const DONE = new Set<string>();
  const stack: string[] = [];
  const dfs = (node: string): void => {
    if (DONE.has(node)) return;
    if (IN_STACK.has(node)) {
      const start = stack.indexOf(node);
      issues.push(
        uiDiagnostic('UI_DOC_CYCLE', 'Cycle in the structural expansion graph.', {
          documentId: definitionOwner.get(node)?.split('@')[0] ?? '',
          path: stack.slice(start === -1 ? 0 : start).concat(node),
        }),
      );
      return;
    }
    IN_STACK.add(node);
    stack.push(node);
    for (const next of defEdges.get(node) ?? []) dfs(next);
    stack.pop();
    IN_STACK.delete(node);
    DONE.add(node);
  };
  for (const node of definitionOwner.keys()) dfs(node);

  // ---- A-03 deterministic identity entries ---------------------------------
  let identityEntries: readonly UiDocumentIdentityEntry[] = [];
  try {
    identityEntries = orderUiDocumentIdentityEntries(
      docFacts.map((fact) => ({
        documentId: fact.document.id,
        revision: String(fact.document.revision),
        contentDigest: fact.digest,
      })),
    );
  } catch (error) {
    issues.push(
      uiDiagnostic('UI_DOC_REVISION_COLLISION', 'Identity entries disagree on contentDigest.', {
        documentId: '',
        revision: '',
        digestA: String((error as Error).message),
        digestB: '',
        authority: 'catalog',
      }),
    );
  }

  return {
    issues,
    warnings,
    identityEntries,
    documentPlans,
    extensionIds: [...new Set(extensionIds)],
  };
}
