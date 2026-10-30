import {
  authoringContractBody,
  authoringDataContracts,
  type UiAuthoringContractBody,
  type UiAuthoringRegistry,
} from '@victframework/ui';
import { z } from 'zod';

export const KNOWLEDGE_PAGE_CHARACTERS = 6000;
const prefix = 'studio-knowledge-page@1:';
const projection = z.enum(['guidance', 'examples']);
const kind = z.enum(['component', 'data']);
const cursorSchema = z
  .object({
    kind,
    key: z.string().min(1).max(500),
    projection,
    bodyIdentity: z.string().min(1).max(1000),
    offset: z.number().int().min(1).max(200000),
  })
  .strict();
type Cursor = z.infer<typeof cursorSchema>;
export type KnowledgeRead = {
  kind?: z.infer<typeof kind>;
  key?: string;
  projection?: z.infer<typeof projection>;
  cursor?: string;
};

/** Same projection identity as the retained batched component-contract path. */
export const contractBodyIdentity = (digest: string, includeExamples = false) =>
  `studio-contract-body@2:${includeExamples ? 'examples' : 'guidance'}:${digest}`;

/** Both read surfaces project the same implemented public contract bytes. */
export function projectComponentContract(body: UiAuthoringContractBody, includeExamples = false) {
  const { seed, examples, dataContracts, ...contract } = body;
  const refs = dataContracts?.map(({ id, revision, digest }) => ({
    id,
    revision,
    digest,
    registry: 'dataContracts',
    key: `${id}@${revision}`,
  }));
  const publicContract = { ...contract, ...(refs ? { dataContracts: refs } : {}) };
  const fullContract = refs ? { ...body, dataContracts: refs } : body;
  const preparation = {
    seedStyles:
      seed?.nodes
        .filter((node) => 'localStyle' in node && node.localStyle?.length)
        .map((node) => ({
          nodeId: node.id,
          localStyle: 'localStyle' in node ? node.localStyle : [],
        })) ?? [],
    hostRequirements: body.rules?.filter((rule) => rule.kind === 'hostRequirement') ?? [],
    dependencies: body.dependencies ?? [],
    seedStylePrecedence:
      'Local styles override shared style sources; explicitly replace/remove undesired seed declarations before construction.',
  };
  return includeExamples
    ? { ...fullContract, preparation }
    : { ...publicContract, exampleCount: examples?.length ?? 0, hasSeed: !!seed, preparation };
}

function encodeCursor(value: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return (
    prefix +
    btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
  );
}
function decodeCursor(value: string): Cursor | undefined {
  if (value.length > 4000 || !value.startsWith(prefix)) return;
  const encoded = value.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return;
  try {
    const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = cursorSchema.safeParse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    return parsed.success && encodeCursor(parsed.data) === value ? parsed.data : undefined;
  } catch {
    return;
  }
}

const failure = (code: string, message: string) => ({
  ok: false as const,
  code,
  message,
  items: [],
});
/** Read-only cursor: it is not a credential or execution authority. It binds an
 * exact registered body, projection and range, and never coerces legacy inputs. */
