import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import * as old from 'C:/Users/RZ1/AppData/Local/Temp/vict-structure-independent-f483-20261101/structure.ts';
import * as oldConnections from 'C:/Users/RZ1/AppData/Local/Temp/vict-structure-independent-f483-20261101/structure-connections.ts';
import * as current from '../../../../apps/studio/src/lib/designer/structure.js';
import * as connections from '@victframework/ui-structure-svelte/connections';
import {bindingFixture,definitionsFixture,repeatFixture,outputFixture,outputDescriptor,styleFixture} from '../../../../apps/studio/tests/fixtures/structure-semantics.js';
import {clarityFixture} from '../../../../apps/studio/tests/fixtures/structure-clarity.js';

const fixtures=[['bindings',bindingFixture()],['definitions',definitionsFixture()],['repeats',repeatFixture()],['outputs',outputFixture()],['styles',styleFixture()],['clarity',clarityFixture()],['campaign-r17',JSON.parse(readFileSync(new URL('./01-before-source.json',import.meta.url),'utf8'))]] as const;
for(const [name,source] of fixtures)it(`independent old/new source projection parity: ${name}`,()=>{
 const before=JSON.stringify(source),context={descriptors:[outputDescriptor]};
 const baseline=old.projectStructure(source,context),candidate=current.projectStructure(source,context);
 expect(candidate).toEqual(baseline);
 expect(current.compactStructure(candidate,source)).toEqual(old.compactStructure(baseline,source));
 const freshEdges=connections.structureConnectionEdges(candidate),oldEdges=oldConnections.structureConnectionEdges(baseline);
 expect(freshEdges).toEqual(oldEdges);
 const ids=candidate.nodes.length>30?candidate.nodes.slice(0,15).concat(candidate.nodes.slice(-15)):candidate.nodes;
 for(const node of ids){
   expect(current.structureNodePresentation(source,node.data)).toEqual(old.structureNodePresentation(source,node.data));
   expect(connections.structurePorts(candidate,node.id)).toEqual(oldConnections.structurePorts(baseline,node.id));
   expect(connections.groupStructureRelationships(candidate,node.id)).toEqual(oldConnections.groupStructureRelationships(baseline,node.id));
   expect(current.structureFacts(source,node)).toEqual(old.structureFacts(source,node));
 }
 for(const options of [{},{bindings:true,definitions:true,inventory:true},{bindings:true,search:'message'},{bindings:true,search:'campaignGraph'},{collapsed:new Set(candidate.nodes.filter(n=>(n.data.childCount??0)>3).map(n=>n.id))}])expect(current.filterStructure(candidate,options)).toEqual(old.filterStructure(baseline,options));
 const focus=candidate.nodes[0]?.id;if(focus)for(const options of [{},{related:true,limit:25},{related:true,limit:Infinity}])expect(current.connectedSelectionStructure(candidate,[focus],options)).toEqual(old.connectedSelectionStructure(baseline,[focus],options));
 expect(JSON.stringify(source)).toBe(before);
});
