import {it,expect} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
import type {UiScopedSlotFrame} from '@victframework/ui-svelte';
import type {GraphWorkspaceContext} from '../src/composition/context.js';
import Harness from './EdgeSettingsLifetime.svelte';
const settle=async()=>{flushSync();await Promise.resolve();flushSync();};
for(const settingsOnly of [true,false])it(`expired settings callbacks refuse after ${settingsOnly?'settings-only':'whole-workspace'} unmount`,async()=>{
 const target=document.createElement('div');document.body.append(target);let frame!:UiScopedSlotFrame;const events:unknown[]=[];
 const app=mount(Harness,{target,props:{initial:JSON.stringify({schema:'vict.flow-graph@3',revision:0,nodeTypes:[],nodes:[],edges:[]}),record:value=>{frame=value;},emit:(...args:unknown[])=>events.push(args)}});await settle();const captured=frame;
 try{
  if(settingsOnly){app.hideSettings();await settle();}else await unmount(app);
  const before=events.length;captured.onStateChange?.('color','#abc');captured.onOutput?.('reset');await settle();expect(events).toHaveLength(before);
  if(settingsOnly){const context=(globalThis as unknown as {edgeTestContext:GraphWorkspaceContext}).edgeTestContext;context.apply([{type:'setEdgeDefaults',appearance:{width:3}}]);await settle();expect(context.graph.edgeDefaults).toEqual({width:3});const count=events.length;captured.onOutput?.('reset');expect(events).toHaveLength(count);expect(context.graph.edgeDefaults).toEqual({width:3});}
 }finally{if(settingsOnly)await unmount(app);target.remove();delete (globalThis as unknown as {edgeTestContext?:GraphWorkspaceContext}).edgeTestContext;}
});
