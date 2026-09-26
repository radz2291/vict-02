// DOM-level verification for the coding-agent workspace: the real
// renderer mounts the product definition, the registered islands load
// through the trusted registry, and the console's deterministic state
// machine is operable IN THE DOM (approval, advance, retry) with the
// shared ActionFeedback behaviour.
import { flushSync, tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import { compileAgentPlan } from '../src/lib/application/agent.js';
import { createAgentServer } from '../src/lib/server/agent-server.js';
import { createShowcaseRegistry } from '../src/lib/components/registry.js';
import { eagerAgentComponents } from '../src/lib/components/agent/eager.js';

const PLAN = compileAgentPlan();

function mountSession(path: string): void {
  document.body.replaceChildren();
  const server = createAgentServer();
  const registry = createShowcaseRegistry(false, true, eagerAgentComponents);
  window.history.replaceState({}, '', path);
  renderVictApplication({
    plan: PLAN,
    registry,
    dispatch: async (actionId: string, input?: unknown) =>
      server.dispatch(actionId, input, window.location.pathname),
    path,
    viewData: {},
    record: null,
    target: document.body,
  });
}

async function waitFor(selector: string, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (document.querySelector(selector) !== null) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    flushSync();
  }
  throw new Error(`waitFor timed out: ${selector}`);
}

async function text(selector: string): Promise<string | undefined> {
  await tick;
  return document.querySelector(selector)?.textContent?.trim();
}

describe('agent workspace DOM (product islands through the real renderer)', () => {
  it('mounts the session workspace with console, conversation and inspector tabs', async () => {
    mountSession('/agent/sessions/AGW-101');
    await waitFor('[data-testid="session-console"]');
    expect(document.querySelector('[data-testid="session-console"]')).not.toBeNull();
    expect(await text('[data-testid="session-status"]')).toBe('Waiting for approval');
    expect(document.querySelector('[data-testid="approval-panel"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="approve-btn"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="conversation-input"]')).not.toBeNull();
    expect(
      Array.from(document.querySelectorAll('.vict-tablist [role="tab"]')).map((tab) =>
        tab.textContent?.trim(),
      ),
    ).toEqual(['Changed files', 'Activity', 'Output log']);
  });

  it('approves a waiting session in the DOM: status flips, feedback appears, controls swap', async () => {
    mountSession('/agent/sessions/AGW-101');
    await waitFor('[data-testid="approve-btn"]');
    const approve = document.querySelector<HTMLButtonElement>('[data-testid="approve-btn"]');
    expect(approve).not.toBeNull();
    approve!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    flushSync();
    expect(await text('[data-testid="session-status"]')).toBe('Running');
    expect(
      document.querySelector('[data-testid="session-progress"]')?.getAttribute('aria-valuenow'),
    ).toBe('45');
    expect(document.querySelector('[data-testid="advance-btn"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Approved — Victor resumed the session.');
    expect(document.querySelector('[data-testid="action-success"]')?.textContent).toContain(
      'Approved',
    );
  });

  it('advances and fails a running session with visible feedback each step', async () => {
    mountSession('/agent/sessions/AGW-102');
    await waitFor('[data-testid="advance-btn"]');
    expect(await text('[data-testid="session-status"]')).toBe('Running');
    const advance = document.querySelector<HTMLButtonElement>('[data-testid="advance-btn"]');
    advance!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    flushSync();
    expect(
      document.querySelector('[data-testid="session-progress"]')?.getAttribute('aria-valuenow'),
    ).toBe('80');
    expect(document.body.textContent).toContain('Step complete — progress updated.');
    document.querySelector<HTMLButtonElement>('[data-testid="fail-btn"]')!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    flushSync();
    expect(await text('[data-testid="session-status"]')).toBe('Failed');
    expect(document.querySelector('[data-testid="retry-btn"]')).not.toBeNull();
    expect(document.body.textContent).toContain(
      'Failure simulated — Victor stopped at its last checkpoint.',
    );
  });
});
