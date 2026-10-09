<script lang="ts">
  /** Round-3 probe fixture: DocumentHost with externally-supplied state values
   * that the test flips reactively (the preview-state panel path). */
  import type { UiDocument, UiValue } from '@victframework/ui';
  import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';
  import type { UiSvelteComponentImplementation } from '../src/document/extensions.js';

  let { documentId = 'probe.range' }: { documentId?: string } = $props();

  let supplied = $state<Record<string, UiValue>>({
    windowStart: '2026-10-12',
    windowEnd: '2026-10-16',
  });

  export function setSupplied(next: Record<string, UiValue>): void {
    supplied = { ...next };
  }

  const doc = {
    schema: 'vict.ui-document@1',
    id: documentId,
    revision: '1',
    root: 'root',
    nodes: {
      root: { kind: 'element', id: 'root', tag: 'div', children: ['rf'] },
      rf: {
        kind: 'component',
        id: 'rf',
        definitionId: 'vict.catalog.date-range-field',
        props: {
          label: { type: 'literal', value: 'Correction window dates' },
          locale: { type: 'literal', value: 'en-GB' },
          start: { type: 'ref', path: 'state.windowStart' },
          end: { type: 'ref', path: 'state.windowEnd' },
        },
        outputs: {
          startChange: { setState: { key: 'windowStart', value: { type: 'ref', path: '$output' } } },
          endChange: { setState: { key: 'windowEnd', value: { type: 'ref', path: '$output' } } },
        },
      },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {
      windowStart: { key: 'windowStart', type: 'isoDate', initial: '2026-10-12' },
      windowEnd: { key: 'windowEnd', type: 'isoDate', initial: '2026-10-16' },
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

<output data-testid="supplied-dump">{JSON.stringify(supplied)}</output>
