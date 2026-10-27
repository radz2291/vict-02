import {
  canonicalUiDocument,
  type UiDocument,
  type UiNode,
  type UiExtensionDescriptor,
} from '@victframework/ui';
import {
  authoredOccurrence,
  sourceIcon,
  type SourceIconKey,
  moveRelative,
  canInsertRecipe,
  type InsertRecipe,
  type TransactionDraft,
} from '@victframework/ui-editor';
import type { Node, Edge } from '@victframework/ui-flow-svelte';
import { studioNodeLabels,studioDisplayName,studioStyleName } from './presentation.js';
import { structureBehavior, structureStateName } from './structure-behavior.js';
import {
  projectRelations,
  relationLabels,
  type RelationRole,
  type StructureContext,
  type SemanticNode,
} from './structure-semantics.js';
export type { StructureContext } from './structure-semantics.js';

/** Graph ids identify source, never a transient rendered occurrence or array position. */
// Flow interpolates these ids into quoted attribute selectors. Encode the entire
// tuple so source quotes/backslashes cannot become selector syntax.
export const structureId = (documentId: string, kind: string, id: string) =>
  encodeURIComponent(JSON.stringify([documentId, kind, id]));
export function parseStructureId(value: string): readonly [string, string, string] | undefined {
  try {
    const tuple: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(tuple) &&
      tuple.length === 3 &&
      tuple.every((part) => typeof part === 'string')
      ? (tuple as [string, string, string])
      : undefined;
  } catch {
    return undefined;
  }
}
export type StructureNodeData = {
  label: string;
  fullLabel?: string;
  summary?: string;
  sourceId?: string;
  occurrence?: string;
  definitionSource?: boolean;
  kind: string;
  kindLabel?: string;
  iconKey?: SourceIconKey;
  childCount?: number;
  collapsedCount?: number;
  moveSource?: boolean;
  moveTarget?: boolean;
  direction?: string;
  scope?: string;
  registryId?: string;
  sourcePath?: string;
  support?: SemanticNode['support'];
  issues?: string[];
};
export type StructureEdgeData = Record<string, unknown> & {
  kind: 'containment' | 'binding' | 'definition';
  path: string;
  description?: string;
  role?: RelationRole;
  owner?: string;
  origin?: 'document' | 'host';
};
export type StructureGraph = { nodes: Node<StructureNodeData>[]; edges: Edge<StructureEdgeData>[] };
export type StructureHandoff = {
  destination: 'design' | 'layers' | 'inspector' | 'data' | 'actions';
  sourceId?: string;
  occurrence?: string;
  key?: string;
};

/** Hide only redundant literal text leaves. Source, ids and binding edges stay exact. */
export function compactStructure(graph: StructureGraph, document: UiDocument): StructureGraph {
  const hidden = new Set<string>();
  for (const node of graph.nodes) {
    const source = node.data.sourceId ? document.nodes[node.data.sourceId] : undefined;
    if (source?.kind !== 'text' || source.content.type !== 'literal') continue;
    const incident = graph.edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id,
    );
    if (incident.length !== 1 || incident[0]?.data?.kind !== 'containment') continue;
    const owner = graph.nodes.find((entry) => entry.id === incident[0]?.source);
    const parent = owner?.data.sourceId ? document.nodes[owner.data.sourceId] : undefined;
    if (
      parent?.kind === 'element' &&
      /^(p|h[1-6]|label|option|button|a)$/.test(parent.tag) &&
      parent.children.length === 1 &&
      owner
    ) {
      const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
      if (
        normalize(structureNodePresentation(document, owner.data).fullLabel ?? '') ===
        normalize(source.content.value)
      )
        hidden.add(node.id);
    }
  }
  return {
    nodes: graph.nodes.filter((node) => !hidden.has(node.id)),
    edges: graph.edges.filter((edge) => !hidden.has(edge.source) && !hidden.has(edge.target)),
  };
}

