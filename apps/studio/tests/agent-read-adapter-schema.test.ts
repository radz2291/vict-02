import {it,expect} from 'vitest';
import {standardSchemaToJSONSchema} from '@mastra/schema-compat/schema';
import {agentReadPresentation} from '../src/lib/designer/agent-reads.js';

it('preserves referenced read types through the pinned OpenAI-compatible request adapter without network',async()=>{
 // Pinned Mastra bundles its compatible adapter here. Use a local mock fetch,
 // with no router/auth configuration and no provider request.
 const moduleUrl=new URL('../../../node_modules/@mastra/core/dist/dist-rYWLu0px.js',import.meta.url).href;
 const {p:createOpenAICompatible}=await import(/* @vite-ignore */ moduleUrl);
 const standard={'~standard':{version:1,vendor:'offline-schema-probe',validate:(value:unknown)=>({value}),jsonSchema:{input:()=>agentReadPresentation}}};
 const schema=standardSchemaToJSONSchema(standard as never,{io:'input',target:'draft-07'});
 let body:Record<string,any>|undefined,localFetchCalls=0;
 const provider=createOpenAICompatible({name:'offline-schema-probe',baseURL:'https://schema-probe.invalid/v1',apiKey:'offline-placeholder',fetch:async(_url:unknown,init:RequestInit)=>{
  localFetchCalls++;body=JSON.parse(init.body as string);
  return new Response(JSON.stringify({id:'offline',object:'chat.completion',created:0,model:'offline',choices:[{index:0,message:{role:'assistant',content:'ready'},finish_reason:'stop'}],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}}),{headers:{'Content-Type':'application/json'}});
 }});
 await provider.chatModel('offline').doGenerate({prompt:[{role:'user',content:[{type:'text',text:'schema probe'}]}],tools:[{type:'function',name:'studio_screen_read',description:'probe',inputSchema:schema}]});
 expect(localFetchCalls).toBe(1);
 const transmitted=body!.tools[0].function.parameters;
 expect(transmitted).toEqual(agentReadPresentation);
 expect(transmitted.$defs.components.type).toBe('array');
 expect(transmitted.$defs.includeExamples.type).toBe('boolean');
 expect(transmitted.$defs.offset).toMatchObject({type:'integer',minimum:0,maximum:200000});
 expect(transmitted.oneOf).toHaveLength(18);
});
