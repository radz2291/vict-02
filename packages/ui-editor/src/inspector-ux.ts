import type { UiDocument, UiNode, UiStyleValue } from '@victframework/ui';

/** Optional host presentation metadata; never persisted as product semantics. */
export interface EditorLabels {
  readonly nodes?: Readonly<Record<string, string>>;
  readonly definitions?: Readonly<Record<string, string>>;
  readonly actions?: Readonly<Record<string, string>>;
  readonly routes?: Readonly<Record<string, string>>;
}

export function nodeLabel(document: UiDocument, id: string, labels: EditorLabels = {}): string {
  if (labels.nodes?.[id]) return labels.nodes[id];
  const node = document.nodes[id];
  if (!node) return 'Unavailable element';
  if (node.kind === 'text')
    return node.content.type === 'literal' ? node.content.value || 'Empty text' : 'Bound text';
  if (node.kind === 'component') {
    if (labels.definitions?.[node.definitionId]) return labels.definitions[node.definitionId]!;
    for (const name of ['label', 'title', 'alt']) {
      const expression = node.props?.[name];
      if (expression?.type === 'literal' && typeof expression.value === 'string' && expression.value.trim()) return expression.value;
    }
    return node.definitionId.startsWith('vict.catalog.')
      ? node.definitionId.slice('vict.catalog.'.length).split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')
      : 'Component';
  }
  if (node.kind === 'element') {
    const accessible = node.attributes?.['aria-label'];
    if (typeof accessible === 'string' && accessible) return accessible;
    const role =
      (
        {
          h1: 'Heading',
          h2: 'Heading',
          h3: 'Heading',
          p: 'Paragraph',
          button: 'Button',
          a: 'Link',
          section: 'Section',
          article: 'Card',
          main: 'Page',
          div: 'Container',
          input: 'Input',
          form: 'Form',
          nav: 'Navigation',
        } as Record<string, string>
      )[node.tag] ?? node.tag;
    const text = node.children
      .map((child) => document.nodes[child])
      .find((child) => child?.kind === 'text');
    return text?.kind === 'text' && text.content.type === 'literal' && text.content.value
      ? `${role} · ${text.content.value}`
      : role;
  }
  return (
    (
      {
        repeat: 'Repeated content',
        conditional: 'Conditional content',
        slot: 'Slot',
        portal: 'Overlay',
      } as Record<string, string>
    )[node.kind] ?? node.kind
  );
}

export function childIds(node: UiNode): readonly string[] {
  if ('children' in node) return node.children;
  if (node.kind === 'repeat') return [node.templateRoot];
  if (node.kind === 'conditional') return node.branches.flatMap((b) => b.children);
  if (node.kind === 'slot') return node.fallback ?? [];
  if (node.kind === 'component') return Object.values(node.slots ?? {}).flatMap((s) => s.children);
  return [];
}

export function sourceBreadcrumb(
  document: UiDocument,
  id: string,
  labels: EditorLabels = {},
): string[] {
  const path: string[] = [];
  let current: string | undefined = id;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    path.unshift(nodeLabel(document, current, labels));
    const target: string = current;
    current = Object.values(document.nodes).find((n) => childIds(n).includes(target))?.id;
  }
  return path;
}

export function styleText(value: UiStyleValue | undefined, document: UiDocument): string {
  if (!value) return '';
  if (value.type === 'text') return value.value;
  if (value.type === 'token') return document.tokens[value.id]?.value ?? '';
  return ''; // Bound expressions require runtime evaluation; do not invent a scalar.
}

/** Exact declarations in the edit destination, separate from effective browser values. */
export function editableStyle(
  document: UiDocument,
  nodeId: string,
  property: string,
  condition?: string,
  pseudo?: string,
): UiStyleValue | undefined {
  const node = document.nodes[nodeId];
  if (!node) return undefined;
  if (!condition && !pseudo) return node.localStyle?.find((d) => d.property === property)?.value;
  return document.styleSources[
    `src.${nodeId}.${condition ?? 'always'}.${pseudo ?? 'plain'}`
  ]?.declarations.find((d) => d.property === property)?.value;
}

/** Source candidates, not a computed cascade verdict. Conditions stay explicit. */
export function sourceStyles(document: UiDocument, nodeId: string, property: string): string[] {
  const node = document.nodes[nodeId];
  if (!node) return [];
  return (node.styleSources ?? []).flatMap((id) => {
    const source = document.styleSources[id];
    const value = source?.declarations.find((d) => d.property === property)?.value;
    return value
      ? [
          `Shared source ${id}${source.conditionId ? ` · condition ${source.conditionId}` : ''}${source.pseudo ? ` · ${source.pseudo}` : ''}: ${value.type === 'token' ? `token ${value.id}` : styleText(value, document) || 'binding'}`,
        ]
      : [];
  });
}

export const styleGroups = [
  {
    title: 'Typography',
    controls: [
      { property: 'font-size', label: 'Text size', kind: 'number' },
      { property: 'color', label: 'Text color', kind: 'color' },
      { property: 'font-family', label: 'Font family', kind: 'text' },
      {
        property: 'font-weight',
        label: 'Weight',
        kind: 'choice',
        options: ['400', '500', '600', '700', '800'],
      },
      { property: 'line-height', label: 'Line height', kind: 'number' },
      {
        property: 'text-align',
        label: 'Text alignment',
        kind: 'segments',
        options: ['left', 'center', 'right', 'justify'],
      },
    ],
  },
  {
    title: 'Fill & border',
    controls: [
      { property: 'background-color', label: 'Background', kind: 'color' },
      { property: 'border-color', label: 'Border color', kind: 'color' },
      { property: 'border-width', label: 'Border width', kind: 'number' },
      {
        property: 'border-style',
        label: 'Border style',
        kind: 'choice',
        options: ['none', 'solid', 'dashed', 'dotted'],
      },
      { property: 'border-radius', label: 'Corner radius', kind: 'number' },
    ],
  },
  {
    title: 'Size & spacing',
    controls: [
      ...['width', 'height', 'min-width', 'max-width'].map((property) => ({
        property,
        label: property.replace('-', ' '),
        kind: 'number',
      })),
      { property: 'gap', label: 'Gap between children', kind: 'number' },
    ],
  },
  {
    title: 'Layout',
    controls: [
      {
        property: 'display',
        label: 'Layout',
        kind: 'choice',
        options: ['block', 'flex', 'grid', 'inline', 'none'],
      },
      {
        property: 'flex-direction',
        label: 'Direction',
        kind: 'segments',
        options: ['row', 'column', 'row-reverse', 'column-reverse'],
      },
      {
        property: 'flex-wrap',
        label: 'Wrapping',
        kind: 'segments',
        options: ['nowrap', 'wrap', 'wrap-reverse'],
      },
      {
        property: 'align-items',
        label: 'Align children',
        kind: 'segments',
        options: ['start', 'center', 'end', 'stretch'],
      },
      {
        property: 'justify-content',
        label: 'Distribute children',
        kind: 'segments',
        options: ['start', 'center', 'end', 'space-between', 'space-around'],
      },
      { property: 'grid-template-columns', label: 'Grid columns', kind: 'text' },
    ],
  },
] as const;
