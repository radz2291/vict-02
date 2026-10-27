import type { UiAuthoringFragment, UiAuthoringPackage } from '@victframework/ui';
import {
  flowCanvasDescriptor,
  flowNodeDescriptor,
  flowEdgeDescriptor,
  flowEditorDescriptor,
} from './descriptors.js';
import { specialistPublicExports } from './public-exports.js';
import compatibility from './compatibility.json' with { type: 'json' };

const richEditor: UiAuthoringFragment = {
  root: 'editor',
  localState: {
    graph: {
      key: 'graph',
      type: 'string',
      initial: JSON.stringify({
        schema: 'vict.flow-graph@1',
        revision: 0,
        nodeTypes: [
          {
            id: 'text-step',
            label: 'Text step',
            fields: [
              { id: 'prompt', label: 'Prompt', kind: 'textarea', default: '' },
              { id: 'notes', label: 'Notes', kind: 'list', default: [] },
              { id: 'weight', label: 'Weight', kind: 'slider', default: 1, min: 0, max: 10 },
            ],
            ports: [
              {
                id: 'text-in',
                label: 'Text input',
                direction: 'input',
                type: 'text',
                maxConnections: 1,
              },
              { id: 'text-out', label: 'Text output', direction: 'output', type: 'text' },
            ],
          },
        ],
        nodes: [
          {
            id: 'first',
            type: 'text-step',
            label: 'First step',
            position: { x: 0, y: 0 },
            values: {
              prompt: 'Edit a real node parameter',
              notes: ['Independent movement', 'Typed ports'],
            },
          },
          {
            id: 'second',
            type: 'text-step',
            label: 'Second step',
            position: { x: 380, y: 0 },
            values: {},
          },
        ],
        edges: [
          {
            id: 'first-second',
            source: 'first',
            sourcePort: 'text-out',
            target: 'second',
            targetPort: 'text-in',
          },
        ],
      }),
    },
  },
  nodes: [
    {
      kind: 'component',
      id: 'editor',
      definitionId: 'vict.flow.editor',
      revision: '1',
      props: { graph: { type: 'ref', path: 'state.graph' } },
      outputs: { graphChange: { setState: { key: 'graph' } } },
    },
  ],
};

