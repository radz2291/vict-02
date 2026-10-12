<script lang="ts">
  /** Round-4 host-isolation fixture: date-field + checkbox + controlled
   * tooltip driven by externally supplied state, for mounting TWO hosts
   * simultaneously with identical document ids and node ids. */
  import type { UiDocument, UiValue } from '@victframework/ui';
  import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';
  import type { UiSvelteComponentImplementation } from '../src/document/extensions.js';

  let supplied = $state<Record<string, UiValue>>({
    visitDate: '2026-01-05',
    flag: false,
    tipOpen: false,
  });

  export function setValue(next: Record<string, unknown>): void {
    supplied = next as Record<string, UiValue>;
  }

  const doc = {
    schema: 'vict.ui-document@1',
    id: 'probe.host.iso',
    revision: '1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'div', children: ['df', 'cb', 'tip'] },
      df: {
        kind: 'component',
        id: 'df',
        definitionId: 'vict.catalog.date-field',
        props: {
          label: { type: 'literal', value: 'Visit date' },
          locale: { type: 'literal', value: 'en-GB' },
          value: { type: 'ref', path: 'state.visitDate' },
        },
        outputs: {
          valueChange: { setState: { key: 'visitDate', value: { type: 'ref', path: '$output' } } },
        },
      },
      cb: {
        kind: 'component',
        id: 'cb',
        definitionId: 'vict.catalog.checkbox',
        props: {
          label: { type: 'literal', value: 'Notify crew' },
          checked: { type: 'ref', path: 'state.flag' },
        },
        outputs: {
          checkedChange: { setState: { key: 'flag', value: { type: 'ref', path: '$output' } } },
        },
      },
      tip: {
        kind: 'component',
        id: 'tip',
        definitionId: 'vict.catalog.tooltip',
        props: {
          label: { type: 'literal', value: 'Host tip' },
          open: { type: 'ref', path: 'state.tipOpen' },
          description: { type: 'literal', value: 'Owned portal content' },
        },
        outputs: {
          openChange: { setState: { key: 'tipOpen', value: { type: 'ref', path: '$output' } } },
        },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {
      visitDate: { key: 'visitDate', type: 'isoDate', initial: '2026-01-05' },
      flag: { key: 'flag', type: 'boolean', initial: false },
      tipOpen: { key: 'tipOpen', type: 'boolean', initial: false },
    },
  } as unknown as UiDocument;

  const compiled = compileUiDocument(doc, defaultSemanticElementCatalog(), catalogDescriptors, { actionIds: [] });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
</script>

<DocumentHost
  plan={compiled.plan}
  extensionDescriptors={catalogDescriptors}
  extensionImplementations={catalogImplementations as readonly UiSvelteComponentImplementation[]}
  localState={doc.localState}
  stateValues={supplied}
  view={{}}
  dispatch={async () => ({ ok: true })}
  navigate={() => {}}
/>
