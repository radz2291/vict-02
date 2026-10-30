/** Deliberately inert SVG data. No raw markup, script, foreignObject, links or CSS. */
export const VECTOR_SCHEMA = 'vict.vector@1' as const;
export const vectorTags = [
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
] as const;
export type VectorTag = (typeof vectorTags)[number];
export interface VectorNode {
  readonly tag: VectorTag;
  readonly attributes?: Readonly<Record<string, string | number>>;
  readonly children?: readonly VectorNode[];
}
export interface VectorGraphic {
  readonly schema: typeof VECTOR_SCHEMA;
  readonly viewBox: string;
  readonly nodes: readonly VectorNode[];
}
const allowed = new Set([
  'id',
  'd',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'transform',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'fill-rule',
  'clip-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'fx',
  'fy',
  'fr',
  'clip-path',
  'mask',
  'maskUnits',
  'maskContentUnits',
]);
const idPattern = /^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/;
const paint =
  /^(?:none|currentColor|transparent|[a-zA-Z]{1,24}|#[\da-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.,%\s+-]+\)|url\(#[A-Za-z_][A-Za-z0-9_.-]{0,79}\))$/;
export function validateVector(value: unknown): VectorGraphic {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Vector must be a vict.vector@1 object.');
  const vector = value as VectorGraphic;
  if (
    Object.keys(vector).some((key) => !['schema', 'viewBox', 'nodes'].includes(key)) ||
    vector.schema !== VECTOR_SCHEMA ||
    typeof vector.viewBox !== 'string' ||
    vector.viewBox.length > 120 ||
    !Array.isArray(vector.nodes)
  )
    throw Error('Unsupported vector fields/schema.');
  const view = vector.viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (view.length !== 4 || view.some((n) => !Number.isFinite(n)) || view[2]! <= 0 || view[3]! <= 0)
    throw Error('viewBox requires four finite numbers and positive dimensions.');
  let count = 0,
    characters = 0;
  const ids = new Set<string>(),
    references: string[] = [];
  function visit(node: VectorNode, depth: number): void {
    if (
      !node ||
      typeof node !== 'object' ||
      Array.isArray(node) ||
      ++count > 500 ||
      depth > 16 ||
      !vectorTags.includes(node.tag) ||
      Object.keys(node).some((key) => !['tag', 'attributes', 'children'].includes(key))
    )
      throw Error('Unsupported vector node or size/depth budget exceeded.');
    if (
      node.attributes !== undefined &&
      (!node.attributes ||
        typeof node.attributes !== 'object' ||
        Array.isArray(node.attributes) ||
        Object.keys(node.attributes).length > 40)
    )
      throw Error('Invalid vector attributes.');
    for (const [key, raw] of Object.entries(node.attributes ?? {})) {
      const text = String(raw);
      characters += text.length;
      if (
        !allowed.has(key) ||
        !['string', 'number'].includes(typeof raw) ||
        (typeof raw === 'number' && !Number.isFinite(raw)) ||
        text.length > 12000 ||
        characters > 200000 ||
        /[<>\u0000-\u001f]/.test(text)
      )
        throw Error(`Unsupported vector attribute: ${key}.`);
      if (key === 'id') {
        if (!idPattern.test(text) || ids.has(text))
          throw Error('Vector IDs must be valid and unique.');
        ids.add(text);
      } else if (['fill', 'stroke', 'stop-color'].includes(key)) {
        if (!paint.test(text))
          throw Error('Only inert colour or local paint references are supported.');
      } else if (['clip-path', 'mask'].includes(key)) {
        if (!/^url\(#[A-Za-z_][A-Za-z0-9_.-]{0,79}\)$/.test(text))
          throw Error('Only local vector references are supported.');
      } else if (key === 'd' && !/^[\s\d.,eE+\-MmLlHhVvCcSsQqTtAaZz]*$/.test(text))
        throw Error('Invalid path geometry.');
      else if (key === 'transform' || key === 'gradientTransform') {
        if (
          !/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\([\s\d.,eE+\-]+\)\s*)*$/.test(text)
        )
          throw Error('Invalid inert transform.');
      } else if (/(?:url\(|javascript|data:|https?:)/i.test(text))
        throw Error('External vector resources are not supported.');
      for (const ref of text.matchAll(/url\(#([\w.-]+)\)/g)) references.push(ref[1]!);
    }
    if (node.children !== undefined && !Array.isArray(node.children))
      throw Error('Invalid vector children.');
    for (const child of node.children ?? []) visit(child, depth + 1);
  }
  vector.nodes.forEach((node) => visit(node, 0));
  if (references.some((id) => !ids.has(id))) throw Error('Unresolved local vector reference.');
  // Canonical primitives are fully validated above; JSON copying also accepts a
  // Svelte reactive proxy supplied by a consumer without retaining its ownership.
  return JSON.parse(JSON.stringify(vector)) as VectorGraphic;
}
/** Rewrite every local ID/reference for each rendered occurrence, including repeated documents. */
export function scopeVector(vector: VectorGraphic, occurrenceId: string): VectorGraphic {
  if (!occurrenceId || occurrenceId.length > 500) throw Error('A bounded occurrence identity is required.');
  const valid = validateVector(vector),
    prefix = `vict-${Array.from(occurrenceId).map(character=>character.codePointAt(0)!.toString(16)).join('_')}-`;
  const visit = (node: VectorNode): VectorNode => ({
    ...node,
    attributes: Object.fromEntries(
      Object.entries(node.attributes ?? {}).map(([key, value]) => [
        key,
        key === 'id'
          ? prefix + value
          : String(value).replace(/url\(#([\w.-]+)\)/g, (_, id: string) => `url(#${prefix}${id})`),
      ]),
    ),
    ...(node.children ? { children: node.children.map(visit) } : {}),
  });
  return { ...valid, nodes: valid.nodes.map(visit) };
}
/** Import only the same whitelisted inert subset. Never insert uploaded markup with innerHTML. */
export function importSvg(text: string, Parser: typeof DOMParser = DOMParser): VectorGraphic {
  if (text.length > 500000 || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw Error('SVG import exceeds bounds or contains a DTD/entity.');
  const doc = new Parser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
    throw Error('Invalid SVG document.');
  const root = doc.documentElement;
  for (const attr of Array.from(root.attributes))
    if (!['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke'].includes(attr.name))
      throw Error(`Unsupported SVG root attribute: ${attr.name}.`);
  const read = (element: Element): VectorNode => ({
    tag: element.localName as VectorTag,
    attributes: Object.fromEntries(Array.from(element.attributes).map((a) => [a.name, a.value])),
    children: Array.from(element.children).map(read),
  });
  const inherited = Object.fromEntries(
    ['fill', 'stroke'].flatMap((name) =>
      root.hasAttribute(name) ? [[name, root.getAttribute(name)!]] : [],
    ),
  );
  const nodes = Array.from(root.children).map(read);
  return validateVector({
    schema: VECTOR_SCHEMA,
    viewBox:
      root.getAttribute('viewBox') ??
      `0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`,
    nodes: Object.keys(inherited).length
      ? [{ tag: 'g', attributes: inherited, children: nodes }]
      : nodes,
  });
}
