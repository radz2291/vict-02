import type {Node,LayoutDirection} from '@victframework/ui-flow-svelte';
type Point={x:number;y:number};
/** Presentation only. Keep known world positions; place new cards clear of them. */
export function retainStructurePositions<T extends Node>(arranged:T[], known:ReadonlyMap<string,Point>, direction:LayoutDirection):T[]{
  const anchor=arranged.find(node=>known.has(node.id));
  const offset=anchor?{x:known.get(anchor.id)!.x-anchor.position.x,y:known.get(anchor.id)!.y-anchor.position.y}:{x:0,y:0};
  const placed=arranged.filter(node=>known.has(node.id)).map(node=>({...node,position:known.get(node.id)!}));
  const positions=new Map(placed.map(node=>[node.id,node.position]));
  const width=(node:Node)=>node.measured?.width??node.width??224;
  const height=(node:Node)=>node.measured?.height??node.height??120;
  for(const node of arranged){
    if(positions.has(node.id))continue;
    const point={x:node.position.x+offset.x,y:node.position.y+offset.y};
    const collisions=()=>placed.filter(other=>point.x<other.position.x+width(other)+32 && point.x+width(node)+32>other.position.x && point.y<other.position.y+height(other)+32 && point.y+height(node)+32>other.position.y);
    let overlaps=collisions();
    while(overlaps.length){
      if(direction==='DOWN')point.x=Math.max(...overlaps.map(other=>other.position.x+width(other)+48));
      else point.y=Math.max(...overlaps.map(other=>other.position.y+height(other)+48));
      overlaps=collisions();
    }
    placed.push({...node,position:point});positions.set(node.id,point);
  }
  return arranged.map(node=>({...node,position:positions.get(node.id)!}));
}
