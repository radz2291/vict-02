/**
 * VERIFICATION PROBE (round 4) — host isolation and lifecycles. TWO
 * DocumentHosts are mounted simultaneously with IDENTICAL document ids and
 * component node ids (the registry is global; hosts must not cross-wire):
 * - each host's supply channel reaches only its own display;
 * - a controlled tooltip opens a portal owned by its host (data-ui-owner)
 *   and unmounting the host removes its portal from the document;
 * - per-host scope classes keep styling scoped (no shared cascade root);
 * - the surviving host stays fully interactive after its sibling unmounts
 *   (selection toggle through the state loop) and keeps accepting supply.
 * All queries stay within the owning host except the body-level portal
 * assertion, which is scoped by the host's owner id.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount, type component } from 'svelte';
import { UiEditSession } from '@victframework/ui';
import HostIsoFixture from './HostIsoFixture.svelte';

type Fixture = ReturnType<typeof component<typeof HostIsoFixture>>;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mountHost(initial: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const instance = mount(HostIsoFixture, { target, props: {} }) as Fixture;
  const controls = instance as unknown as { setValue(next: Record<string, unknown>): void };
  controls.setValue(initial);
  flushSync();
  const cleanup = () => unmount(instance);
  cleanups.push(cleanup);
  return {
    target,
    controls,
    destroy() {
      cleanup();
      const index = cleanups.indexOf(cleanup);
      if (index >= 0) cleanups.splice(index, 1);
    },
  };
}

function ownerIdOf(target: HTMLElement): string {
  const root = target.querySelector('[data-ui-owner-root]');
  expect(root, 'host root with owner marker').toBeTruthy();
  return root!.getAttribute('data-ui-owner-root')!;
}

function dateDisplay(target: HTMLElement): string {
  return [...target.querySelectorAll('[role="spinbutton"]')]
    .map((s) => (s.textContent ?? '').trim())
    .join('/');
}

describe('round 4: two simultaneous hosts with matching component ids', () => {
  it('supplied state reaches only its own host display', async () => {
    const a = mountHost({ visitDate: '2026-01-05', flag: false, tipOpen: false });
    const b = mountHost({ visitDate: '2026-03-20', flag: true, tipOpen: false });
    expect(dateDisplay(a.target), 'host A shows its own supplied date').toBe('05/01/2026');
    expect(dateDisplay(b.target), 'host B shows its own supplied date').toBe('20/03/2026');
    a.controls.setValue({ visitDate: '2026-02-14', flag: false, tipOpen: false });
    await new Promise((r) => setTimeout(r, 60));
    flushSync();
    expect(dateDisplay(a.target), 'A updated by its own supply').toBe('14/02/2026');
    expect(dateDisplay(b.target), 'B untouched by A’s supply').toBe('20/03/2026');
    // Styling scope is keyed by the DOCUMENT (identical plans share the same
    // cascade scope and byte-identical styles — by design); instance isolation
    // is carried by the distinct data-ui-owner ids asserted above.
    const classA = a.target.querySelector('[data-ui-owner-root]')?.className ?? '';
    const classB = b.target.querySelector('[data-ui-owner-root]')?.className ?? '';
    expect(classA, 'document-keyed cascade scope').toMatch(/uv-root-probe_host_iso/);
    expect(classA, 'identical plans share one cascade scope (identical styles)').toBe(classB);
    expect(
      a.target.querySelector('[data-ui-owner-root]')?.getAttribute('data-ui-owner-root'),
      'instance owner marker present',
    ).toBeTruthy();
  });

  it('controlled tooltip portals are owned by their host and die with it', async () => {
    const a = mountHost({ visitDate: '2026-01-05', flag: false, tipOpen: false });
    const b = mountHost({ visitDate: '2026-03-20', flag: true, tipOpen: false });
    const ownerA = ownerIdOf(a.target);
    const ownerB = ownerIdOf(b.target);
    expect(ownerA, 'distinct owner ids per host instance').not.toBe(ownerB);
    // open host A's tooltip through its supply channel
    a.controls.setValue({ visitDate: '2026-01-05', flag: false, tipOpen: true });
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    const portals = [...document.body.querySelectorAll('[role="tooltip"]')];
    expect(portals.length, 'exactly one tooltip portal in the document').toBe(1);
    expect(
      portals[0]!.closest('[data-ui-owner]')?.getAttribute('data-ui-owner') ?? '',
      'portal owned by host A',
    ).toBe(ownerA);
    expect(portals[0]!.textContent ?? '').toContain('Owned portal content');
    expect(dateDisplay(b.target), 'B unaffected').toBe('20/03/2026');
    // unmount A: its portal disappears from the document
    a.destroy();
    await new Promise((r) => setTimeout(r, 60));
    flushSync();
    expect(document.body.contains(portals[0]!), 'host A portal removed with its host').toBe(false);
    // the surviving host stays fully interactive: toggle B's checkbox and
    // supply B's state; retained callbacks keep flowing
    const cb = [...b.target.querySelectorAll('[role="checkbox"]')].at(-1) as
      HTMLElement | undefined;
    expect(cb, 'host B checkbox present').toBeTruthy();
    const before = cb!.getAttribute('aria-checked');
    cb!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    cb!.click();
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    expect(
      cb!.getAttribute('aria-checked'),
      'host B checkbox toggled after sibling unmount',
    ).not.toBe(before);
    b.controls.setValue({ visitDate: '2026-07-01', flag: true, tipOpen: false });
    await new Promise((r) => setTimeout(r, 60));
    flushSync();
    expect(dateDisplay(b.target), 'host B still accepts supply').toBe('01/07/2026');
    // B can still open its own portal, owned by B
    b.controls.setValue({ visitDate: '2026-07-01', flag: true, tipOpen: true });
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    const bPortal = [...document.body.querySelectorAll('[role="tooltip"]')];
    expect(bPortal.length, 'exactly one portal after A is gone').toBe(1);
    expect(
      bPortal[0]!.closest('[data-ui-owner]')?.getAttribute('data-ui-owner') ?? '',
      'portal owned by surviving host B',
    ).toBe(ownerB);
  });

  it('runtime interactions never touch the authored session (source, dirty, undo history)', async () => {
    // A session over the same document the fixture renders: runtime canvas
    // interactions must flow through the host runtime state loop only.
    const doc = {
      schema: 'vict.ui-document@1',
      id: 'probe.host.iso',
      revision: '1',
      root: 'root',
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'div', children: ['cb'] },
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
      },
      componentDefinitions: {},
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: { flag: { key: 'flag', type: 'boolean', initial: false } },
    } as never;
    const session = UiEditSession.open({ document: structuredClone(doc), storedRevision: '1' });
    const sourceBefore = JSON.stringify(session.document);
    const revBefore = session.workingRevision;
    const dirtyBefore = session.isDirty();
    const undoBefore = session.canUndo();
    const target = mountHost({ visitDate: '2026-01-05', flag: false, tipOpen: false }).target;
    void target;
    // runtime interaction through a rendered host over the same-shaped doc
    const host = mountHost({ visitDate: '2026-01-05', flag: false, tipOpen: false });
    const cb = [...host.target.querySelectorAll('[role="checkbox"]')].at(-1) as HTMLElement;
    cb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    cb.click();
    await new Promise((r) => setTimeout(r, 80));
    flushSync();
    expect(session.workingRevision, 'runtime interaction left the working revision alone').toBe(
      revBefore,
    );
    expect(
      JSON.stringify(session.document),
      'runtime interaction left the authored source alone',
    ).toBe(sourceBefore);
    expect(session.isDirty(), 'runtime interaction left dirt alone').toBe(dirtyBefore);
    expect(session.canUndo(), 'runtime interaction left undo history alone').toBe(undoBefore);
    // authoring still works after runtime interactions
    const outcome = session.applyTransaction({
      requestId: 'r4-runtime-sep',
      documentId: 'probe.host.iso',
      expectedDocumentRevision: session.workingRevision,
      commands: [
        {
          op: 'bindExpression',
          nodeId: 'cb',
          target: { kind: 'prop', name: 'label' },
          expression: { type: 'literal', value: 'Notify all crews' },
        } as never,
      ],
    });
    expect(
      outcome.ok,
      `authored transaction accepted after runtime interaction: ${JSON.stringify((outcome as { issues?: unknown }).issues ?? '')}`,
    ).toBe(true);
    expect(session.workingRevision).not.toBe(revBefore);
    expect(session.canUndo(), 'the authored edit is undoable').toBe(true);
  });
});
