/** Reusable presentation styles use the existing canonical source and edit session. */
import type { UiDocument, UiNode, UiStyleSource } from '@victframework/ui';
import type { TransactionDraft } from './commands.js';

type SourceInput = { readonly requestId: string; readonly document: UiDocument; readonly sourceId: string };
type AttachmentInput = SourceInput & { readonly nodeId: string };

export class StyleSourceEditError extends Error {
  readonly code = 'UI_STYLE_SOURCE_EDIT' as const;
  readonly field: 'sourceId' | 'nodeId' | 'index' | 'replace';
  readonly sourceId?: string;
  readonly nodeId?: string;
  constructor(message: string, field: StyleSourceEditError['field'], context: { sourceId?: string; nodeId?: string } = {}) {
    super(message.slice(0, 700));
    this.name = 'StyleSourceEditError';
    this.field = field;
    if (typeof context.sourceId === 'string') this.sourceId = context.sourceId.slice(0, 160);
    if (typeof context.nodeId === 'string') this.nodeId = context.nodeId.slice(0, 160);
  }
}
function identity(id: string, field: 'sourceId' | 'nodeId'): void {
  if (typeof id !== 'string' || id.trim().length === 0 || ['__proto__', 'constructor', 'prototype'].includes(id))
    throw new StyleSourceEditError('Use a nonempty safe identity.', field, { [field]: id });
}
function sourceFor(document: UiDocument, sourceId: string): UiStyleSource {
  identity(sourceId, 'sourceId');
  if (!Object.hasOwn(document.styleSources, sourceId)) throw new StyleSourceEditError(`Style source '${sourceId}' does not exist.`, 'sourceId', { sourceId });
  return document.styleSources[sourceId]!;
}
function styledNode(document: UiDocument, nodeId: string): Extract<UiNode, { kind: 'element' | 'component' }> {
  identity(nodeId, 'nodeId');
  const node = Object.hasOwn(document.nodes, nodeId) ? document.nodes[nodeId] : undefined;
  if (!node || (node.kind !== 'element' && node.kind !== 'component'))
    throw new StyleSourceEditError('A reusable style source requires an existing element or component target.', 'nodeId', { nodeId });
  return node;
}
function replacement(requestId: string, reason: string, document: UiDocument): TransactionDraft {
  return { requestId, reason, commands: [{ op: 'replaceDocument', document }] };
}

/** Create fresh source by default; replacing shared declarations is always explicit. */
export function defineStyleSource(input: {
  readonly requestId: string;
  readonly document: UiDocument;
  readonly source: UiStyleSource;
  readonly replace?: boolean;
}): TransactionDraft {
  identity(input.source.id, 'sourceId');
  const exists = Object.hasOwn(input.document.styleSources, input.source.id);
  if (input.replace === true ? !exists : exists)
    throw new StyleSourceEditError(input.replace === true ? 'Replacing a style source requires an existing identity.' : 'Style source already exists; use explicit replacement to update its shared declarations.', 'replace', { sourceId: input.source.id });
  // Keep typed condition/pseudo/token/binding data. The compiler owns their
  // validity and the same complete transaction validates manual and agent work.
  const source = structuredClone(input.source);
  return replacement(input.requestId, input.replace === true ? 'Update reusable style source' : 'Define reusable style source', {
    ...input.document, styleSources: { ...input.document.styleSources, [source.id]: source },
  });
}

/** Later attachments win within the source layer; local styles remain untouched. */
export function attachStyleSource(input: AttachmentInput & { readonly index?: number }): TransactionDraft {
  sourceFor(input.document, input.sourceId);
  const node = styledNode(input.document, input.nodeId);
  const sources = [...(node.styleSources ?? [])];
  if (sources.includes(input.sourceId)) throw new StyleSourceEditError('Style source is already attached to this target.', 'sourceId', input);
  const index = input.index ?? sources.length;
  if (!Number.isInteger(index) || index < 0 || index > sources.length)
    throw new StyleSourceEditError(`Style attachment index must be an integer from 0 to ${sources.length}.`, 'index', input);
  sources.splice(index, 0, input.sourceId);
  return replacement(input.requestId, 'Attach reusable style source', {
    ...input.document, nodes: { ...input.document.nodes, [node.id]: { ...node, styleSources: sources } },
  });
}

/** Detach one reference without changing the shared source or local styles. */
export function detachStyleSource(input: AttachmentInput): TransactionDraft {
  sourceFor(input.document, input.sourceId);
  const node = styledNode(input.document, input.nodeId);
  if (!node.styleSources?.includes(input.sourceId)) throw new StyleSourceEditError('Style source is not attached to this target.', 'sourceId', input);
  const sources = node.styleSources.filter(id => id !== input.sourceId);
  const { styleSources: _previousSources, ...rest } = node;
  return replacement(input.requestId, 'Detach reusable style source', {
    ...input.document, nodes: { ...input.document.nodes, [node.id]: sources.length ? { ...rest, styleSources: sources } : rest },
  });
}

/** No implicit detach or migration: every authored reference must be removed first. */
export function removeStyleSource(input: SourceInput): TransactionDraft {
  sourceFor(input.document, input.sourceId);
  const references = [
    ...Object.values(input.document.nodes).filter(node => node.styleSources?.includes(input.sourceId)).map(node => `node:${node.id}`),
    ...Object.values(input.document.nodes).flatMap(node=>Object.entries(node.partStyles??{}).filter(([,part])=>part.styleSources?.includes(input.sourceId)).map(([part])=>`node:${node.id}.part:${part}`)),
    ...Object.values(input.document.componentDefinitions).filter(definition => definition.baseStyle === input.sourceId).map(definition => `definition:${definition.id}.baseStyle`),
  ];
  if (references.length) throw new StyleSourceEditError(`Style source is still referenced by ${references.slice(0, 8).join(', ')}${references.length > 8 ? ', …' : ''}.`, 'sourceId', input);
  const sources = { ...input.document.styleSources };
  delete sources[input.sourceId];
  return replacement(input.requestId, 'Remove unused style source', { ...input.document, styleSources: sources });
}
