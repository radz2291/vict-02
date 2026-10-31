import { expect, it } from 'vitest';
import { bindingFixture } from './fixtures/structure-semantics.js';
import { documentCursor } from '../src/lib/designer/agent-edits.js';
import { validateAgentStart } from '../src/lib/server/designer-agent.js';

it('accepts complete passive workspace descriptions without duplicating capture geometry quotas', () => {
  const document = bindingFixture();
  const cursor = documentCursor(document, 'r1', crypto.randomUUID());
  const workspace = {
    workspaceView: 'design', mode: 'design', observable: true,
    viewport: { model: 'isolated-viewport', width: 100001, height: 120001, devicePixelRatio: 17, scrollLeft: 0, scrollTop: 0 },
    composition: 'A'.repeat(501),
  };
  const request = { document, cursor, prompt: 'Inspect current workspace', workspace };
  expect(validateAgentStart(request)).toMatchObject({ ok: true });
  for (const viewport of [
    { ...workspace.viewport, width: -1 },
    { ...workspace.viewport, height: Infinity },
    { ...workspace.viewport, devicePixelRatio: 0 },
  ]) expect(validateAgentStart({ ...request, workspace: { ...workspace, viewport } }).ok).toBe(false);
  expect(validateAgentStart({ ...request, workspace: { ...workspace, authority: 'edit' } }).ok).toBe(false);
  expect(validateAgentStart({ ...request, cursor: { ...cursor, documentId: 'foreign' } }).ok).toBe(false);
});
