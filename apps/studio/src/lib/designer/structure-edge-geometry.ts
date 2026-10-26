export type StructureRect = { x: number; y: number; width: number; height: number };
type Segment = { x1: number; y1: number; x2: number; y2: number };
export const structureGeometryContext = Symbol('Studio Structure geometry');
export type StructureGeometryContext = {
  nodes: () => ReadonlyMap<string, StructureRect>;
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
function overlaps(a: StructureRect, b: StructureRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function lineBounds(segment: Segment): StructureRect {
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
  sourceCard: StructureRect, targetCard: StructureRect, obstacles: readonly StructureRect[],
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
