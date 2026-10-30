/** Media host facts stay outside the closed canonical asset-reference schema. */
import type {UiAssetRef,UiDocument} from '@victframework/ui';
import type {TransactionDraft} from '@victframework/ui-editor';
import type {MediaAssetMetadata} from '@victframework/ui-media-svelte/assets';
import {z} from 'zod';

/** Browser-reported current-store metadata, distinct from canonical source facts. */
export const agentMediaInventorySchema=z.object({
  documentId:z.string().min(1).max(160),listedAt:z.string().datetime({offset:true}),
  items:z.array(z.object({reference:z.string().regex(/^asset:sha256:[a-f0-9]{64}$/),digest:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().max(240),mime:z.string().min(1).max(100),size:z.number().int().min(1).max(64*1024*1024)}).strict()).max(100),
  total:z.number().int().min(0).max(1000000),truncated:z.boolean(),
}).strict().superRefine((snapshot,ctx)=>{
  if(snapshot.items.some(item=>item.reference!==`asset:sha256:${item.digest}`))ctx.addIssue({code:'custom',path:['items'],message:'Each media reference must match its digest.'});
  if(new Set(snapshot.items.map(item=>item.reference)).size!==snapshot.items.length)ctx.addIssue({code:'custom',path:['items'],message:'Media inventory references must be unique.'});
  if(snapshot.total<snapshot.items.length||snapshot.truncated!==(snapshot.total>snapshot.items.length))ctx.addIssue({code:'custom',path:['total'],message:'Inventory count/truncation must describe the supplied host snapshot honestly.'});
});
export type AgentMediaInventory=z.infer<typeof agentMediaInventorySchema>;
export function agentMediaInventorySnapshot(documentId:string,assets:readonly MediaAssetMetadata[],listedAt=new Date().toISOString()):AgentMediaInventory{
  return agentMediaInventorySchema.parse({documentId,listedAt,items:assets.slice(0,100).map(({reference,digest,name,mime,size})=>({reference,digest,name:name.slice(0,240),mime,size})),total:assets.length,truncated:assets.length>100});
}

export const MEDIA_SOURCE_GUIDANCE='For a canonical digest asset, use source="asset:sha256:<full 64-character digest>" on vict.media.image/video/vector/icon. External assets use their declared href. The registry does not prove bytes are present and does not declare MIME, dimensions or playback. Confirm those in the owner-supplied media library; do not infer absent media support from an empty registry. Video poster takes an image reference; captions takes WebVTT; vector/custom icon source requires a managed inert SVG. Editable vector/icon data is a separate JSON prop and takes precedence over source.';

