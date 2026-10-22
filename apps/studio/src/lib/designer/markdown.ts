import { fromMarkdown } from 'mdast-util-from-markdown';
/** Render a conservative AST through Svelte escaping; never inject provider HTML. */
export interface MessageNode {
  type: string;
  value?: string;
  children?: MessageNode[];
  depth?: number;
  url?: string;
  ordered?: boolean | null;
  start?: number | null;
  alt?: string | null;
}
export function messageTree(text: string): MessageNode {
  return fromMarkdown(text);
}
export function messageHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
