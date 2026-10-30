import type { UiDocument, UiNode, UiSlotScope, UiValue } from '@victframework/ui';
import {
  parseGraph,
  applyGraphPatch,
  parseGraphV2,
  applyGraphPatchV2,
  graphAuthoringContract,
} from '@victframework/ui-flow-svelte';

/** Exact component version selects grammar; graph contents never select a migration. */
export function authoredGraphVersion(node: UiNode | undefined): 1 | 2 | undefined {
  if (node?.kind !== 'component') return;
  return graphAuthoringContract(node.definitionId, node.revision)?.modelVersion;
}

/** Only an explicitly bidirectional graph binding grants authoring persistence.
 * Other runtime state (search, chat drafts, simulated data) remains ephemeral. */
export function authoredGraphBinding(node: UiNode | undefined): string | undefined {
  if (node?.kind !== 'component' || !authoredGraphVersion(node)) return;
  const contract = graphAuthoringContract(node.definitionId, node.revision)!;
  const read = node.props?.[contract.valueProp],
    write = node.outputs?.[contract.changeOutput];
  if (
    read?.type !== 'ref' ||
    !read.path.startsWith('state.') ||
    !write ||
    !('setState' in write) ||
    write.setState.value
  )
    return;
  const key = read.path.slice(6);
  return write.setState.key === key ? key : undefined;
}

/** Lexical source ownership is independent of a rendered occurrence. A scoped
 * slot replaces state; a coincidentally equal document key is never a fallback. */
export type GraphStateOwner =
  | { kind: 'document'; key: string }
  | { kind: 'slot'; ownerNodeId: string; slotName: string; key: string; controlled: boolean };
export type GraphSourceOwner = GraphStateOwner | { kind: 'literal'; nodeId: string };
type LexicalOwner =
  | { kind: 'document' }
  | { kind: 'slot'; ownerNodeId: string; slotName: string; scope: UiSlotScope };
export function graphLexicalOwners(
  document: UiDocument,
): Map<string, readonly LexicalOwner[]> & { readonly complete: boolean } {
  const result = new Map<string, LexicalOwner[]>(),
    incoming = new Set<string>();
  const children = (node: UiNode): string[] => {
    if (node.kind === 'element' || node.kind === 'portal') return [...node.children];
    if (node.kind === 'conditional') return node.branches.flatMap((branch) => [...branch.children]);
    if (node.kind === 'repeat') return [node.templateRoot];
    if (node.kind === 'slot') return [...(node.fallback ?? [])];
    if (node.kind === 'component')
      return [
        ...Object.values(node.slots ?? {}).flatMap((fill) => [...fill.children]),
        ...(document.componentDefinitions[node.definitionId]
          ? [document.componentDefinitions[node.definitionId]!.root]
          : []),
      ];
    return [];
  };
  for (const node of Object.values(document.nodes))
    for (const id of children(node)) incoming.add(id);
  const root: LexicalOwner = { kind: 'document' };
  let visited = 0,
    complete = true;
  const same = (a: LexicalOwner, b: LexicalOwner) =>
    a.kind === b.kind &&
    (a.kind === 'document' ||
      (b.kind === 'slot' && a.ownerNodeId === b.ownerNodeId && a.slotName === b.slotName));
  function visit(id: string, owner: LexicalOwner, path: readonly string[] = []): void {
    if (++visited > 16384 || path.includes(id)) {
      complete = false;
      return;
    }
    const node = document.nodes[id];
    if (!node) {
      complete = false;
      return;
    }
    const owners = result.get(id) ?? [];
    if (owners.some((value) => same(value, owner))) return;
    owners.push(owner);
    result.set(id, owners);
    const next = [...path, id];
    if (node.kind === 'component') {
      for (const [slotName, fill] of Object.entries(node.slots ?? {}))
        for (const child of fill.children)
          visit(
            child,
            fill.scope ? { kind: 'slot', ownerNodeId: id, slotName, scope: fill.scope } : owner,
            next,
          );
      const definition = document.componentDefinitions[node.definitionId];
      if (definition) visit(definition.root, owner, next);
    } else for (const child of children(node)) visit(child, owner, next);
  }
  visit(document.root, root);
  // Detached source roots remain editable, but scoped children do not become
  // document-owned simply because their node record precedes their parent.
  for (const id of Object.keys(document.nodes))
    if (!result.has(id) && !incoming.has(id)) visit(id, root);
  // An incomplete traversal cannot establish uniqueness. Never retain the
  // convenient shallow owner while a deeper conflicting occurrence is unknown.
  if (!complete) result.clear();
  return Object.assign(result, { complete });
}
function stateOwner(
  document: UiDocument,
  nodeId: string,
  key: string,
  owners = graphLexicalOwners(document),
): GraphStateOwner | undefined {
  const contexts = owners.get(nodeId);
  if (!contexts?.length) return;
  const resolved = contexts.map((owner) =>
    owner.kind === 'document'
      ? { kind: 'document' as const, key }
      : owner.scope.state?.[key]
        ? {
            kind: 'slot' as const,
            ownerNodeId: owner.ownerNodeId,
            slotName: owner.slotName,
            key,
            controlled: owner.scope.state[key]!.controlled === true,
          }
        : undefined,
  );
  if (resolved.some((owner) => !owner)) return;
  const first = resolved[0]!;
  return resolved.every((owner) => JSON.stringify(owner) === JSON.stringify(first))
    ? first
    : undefined;
}
export function graphSourceOwnership(
  document: UiDocument,
  nodeId: string,
): GraphSourceOwner | undefined {
  const node = document.nodes[nodeId];
  if (node?.kind !== 'component' || !authoredGraphVersion(node)) return;
  if (node.props?.graph?.type === 'literal') return { kind: 'literal', nodeId };
  const key = authoredGraphBinding(node);
  return key ? stateOwner(document, nodeId, key) : undefined;
}
export function graphStateKeys(document: UiDocument): string[] {
  const owners = graphLexicalOwners(document);
  return [
    ...new Set(
      Object.values(document.nodes).flatMap((node) => {
        const key = authoredGraphBinding(node);
        return key && stateOwner(document, node.id, key, owners)?.kind === 'document' ? [key] : [];
      }),
    ),
  ];
}
/** A canonical source change owns graph values. Preserve other simulation state,
 * but never let a prior runtime mirror hide a later manual or agent graph edit. */
