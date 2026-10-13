import { createLocalStorageDocumentStore } from '@victframework/ui';
import { screenIssues, screenName } from './application.js';
export const SCREEN_PREFIX = 'vict.studio.screen.';
export function screenStore(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string) {
  return createLocalStorageDocumentStore(storage, {
    key: SCREEN_PREFIX + id,
    format: 'vict.studio-screen@1',
    seedStoredRevision: 'r1',
    validateDocument: screenIssues,
  });
}
export function savedScreens(storage: Storage): { id: string; name: string }[] {
  const screens: { id: string; name: string }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(SCREEN_PREFIX)) continue;
    const id = key.slice(SCREEN_PREFIX.length);
    const loaded = screenStore(storage, id).rawLoad();
    screens.push({
      id,
      name: loaded.status === 'loaded' ? screenName(loaded.document) : `${id} · unavailable`,
    });
  }
  return screens.sort((a, b) => a.name.localeCompare(b.name));
}
