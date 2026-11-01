import {expect,it} from 'vitest';
import {canonicalUiDocument} from '@victframework/ui';
import {projectStructure,structureMove,structureId,filterStructure} from '@victframework/ui-structure-svelte/projection';
import {structureConnectionEdges,structurePorts} from '@victframework/ui-structure-svelte/connections';
import {selectionHighlight,portConnections} from '@victframework/ui-structure-svelte/trace';
import {changeSelection} from '@victframework/ui-structure-svelte/selection';
import {projectStructure as studioProject,studioStructurePresentation} from '../src/lib/designer/structure.js';
import {bindingFixture} from './fixtures/structure-semantics.js';

it('projects the same canonical source publicly with explicit host labels and no source changes',()=>{
 const document=bindingFixture(),before=canonicalUiDocument(document).contentDigest;
 const graph=projectStructure(document,{presentation:studioStructurePresentation});
 expect(graph).toEqual(studioProject(document));
 const generic=projectStructure(document);expect(generic.nodes.map(node=>node.id)).toEqual(graph.nodes.map(node=>node.id));
 expect(generic.edges).toEqual(graph.edges);
 expect(filterStructure(graph,{search:'field',bindings:true,definitions:true}).nodes.length).toBeGreaterThan(0);
 expect(canonicalUiDocument(document).contentDigest).toBe(before);
});
it('keeps every declaration through public sockets and group selection without acquiring source authority',()=>{
 const document=bindingFixture(),before=JSON.stringify(document),graph=projectStructure(document),edges=structureConnectionEdges(graph);
 expect(edges).toHaveLength(graph.edges.length);
 const node=structureId(document.id,'node','field');const ports=structurePorts(graph,node);expect(ports.length).toBeGreaterThan(0);
 for(const port of ports){const members=portConnections(edges,node,port.id);expect(members.length).toBe(port.count);const selection=changeSelection({documentId:document.id,items:[]},members.map(edge=>({kind:'edge' as const,id:edge.id})),'replace');expect(selectionHighlight(edges,selection.items)?.edges.size).toBeGreaterThanOrEqual(members.length);}
 const request={documentId:document.id,revision:'old',source:node,target:structureId(document.id,'node',document.root)};
 expect(structureMove(document,'new',request,false,[]).ok).toBe(false);
 expect(structureMove(document,'old',request,true,[]).ok).toBe(false);
 expect(JSON.stringify(document)).toBe(before);
});
