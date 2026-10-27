/** Small implementation-linked metadata; discovery does not import Svelte glyph modules. */
export interface IconMetadata {
  readonly pack: string;
  readonly name: string;
  readonly revision: string;
  readonly label: string;
  readonly tags: readonly string[];
  readonly license: string;
  readonly provenance: string;
}
export const suppliedIconKeys = [
  'Menu',
  'X',
  'Search',
  'Send',
  'Plus',
  'Minus',
  'Check',
  'ChevronDown',
  'ChevronUp',
  'ChevronLeft',
  'ChevronRight',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'Settings',
  'User',
  'Users',
  'MessageCircle',
  'Mail',
  'Bell',
  'Heart',
  'Star',
  'Image',
  'Play',
  'Pause',
  'Volume2',
  'VolumeX',
  'Download',
  'Upload',
  'Copy',
  'Trash2',
  'Pencil',
  'Filter',
  'Calendar',
  'Clock',
  'Link',
  'ExternalLink',
  'Info',
  'CircleHelp',
  'CircleAlert',
  'LoaderCircle',
  'MoreHorizontal',
  'Eye',
  'EyeOff',
  'Lock',
  'Unlock',
  'File',
  'Folder',
  'SlidersHorizontal',
  'ZoomIn',
  'ZoomOut',
  'Maximize',
  'Save',
  'Undo',
  'Redo',
  'GripVertical',
  'Globe',
] as const;
const aliases: Record<string, string[]> = {
  Menu: ['hamburger', 'navigation', 'drawer'],
  X: ['close', 'dismiss'],
  Search: ['find', 'magnify'],
  Send: ['chat', 'compose', 'submit'],
  Plus: ['add', 'create'],
  Pencil: ['edit'],
  Trash2: ['delete', 'remove'],
  Image: ['picture', 'photo', 'media'],
  MessageCircle: ['chat', 'conversation'],
  SlidersHorizontal: ['adjust', 'properties'],
  GripVertical: ['drag', 'move'],
  CircleHelp: ['help', 'question'],
  CircleAlert: ['warning', 'error'],
};
export const suppliedIconManifest: readonly IconMetadata[] = suppliedIconKeys.map((key) => ({
  pack: 'lucide',
  name: key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
  revision: '1.27.0',
  label: key.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
  tags: aliases[key] ?? [],
  license: 'ISC',
  provenance: '@lucide/svelte@1.27.0',
}));
export function searchIconManifest(
  query = '',
  offset = 0,
  limit = 20,
  manifest: readonly IconMetadata[] = suppliedIconManifest,
) {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 40 ||
    query.length > 100
  )
    throw Error('Icon search requires offset >=0, limit 1-40 and query <=100 characters.');
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean),
    filtered = manifest.filter((e) =>
      terms.every((term) =>
        `${e.pack} ${e.name} ${e.label} ${e.tags.join(' ')}`.toLowerCase().includes(term),
      ),
    );
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    nextOffset: offset + limit < filtered.length ? offset + limit : null,
  };
}
