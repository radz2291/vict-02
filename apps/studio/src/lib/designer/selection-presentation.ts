import type {UiDocument} from '@victframework/ui';
import {resolveOccurrence,compositionParent} from '@victframework/ui-editor';
import {parseStructureId,structureId,structureNodePresentation,type StructureGraph,type StructureContext} from './structure.js';
import type {WorkspaceItem} from './workspace-selection.js';
import {structureBehavior} from './structure-behavior.js';
import {readableName} from './presentation.js';
import {relationshipSubject,relationshipPhrase} from './selection-relationships.js';

/** One source identity presenter; a rendered occurrence never becomes its source alias. */
export function selectionIdentity(document:UiDocument,graph:StructureGraph,item:WorkspaceItem,rendered?:readonly string[]){
 const node=item.kind==='node'?graph.nodes.find(node=>node.id===item.id):undefined;
 const presentation=node?structureNodePresentation(document,node.data):undefined;
 const name=presentation?.fullLabel??node?.data.label??'Unavailable';
 const type=item.kind==='edge'?'Connection':presentation?.kindLabel??readableName(node?.data.kind??'unavailable');
 const path:string[]=[];
 if(node?.data.scope)path.push(node.data.scope);
 if(item.kind==='node'&&item.occurrence){const occurrence=resolveOccurrence(item.occurrence,document);
  for(const step of occurrence.instancePath){const owner=graph.nodes.find(node=>node.id===structureId(document.id,'node',step.sourceNodeId));path.push(owner?structureNodePresentation(document,owner.data).fullLabel??owner.data.label:readableName(step.sourceNodeId));}
  path.push(...occurrence.repeatKeys.map(key=>`Row ${key}`),...occurrence.portalPath.map(step=>`Overlay ${step.overlayId}`));
 }
 const scope=[...new Set(path)].join(' · ');
 const availability=item.kind==='node'&&item.occurrence&&rendered&&!rendered.includes(item.occurrence)?'Not currently rendered':item.kind==='node'&&!item.occurrence&&node?.data.kind==='node'?'Source declaration':undefined;
 let textLocation:string|undefined;
 let textContext:string|undefined;
 if(node?.data.sourceId&&document.nodes[node.data.sourceId]?.kind==='text'){
  const parent=compositionParent(document,node.data.sourceId),owner=parent?graph.nodes.find(node=>node.data.sourceId===parent.nodeId):undefined;
  if(parent&&document.nodes[parent.nodeId]?.kind==='element'&&owner){const presentation=structureNodePresentation(document,owner.data);textContext=`Text inside ${presentation.kindLabel??'Element'}`;textLocation=`${textContext} · ${presentation.fullLabel??presentation.label}`;}
 }
 return {name,type,scope,availability,textLocation,textContext,iconKey:presentation?.iconKey??'container' as const,qualified:[type,name,scope].filter(Boolean).join(' · ')};
}
export function sourceOverview(document:UiDocument,graph:StructureGraph,id:string,context:StructureContext={}){
 const selected=graph.nodes.find(node=>node.id===id);if(!selected)return [];
 const tuple=parseStructureId(id),key=tuple?.[2]??'',node=selected.data.sourceId?document.nodes[selected.data.sourceId]:undefined;
 const result:{name:string;value:string}[]=[{name:'Type',value:structureNodePresentation(document,selected.data).kindLabel??readableName(selected.data.kind)}];
 const add=(name:string,value:unknown)=>{if(value!==undefined&&value!=='')result.push({name,value:String(value)});};
 add('Scope',selected.data.scope);add('Support',selected.data.support);
 for(const issue of selected.data.issues??[])add('Warning',issue);
 if(node?.kind==='element'&&node.children.length)add('Children',node.children.length);
 if(node?.kind==='component')add('Component',readableName(node.definitionId));
 if(node?.kind==='text')add('Content',node.content.type==='literal'?node.content.value:'Declared expression (see Relationships)');
 if(node)result.push(...structureBehavior(document,node.id).filter(fact=>!fact.name.startsWith('When ')&&!fact.name.startsWith('On ')));
 const names:Record<string,string>={display:'Layout','flex-direction':'Direction',gap:'Spacing',width:'Width',height:'Height',padding:'Padding','font-size':'Text size',color:'Text color','background-color':'Background'};
 for(const style of node?.localStyle??[])if(names[style.property])add(names[style.property]!,style.value.type==='text'?style.value.value:style.value.type==='token'?'Theme value':'Connected value');
 if(tuple?.[1]==='state'){const state=document.localState[key];if(state){add('Value type',readableName(state.type));add('Starting value',Array.isArray(state.initial)?`${state.initial.length} items`:state.initial);}}
 if(tuple?.[1]==='style'){const style=document.styleSources[selected.data.registryId??key];if(style){add('Properties',style.declarations.length);for(const entry of style.declarations.slice(0,8))add(names[entry.property]??entry.property,entry.value.type==='text'?entry.value.value:entry.value.type==='token'?`Theme: ${readableName(entry.value.id)}`:'Connected value');if(style.declarations.length>8)add('More',`${style.declarations.length-8} properties in Technical information`);add('Condition',style.conditionId?document.conditions[style.conditionId]?readableName(style.conditionId):'Unknown condition':undefined);add('State',style.pseudo);}}
 if(tuple?.[1]==='token')add('Value',document.tokens[key]?.value);
 if(tuple?.[1]==='asset'){const asset=document.assets[key];if(asset){add('Asset kind',readableName(asset.kind));add(asset.kind==='external'?'Source':'Digest',asset.kind==='external'?asset.href:asset.digest);}}
 if(tuple?.[1]==='condition')add('Rule',selected.data.summary);
 if(tuple?.[1]==='definition'){const definition=document.componentDefinitions[key];if(definition){add('Revision',definition.revision);add('Properties',definition.props.length);add('Slots',Object.keys(definition.slots).length);}}
 if(tuple?.[1]==='catalog'){const entry=context.descriptors?.find(entry=>`${entry.id}@${entry.revision}`===key);if(entry){add('Revision',entry.revision);add('Properties',entry.props.length);add('Outputs',entry.outputs?.length??0);add('Slots',entry.slots?.length??0);}}
 if(!node&&!['state','style','token','asset','condition','definition','catalog'].includes(tuple?.[1]??''))add('Meaning',selected.data.summary);
 const parent=graph.edges.find(edge=>edge.target===id&&edge.data?.kind==='containment');const owner=parent&&graph.nodes.find(node=>node.id===parent.source);if(owner)add('Inside',structureNodePresentation(document,owner.data).label);
 return result.filter(fact=>!['Type','Scope','Inside'].includes(fact.name));
}