export function rebaseGraphRuntime(
  document: UiDocument,
  values: Readonly<Record<string, UiValue>>,
): Record<string, UiValue> {
  const next = { ...values };
  for (const key of graphStateKeys(document)) {
    const declaration = document.localState[key];
    if (declaration?.type === 'string') next[key] = declaration.initial;
    else delete next[key];
  }
  return next;
}
export function graphStateDocument(
  document: UiDocument,
  key: string,
  value: unknown,
): UiDocument | undefined {
  if (
    !graphStateKeys(document).includes(key) ||
    document.localState[key]?.type !== 'string' ||
    typeof value !== 'string' ||
    value.length > 180000
  )
    return;
  const owners = graphLexicalOwners(document);
  const consumers = Object.values(document.nodes).filter(
    (node) =>
      node.kind === 'component' &&
      authoredGraphVersion(node) &&
      node.props?.graph?.type === 'ref' &&
      node.props.graph.path === `state.${key}` &&
      stateOwner(document, node.id, key, owners)?.kind === 'document',
  );
  if (
    consumers.some(
      (node) => !(authoredGraphVersion(node) === 2 ? parseGraphV2(value) : parseGraph(value)).ok,
    )
  )
    return;
  if (document.localState[key]?.initial === value) return document;
  return {
    ...document,
    localState: { ...document.localState, [key]: { ...document.localState[key]!, initial: value } },
  };
}
/** Exact outer-to-inner graph-node address. Every source revision is fenced;
 * selecting one instance never changes its family default or sibling values. */
