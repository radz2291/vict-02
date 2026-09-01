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
      if (attempt >= 20 || !['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(code)) {
        throw new Error('Could not remove disposable test directory', { cause });
      }
      // Nudge finalizers: large allocations encourage V8 to run a major
      // GC so pending StatementSync finalizers release the file locks.
      const junk: Buffer[] = [];
      for (let i = 0; i < 40; i++) {
        junk.push(Buffer.alloc(4 * 1024 * 1024, (i % 251) as number));
      }
      if (junk.length < 0) {
        await rm(target, { recursive: true, force: true });
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}
