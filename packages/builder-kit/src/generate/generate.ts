import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCatalog } from '../catalog/generate.js';
import { canonicalJsonBytes } from '../canonical.js';
import {
  BOOTSTRAP_PATH,
  CATALOG_PATH,
  CONTEXT_PACK_PATH,
  PACK_MD_PATH,
  buildContextPack,
  contextPackBytes,
} from './context-pack.js';
import { renderBootstrap, renderPackMd } from './render.js';

/**
 * The deterministic generation pipeline for the committed stable layer
 * (architecture §3.2/§3.3/§4.2): catalog → base pack → PACK.md +
 * BUILDER-KIT.md. Byte-stable for identical inputs; every artifact lands
 * in the same commit set as the input change that caused it.
 */

export interface GenerateResult {
  readonly written: readonly { readonly path: string; readonly bytes: number }[];
  readonly packId: string;
}

/** Regenerate the committed stable layer in place. */
export function generateStableLayer(repoRoot: string): GenerateResult {
  // 1. capability catalog from typed declarations (isolated child),
  //    written before the pack: the catalog file is a recorded input.
  const { catalog } = generateCatalog(repoRoot);
  const catalogBytes = canonicalJsonBytes(catalog);
  mkdirSync(join(repoRoot, CATALOG_PATH, '..'), { recursive: true });
  writeFileSync(join(repoRoot, CATALOG_PATH), catalogBytes);

  // 2. base pack from the recorded inputs (catalog file digest included).
  const kitVersion = readKitVersion(repoRoot);
  const { pack, packId } = buildContextPack(repoRoot);
  const packBytes = contextPackBytes(pack);

  // 3. rendered artifacts from the built pack.
  const bootstrapBytes = Buffer.from(
    renderBootstrap(pack, { kitVersion, selfHostProfile: 'builder.selfhost' }),
    'utf8',
  );
  const packMdBytes = Buffer.from(renderPackMd(pack), 'utf8');

  const written = [
    { path: CATALOG_PATH, bytes: catalogBytes },
    { path: CONTEXT_PACK_PATH, bytes: packBytes },
    { path: PACK_MD_PATH, bytes: packMdBytes },
    { path: BOOTSTRAP_PATH, bytes: bootstrapBytes },
  ];
  for (const item of written) {
    const absolute = join(repoRoot, item.path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, item.bytes);
  }
  return { written: written.map(({ path, bytes }) => ({ path, bytes: bytes.byteLength })), packId };
}

function readKitVersion(repoRoot: string): string {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'builder-kit', 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  const version = manifest['version'];
  if (typeof version !== 'string') throw new Error('generate: kit version not readable');
  return version;
}
