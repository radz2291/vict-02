<script lang="ts">
  import {getAllContexts,mount,unmount,onMount,type Snippet} from 'svelte';
  import ViewportContent from './ViewportContent.svelte';
  import {APPLICATION_DOCUMENT,APPLICATION_PORTAL_TARGET} from './context.js';
  let {children,title='Application viewport',height=560,containerName,content=$bindable<HTMLElement|undefined>(undefined),onKeydown,onPointerdown,onDimensions}:{
    children:Snippet;title?:string;height?:number;containerName?:string;content?:HTMLElement;
    onKeydown?:(event:KeyboardEvent)=>void;onPointerdown?:(event:PointerEvent)=>void;
    onDimensions?:(dimensions:{width:number;height:number;model:'isolated-viewport'})=>void;
  }=$props();
  const contexts=getAllContexts();
  let frame:HTMLIFrameElement;
  let start:(loaded?:boolean)=>void=()=>{};
  onMount(()=>{
    let child:ReturnType<typeof mount>|undefined,styles:MutationObserver|undefined,resize:ResizeObserver|undefined;
    let activeDocument:Document|undefined,disposed=false;
    function clean(){styles?.disconnect();resize?.disconnect();if(child)void unmount(child);child=undefined;content=undefined;}
    start=(loaded=false)=>{
      if(disposed)return;
      const doc=frame?.contentDocument;
      // Ignore the transient initial about:blank document and a shell still
      // parsing. A real load event or an already-complete srcdoc is ready.
      if(!doc||doc.URL!=='about:srcdoc'||(!loaded&&doc.readyState!=='complete')||!doc.body||doc===activeDocument)return;
      clean();activeDocument=doc;
      // This is the same compiled Svelte renderer, mounted in an actual browser
      // viewport. No authored JavaScript, source-to-code regeneration or iframe
      // screenshot substitute is introduced.
      doc.documentElement.lang=document.documentElement.lang||'en';
      doc.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1,interactive-widget=resizes-content">';
      const base=doc.createElement('base');base.href=document.baseURI;doc.head.append(base);
      const styleHost=doc.createElement('div');styleHost.dataset.viewportStyles='';doc.head.append(styleHost);
      const copyStyles=()=>{
        styleHost.replaceChildren(...Array.from(document.head.querySelectorAll('style,link[rel="stylesheet"]')).map(node=>node.cloneNode(true)));
      };
      copyStyles();styles=new MutationObserver(copyStyles);styles.observe(document.head,{subtree:true,childList:true,characterData:true});
      const reset=doc.createElement('style');reset.textContent='html,body{margin:0;padding:0;width:100%;min-height:100%;}body{position:relative;isolation:isolate;overflow:auto;background:white;}[data-application-content]{min-height:100dvh;position:relative;isolation:isolate;}';doc.head.append(reset);
      const outlet=doc.createElement('div');outlet.dataset.applicationOverlayOutlet='';doc.body.append(outlet);

      const context=new Map(contexts);context.set(APPLICATION_DOCUMENT,()=>doc);context.set(APPLICATION_PORTAL_TARGET,()=>content?.querySelector<HTMLElement>('.uv-canvas')??content??outlet);
      child=mount(ViewportContent,{target:doc.body,context,props:{get children(){return children;},get containerName(){return containerName;},onReady:(element:HTMLElement)=>{content=element;}}});
      doc.addEventListener('keydown',event=>onKeydown?.(event));doc.addEventListener('pointerdown',event=>onPointerdown?.(event),true);
      const measure=()=>onDimensions?.({width:doc.documentElement.clientWidth,height:doc.documentElement.clientHeight,model:'isolated-viewport'});
      resize=new ResizeObserver(measure);resize.observe(frame);measure();
    };
    start();return ()=>{disposed=true;start=()=>{};clean();};
  });
</script>
<!-- Fixed inert host shell only: authored content still comes from the same
     compiled renderer. srcdoc retains the embedding document's URL context
     for nested resources without adding authored HTML, scripts or permissions. -->
<iframe bind:this={frame} {title} srcdoc="<!doctype html><html><head></head><body></body></html>" onload={()=>start(true)} style:height={`${Math.max(160,Math.min(8192,height))}px`} data-application-viewport="isolated"></iframe>
<style>iframe{display:block;width:100%;border:0;background:white;min-width:0;}</style>
