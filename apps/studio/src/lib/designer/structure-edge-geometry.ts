export type CaptionRect = { x: number; y: number; width: number; height: number };
type Segment = { x1: number; y1: number; x2: number; y2: number };
export const captionContext = Symbol('Studio Structure captions');
export type CaptionContext = {
  paths: Map<string, string>;
  labels: Map<string, string>;
  captions: () => ReadonlyMap<string, CaptionRect>;
  nodes: () => ReadonlyMap<string, CaptionRect>;
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
/** Return connections leave/enter their cards from the outside. The default
 * midpoint elbow can cross a tall endpoint card when ports occupy different rows.
 * Prefer a clear nearby corridor; this is not a replacement for graph layout. */
export function feedbackPath(
  source: {x:number;y:number}, target: {x:number;y:number},
  sourceCard: CaptionRect, targetCard: CaptionRect, obstacles: readonly CaptionRect[],
): string {
  const inset = obstacles.map(rect=>({x:rect.x+3,y:rect.y+3,width:Math.max(0,rect.width-6),height:Math.max(0,rect.height-6)}));
  const top=obstacles.reduce((value,rect)=>Math.min(value,rect.y-24),sourceCard.y-24);
  const bottom=obstacles.reduce((value,rect)=>Math.max(value,rect.y+rect.height+24),sourceCard.y+sourceCard.height+24);
  const corridors = [...new Set([sourceCard.y-24,sourceCard.y+sourceCard.height+24,targetCard.y-24,targetCard.y+targetCard.height+24,top,bottom])];
  const candidates=corridors.map(y=>{
    const points=[source,{x:source.x+20,y:source.y},{x:source.x+20,y},{x:target.x-20,y},{x:target.x-20,y:target.y},target];
    const path=points.map((point,index)=>`${index?'L':'M'} ${point.x},${point.y}`).join(' ');
    const lines=segments(path);
    const collisions=lines.reduce((sum,line)=>sum+inset.filter(rect=>overlaps(lineBounds(line),rect)).length,0);
    const length=lines.reduce((sum,line)=>sum+Math.abs(line.x2-line.x1)+Math.abs(line.y2-line.y1),0);
    return {path,score:collisions*1000000+length};
  });
  return candidates.sort((a,b)=>a.score-b.score)[0]!.path;
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