export function canonicalAssetMediaFacts(asset:UiAssetRef){
  const digest=asset.kind==='digest'?asset.digest:undefined;
  const reference=asset.kind==='external'?asset.href:/^[a-fA-F0-9]{64}$/.test(digest??'')?`asset:sha256:${digest!.toLowerCase()}`:undefined;
  return {sourceReference:reference??null,mediaReferenceSupported:!!reference&&(asset.kind==='digest'||(!/[\\\u0000-\u0020]/.test(reference)&&((reference.startsWith('/')&&!reference.startsWith('//'))||/^https?:\/\//.test(reference)))),availability:'not-checked',mime:null,metadata:'Canonical asset references do not contain MIME, dimensions, duration or stored-byte availability.'};
}

/** Bounded UI projection of genuine store metadata, never inferred from a filename. */
export function projectStoredMediaMetadata(assets:readonly MediaAssetMetadata[],limit=100){
  const bounded=Math.min(100,Math.max(1,Math.floor(Number.isFinite(limit)?limit:100)));
  return {items:assets.slice(0,bounded).map(asset=>({reference:asset.reference,digest:asset.digest,name:asset.name.slice(0,240),mime:asset.mime,size:asset.size,createdAt:asset.createdAt,...(asset.provenance?{provenance:asset.provenance.slice(0,1000)}:{})})),total:assets.length,truncated:assets.length>bounded,scope:'current-application-asset-store',persistence:'origin-local-unless-the-host-supplies-another-store',portability:'Export/import the media archive alongside source for a different browser or origin.'};
}

export type MediaAttachmentField='source'|'poster'|'captions';
export interface MediaAttachmentInput {
  readonly document:UiDocument;
  readonly documentRevision:string;
  readonly expectedDocumentId:string;
  readonly expectedRevision:string;
  readonly selection:{readonly nodeIds:readonly string[];readonly total:number};
  readonly asset:MediaAssetMetadata;
  readonly field:MediaAttachmentField;
  readonly blocked:boolean;
  readonly requestId:string;
}
/** Selection only chooses a pending asset. Call this only after an explicit Use action. */
export function prepareMediaAttachment(input:MediaAttachmentInput){
  const refuse=(code:string,message:string)=>({ok:false as const,code,message});
  const {document,asset,field}=input;
  if(input.blocked)return refuse('MEDIA_ATTACHMENT_DRAFT','Apply or discard the current draft before attaching media.');
  if(document.id!==input.expectedDocumentId||input.documentRevision!==input.expectedRevision)return refuse('MEDIA_ATTACHMENT_STALE','The document changed after this media choice. Review the current selection and choose again.');
  if(input.selection.total!==1||input.selection.nodeIds.length!==1)return refuse('MEDIA_ATTACHMENT_SELECTION','Select exactly one media component before using the asset.');
  const node=document.nodes[input.selection.nodeIds[0]!];
  if(!node||node.kind!=='component'||node.revision!=='1'||!['vict.media.image','vict.media.video','vict.media.icon','vict.media.vector'].includes(node.definitionId))return refuse('MEDIA_ATTACHMENT_TARGET','The selected source is not a supported editable media component.');
  if(!['source','poster','captions'].includes(field))return refuse('MEDIA_ATTACHMENT_FIELD','Choose source, poster or captions.');
  if(asset.schema!=='vict.media-asset@1'||!/^asset:sha256:[a-f0-9]{64}$/.test(asset.reference)||asset.reference!==`asset:sha256:${asset.digest}`||!Number.isFinite(asset.size)||asset.size<=0)return refuse('MEDIA_ATTACHMENT_ASSET','Choose valid supplied media metadata from the current application store.');
  const isImage=asset.mime.startsWith('image/'),isVideo=asset.mime.startsWith('video/');
  const compatible=field==='source'?(node.definitionId==='vict.media.image'?isImage:node.definitionId==='vict.media.video'?isVideo:asset.mime==='image/svg+xml'):node.definitionId==='vict.media.video'&&(field==='poster'?isImage:asset.mime==='text/vtt');
  if(!compatible)return refuse('MEDIA_ATTACHMENT_TYPE',`The selected ${asset.mime} asset cannot be used as ${field} on ${node.definitionId}.`);
  const previous=node.props?.[field],replacesBinding=!!previous&&previous.type!=='literal';
  const inlineData=node.props?.data;
  const clearsInlineData=field==='source'&&['vict.media.icon','vict.media.vector'].includes(node.definitionId)&&!!inlineData&&(inlineData.type!=='literal'||inlineData.value!=='');
  const existing=Object.entries(document.assets).find(([,ref])=>ref.kind==='digest'&&ref.digest.toLowerCase()===asset.digest);
  const key=existing?.[0]??`media-${asset.digest}`;
  const commands:TransactionDraft['commands'][number][]=[];
  if(!existing)commands.push({op:'replaceDocument',document:{...document,assets:{...document.assets,[key]:{id:key,kind:'digest',digest:asset.digest}}}});
  commands.push({op:'bindExpression',nodeId:node.id,target:{kind:'prop',name:field},expression:{type:'literal',value:asset.reference}});
  if(clearsInlineData)commands.push({op:'bindExpression',nodeId:node.id,target:{kind:'prop',name:'data'},expression:{type:'literal',value:''}});
  return {ok:true as const,documentId:document.id,expectedRevision:input.documentRevision,nodeId:node.id,field,reference:asset.reference,replacesBinding,clearsInlineData,draft:{requestId:input.requestId,reason:`Use supplied media as ${field}`,commands} satisfies TransactionDraft,guidance:'The host must check that these bytes still exist in the same application store and recheck this revision before applying the draft. A prepared attachment is not loading/playback proof.'};
}
