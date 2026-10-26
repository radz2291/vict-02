/** Additive, host-controlled presentation selection. Never an edit transaction. */
export type SelectionOperation = 'replace' | 'toggle' | 'add';
export type OccurrenceSelectionIntent = {
  occurrences: readonly string[];
  operation: SelectionOperation;
  primary: string;
};
export function selectionOperation(event: {ctrlKey?:boolean;metaKey?:boolean}): SelectionOperation {
  return event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
}
/** Range selection uses only the currently visible, selectable order. */
export function occurrenceRange(order: readonly string[], anchor: string | undefined, target: string): string[] {
  const end=order.indexOf(target),start=anchor===undefined?-1:order.indexOf(anchor);
  if(end<0)return [];
  return start<0?[target]:order.slice(Math.min(start,end),Math.max(start,end)+1);
}