/** Graph-only identities adapt to the shared editor icon vocabulary. */
function structureIcon(kind:string):SourceIconKey {
 const keys:Readonly<Record<string,SourceIconKey>>={state:'state',action:'action',catalog:'catalog',definition:'catalog',route:'route',reference:'reference',style:'style',token:'token',condition:'conditional',asset:'asset',prop:'reference',output:'reference',item:'reference',overlay:'portal'};
 return keys[kind]??'container';
}

/** Concise presentation only; the full canonical facts remain in inspection. */
export function structureNodePresentation(
  document: UiDocument,
  data: StructureNodeData,
): StructureNodeData {
  const source = data.sourceId ? document.nodes[data.sourceId] : undefined;
  let label = data.label;
  let kind = data.kindLabel;
  let summary = data.summary;
  if (source?.kind === 'text') {
    summary = undefined;
    if (source.content.type === 'literal') label = source.content.value || 'Empty';
  }
  if (source && ['repeat', 'conditional', 'slot', 'portal'].includes(source.kind))
    summary = structureBehavior(document, source.id)[0]?.value;
  if (source?.kind === 'element') {
    if (
      source.id !== document.root &&
      typeof source.attributes?.['aria-label'] === 'string' &&
      source.attributes['aria-label'].trim()
    )
      label = source.attributes['aria-label'];
    if (/^h[1-6]$/.test(source.tag)) kind = 'Heading';
    else if (source.tag === 'p') kind = 'Paragraph';
    else
      kind =
        (
          {
            input:
              source.attributes?.type === 'checkbox'
                ? 'Checkbox'
                : source.attributes?.type === 'radio'
                  ? 'Radio'
                  : 'Input',
            textarea: 'Text area',
            select: 'Select',
            option: 'Option',
            label: 'Label',
            button: 'Button',
            a: 'Link',
            img: 'Image',
            form: 'Form',
            nav: 'Navigation',
            header: 'Header',
            footer: 'Footer',
            section: 'Section',
            article: 'Article',
            aside: 'Aside',
            ul: 'List',
            ol: 'List',
            li: 'List item',
            table: 'Table',
          } as Record<string, string>
        )[source.tag] ?? kind;
    const text = source.children.length === 1 ? document.nodes[source.children[0]!] : undefined;
    if (
      /^(p|h[1-6]|label|option|button|a)$/.test(source.tag) &&
      !source.attributes?.['aria-label'] &&
      text?.kind === 'text' &&
      text.content.type === 'literal'
    )
      label = text.content.value;
    summary =
      source.children.length &&
      /^(main|section|div|article|aside|header|footer|nav|form|fieldset|ul|ol)$/.test(source.tag)
        ? `${source.children.length} direct child${source.children.length === 1 ? '' : 'ren'}`
        : undefined;
  }
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  label = normalize(label);
  if (summary && normalize(summary).toLowerCase() === label.toLowerCase()) summary = undefined;
  return {
    ...data,
    iconKey: source ? sourceIcon(source) : structureIcon(data.kind),
    fullLabel: label,
    label: label.length > 76 ? `${label.slice(0, 75).trimEnd()}…` : label,
    kindLabel: kind,
    summary,
  };
}

export function structureChildren(node: UiNode): { id: string; label: string }[] {
  if (node.kind === 'element' || node.kind === 'portal')
    return node.children.map((id) => ({ id, label: 'contains' }));
  if (node.kind === 'component')
    return Object.entries(node.slots ?? {}).flatMap(([slot, fill]) =>
      fill.children.map((id) => ({ id, label: `slot: ${slot}` })),
    );
  if (node.kind === 'repeat') return [{ id: node.templateRoot, label: 'repeat template' }];
  if (node.kind === 'slot')
    return (node.fallback ?? []).map((id) => ({ id, label: `fallback: ${node.name}` }));
  if (node.kind === 'conditional')
    return node.branches.flatMap((branch, i) =>
      branch.children.map((id) => ({ id, label: `branch: ${branch.when ?? `else ${i + 1}`}` })),
    );
  return [];
}
const children = structureChildren;
const friendly = (value: string) =>
  value
    .replace(/^vict\.catalog\./, '')
    .replace(/[-_.]/g, ' ')
    .replace(/^./, (first) => first.toUpperCase());
