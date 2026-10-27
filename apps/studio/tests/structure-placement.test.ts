import {expect,it} from 'vitest';
import {retainStructurePositions} from '../src/lib/designer/structure-placement.js';
const card=(id:string,x=0,y=0)=>({id,position:{x,y},data:{},width:224,height:120});
it.each(['RIGHT','DOWN'] as const)('retains existing world positions and places new cards without overlap (%s)',direction=>{
 const known=new Map([['a',{x:100,y:100}],['b',{x:400,y:100}]]);
 const result=retainStructurePositions([card('a',0,0),card('b',300,0),card('new',0,0)],known,direction);
 expect(result[0]!.position).toEqual(known.get('a'));expect(result[1]!.position).toEqual(known.get('b'));
 const fresh=result[2]!;for(const node of result.slice(0,2))expect(fresh.position.x>=node.position.x+224+32||fresh.position.x+224+32<=node.position.x||fresh.position.y>=node.position.y+120+32||fresh.position.y+120+32<=node.position.y).toBe(true);
 expect(known.size).toBe(2);
});
it('restores a hidden node to its previous location when it returns',()=>{
 const known=new Map([['a',{x:70,y:30}],['hidden',{x:500,y:200}]]);
 expect(retainStructurePositions([card('a'),card('hidden')],known,'RIGHT').map(node=>node.position)).toEqual([...known.values()]);
});
