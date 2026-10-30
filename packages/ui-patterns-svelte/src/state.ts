/** Pure pattern behavior. App actions and navigation remain declared output bindings. */
export function stringItems(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 1000)
    : [];
}
export function filterItems(items: readonly string[], query: string): string[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => words.every((word) => item.toLocaleLowerCase().includes(word)));
}
export function slideIndex(index: number, count: number, loop: boolean): number {
  if (!Number.isFinite(index) || count <= 0) return 0;
  const integral = Math.trunc(index);
  return loop ? ((integral % count) + count) % count : Math.max(0, Math.min(count - 1, integral));
}
export type VisitScope = 'session' | 'browser';
export interface VisitStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function campaignKey(applicationId: string, campaignId: string, resetKey: string): string {
  if (!applicationId.trim() || !campaignId.trim())
    throw new Error('Application and campaign identities are required.');
  if ([applicationId, campaignId, resetKey].some((value) => value.length > 160))
    throw new Error('Visitor-memory identity exceeds 160 characters.');
  return `vict.visit@1:${JSON.stringify([applicationId, campaignId, resetKey])}`;
}
export function campaignSeen(store: VisitStore, key: string): boolean {
  return store.getItem(key) === 'dismissed';
}
export function dismissCampaign(store: VisitStore, key: string): void {
  store.setItem(key, 'dismissed');
}
export function resetCampaign(store: VisitStore, key: string): void {
  store.removeItem(key);
}
