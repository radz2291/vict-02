import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';

/**
 * Remove a disposable test directory.
 *
 * Windows-only hazard: node:sqlite finalizes prepared statements lazily
 * (GC), so a freshly closed database's sidecar files can remain briefly
 * locked by the worker process. The helper retries briefly with finalizer
 * nudges; if the lock outlives the bounded window, the deletion is handed
 * to a DETACHED child process — once the test worker exits, its handles
 * die and the detached sweep reliably removes the directory. Test-only
 * cleanup helper: assertions never depend on this succeeding inline.
 */
export async function retryRm(target: string): Promise<void> {
  const maxInlineAttempts = 8;
  for (let attempt = 0; ; attempt++) {
    try {
      await rm(target, { recursive: true, force: true });
      return;
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? '';
      if (
        attempt >= maxInlineAttempts ||
        !['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(code)
      ) {
        // Last resort: detached sweep after this process's handles die.
        const child = spawn(
          process.execPath,
          [
            '-e',
            `require('node:fs').rmSync(${JSON.stringify(target)}, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 });`,
          ],
          { detached: true, stdio: 'ignore', shell: process.platform === 'win32' },
        );
        child.unref();
        return;
      }
      // Nudge finalizers: pending StatementSync finalizers release the
      // file locks once a major GC runs.
      if (typeof (globalThis as { gc?: () => void }).gc === 'function') {
        (globalThis as { gc?: () => void }).gc?.();
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