const kindLabel = (node: UiNode) =>
  node.kind === 'component'
    ? 'Component'
    : node.kind === 'element'
      ? children(node).length
        ? 'Container'
        : 'Element'
      : friendly(node.kind);

/** Refuse definition templates, repeated projections and multiply-owned source paths. */
export function structureOccurrence(document: UiDocument, nodeId: string): string | undefined {
  return ownershipGuard(document)(nodeId) ? authoredOccurrence(document, nodeId) : undefined;
}
function ownershipGuard(document: UiDocument): (nodeId: string) => boolean {
  const definitionRoots = new Set(
    Object.values(document.componentDefinitions).flatMap((definition) => [
      definition.root,
      ...Object.values(definition.slots).flatMap((slot) => slot.fallback ?? []),
    ]),
  );
  const owners = new Map<string, UiNode[]>();
  for (const node of Object.values(document.nodes))
    for (const child of children(node))
      owners.set(child.id, [...(owners.get(child.id) ?? []), node]);
  const valid = new Map<string, boolean>();
  const check = (id: string, seen = new Set<string>()): boolean => {
    if (valid.has(id)) return valid.get(id)!;
    if (!document.nodes[id] || definitionRoots.has(id) || seen.has(id)) return false;
    seen.add(id);
    const parents = owners.get(id) ?? [];
    const result =
      id === document.root
        ? parents.length === 0
        : parents.length === 1 &&
          ['element', 'component', 'portal'].includes(parents[0]!.kind) &&
          check(parents[0]!.id, seen);
    valid.set(id, result);
    return result;
  };
  return (id) => check(id);
}

