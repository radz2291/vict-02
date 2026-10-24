/** Package-owned knowledge accompanies the existing component contract. It grants no effects. */
import type { UiExtensionDescriptor } from './compile.js';
import type { UiDocument, UiLocalStateDecl, UiNode, UiExpression } from './document.js';
import type { UiDiagnostic } from './diagnostics.js';
import { canonicalUiDocument } from './canonical.js';

export const UI_AUTHORING_SCHEMA = 'vict.ui-authoring@1' as const;
export interface UiAuthoringFragment {
  readonly root: string;
  readonly nodes: readonly UiNode[];
  readonly localState?: Readonly<Record<string, UiLocalStateDecl>>;
  /** Explicit template identity links; only these literal props/initial values follow node remapping. */
  readonly identities?: readonly { readonly nodeId?: string; readonly property?: string; readonly stateKey?: string; readonly sourceNodeId: string }[];
}
export interface UiAuthoringPlacement { readonly definitionId: string; readonly revision?: string; readonly slotName: string }
export type UiAuthoringRule =
  | { readonly kind: 'ancestorSlot'; readonly placements: readonly UiAuthoringPlacement[] }
  | { readonly kind: 'requiredParts'; readonly slot: string; readonly definitionIds: readonly string[]; readonly minimum?: number }
  | { readonly kind: 'uniqueValue'; readonly property: string; readonly providerIds: readonly string[]; readonly slots?: readonly string[]; readonly namespace?: string; readonly nonempty?: boolean }
  | { readonly kind: 'pairedValues'; readonly left: { readonly slot: string; readonly definitionIds: readonly string[]; readonly property: string }; readonly right: { readonly slot: string; readonly definitionIds: readonly string[]; readonly property: string } }
  | { readonly kind: 'labelOwnership'; readonly mode: 'component' | 'external'; readonly property: string }
  | { readonly kind: 'controlledPair'; readonly prop: string; readonly output: string; readonly required?: boolean }
  | { readonly kind: 'hostRequirement'; readonly capability: string; readonly reason: string };