const canvas: UiAuthoringFragment = {
  root: 'canvas',
  nodes: [
    {
      kind: 'component',
      id: 'canvas',
      definitionId: 'vict.flow.canvas',
      revision: '1',
      slots: {
        nodes: { name: 'nodes', children: ['start', 'finish'] },
        edges: { name: 'edges', children: ['connection'] },
      },
    },
    {
      kind: 'component',
      id: 'start',
      definitionId: 'vict.flow.node',
      revision: '1',
      props: {
        id: { type: 'literal', value: 'start' },
        label: { type: 'literal', value: 'Start' },
        x: { type: 'literal', value: 20 },
        y: { type: 'literal', value: 40 },
      },
    },
    {
      kind: 'component',
      id: 'finish',
      definitionId: 'vict.flow.node',
      revision: '1',
      props: {
        id: { type: 'literal', value: 'finish' },
        label: { type: 'literal', value: 'Finish' },
        x: { type: 'literal', value: 280 },
        y: { type: 'literal', value: 40 },
      },
    },
    {
      kind: 'component',
      id: 'connection',
      definitionId: 'vict.flow.edge',
      revision: '1',
      props: {
        id: { type: 'literal', value: 'start-finish' },
        source: { type: 'literal', value: 'start' },
        target: { type: 'literal', value: 'finish' },
        label: { type: 'literal', value: 'Next' },
      },
    },
  ],
};
export const flowAuthoringPackage: UiAuthoringPackage = {
  compatibility,
  schema: 'vict.ui-authoring@1',
  packageName: '@victframework/ui-flow-svelte',
  packageVersion: '0.4.0-rc.1',
  registrations: [
    {
      descriptor: flowEditorDescriptor,
      label: 'Rich node editor',
      family: 'flow',
      category: 'graph-editor',
      purpose:
        'Editable application graph with rich fields, named typed ports, independent movement, selection, inspection and transactional undo/redo.',
      eligibility: { kind: 'standalone' },
      seed: richEditor,
      examples: [richEditor],
      guidance: [
        'graph is a string containing vict.flow-graph@1 JSON: revision:number; nodeTypes:[{id,label,fields:[{id,label,kind,default?,min?,max?,step?,options?,advanced?,disabled?}],ports:[{id,label,direction:input|output,type,maxConnections?}]}]; nodes:[{id,type,label,position:{x,y},values:{fieldId:value},ports?,collapsed?}]; edges:[{id,source,sourcePort,target,targetPort}]; allowCycles?:boolean (default false).',
        'Fields: text, textarea, list (string array), number, slider, select (options), toggle, button (local activation count), preview, image, video, icon, vector. Field values must match kinds, bounds and options. Slider/toggle/select/button reuse registered VICT catalog controls. Button count is a local UI intent; no application effect is executed.',
        'Media fields reuse the registered ui-media-svelte components and nearest MEDIA_HOST; values are stable managed asset references or supported supplied sources. Optional media:{alt,poster,captions,language,pack,revision,decorative} supplies accessibility/playback/icon metadata. Icon values are exact registry names (default pack lucide, revision 1.27.0), managed custom SVG references or inert vict.vector@1 JSON. Vector values are inert JSON or managed SVG references. Unknown/missing resources retain visible errors; source does not prove loading/playback.',
        'Node families and individual nodes may declare icon:{pack,name,revision,source?,data?}. Node icon overrides family icon; default is supplied lucide/sliders-horizontal@1.27.0. Custom managed/inert vector icons preserve brand colours through the shared media renderer. setIcon operation accepts an exact identity or null to restore family inheritance.',
        'Bind graph to declared string local state and graphChange to that same key. Initial state contains complete valid graph JSON. The host must explicitly persist graphChange into its canonical edit/history/save bridge before claiming saved graph edits. A static graph literal receives local editing only.',
        'Dragging the node header moves only that node; fields have nodrag/nopan/nowheel isolation. Background drag pans; Shift/Ctrl/Meta selection, fit/focus/search/arrange, collapse, add/delete/duplicate and copy/paste buffer are supported. Inspector has a keyboard-accessible connect/reconnect alternative.',
        'Named typed output/input ports validate direction, compatible type, multiplicity, endpoints, duplicate edges and cycle policy. Dynamic node ports are explicit model overrides; remove incompatible edges explicitly in one valid transaction. No runtime effects or processing engine follow from a visual connection.',
        'Application graph IDs belong to this editor occurrence. Keep them separate from UI source/occurrence IDs. graphChange emits a full validated snapshot with monotonically advanced revision; selectionChange emits transient JSON node/edge IDs. Invalid external graph input displays an error and retains the previous valid graph.',
        'Hosts may provide GRAPH_EDITOR_HOST (vict.flow.editor-host@1) with historyFor({nodeId,occurrenceKey}) returning canUndo/canRedo/undo/redo. With that context the authored toolbar and keyboard use the same host canonical history as agent edits; without it local GraphSession history is a standalone fallback.',
        'The same host may provide presentationFor({nodeId,occurrenceKey}) with get/set of {viewport:{x,y,zoom},selection:{nodes,edges}}. Store it by screen/document and occurrence outside canonical-plan remounts. This retains camera and valid selection through manual/agent source commits without persisting hover/camera into canonical source; removed graph IDs are dropped.',
        'Import @victframework/ui-flow-svelte/styles.css and the installed VICT catalog CSS. Test rich controls, real bindings, manual/agent coexistence, history and save/reopen/Run. Existing vict.flow.canvas@1 remains a read-only diagram.',
      ],
    },
    {
      descriptor: flowCanvasDescriptor,
      label: 'Flow canvas',
      family: 'flow',
      category: 'diagram',
      purpose: 'Read-only authored topology and positions with ephemeral pan, zoom and selection.',
      eligibility: { kind: 'standalone' },
      dependencies: [
        { id: flowNodeDescriptor.id, revision: '1' },
        { id: flowEdgeDescriptor.id, revision: '1' },
      ],
      guidance: [
        'Import @victframework/ui-flow-svelte/styles.css. Nodes and edges are canonical declaration children in explicit slots.',
        'Graph ids are local to this canvas occurrence and distinct from canonical source ids. Duplicate evaluated ids or unavailable endpoints refuse presentation.',
        'No dragging, connecting, deletion, executable node types or workflow execution is enabled. Change positions and topology through normal authored props and history.',
      ],
      seed: canvas,
      examples: [canvas],
    },
    {
      descriptor: flowNodeDescriptor,
      label: 'Flow node declaration',
      family: 'flow',
      category: 'diagram-part',
      purpose: 'Declare one visible card at scalar x/y in the owning canvas.',
      eligibility: { kind: 'part' },
      rules: [
        {
          kind: 'ancestorSlot',
          placements: [{ definitionId: 'vict.flow.canvas', revision: '1', slotName: 'nodes' }],
        },
        {
          kind: 'uniqueValue',
          property: 'id',
          providerIds: ['vict.flow.canvas'],
          slots: ['nodes'],
          namespace: 'flow-node',
          nonempty: true,
        },
        {
          kind: 'hostRequirement',
          capability: 'vict.flow.canvas-context@1',
          reason:
            'The nearest canvas owns this declaration and forwards the exact child presentation target onto its visible card.',
        },
      ],
      guidance: [
        'Not a standalone preview. Insert under canvas.nodes; wrappers, repeats and local definitions must preserve the provider slot.',
        'Evaluated ids must be unique in this canvas, and x/y must be finite numbers. Dynamic or repeated values are checked by the canvas at render time.',
      ],
      examples: [canvas],
    },
    {
      descriptor: flowEdgeDescriptor,
      label: 'Flow edge declaration',
      family: 'flow',
      category: 'diagram-part',
      purpose: 'Declare an edge between two unambiguous node ids in the owning canvas.',
      eligibility: { kind: 'part' },
      rules: [
        {
          kind: 'ancestorSlot',
          placements: [{ definitionId: 'vict.flow.canvas', revision: '1', slotName: 'edges' }],
        },
        {
          kind: 'uniqueValue',
          property: 'id',
          providerIds: ['vict.flow.canvas'],
          slots: ['edges'],
          namespace: 'flow-edge',
          nonempty: true,
        },
        {
          kind: 'hostRequirement',
          capability: 'vict.flow.canvas-context@1',
          reason:
            'The canvas validates evaluated endpoints and forwards the exact child target onto the visible SVG edge.',
        },
      ],
      guidance: [
        'Not a standalone preview. Insert under canvas.edges. source and target must each resolve to exactly one evaluated node id in the same canvas.',
        'Node and edge id namespaces are separate. No implicit workflow or connection mutation.',
      ],
      examples: [canvas],
    },
  ],
  exportDispositions: [
    {
      name: './authoring',
      disposition: 'registered',
      reason:
        'Exact scalar ABI diagram declarations and the versioned JSON application-graph editor are authored here.',
    },
    ...specialistPublicExports.map((name) => ({
      name,
      disposition: name.startsWith('./authoring:') ? 'registration-api' : 'host-only',
      reason: name.startsWith('./authoring:')
        ? 'Descriptor, implementation or knowledge install data. Only exact registered descriptor identities are authored.'
        : 'Public code composition/type/helper API; graph arrays, callbacks and Studio structure adapters are not automatically authorable.',
    })),
  ],
};
