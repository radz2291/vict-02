import { importSvg } from './vectors.js';
export const ASSET_SCHEMA = 'vict.media-asset@1' as const;
export const MAX_ASSET_BYTES = 64 * 1024 * 1024;
export interface MediaAsset {
  readonly schema: typeof ASSET_SCHEMA;
  readonly reference: string;
  readonly digest: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly createdAt: string;
  readonly provenance?: string;
  readonly bytes: Uint8Array;
}
export type MediaAssetMetadata = Omit<MediaAsset, 'bytes'>;
export interface MediaAssetStore {
  put(asset: MediaAsset): Promise<void>;
  get(reference: string): Promise<MediaAsset | undefined>;
  list(): Promise<readonly MediaAssetMetadata[]>;
  remove(reference: string): Promise<void>;
}
export const assetMetadata = ({ bytes: _bytes, ...metadata }: MediaAsset): MediaAssetMetadata =>
  metadata;
const mimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'text/vtt',
]);
function verifyMediaSignature(bytes: Uint8Array, mime: string): void {
  const text = new TextDecoder().decode(bytes.subarray(0, 64));
  const begins = (...expected: number[]) => expected.every((n, index) => bytes[index] === n);
  const valid =
    mime === 'image/svg+xml' ||
    (mime === 'image/png' && begins(137, 80, 78, 71, 13, 10, 26, 10)) ||
    (mime === 'image/jpeg' && begins(255, 216, 255)) ||
    (mime === 'image/gif' && /^GIF8[79]a/.test(text)) ||
    (mime === 'image/webp' && text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') ||
    (mime === 'image/avif' && text.slice(4, 8) === 'ftyp' && /avif|avis/.test(text.slice(8, 40))) ||
    (mime === 'video/mp4' && text.slice(4, 8) === 'ftyp') ||
    (mime === 'video/webm' && begins(26, 69, 223, 163)) ||
    (mime === 'video/ogg' && text.startsWith('OggS')) ||
    (mime === 'text/vtt' && /^\uFEFF?WEBVTT(?:[ \t\r\n]|$)/.test(text));
  if (!valid) throw Error('Media bytes do not match the supplied media type.');
}
export async function importMediaAsset(
  file: { name: string; type: string; arrayBuffer(): Promise<ArrayBuffer> },
  provenance?: string,
): Promise<MediaAsset> {
  if (!mimeTypes.has(file.type))
    throw Error(
      'Unsupported media type. Use PNG/JPEG/GIF/WebP/AVIF, inert SVG, MP4/WebM/Ogg video or WebVTT captions.',
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES)
    throw Error('Media must contain 1 byte to 64 MiB.');
  verifyMediaSignature(bytes, file.type);
  if (file.type === 'image/svg+xml') importSvg(new TextDecoder().decode(bytes));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  return {
    schema: ASSET_SCHEMA,
    reference: `asset:sha256:${digest}`,
    digest,
    name: file.name.slice(0, 240),
    mime: file.type,
    size: bytes.length,
    createdAt: new Date().toISOString(),
    ...(provenance ? { provenance: provenance.slice(0, 1000) } : {}),
    bytes,
  };
}
async function verifyStoredAsset(asset: MediaAsset): Promise<void> {
  if (
    asset.schema !== ASSET_SCHEMA ||
    !(asset.bytes instanceof Uint8Array) ||
    typeof asset.name !== 'string' ||
    asset.name.length > 240 ||
    typeof asset.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(asset.createdAt))
  )
    throw Error('Invalid managed asset metadata.');
  const verified = await importMediaAsset(
    {
      name: asset.name,
      type: asset.mime,
      async arrayBuffer() {
        return asset.bytes.slice().buffer as ArrayBuffer;
      },
    },
    asset.provenance,
  );
  if (
    asset.reference !== verified.reference ||
    asset.digest !== verified.digest ||
    asset.size !== verified.size
  )
    throw Error('Managed asset digest/size mismatch.');
}
export function memoryAssetStore(): MediaAssetStore {
  const assets = new Map<string, MediaAsset>();
  return {
    async put(asset) {
      await verifyStoredAsset(asset);
      assets.set(asset.reference, structuredClone(asset));
    },
    async get(ref) {
      const value = assets.get(ref);
      return value ? structuredClone(value) : undefined;
    },
    async list() {
      return [...assets.values()].map(assetMetadata);
    },
    async remove(ref) {
      assets.delete(ref);
    },
  };
}
/** Explicit origin-local durable host, namespaced by consuming application/workspace. */
export function indexedDbAssetStore(namespace: string): MediaAssetStore {
  if (!namespace.trim() || namespace.length > 200)
    throw Error('An explicit asset namespace is required.');
  const database = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(`vict-media-v1:${namespace}`, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('assets', { keyPath: 'reference' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  async function operation<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await database();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction('assets', mode);
        const request = run(tx.objectStore('assets'));
        let result: T;
        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(result!);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? Error('Asset transaction aborted.'));
      });
    } finally {
      db.close();
    }
  }
  return {
    async put(asset) {
      await verifyStoredAsset(asset);
      await operation('readwrite', (store) => store.put(structuredClone(asset)));
    },
    async get(ref) {
      return operation('readonly', (store) => store.get(ref));
    },
    async list() {
      const rows = await operation<MediaAsset[]>('readonly', (store) => store.getAll());
      return rows.map(assetMetadata);
    },
    async remove(ref) {
      await operation('readwrite', (store) => store.delete(ref));
    },
  };
}
export interface ResolvedMediaAsset {
  readonly url: string;
  readonly mime?: string;
  readonly release: () => void;
}
/** One verified managed-byte boundary shared by raster, video and inert vector consumers. */
export async function readManagedMediaAsset(source: string, store?: MediaAssetStore): Promise<MediaAsset> {
  if (!/^asset:sha256:[a-f0-9]{64}$/.test(source)) throw Error('Invalid managed asset reference.');
  if (!store) throw Error('Managed media needs the application asset host.');
  const asset = await store.get(source);
  if (!asset) throw Error('Asset bytes are unavailable. Import its media archive or select a supplied asset.');
  if (asset.reference !== source) throw Error('Managed asset does not match the requested reference.');
  await verifyStoredAsset(asset);
  return asset;
}
export async function resolveMediaAsset(
  source: string,
  store?: MediaAssetStore,
): Promise<ResolvedMediaAsset> {
  if (source.startsWith('asset:')) {
    const asset = await readManagedMediaAsset(source, store);
    const url = URL.createObjectURL(
      new Blob([asset.bytes.slice().buffer as ArrayBuffer], { type: asset.mime }),
    );
    return { url, mime: asset.mime, release: () => URL.revokeObjectURL(url) };
  }
  if (
    !source ||
    source.length > 4000 ||
    /[\\\u0000-\u0020]/.test(source) ||
    !((source.startsWith('/') && !source.startsWith('//')) || /^https?:\/\//.test(source))
  )
    throw Error(
      'Use a managed asset reference, same-origin absolute path or supplied HTTP(S) URL.',
    );
  return { url: source, release: () => {} };
}
const encode = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
const decode = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export async function exportMediaArchive(
  store: MediaAssetStore,
  references?: readonly string[],
): Promise<string> {
  const selected = references ?? (await store.list()).map((a) => a.reference);
  if (selected.length > 100) throw Error('An archive supports at most 100 assets.');
  const assets = [];
  let size = 0;
  for (const ref of [...new Set(selected)]) {
    const asset = await readManagedMediaAsset(ref, store);
    size += asset.size;
    if (size > MAX_ASSET_BYTES) throw Error('Archive byte budget exceeds 64 MiB.');
    assets.push({ ...assetMetadata(asset), base64: encode(asset.bytes) });
  }
  return JSON.stringify({ schema: 'vict.media-archive@1', assets });
}
export async function importMediaArchive(
  store: MediaAssetStore,
  text: string,
): Promise<readonly MediaAssetMetadata[]> {
  if (text.length > MAX_ASSET_BYTES * 1.4) throw Error('Archive exceeds 64 MiB byte budget.');
  const archive = JSON.parse(text);
  if (
    archive?.schema !== 'vict.media-archive@1' ||
    !Array.isArray(archive.assets) ||
    archive.assets.length > 100
  )
    throw Error('Invalid media archive.');
  const validated: MediaAsset[] = [];
  let total = 0;
  for (const entry of archive.assets) {
    if (
      !entry || typeof entry !== 'object' ||
      typeof entry.base64 !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.mime !== 'string' ||
      typeof entry.createdAt !== 'string' ||
      (entry.provenance !== undefined && typeof entry.provenance !== 'string') ||
      !Number.isFinite(Date.parse(entry.createdAt))
    )
      throw Error('Invalid archive entry.');
    const bytes = decode(entry.base64);
    total += bytes.length;
    if (total > MAX_ASSET_BYTES) throw Error('Archive byte budget exceeded.');
    const asset = await importMediaAsset(
      {
        name: entry.name,
        type: entry.mime,
        async arrayBuffer() {
          return bytes.buffer as ArrayBuffer;
        },
      },
      entry.provenance,
    );
    if (
      asset.reference !== entry.reference ||
      asset.digest !== entry.digest ||
      asset.size !== entry.size
    )
      throw Error('Archive asset digest/size mismatch.');
    validated.push({ ...asset, createdAt: entry.createdAt });
  }
  // Validate every entry before writing. A storage failure is reported; callers can safely retry digest-addressed imports.
  for (const asset of validated) await store.put(asset);
  return validated.map(assetMetadata);
}