export interface UiAuthoringRegistration {
  readonly descriptor: UiExtensionDescriptor;
  readonly label: string;
  readonly family: string;
  readonly category: string;
  readonly purpose: string;
  readonly eligibility: { readonly kind: 'standalone' | 'part' | 'host-required' | 'excluded'; readonly reason?: string };
  readonly dependencies?: readonly { readonly id: string; readonly revision: string }[];
  readonly rules?: readonly UiAuthoringRule[];
  readonly guidance?: readonly string[];
  readonly seed?: UiAuthoringFragment;
  readonly examples?: readonly UiAuthoringFragment[];
  /** Only pre-existing component identities may retain unchanged historical violations. */
  readonly legacyCompatibility?: boolean;
}
/** Projected from the actual renderer registration, never a second implementation declaration. */
export interface UiAuthoringImplementationCapability {
  readonly extensionId: string; readonly revision: string; readonly rendererImplementationId: string;
  readonly abi?: string; readonly slots?: readonly string[]; readonly required?: readonly string[];
  readonly styleTargets?: readonly string[]; readonly requiresParentContext?: boolean;
  readonly compositionSlots?: readonly string[];
}
export interface UiAuthoringPackage {
  readonly schema: typeof UI_AUTHORING_SCHEMA;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly registrations: readonly UiAuthoringRegistration[];
  readonly exportDispositions: readonly { readonly name: string; readonly disposition: string; readonly reason: string }[];
  readonly compatibility?: readonly { readonly id: string; readonly revision: string; readonly descriptorDigest: string; readonly capabilitiesDigest?: string }[];
}
export interface UiAuthoringContract extends UiAuthoringRegistration {
  readonly packageName: string; readonly packageVersion: string;
  readonly capabilities: UiAuthoringImplementationCapability;
  readonly descriptorDigest: string; readonly digest: string;
}
export interface UiAuthoringRegistry {
  readonly ok: boolean;
  readonly issues: readonly UiDiagnostic[];
  /** Preserve install order for existing unpinned component semantics. */
  readonly descriptors: readonly UiExtensionDescriptor[];
  readonly contracts: readonly UiAuthoringContract[];
  readonly packages: readonly UiAuthoringPackage[];
  readonly digest: string;
}
export const authoringDigest = (value: unknown): string => canonicalUiDocument(value).contentDigest;
export const authoringKey = (id: string, revision: string): string => `${id}@${revision}`;
export function effectiveUiDescriptor(node: Pick<Extract<UiNode, {kind:'component'}>, 'definitionId' | 'revision'>, descriptors: readonly UiExtensionDescriptor[]): UiExtensionDescriptor | undefined {
  const matches = descriptors.filter(item => item.id === node.definitionId);
  const revision = node.revision ?? matches.at(-1)?.revision;
  const exact = matches.filter(item => item.revision === revision);
  return exact.length === 1 ? exact[0] : undefined;
}
function issue(hostCode: string, message: string, detail: Record<string, unknown> = {}, severity: UiDiagnostic['severity'] = 'error'): UiDiagnostic {
  return { code:'UI_COMPONENT_BINDING_INCOMPATIBLE', severity, hostCode, message, ...detail };
}
const boundedInteger=(value:number|undefined,fallback:number,minimum:number,maximum:number)=>Math.min(maximum,Math.max(minimum,Math.floor(value!==undefined&&Number.isFinite(value)?value:fallback)));
export function authoringImplementationCapabilities(input: UiAuthoringImplementationCapability): UiAuthoringImplementationCapability {
  return { extensionId:input.extensionId, revision:input.revision, rendererImplementationId:input.rendererImplementationId,
    ...(input.abi === undefined ? {} : {abi:input.abi}), slots:[...(input.slots ?? [])], required:[...(input.required ?? [])],
    styleTargets:[...(input.styleTargets ?? [])], requiresParentContext:input.requiresParentContext === true, compositionSlots:[...(input.compositionSlots ?? [])] };
}
export function createUiAuthoringRegistry(packages: readonly UiAuthoringPackage[], implementations: readonly UiAuthoringImplementationCapability[], options:{readonly requireCompatibility?:boolean}={}): UiAuthoringRegistry {
  const issues: UiDiagnostic[] = [];
  const raw = packages.flatMap(pkg => pkg.registrations.map(registration => ({pkg,registration})));
  const keys = new Set<string>();
  for (const {pkg,registration:r} of raw) {
    const key = authoringKey(r.descriptor.id,r.descriptor.revision);
    if (keys.has(key)) issues.push(issue('UI_AUTHORING_DUPLICATE',`Duplicate exact authoring registration ${key}.`,{key}));
    keys.add(key);
    if (pkg.schema !== UI_AUTHORING_SCHEMA || !pkg.packageName || !pkg.packageVersion || !r.label || !r.family || !r.category || !r.purpose)
      issues.push(issue('UI_AUTHORING_METADATA',`Incomplete authoring package or registration ${key}.`,{key}));
    if (['host-required','excluded'].includes(r.eligibility.kind) && !r.eligibility.reason)
      issues.push(issue('UI_AUTHORING_DISPOSITION',`An unavailable registration needs an explicit reason: ${key}.`,{key}));
    const matches = implementations.filter(item => item.extensionId === r.descriptor.id && item.revision === r.descriptor.revision && item.rendererImplementationId === r.descriptor.rendererImplementationId);
    if (matches.length !== 1) issues.push(issue('UI_AUTHORING_IMPLEMENTATION',`Exactly one actual renderer registration is required for ${key}.`,{key}));
    const actual = matches[0] && authoringImplementationCapabilities(matches[0]);
    if (actual) {
      if (r.descriptor.abi !== actual.abi || (r.descriptor.slots ?? []).some(slot => !actual.slots?.includes(slot)) || (r.descriptor.styleTargets ?? []).some(target => !actual.styleTargets?.includes(target)))
        issues.push(issue('UI_AUTHORING_CAPABILITIES',`Descriptor and renderer capabilities disagree for ${key}.`,{key}));
      if (actual.requiresParentContext && !r.rules?.some(rule => rule.kind === 'ancestorSlot')) issues.push(issue('UI_AUTHORING_CONTEXT',`Context-owned ${key} needs an ancestor-slot rule.`,{key}));
      if(actual.required?.some(slot=>!actual.slots?.includes(slot)||!r.descriptor.slots?.includes(slot)))issues.push(issue('UI_AUTHORING_CAPABILITIES',`Required renderer slots must be declared for ${key}.`,{key}));
    }
    const pin = pkg.compatibility?.find(item => item.id === r.descriptor.id && item.revision === r.descriptor.revision);
    if(options.requireCompatibility&&(!pin||!pin.capabilitiesDigest))issues.push(issue('UI_AUTHORING_COMPATIBILITY_MISSING',`Production registration ${key} needs retained descriptor and renderer capability compatibility pins.`,{key,packageName:pkg.packageName}));
    if (pin && (pin.descriptorDigest !== authoringDigest(r.descriptor) || (pin.capabilitiesDigest && actual && pin.capabilitiesDigest !== authoringDigest(actual))))
      issues.push(issue('UI_AUTHORING_CONTRACT_DRIFT',`Immutable contract ${key} differs from its retained compatibility baseline.`,{key}));
    for (const rule of r.rules ?? []) {
      if (rule.kind === 'controlledPair') {
        const prop = r.descriptor.props.find(prop => prop.name === rule.prop);
        const output = r.descriptor.outputs?.find(output => output.name === rule.output);
        if (!prop || !output || prop.type !== output.payload) issues.push(issue('UI_AUTHORING_RULE',`Controlled pair ${rule.prop}/${rule.output} is incompatible with ${key}.`,{key}));
      }
      if (rule.kind === 'requiredParts' && !r.descriptor.slots?.includes(rule.slot)) issues.push(issue('UI_AUTHORING_RULE',`Required part slot ${rule.slot} is not declared on ${key}.`,{key}));
    }
  }
  if(options.requireCompatibility)for(const pkg of packages)for(const pin of pkg.compatibility??[]){const count=pkg.registrations.filter(item=>item.descriptor.id===pin.id&&item.descriptor.revision===pin.revision).length;if(count!==1)issues.push(issue('UI_AUTHORING_COMPATIBILITY_ORPHAN',`Retained compatibility contract ${authoringKey(pin.id,pin.revision)} must still have one installed registration.`,{packageName:pkg.packageName,id:pin.id,revision:pin.revision}));}
  for(const implementation of implementations)if(!keys.has(authoringKey(implementation.extensionId,implementation.revision)))
    issues.push(issue('UI_AUTHORING_MISSING',`Renderer component ${authoringKey(implementation.extensionId,implementation.revision)} has no authoring disposition.`,{id:implementation.extensionId,revision:implementation.revision}));
  for(const {registration:r} of raw)for(const rule of r.rules??[]){
    if(rule.kind==='uniqueValue'&&!r.descriptor.props.some(prop=>prop.name===rule.property))issues.push(issue('UI_AUTHORING_RULE',`Identity property '${rule.property}' is not declared.`,{id:r.descriptor.id}));
    if(rule.kind==='ancestorSlot')for(const placement of rule.placements){const providers=raw.filter(({registration:provider})=>provider.descriptor.id===placement.definitionId&&(!placement.revision||provider.descriptor.revision===placement.revision));if(!providers.length||providers.some(({registration:provider})=>!provider.descriptor.slots?.includes(placement.slotName)))issues.push(issue('UI_AUTHORING_PLACEMENT',`Provider/slot is unavailable for ${r.descriptor.id}.`,{placement}));}
  }
  const ownDigests = new Map(raw.map(({pkg,registration}) => [authoringKey(registration.descriptor.id,registration.descriptor.revision), authoringDigest({schema:pkg.schema,packageName:pkg.packageName,packageVersion:pkg.packageVersion,registration,capabilities:implementations.filter(item => item.extensionId === registration.descriptor.id && item.revision === registration.descriptor.revision && item.rendererImplementationId === registration.descriptor.rendererImplementationId).map(authoringImplementationCapabilities)})]));
  const digests = new Map<string,string>();
  function digest(key:string, chain:readonly string[]=[]):string {
    if (digests.has(key)) return digests.get(key)!;
    if (chain.includes(key)) { issues.push(issue('UI_AUTHORING_DEPENDENCY_CYCLE',`Cyclic authoring dependency: ${[...chain,key].join(' → ')}.`,{key})); return 'cycle'; }
    const item = raw.find(({registration:r}) => authoringKey(r.descriptor.id,r.descriptor.revision) === key);
    if (!item) {issues.push(issue('UI_AUTHORING_DEPENDENCY_MISSING',`Missing exact authoring dependency ${key}.`,{key}));return 'missing';}
    const dependencies = (item.registration.dependencies ?? []).map(dep => ({...dep,digest:digest(authoringKey(dep.id,dep.revision),[...chain,key])}));
    const value = authoringDigest({own:ownDigests.get(key),dependencies}); digests.set(key,value); return value;
  }
  for(const key of keys) digest(key);
  const contracts = raw.map(({pkg,registration:r}):UiAuthoringContract => ({...r,packageName:pkg.packageName,packageVersion:pkg.packageVersion,
    capabilities:authoringImplementationCapabilities(implementations.find(item => item.extensionId === r.descriptor.id && item.revision === r.descriptor.revision && item.rendererImplementationId === r.descriptor.rendererImplementationId) ?? {extensionId:r.descriptor.id,revision:r.descriptor.revision,rendererImplementationId:r.descriptor.rendererImplementationId}),
    descriptorDigest:authoringDigest(r.descriptor),digest:digests.get(authoringKey(r.descriptor.id,r.descriptor.revision))!}));
  return {ok:issues.every(item => item.severity !== 'error'),issues,packages,contracts,descriptors:raw.map(({registration})=>registration.descriptor),digest:authoringDigest(contracts.map(item=>({id:item.descriptor.id,revision:item.descriptor.revision,digest:item.digest})))};
}
export function authoringIndex(registry:UiAuthoringRegistry, input:{family?:string;category?:string;query?:string;offset?:number;limit?:number}={}) {
  const offset=boundedInteger(input.offset,0,0,200000), limit=boundedInteger(input.limit,12,1,20);
  const entries=registry.contracts.filter(item=>(!input.family || item.family===input.family)&&(!input.category || item.category===input.category)&&(!input.query || `${item.descriptor.id} ${item.label} ${item.purpose} ${item.family} ${item.category}`.toLowerCase().includes(input.query.toLowerCase()))).sort((a,b)=>authoringKey(a.descriptor.id,a.descriptor.revision).localeCompare(authoringKey(b.descriptor.id,b.descriptor.revision)));
  return {registryDigest:registry.digest,items:entries.slice(offset,offset+limit).map(item=>({id:item.descriptor.id,revision:item.descriptor.revision,label:item.label,family:item.family,category:item.category,eligibility:item.eligibility,digest:item.digest,packageName:item.packageName})),total:entries.length,offset,nextOffset:offset+limit<entries.length?offset+limit:null};
}
export function authoringContractBundle(registry:UiAuthoringRegistry, input:{requested:readonly {id:string;revision?:string}[];knownDigests?:Readonly<Record<string,string>>;maxItems?:number;maxBytes?:number;maxDepth?:number}) {
  const maxItems=boundedInteger(input.maxItems,8,1,20),maxBytes=boundedInteger(input.maxBytes,18000,512,48000),maxDepth=boundedInteger(input.maxDepth,8,1,12);
  const ordered:UiAuthoringContract[]=[],seen=new Set<string>(),pending:string[]=[],problems:string[]=[];
  const visit=(id:string,revision:string|undefined,depth:number)=>{
    const found=registry.contracts.filter(item=>item.descriptor.id===id && (revision===undefined || item.descriptor.revision===revision));
    const contract=revision===undefined?found.at(-1):found.length===1?found[0]:undefined;
    if(!contract){problems.push(`Exact contract unavailable: ${authoringKey(id,revision??'current')}`);return;}
    const key=authoringKey(id,contract.descriptor.revision);if(seen.has(key))return;seen.add(key);
    if(depth>maxDepth){pending.push(key);problems.push('dependency-depth');return;}
    for(const dependency of contract.dependencies??[])visit(dependency.id,dependency.revision,depth+1);
    ordered.push(contract);
  };
  input.requested.slice(0,30).forEach(item=>visit(item.id,item.revision,0));
  if(input.requested.length>30)problems.push('requested-item-budget');
  const items:({id:string;revision:string;digest:string;unchanged:true}|{id:string;revision:string;digest:string;contract:UiAuthoringContract})[]=[];
  let bytes=0;
  for(const contract of ordered){const id=contract.descriptor.id,revision=contract.descriptor.revision,key=authoringKey(id,revision),digest=contract.digest;
    const item=input.knownDigests?.[key]===digest?{id,revision,digest,unchanged:true as const}:{id,revision,digest,contract};
    const size=new TextEncoder().encode(JSON.stringify(item)).length;
    if(items.length>=maxItems || bytes+size>maxBytes){pending.push(key);continue;}items.push(item);bytes+=size;
  }
  return {ok:registry.ok&&pending.length===0&&problems.length===0,complete:registry.ok&&pending.length===0&&problems.length===0,registryDigest:registry.digest,items,pending,problems,...(pending.length?{budgetCause:items.length>=maxItems?'items':'bytes-or-depth'}:{}),bytes};
}