export type GraphOccurrenceRoute = readonly {
  workspaceNodeId: string;
  graphNodeId: string;
  expectedGraphRevision: number;
}[];
type GraphFailure = { ok: false; message: string };
type GraphSource = { source: string; write: (value: string) => UiDocument | undefined };
/** The same exact source/occurrence resolver as editGraph, without a write. */
export function inspectAuthoredGraphSource(
  document: UiDocument,
  nodeId: string,
  route: GraphOccurrenceRoute = [],
): { ok: true; source: string } | GraphFailure {
  const owned = graphSource(document, nodeId, route);
  return 'ok' in owned ? owned : { ok: true, source: owned.source };
}
function graphSource(
  document: UiDocument,
  nodeId: string,
  route: GraphOccurrenceRoute,
  seen: readonly string[] = [],
): GraphSource | GraphFailure {
  if (seen.includes(nodeId) || seen.length > 32 || route.length > 32)
    return { ok: false, message: 'The graph occurrence route is cyclic or exceeds its bound.' };
  const node = document.nodes[nodeId],
    owner = graphSourceOwnership(document, nodeId);
  if (node?.kind !== 'component' || !owner)
    return {
      ok: false,
      message:
        'The graph has no unambiguous lexical source owner. Bind graph and graphChange in the same declared scope, or use a literal graph.',
    };
  const checked = (source: unknown, write: GraphSource['write']): GraphSource | GraphFailure =>
    typeof source === 'string'
      ? {
          source,
          write: (value) => {
            if (value.length > 180000) return;
            if (owner.kind !== 'literal') {
              const owners = graphLexicalOwners(document);
              const readers = Object.values(document.nodes).filter(
                (item) =>
                  item.kind === 'component' &&
                  authoredGraphVersion(item) &&
                  item.props?.graph?.type === 'ref' &&
                  item.props.graph.path === `state.${owner.key}` &&
                  JSON.stringify(stateOwner(document, item.id, owner.key, owners)) ===
                    JSON.stringify(owner),
              );
              if (
                readers.some(
                  (item) =>
                    !(authoredGraphVersion(item) === 2 ? parseGraphV2(value) : parseGraph(value))
                      .ok,
                )
              )
                return;
            }
            return write(value);
          },
        }
      : { ok: false, message: 'The graph owner must declare a string source.' };
  if (owner.kind === 'literal')
    return route.length
      ? { ok: false, message: 'This graph does not accept an occurrence route.' }
      : checked(
          node.props!.graph.type === 'literal' ? node.props!.graph.value : undefined,
          (value) => ({
            ...document,
            nodes: {
              ...document.nodes,
              [nodeId]: { ...node, props: { ...node.props, graph: { type: 'literal', value } } },
            },
          }),
        );
  if (owner.kind === 'document')
    return route.length
      ? { ok: false, message: 'The graph occurrence route does not match its lexical owner.' }
      : checked(
          document.localState[owner.key]?.type === 'string'
            ? document.localState[owner.key]!.initial
            : undefined,
          (value) => graphStateDocument(document, owner.key, value),
        );
  const parent = document.nodes[owner.ownerNodeId];
  if (parent?.kind !== 'component')
    return { ok: false, message: 'The scoped graph owner is unavailable.' };
  const fill = parent.slots?.[owner.slotName],
    declaration = fill?.scope?.state?.[owner.key];
  if (!fill?.scope || declaration?.type !== 'string')
    return { ok: false, message: 'The scoped graph owner must declare a string source.' };
  if (!owner.controlled) {
    if (route.length)
      return {
        ok: false,
        message: 'Private scoped state edits its authored initial value, not an occurrence value.',
      };
    return checked(declaration.initial, (value) => ({
      ...document,
      nodes: {
        ...document.nodes,
        [parent.id]: {
          ...parent,
          slots: {
            ...parent.slots,
            [owner.slotName]: {
              ...fill,
              scope: {
                ...fill.scope!,
                state: { ...fill.scope!.state, [owner.key]: { ...declaration, initial: value } },
              },
            },
          },
        },
      },
    }));
  }
  const entry = route.at(-1);
  const host = graphAuthoringContract(parent.definitionId, parent.revision);
  if (
    !entry ||
    entry.workspaceNodeId !== owner.ownerNodeId ||
    host?.body?.slot !== owner.slotName ||
    host.body.controlledState !== 'node-parameters' ||
    host.modelVersion !== 2
  )
    return {
      ok: false,
      message:
        'Controlled scoped graph editing requires an exact containing workspace/node occurrence route.',
    };
  const outer = graphSource(document, entry.workspaceNodeId, route.slice(0, -1), [...seen, nodeId]);
  if ('ok' in outer) return outer;
  const parsed = parseGraphV2(outer.source);
  if (!parsed.ok || parsed.graph.revision !== entry.expectedGraphRevision)
    return {
      ok: false,
      message: 'The containing graph revision is stale or its source is invalid.',
    };
  const member = parsed.graph.nodes.find((item) => item.id === entry.graphNodeId),
    family = parsed.graph.nodeTypes.find((item) => item.id === member?.type),
    parameter = family?.parameters[owner.key];
  if (!member || parameter?.type !== 'string')
    return {
      ok: false,
      message:
        'The occurrence route must select an existing graph node with the declared string parameter.',
    };
  return checked(member.values[owner.key] ?? parameter.default, (value) => {
    const next = applyGraphPatchV2(
      outer.source,
      [{ type: 'setParameter', nodeId: member.id, key: owner.key, value }],
      entry.expectedGraphRevision,
    );
    return next.ok ? outer.write(next.source) : undefined;
  });
}
export function patchAuthoredGraph(
  document: UiDocument,
  nodeId: string,
  operations: unknown,
  revision: number,
  route: GraphOccurrenceRoute = [],
): { ok: true; document: UiDocument } | GraphFailure {
  const node = document.nodes[nodeId],
    version = authoredGraphVersion(node);
  if (node?.kind !== 'component' || !version)
    return {
      ok: false,
      message: 'editGraph requires an exact authored graph workspace or retained graph component.',
    };
  const owned = graphSource(document, nodeId, route);
  if ('ok' in owned) return owned;
  const source = owned.source;
  const result =
    version === 2
      ? applyGraphPatchV2(source, operations, revision)
      : applyGraphPatch(source, operations, revision);
  if (!result.ok || !result.source)
    return {
      ok: false,
      message: !result.ok
        ? result.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join('; ')
            .slice(0, 1200)
        : 'Graph patch produced no source.',
    };
  if (result.source.length > 180000)
    return { ok: false, message: 'The graph update exceeds the authoring boundary.' };
  const next = owned.write(result.source);
  return next
    ? { ok: true, document: next }
    : { ok: false, message: 'The graph update exceeds the authoring boundary.' };
}
