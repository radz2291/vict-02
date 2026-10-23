import { describe, it, expect } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import { newScreen, designerCatalogs } from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';
import {
  applyAgentProposal,
  documentCursor,
  prepareAgentEdit,
  agentContext,
  type AgentEdit,
  type AgentProposal,
} from '../src/lib/designer/agent-edits.js';
import { agentJson } from '../src/lib/server/designer-agent-http.js';

function setup() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const document = newScreen('Registration', 'screen-test');
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    store: screenStore(storage, document.id),
    initial: { document, storedRevision: 'r1' },
  });
  return { bridge, storage };
}
const epoch = crypto.randomUUID();
function proposal(
  bridge: EditorBridge,
  operations: AgentEdit['operations'],
  reason = 'Agent change',
): AgentProposal {
  const cursor = documentCursor(bridge.document, bridge.getSnapshot().revision, epoch);
  const edit = { expectedRevision: cursor.revision, reason, operations };
  const proposalId = crypto.randomUUID();
  const prepared = prepareAgentEdit(bridge.document, cursor, edit, proposalId);
  expect(prepared).toMatchObject({ ok: true });
  if (!prepared.ok) throw new Error(prepared.message);
  return { proposalId, cursor, edit, resultDigest: prepared.digest };
}
describe('agent canonical editing boundary', () => {
  it('edits an existing saved screen using its working token, and explains a source-version mistake without claiming the canvas changed', () => {
    const { bridge } = setup();
    expect(
      applyAgentProposal(
        bridge,
        proposal(bridge, [
          {
            op: 'add',
            recipe: 'heading',
            nodeId: 'existing-title',
            parentId: 'screen',
            text: 'Existing content',
          },
        ]),
        epoch,
        false,
      ).ok,
    ).toBe(true);
    expect(bridge.save().ok).toBe(true);
    expect(bridge.save().ok).toBe(true);
    expect(bridge.reopen().ok).toBe(true);
    const before = bridge.getSnapshot();
    const source = bridge.document;
    const cursor = documentCursor(source, before.revision, epoch);
    const context = agentContext(source, cursor);
    expect(context.expectedRevision).toBe(before.revision);
    expect(context.expectedRevision).not.toBe(source.revision);
    const edit = {
      expectedRevision: source.revision,
      reason: 'Add a landing page section',
      operations: [{ op: 'add', recipe: 'section', nodeId: 'features', parentId: 'screen' }],
    };
    expect(prepareAgentEdit(source, cursor, edit, 'wrong-token')).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_REVISION_MISMATCH',
      message: expect.stringContaining(JSON.stringify(context.expectedRevision)),
    });
    expect(bridge.document).toBe(source);
    expect(bridge.getSnapshot()).toEqual(before);
    const corrected = proposal(bridge, [
      { op: 'add', recipe: 'section', nodeId: 'features', parentId: 'screen' },
    ]);
    expect(applyAgentProposal(bridge, corrected, epoch, false).ok).toBe(true);
    expect(bridge.document.nodes['existing-title']).toBeDefined();
    expect(bridge.document.nodes.features).toBeDefined();
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document).toEqual(source);
  });

  it('keeps a changed captured document stale even when the supplied revision is also wrong', () => {
    const { bridge } = setup();
    const original = bridge.document;
    const cursor = documentCursor(original, bridge.getSnapshot().revision, epoch);
    expect(
      applyAgentProposal(
        bridge,
        proposal(bridge, [{ op: 'add', recipe: 'heading', nodeId: 'manual', parentId: 'screen' }]),
        epoch,
        false,
      ).ok,
    ).toBe(true);
    const before = bridge.getSnapshot();
    expect(
      prepareAgentEdit(
        bridge.document,
        cursor,
        {
          expectedRevision: original.revision,
          reason: 'Wrong snapshot',
          operations: [{ op: 'remove', nodeId: 'manual' }],
        },
        'stale-source',
      ),
    ).toMatchObject({ ok: false, code: 'UI_DOC_STALE_REVISION' });
    expect(bridge.getSnapshot()).toEqual(before);
    expect(bridge.document.nodes.manual).toBeDefined();
  });
  it('builds a palette registration screen; modifies selection; moves/removes; undo/redo/save/reopen share history', () => {
    const { bridge, storage } = setup();
    const form = proposal(bridge, [
      {
        op: 'add',
        recipe: 'heading',
        nodeId: 'title',
        parentId: 'screen',
        text: 'Create your account',
      },
      { op: 'add', recipe: 'section', nodeId: 'form', parentId: 'screen' },
      {
        op: 'add',
        recipe: 'input',
        nodeId: 'name',
        parentId: 'form',
        attributes: { 'aria-label': 'Full name', placeholder: 'Your name' },
      },
      {
        op: 'add',
        recipe: 'input',
        nodeId: 'email',
        parentId: 'form',
        attributes: { type: 'email', 'aria-label': 'Email', placeholder: 'you@example.com' },
      },
      {
        op: 'add',
        recipe: 'input',
        nodeId: 'password',
        parentId: 'form',
        attributes: { type: 'password', 'aria-label': 'Password' },
      },
      {
        op: 'add',
        recipe: 'button',
        nodeId: 'submit',
        parentId: 'form',
        props: { label: 'Register' },
      },
    ]);
    expect(applyAgentProposal(bridge, form, epoch, false).ok).toBe(true);
    expect(bridge.getSnapshot().dirty).toBe(true);
    expect(bridge.getSnapshot().canUndo).toBe(true);
    const input = bridge.document.nodes.email;
    expect(input).toMatchObject({
      kind: 'element',
      attributes: { type: 'email', 'aria-label': 'Email' },
    });
    if (input?.kind === 'element') {
      expect(input.attributes?.value).toBeUndefined();
      expect(input.interactions).toEqual([]);
    }
    bridge.select('screen-test|email');
    expect(
      agentContext(
        bridge.document,
        documentCursor(bridge.document, bridge.getSnapshot().revision, epoch),
        'screen-test|email',
      ).selection?.nodeId,
    ).toBe('email');
    expect(
      applyAgentProposal(
        bridge,
        proposal(bridge, [
          { op: 'modify', nodeId: 'email', attributes: { placeholder: 'Work email' } },
        ]),
        epoch,
        false,
      ).ok,
    ).toBe(true);
    expect(
      applyAgentProposal(
        bridge,
        proposal(bridge, [{ op: 'move', nodeId: 'email', newParentId: 'form', index: 0 }]),
        epoch,
        false,
      ).ok,
    ).toBe(true);
    expect(bridge.document.nodes.form).toMatchObject({
      children: ['email', 'name', 'password', 'submit'],
    });
    expect(
      applyAgentProposal(
        bridge,
        proposal(bridge, [{ op: 'remove', nodeId: 'password' }]),
        epoch,
        false,
      ).ok,
    ).toBe(true);
    expect(bridge.document.nodes.password).toBeUndefined();
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document.nodes.password).toBeDefined();
    expect(bridge.redo().ok).toBe(true);
    expect(bridge.document.nodes.password).toBeUndefined();
    const saved = bridge.save();
    expect(saved.ok).toBe(true);
    const source = JSON.stringify(bridge.document);
    expect(bridge.reopen().ok).toBe(true);
    expect(JSON.stringify(bridge.document)).toBe(source);
    expect(bridge.getSnapshot().canUndo).toBe(false);
    expect(screenStore(storage, 'screen-test').rawLoad().status).toBe('loaded');
  });
  it('rejects a whole invalid batch without history, save or partial document effects', () => {
    const { bridge } = setup();
    const before = bridge.getSnapshot();
    const cursor = documentCursor(bridge.document, before.revision, epoch);
    for (const operations of [
      [
        { op: 'add', recipe: 'heading', nodeId: 'title', parentId: 'screen' },
        { op: 'move', nodeId: 'screen', newParentId: 'title' },
      ],
      // Cycle 1.3 seeds the required body. Explicitly remove it to retain
      // the original empty-required-slot refusal oracle.
      [
        { op: 'add', recipe: 'dialog', nodeId: 'dialog', parentId: 'screen' },
        { op: 'remove', nodeId: 'dialog-body-1' },
      ],
      [
        {
          op: 'add',
          recipe: 'input',
          nodeId: 'field',
          parentId: 'screen',
          attributes: { onclick: 'alert(1)' },
        },
      ],
      [{ op: 'add', recipe: 'unknown', nodeId: 'node', parentId: 'screen' }],
    ])
      expect(
        prepareAgentEdit(
          bridge.document,
          cursor,
          { expectedRevision: cursor.revision, reason: 'Invalid', operations },
          crypto.randomUUID(),
        ).ok,
      ).toBe(false);
    expect(bridge.getSnapshot()).toEqual(before);
  });
  it('rejects stale and replayed proposals, pending drafts and reopen ABA without effects', () => {
    const { bridge } = setup();
    const pending = proposal(bridge, [
      { op: 'add', recipe: 'heading', nodeId: 'title', parentId: 'screen' },
    ]);
    expect(applyAgentProposal(bridge, pending, epoch, true)).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_DRAFT',
    });
    expect(applyAgentProposal(bridge, pending, crypto.randomUUID(), false)).toMatchObject({
      ok: false,
      code: 'UI_DOC_STALE_REVISION',
    });
    expect(applyAgentProposal(bridge, pending, epoch, false).ok).toBe(true);
    const digest = bridge.getSnapshot().contentDigest;
    expect(applyAgentProposal(bridge, pending, epoch, false)).toMatchObject({
      ok: false,
      code: 'UI_DOC_STALE_REVISION',
    });
    expect(bridge.getSnapshot().contentDigest).toBe(digest);
    expect(bridge.undo().ok).toBe(true);
    expect(applyAgentProposal(bridge, pending, epoch, false).ok).toBe(false);
    bridge.redo();
    bridge.save();
    bridge.reopen();
    const afterReopen = proposal(bridge, [{ op: 'modify', nodeId: 'title', text: 'Changed' }]);
    bridge.reopen();
    expect(applyAgentProposal(bridge, afterReopen, crypto.randomUUID(), false).ok).toBe(false);
  });
});
describe('agent HTTP request guard', () => {
  const session = { sessionId: 'test', actorLabel: 'operator', csrfToken: 'csrf' };
  it('refuses unauthenticated, non-JSON, bad-CSRF, oversized and malformed requests', async () => {
    for (const [request, actor, status] of [
      [new Request('http://localhost', { method: 'POST', body: '{}' }), null, 401],
      [
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'text/plain', 'x-vict-csrf': 'csrf' },
          body: '{}',
        }),
        session,
        415,
      ],
      [
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
        session,
        403,
      ],
      [
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-vict-csrf': 'csrf' },
          body: 'x'.repeat(256001),
        }),
        session,
        413,
      ],
      [
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-vict-csrf': 'csrf' },
          body: 'bad-json',
        }),
        session,
        400,
      ],
    ] as const) {
      const result = await agentJson(request, actor);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(status);
    }
  });
});
