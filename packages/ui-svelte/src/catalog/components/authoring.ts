/** General catalog knowledge is owned beside its descriptors. No editor or Studio dependency. */
import type { UiAuthoringPackage, UiAuthoringFragment, UiAuthoringRule, UiAuthoringPlacement, UiAuthoringRegistration, UiNode, UiValue, UiLocalStateDecl, UiExpression, UiOutputBinding } from '@victframework/ui';
import { b1CatalogDescriptors } from './descriptors.js';
import { b2CatalogDescriptors } from './b2-descriptors.js';
import { b3CatalogDescriptors } from './b3-descriptors.js';
import { b4CatalogDescriptors } from './b4-descriptors.js';
import { b5CatalogDescriptors } from './b5-descriptors.js';
import compatibility from './authoring-compatibility.json' with {type:'json'};
import packageManifest from '../../../package.json' with {type:'json'};

const descriptors=[...b1CatalogDescriptors,...b2CatalogDescriptors,...b3CatalogDescriptors,...b4CatalogDescriptors,...b5CatalogDescriptors];
type Seed={family?:string;props?:Record<string,UiValue>;slots?:Record<string,Seed[]>;text?:string};
const copy=(text:string):Seed=>({text});
const item=(family:string,label='First option',value='first'):Seed=>({family,props:{label,value}});
const title=(family:string)=>family.replace(/[.-]/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
const descriptorFor=(family:string)=>descriptors.find(item=>item.id===`vict.catalog.${family}`)!;
function seed(family:string):Seed{
  const descriptor=descriptorFor(family),props:Record<string,UiValue>={},slots:Record<string,Seed[]>={};
  for(const prop of descriptor.props)if(prop.type==='stringList'||prop.type==='numberList')props[prop.name]=prop.default??[];
  if(descriptor.props.some(prop=>prop.name==='label'))props.label=title(family);
  if(descriptor.props.some(prop=>prop.name==='title'))props.title=title(family);
  if(descriptor.props.some(prop=>prop.name==='description'))props.description='Add your own content.';
  if(family==='button')props.label='Continue';
  if(family==='checkbox')props.label='I agree to continue';
  if(family==='switch')props.label='Enable notifications';
  if(family==='avatar'){props.fallback='VI';props.alt='Profile';}
  if(family==='slider')props.value=[25];
  if(family==='meter'||family==='progress')props.value=40;
  if(family==='pagination')props.count=100;
  if(family==='label')props.label='Field label';
  if(family==='separator'){props.orientation='horizontal';props.decorative=true;}
  if(family==='link-preview'||family==='navigation-menu.link')props.href='#';
  if(family==='time-field')props.value='09:00';
  if(['date-field','date-picker','calendar'].includes(family))props.value='2026-10-23';
  if(['date-range-field','date-range-picker','range-calendar'].includes(family)){props.start='2026-10-23';props.end='2026-10-25';}
  if(/^(select|combobox|toggle-group)(-multiple)?$/.test(family)){const child=family.replace('-multiple','')+'-item';slots.items=[item(child),item(child,'Second option','second')];}
  if(family==='accordion'||family==='accordion-multiple')slots.items=[seed('accordion-item')];
  if(family==='accordion-item'){props.value='first';props.label='Details';slots.content=[copy('Expandable content')];}
  if(family==='tabs'){props.value='first';slots.tabs=[item('tabs-trigger','First tab')];slots.panels=[{family:'tabs-panel',props:{value:'first'},slots:{content:[copy('Tab content')]}}];}
  if(family==='tabs-trigger'||family==='tabs-panel')props.value='first';
  if(family==='tabs-panel')slots.content=[copy('Tab content')];
  if(family==='toolbar')slots.tools=[{family:'toolbar-button',props:{label:'Action'}}];
  if(family==='menubar')slots.menus=[seed('menubar.menu')];
  if(family==='menubar.menu'){props.value='file';props.label='File';slots.items=[item('menubar.item','New item')];}
  if(['dropdown-menu','context-menu'].includes(family))slots.items=[item(`${family}.item`,'New item')];
  if(/^(dropdown-menu|context-menu|menubar)\.(sub|group|checkbox-group|radio-group)$/.test(family)){const prefix=family.split('.')[0]!;const child=family.endsWith('checkbox-group')?'checkbox-item':family.endsWith('radio-group')?'radio-item':'item';slots.items=[item(`${prefix}.${child}`)];}
  if(family==='command'||family==='command.group')slots.items=[item('command.item','Choose an action')];
  if(family==='command')props.placeholder='Search actions…';
  if(family==='navigation-menu'||family==='navigation-menu.sub')slots.items=[seed('navigation-menu.item')];
  if(family==='navigation-menu.item'){props.value='first';slots.content=[seed('navigation-menu.link')];}
  if(['aspect-ratio','scroll-area','collapsible','popover','tooltip','link-preview'].includes(family))slots.content=[copy('Your content')];
  if(family==='dialog'){props.title='More details';slots.body=[copy('Add your details here.')];}
  if(family==='alert-dialog')slots.body=[copy('Review this local preview action before continuing.')];
  return {family,props,slots};
}
function placements(family:string):readonly UiAuthoringPlacement[]|undefined{
  const under=(parents:string[],slotName:string)=>parents.map(parent=>({definitionId:`vict.catalog.${parent}`,revision:'1',slotName}));
  if(family==='select-item')return under(['select','select-multiple'],'items');
  if(family==='combobox-item')return under(['combobox','combobox-multiple'],'items');
  if(family==='toggle-group-item')return under(['toggle-group','toggle-group-multiple'],'items');
  if(family==='accordion-item')return under(['accordion','accordion-multiple'],'items');
  if(family==='tabs-trigger')return under(['tabs'],'tabs');
  if(family==='tabs-panel')return under(['tabs'],'panels');
  if(family==='toolbar-button')return under(['toolbar'],'tools');
  if(family==='menubar.menu')return under(['menubar'],'menus');
  if(/^(dropdown-menu|context-menu|menubar)\./.test(family)){const prefix=family.split('.')[0]!;if(family.endsWith('.radio-item'))return under([`${prefix}.radio-group`],'items');const parents=[prefix==='menubar'?'menubar.menu':prefix,`${prefix}.sub`,`${prefix}.group`];if(family.endsWith('.checkbox-item'))parents.push(`${prefix}.checkbox-group`);return under(parents,'items');}
  if(family==='command.item'||family==='command.group')return under(['command','command.group'],'items');
  if(family==='navigation-menu.item'||family==='navigation-menu.sub')return under(['navigation-menu','navigation-menu.sub'],'items');
  if(family==='navigation-menu.link')return under(['navigation-menu.item'],'content');
  return undefined;
}
function fragment(family:string,source=seed(family)):UiAuthoringFragment{
  const nodes:UiNode[]=[],state:Record<string,UiLocalStateDecl>={},identities:NonNullable<UiAuthoringFragment['identities']>[number][]=[];
  function visit(source:Seed,id:string){
    if(source.text!==undefined){nodes.push({kind:'element',id,tag:'p',children:[`${id}-text`]},{kind:'text',id:`${id}-text`,content:{type:'literal',value:source.text}});return;}
    const descriptor=descriptorFor(source.family!),props:Record<string,UiExpression>={},outputs:Record<string,UiOutputBinding>={};
    const slots=Object.fromEntries(Object.entries(source.slots??{}).map(([name,children])=>[name,{name,children:children.map((_,index)=>`${id}-${name}-${index+1}`)}]));
    const values:Record<string,UiValue>={...source.props};
    // Component-controlled state is declared once from descriptor types and matching outputs.
    for(const prop of descriptor.props){const output=descriptor.outputs?.find(output=>output.name===`${prop.name}Change`&&output.payload===prop.type);if(!output)continue;const initial=values[prop.name]??prop.default??(prop.type==='boolean'?false:prop.type==='number'?0:prop.type==='stringList'||prop.type==='numberList'?[]:'');const key=`${id.replace(/[^a-zA-Z0-9_-]/g,'_')}_${prop.name}`;if(prop.type==='array')continue;state[key]={key,type:prop.type,initial};props[prop.name]={type:'ref',path:`state.${key}`};outputs[output.name]={setState:{key}};delete values[prop.name];}
    for(const [name,value]of Object.entries(values)){const prop=descriptor.props.find(prop=>prop.name===name);if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')props[name]={type:'literal',value};else if(prop&&(prop.type==='stringList'||prop.type==='numberList')){const key=`${id.replace(/[^a-zA-Z0-9_-]/g,'_')}_${name}`;state[key]={key,type:prop.type,initial:value};props[name]={type:'ref',path:`state.${key}`};}}
    nodes.push({kind:'component',id,definitionId:descriptor.id,revision:descriptor.revision,props,...(Object.keys(outputs).length?{outputs}:{}),...(Object.keys(slots).length?{slots}:{})});
    if(rules(source.family!).some(rule=>rule.kind==='uniqueValue'&&rule.property==='value')&&!identities.some(link=>link.nodeId===id&&link.property==='value'))identities.push({nodeId:id,property:'value',sourceNodeId:id});
    if(source.family==='tabs'){
      const trigger=`${id}-tabs-1`,panel=`${id}-panels-1`,key=`${id.replace(/[^a-zA-Z0-9_-]/g,'_')}_value`;
      identities.push({nodeId:trigger,property:'value',sourceNodeId:trigger},{nodeId:panel,property:'value',sourceNodeId:trigger},{stateKey:key,sourceNodeId:trigger});
    }
    for(const [name,children]of Object.entries(source.slots??{}))children.forEach((child,index)=>visit(child,`${id}-${name}-${index+1}`));
  }
  visit(source,'root');return {root:'root',nodes,localState:state,identities};
}
function example(family:string):UiAuthoringFragment{
  let source=seed(family),current=family;
  const visited=new Set<string>();
  while(placements(current)?.length&&!visited.has(current)){
    visited.add(current);const placement=placements(current)![0]!,parentFamily=placement.definitionId.replace('vict.catalog.',''),parent=seed(parentFamily);
    source={...parent,slots:{...parent.slots,[placement.slotName]:[source]}};current=parentFamily;
  }
  return fragment(current,source);
}
function rules(family:string):UiAuthoringRule[]{
  const descriptor=descriptorFor(family),placement=placements(family),result:UiAuthoringRule[]=placement?[{kind:'ancestorSlot',placements:placement}]:[];
  for(const prop of descriptor.props){const output=descriptor.outputs?.find(output=>output.name===`${prop.name}Change`&&output.payload===prop.type);if(output)result.push({kind:'controlledPair',prop:prop.name,output:output.name});}
  if(descriptor.props.some(prop=>prop.name==='label'))result.push({kind:'labelOwnership',mode:'component',property:'label'});
  // These values are provider identities. Ordinary menu-item values are output
  // payloads, while root/sub values are controlled selection: do not conflate them.
  if(placement&&['menubar.menu','navigation-menu.item','accordion-item','select-item','combobox-item','toggle-group-item','command.item','command.group','tabs-trigger','tabs-panel'].includes(family))result.push({kind:'uniqueValue',property:'value',providerIds:[...new Set(placement.map(item=>item.definitionId))],slots:[...new Set(placement.map(item=>item.slotName))],nonempty:true});
  if(/\.(radio|checkbox)-item$/.test(family)){const prefix=family.split('.')[0]!;result.push({kind:'uniqueValue',property:'value',providerIds:[`${prefix}.${family.endsWith('.radio-item')?'radio':'checkbox'}-group`],slots:['items'],nonempty:true});}
  if(family==='tabs')result.push({kind:'requiredParts',slot:'tabs',definitionIds:['vict.catalog.tabs-trigger']},{kind:'requiredParts',slot:'panels',definitionIds:['vict.catalog.tabs-panel']},{kind:'pairedValues',left:{slot:'tabs',definitionIds:['vict.catalog.tabs-trigger'],property:'value'},right:{slot:'panels',definitionIds:['vict.catalog.tabs-panel'],property:'value'}});
  if(family==='menubar')result.push({kind:'requiredParts',slot:'menus',definitionIds:['vict.catalog.menubar.menu']});
  if(family==='radio-group')result.push({kind:'hostRequirement',capability:'structured-radio-options',reason:'Radio group requires typed structured options supplied by a declared host view; local UI state does not support arbitrary object arrays.'});
  if(family==='appshell')result.push({kind:'hostRequirement',capability:'application-navigation',reason:'AppShell needs host-owned declared navigation and path semantics; a screen-local composition cannot invent routes.'});
  return result;
}
const category=(family:string)=>/^(date|time|calendar|range-calendar)/.test(family)?'date-time':/menu|tabs|pagination|command/.test(family)?'navigation':/dialog|popover|tooltip|collapsible|accordion/.test(family)?'disclosure':/select|combobox|checkbox|switch|toggle|slider|radio/.test(family)?'input':'presentation';
export const catalogAuthoringRegistrations:readonly UiAuthoringRegistration[]=descriptors.map(descriptor=>{
  const family=descriptor.id.replace('vict.catalog.',''),prepared=fragment(family),placement=placements(family),host=['radio-group','appshell'].includes(family);
  const dependencies=[...new Set(prepared.nodes.flatMap(node=>node.kind==='component'&&node.definitionId!==descriptor.id?[node.definitionId]:[]))].map(id=>({id,revision:descriptors.find(item=>item.id===id)!.revision}));
  return {descriptor,label:title(family),family:'general',category:category(family),purpose:`${title(family)} · ${placement?'part for its compatible provider slot':'editable properties, declared slots and outputs'}`,
    eligibility:host?{kind:'host-required',reason:family==='radio-group'?'Requires a structured-options host view.':'Requires application navigation host semantics.'}:placement?{kind:'part'}:{kind:'standalone'},
    dependencies,rules:rules(family),guidance:['Use exact declared props, slots, output payloads and style targets.','Source composition does not prove observed behavior or completion.',...(placement?['Context-owned parts keep their compatible provider/slot; wrappers do not grant a new context.']:[]),...(descriptor.props.some(prop=>prop.name==='label')?['The component owns its accessible label; avoid adding a duplicate external label.']:[])],seed:prepared,examples:[example(family)],legacyCompatibility:true};
});
export const catalogAuthoringPackage:UiAuthoringPackage={schema:'vict.ui-authoring@1',packageName:packageManifest.name,packageVersion:packageManifest.version,registrations:catalogAuthoringRegistrations,compatibility,
  exportDispositions:Object.keys(packageManifest.exports).map(name=>({name,disposition:name.startsWith('./catalog/')?'direct-presentation-api':'host-or-infrastructure-api',reason:'Canonical authoring eligibility is explicit in descriptor registrations. Raw components, renderer helpers, hooks and styles are not automatically authorable.'}))};
