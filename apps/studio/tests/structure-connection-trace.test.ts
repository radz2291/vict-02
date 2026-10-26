import {expect,it} from 'vitest';
it('routes a backward connection outside tall endpoint cards and nearby blockers',async()=>{
 const {feedbackPath}=await import('../src/lib/designer/structure-edge-geometry.js');
 const source={x:340,y:60,width:224,height:180},target={x:20,y:100,width:224,height:120};
 const blocker={x:250,y:0,width:60,height:80},cards=[source,target,blocker];
 const path=feedbackPath({x:564,y:130},{x:20,y:150},source,target,cards);
 const points=[...path.matchAll(/[ML] (-?[\d.]+),(-?[\d.]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
 expect(points).toHaveLength(6);
 for(let index=1;index<points.length;index++){
  const a=points[index-1]!,b=points[index]!;
  for(const card of cards){
   const hits=Math.min(a.x,b.x)<card.x+card.width-3&&Math.max(a.x,b.x)>card.x+3&&Math.min(a.y,b.y)<card.y+card.height-3&&Math.max(a.y,b.y)>card.y+3;
   expect(hits).toBe(false);
  }
 }
 expect(feedbackPath({x:564,y:130},{x:20,y:150},source,target,cards)).toBe(path);
});
