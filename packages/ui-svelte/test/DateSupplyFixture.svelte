<script lang="ts">
  /** Round-3 control probe: single DateField with externally-supplied value.
   * Isolates the host supply channel from the range adapters. */
  import type { UiDocument, UiValue } from '@victframework/ui';
  import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';
  import type { UiSvelteComponentImplementation } from '../src/document/extensions.js';

  let supplied = $state<Record<string, UiValue>>({ visitDate: '2026-10-12' });

  export function setValue(next: unknown): void {
    supplied = { visitDate: next as UiValue };
  }

  const doc = {
    schema: 'vict.ui-document@1',
    id: 'probe.datefield.supply',
    revision: '1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'div', children: ['df'] },
      df: {
        kind: 'component',
        id: 'df',
        definitionId: 'vict.catalog.date-field',
        props: {
          label: { type: 'literal', value: 'Planned inspection date' },
          locale: { type: 'literal', value: 'en-GB' },
          value: { type: 'ref', path: 'state.visitDate' },
        },
        outputs: {
          valueChange: { setState: { key: 'visitDate', value: { type: 'ref', path: '$output' } } },
        },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {
      visitDate: { key: 'visitDate', type: 'isoDate', initial: '2026-10-12' },
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
