import {describe,it,expect} from 'vitest';
import type {UiDocument,UiNode} from '@victframework/ui';
import type {MediaAssetMetadata} from '@victframework/ui-media-svelte/assets';
import {canonicalAssetMediaFacts,projectStoredMediaMetadata,prepareMediaAttachment,agentMediaInventorySnapshot,agentMediaInventorySchema,type MediaAttachmentInput} from '../src/lib/designer/media-assets.js';

const digest='a'.repeat(64);
const asset:MediaAssetMetadata={schema:'vict.media-asset@1',reference:`asset:sha256:${digest}`,digest,name:'supplied.png',mime:'image/png',size:50,createdAt:'2026-10-27T00:00:00.000Z'};
function source(definitionId='vict.media.image'):UiDocument{return {schema:'vict.ui-document@1',id:'media-attachment',revision:'1',root:'media',nodes:{media:{kind:'component',id:'media',definitionId,revision:'1',props:{source:{type:'ref',path:'state.selectedImage'}}}},componentDefinitions:{},styleSources:{},tokens:{},conditions:{},assets:{},localState:{selectedImage:{key:'selectedImage',type:'string',initial:''}}};}
function input(document=source()):MediaAttachmentInput{return {document,documentRevision:'r1#4',expectedDocumentId:document.id,expectedRevision:'r1#4',selection:{nodeIds:['media'],total:1},asset,field:'source',blocked:false,requestId:'explicit-use'};}

describe('supplied-media facts and explicit source attachment',()=>{
  it('shares a bounded strict document/list-time inventory schema without bytes or provenance',()=>{
    const snapshot=agentMediaInventorySnapshot('media-attachment',[{...asset,provenance:'owner supplied'}],'2026-10-27T01:00:00.000Z');
    expect(snapshot).toMatchObject({documentId:'media-attachment',listedAt:'2026-10-27T01:00:00.000Z',total:1,truncated:false});
    expect(snapshot.items[0]).not.toHaveProperty('provenance');expect(snapshot.items[0]).not.toHaveProperty('bytes');
    expect(agentMediaInventorySchema.safeParse({...snapshot,items:[{...snapshot.items[0],bytes:[1,2,3]}]}).success).toBe(false);
    expect(agentMediaInventorySchema.safeParse({...snapshot,items:[snapshot.items[0],snapshot.items[0]],total:2}).success).toBe(false);
    const many=Array.from({length:101},(_,index)=>{const digest=index.toString(16).padStart(64,'0');return {...asset,digest,reference:`asset:sha256:${digest}`};});
    expect(agentMediaInventorySnapshot('media-attachment',many)).toMatchObject({total:101,truncated:true});expect(agentMediaInventorySnapshot('media-attachment',many).items).toHaveLength(100);
  });
  it('derives the entire usable digest source reference without inventing MIME or byte presence',()=>{
    const facts=canonicalAssetMediaFacts({id:'photo-hint',kind:'digest',digest});
    expect(facts).toMatchObject({sourceReference:`asset:sha256:${digest}`,mediaReferenceSupported:true,mime:null,availability:'not-checked'});
    expect(canonicalAssetMediaFacts({id:'old-digest',kind:'digest',digest:'unsupported-scheme'})).toMatchObject({sourceReference:null,mediaReferenceSupported:false});
    expect(canonicalAssetMediaFacts({id:'external',kind:'external',href:'https://example.test/image.png'}).sourceReference).toBe('https://example.test/image.png');
  });
  it('projects actual store MIME/name metadata with a visible count/budget',()=>{
    const result=projectStoredMediaMetadata([asset,{...asset,name:'another.png'}],1);
    expect(result).toMatchObject({items:[{name:'supplied.png',mime:'image/png',reference:asset.reference}],total:2,truncated:true});
  });
  it('prepares one canonical history transaction without mutating source or runtime data',()=>{
    const document=source(),before=JSON.stringify(document),result=prepareMediaAttachment(input(document));
    expect(result).toMatchObject({ok:true,replacesBinding:true,nodeId:'media',reference:asset.reference,expectedRevision:'r1#4'});
    if(!result.ok)return;
    expect(result.draft.commands).toHaveLength(2);
    expect(result.draft.commands[0]).toMatchObject({op:'replaceDocument',document:{assets:{[`media-${digest}`]:{kind:'digest',digest}}}});
    expect(result.draft.commands[1]).toEqual({op:'bindExpression',nodeId:'media',target:{kind:'prop',name:'source'},expression:{type:'literal',value:asset.reference}});
    expect(JSON.stringify(document)).toBe(before);
    expect(document.localState.selectedImage?.initial).toBe('');
  });
  it('refuses stale source, drafts, mixed or multiple selections and incompatible MIME without a draft',()=>{
    for(const changed of [{expectedRevision:'old'},{expectedDocumentId:'other'},{blocked:true},{selection:{nodeIds:['media'],total:2}},{selection:{nodeIds:[],total:1}},{asset:{...asset,mime:'video/mp4'}},{field:'captions' as const}]){
      const result=prepareMediaAttachment({...input(),...changed});expect(result.ok).toBe(false);expect(result).not.toHaveProperty('draft');
    }
    expect(prepareMediaAttachment(input(source('vict.catalog.button')))).toMatchObject({ok:false,code:'MEDIA_ATTACHMENT_TARGET'});
  });
  it('allows only matching video poster/captions fields and clears inline custom artwork deliberately',()=>{
    expect(prepareMediaAttachment({...input(source('vict.media.video')),field:'poster'})).toMatchObject({ok:true,field:'poster'});
    expect(prepareMediaAttachment({...input(source('vict.media.video')),field:'captions',asset:{...asset,mime:'text/vtt'}})).toMatchObject({ok:true,field:'captions'});
    const document=source('vict.media.vector'),media=document.nodes.media as Extract<UiNode,{kind:'component'}>;
    const updated={...document,nodes:{...document.nodes,media:{...media,props:{...media.props,data:{type:'literal' as const,value:'old geometry'}}}}};
    const result=prepareMediaAttachment({...input(updated),asset:{...asset,mime:'image/svg+xml'}});
    expect(result).toMatchObject({ok:true,clearsInlineData:true});
    if(result.ok)expect(result.draft.commands.at(-1)).toMatchObject({op:'bindExpression',target:{kind:'prop',name:'data'},expression:{type:'literal',value:''}});
  });
  it('reuses an existing matching canonical digest identity without deleting unrelated entries',()=>{
    const document={...source(),assets:{existing:{id:'existing',kind:'digest' as const,digest},unrelated:{id:'unrelated',kind:'external' as const,href:'https://example.test/other.png'}}};
    const result=prepareMediaAttachment(input(document));
    expect(result.ok).toBe(true);if(result.ok)expect(result.draft.commands).toHaveLength(1);
    expect(document.assets.unrelated.href).toBe('https://example.test/other.png');
  });
});
