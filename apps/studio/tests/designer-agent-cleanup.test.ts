import { afterEach, expect, it, vi } from 'vitest';
import { resolve, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
const cleanup = vi.hoisted(() => ({ directory: undefined as string | undefined }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rm: (directory: Parameters<typeof actual.rm>[0]) => {
      cleanup.directory = String(directory);
      return new Promise<void>(() => {});
    },
  };
});
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { newScreen } from '../src/lib/designer/application.js';
import { agentContext, documentCursor } from '../src/lib/designer/agent-edits.js';
import { openAgentRun, validateAgentStart } from '../src/lib/server/designer-agent.js';
afterEach(async () => {
  const directory = cleanup.directory;
  cleanup.directory = undefined;
  if (!directory) return;
  const target = resolve(directory);
  if (
    !target.startsWith(resolve(tmpdir()) + sep) ||
    !basename(target).startsWith('vict-studio-agent-')
  )
    throw new Error('Refusing cleanup outside the host-created test directory');
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      actual.rm(target, { recursive: true, force: true }).catch(() => {}),
      new Promise<void>((done) => {
        timer = setTimeout(done, 1000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
});
it('releases a completed host turn when filesystem removal never settles', async () => {
  const document = newScreen('Cleanup fixture', 'cleanup-fixture');
  const cursor = documentCursor(document, 'r1#0', crypto.randomUUID());
  const parsed = validateAgentStart({
    document,
    cursor,
    prompt: 'Reply without editing',
    history: [],
  });
  if (!parsed.ok) throw new Error(parsed.message);
  const input = JSON.stringify({
    request: parsed.value.prompt,
    untrusted_history: [],
    untrusted_screen: agentContext(document, cursor),
  });
  let completed!: () => void;
  const terminal = new Promise<void>((done) => {
    completed = done;
  });
  const opened = openAgentRun(
    'cleanup-owner',
    parsed.value,
    (event) => {
      if (event.type === 'done') {
        expect(event.status).toBe('completed');
        completed();
      }
    },
    {
      model: OFFLINE_MODEL_IDENTITY,
      modelFactory: () =>
        createDeterministicOfflineModel({ script: { [input]: { kind: 'text', text: 'Ready.' } } }),
    },
  );
  if (!opened.ok) throw new Error(opened.code);
  await terminal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      opened.finished,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Filesystem cleanup held the completed turn')),
          12000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  expect(cleanup.directory).toBeDefined();
}, 120_000);
