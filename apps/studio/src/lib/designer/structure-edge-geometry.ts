export type CaptionRect = { x: number; y: number; width: number; height: number };
type Segment = { x1: number; y1: number; x2: number; y2: number };
export const captionContext = Symbol('Studio Structure captions');
export type CaptionContext = {
  paths: Map<string, string>;
  labels: Map<string, string>;
  captions: () => ReadonlyMap<string, CaptionRect>;
};
function segments(path: string): Segment[] {
  let current = { x: 0, y: 0 };
  const result: Segment[] = [];
  for (const match of path.matchAll(/([MLQ])([^MLQ]*)/g)) {
    const values = (match[2]!.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    const end = { x: values.at(-2) ?? current.x, y: values.at(-1) ?? current.y };
    if (match[1] !== 'M') result.push({ x1: current.x, y1: current.y, x2: end.x, y2: end.y });
    current = end;
  }
  return result;
}
function overlaps(a: CaptionRect, b: CaptionRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function lineBounds(segment: Segment): CaptionRect {
  return {
    x: Math.min(segment.x1, segment.x2) - 2,
    y: Math.min(segment.y1, segment.y2) - 2,
    width: Math.abs(segment.x2 - segment.x1) + 4,
    height: Math.abs(segment.y2 - segment.y1) + 4,
  };
}
/** Pure world-coordinate placement. No DOM measurements, zoom or canonical mutations. */
export function edgeCaption(
  path: string,
  label: string,
  otherPaths: readonly string[] = [],
  nodes: readonly CaptionRect[] = [],
): CaptionRect {
  const width = Math.min(144, Math.max(42, label.length * 6 + 8)),
    height = 20;
  const own = segments(path),
    obstacles = [...own, ...otherPaths.flatMap(segments)].map(lineBounds);
  const candidates: { rect: CaptionRect; score: number }[] = [];
  for (const segment of own) {
    const dx = Math.abs(segment.x2 - segment.x1),
      dy = Math.abs(segment.y2 - segment.y1);
    if (dx + dy < 2 || (dx > 0.01 && dy > 0.01)) continue;
    const horizontal = dy < 0.01,
      x = (segment.x1 + segment.x2) / 2,
      y = (segment.y1 + segment.y2) / 2;
    for (const gap of [6, 14, 26, 42])
      for (const side of [-1, 1]) {
        const rect = {
          x: horizontal ? x - width / 2 : side < 0 ? x - width - gap : x + gap,
          y: horizontal ? (side < 0 ? y - height - gap : y + gap) : y - height / 2,
          width,
          height,
        };
        const collisions =
          obstacles.filter((obstacle) => overlaps(rect, obstacle)).length +
          nodes.filter((node) =>
            overlaps(rect, {
              x: node.x - 4,
              y: node.y - 4,
              width: node.width + 8,
              height: node.height + 8,
            }),
          ).length;
        candidates.push({
          rect,
          score:
            collisions * 100000 +
            gap * 10 +
            1000 / Math.max(1, dx + dy) +
            ((side === -1 && horizontal) || (side === 1 && !horizontal) ? 0 : 1),
        });
      }
  }
  return (
    candidates.sort((a, b) => a.score - b.score)[0]?.rect ?? { x: 8, y: -height - 6, width, height }
  );
}
/** A deterministic pass also reserves room for earlier captions, without reactive feedback. */
export function layoutCaptions(
  paths: ReadonlyMap<string, string>,
  labels: ReadonlyMap<string, string>,
  nodes: readonly CaptionRect[],
): ReadonlyMap<string, CaptionRect> {
  const result = new Map<string, CaptionRect>();
  for (const [id, path] of [...paths].sort(([a], [b]) => a.localeCompare(b))) {
    const label = labels.get(id);
    if (!label) continue;
    result.set(
      id,
      edgeCaption(
        path,
        label,
        [...paths].filter(([other]) => other !== id).map(([, value]) => value),
        [...nodes, ...result.values()],
      ),
    );
  }
  return result;
}