/** A read-only projection of actual authored containment, definitions and references. */
export function projectStructure(
  document: UiDocument,
  context: StructureContext = {},
): StructureGraph {
  const nodes: Node<StructureNodeData>[] = [];
  const edges: Edge<StructureEdgeData>[] = [];
  const known = new Map<string, Node<StructureNodeData>>();
  const edgeIds = new Set<string>();
  const key = (kind: string, id: string) => structureId(document.id, kind, id);
  const sourceNames = new Map(Object.entries(studioNodeLabels(document)));
  const uniquelyAuthored = ownershipGuard(document);
  // Visibility follows logical ownership, independently of permission to edit an occurrence.
  const definitionSources = new Set<string>();
  const markDefinition = (id: string) => {
    if (definitionSources.has(id)) return;
    definitionSources.add(id);
    const node = document.nodes[id];
    if (node) for (const child of children(node)) markDefinition(child.id);
  };
  for (const definition of Object.values(document.componentDefinitions)) {
    markDefinition(definition.root);
    for (const slot of Object.values(definition.slots))
      for (const id of slot.fallback ?? []) markDefinition(id);
  }
  const add = (kind: string, id: string, label: string, data: Partial<StructureNodeData> = {}) => {
    const graphId = key(kind, id);
    if (!known.has(graphId)) {
      const entry: Node<StructureNodeData> = {
        id: graphId,
        type: 'source',
        position: { x: 0, y: 0 },
        width: 224,
        data: { label, kind, ...data, ...(['state','action'].includes(kind)?{label:studioDisplayName(kind,id)}:kind==='style'?{label:studioStyleName(document,data.registryId??id)}:{}) },
        ariaLabel: `${data.kindLabel ?? friendly(kind)}: ${label}${data.sourceId ? `, source ${data.sourceId}` : ''}`,
        deletable: false,
      };
      nodes.push(entry);
      known.set(graphId, entry);
    } else {
      const existing = known.get(graphId)!;
      existing.data = { ...existing.data, ...data };
    }
    return graphId;
  };
  for (const node of Object.values(document.nodes)) {
    const description =
      node.kind === 'element'
        ? `<${node.tag}>`
        : node.kind === 'component'
          ? friendly(node.definitionId)
          : node.kind === 'text' && node.content.type === 'literal'
            ? node.content.value.slice(0, 55)
            : friendly(node.kind);
    add(
      'node',
      node.id,
      node.id === document.root ? 'Screen' : (sourceNames.get(node.id) ?? friendly(node.kind)),
      {
        sourceId: node.id,
        definitionSource: definitionSources.has(node.id),
        summary: description,
        kindLabel: kindLabel(node),
        childCount: children(node).length,
        occurrence: uniquelyAuthored(node.id) ? authoredOccurrence(document, node.id) : undefined,
      },
    );
  }
  for (const [id, state] of Object.entries(document.localState)) {
    const initial = state.initial;
    const start =
      initial === ''
        ? 'starts empty'
        : typeof initial === 'boolean'
          ? `initially ${initial ? 'on' : 'off'}`
          : typeof initial === 'number'
            ? `starts at ${initial}`
            : typeof initial === 'string'
              ? `starts with “${initial.length > 32 ? initial.slice(0, 31) + '…' : initial}”`
              : Array.isArray(initial)
                ? `${initial.length} initial items`
                : 'declared starting value';
    add('state', id, structureStateName(id), {
      summary: `${state.type === 'string' ? 'Text' : friendly(state.type)} · ${start}`,
      kindLabel: 'State',
    });
  }
  projectRelations(
    document,
    {
      add,
      node: (id) => key('node', id),
      link: (source, target, spec) => {
        const from = known.get(source),
          to = known.get(target);
        const definition =
          spec.role === 'uses' ||
          spec.role === 'defines' ||
          (spec.role === 'fallback' && from?.data.kind === 'definition');
        const containment =
          ['contains', 'slot', 'branch', 'otherwise', 'template'].includes(spec.role) ||
          (spec.role === 'fallback' && from?.data.kind === 'node' && to?.data.kind === 'node');
        const kind = definition ? 'definition' : containment ? 'containment' : 'binding';
        const id = encodeURIComponent(JSON.stringify([source, target, spec.role, spec.path]));
        if (edgeIds.has(id)) return;
        edgeIds.add(id);
        edges.push({
          id,
          source,
          target,
          label: relationLabels[spec.role],
          type: 'routed',
          deletable: false,
          data: { kind, ...spec },
          ariaLabel: `${from?.data.fullLabel ?? from?.data.label ?? ''} -> ${to?.data.fullLabel ?? to?.data.label ?? ''}: ${relationLabels[spec.role]}; ${spec.path}${spec.description ? `; ${spec.description}` : ''}`,
        });
      },
    },
    context,
  );
  for (const issue of context.plan?.documentId === document.id &&
  context.plan.sourceDigest === canonicalUiDocument(document).contentDigest
    ? context.plan.diagnostics
    : []) {
    let affected = nodes.filter((node) => node.data.sourceId === issue.nodeId);
    if (
      !affected.length &&
      typeof issue.feature === 'string' &&
      issue.feature.startsWith('condition:')
    ) {
      const conditionKind = issue.feature.slice('condition:'.length);
      affected = nodes.filter(
        (node) =>
          node.data.kind === 'style' &&
          Object.values(document.styleSources).some(
            (style) =>
              (key('style', style.id) === node.id || node.data.registryId === style.id) &&
              style.conditionId &&
              document.conditions[style.conditionId]?.kind === conditionKind,
          ),
      );
    }
    if (!affected.length) affected = nodes.filter((node) => node.data.sourceId === document.root);
    for (const node of affected) {
      node.data.issues = [...(node.data.issues ?? []), `${issue.code}: ${issue.message}`];
      node.data.support =
        issue.code === 'UI_DOC_UNSUPPORTED_FEATURE'
          ? 'Unsupported'
          : issue.severity === 'error'
            ? 'Unknown'
            : node.data.support;
    }
  }
  // Deterministic initial layout only. Never inserted into canonical document bytes.
  const levels = new Map<string, number>([[document.root, 0]]);
  const visit = (id: string, level: number) => {
    const node = document.nodes[id];
    if (!node) return;
    for (const child of children(node))
      if (!levels.has(child.id)) {
        levels.set(child.id, level + 1);
        visit(child.id, level + 1);
      }
  };
  visit(document.root, 0);
  const rows = new Map<number, number>();
  const lastLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of nodes) {
    const level = node.data.sourceId
      ? (levels.get(node.data.sourceId) ?? lastLevel)
      : lastLevel + 1;
    const row = rows.get(level) ?? 0;
    rows.set(level, row + 1);
    node.position = { x: level * 290, y: row * 125 };
  }
  return {
    nodes: nodes.map((node) => {
      const presentation = structureNodePresentation(document, node.data);
      return {
        ...node,
        data: {
          ...node.data,
          fullLabel: presentation.fullLabel,
          kindLabel: presentation.kindLabel,
        },
        ariaLabel: `${presentation.kindLabel ?? friendly(node.data.kind)}: ${presentation.fullLabel}${node.data.sourceId ? `, source ${node.data.sourceId}` : ''}`,
      };
    }),
    edges,
  };
}

