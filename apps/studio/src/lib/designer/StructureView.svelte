<script lang="ts">
  import { onDestroy, tick, untrack, setContext } from 'svelte';
  import {structureGeometryContext,type StructureGeometryContext} from './structure-edge-geometry.js';
  import { FlowCanvas, FlowNavigation, Controls, layoutGraph, LayoutFence, type Node, type Edge, type Connection, type Viewport, type LayoutDirection } from '@victframework/ui-flow-svelte';
  import StructureEdge from './StructureEdge.svelte';
  import StructuredSourceNode from './StructuredSourceNode.svelte';
  import {structureTraceContext,selectionHighlight,connectionGroup,portConnections,type StructureTraceContext} from './structure-trace.js';
  import {selectionOperation,type SelectionOperation} from '@victframework/ui-editor';
  import {changeSelection,primaryItem,type WorkspaceSelection,type WorkspaceItem} from './workspace-selection.js';
  import {structurePorts,structureConnectionEdges} from './structure-connections.js';
  import '@victframework/ui-flow-svelte/styles.css';
  import './studio-cards.css';
  import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
  import { type InsertRecipe } from '@victframework/ui-editor';
  import { projectStructure, filterStructure, connectedStructure, compactStructure, structureNodePresentation, structureFacts, structureId, parseStructureId, structureMove, type StructureNodeData, type StructureEditRequest, type StructureHandoff, type StructureContext } from './structure.js';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  import WorkspaceMenu from './WorkspaceMenu.svelte';
  import WorkspaceContextMenu from './WorkspaceContextMenu.svelte';
  import { sourceCapabilities, type WorkspaceContext, type WorkspaceCommand } from './workspace-context.js';

  let { document, context={}, selection, onSelectionIntent, revision, selectedNodeId, focusSelection, blocked = false, active = true, presentation = 'workspace', descriptors = [], recipes = [], onSelect, onDeselect, onMove, onNotice, onNavigate, onDismiss, onInspect, onCloseInspect, onInspectSelection, inspectionExpanded = false, inspectionSelection, inspectionLabel='Inspect', objectCommands }: {
    selection?:WorkspaceSelection;onSelectionIntent?:(items:readonly WorkspaceItem[],operation:SelectionOperation)=>void;
    document: UiDocument; context?:StructureContext; revision: string; selectedNodeId?: string; focusSelection?:string; blocked?: boolean; active?: boolean;
    descriptors?: readonly UiExtensionDescriptor[]; recipes?: readonly InsertRecipe[];
    onSelect: (occurrence: string) => void; onMove: (request: StructureEditRequest) => boolean;
    onDeselect?: () => void;
    presentation?: 'workspace' | 'drawer'; onDismiss?: () => void;
    onNotice: (message: string) => void; onNavigate?: (request: StructureHandoff) => void;
    onInspect?: (id?:string, page?:'properties'|'relationships') => void; onCloseInspect?: () => void; onInspectSelection?: (id:string) => void; inspectionExpanded?:boolean; inspectionSelection?:string; inspectionLabel?:string;
    objectCommands?: (occurrence:string) => WorkspaceCommand[];
  } = $props();
  let nodes = $state<Node<StructureNodeData>[]>([]);
  let edges = $state<Edge[]>([]);
  let localSelection=$state<WorkspaceSelection>({documentId:'',items:[]});
  const currentSelection=$derived(selection??localSelection);
  const chosenItems=$derived(currentSelection.items);
  let hoveredEdges=$state<string[]>([]);
  let focusedEdges=$state<string[]>([]);
  const visibleChosen=$derived(chosenItems.filter(item=>item.kind==='node'?nodes.some(node=>node.id===item.id):edges.some(edge=>edge.id===item.id)));
  const tracedConnection=$derived(selectionHighlight(edges,visibleChosen,hoveredEdges.length?hoveredEdges:focusedEdges));
  function requestSelection(items:readonly WorkspaceItem[],operation:SelectionOperation='replace'){
    if(blocked){onNotice('Apply or cancel your draft before changing selection.');return;}
    hoveredEdges=[];focusedEdges=[];
    if(onSelectionIntent)onSelectionIntent(items,operation);
    else localSelection=changeSelection(localSelection,items,operation);
  }
  function clearTrace(){requestSelection([]);}
  function focusConnection(event:FocusEvent){
    const id=event.target instanceof Element?event.target.closest('.svelte-flow__edge')?.getAttribute('data-id'):undefined;
    focusedEdges=id?connectionGroup(edges,id).map(edge=>edge.id):[];
  }
  setContext<StructureTraceContext>(structureTraceContext,{
    current:()=>tracedConnection,
    blocked:()=>blocked,
    isPortSelected:(node,port)=>{const members=portConnections(edges,node,port);return members.length>0&&members.every(edge=>chosenItems.some(item=>item.kind==='edge'&&item.id===edge.id));},
    hoverPort:(node,port)=>{hoveredEdges=port?portConnections(edges,node,port).map(edge=>edge.id):[];},
    selectPort:(node,port,event)=>requestSelection(portConnections(edges,node,port).map(edge=>({kind:'edge' as const,id:edge.id})),selectionOperation(event)),
  });
  const nodeRects=$derived(new Map(nodes.map(node=>[node.id,{x:node.position.x,y:node.position.y,width:node.measured?.width??node.width??224,height:node.measured?.height??node.height??94}])));
  setContext<StructureGeometryContext>(structureGeometryContext,{nodes:()=>nodeRects});
  $effect(()=>{
    const items=chosenItems;
    untrack(()=>{
      nodes=nodes.map(node=>{const selected=items.some(item=>item.kind==='node'&&item.id===node.id);return node.selected===selected?node:{...node,selected};});
      edges=edges.map(edge=>{const selected=items.some(item=>item.kind==='edge'&&item.id===edge.id);return edge.selected===selected?edge:{...edge,selected};});
      const primary=primaryItem(currentSelection);if(selection)inspectedId=primary?.kind==='node'?primary.id:undefined;
    });
  });
  let viewport = $state<Viewport>({ x: 24, y: 24, zoom: .85 });
  let allowMoves = $state(false);
  let inspectedId = $state<string>();
  let search = $state('');
  let showBindings = $state(true);
  let inventory = $state(false);
  let showDefinitions = $state(false);
  let focusedId = $state<string>();
  let graphView=$state('connections');
  let connectionFocus=$state<string>();
  let showOtherUsers = $state(false);
  let connectionLimit = $state(25);
  let expandedGroups = $state<Set<string>>(new Set());
  let graphSelection:string|undefined;
  $effect(()=>{if(focusSelection)connectionFocus=focusSelection;});
  let collapsed = $state<Set<string>>(new Set());
  let direction = $state<LayoutDirection>('RIGHT');
  let layoutVersion = $state(0);
  let layoutStatus = $state('');
  let layoutNote = $state('');
  let navigationRequest = $state<object>();
  let navigationIds = $state<string[]>([]);
  let moveSource = $state('');
  let moveTarget = $state('');
  let activeMenu = $state('');
  let inspectionOpen = $state(false);
  let inspectionPage = $state<'properties' | 'relationships' | 'find' | 'move'>('properties');
  let showTextNodes = $state(false);
  let inspectionButton: HTMLButtonElement;
  let structureElement = $state<HTMLElement>();
  $effect(()=>{const element=structureElement;if(!element)return;const inspect=(event:MouseEvent)=>{if(!blocked&&event.target instanceof Element&&event.target.closest('.svelte-flow__edge,.svelte-flow__node')&&!event.target.closest('.port-control'))onInspect?.();};element.addEventListener('dblclick',inspect);return()=>element.removeEventListener('dblclick',inspect);});
  const fittedDocuments = new Set<string>();
  const graph = $derived(projectStructure(document,{descriptors,...context}));
  $effect(()=>{if(!selection && inspectionSelection && graph.nodes.some(node=>node.id===inspectionSelection))inspectedId=inspectionSelection;});
  const compactGraph = $derived(compactStructure(graph, document));
  const groupGraph = $derived(showTextNodes || search ? graph : compactGraph);
  const inspected = $derived(graph.nodes.find(node => node.id === inspectedId));
  const framingIds=$derived([...new Set(chosenItems.flatMap(item=>item.kind==='node'?[item.id]:edges.filter(edge=>edge.id===item.id).flatMap(edge=>[edge.source,edge.target])).filter(id=>nodes.some(node=>node.id===id)))]);
  const related = $derived(graph.edges.filter(edge => (edge.source === inspectedId || edge.target === inspectedId) && edge.data?.kind !== 'containment'));
  const facts = $derived(inspected ? structureFacts(document, inspected) : []);
  const filtered = $derived(filterStructure(graph, { search, focusId: focusedId, collapsed, bindings: showBindings, definitions: showDefinitions, inventory }));
  const scopeId = $derived(connectionFocus ?? structureId(document.id,'node',selectedNodeId ?? document.root));
  const scopeNode = $derived(graph.nodes.find(node=>node.id===scopeId));
  const scopeLabel = $derived(scopeNode ? structureNodePresentation(document,scopeNode.data).fullLabel : 'Screen');
  const visibleGraph = $derived(showTextNodes || search ? filtered : compactStructure(filtered, document));
  // Keep the explicit focus visible even if its category is currently hidden.
  const eligibleGraph = $derived(scopeNode && !visibleGraph.nodes.some(node=>node.id===scopeId) ? {...visibleGraph,nodes:[...visibleGraph.nodes,scopeNode]} : visibleGraph);
  const directConnections = $derived(connectedStructure(eligibleGraph,scopeId,{limit:Infinity,expanded:expandedGroups}));
  const extendedConnections = $derived(connectedStructure(eligibleGraph,scopeId,{related:true,limit:Infinity,expanded:expandedGroups}));
  const otherUsers = $derived(extendedConnections.nodes.length-directConnections.nodes.length);
  const connectionGraph=$derived(connectedStructure(eligibleGraph,scopeId,{related:showOtherUsers,limit:connectionLimit,expanded:expandedGroups}));
  const availableConnections = $derived(showOtherUsers ? extendedConnections.nodes.length : directConnections.nodes.length);
  const projected = $derived(graphView==='connections' && !search ? connectionGraph : visibleGraph);
  const availableItems = $derived(graphView==='connections' && !search ? availableConnections : graph.nodes.length);
  const rawConnections = $derived(graph.edges.some(edge=>edge.source===scopeId || edge.target===scopeId));
  $effect(()=>{void scopeId;showOtherUsers=false;connectionLimit=25;expandedGroups=new Set();});
  const nodeTypes = { source: StructuredSourceNode };
  const edgeTypes = { routed: StructureEdge };
  const fence = new LayoutFence();
  let connectionStart: { documentId: string; revision: string } | undefined;
  let layoutDocument = '';
  const presentations = new Map<string, { viewport: Viewport; positions: Map<string, { x: number; y: number }>; collapsed: Set<string>; inspectedId?: string; connectionFocus?:string; direction: LayoutDirection; search: string; focusedId?: string; bindings: boolean; definitions: boolean; inventory:boolean; text: boolean; inspection: boolean; page: typeof inspectionPage }>();
  function remember() {
    if (!layoutDocument) return;
    presentations.set(layoutDocument, { viewport: { ...viewport }, positions: new Map(nodes.map(node => [node.id, { ...node.position }])), collapsed: new Set(collapsed), inspectedId, connectionFocus, direction, search, focusedId, bindings: showBindings, definitions: showDefinitions, inventory, text: showTextNodes, inspection: inspectionOpen, page: inspectionPage === 'move' ? 'properties' : inspectionPage });
  }
  $effect(() => {
    const id = document.id;
    if (id === untrack(() => layoutDocument)) return;
    if(!selection)localSelection={documentId:id,items:[]};
    hoveredEdges=[];focusedEdges=[];
    untrack(remember);
    layoutDocument = id;
    const saved = presentations.get(id);
    viewport = saved?.viewport ?? { x: 24, y: 24, zoom: .85 };
    collapsed = saved?.collapsed ?? new Set(graph.nodes.filter(node => node.data.occurrence && (node.data.childCount ?? 0) > (presentation === 'drawer' ? 1 : 3) && node.data.sourceId !== document.root).map(node => node.id));
    inspectedId = saved?.inspectedId ?? (selectedNodeId ? structureId(id, 'node', selectedNodeId) : structureId(id, 'node', document.root));
    connectionFocus=focusSelection ?? saved?.connectionFocus ?? structureId(id,'node',selectedNodeId ?? document.root);
    direction = saved?.direction ?? 'RIGHT'; search = saved?.search ?? ''; focusedId = saved?.focusedId;
    inventory=saved?.inventory??false;showBindings = saved?.bindings ?? true; showDefinitions = saved?.definitions ?? false; allowMoves = false;
    showTextNodes = saved?.text ?? false; inspectionOpen = saved?.inspection ?? false; inspectionPage = saved?.page ?? 'properties';
  });
  const canonicalSelection=$derived(selectedNodeId?structureId(document.id,'node',selectedNodeId):undefined);
  $effect(() => {
    const selectedId=canonicalSelection;
    if(selection||!selectedId)return;
    untrack(()=>{inspectedId=selectedId;if(graphSelection!==selectedId)connectionFocus=selectedId;graphSelection=undefined;});
  });
  $effect(() => {
    const selectedId=canonicalSelection;
    if(selection||!selectedId)return;
    // Canonical revisions may change ancestry, but must not replace an
    // inspected data/action scope when the selected occurrence is unchanged.
    const next = new Set(untrack(() => collapsed));
    const seen = new Set<string>(); let current = selectedId;
    while (!seen.has(current)) {
      seen.add(current);
      const owner = graph.edges.find(edge => edge.data?.kind === 'containment' && edge.target === current)?.source;
      if (!owner) break;
      next.delete(owner); current = owner;
    }
    if (next.size !== untrack(() => collapsed.size)) collapsed = next;
  });
  $effect(() => {
    void revision;
    const currentGraph = projected;
    const orientation = direction;
    const editable = allowMoves && !blocked;
    const previous = untrack(() => new Map(nodes.map(node => [node.id, node])));
    const remembered = untrack(() => presentations.get(document.id)?.positions);
    nodes = currentGraph.nodes.map(node => {
      const old = previous.get(node.id);
      const source = node.data.sourceId && document.nodes[node.data.sourceId];
      const target = !!node.data.occurrence && !!source && ((source.kind === 'element' && ['main', 'section', 'div', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'fieldset', 'ul', 'ol', 'li'].includes(source.tag)) || (source.kind === 'component' && (descriptors.find(entry => entry.id === source.definitionId)?.slots?.length ?? 0) === 1));
      return { ...node, position: old?.position ?? remembered?.get(node.id) ?? node.position, measured: old?.measured, selectable:false,selected:untrack(()=>chosenItems.some(item=>item.kind==='node'&&item.id===node.id)),
        data: { ...structureNodePresentation(document, node.data), ports:structurePorts(currentGraph,node.id), direction: orientation, moveSource: editable && !!node.data.occurrence && node.data.sourceId !== document.root, moveTarget: editable && target,
          collapsed: groupClosed(node.id), onToggleGroup: groupGraph.edges.some(edge => edge.source === node.id && edge.data?.kind === 'containment') ? () => collapse(node.id) : undefined } };
    });
    const oldEdges=untrack(()=>new Map(edges.map(edge=>[edge.id,edge])));
    edges=structureConnectionEdges(currentGraph).map(edge=>({...edge,selectable:false,selected:untrack(()=>chosenItems.some(item=>item.kind==='edge'&&item.id===edge.id)),data:{...edge.data,route:oldEdges.get(edge.id)?.data?.route}}));
  });
  const measuredSignature = $derived(nodes.map(node => `${node.id}:${node.measured?.width ?? 0}:${node.measured?.height ?? 0}`).join('|'));
  $effect(() => {
    void measuredSignature; void revision; void layoutVersion; void direction; void projected;
    if(!active){fence.cancel();layoutStatus='';return;}
    const ticket = fence.issue();
    const currentNodes = untrack(() => nodes.map(node => ({ ...node, data: { ...node.data } })));
    const currentEdges = untrack(() => [...edges]);
    const orientation = direction;
    layoutStatus = 'Arranging source…';
    void layoutGraph(currentNodes, currentEdges, { engine: 'elk', direction: orientation }).then(result => {
      if (!fence.current(ticket)) return;
      const positions = new Map(result.nodes.map(node => [node.id, node.position]));
      nodes = nodes.map(node => ({ ...node, position: positions.get(node.id) ?? node.position }));
      edges = result.edges;
      layoutNote = result.reason ? 'Using a simpler layout for this large view. Focus on an item or collapse groups for a clearer view.' : '';
      layoutStatus = '';
    }).catch(() => { if (fence.current(ticket)) layoutStatus = 'Layout unavailable. Existing positions retained; retry Arrange.'; });
    return () => fence.cancel();
  });
  onDestroy(() => { remember(); fence.cancel(); });
  $effect(() => {
    if (presentation !== 'drawer' || !active || layoutStatus || !nodes.length || nodes.some(node => !node.measured?.width) || fittedDocuments.has(document.id)) return;
    fittedDocuments.add(document.id); locate();
  });
  let framedConnections='';
  $effect(()=>{
    if(!active || search || graphView!=='connections' || layoutStatus || !nodes.length || nodes.some(node=>!node.measured?.width))return;
    const key=`${document.id}|${connectionFocus}`;
    if(key!==framedConnections){framedConnections=key;locate();}
  });
  function locate(ids: string[] = []) { navigationIds = ids; navigationRequest = {}; }
  function select(node: Node<StructureNodeData>,event:{ctrlKey?:boolean;metaKey?:boolean}={}) {
    if (blocked) { onNotice('Apply or cancel your draft before changing selection.'); return; }
    inspectedId = node.id;
    requestSelection([{kind:'node',id:node.id,...(node.data.occurrence?{occurrence:node.data.occurrence}:{})}],selectionOperation(event));
    if(!selection)onInspectSelection?.(node.id);
    if(!selection && node.data.occurrence){graphSelection=node.id;onSelect(node.data.occurrence);}
  }
  async function reveal(node: Node<StructureNodeData>) {
    if (blocked) { onNotice('Apply or cancel your draft before changing selection.'); return; }
    search = ''; focusedId = undefined;connectionFocus=node.id;graphView='connections';
    const next=new Set(collapsed);let current=node.id;const seen=new Set<string>();
    while(!seen.has(current)){seen.add(current);const parent=graph.edges.find(edge=>edge.data?.kind==='containment'&&edge.target===current)?.source;if(!parent)break;next.delete(parent);current=parent;}collapsed=next;
    if (node.data.kind !== 'node') { showBindings = true; showDefinitions = true; }
    else if (document.nodes[node.data.sourceId ?? '']?.kind === 'text') showTextNodes = true;
    if (node.data.definitionSource) showDefinitions=true;
    select(node); await tick(); locate([node.id]);
  }
  function closeInspection(restoreFocus = true) {
    inspectionOpen = false; allowMoves = false; moveSource = ''; moveTarget = '';
    if (restoreFocus) inspectionButton?.focus({ preventScroll: true });
  }
  function openInspection(page: typeof inspectionPage = 'properties') {
    if (onInspect && (page === 'properties' || page === 'relationships')) { onInspect(inspectedId,page); return; }
    allowMoves = page === 'move'; inspectionPage = page; inspectionOpen = true;
  }
  function deselect() {
    clearTrace();
    closeInspection(false);
    if (blocked) return;
    inspectedId = undefined; onDeselect?.();
  }
  function keyboardSelection(event: KeyboardEvent) {
    // Flow's Enter/Space selection does not emit onnodeclick. Only handle a
    // focused node wrapper, never an input or its nested disclosure button.
    const target = event.target;
    if(target instanceof Element && target.matches('.svelte-flow__edge') && ['Enter',' '].includes(event.key)){event.preventDefault();const id=target.getAttribute('data-id');if(id)requestSelection(connectionGroup(edges,id).map(edge=>({kind:'edge' as const,id:edge.id})),selectionOperation(event));return;}
    if (!(target instanceof HTMLElement) || !target.matches('.svelte-flow__node')) return;
    const node = nodes.find(entry => entry.id === target.dataset.id);
    if(node && ['Enter',' '].includes(event.key)){event.preventDefault();select(node,event);}
  }
  function graphEscape(event: KeyboardEvent) {
    if(active && !activeMenu && event.key==='Escape' && tracedConnection && event.target instanceof Element && structureElement?.contains(event.target) && !event.target.closest('[role=menu],input,textarea,[contenteditable=true]')){event.preventDefault();event.stopPropagation();clearTrace();return;}
    if (!active || activeMenu || event.key !== 'Escape' || !(event.target instanceof HTMLElement) || event.target.closest('[role="menu"]')) return;
    if(!event.target.matches('.svelte-flow__node')){
      if(structureElement?.contains(event.target)){escape(event);if(event.defaultPrevented)event.stopPropagation();}
      return;
    }
    // Run before Flow's wrapper, which otherwise clears its own selection even
    // when Escape is only closing our dock. Keep the two selection owners equal.
    event.preventDefault(); event.stopPropagation();
    if (inspectionOpen) closeInspection(); else if (inspectedId || !onDismiss) deselect(); else onDismiss();
  }
  function beginMove() {
    moveSource = inspected?.data.occurrence && inspected.data.sourceId !== document.root ? inspected.id : '';
    moveTarget = ''; openInspection('move');
  }
  function commitMove(request: StructureEditRequest) {
    if (onMove(request)) { allowMoves = false; inspectionPage = 'properties'; moveSource = ''; moveTarget = ''; }
  }
  function escape(event: KeyboardEvent) {
    if (!active || event.defaultPrevented || event.key !== 'Escape' || activeMenu) return;
    if (presentation === 'drawer' && (!(event.target instanceof Element) || !structureElement?.contains(event.target))) return;
    if (inspectionOpen) { event.preventDefault(); closeInspection(); }
    else if (focusedId || search) { event.preventDefault(); search = ''; focusedId = undefined; }
    else if (onDismiss) { event.preventDefault(); onDismiss(); }
  }
  function connect(connection: Connection) {
    const start = connectionStart; connectionStart = undefined;
    if (!allowMoves || !start || connection.sourceHandle!=='content' || connection.targetHandle!=='container') return;
    commitMove({ ...start, source: connection.source, target: connection.target });
  }
  function valid(connection: Connection | Edge): boolean {
    return allowMoves && !blocked && connection.sourceHandle==='content' && connection.targetHandle==='container' && structureMove(document, revision, { documentId: document.id, revision, source: connection.source, target: connection.target }, false, descriptors, recipes).ok;
  }
  function groupClosed(id:string) {return collapsed.has(id) || (graphView==='connections' && !search && id!==scopeId && !expandedGroups.has(id));}
  function collapse(id: string) {
    const next = new Set(collapsed),expanded=new Set(expandedGroups);
    if(groupClosed(id)){next.delete(id);expanded.add(id);}else{next.add(id);expanded.delete(id);}
    collapsed = next;expandedGroups=expanded;
  }
  function navigate(destination: StructureHandoff['destination']) {
    if (!inspected || blocked) return;
    onNavigate?.({ destination, sourceId: inspected.data.sourceId, occurrence: inspected.data.occurrence, key: parseStructureId(inspected.id)?.[2] });
  }
  const moveSources = $derived(graph.nodes.filter(node => node.data.occurrence && node.data.sourceId !== document.root));
  const targetOptions = $derived(graph.nodes.filter(node => !!moveSource && valid({ source: moveSource, target: node.id, sourceHandle: 'content', targetHandle: 'container' })));
  function resolveContext(target:Element):WorkspaceContext|undefined {
    if (!target.closest('.structure-canvas')) return;
    const id = target.closest<HTMLElement>('.svelte-flow__node')?.dataset.id;
    const node = graph.nodes.find(entry=>entry.id===id);
    if (!node) return;
    const direct = node.data.occurrence && sourceCapabilities(document,node.data.occurrence).direct;
    const commands:WorkspaceCommand[] = node.data.occurrence && objectCommands ? objectCommands(node.data.occurrence) : [
      {label:'Inspect', disabled:blocked, run:()=>openInspection('properties')},
      ...(direct ? [{label:'Edit on canvas', disabled:blocked, run:()=>navigate('inspector')}, {label:'Locate on canvas',disabled:blocked,run:()=>navigate('design')}] : []),
    ];
    commands.push({label:'Inspect relationships',disabled:blocked,run:()=>openInspection('relationships')});
    if (node.data.childCount) commands.push({label:groupClosed(node.id)?'Expand group':'Collapse group',run:()=>collapse(node.id)});
    if (direct) commands.push({label:'Move inside…',disabled:blocked || node.data.sourceId===document.root,run:beginMove});
    return {label:'Structure item commands', prepare:()=>select(node), commands};
  }
