import type {
  UiChartPoint,
  UiConversationMessage,
  UiDisplayField,
  UiListItem,
} from '@victframework/ui';

/** Convert application data to display-only values before crossing into UI. */
export function displayRows(
  rows: readonly Record<string, unknown>[],
  fields: readonly string[],
): readonly (readonly string[])[] {
  return rows.map((row) => fields.map((field) => String(row[field] ?? '')));
}

export function listItems(
  rows: readonly Record<string, unknown>[],
  titleField: string,
  secondaryField?: string,
): readonly UiListItem[] {
  return rows.map((row) => ({
    title: String(row[titleField] ?? ''),
    ...(secondaryField === undefined ? {} : { secondary: String(row[secondaryField] ?? '') }),
  }));
}

export function detailFields(
  record: Record<string, unknown> | null,
  fields: readonly string[],
): readonly UiDisplayField[] | null {
  return record === null
    ? null
    : fields.map((field) => ({ label: field, value: String(record[field] ?? '') }));
}

/** Aggregate the declared numeric field by the declared category in first-seen order. */
export function chartPoints(
  rows: readonly Record<string, unknown>[],
  xField: string,
  yField: string,
): readonly UiChartPoint[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[xField] ?? '');
    const raw = row[yField];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw ?? 0) || 0;
    buckets.set(label, (buckets.get(label) ?? 0) + value);
  }
  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

export function conversationMessages(
  rows: readonly Record<string, unknown>[],
  messageField: string,
  authorField: string,
  participantField: string,
): readonly UiConversationMessage[] {
  const str = (value: unknown): string => (typeof value === 'string' ? value : '');
  return rows.map((row) => ({
    author: str(row[authorField]),
    participant: str(row[participantField]) || 'user',
    text: str(row[messageField]),
  }));
}