export function readKnowledgePage(registry: UiAuthoringRegistry, query: KnowledgeRead) {
  if (!registry.ok)
    return {
      ...failure(
        'STUDIO_AGENT_KNOWLEDGE_UNAVAILABLE',
        'The installed authoring registry is not ready.',
      ),
      registryReady: false,
    };
  const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
  if (query.cursor !== undefined && !cursor)
    return failure(
      'STUDIO_AGENT_KNOWLEDGE_CURSOR_INVALID',
      'Copy the returned nextCursor exactly, or restart with kind and an exact key.',
    );
  if (
    cursor &&
    ((query.kind !== undefined && query.kind !== cursor.kind) ||
      (query.key !== undefined && query.key !== cursor.key) ||
      (query.projection !== undefined && query.projection !== cursor.projection))
  )
    return failure(
      'STUDIO_AGENT_KNOWLEDGE_CURSOR_MISMATCH',
      'The continuation belongs to a different kind, key or projection. Restart the intended exact body.',
    );
  const selectedKind = cursor?.kind ?? query.kind;
  const key = cursor?.key ?? query.key;
  const selectedProjection = cursor?.projection ?? query.projection ?? 'guidance';
  if (!selectedKind || !key)
    return failure(
      'STUDIO_AGENT_READ_QUERY',
      'knowledge requires kind and exact id@revision key, or a copied continuation cursor.',
    );

  let id: string, revision: string, digest: string, bodyIdentity: string, body: unknown;
  let dependencies: readonly { id: string; revision: string }[] = [];
  if (selectedKind === 'component') {
    const matches = registry.contracts.filter(
      (item) => `${item.descriptor.id}@${item.descriptor.revision}` === key,
    );
    if (matches.length !== 1)
      return failure(
        'STUDIO_AGENT_KNOWLEDGE_NOT_FOUND',
        'Use an exact component id@revision from catalog. No unpinned default or recipe fallback was selected.',
      );
    const contract = matches[0]!;
    ({ id, revision } = contract.descriptor);
    digest = contract.digest;
    bodyIdentity = contractBodyIdentity(digest, selectedProjection === 'examples');
    body = projectComponentContract(
      authoringContractBody(contract),
      selectedProjection === 'examples',
    );
    dependencies = contract.dependencies ?? [];
  } else {
    const matches = authoringDataContracts(registry).filter(
      (item) => `${item.id}@${item.revision}` === key,
    );
    if (matches.length !== 1)
      return failure(
        'STUDIO_AGENT_KNOWLEDGE_NOT_FOUND',
        'Use an exact data-contract id@revision from registry/dataContracts.',
      );
    const entry = matches[0]!;
    ({ id, revision, digest } = entry);
    const { digest: _digest, ...data } = entry;
    const { examples: _examples, ...guidance } = data;
    body = selectedProjection === 'examples' ? data : guidance;
    bodyIdentity = `studio-data-knowledge-body@1:${selectedProjection}:${digest}`;
  }

  if (cursor && cursor.bodyIdentity !== bodyIdentity)
    return {
      ...failure(
        'STUDIO_AGENT_KNOWLEDGE_BODY_INVALIDATED',
        'This registered body changed. Discard partial pages and restart with kind, key and projection.',
      ),
      ...(selectedKind === 'component' ? { items: [{ id, revision, invalidated: true }] } : {}),
    };
  const json = JSON.stringify(body),
    offset = cursor?.offset ?? 0;
  if (offset >= json.length)
    return failure(
      'STUDIO_AGENT_KNOWLEDGE_CURSOR_INVALID',
      'The continuation range is outside this body. Restart the exact selected body.',
    );
  const end = Math.min(offset + KNOWLEDGE_PAGE_CHARACTERS, json.length);
  if (end < json.length && end > 200000)
    return failure(
      'STUDIO_AGENT_READ_LIMIT',
      'This registered body exceeds the existing bounded knowledge range. No content was truncated or declared complete.',
    );
  const nextCursor =
    end < json.length
      ? encodeCursor({
          kind: selectedKind,
          key,
          projection: selectedProjection,
          bodyIdentity,
          offset: end,
        })
      : null;
  const page = {
    id,
    revision,
    digest,
    bodyIdentity,
    offset,
    totalCharacters: json.length,
    bodyComplete: offset === 0 && end === json.length,
  };
  const common = {
    ok: true as const,
    registryReady: true,
    registryDigest: registry.digest,
    kind: selectedKind,
    key,
    projection: selectedProjection,
    nextCursor,
    paging:
      'Copy nextCursor exactly as a JSON string; do not send offset, limit or identity maps. Stop on nextCursor:null. A selected body is complete only after assembling every page from its first page. Component dependencies are explicit references and must be read separately; no dependency body or app source was preloaded.',
  };
  return selectedKind === 'component'
    ? {
        ...common,
        items: [{ ...page, contractJson: json.slice(offset, end) }],
        dependencies: dependencies.map((item) => ({ ...item, key: `${item.id}@${item.revision}` })),
        dependencyBodiesIncluded: false,
      }
    : { ...common, ...page, sourceJson: json.slice(offset, end) };
}