/** Exact declared values and bindings; never inferred runtime values or defects. */
export function structureFacts(
  document: UiDocument,
  node: Node<StructureNodeData>,
  context: StructureContext = {},
): { path: string; value: string }[] {
  const tuple = parseStructureId(node.id);
  if (!tuple) return [];
  const [, kind, id] = tuple;
  const value =
    kind === 'node'
      ? document.nodes[id]
      : kind === 'state'
        ? document.localState[id]
        : kind === 'definition'
          ? document.componentDefinitions[id]
          : kind === 'style'
            ? document.styleSources[node.data.registryId ?? id]
            : kind === 'condition'
              ? document.conditions[id]
              : kind === 'token'
                ? document.tokens[id]
                : kind === 'asset'
                  ? document.assets[id]
                  : kind === 'catalog'
                    ? context.descriptors?.find(
                        (descriptor) => `${descriptor.id}@${descriptor.revision}` === id,
                      )
                    : kind === 'action'
                      ? { id, boundary: 'External', connections: context.actionState?.[id] }
                      : undefined;
  if (!value)
    return [
      { path: kind, value: id },
      ...(node.data.scope ? [{ path: 'Scope', value: node.data.scope }] : []),
      ...(node.data.sourcePath ? [{ path: 'Source', value: node.data.sourcePath }] : []),
    ];
  const result: { path: string; value: string }[] = [];
  function visit(entry: unknown, path: string) {
    if (entry && typeof entry === 'object') {
      for (const [key, nested] of Object.entries(entry))
        visit(nested, path ? `${path}.${key}` : key);
    } else
      result.push({
        path,
        value: typeof entry === 'string' ? entry : (JSON.stringify(entry) ?? String(entry)),
      });
  }
  visit(value, '');
  return result;
}

export type StructureFilter = {
  search?: string;
  focusId?: string;
  collapsed?: ReadonlySet<string>;
  bindings?: boolean;
  definitions?: boolean;
  inventory?: boolean;
};

