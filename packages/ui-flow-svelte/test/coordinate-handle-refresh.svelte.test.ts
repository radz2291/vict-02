import {expect,test,vi} from 'vitest';
import {mount,unmount,flushSync} from 'svelte';
const refresh=vi.hoisted(()=>vi.fn());
vi.mock('@xyflow/svelte',()=>({useUpdateNodeInternals:()=>refresh}));
import Host from './CoordinateHandleRefreshHost.svelte';
const settle=async()=>{flushSync();await Promise.resolve();flushSync();await Promise.resolve();};
/** Lifecycle regression only. Native measurements independently prove endpoint geometry. */
test('ancestor unit changes refresh only the owning stable-size card handle cache',async()=>{
  refresh.mockClear();
  const first=document.createElement('div'),second=document.createElement('div');document.body.append(first,second);
  const own=mount(Host,{target:first,props:{id:'own'}}),sibling=mount(Host,{target:second,props:{id:'sibling'}});
  try{
    await settle();refresh.mockClear();
    own.setScale(.348405);await settle();
    expect(refresh.mock.calls.map(call=>call[0])).toEqual(['own']);
    refresh.mockClear();own.setScale(.348405*.7);await settle();
    expect(refresh.mock.calls.map(call=>call[0])).toEqual(['own']);
    refresh.mockClear();own.setScale(.348405*.7);await settle();
    expect(refresh).not.toHaveBeenCalled();
  }finally{await unmount(own);await unmount(sibling);first.remove();second.remove();}
});
