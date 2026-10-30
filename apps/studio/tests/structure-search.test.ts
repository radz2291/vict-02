import {expect,it} from 'vitest';
import type {UiDocument} from '@victframework/ui';
import {clarityFixture} from './fixtures/structure-clarity.js';
import {projectStructure,filterStructure,structureId,structureMatches} from '../src/lib/designer/structure.js';
it('searches unused declarations without injecting unrelated inventory into the results',()=>{
 const seed=clarityFixture(),source:UiDocument={...seed,localState:{...seed.localState,unused:{key:'unused',type:'string',initial:''}}};
 const graph=projectStructure(source),unused=structureId(source.id,'state','unused');
 const options={inventory:true,bindings:true,definitions:true};
 expect(filterStructure(graph,options).nodes.some(node=>node.id===unused)).toBe(true);
 const focused=filterStructure(graph,{...options,search:'Field 0'});expect(focused.nodes.some(node=>node.id===unused)).toBe(false);
 expect(focused.nodes.filter(node=>structureMatches(node,'Field 0'))).toHaveLength(1);
 expect(filterStructure(graph,{...options,search:'unused'}).nodes.some(node=>node.id===unused)).toBe(true);
});