/** A bounded, direct neighbourhood. Other users of shared references are opt-in. */
export function connectedStructure(
  graph: StructureGraph,
  focusId: string,
  options: { related?: boolean; limit?: number; expanded?: ReadonlySet<string> } = {},
): StructureGraph {
  if (!graph.nodes.some((node) => node.id === focusId)) return { nodes: [], edges: [] };
  const direct = graph.edges.filter((edge) => edge.source === focusId || edge.target === focusId);
  const visible = new Set([focusId, ...direct.flatMap((edge) => [edge.source, edge.target])]);
  const groupChildren = new Set<string>();
  // Only deliberate group expansion adds another hierarchy level. Do not
  // automatically traverse the whole tree through the selected item's parent.
  for (const id of visible)
    if (options.expanded?.has(id)) {
      groupChildren.add(id);
      for (const edge of graph.edges)
        if (edge.source === id && edge.data?.kind === 'containment') {
          visible.add(edge.target);
          groupChildren.add(edge.target);
        }
    }
  for (const edge of graph.edges)
    if (
      edge.data?.kind !== 'containment' &&
      (groupChildren.has(edge.source) ||
        groupChildren.has(edge.target) ||
        groupChildren.has(edge.data?.owner ?? ''))
    ) {
      visible.add(edge.source);
      visible.add(edge.target);
    }
  if (options.related) {
    const references = new Set(
      graph.nodes
        .filter((node) => visible.has(node.id) && node.data.kind !== 'node')
        .map((node) => node.id),
    );
    for (const edge of graph.edges)
      if (
        edge.data?.kind !== 'containment' &&
        (references.has(edge.source) || references.has(edge.target))
      ) {
        visible.add(edge.source);
        visible.add(edge.target);
      }
  }
  const limit = Math.max(1, options.limit ?? 25);
  const auxiliary = new Set(
    graph.nodes.filter((node) => node.data.kind !== 'node').map((node) => node.id),
  );
  const ordered = [
    focusId,
    ...[...visible].filter((id) => id !== focusId && auxiliary.has(id)),
    ...[...visible].filter((id) => id !== focusId && !auxiliary.has(id)),
  ];
  const bounded = new Set(ordered.slice(0, limit));
  return {
    nodes: graph.nodes.filter((node) => bounded.has(node.id)),
    edges: graph.edges.filter((edge) => bounded.has(edge.source) && bounded.has(edge.target)),
  };
}
/** Union of direct neighbourhoods; every requested item survives the display bound. */
export function connectedSelectionStructure(graph:StructureGraph,ids:readonly string[],options:Parameters<typeof connectedStructure>[2]={}):StructureGraph {
 const roots=[...new Set(ids)].filter(id=>graph.nodes.some(node=>node.id===id));
 const visible=new Set(roots);
 for(const id of roots)for(const node of connectedStructure(graph,id,{...options,limit:Infinity}).nodes)visible.add(node.id);
 const ordered=[...roots,...[...visible].filter(id=>!roots.includes(id))];
 const bounded=new Set(ordered.slice(0,Math.max(roots.length,options.limit??25)));
 return {nodes:graph.nodes.filter(node=>bounded.has(node.id)),edges:graph.edges.filter(edge=>bounded.has(edge.source)&&bounded.has(edge.target))};
}

/** Collapse and layers are view projections. They do not alter canonical ownership. */
/** Shared by projection and toolbar: counts exact matches, never their context. */
export function structureMatches(node: Node<StructureNodeData>, search: string): boolean {
  const query=search.trim().toLowerCase();
  return !!query && `${node.data.fullLabel ?? node.data.label} ${node.data.kindLabel} ${node.data.summary} ${node.data.sourceId ?? parseStructureId(node.id)?.[2]}`.toLowerCase().includes(query);
}

