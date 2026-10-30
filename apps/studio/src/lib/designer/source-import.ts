/** Validates a local one-screen export without mutating browser storage or owner sessions.
 * Media is decoded only into a disposable in-memory store, then returned for a fresh namespace. */
import type { UiDocument, UiNode, UiSlotScope } from '@victframework/ui';
import {
  importMediaArchive,
  memoryAssetStore,
  MAX_ASSET_BYTES,
  type MediaAsset,
} from '@victframework/ui-media-svelte/assets';
import { screenApplication, screenIssues } from './application.js';

export const SOURCE_IMPORT_LIMITS = Object.freeze({
  bundleBytes: 96 * 1024 * 1024,
  documentCharacters: 200_000,
  sourceNodes: 500,
  assets: 100,
  assetBytes: MAX_ASSET_BYTES,
});
export type SourceImportFailure = {
  ok: false;
  code: string;
  message: string;
  diagnostics?: readonly { code: string; message: string }[];
};
export type PreparedSourceImport = {
  ok: true;
  document: UiDocument;
  assets: readonly MediaAsset[];
  originalDocumentId: string;
};
export type SourceImportResult = PreparedSourceImport | SourceImportFailure;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string, message: string): SourceImportFailure => ({ ok: false, code, message });
const semanticJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    object(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

/** Inventory asset-bearing props, their local-state bindings, graph media fields
 * and canonical declarations. Human-readable text is not an asset dependency.
 * Looking only at document.assets would miss directly authored managed media. */
function managedReferences(document: UiDocument): {
  references: Set<string>;
  unverified: string[];
} {
  const references = new Set<string>();
  const unverified = new Set<string>();
  let visited = 0;
  const mediaReference = (value: unknown): void => {
    if (typeof value !== 'string' || !value.startsWith('asset:')) return;
    if (!/^asset:sha256:[a-f0-9]{64}$/.test(value))
      throw Error('The source contains an invalid managed asset reference.');
    references.add(value);
  };
  type SourceBinding = unknown[] | {expression:unknown;scope:LexicalScope;location:string} | undefined;
  type LexicalScope = { state: Record<string, SourceBinding>; props: Record<string, SourceBinding> };
  const documentScope: LexicalScope = {state:Object.fromEntries(Object.entries(document.localState).map(([key,decl])=>[key,[decl.initial]])),props:{}};
  // Traverse possible outputs, never evaluate predicates or registered operations.
  // Only references reached from media-bearing props inspect saved state/tokens.
  const expressionValues = (value: unknown, location: string, scope: LexicalScope = documentScope, depth = 0): unknown[] => {
    if (++visited > 16_384 || depth > 64) {
      unverified.add(`${location} (inventory bound)`);
      return [];
    }
    if (!object(value)) return [value];
    if (value.type === 'literal') return [value.value];
    if (value.type === 'ref' && typeof value.path === 'string') {
      for (const [prefix, values] of [['state.', scope.state], ['prop.', scope.props]] as const) {
        if (!value.path.startsWith(prefix)) continue;
        const key = value.path.slice(prefix.length);
        const binding=values[key];
        if (Object.hasOwn(values, key) && binding !== undefined)
          return Array.isArray(binding)?binding:expressionValues(binding.expression,binding.location,binding.scope,depth+1);
        unverified.add(location);
        return [];
      }
      if (value.path.startsWith('token.') && Object.hasOwn(document.tokens, value.path.slice(6)))
        return [document.tokens[value.path.slice(6)]!.value];
      unverified.add(location);
      return [];
    }
    if (value.type === 'conditionalValue')
      return [
        ...expressionValues(value.then, location, scope, depth + 1),
        ...expressionValues(value.otherwise, location, scope, depth + 1),
      ];
    if (value.type === 'op' && Array.isArray(value.args)) {
      unverified.add(location);
      // Exact managed literals remain dependencies. Prefix fragments such as
      // 'asset:sha256:' are computed input, not malformed complete references.
      return value.args
        .flatMap((arg) => expressionValues(arg, location, scope, depth + 1))
        .filter(
          (candidate) =>
            typeof candidate !== 'string' ||
            !candidate.startsWith('asset:') ||
            /^asset:sha256:[a-f0-9]{64}$/.test(candidate),
        );
    }
    unverified.add(location);
    return [];
  };
  // Scope declarations are source ownership, not a report that a branch rendered.
  // Enumerate all branches/families without evaluating app predicates or UI controls.
  const scopes = new Map<string, LexicalScope[]>();
  let traversal = 0;
  const scopedFill = (declaration: UiSlotScope, owner: Extract<UiNode,{kind:'component'}>, name: string, parent: LexicalScope): LexicalScope => {
    const state: LexicalScope['state'] = {};
    const workspaceV2 = owner.definitionId === 'vict.flow.workspace' && owner.revision === '2' && name === 'body';
    let models: Record<string,unknown>[] | undefined;
    if (workspaceV2) {
      const serialized = expressionValues(owner.props?.graph, `${owner.id}.graph`, parent);
      models = [];
      for (const candidate of serialized) {
        try {
          const model:unknown = typeof candidate === 'string' ? JSON.parse(candidate) : undefined;
          if (!object(model) || model.schema !== 'vict.flow-graph@2' || !Array.isArray(model.nodeTypes) || !Array.isArray(model.nodes)) {models=undefined;break;}
          models.push(model);
        } catch {models=undefined;break;}
      }
      if (!serialized.length) models=undefined;
    }
    for (const [key,decl] of Object.entries(declaration.state??{})) {
      if (!decl.controlled) {state[key]=[decl.initial];continue;}
      // Generic unknown renderer-owned state must not masquerade as document state.
      if (!workspaceV2 || !models) {state[key]=undefined;continue;}
      const candidates:unknown[]=[decl.initial];
      for (const model of models) {
        const families = model.nodeTypes as unknown[];
        for (const family of families) if(object(family)&&object(family.parameters)&&object(family.parameters[key])) candidates.push(family.parameters[key].default);
        for (const member of model.nodes as unknown[]) if(object(member)&&object(member.values)&&Object.hasOwn(member.values,key)) candidates.push(member.values[key]);
      }
      state[key]=candidates;
    }
    // Frame props are renderer supplied. Their defaults do not prove all outputs.
    return {state,props:Object.fromEntries(declaration.props.map(prop=>[prop.name,undefined]))};
  };
  const visit = (id:string, scope:LexicalScope, path:readonly string[]=[]):void => {
    if (++traversal>16_384 || path.length>64 || path.includes(id)) {unverified.add(`${id} (source traversal bound)`);return;}
    const node=document.nodes[id];if(!node)return;
    const contexts=scopes.get(id)??[];if(contexts.includes(scope))return;contexts.push(scope);scopes.set(id,contexts);
    const next=[...path,id];
    if(node.kind==='element'||node.kind==='portal')node.children.forEach(child=>visit(child,scope,next));
    else if(node.kind==='repeat')visit(node.templateRoot,scope,next);
    else if(node.kind==='conditional')node.branches.forEach(branch=>branch.children.forEach(child=>visit(child,scope,next)));
    else if(node.kind==='slot')node.fallback?.forEach(child=>visit(child,scope,next));
    else if(node.kind==='component'){
      for(const [name,fill] of Object.entries(node.slots??{})){
        const childScope=fill.scope?scopedFill(fill.scope,node,name,scope):scope;
        fill.children.forEach(child=>visit(child,childScope,next));
      }
      const definition=document.componentDefinitions[node.definitionId];
      if(definition){
        const props:LexicalScope['props']={};
        for(const prop of definition.props??[])props[prop.name]=node.props?.[prop.name]===undefined?[prop.default]:{expression:node.props[prop.name],location:`${node.id}.${prop.name}`,scope};
        visit(definition.root,{state:scope.state,props},next);
      }
    }
  };
  visit(document.root,documentScope);
  // Retain dependency inventory of detached source, without treating it as live UI.
  for(const id of Object.keys(document.nodes))if(!scopes.has(id))visit(id,documentScope);
  for (const node of Object.values(document.nodes)) for(const scope of scopes.get(node.id)??[]) {
    if (node.kind === 'element' && node.tag === 'img')
      expressionValues(node.attributes?.src, `${node.id}.src`, scope).forEach(mediaReference);
    if (node.kind !== 'component') continue;
    for (const key of ['source', 'src', 'poster', 'captions'])
      expressionValues(node.props?.[key], `${node.id}.${key}`, scope).forEach(mediaReference);
    if (node.definitionId === 'vict.pattern.carousel' &&
      expressionValues(node.props?.images, `${node.id}.images`, scope).some(value => value === true)) {
      for (const value of expressionValues(node.props?.slides, `${node.id}.slides`, scope))
        (Array.isArray(value) ? value : [value]).forEach(mediaReference);
    }
    if (!['vict.flow.editor','vict.flow.workspace'].includes(node.definitionId)) continue;
    for (const serialized of expressionValues(node.props?.graph, `${node.id}.graph`, scope)) {
      if (typeof serialized !== 'string') continue;
      let model: unknown;
      try {
        model = JSON.parse(serialized);
      } catch {
        continue;
      }
      if (
        !object(model) ||
        model.schema !== 'vict.flow-graph@1' ||
        !Array.isArray(model.nodeTypes) ||
        !Array.isArray(model.nodes)
      )
        continue;
      const fields = new Map<string, Record<string, unknown>[]>();
      for (const type of model.nodeTypes) {
        if (!object(type)) continue;
        if (object(type.icon)) mediaReference(type.icon.source);
        if (typeof type.id !== 'string' || !Array.isArray(type.fields)) continue;
        const mediaFields = type.fields.filter(
          (field: unknown): field is Record<string, unknown> =>
            object(field) && ['image', 'video', 'icon', 'vector'].includes(String(field.kind)),
        );
        fields.set(type.id, mediaFields);
        for (const field of mediaFields) {
          mediaReference(field.default);
          if (object(field.media)) {
            mediaReference(field.media.poster);
            mediaReference(field.media.captions);
          }
        }
      }
      for (const member of model.nodes) {
        if (!object(member)) continue;
        if (object(member.icon)) mediaReference(member.icon.source);
        if (typeof member.type !== 'string' || !object(member.values)) continue;
        for (const field of fields.get(member.type) ?? [])
          if (typeof field.id === 'string') mediaReference(member.values[field.id]);
      }
    }
  }
  for (const asset of Object.values(document.assets))
    if (asset.kind === 'digest') {
      const digest = asset.digest.replace(/^sha256:/, '');
      if (!/^[a-f0-9]{64}$/.test(digest))
        throw Error(
          `Asset ${asset.id} has an unsupported digest identity; portable media bytes are required.`,
        );
      references.add(`asset:sha256:${digest}`);
    }
  return { references, unverified: [...unverified] };
}

export async function prepareSourceImport(text: string): Promise<SourceImportResult> {
  if (
    typeof text !== 'string' ||
    text.length > SOURCE_IMPORT_LIMITS.bundleBytes ||
    new TextEncoder().encode(text).byteLength > SOURCE_IMPORT_LIMITS.bundleBytes
  )
    return fail('STUDIO_IMPORT_LIMIT', 'The exported bundle exceeds the 96 MiB JSON import limit.');
  let bundle: unknown;
  try {
    bundle = JSON.parse(text);
  } catch {
    return fail('STUDIO_IMPORT_JSON', 'Choose a valid exported application JSON file.');
  }
  if (!object(bundle) || !Array.isArray(bundle.uiDocuments) || bundle.uiDocuments.length !== 1)
    return fail(
      'STUDIO_IMPORT_DOCUMENT_COUNT',
      'Only a bundle containing exactly one UI document is supported. Existing screens were not changed.',
    );
  if (
    Object.keys(bundle).some((key) => !['application', 'uiDocuments', 'mediaArchive'].includes(key))
  )
    return fail('STUDIO_IMPORT_SHAPE', 'The bundle contains unsupported top-level fields.');
  const entry = bundle.uiDocuments[0];
  if (
    !object(entry) ||
    Object.keys(entry).some((key) => key !== 'document') ||
    !object(entry.document)
  )
    return fail(
      'STUDIO_IMPORT_SHAPE',
      'The UI document entry must contain only its canonical document.',
    );
  const raw = entry.document;
  let serializedSource: string;
  try {
    serializedSource = JSON.stringify(raw);
  } catch {
    return fail('STUDIO_IMPORT_SOURCE_LIMIT', 'The source is too deeply nested to import safely.');
  }
  if (
    serializedSource.length > SOURCE_IMPORT_LIMITS.documentCharacters ||
    !object(raw.nodes) ||
    Object.keys(raw.nodes).length > SOURCE_IMPORT_LIMITS.sourceNodes
  )
    return fail(
      'STUDIO_IMPORT_SOURCE_LIMIT',
      'The UI source exceeds the current 200,000-character / 500-node authoring boundary.',
    );
  const issues = screenIssues(raw as unknown as UiDocument);
  if (issues.length)
    return {
      ok: false,
      code: 'STUDIO_IMPORT_SOURCE_INVALID',
      message: 'The UI source does not satisfy the installed Studio authoring contracts.',
      diagnostics: issues
        .slice(0, 8)
        .map((issue) => ({ code: issue.code, message: issue.message.slice(0, 400) })),
    };
  const document = raw as unknown as UiDocument;
  try {
    if (
      Object.hasOwn(bundle, 'application') &&
      semanticJson(bundle.application) !== semanticJson(screenApplication(document))
    )
      return fail(
        'STUDIO_IMPORT_APPLICATION',
        'The application definition differs from this supported one-screen export. It was not silently discarded.',
      );
  } catch {
    return fail(
      'STUDIO_IMPORT_APPLICATION',
      'The supplied application definition is too deeply nested or otherwise unsupported.',
    );
  }
  let required: Set<string>;
  let unverified: readonly string[];
  try {
    const inventory = managedReferences(document);
    required = inventory.references;
    unverified = inventory.unverified;
  } catch (error) {
    return fail(
      'STUDIO_IMPORT_ASSET_REFERENCE',
      error instanceof Error ? error.message : 'The media reference inventory is invalid.',
    );
  }
  const staged = memoryAssetStore();
  if (Object.hasOwn(bundle, 'mediaArchive')) {
    const archive = bundle.mediaArchive;
    if (
      !object(archive) ||
      archive.schema !== 'vict.media-archive@1' ||
      !Array.isArray(archive.assets) ||
      archive.assets.length > SOURCE_IMPORT_LIMITS.assets
    )
      return fail(
        'STUDIO_IMPORT_MEDIA_INVALID',
        'The supplied media archive is invalid or exceeds 100 assets.',
      );
    let declared = 0;
    for (const asset of archive.assets) {
      if (!object(asset) || !Number.isSafeInteger(asset.size) || Number(asset.size) <= 0)
        return fail(
          'STUDIO_IMPORT_MEDIA_INVALID',
          'Every archived asset must declare a valid positive byte size.',
        );
      declared += Number(asset.size);
      if (declared > SOURCE_IMPORT_LIMITS.assetBytes)
        return fail(
          'STUDIO_IMPORT_MEDIA_LIMIT',
          'The decoded media archive exceeds the aggregate 64 MiB byte budget.',
        );
    }
    try {
      await importMediaArchive(staged, JSON.stringify(archive));
    } catch (error) {
      return fail(
        'STUDIO_IMPORT_MEDIA_INVALID',
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'The media archive could not be validated.',
      );
    }
  }
  const metadata = await staged.list();
  const assets: MediaAsset[] = [];
  let decoded = 0;
  for (const entry of metadata) {
    const asset = await staged.get(entry.reference);
    if (!asset) return fail('STUDIO_IMPORT_MEDIA_INVALID', 'A staged media member is unavailable.');
    decoded += asset.bytes.byteLength;
    if (decoded > SOURCE_IMPORT_LIMITS.assetBytes)
      return fail(
        'STUDIO_IMPORT_MEDIA_LIMIT',
        'The decoded media archive exceeds the aggregate 64 MiB byte budget.',
      );
    assets.push(asset);
  }
  const available = new Set(assets.map((asset) => asset.reference));
  const missing = [...required].filter((reference) => !available.has(reference));
  if (missing.length)
    return fail(
      'STUDIO_IMPORT_MEDIA_MISSING',
      `${missing.length} managed media reference${missing.length === 1 ? ' has' : 's have'} no validated bytes in this export. Include a media archive before importing.`,
    );
  if (unverified.length)
    return fail(
      'STUDIO_IMPORT_MEDIA_DYNAMIC',
      `Saved bytes cannot prove computed or runtime media outputs at ${unverified.slice(0, 4).join(', ')}. This importer supports literal sources, saved state/token values and their conditional branches; future constructed URLs require a supported media resolver.`,
    );
  return { ok: true, document: structuredClone(document), assets, originalDocumentId: document.id };
}