/** Names for object identities and exact technical connection member controls. */
export function selectionMember(document:UiDocument,graph:StructureGraph,item:WorkspaceItem,rendered?:readonly string[]){
 const identity=selectionIdentity(document,graph,item,rendered);
 const context=[identity.scope,identity.textLocation,identity.availability].filter(Boolean).join(' · ');
 if(item.kind==='node')return {...identity,context};
 const edge=graph.edges.find(edge=>edge.id===item.id);
 if(!edge)return {...identity,name:'Unavailable connection',iconKey:'reference' as const,context};
 const subjectId=relationshipSubject(edge),otherId=subjectId===edge.source?edge.target:edge.source;
 const subject=selectionIdentity(document,graph,{kind:'node',id:subjectId}),other=selectionIdentity(document,graph,{kind:'node',id:otherId}),phrase=relationshipPhrase(edge,subjectId);
 return {...identity,name:`${subject.qualified} · ${phrase} · ${other.qualified}`,iconKey:'reference' as const,context};
}
function encodeComparison(value:unknown):string {
 if(value===undefined)return 'Not set';if(value===null)return 'null';
 if(Array.isArray(value))return '['+value.map(encodeComparison).join(', ')+']';
 if(typeof value==='object')return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>JSON.stringify(key)+': '+encodeComparison(value)).join(', ')+'}';
 return String(value);
}
function stableComparison(value:unknown):unknown{return Array.isArray(value)?value.map(stableComparison):value&&typeof value==='object'?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,stableComparison(value)])):value;}
/** Full comparison belongs in Technical information; quiet Overview filters it separately. */
export function selectionComparison(document:UiDocument,graph:StructureGraph,items:readonly WorkspaceItem[],context:StructureContext={}){
 const sources=items.filter(item=>item.kind==='node').map(item=>graph.nodes.find(node=>node.id===item.id));
 if(sources.length<2)return [];
 const rows:{name:string;value:string}[]=[];
 const add=(name:string,values:unknown[])=>{const serial=values.map(value=>JSON.stringify([typeof value,stableComparison(value)]));rows.push({name,value:serial.every(value=>value===serial[0])?encodeComparison(values[0]):'Mixed'});};
 add('Type',sources.map(node=>node?structureNodePresentation(document,node.data).kindLabel:undefined));
 if(sources.some(node=>node?.data.scope))add('Scope',sources.map(node=>node?.data.scope));
 if(sources.every(node=>node?.data.kind!=='node'&&node?.data.kind!=='state')){const facts=sources.map(node=>node?sourceOverview(document,graph,node.id,context):[]);for(const name of new Set(facts.flatMap(rows=>rows.map(row=>row.name)).filter(name=>name!=='Type'&&name!=='Scope')))add(name,facts.map(rows=>rows.find(row=>row.name===name)?.value));}
 const authored=sources.map(node=>node?.data.sourceId?document.nodes[node.data.sourceId]:undefined);
 if(authored.every(node=>node?.kind==='element')){
  add('Element',authored.map(node=>node?.kind==='element'?node.tag:undefined));
  const names=new Set(authored.flatMap(node=>node?.kind==='element'?Object.keys(node.attributes??{}):[]));
  for(const name of [...names].sort())add(name,authored.map(node=>node?.kind==='element'?node.attributes?.[name]:undefined));
 }
 if(sources.every(node=>node?.data.kind==='state')){const states=sources.map(node=>document.localState[parseStructureId(node!.id)?.[2]??'']);add('Value type',states.map(state=>state?.type));add('Starting value',states.map(state=>state?.initial));}
 if(authored.every(node=>node?.kind==='component'))add('Definition',authored.map(node=>node?.kind==='component'?node.definitionId:undefined));
 return rows;
}
export function selectionOverview(document:UiDocument,graph:StructureGraph,items:readonly WorkspaceItem[],context:StructureContext={}){
 if(items.length===1&&items[0]?.kind==='node')return sourceOverview(document,graph,items[0].id,context);
 // Object-only comparisons must never imply that contextual edge endpoints were selected.
 if(items.some(item=>item.kind==='edge'))return [];
 const facts=items.map(item=>sourceOverview(document,graph,item.id,context));
 const names=new Set(facts.flatMap(rows=>rows.map(row=>row.name)));
 return [...names].flatMap(name=>{const values=facts.map(rows=>rows.find(row=>row.name===name)?.value);return values[0]!==undefined&&values.every(value=>value===values[0])?[{name,value:values[0]}]:[];});
}

/** Exact event context follows its declaration path, not neighbouring node guesses. */
export function relationshipEventNote(document:UiDocument,graph:StructureGraph,edge:StructureGraph['edges'][number]):string|undefined {
 const owner=graph.nodes.find(node=>node.id===edge.data?.owner),source=owner?.data.sourceId?document.nodes[owner.data.sourceId]:undefined;
 if(!source)return;
 const prefix=`/nodes/${source.id.replaceAll('~','~0').replaceAll('/','~1')}/`,path=edge.data?.path??'';
 if(!path.startsWith(prefix))return;
 const parts=path.slice(prefix.length).split('/');
 const events=structureBehavior(document,source.id).filter(fact=>fact.name.startsWith('When ')||fact.name.startsWith('On '));
 const note=parts[0]==='interactions'?events[Number(parts[1])]:parts[0]==='outputs'?events.find(fact=>fact.name===`On ${readableName((parts[1]??'').replaceAll('~1','/').replaceAll('~0','~'))}`):undefined;
 return note?`${note.name}: ${note.value}`:undefined;
}
