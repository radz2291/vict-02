import { rm } from 'node:fs/promises';

/**
 * Remove a disposable test directory, retrying briefly on Windows where
 * SQLite WAL sidecar file locks can linger after the last connection
 * closes. node:sqlite finalizes prepared statements lazily (GC), so the
 * retries force substantial allocation pressure to nudge a major GC that
 * runs the pending finalizers. Test-only cleanup helper.
 */
export async function retryRm(target: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rm(target, { recursive: true, force: true });
      return;
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? '';
      if (attempt >= 120 || !['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(code)) {
        throw new Error('Could not remove disposable test directory', { cause });
      }
      // Nudge finalizers: explicit GC (when available) or large allocations
      // encourage V8 to run a major GC so pending StatementSync finalizers
      // release the file locks.
      if (typeof (globalThis as { gc?: () => void }).gc === 'function') {
        (globalThis as { gc?: () => void }).gc?.();
        (globalThis as { gc?: () => void }).gc?.();
      }
      const junk: Buffer[] = [];
      for (let i = 0; i < 40; i++) {
        junk.push(Buffer.alloc(4 * 1024 * 1024, (i % 251) as number));
      }
      if (junk.length < 0) {
        await rm(target, { recursive: true, force: true });
      }
      // Growing backoff: Windows Defender/indexer scans of freshly closed
      // SQLite sidecars can hold brief locks well past 20 x 150 ms.
      await new Promise((resolve) => setTimeout(resolve, Math.min(150 * (attempt + 1), 1000)));
    }
  }
}