</script>
<svelte:window onkeydown={escape} onkeydowncapture={graphEscape} />
<section data-studio-typography class="studio-type-scope structure-view" class:drawer-presentation={presentation === 'drawer'} class:inspection-open={inspectionOpen} aria-label="Source structure" bind:this={structureElement}>
  <WorkspaceContextMenu scope={structureElement} enabled={active} resolve={resolveContext} />
  <div class="structure-tools">
    <input type="search" aria-label="Search structure" placeholder="Search structure" bind:value={search} />
    <Menubar.Root class="workspace-menus" aria-label="Structure menus" bind:value={activeMenu} loop>
      <WorkspaceMenu label="View" value="structure-view" {activeMenu}>
        <Menubar.RadioGroup bind:value={graphView} aria-label="Structure view">
          <Menubar.RadioItem value="connections" closeOnSelect>Focused connections<span aria-hidden="true">{graphView==='connections'?'✓':''}</span></Menubar.RadioItem>
          <Menubar.RadioItem value="hierarchy" closeOnSelect onSelect={()=>{focusedId=undefined;search='';}}>Whole hierarchy<span aria-hidden="true">{graphView==='hierarchy'?'✓':''}</span></Menubar.RadioItem>
        </Menubar.RadioGroup>
        <Menubar.CheckboxItem bind:checked={inventory} closeOnSelect={false} onSelect={()=>{graphView='hierarchy';focusedId=undefined;}}>All declarations<span aria-hidden="true">{inventory?'✓':''}</span></Menubar.CheckboxItem><Menubar.Separator />
        <Menubar.Item disabled={!framingIds.length} onSelect={() => locate(framingIds)}>Frame selection</Menubar.Item>
        <Menubar.Item disabled={!inspected || blocked} onSelect={() => { if (inspected) void reveal(inspected); }}>Focus on selection</Menubar.Item>
        <Menubar.Item onSelect={() => { graphView='hierarchy';focusedId = undefined; search = ''; }}>Show whole screen</Menubar.Item>
        <Menubar.Item onSelect={() => openInspection('find')}>Find source item</Menubar.Item>
        <Menubar.Separator />
        <Menubar.Item onSelect={() => layoutVersion++}>Arrange nodes</Menubar.Item>
        <Menubar.Item onSelect={() => { collapsed = new Set(); expandedGroups=new Set(graph.nodes.filter(node=>node.data.childCount).map(node=>node.id)); }}>Expand all groups</Menubar.Item>
        <Menubar.Group><Menubar.GroupHeading class="menu-caption">Layout</Menubar.GroupHeading>
          <Menubar.RadioGroup bind:value={direction} aria-label="Structure layout direction">
            <Menubar.RadioItem value="RIGHT" closeOnSelect>Left to right</Menubar.RadioItem>
            <Menubar.RadioItem value="DOWN" closeOnSelect>Top to bottom</Menubar.RadioItem>
          </Menubar.RadioGroup>
        </Menubar.Group>
        <Menubar.Separator />
        <Menubar.Group><Menubar.GroupHeading class="menu-caption">Relationships</Menubar.GroupHeading>
          <Menubar.CheckboxItem bind:checked={showBindings} closeOnSelect={false}>Dependencies<span aria-hidden="true">{showBindings ? '✓' : ''}</span></Menubar.CheckboxItem>
          <Menubar.CheckboxItem bind:checked={showDefinitions} closeOnSelect={false}>Component definitions<span aria-hidden="true">{showDefinitions ? '✓' : ''}</span></Menubar.CheckboxItem>
          <Menubar.CheckboxItem bind:checked={showTextNodes} closeOnSelect={false}>Show text nodes<span aria-hidden="true">{showTextNodes ? '✓' : ''}</span></Menubar.CheckboxItem>
        </Menubar.Group>
      </WorkspaceMenu>
      {#if inspected}
        <WorkspaceMenu label="Object" value="structure-object" {activeMenu}>
          {#if inspected.data.childCount}<Menubar.Item onSelect={() => collapse(inspected.id)}>{groupClosed(inspected.id) ? 'Expand group' : 'Collapse group'}</Menubar.Item>{/if}
          {#if inspected.data.occurrence}
            <Menubar.Item disabled={blocked} onSelect={() => navigate('inspector')}>Edit on canvas</Menubar.Item>
            <Menubar.Item disabled={blocked} onSelect={() => navigate('layers')}>Reveal in Layers</Menubar.Item>
            <Menubar.Item disabled={blocked} onSelect={() => navigate('design')}>{presentation === 'drawer' ? 'Locate on canvas' : 'Show in Design'}</Menubar.Item>
            <Menubar.Separator />
            <Menubar.Item disabled={blocked || inspected.data.sourceId === document.root} onSelect={beginMove}>Move inside…</Menubar.Item>
          {/if}
          {#if inspected.data.kind === 'state'}<Menubar.Item disabled={blocked} onSelect={() => navigate('data')}>Edit in Data</Menubar.Item>{/if}
          {#if inspected.data.kind === 'action'}<Menubar.Item disabled={blocked} onSelect={() => navigate('actions')}>Open Actions</Menubar.Item>{/if}
          <Menubar.Item onSelect={() => openInspection('relationships')}>Inspect relationships</Menubar.Item>
        </WorkspaceMenu>
      {/if}
    </Menubar.Root>
    <span class="declaration-label" title={`Source declarations; ${inventory?'all registries':'used dependencies'}; visibility filters still apply. This is not live execution.`}>Declared</span>
    {#if search}<span class="scope-label" title="Search includes hidden items and their parent paths. Relationship visibility settings still apply.">Search results · includes hidden items</span>{:else if graphView==='connections'}<span class="scope-label" title={`Focused on ${scopeLabel}`}>Focus: {scopeLabel}</span>{/if}
    {#if chosenItems.length}<span class="scope-label" aria-live="polite">{chosenItems.length} selected{chosenItems.some(item=>item.kind==='node'?!nodes.some(node=>node.id===item.id):!edges.some(edge=>edge.id===item.id))?' · some outside view':''}</span>{/if}
    <span class="structure-count" aria-live="polite" title={graphView==='connections' && !search?'Nearby items after visibility settings':'All declared items; visibility settings, collapsed groups and compact text may hide some'}>{nodes.length < availableItems ? `${nodes.length} of ${availableItems}` : nodes.length} items</span>
    <button type="button" class="inspection-toggle" aria-label={inspectionLabel==='Inspect'?'Inspect structure':'Selection panel'} aria-expanded={onInspect ? inspectionExpanded : inspectionOpen} aria-controls={onInspect ? undefined : 'structure-inspection'} bind:this={inspectionButton} onclick={() => { if (onInspect && inspectionExpanded && onCloseInspect) onCloseInspect(); else if (onInspect) onInspect(inspectedId, 'properties'); else if (inspectionOpen) closeInspection(); else openInspection(inspected ? 'properties' : 'find'); }}>{inspectionLabel}</button>
  </div>
  {#if graphView==='connections' && !search}
    <div class="structure-scope-actions" aria-label="Connection scope">
      {#if inspected && inspectedId!==scopeId}<button type="button" disabled={blocked} onclick={()=>{if(inspected)void reveal(inspected);}}>Focus on selection</button>{/if}
      {#if otherUsers>0}<button type="button" aria-pressed={showOtherUsers} onclick={()=>{showOtherUsers=!showOtherUsers;connectionLimit=25;}}>{showOtherUsers?'Hide other users':`Other users (${otherUsers})`}</button>{/if}
      {#if availableConnections>connectionLimit}<button type="button" onclick={()=>connectionLimit+=24}>Show {Math.min(24,availableConnections-connectionLimit)} more</button>{/if}
    </div>
  {/if}
  <div class="structure-body">
    <div class="structure-canvas" onfocusin={focusConnection} onfocusout={()=>{focusedEdges=[];}} inert={presentation === 'drawer' && inspectionOpen}>
      <FlowCanvas bind:nodes bind:edges bind:viewport {nodeTypes} {edgeTypes} minZoom={.35} maxZoom={2} colorMode="light" showControls={false} showMiniMap={nodes.length > 12}
        nodesConnectable={allowMoves && !blocked} elementsSelectable={!blocked} deleteKey={null} multiSelectionKey={null} selectionKey={null} autoPanOnNodeFocus={false} isValidConnection={valid}
        onnodeclick={({ node,event }) => select(node as Node<StructureNodeData>,event)}
        onkeydown={keyboardSelection}
        onpaneclick={({event})=>{if(!event.ctrlKey&&!event.metaKey)deselect();}}
        onedgepointerenter={({edge})=>{hoveredEdges=connectionGroup(edges,edge.id).map(item=>item.id);}}
        onedgepointerleave={()=>{hoveredEdges=[];}}
        onedgeclick={({edge,event})=>requestSelection(connectionGroup(edges,edge.id).map(item=>({kind:'edge' as const,id:item.id})),selectionOperation(event))}

        onnodedragstart={() => fence.cancel()}
        onconnectstart={() => { connectionStart = { documentId: document.id, revision }; }}
        onclickconnectstart={() => { connectionStart = { documentId: document.id, revision }; }} onconnect={connect}>
        <Controls showLock={false} />
        <FlowNavigation request={navigationRequest} ids={navigationIds} />
      </FlowCanvas>
      {#if graphView==='connections' && !search && connectionGraph.edges.length===0}<p class="connection-empty">{rawConnections ? 'Connections are hidden by visibility settings or collapsed groups.' : 'This item has no declared connections.'}</p>{/if}
      {#if layoutStatus}<p class="structure-status" role="status">{layoutStatus}</p>{/if}
      {#if layoutNote && !layoutStatus}<p class="structure-layout-note" role="status">{layoutNote}</p>{/if}
      {#if viewport.zoom<.65 && !layoutStatus && nodes.length}<div class="structure-scale-hint">Zoom in for easier reading.<button type="button" disabled={!framingIds.length} onclick={()=>locate(framingIds)}>Frame selection</button></div>{/if}
      {#if !nodes.length}<div class="structure-empty"><p>No matching items</p><button type="button" onclick={() => { search = ''; focusedId = undefined; }}>Clear search</button></div>{/if}
    </div>
    {#if inspectionOpen}
      <aside class="structure-details" id="structure-inspection" aria-label="Structure inspection">
        <div class="inspection-heading"><strong title={inspected?.data.fullLabel ?? inspected?.data.label}>{inspected ? structureNodePresentation(document, inspected.data).label : 'Find source item'}</strong><button type="button" aria-label="Close inspection" onclick={() => closeInspection()}>×</button></div>
        {#if inspectionPage === 'move'}
          <div class="structure-moves">
            <h3>Move inside</h3>
            <label>Content<select aria-label="Content to move" value={moveSource} onchange={event => { moveSource = event.currentTarget.value; moveTarget = ''; }}><option value="">Choose content</option>{#each moveSources as node (node.id)}<option value={node.id}>{structureNodePresentation(document, node.data).label} · {node.data.sourceId}</option>{/each}</select></label>
            <label>Container<select aria-label="Move destination" value={moveTarget} onchange={event => moveTarget = event.currentTarget.value}><option value="">Choose container</option>{#each targetOptions as node (node.id)}<option value={node.id}>{structureNodePresentation(document, node.data).label} · {node.data.sourceId}</option>{/each}</select></label>
            <div class="move-actions"><button type="button" disabled={blocked || !moveSource || !targetOptions.some(node => node.id === moveTarget)} onclick={() => commitMove({ documentId: document.id, revision, source: moveSource, target: moveTarget })}>Move</button><button type="button" onclick={() => { allowMoves = false; inspectionPage = 'properties'; }}>Cancel</button></div>
            <p class="inspection-hint">Moves content in the document. Undo restores its previous place.</p>
          </div>
        {:else}
          <div class="inspection-pages" aria-label="Inspection view">
            <button type="button" aria-pressed={inspectionPage === 'properties'} onclick={() => inspectionPage = 'properties'}>Details</button>
            <button type="button" aria-pressed={inspectionPage === 'relationships'} onclick={() => inspectionPage = 'relationships'}>Relationships</button>
            <button type="button" aria-pressed={inspectionPage === 'find'} onclick={() => inspectionPage = 'find'}>Find</button>
          </div>
          <div class="inspection-content">
            {#if inspectionPage === 'find'}
              <label class="source-finder">Source item<select aria-label="Structure source selection" value={inspectedId ?? ''} onchange={event => { const node = graph.nodes.find(entry => entry.id === event.currentTarget.value); if (node) void reveal(node); }}><option value="">Select an item</option>{#each graph.nodes as node (node.id)}<option value={node.id}>{structureNodePresentation(document, node.data).label} · {node.data.sourceId ?? parseStructureId(node.id)?.[2]}</option>{/each}</select></label>
              <p class="inspection-hint">Includes hidden items and source references.</p>
            {:else if !inspected}
              <p class="inspection-hint">Select an item on the graph, or use Find.</p>
            {:else if inspectionPage === 'properties'}
              <div class="inspection-identity"><span>{inspected.data.kindLabel ?? inspected.data.kind}</span><code>{inspected.data.sourceId ?? parseStructureId(inspected.id)?.[2]}</code></div>
              {#if inspected.data.occurrence}<button class="edit-handoff" type="button" disabled={blocked} onclick={() => navigate('inspector')}>Edit on canvas</button>{/if}
              {#if inspected.data.kind === 'state'}<button class="edit-handoff" type="button" disabled={blocked} onclick={() => navigate('data')}>Edit in Data</button>{/if}
              {#if inspected.data.kind === 'action'}<button class="edit-handoff" type="button" disabled={blocked} onclick={() => navigate('actions')}>Open Actions</button>{/if}
              <div class="structure-facts">{#each facts as fact}<div><code>{fact.path}</code><span>{fact.value}</span></div>{/each}</div>
            {:else}
              <div class="structure-relations">{#each related as edge (edge.id)}{@const other = graph.nodes.find(node => node.id === (edge.source === inspectedId ? edge.target : edge.source))}<button type="button" disabled={blocked} onclick={() => { if (other) select(other); }}><strong>{other ? structureNodePresentation(document, other.data).label : 'Source item'}</strong><span>{edge.label}</span><code>{edge.data?.path}</code></button>{/each}</div>
              {#if !related.length}<p class="inspection-hint">No declared relationships.</p>{:else}<button type="button" onclick={() => { if (inspected) void reveal(inspected); }}>Show on graph</button>{/if}
            {/if}
          </div>
        {/if}
      </aside>
    {/if}
  </div>
</section>

<style>
  .declaration-label{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}
  .scope-label { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .structure-scope-actions { display:flex; align-items:center; gap:8px; padding:0 10px; flex-wrap:wrap; }
  .structure-scope-actions:has(button) { padding-top:4px; padding-bottom:4px; border-bottom:1px solid var(--vict-color-border); }
  .structure-scope-actions button { background:transparent; border:1px solid var(--vict-color-border); border-radius:4px; padding:3px 7px; font:inherit; color:var(--vict-color-textMuted); cursor:pointer; }
  .structure-scope-actions button[aria-pressed=true] { background:var(--vict-control-selected); }
  .structure-layout-note { position:absolute; top:8px; right:8px; max-width:300px; margin:0; padding:8px; background:white; border:1px solid var(--vict-color-border); font:var(--studio-font-meta); color:var(--vict-color-textMuted); z-index:5; }
  .structure-view { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; min-width: 0; color: #26334b; background: #f8fafc; font:var(--studio-font-ui,12px/1.45 system-ui,sans-serif); }
  .drawer-presentation { container: structure-panel / inline-size; }
  .drawer-presentation .structure-body { position: relative; }
  .drawer-presentation.inspection-open .structure-canvas { visibility: hidden; }
  .drawer-presentation .structure-details { position: absolute; inset: 0; width: 100%; min-width: 0; max-height: none; flex-basis: auto; border: 0; }
  @container structure-panel (max-width: 540px) {
    .structure-tools { flex-wrap: wrap; }
    .structure-tools input { flex-basis: 100%; max-width: none; }
  }
  .structure-tools { display: flex; align-items: center; gap: 6px; padding: 6px 10px; min-height: 40px; flex-shrink: 0; border-bottom: 1px solid #e1e6ee; }
  button, select, input[type=search] { box-sizing: border-box; max-width: 100%; border: 1px solid #dce2eb; border-radius: 5px; background: white; color: inherit; padding: 6px 8px; font: inherit; }
  button { cursor: pointer; } button:hover { background: #edf1ff; } button:disabled { opacity: .5; cursor: default; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  input[type=search] { flex: 1; min-width: 100px; max-width: 340px; }
  .structure-count { margin-left: auto; color: #65748d; white-space: nowrap; }
  .inspection-toggle { background: transparent; border-color: transparent; } .inspection-toggle[aria-expanded=true] { color: #405abd; background: #edf1ff; }
  .scope-label{font-size:11px;color:var(--vict-color-textMuted);white-space:nowrap}.connection-empty{position:absolute;bottom:8px;left:52px;right:10px;margin:0;font-size:11px;color:var(--vict-color-textMuted);pointer-events:none}
  .structure-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
  .structure-canvas { position: relative; flex: 1; min-width: 0; min-height: 0; }
  .structure-scale-hint{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:var(--vict-color-surface);padding:4px 8px;border:1px solid var(--vict-color-border);border-radius:5px;font:var(--studio-font-meta);white-space:nowrap;max-width:calc(100% - 110px)}.structure-scale-hint button{font:inherit;padding:2px 4px}
  .structure-canvas :global(.svelte-flow) { --xy-background-color: #f8fafc; --xy-minimap-background-color: #fff; --xy-controls-button-background-color: #fff; }
  .structure-canvas :global(.svelte-flow__minimap) { width: 110px; height: 72px; }
  .structure-canvas :global(.svelte-flow__edge.selected .svelte-flow__edge-path) { stroke-width: 2.5px; }
  .structure-empty { position: absolute; top: 35%; left: 10%; right: 10%; text-align: center; color: #64748b; }
  .structure-status { position: absolute; top: 8px; left: 10px; right: 10px; margin: 0; color: #65748d; pointer-events: none; font-size: 11px; }
  .structure-details { display: flex; flex-direction: column; width: min(320px, 44%); min-width: 240px; min-height: 0; flex-shrink: 0; border-left: 1px solid #e1e6ee; background: white; overflow: hidden; }
  .inspection-heading { display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; flex-shrink: 0; }
  .inspection-heading strong { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .inspection-heading button { border: 0; padding: 0; width: 28px; height: 28px; background: transparent; font-size: 20px; flex-shrink: 0; }
  .inspection-pages { display: flex; gap: 3px; padding: 0 10px 8px; border-bottom: 1px solid #e1e6ee; flex-shrink: 0; }
  .inspection-pages button { flex: 1; border: 0; padding: 5px 4px; color: #65748d; background: transparent; font-size: 11px; }
  .inspection-pages button[aria-pressed=true] { background: #edf1ff; color: #405abd; }
  .inspection-content, .structure-moves { padding: 12px; overflow: auto; min-height: 0; }
  .inspection-identity { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-bottom: 10px; color: #65748d; }
  .edit-handoff { margin-bottom: 12px; width: 100%; }
  code { font-size: 11px; overflow-wrap: anywhere; color: #65748d; }
  .structure-facts>div { display: grid; grid-template-columns: minmax(70px, 1fr) 1fr; gap: 10px; padding: 7px 0; border-top: 1px solid #eef1f6; overflow-wrap: anywhere; }
  .structure-relations { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .structure-relations button { display: flex; flex-direction: column; align-items: start; gap: 3px; text-align: left; overflow-wrap: anywhere; }
  .structure-relations span, .inspection-hint { color: #65748d; font-size: 11px; }
  .source-finder, .structure-moves label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  select { width: 100%; min-width: 0; }
  .structure-moves h3 { font-size: 13px; margin: 0 0 14px; }
  .move-actions { display: flex; gap: 6px; } .move-actions button { flex: 1; }
  @media (max-width: 640px) {
    .structure-tools { flex-wrap: wrap; padding: 6px 8px; gap: 4px; }
    .structure-tools input { max-width: none; }
    .structure-count { font-size: 11px; }
    .structure-body { flex-direction: column; }
    .structure-canvas { min-height: 0; }
    .structure-details { width: 100%; min-width: 0; flex-basis: 44%; max-height: 50%; border-left: 0; border-top: 1px solid #e1e6ee; }
  }
</style>