export function filterStructure(
  graph: StructureGraph,
  options: StructureFilter = {},
): StructureGraph {
  const containment = graph.edges.filter((edge) => edge.data?.kind === 'containment');
  const descendants = (id: string, found = new Set<string>()): Set<string> => {
    for (const edge of containment)
      if (edge.source === id && !found.has(edge.target)) {
        found.add(edge.target);
        descendants(edge.target, found);
      }
    return found;
  };
  const query = options.search?.trim().toLowerCase();
  let visible = new Set(
    graph.nodes
      .filter(
        (node) => node.data.kind === 'node' && (options.definitions || !node.data.definitionSource),
      )
      .map((node) => node.id),
  );
  if (query) {
    visible = new Set(
      graph.nodes
        .filter((node) => structureMatches(node, query))
        .map((node) => node.id),
    );
    // Show the path to each match without expanding the rest of the tree.
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of containment)
        if (visible.has(edge.target) && !visible.has(edge.source)) {
          visible.add(edge.source);
          changed = true;
        }
    }
  } else {
    for (const id of options.collapsed ?? [])
      for (const child of descendants(id)) visible.delete(child);
  }
  if (options.focusId && !query) {
    const focus = new Set([options.focusId, ...descendants(options.focusId)]);
    for (const edge of containment) if (edge.target === options.focusId) focus.add(edge.source);
    if (graph.nodes.find((node) => node.id === options.focusId)?.data.kind !== 'node') {
      for (const edge of graph.edges)
        if (edge.source === options.focusId || edge.target === options.focusId) {
          focus.add(edge.source);
          focus.add(edge.target);
        }
      visible = focus;
    } else {
      visible = new Set([...visible].filter((id) => focus.has(id)));
      visible.add(options.focusId);
    }
  }
  const enabledEdges = graph.edges.filter(
    (edge) =>
      edge.data?.kind === 'containment' ||
      (edge.data?.kind === 'binding' ? options.bindings : options.definitions),
  );
  // Follow data providers in either direction, never pull in unrelated consumers.
  if (options.inventory && !query)
    for (const node of graph.nodes)
      if (
        node.data.kind !== 'node' &&
        (options.definitions || !['definition', 'catalog'].includes(node.data.kind)) &&
        options.bindings
      )
        visible.add(node.id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of enabledEdges) {
      const owned = !!edge.data?.owner && visible.has(edge.data.owner);
      for (const [from, to] of [
        [edge.source, edge.target],
        [edge.target, edge.source],
      ]) {
        const target = graph.nodes.find((node) => node.id === to);
        if ((visible.has(from) || owned) && target?.data.kind !== 'node' && !visible.has(to)) {
          visible.add(to);
          changed = true;
        }
      }
    }
  }
  const nodes = graph.nodes
    .filter((node) => visible.has(node.id))
    .map((node) => ({
      ...node,
      data: {
        ...node.data,
        collapsedCount:
          !query && options.collapsed?.has(node.id) ? descendants(node.id).size : undefined,
      },
    }));
  return {
    nodes,
    edges: enabledEdges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)),
  };
}

export type StructureEditRequest = {
  documentId: string;
  revision: string;
  source: string;
  target: string;
};
export function structureMove(
  document: UiDocument,
  revision: string,
  request: StructureEditRequest,
  blocked: boolean,
  descriptors: readonly UiExtensionDescriptor[],
  recipes: readonly InsertRecipe[] = [],
): { ok: true; draft: TransactionDraft } | { ok: false; message: string } {
  if (blocked)
    return { ok: false, message: 'Apply or cancel your draft before changing structure.' };
  if (request.documentId !== document.id || request.revision !== revision)
    return {
      ok: false,
      message: 'The source changed while connecting. Retry against the current structure.',
    };
  const sourceTuple = parseStructureId(request.source);
  const targetTuple = parseStructureId(request.target);
  const sourceId =
    sourceTuple?.[0] === document.id && sourceTuple[1] === 'node' ? sourceTuple[2] : undefined;
  const targetId =
    targetTuple?.[0] === document.id && targetTuple[1] === 'node' ? targetTuple[2] : undefined;
  if (
    !sourceId ||
    !targetId ||
    !structureOccurrence(document, sourceId) ||
    !structureOccurrence(document, targetId)
  )
    return {
      ok: false,
      message:
        'Only unambiguous authored nodes can be moved. Definitions, repeats and bindings are inspectable references.',
    };
  const command = moveRelative(document, sourceId, targetId, 'inside', descriptors);
  if (!command)
    return {
      ok: false,
      message:
        'Move refused: choose a different container with one unambiguous slot. Root, cycle and unsupported connections are not edits.',
    };
  const sourceNode = document.nodes[sourceId];
  const recipe =
    sourceNode?.kind === 'component'
      ? recipes.find((entry) => entry.id === sourceNode.definitionId.replace('vict.catalog.', ''))
      : undefined;
  if (
    recipe &&
    !canInsertRecipe(recipe, document, { nodeId: command.newParentId, slotName: command.slotName })
  )
    return {
      ok: false,
      message:
        'This component requires its declared parent and slot. Choose a compatible composition in Design.',
    };
  return {
    ok: true,
    draft: {
      requestId: crypto.randomUUID(),
      reason: 'Move source node from structure',
      commands: [command],
    },
  };
}
